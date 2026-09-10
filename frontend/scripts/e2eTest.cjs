const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:5176';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

const E2E_USER = {
  name: 'E2E Admin',
  email: process.env.E2E_EMAIL || 'e2e-admin@clinic.com',
  password: process.env.E2E_PASSWORD || 'password123',
  role: 'admin'
};

function isApiFailure(url, status) {
  if (!url) return false;
  if (!url.includes('/api/')) return false;
  // Ignore auth 401 during initial load if it happens before token is set
  return status >= 400;
}

function uniqByKey(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!m.has(k)) m.set(k, item);
  }
  return Array.from(m.values());
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const failures = [];
  const consoleErrors = [];
  const pageErrors = [];
  const redirectsToLogin = [];

  page.on('console', (msg) => {
    try {
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push({ text: msg.text() });
      }
    } catch (_) {
      // ignore
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push({ message: err?.message || String(err) });
  });

  page.on('response', async (res) => {
    try {
      const status = res.status();
      const url = res.url();
      if (isApiFailure(url, status)) {
        failures.push({ status, url });
      }
    } catch (_) {
      // ignore
    }
  });

  try {
    console.log('Navigating to base', BASE);
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const baseApi = API_BASE.replace(/\/$/, '');

    async function getDevToken(role) {
      const dev = await fetch(`${baseApi}/api/auth/dev-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 2, role, email: `e2e-${role}@local` })
      });
      if (!dev.ok) {
        const t = await dev.text().catch(() => '');
        throw new Error(`dev-token failed ${dev.status} ${t}`);
      }
      return dev.json();
    }

    async function apiJson(path, { method = 'GET', token, body } = {}) {
      const url = `${baseApi}${path}`;
      const res = await fetch(url, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const text = await res.text().catch(() => '');
      let json;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      return { ok: res.ok, status: res.status, json, text, url };
    }

    async function injectAuth(role) {
      const { token, user } = await getDevToken(role);
      const ok = await page.evaluate(({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        return true;
      }, { token, user });
      if (!ok) throw new Error('Failed to inject auth');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(500);
      return { token, user };
    }

    async function visit(path, opts = {}) {
      const label = opts.label || path;
      try {
        console.log('Visiting', label);
        await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(opts.waitMs || 1500);
        const url = page.url();
        if (url.includes('/login')) {
          redirectsToLogin.push({ path, url });
        }
      } catch (e) {
        console.warn('Page visit failed:', label, e.message);
      }
    }

    let patientId = process.env.E2E_PATIENT_ID || '1';
    try {
      const adminToken = (await getDevToken('admin')).token;
      const r = await apiJson('/api/patients?limit=1', { token: adminToken });
      if (r.ok) {
        const data = r.json;
        const p = data?.data?.patients?.[0] || data?.patients?.[0] || null;
        if (p?.id) patientId = String(p.id);
      }
    } catch (_) {}

    // Role: admin (broad access)
    const { token: adminToken } = await injectAuth('admin');
    const adminPages = [
      '/doctor-dashboard',
      '/staff-dashboard',
      '/queue',
      '/patients',
      '/appointments',
      '/billing',
      '/payments',
      '/receipts',
      '/prescriptions',
      '/lab-investigations',
      '/lab-templates',
      '/receipt-templates',
      '/symptoms-templates',
      '/diagnosis-templates',
      '/injection-templates',
      '/medications-templates',
      '/prescription-templates',
      '/vip-patients',
      '/analytics',
      '/backup',
      '/audit-logs',
      '/clinics',
      '/user-management',
      '/doctor-export',
      '/doctor-qr-management',
      '/reception-dashboard',
      '/billing-dashboard',
      '/settings',
      '/whats-new'
    ];
    for (const p of adminPages) await visit(p);

    // ============================================
    // Deep smoke: Queue idempotency (API-level)
    // ============================================
    try {
      // Ensure we have a real patient id
      const pr = await apiJson(`/api/patients?limit=1`, { token: adminToken });
      const p = pr?.json?.data?.patients?.[0] || pr?.json?.patients?.[0] || null;
      const pId = String(p?.id || patientId);

      const add1 = await apiJson('/api/queue', { method: 'POST', token: adminToken, body: { patient_id: Number(pId) } });
      if (!add1.ok && add1.status !== 200) {
        failures.push({ status: add1.status, url: add1.url });
      }
      const qid1 = add1.json?.queue_id;
      const token1 = add1.json?.token_number;

      const add2 = await apiJson('/api/queue', { method: 'POST', token: adminToken, body: { patient_id: Number(pId) } });
      if (!add2.ok && add2.status !== 200) {
        failures.push({ status: add2.status, url: add2.url });
      }
      const qid2 = add2.json?.queue_id;
      const token2 = add2.json?.token_number;

      if (qid1 && qid2 && String(qid1) !== String(qid2)) {
        consoleErrors.push({ text: `Queue idempotency failed: queue_id mismatch ${qid1} vs ${qid2}` });
      }
      if (token1 && token2 && String(token1) !== String(token2)) {
        consoleErrors.push({ text: `Queue idempotency failed: token_number mismatch ${token1} vs ${token2}` });
      }
    } catch (e) {
      consoleErrors.push({ text: `Queue idempotency test failed: ${e.message}` });
    }

    // Patient-scoped pages
    await visit(`/patient-overview/${patientId}`, { label: `patient-overview/${patientId}`, waitMs: 2500 });
    await visit(`/family-history/${patientId}`, { label: `family-history/${patientId}` });
    await visit(`/allergies/${patientId}`, { label: `allergies/${patientId}` });
    await visit(`/insurance/${patientId}`, { label: `insurance/${patientId}` });
    await visit(`/orders/${patientId}`, { label: `orders/${patientId}`, waitMs: 2500 });
    await visit(`/prescription-preview/${patientId}`, { label: `prescription-preview/${patientId}`, waitMs: 2500 });

    // Role: doctor (doctor-settings is doctor-only)
    const { token: doctorToken } = await injectAuth('doctor');
    await visit('/doctor-settings', { waitMs: 2500 });
    await visit('/doctor-dashboard');
    await visit('/queue');

    // ============================================
    // Deep smoke: PrescriptionPad flow (UI-level)
    // - add medicine
    // - set freq/timing/days
    // - verify instructions auto-update + language + days
    // ============================================
    try {
      await page.goto(`${BASE}/orders/${patientId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      // Select instruction language = Hindi (if available)
      const langSelect = page.locator('select').filter({ has: page.locator('option[value="hi"]') }).first();
      if (await langSelect.count()) {
        await langSelect.selectOption('hi');
        await page.waitForTimeout(800);
      }

      const medInput = page.locator('[data-testid="medicine-input"]');
      await medInput.waitFor({ state: 'visible', timeout: 15000 });

      const freqListBefore = page.locator('[data-testid^="med-frequency-"]');
      const beforeCount = await freqListBefore.count();

      await medInput.fill('Paracetamol');
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        ({ beforeCount }) => document.querySelectorAll('[data-testid^="med-frequency-"]').length > beforeCount,
        { beforeCount },
        { timeout: 15000 }
      );
      await page.waitForTimeout(400);

      const freqList = page.locator('[data-testid^="med-frequency-"]');
      const newCount = await freqList.count();
      const freqEl = freqList.nth(newCount - 1);
      const freqTestId = await freqEl.getAttribute('data-testid');
      const m = (freqTestId || '').match(/med-frequency-(\d+)/);
      if (!m) throw new Error(`Could not parse med index from ${freqTestId}`);
      const rowIdx = m[1];

      const freq = page.locator(`[data-testid="med-frequency-${rowIdx}"]`);
      const timing = page.locator(`[data-testid="med-timing-${rowIdx}"]`);
      const days = page.locator(`[data-testid="med-duration-${rowIdx}"]`);
      const instr = page.locator(`[data-testid="med-instructions-${rowIdx}"]`);

      await freq.waitFor({ state: 'visible', timeout: 15000 });
      await timing.waitFor({ state: 'visible', timeout: 15000 });
      await days.waitFor({ state: 'visible', timeout: 15000 });
      await instr.waitFor({ state: 'visible', timeout: 15000 });

      // Ensure auto-instructions: clear (UI toggles back to auto mode)
      await instr.fill('');
      await page.waitForTimeout(200);

      // Trigger changes
      await freq.fill('0-0-1');
      await page.waitForTimeout(150);
      await freq.fill('1-0-1');
      await page.waitForTimeout(250);

      await timing.fill('After Lunch and Dinner');
      await page.waitForTimeout(250);

      await days.fill('10');
      await page.keyboard.press('Tab').catch(() => {});
      await page.waitForTimeout(900);

      const instrVal = await instr.inputValue();
      if (!instrVal || !/10/.test(instrVal)) {
        consoleErrors.push({ text: `PrescriptionPad auto-instructions did not include updated days. instructions="${instrVal}"` });
      }

      // Switch language to English and ensure it re-generates (still includes 10)
      if (await langSelect.count()) {
        await langSelect.selectOption('en');
        await page.waitForTimeout(900);
        const instrVal2 = await instr.inputValue();
        if (!instrVal2 || !/10/.test(instrVal2)) {
          consoleErrors.push({ text: `PrescriptionPad language regen did not preserve days. instructions="${instrVal2}"` });
        }
      }
    } catch (e) {
      consoleErrors.push({ text: `PrescriptionPad deep smoke failed: ${e.message}` });
    }

    // Attempt basic PrescriptionPad flow via queue selection
    try {
      await page.goto(`${BASE}/queue`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000);
      const visitBtn = page.locator('button:has-text("Visit")').first();
      if (await visitBtn.count()) {
        await visitBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1200);
        const selectedPatientId = await page.evaluate(() => sessionStorage.getItem('selectedPatientId') || sessionStorage.getItem('selectedPatient') || null);
        if (selectedPatientId) {
          await visit(`/orders/${selectedPatientId}`, { label: `orders/${selectedPatientId}`, waitMs: 3000 });
        }
      }
    } catch (e) {
      console.warn('Queue->Visit flow failed:', e.message);
    }

    // Always capture a screenshot of dashboard for quick debugging
    try {
      await page.goto(`${BASE}/doctor-dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: './tmp_screenshots/e2e_doctor_dashboard.png', fullPage: true });
      console.log('Captured doctor dashboard screenshot');
    } catch (e) {
      console.warn('Screenshot capture failed:', e.message);
    }

    // Report failures
    const apiUnique = uniqByKey(failures, f => `${f.status} ${f.url}`);
    const consoleUnique = uniqByKey(consoleErrors, e => e.text);
    const pageUnique = uniqByKey(pageErrors, e => e.message);
    const redirUnique = uniqByKey(redirectsToLogin, r => `${r.path} -> ${r.url}`);

    const hasAnyFailure = apiUnique.length > 0 || consoleUnique.length > 0 || pageUnique.length > 0 || redirUnique.length > 0;
    if (hasAnyFailure) {
      if (apiUnique.length > 0) {
        console.log('\nAPI failures detected:');
        for (const f of apiUnique) console.log('-', f.status, f.url);
      }
      if (consoleUnique.length > 0) {
        console.log('\nConsole errors detected:');
        for (const e of consoleUnique) console.log('-', e.text);
      }
      if (pageUnique.length > 0) {
        console.log('\nPage errors detected:');
        for (const e of pageUnique) console.log('-', e.message);
      }
      if (redirUnique.length > 0) {
        console.log('\nUnexpected redirects to /login detected:');
        for (const r of redirUnique) console.log('-', r.path, '->', r.url);
      }
      process.exitCode = 2;
    } else {
      console.log('\nNo API failures, console errors, page errors, or login redirects detected.');
    }

  } catch (err) {
    console.error('E2E run failed', err);
  } finally {
    await browser.close();
  }
})();

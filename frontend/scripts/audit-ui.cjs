// Isolated UI audit: API fixtures are deliberate, NOT a live database E2E test.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  let executablePath = process.env.CHROMIUM_PATH;
  let args = ['--no-sandbox'];
  if (!executablePath) {
    try { const module = require('@sparticuz/chromium'); const bundled = module.default || module; executablePath = await bundled.executablePath(); args = bundled.args; } catch { /* Playwright installed browser */ }
  }
  const browser = await chromium.launch({headless:true, executablePath, args});
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const results = [];
  page.on('pageerror', err => errors.push(err.message));
  const base = process.env.BASE_URL || 'http://localhost:5173';
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname.includes('/auth/verify-credentials')) return route.fulfill({status:401,json:{error:'Invalid credentials'}});
    if (url.pathname.includes('/prescriptions/view/')) return route.fulfill({status:404,json:{success:false,error:'Prescription not found'}});
    if (/doctor-availability\/.*\/slots$/.test(url.pathname)) return route.fulfill({json:{slots:[{is_active:1,slot_time:'12:15:00',display_time:'12:15 PM'}]}});
    if (url.pathname === '/api/doctor-billing/dashboard') return route.fulfill({json:{success:true,data:{unbilledVisits:[],billedPayments:[],pendingPayments:[],summary:{totalCollected:0,totalOutstanding:0,unbilledCount:0,billedCount:0,pendingCount:0}}}});
    const json = {success:true, data:[], patients:[], doctors:[], clinics:[], slots:[], availability:[], records:[], labs:[], vitals:[], notifications:[], templates:[], items:[], bills:[], appointments:[], queue:[], total:0, stats:{}, pagination:{total:0,totalPages:1}};
    return route.fulfill({json});
  });
  try {
    await page.goto(base + '/login');
    await page.getByLabel('Email Address',{exact:true}).fill('invalid@example.com');
    await page.getByLabel('Password',{exact:true}).fill('wrong-password');
    await page.getByRole('button',{name:'Show password',exact:true}).click();
    assert.equal(await page.locator('#login-password').getAttribute('type'),'text');
    await page.getByRole('button',{name:'Hide password',exact:true}).click();
    await page.getByRole('button',{name:'Sign In to Portal'}).click();
    await page.getByRole('alert').filter({hasText:'Invalid credentials'}).waitFor();
    assert.equal(await page.locator('#login-email').inputValue(),'invalid@example.com');
    assert.ok(page.url().endsWith('/login'));
    results.push('PASS login labels, password toggles, 401 preserves form and shows error');
    for (const path of ['/', '/enhanced-login', '/universal-otp-login', '/doctor-otp-login', '/book-appointment', '/qr/999', '/prescription/view/999']) {
      await page.goto(base + path);
      await page.waitForTimeout(1500);
      assert.ok((await page.locator('body').innerText()).trim().length > 20,path);
      results.push(`PASS public render ${path}`);
    }
    await page.goto(base + '/book-appointment');
    await page.getByLabel('Full Name *',{exact:true}).fill('Audit Patient');
    await page.getByLabel('Phone Number *',{exact:true}).fill('9876543210');
    await page.getByLabel('Preferred Date *',{exact:true}).fill('2026-11-03');
    await page.getByRole('button',{name:'12:15 PM',exact:true}).click();
    const submitted = page.waitForRequest(r=>r.url().includes('/api/appointment-intents') && r.method()==='POST');
    await page.getByRole('button',{name:'Confirm Booking',exact:true}).click();
    assert.equal((await submitted).postDataJSON().full_name,'Audit Patient');
    await page.getByText('Appointment booked successfully!',{exact:false}).first().waitFor();
    results.push('PASS booking fields, date, slot button, submit payload and success feedback (mock API)');
    await page.goto(base + '/patients');
    await page.waitForURL(base + '/');
    results.push('PASS unauthenticated protected route redirects');
    await context.addInitScript(() => {
      localStorage.setItem('_cache_version','v2');
      localStorage.setItem('token','fixture-token');
      localStorage.setItem('user',JSON.stringify({id:1,name:'Audit Admin',role:'admin',email:'audit@example.test'}));
    });
    const source = fs.readFileSync(require('node:path').join(__dirname,'../src/App.jsx'),'utf8');
    const paths = [...source.matchAll(/<Route path="([^"]+)"/g)].map(m=>m[1]).filter(p=>p!=='*' && p!=='/' && !p.includes('login') && !p.startsWith('/qr/') && !p.startsWith('/prescription/view/') && p!=='/book-appointment');
    for (const template of paths) {
      const path = template.replace(/:\w+/g,'1');
      const before = errors.length;
      await page.goto(base + path);
      await page.waitForTimeout(1000);
      const text = await page.locator('body').innerText();
      results.push(`${errors.length===before && !/Something went wrong|Error loading page/i.test(text) ? 'PASS' : 'FAIL'} fixture render ${path}`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(base + '/login');
    await page.getByLabel('Email Address',{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    results.push('PASS mobile login no horizontal overflow');
  } finally {
    await browser.close();
    console.log(results.join('\n'));
    console.log('Runtime errors:',JSON.stringify(errors,null,2));
    if (errors.length || results.some(r=>r.startsWith('FAIL'))) process.exitCode=1;
  }
})().catch(e=>{console.error(e);process.exitCode=1});

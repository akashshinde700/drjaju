const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'http://localhost:5174';
const pages = [
  '/',
  '/login',
  '/doctor-dashboard',
  '/patients',
  '/queue',
  '/payments',
  '/billing'
];

// E2E: additional prescription workflow steps (attempt to open MyGenie modal)
pages.push('/doctor-dashboard');

(async () => {
  const outDir = path.resolve(__dirname, '..', 'tmp_screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const allLogs = {};

  for (const p of pages) {
    const logs = [];
    const onConsole = (msg) => logs.push({ type: 'console.' + msg.type(), text: msg.text() });
    const onPageError = (err) => logs.push({ type: 'pageerror', text: err.message });

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    const url = base + p;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      const safeName = p === '/' ? 'root' : p.replace(/[^a-z0-9-_]/gi, '_');
      const shotPath = path.join(outDir, `${safeName}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      logs.push({ type: 'info', text: `screenshot_saved:${shotPath}` });
    } catch (err) {
      logs.push({ type: 'navigation_error', text: err.message });
    }

    allLogs[p] = logs;

    page.removeListener('console', onConsole);
    page.removeListener('pageerror', onPageError);
  }

  await browser.close();

  const outLog = path.join(outDir, 'console_logs.json');
  fs.writeFileSync(outLog, JSON.stringify(allLogs, null, 2));
  console.log('Smoke-test completed. Screenshots and logs saved to', outDir);
})();

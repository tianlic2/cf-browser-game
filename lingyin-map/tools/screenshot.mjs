// Development helper: capture one shot from the running dev server.
//   node tools/screenshot.mjs <state> <out.png> [width] [height]
import { chromium } from 'playwright-core';
const [, , state = 'hall', out = 'artifacts/shot.png', w = '1440', h = '900'] = process.argv;
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5200/', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__READY === true', null, { timeout: 60000, polling: 200 });
await page.evaluate(async (s) => { await window.__THREE_GAME_TEST_HOOKS__.setState(s); }, state);
await page.waitForTimeout(2600);
await page.screenshot({ path: out });
console.log('wrote', out, await page.evaluate(() => JSON.stringify(window.__STATS)));
await browser.close();

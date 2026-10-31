import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const failures = [];
  const errors = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      failures.push([response.status(), response.url()]);
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8123/?publicDeploy=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const boot = document.querySelector('#bootScreen');
    return !boot || boot.classList.contains('is-error');
  }, null, { timeout: 120_000 });
  assert.equal(await page.locator('#bootScreen.is-error').count(), 0, 'public boot completed');
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => ({
    maps: [...document.querySelectorAll('[data-map]')].map((node) => ({
      id: node.dataset.map,
      hidden: node.hidden,
    })),
    bioHidden: document.querySelector('[data-mode="bio"]')?.hidden,
  }));
  assert.deepEqual(state.maps.filter((map) => !map.hidden).map((map) => map.id),
    ['transport', 'blacktown', 'lingyin']);
  assert.equal(state.bioHidden, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log('PASS: public browser boot exposes only publishable maps and makes no failed asset requests.');
} finally {
  await browser.close();
}

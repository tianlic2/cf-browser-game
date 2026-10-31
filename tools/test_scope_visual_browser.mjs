// Requires the local server on :8123.
import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:8123/?debug=scope-visual-2&debugMap=transport&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.ready?.() &&
    window.__tactical.mapState().id === 'transport', null, { timeout: 120000 });
  await page.waitForSelector('#bootScreen', { state: 'detached', timeout: 30000 });
  await page.waitForFunction(() => !document.getElementById('hud').classList.contains('hidden'),
    null, { timeout: 30000 });
  await page.evaluate(() => {
    const t = window.__tactical;
    t.switchWeapon('barrett', true);
    t.clearSwitch();
  });
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const t = window.__tactical;
    t.setScoped(true);
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__tactical.pause());
  await page.waitForFunction(() => window.__tactical.isScoped() &&
    !document.getElementById('scope').classList.contains('hidden'));
  const audit = await page.evaluate(() => {
    const scope = document.getElementById('scope');
    const tube = scope.querySelector('.sc-tube');
    const dot = scope.querySelector('.sc-dot');
    const housing = scope.querySelector('.sc-housing');
    const tubeRect = tube.getBoundingClientRect();
    const dotStyle = getComputedStyle(dot);
    const outside = getComputedStyle(scope, '::before');
    return {
      tubeDiameter: tubeRect.width,
      viewportHeight: innerHeight,
      centered: Math.abs(tubeRect.left + tubeRect.width / 2 - innerWidth / 2) < 1 &&
        Math.abs(tubeRect.top + tubeRect.height / 2 - innerHeight / 2) < 1,
      dotColor: dotStyle.backgroundColor,
      dotSize: parseFloat(dotStyle.width),
      outsideBackground: outside.backgroundImage,
      housingVisible: getComputedStyle(housing).display !== 'none',
      horizontalOuterWidth: getComputedStyle(scope.querySelector('.sc-h'), '::before').width,
      crosshairHidden: document.getElementById('crosshair').classList.contains('hidden'),
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
    };
  });
  assert.deepEqual(errors, [], 'scope preview has no browser/runtime errors');
  assert.ok(audit.tubeDiameter >= audit.viewportHeight * .86,
    'the scope fills most of the screen height like the reference');
  assert.equal(audit.centered, true, 'the optical circle remains centered');
  assert.ok(audit.dotColor.includes('239, 36, 36') && audit.dotSize >= 6,
    'the reticle has a clear red center dot');
  assert.ok(!audit.outsideBackground.includes('rgb(0, 0, 0)'),
    'the peripheral view uses a translucent gradient instead of a black field');
  assert.equal(audit.housingVisible, true, 'the metallic scope housing is present');
  assert.ok(parseFloat(audit.horizontalOuterWidth) > 100,
    'the outer reticle arms are visibly thicker and extended');
  assert.equal(audit.crosshairHidden, true, 'the hip-fire crosshair stays hidden while scoped');
  assert.equal(audit.hudVisible, true, 'the normal HUD remains above the scope overlay');
  await page.screenshot({ path: '/private/tmp/cf-scope-visual.png' });
  console.log('PASS: CF-style peripheral scope visual rendered.', audit);
} finally {
  await browser.close();
}

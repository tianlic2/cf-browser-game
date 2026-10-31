import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('http://127.0.0.1:8123/?debug&debugMode=training&debugMap=blacktown&debugAutoStart=1&qa=approved-weapon-tuning-1');
  await page.waitForFunction(() => window.__tactical?.ready() && __tactical.mapState().loaded.length > 0,
    null, { timeout: 120000 });

  const expected = [
    { bp: 0, id: 'ak', mag: 36, reserve: 108, dmg: 37, reload: 2.43 },
    { bp: 1, id: 'm4', mag: 30, reserve: 90, dmg: 33, reload: 3.1 },
    { bp: 2, id: 'barrett', mag: 15, reserve: 30, dmg: 300, reload: 3.85 },
    { bp: 3, id: 'm4', mag: 41, reserve: 123, dmg: 35, reload: 3.1 },
    { bp: 4, id: 'scar', mag: 41, reserve: 123, dmg: 35, reload: 2.47 },
    { bp: 5, id: 'm200', mag: 15, reserve: 30, dmg: 220, reload: 3.42 },
    { bp: 6, id: 'akgold', mag: 41, reserve: 123, dmg: 37, reload: 2.71 },
    { bp: 7, id: 'kn57', mag: 70, reserve: 210, dmg: 500, reload: 91/37 },
  ];
  const actual = [];
  for (const item of expected) {
    actual.push(await page.evaluate(({ bp, id }) => {
      const t = __tactical;
      t.switchBackpack(bp); t.clearSwitch();
      return { id: t.curId(), ammo: t.getAmmo(), stats: t.weaponStats(id),
        skin: t.skinState().name, reload: t.getReloadDur(), loopErrors: t.loopErrors() };
    }, item));
  }
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i], a = actual[i];
    assert.equal(a.id, e.id, `backpack ${e.bp} weapon`);
    assert.equal(a.ammo.mag, e.mag, `${e.id} magazine`);
    assert.equal(a.ammo.reserve, e.reserve, `${e.id} reserve`);
    assert.equal(a.stats.dmg, e.dmg, `${e.id} body damage`);
    assert.equal(a.reload, e.reload, `${e.id} reload duration`);
    assert.equal(a.loopErrors, 0, `${e.id} runtime loop errors`);
  }
  const deagle = await page.evaluate(() => {
    const t = __tactical; t.switchWeapon('deagle'); t.clearSwitch();
    return { ammo: t.getAmmo(), stats: t.weaponStats('deagle') };
  });
  assert.equal(deagle.ammo.mag, 12);
  assert.equal(deagle.ammo.reserve, 48);
  assert.equal(deagle.stats.dmg, 54);
  assert.deepEqual(errors, []);
  assert.deepEqual(failed, []);
  console.log(JSON.stringify({ actual, deagle, errors, failed }, null, 2));
} finally {
  await browser.close();
}

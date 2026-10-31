// Requires the local server on :8123.
import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('http://127.0.0.1:8123/?debug=corpse-cleanup-1&debugMap=transport&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.ready?.() &&
    window.__tactical.mapState().id === 'transport' &&
    window.__tactical.enemyLoadouts().length > 0, null, { timeout: 120000 });
  await page.waitForSelector('#bootScreen', { state: 'detached', timeout: 30000 });

  const initial = await page.evaluate(() => {
    const t = window.__tactical;
    t.freezeEnemies(true);
    const killed = t.forceKillEnemy(0, false);
    const gun = t.groundItems().find(item => item.enemyDrop);
    return { killed, gun };
  });
  assert.equal(initial.killed, true, 'the runtime enemy is killed through the normal death path');
  assert.ok(initial.gun?.inScene, 'the enemy gun appears at the death location');
  assert.equal(initial.gun.lifetime, 1.7, 'the Fox drop shares the 0.7s fall + 1s hold lifetime');

  await page.waitForTimeout(380);
  const moving = await page.evaluate(() => ({
    gun: window.__tactical.groundItems().find(item => item.enemyDrop),
    corpse: window.__tactical.enemyCorpses()[0] || null,
    loopErrors: window.__tactical.loopErrors(),
  }));
  assert.ok(moving.gun && moving.corpse, 'gun and corpse remain during the death animation');
  assert.equal(moving.gun.yaw, initial.gun.yaw, 'enemy gun does not rotate');
  assert.equal(moving.gun.y, initial.gun.y, 'enemy gun does not bob vertically');
  assert.equal(moving.loopErrors, 0, 'the live update loop remains error-free');

  await page.waitForTimeout(700);
  const grounded = await page.evaluate(() => ({
    gun: window.__tactical.groundItems().find(item => item.enemyDrop),
    corpse: window.__tactical.enemyCorpses()[0] || null,
  }));
  assert.ok(grounded.gun && grounded.corpse,
    'the body and gun remain for the requested grounded hold');
  assert.equal(grounded.gun.yaw, initial.gun.yaw, 'the grounded gun remains still');

  await page.waitForFunction(() =>
    window.__tactical.groundItems().every(item => !item.enemyDrop) &&
    window.__tactical.enemyCorpses().length === 0,
  null, { timeout: 7000 });
  const cleared = await page.evaluate(() => ({
    enemyDrops: window.__tactical.groundItems().filter(item => item.enemyDrop).length,
    corpses: window.__tactical.enemyCorpses().length,
    loopErrors: window.__tactical.loopErrors(),
  }));
  assert.equal(cleared.enemyDrops, 0, 'the enemy gun is removed after the short death display');
  assert.equal(cleared.corpses, 0, 'the corpse disappears directly instead of sinking');
  assert.equal(cleared.loopErrors, 0, 'cleanup introduces no runtime loop error');
  assert.deepEqual(errors, [], 'browser runtime has no script or console errors');
  assert.deepEqual(failed, [], 'all required assets load successfully');
  console.log('PASS: runtime corpse and static enemy gun remain briefly, then disappear together.');
} finally {
  await browser.close();
}

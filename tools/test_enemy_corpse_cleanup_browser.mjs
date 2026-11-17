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
  assert.equal(initial.gun.lifetime, 20, 'the Fox drop has its own twenty-second lifetime');

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

  await page.waitForFunction(() => window.__tactical.enemyCorpses().length === 0,
    null, { timeout: 7000 });
  const separated = await page.evaluate(() => ({
    gun: window.__tactical.groundItems().find(item => item.enemyDrop),
    corpses: window.__tactical.enemyCorpses().length,
  }));
  assert.equal(separated.corpses, 0, 'the corpse still clears after the original short hold');
  assert.ok(separated.gun?.inScene, 'the enemy gun remains after its corpse is recycled');

  await page.evaluate(() => window.__tactical.stepGroundItems(20));
  const cleared = await page.evaluate(() => ({
    enemyDrops: window.__tactical.groundItems().filter(item => item.enemyDrop).length,
    corpses: window.__tactical.enemyCorpses().length,
    loopErrors: window.__tactical.loopErrors(),
  }));
  assert.equal(cleared.enemyDrops, 0, 'the enemy gun is removed when its independent lifetime expires');
  assert.equal(cleared.corpses, 0, 'the corpse disappears directly instead of sinking');
  assert.equal(cleared.loopErrors, 0, 'cleanup introduces no runtime loop error');

  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => document.getElementById('viewport'),
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  const playerDrop = await page.evaluate(() => {
    const t = window.__tactical;
    t.switchWeapon('ak');
    t.clearSwitch();
    const dropped = t.dropWeapon();
    return {
      dropped,
      item: t.groundItems().find(item => !item.enemyDrop),
      empty: t.emptySlotState(),
    };
  });
  assert.equal(playerDrop.dropped, true);
  assert.equal(playerDrop.item?.armed, true, 'a player gun is immediately armed with no pickup cooldown');
  assert.equal(playerDrop.item?.inFlight, true, 'the gun begins in the hand-to-ground throw phase');
  assert.ok(playerDrop.item.worldPosition[1] > playerDrop.item.y + .5,
    'the thrown gun starts visibly above its final ground height');
  assert.equal(playerDrop.empty.primary, true, 'dropping still empties the primary slot before approach');
  await page.waitForFunction(() => {
    const item = window.__tactical.groundItems().find(entry => !entry.enemyDrop);
    return item && !item.inFlight;
  }, null, { timeout: 2000 });
  const landedDrop = await page.evaluate(() =>
    window.__tactical.groundItems().find(item => !item.enemyDrop));
  assert.ok(Math.abs(landedDrop.worldPosition[0] - landedDrop.x) < .02 &&
    Math.abs(landedDrop.worldPosition[2] - landedDrop.z) < .02,
  'the throw finishes at the existing forward pickup location');
  assert.ok(Math.abs(landedDrop.worldPosition[1] - landedDrop.y) < .04,
    'the gun settles onto its measured ground height');
  await page.keyboard.down('w');
  await page.waitForFunction(() => !window.__tactical.emptySlotState().primary,
    null, { timeout: 3000 });
  await page.keyboard.up('w');
  assert.equal(await page.evaluate(() => window.__tactical.groundItems().some(item => !item.enemyDrop)), false,
    'walking over the just-dropped gun immediately picks it back up');

  const capped = await page.evaluate(() => {
    const t = window.__tactical;
    const spawned = [];
    for (let i = 0; i < 11; i++) {
      t.switchBackpack(i % t.BACKPACKS.length);
      t.clearSwitch();
      spawned.push(t.curId());
      t.dropWeapon();
    }
    return { spawned, items: t.groundItems().map(item => item.id) };
  });
  assert.equal(capped.items.length, 10, 'the runtime never retains more than ten ground guns');
  assert.equal(capped.items[0], capped.spawned[1], 'the eleventh gun evicts the oldest one first');
  assert.deepEqual(errors, [], 'browser runtime has no script or console errors');
  assert.deepEqual(failed, [], 'all required assets load successfully');
  console.log('PASS: corpse clears quickly, enemy gun persists for twenty seconds, and player drops can be picked up immediately.');
} finally {
  await browser.close();
}

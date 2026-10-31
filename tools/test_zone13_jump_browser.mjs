// Requires the local server on :8123. Verifies the actual player controller
// against a formal Zone 13 weapon crate rather than a synthetic movement loop.
import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:8123/?debug=zone13-jump-2&debugMap=bio&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.bioMode?.map?.bio?.weaponCrates?.length,
    null, { timeout: 120000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', { configurable: true,
      get: () => document.getElementById('viewport') });
    document.dispatchEvent(new Event('pointerlockchange'));
  });

  const setup = await page.evaluate(() => {
    const t = window.__tactical;
    t.pause?.();
    const mode = t.bioMode, p = t.player;
    const actors = [...mode.humans.filter(actor => actor.alive),
      ...mode.zombies.filter(actor => !actor.dead)];
    const crate = [...mode.map.bio.weaponCrates].sort((a, b) => {
      const clearance = item => Math.min(...actors.map(actor => {
        const q = actor.group.position;
        return Math.hypot(q.x - item.position[0], q.z - item.position[2]);
      }));
      return clearance(b) - clearance(a);
    })[0];
    const collider = crate.collider;

    let stableCrates = 0;
    for (const item of mode.map.bio.weaponCrates) {
      const box = item.collider;
      p.pos.set(box.x, box.h, box.z);
      p.vel.set(0, 0, 0); p.groundY = box.h; p.onGround = true;
      for (let i = 0; i < 8; i++) t.movementStep(1 / 120);
      if (Math.abs(p.pos.y - box.h) < .025 && p.onGround) stableCrates++;
    }

    // First prove that a non-NAV crate top remains ground for consecutive
    // controller frames after landing.
    p.pos.set(collider.x, collider.h, collider.z);
    p.vel.set(0, 0, 0); p.groundY = collider.h; p.onGround = true;
    for (let i = 0; i < 30; i++) t.movementStep(1 / 120);
    const stableTop = Math.abs(p.pos.y - collider.h) < .025 && p.onGround;

    // Then perform a real running jump across the same crate. Start on its
    // short axis so the test exercises side collision without requiring an
    // artificial teleport during flight.
    const direction = { x: 1, z: 0 };
    const startX = collider.x - collider.hx - .45 - .12;
    const startZ = collider.z;
    const floor = mode.map.navigation.heightAt(startX, startZ, collider.y0 + .12);
    p.pos.set(startX, Number.isFinite(floor) ? floor : collider.y0, startZ);
    p.vel.set(0, 0, 0); p.groundY = p.pos.y; p.onGround = true;
    p.yaw = Math.atan2(-direction.x, -direction.z);
    const token = window.__zone13JumpToken = (window.__zone13JumpToken || 0) + 1;
    window.__zone13JumpFrames = [];
    const sample = () => {
      if (window.__zone13JumpToken !== token) return;
      window.__zone13JumpFrames.push({ p: p.pos.toArray(), v: p.vel.toArray(),
        ground: p.onGround, ts: performance.now() });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample); t.resume();
    return { stableTop, stableCrates, crateCount: mode.map.bio.weaponCrates.length,
      top: collider.h, farX: collider.x + collider.hx + .45 };
  });
  await page.keyboard.down('w');
  await page.keyboard.down('Space');
  await page.waitForTimeout(120);
  await page.keyboard.up('Space');
  await page.waitForTimeout(980);
  await page.keyboard.up('w');
  const audit = await page.evaluate(setup => {
    window.__zone13JumpToken++;
    window.__tactical.pause();
    const frames = window.__zone13JumpFrames;
    const maxY = Math.max(...frames.map(frame => frame.p[1]));
    const crossed = frames.some(frame => frame.p[0] > setup.farX);
    const prematureStop = frames.some((frame, index) => index > 3 && !crossed &&
      frame.p[1] < setup.top - .03 && Math.abs(frame.v[0]) < .03);
    return { ...setup, crossed, prematureStop, maxY,
      airborne: frames.filter(frame => !frame.ground).length,
      final: frames.at(-1)?.p, finite: frames.every(frame =>
        [...frame.p, ...frame.v].every(Number.isFinite)) };
  }, setup);

  console.log('Zone 13 jump audit:', audit);
  assert.deepEqual(errors, [], 'Zone 13 jump test has no browser/runtime errors');
  assert.equal(audit.stableTop, true,
    'a visible crate top omitted from NAV remains stable standing support');
  assert.equal(audit.stableCrates, audit.crateCount,
    'every formal Zone 13 weapon crate has persistent standing support');
  assert.ok(audit.maxY > audit.top + .18, 'the normal jump rises above the crate top');
  assert.ok(audit.airborne > 8, 'the test exercised a real jump');
  assert.equal(audit.prematureStop, false,
    'ascending contact does not erase forward jump momentum');
  assert.equal(audit.crossed, true, 'the player clears the jumpable crate without sticking inside it');
  assert.equal(audit.finite, true, 'the repaired controller retains finite coordinates');
  console.log('PASS: formal Zone 13 crate-top support and running jump are stable.', audit);
} finally {
  await browser.close();
}

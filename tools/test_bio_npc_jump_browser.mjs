import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8123/?debug=bio-npc-jump-1&debugMap=bio&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.bioMode?.phase === 'live', null, { timeout: 120000 });
  const audit = await page.evaluate(() => {
    const t = window.__tactical; t.pause();
    const m = t.bioMode, human = m.humans.find(h => h.alive), zombie = m.zombies.find(z => !z.dead);
    const results = [];
    for (const [kind, actor] of [['human', human], ['zombie', zombie]]) {
      let result = null;
      for (const item of m.map.bio.weaponCrates) {
        const c = item.collider;
        for (const sign of [1, -1]) {
          const x = c.x - sign * (c.hx + .45 + .12), z = c.z;
          const floor = m.map.navigation.heightAt(x, z, c.y0 + .2);
          if (!Number.isFinite(floor) || Math.abs(floor-c.y0) > .12) continue;
          actor.group.position.set(x, floor, z);
          actor.lastSafePosition = [x, floor, z];
          actor.airborne = false; actor.jumpCooldown = 0; actor.jumpVelocity = 0;
          actor.moveX = actor.moveZ = 0; actor.stuckFor = 0;
          if (!m._canMove(x,z,floor,.45,actor)) continue;
          let triggered = kind === 'zombie' && m._tryLeap(actor, sign, 0);
          if (kind === 'zombie' && !triggered) continue;
          let peak = floor, maxX = x, minX = x, landedOnTop = false;
          for (let i = 0; i < 120; i++) {
            if (kind === 'human') m._moveHuman(actor, sign, 0, 1/60, 5.6);
            else { m._updateLeap(actor, 1/60); m._move(actor, sign * 5.6, 0, 1/60); }
            const p=actor.group.position;
            if (actor.airborne) triggered = true;
            peak=Math.max(peak,p.y); maxX=Math.max(maxX,p.x); minX=Math.min(minX,p.x);
            if (!actor.airborne && Math.abs(p.y-c.h)<.08) landedOnTop=true;
          }
          result={kind, triggered, peak, floor, top:c.h, crossed: sign > 0 ? maxX > c.x+c.hx : minX < c.x-c.hx,
            landedOnTop, final: actor.group.position.toArray()};
          actor.group.position.set(c.x, c.h, c.z);
          actor.lastSafePosition = [c.x, c.h, c.z];
          actor.airborne = false; actor.moveX = actor.moveZ = 0;
          for (let i = 0; i < 30; i++) m._move(actor, 0, 0, 1/60);
          result.stableTop = Math.abs(actor.group.position.y - c.h) < .04;
          actor.jumpCooldown = 0; actor.stuckFor = 0;
          for (let i = 0; i < 90; i++) {
            if (kind === 'human') m._moveHuman(actor, sign, 0, 1/60, 5.6);
            else { m._updateLeap(actor, 1/60); m._move(actor, sign * 5.6, 0, 1/60); }
          }
          result.leftTop = Math.abs(actor.group.position.x - c.x) > c.hx + .5 &&
            !actor.airborne && actor.group.position.y < c.h - .3;
          result.exitPosition = actor.group.position.toArray(); result.exitAirborne = actor.airborne;
          result.boxX = c.x; result.hx = c.hx;
          if (result.triggered && result.crossed && peak>c.h) break;
        }
        if (result?.triggered && result.crossed && result.peak>c.h) break;
      }
      results.push(result || {kind, triggered:false});
    }
    return results;
  });
  console.log('NPC crate jumps:', JSON.stringify(audit));
  assert.deepEqual(errors, []);
  for (const result of audit) {
    assert.equal(result.triggered, true, `${result.kind} detects a real crate`);
    assert.ok(result.peak > result.top, `${result.kind} rises above the crate`);
    assert.equal(result.crossed, true, `${result.kind} moves across the crate`);
    assert.equal(result.stableTop, true, `${result.kind} remains supported on the crate top`);
    assert.equal(result.leftTop, true, `${result.kind} can walk off the crate and land`);
  }
  console.log('PASS: human and zombie NPC controllers jump across real Zone 13 crates.');
} finally { await browser.close(); }

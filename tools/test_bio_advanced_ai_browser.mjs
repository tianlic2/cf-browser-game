// Requires the local server on :8123. Exercises the formal Zone 13 match and
// the advanced infection-mode coordination through the real browser runtime.
import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('http://127.0.0.1:8123/?debug=bio-tactical-2&debugMap=bio&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.bioMode?.phase === 'live', null,
    { timeout: 120000 });

  const audit = await page.evaluate(() => {
    const tactical = window.__tactical;
    tactical.pause?.();
    const mode = tactical.bioMode;
    for (let frame = 0; frame < 2400 && mode.phase === 'live'; frame++)
      mode.update(1 / 60, tactical.player, 1 / 60);

    const liveHumans = mode.humans.filter(actor => actor.alive);
    const liveZombies = mode.zombies.filter(actor => !actor.dead);
    const actors = [...liveHumans, ...liveZombies];
    const slots = liveZombies.filter(actor => Number.isInteger(actor.attackSlotIndex));
    const slotsByTarget = new Map();
    let uniqueSlots = true;
    for (const actor of slots) {
      const reserved = slotsByTarget.get(actor.attackSlotTarget) || new Set();
      if (reserved.has(actor.attackSlotIndex)) uniqueSlots = false;
      reserved.add(actor.attackSlotIndex);
      slotsByTarget.set(actor.attackSlotTarget, reserved);
    }

    let friendlyFireBlocked = false;
    if (liveHumans.length >= 2) {
      const shooter = liveHumans[0], mate = liveHumans[1];
      const saved = mate.group.position.clone();
      mate.group.position.set(shooter.group.position.x + 4, shooter.group.position.y,
        shooter.group.position.z);
      friendlyFireBlocked = mode._friendInLineOfFire(shooter, {
        x: shooter.group.position.x + 8,
        y: shooter.group.position.y,
        z: shooter.group.position.z,
      }, liveHumans);
      mate.group.position.copy(saved);
    }

    const recovery = [];
    const recoveryActor = liveZombies[0] || liveHumans[0];
    if (recoveryActor) {
      const saved = {
        stuckFor: recoveryActor.stuckFor,
        recoveryStage: recoveryActor.recoveryStage,
        recoverySide: recoveryActor.recoverySide,
        recoveryGoal: recoveryActor.recoveryGoal,
      };
      for (const stuckFor of [.3, .65, 1.05]) {
        recoveryActor.stuckFor = stuckFor;
        const direction = mode._recoverySteer(recoveryActor, 0, 1,
          liveZombies.includes(recoveryActor) ? 'zombie' : 'human');
        recovery.push({ stage: recoveryActor.recoveryStage,
          finite: direction.every(Number.isFinite) });
      }
      Object.assign(recoveryActor, saved);
    }

    return {
      phase: mode.phase,
      actorCount: actors.length,
      actorsFinite: actors.every(actor => {
        const p = actor.group.position;
        return [p.x, p.y, p.z, actor.moveX, actor.moveZ].every(Number.isFinite) &&
          !!actor.group.parent;
      }),
      uniqueSlots,
      slotsAssigned: slots.length,
      friendlyFireBlocked,
      recovery,
      performance: { ...mode.performance },
      diagnostics: tactical.bioAI(),
    };
  });

  assert.deepEqual(errors, [], 'advanced bio AI runs without browser/runtime errors');
  assert.ok(audit.actorCount > 0 && audit.actorsFinite,
    'long simulation retains finite, scene-attached NPCs');
  assert.ok(audit.performance.localAvoidanceQueries > 0,
    'the live match exercised predictive local avoidance');
  assert.ok(audit.performance.attackSlotAssignments > 0,
    'the live match assigned zombie approach slots');
  assert.ok(audit.performance.tacticalPositionQueries > 0,
    'the live match evaluated dynamic mercenary combat positions');
  assert.ok(audit.slotsAssigned > 0 && audit.uniqueSlots,
    `active zombies use unique attack slots around a target: ${JSON.stringify({ phase: audit.phase, slotsAssigned: audit.slotsAssigned, uniqueSlots: audit.uniqueSlots })}`);
  assert.equal(audit.friendlyFireBlocked, true,
    'mercenaries with a teammate in the firing lane hold fire');
  assert.deepEqual(audit.recovery.map(item => item.stage), [1, 2, 3],
    'staged recovery advances from sidestep through route reset');
  assert.ok(audit.recovery.every(item => item.finite),
    'all recovery stages return finite steering directions');
  assert.ok(audit.diagnostics.humans.every(actor => Number.isFinite(actor.aimFocus)),
    'browser diagnostics expose finite human aim confidence');
  console.log('PASS: advanced bio NPC coordination survived a formal long match.', audit.performance);
} finally {
  await browser.close();
}

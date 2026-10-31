// Requires the local server on :8123.
import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:8123/?debug=zone13-formal-1&debugMap=bio&debugAutoStart=1');
  await page.waitForFunction(() => window.__tactical?.mapState().id === 'bio' &&
    window.__tactical.scene.getObjectByName('zone13-formal-map')?.visible, null, { timeout: 120000 });
  const audit = await page.evaluate(() => {
    const t = window.__tactical;
    const root = t.scene.getObjectByName('zone13-formal-map');
    return {
      state: t.mapState(),
      rootChildren: root.children.length,
      worldBatches: root.children.filter((item) => item.name.startsWith('zone13-world-')).length,
      atlasSize: (() => {
        const image = root.getObjectByName('zone13-world-atlas')?.material?.map?.image;
        return image ? [image.width, image.height] : null;
      })(),
      propBatches: root.children.filter((item) => item.name.startsWith('zone13-source-prop-')).length,
      bioPhase: t.bioMode.phase,
      rules: t.bioMode.status().ruleVariant,
      humans: t.bioMode.humans.length,
      player: t.player.pos.toArray(),
      triangles: t.renderer.info.render.triangles,
    };
  });
  assert.deepEqual(errors, [], 'formal Zone 13 loads without browser/runtime errors');
  assert.equal(audit.state.name, 'Zone 13（生化）');
  assert.equal(audit.worldBatches, 2, 'the textured BSP atlas and Source glass batch are visible');
  assert.deepEqual(audit.atlasSize, [2048, 2304], 'the expanded 70-texture atlas loaded at runtime');
  assert.ok(audit.propBatches >= 4, 'vehicles, lamps and street props are instantiated');
  assert.equal(audit.state.spawns.player.length, 12, 'the live map provides twelve mercenary starts');
  assert.equal(audit.humans, 12, 'the formal infection match deployed all mercenaries');
  assert.equal(audit.rules, 'zone13zm', 'the formal map defaults to the Zone 13 source rules');
  assert.ok(audit.triangles > 20000, 'the renderer submitted the actual Zone 13 scene');
  await page.waitForFunction(() => window.__tactical.bioMode.phase === 'live', null, { timeout: 30000 });
  const mobility = await page.evaluate(() => {
    const t = window.__tactical;
    for (let i = 0; i < 1800 && t.bioMode.phase === 'live'; i++)
      t.bioMode.update(1 / 60, t.player, 1 / 60);
    const actors = [
      ...t.bioMode.humans.filter((actor) => actor.alive),
      ...t.bioMode.zombies.filter((actor) => !actor.dead),
    ];
    return actors.map((actor) => {
      const p = actor.group.position;
      const floor = t.bioMode.map.navigation.heightAt(p.x, p.z,
        p.y + (t.bioMode.map.stepHeight || .5) + .04);
      return { finite: [p.x, p.y, p.z, floor].every(Number.isFinite),
        attached: !!actor.group.parent, delta: Math.abs(p.y - floor) };
    });
  });
  assert.ok(mobility.length > 0, 'long simulation retains active NPCs');
  assert.ok(mobility.every((actor) => actor.finite && actor.attached && actor.delta < .08),
    'NPCs remain attached to their current NAV floor instead of falling through stacked floors');
  await page.screenshot({ path: '/private/tmp/zone13-formal-game.png' });
  console.log('PASS: playable Zone 13 loaded in the formal bio game.', audit);
} finally {
  await browser.close();
}

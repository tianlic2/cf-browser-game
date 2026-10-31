import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';

const url = process.env.CF_TEST_URL ||
  'http://127.0.0.1:8060/?debug=squad-tactics-1&debugMap=transport&debugAutoStart=1';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failed = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__tactical?.ready?.() &&
    window.__tactical.mapState().id === 'transport' &&
    window.__tactical.enemyAI().length >= 5, null, { timeout: 120000 });
  await page.waitForSelector('#bootScreen', { state: 'detached', timeout: 30000 });
  await page.waitForTimeout(1800);

  const samples = [];
  for (let i = 0; i < 5; i++) {
    samples.push(await page.evaluate(() => window.__tactical.enemyAI()));
    await page.waitForTimeout(500);
  }
  const first = samples[0];
  assert.ok(new Set(first.map(e => e.tacticalRole)).size >= 5,
    'a live team contains entry, two flanks, support and anchor roles');
  assert.ok(new Set(first.map(e => e.routeLane)).size >= Math.min(6, first.length),
    'live soldiers receive distinct travel lanes');
  assert.ok(samples.some(sample => sample.filter(e => e.routeGoal || e.combatGoal).length >= 3),
    'multiple live soldiers hold individual route or combat reservations');

  const plannedGoals = samples.flatMap(sample => sample.map(e => e.combatGoal || e.routeGoal).filter(Boolean));
  const rounded = new Set(plannedGoals.map(p => `${p.x.toFixed(1)},${p.z.toFixed(1)}`));
  assert.ok(rounded.size >= 3, 'the team does not collapse onto a single tactical waypoint');
  assert.equal(await page.evaluate(() => window.__tactical.loopErrors()), 0,
    'the live update loop remains error-free');
  assert.deepEqual(errors, [], 'browser runtime has no script or console errors');
  assert.deepEqual(failed, [], 'all required runtime assets load successfully');
  console.log(`PASS: ${first.length} live enemies use ${new Set(first.map(e => e.tacticalRole)).size} roles and ${rounded.size} sampled tactical positions.`);
} finally {
  await browser.close();
}

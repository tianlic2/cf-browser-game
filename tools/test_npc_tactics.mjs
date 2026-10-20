import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The game uses an import map rather than package.json's type=module.
const source = await readFile(new URL('../scripts/npc_tactics.js', import.meta.url), 'utf8');
const { makeAwareness, updateAwareness, awarenessGoal, chooseCover } =
  await import(`data:text/javascript,${encodeURIComponent(source)}`);

const bot = makeAwareness(10, 0, 0, .5);
updateAwareness(bot, .1, { x: 2, y: 0, z: 3 }, null);
assert.equal(bot.mode, 'engage');
assert.ok(bot.reaction > 0);
updateAwareness(bot, .5, null, null);
assert.equal(bot.mode, 'search');
assert.deepEqual([bot.x,bot.z], [2,3], 'losing sight must freeze the last known position');
assert.notDeepEqual(awarenessGoal(bot), { x: 2, y: 0, z: 3 },
  'search should check around the last contact');
updateAwareness(bot, 5, null, null);
assert.equal(bot.mode, 'patrol');
updateAwareness(bot, .1, null, { x: -4, y: 0, z: 7 });
assert.equal(bot.mode, 'investigate');
assert.deepEqual([bot.x,bot.z],[-4,7]);

const wall = { x: 0, z: 0, hx: 1, hz: 2, y0: 0, h: 2 };
assert.deepEqual(chooseCover([wall], { x: 3, y: 0, z: 0 },
  { x: -5, y: 0, z: 0 }, () => true), { x: 1.72, y: 0, z: 0 });
assert.equal(chooseCover([wall], { x: 3, y: 0, z: 0 },
  { x: -5, y: 0, z: 0 }, () => false), null);

const searcher = makeAwareness(0, 0, 0, .37);
updateAwareness(searcher, .1, { x: 6, y: 0, z: 4 }, null);
updateAwareness(searcher, .2, null, null);
const firstSearch = awarenessGoal(searcher, { x: 0, y: 0, z: 0 });
updateAwareness(searcher, 1.4, null, null);
assert.deepEqual(awarenessGoal(searcher, { x: 0, y: 0, z: 0 }), firstSearch,
  'search waypoint remains committed instead of changing on a timer');
const arrived = awarenessGoal(searcher, firstSearch);
assert.deepEqual(arrived, firstSearch, 'arriving at a search point starts a stable observation hold');
updateAwareness(searcher, .2, null, null);
assert.deepEqual(awarenessGoal(searcher, firstSearch), firstSearch,
  'the observation hold does not choose a new heading every frame');
updateAwareness(searcher, 1, null, null);
assert.notDeepEqual(awarenessGoal(searcher, firstSearch), firstSearch,
  'a new waypoint is selected after the observation hold finishes');
console.log('NPC memory, investigation, patrol and cover selection: OK');

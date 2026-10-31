import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'preview/zone13_round.js'), 'utf8');
const { createZone13Round } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const plan = JSON.parse(fs.readFileSync(path.join(root, 'assets/local/cf_bio_candidates/zone13/graybox/zone13-gameplay-plan.json'), 'utf8'));

const round = createZone13Round(plan, { random: () => 0 });
assert.deepEqual(round.snapshot(), { phase: 'preparation', remaining: 20, humans: 12, zombies: 0, mothers: 0, winner: null, event: '等待感染开始' });
round.update(19.5);
assert.equal(round.snapshot().phase, 'preparation');
round.update(1);
assert.equal(round.snapshot().phase, 'running');
assert.equal(round.snapshot().mothers, 2, 'six or more players require two mother zombies');
assert.equal(round.snapshot().humans, 10);
assert.equal(round.snapshot().zombies, 2);
assert.equal(round.snapshot().remaining, 179.5, 'overflow from preparation must carry into the round');
for (let index = 0; index < 10; index += 1) assert.equal(round.infectHuman(), true);
assert.equal(round.snapshot().phase, 'ended');
assert.equal(round.snapshot().winner, 'zombie');
assert.equal(round.infectHuman(), false);

round.reset();
round.startInfection();
round.update(180);
assert.equal(round.snapshot().winner, 'human');
assert.equal(round.snapshot().remaining, 0);

const smallRound = createZone13Round(plan, { playerCount: 5, random: () => .5 });
smallRound.startInfection();
assert.equal(smallRound.snapshot().mothers, 1);
assert.equal(smallRound.snapshot().humans, 4);
const protectedRound = createZone13Round(plan, { protectedPlayerId: 1, random: () => .999999 });
protectedRound.startInfection();
assert.equal(protectedRound.state.players.find((player) => player.id === 1).team, 'human', 'the preview-controlled player must begin as a human');
console.log('zone13 round ok: 20s preparation, population-scaled mothers, 180s survival and both win paths');

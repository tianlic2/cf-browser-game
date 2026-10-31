import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'preview/zone13-graybox.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'preview/zone13-graybox.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'preview/zone13-graybox.css'), 'utf8');

assert.match(source, /playerMeleeDuration = action\?\.duration \|\| \(kind === 'heavy' \? \.764706 : \.722222\)/);
assert.match(source, /playerMeleeCd = kind === 'heavy' \? 1\.48 : 1\.25/);
assert.match(source, /distance < acquireRange/);
assert.match(source, /distance < impactRange/);
assert.match(source, /playerMeleeDuration - playerMeleeImpactAt/);
assert.match(source, /playZombieMelee\(\{ kind, hit: !!target, backstab: playerMeleeBackstab \}\)/);
assert.match(source, /event\.button === 2 \? 'heavy' : 'light'/);
assert.match(source, /heavy' \? 1\.96 : 1\.82/);
assert.match(source, /heavy' \? 1\.72 : 1\.58/);
assert.match(source, /target\.headingX/);
assert.match(source, /contextmenu/);
assert.match(source, /pak\/sound\/\$\{name\}/);
assert.match(source, /roundSystem\.infectHuman\(target\.id\)/);
assert.match(source, /facing > \.38/);
assert.match(html, /id="zombie-swipe"/);
assert.match(css, /@keyframes zombie-swipe-fade/);
console.log('zone13 player melee ok: native light/heavy/backstab clips, facing/range gates, impact recheck, cooldown, pack voice and swipe feedback');

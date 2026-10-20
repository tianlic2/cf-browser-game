// Run with: node --experimental-default-type=module tools/test_bio_zombie_viewmodel.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const helperStart = main.indexOf('function bioZombieWeaponViewSuppressed()');
const animateStart = main.indexOf('function animateWeapon(dt)');
const renderStart = main.indexOf('const bioZombieView = bioZombieWeaponViewSuppressed()', animateStart);

assert.ok(helperStart >= 0 && animateStart > helperStart,
  'bio zombie viewmodel suppression is centralized before weapon animation');
const helpers = main.slice(helperStart, animateStart);
assert.match(helpers,
  /state === 'playing' && bioMatch\(\) && !!bioMode\?\.playerZombie/,
  'all bio zombie frames suppress human weapons, including respawn delay');
assert.match(helpers,
  /\[classicView, m4cView, ironbeastView, barrettView,[\s\S]*?axeView, kukriView, deagleFestaView\]/,
  'every standalone firearm and melee source view is included');
assert.match(helpers, /Object\.values\(owned\)[\s\S]*?entry\.group\.visible = false/,
  'fallback weapon groups are hidden');
assert.match(helpers, /viewArms\.root\.visible = false/,
  'fallback player arms are hidden');
assert.match(helpers, /Object\.values\(classicNades\)/,
  'grenade source views are hidden');
assert.match(helpers, /Object\.values\(authoredViews \|\| \{\}\)/,
  'future authored weapon views are hidden through the shared registry');
assert.match(helpers, /muzzleT = Infinity;[\s\S]*?updateMuzzleFlash\(0\)/,
  'a shot from the infection frame cannot leave a floating muzzle flash');

const animatePrefix = main.slice(animateStart, main.indexOf('// 一律读', animateStart));
assert.match(animatePrefix,
  /if \(bioZombieWeaponViewSuppressed\(\)\) \{[\s\S]*?hideHumanWeaponViewmodelsForBioZombie\(\);[\s\S]*?return;/,
  'weapon animation exits before it can re-enable a gun root');
assert.ok(renderStart > animateStart, 'render pass rechecks zombie visibility while paused');
const renderBlock = main.slice(renderStart, main.indexOf('// 显式清屏', renderStart));
assert.match(renderBlock, /const mutantView = bioZombieView && !bioMode\.playerOut;/,
  'claws are visible only while the zombie player is active');
assert.match(renderBlock, /if \(bioZombieView\)[\s\S]*?hideHumanWeaponViewmodelsForBioZombie\(\)/,
  'human weapons remain hidden throughout zombie respawn and paused frames');

console.log('PASS: bio zombies render claws exclusively and never retain a human weapon viewmodel.');

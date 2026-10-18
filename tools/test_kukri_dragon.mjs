import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p));
const text=p=>read(p).toString('utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
const data=JSON.parse(text('assets/classic/kukri_dragon/view.json'));

assert.equal(data.source,'Source v44 Kukri complete first-person rig');
assert.equal(data.bones.length,45,'complete source skeleton');
assert.deepEqual(Object.fromEntries(Object.entries(data.clips).map(([k,v])=>[k,v.count])),{
  idle_0:21,select:77,stab:163,stab_miss:163,midslash1:75,midslash2:75,
});
assert.equal(data.parts.length,6,'four weapon/VFX parts plus two hand parts');
assert.equal(data.parts.filter(p=>p.additive&&p.effect).length,2,'source w4/0 additive VFX remain independent');
assert.ok(data.parts.filter(p=>p.additive&&p.effect).every(p=>p.linearAdditive),
  'only Kukri opts its two additive cards into direct colour sampling');
assert.equal(data.forwardAxis,'x','Source viewmodel camera faces authored +X');
assert.deepEqual(data.transform,[0,-.01,0,0,0,0,.01,0,-.01,0,0,0,0,0,0,1],
  'keep the authored Source camera origin instead of recentering bind-pose meshes');
const blade=data.parts.find(p=>p.textureName==='PV-KUKRI_BEAST');
assert.equal(blade?.unlit,true,'source gold/red albedo must not be recoloured by the level sky IBL');
assert.ok(blade?.reflectionMap,'source $envmapmask is retained as its own reflection pass');
assert.equal(blade.reflectionOpacity,.22,'source reflection remains subordinate to its colour sheet');
assert.ok(data.parts.find(p=>p.textureName==='Arms')?.normalMap,'source arm normal map is wired');
assert.ok(statSync(path.join(root,'assets/classic/kukri_dragon/view.bin')).size>1_000_000);
const glb=read('assets/classic/kukri_dragon/world.glb');
assert.equal(glb.subarray(0,4).toString(),'glTF');
assert.equal(glb.readUInt32LE(8),glb.length,'world GLB is complete');

const sounds=['deploy','slash1','slash2','stab','hit1','hit2','hit3','hit4','hitwall'];
const originals=['knife_deploy1','knife_slash1','knife_slash2','knife_stab','knife_hit1','knife_hit2','knife_hit3','knife_hit4','knife_hitwall1'];
for(let i=0;i<sounds.length;i++){
  assert.equal(hash(read(`audio/classic/kukri_dragon/${sounds[i]}.wav`)),
    hash(read(`尼伯尔/sound/weapons/knife/${originals[i]}.WAV`)),`${sounds[i]} remains byte-identical`);
}

const main=text('scripts/main.js'), audio=text('scripts/audio.js'), skins=text('scripts/skins.js');
assert.match(main,/meleeSkin: "dragon"[^\n]+\n\s*\{ primary: "m4", skin: "ironbeastgold", secondary: "deagle", meleeSkin: "dragon"/);
assert.match(main,/ClassicView\.load\('kukri_dragon'\)/);
assert.match(main,/KUKRI_CLIP_BY_ATTACK = Object\.freeze\(\{ light: "midslash1", thrust: "midslash2", heavy: "stab" \}\)/);
assert.match(main,/kind==="heavy"\?"stab_miss":null/,'heavy misses use the authored miss sequence');
assert.match(main,/enemyHits\.size>0&&meleeSkin==="dragon"&&action\.kind==="heavy"\)action\.sourceClip="stab"/,
  'any confirmed heavy enemy hit switches to the authored hit sequence');
assert.match(main,/heavyStabAt: heavy\.hitStart/,
  'the second heavy sound follows the scaled rightward strike window');
assert.match(main,/dragonHeavy\?"windup":"swing"/,'heavy press starts the windup sound stage');
assert.match(main,/sfx\.melee\(a\.kind,meleeSkin,"strike"\)/,'rightward heavy strike starts its second sound stage');
assert.match(main,/vtKukri\$\{field\.key\[0\]\.toUpperCase\(\)\}\$\{field\.key\.slice\(1\)\}Speed/,
  'light and heavy speed values persist in the tuner URL');
assert.match(main,/viewmodelTunerQuery\.has\(queryKey\)/,
  'a missing URL parameter cannot be coerced to zero and clamp the default speed');
assert.match(main,/data-preview="light"/,'the tuner exposes a light-attack preview');
assert.match(main,/data-preview="heavy"/,'the tuner exposes a heavy-attack preview');
assert.match(main,/const hitDuration = \(source\.hitEnd - source\.hitStart\) \/ speed[\s\S]*heavy \? Math\.min\(kukriTimingLive\.heavyHitAt, interval - hitDuration\)[\s\S]*hitEnd: hitStart \+ hitDuration/,
  'the heavy hit node is independently adjustable while preserving the scaled hit-window duration');
assert.match(main,/KUKRI_ACTION_SOUND_AT\/kukriSpeedFor\(kind\)/,
  'the first sound node follows the selected attack speed');
assert.match(main,/!a\.previewOnly&&!a\.damageResolved/,'preview attacks cannot damage enemies or props');
assert.match(main,/activeSkinId\('knife'\)==='dragon'/);
assert.match(main,/kukri: Object\.freeze\(\{ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, scale: 1\.13 \}\)/);
assert.match(main,/KUKRI_ATTACK_SPEED_DEFAULTS = Object\.freeze\(\{ light: \.87, heavy: \.36 \}\)/,
  'the user-confirmed light and heavy speeds are the clean-game defaults');
assert.match(main,/KUKRI_TIMING_FIELDS = Object\.freeze\(\[[\s\S]*?key: "heavyHitAt", label: "重击伤害判定", min: \.2, max: 1\.3, step: \.01/,
  'the preview exposes a fine-grained heavy damage timing control');
assert.match(main,/KUKRI_TIMING_DEFAULTS = Object\.freeze\(\{ heavyHitAt: \.67 \}\)/,
  'the user-confirmed 0.670s heavy strike is the clean-game default');
assert.match(main,/vtKukri\$\{field\.key\[0\]\.toUpperCase\(\)\}\$\{field\.key\.slice\(1\)\}/,
  'the chosen heavy hit time persists in the preview URL');
assert.match(main,/KUKRI_SPEED_FIELDS = Object\.freeze\(\[[\s\S]*?key: "light"[\s\S]*?min: \.4, max: 2[\s\S]*?key: "heavy"[\s\S]*?min: \.1, max: 2/,
  'the preview tuner permits the Kukri heavy attack to be slowed as far as 0.10x without changing the light range');
assert.match(main,/KUKRI_COMBAT_FIELDS = Object\.freeze\(\[[\s\S]*?key: "range"[\s\S]*?key: "lightDmg"[\s\S]*?key: "lightHead"[\s\S]*?key: "lightBack"[\s\S]*?key: "lightAngle"[\s\S]*?key: "heavyDmg"[\s\S]*?key: "heavyHead"[\s\S]*?key: "heavyBack"[\s\S]*?key: "heavyAngle"/,
  'the tuner exposes reach, sweep width and every damage branch used by Kukri combat');
assert.match(main,/const KUKRI_COMBAT_DEFAULTS = Object\.freeze\(\{[\s\S]*?range: 1\.45,[\s\S]*?lightDmg: 60, lightHead: 100, lightBack: 60,[\s\S]*?lightAngle: 30,[\s\S]*?heavyDmg: 130, heavyHead: 180, heavyBack: 180,[\s\S]*?heavyAngle: 105/,
  'the Kukri tuner starts from the user-confirmed combat values');
assert.match(main,/vtKukri\$\{field\.key\[0\]\.toUpperCase\(\)\}\$\{field\.key\.slice\(1\)\}/,
  'combat tuning values persist in the preview URL');
assert.match(main,/dmg: kukriCombatLive\[heavy \? "heavyDmg" : "lightDmg"\][\s\S]*?head: kukriCombatLive[\s\S]*?backstab: kukriCombatLive[\s\S]*?arc: THREE\.MathUtils\.degToRad/,
  'live damage and sweep controls feed the actual melee mode');
assert.match(main,/raycaster\.far=meleeSkin==="dragon"\?kukriCombatLive\.range:KNIFE\.range/,
  'each melee skin keeps its own real hit reach rather than only the diagram');
assert.match(main,/drawKukriHitPreview\(hitPreview\)/,
  'the tuner redraws an exact top-down sector preview');
assert.match(main,/kukriCombatStats:\(\)=>\(\{ \.\.\.kukriCombatLive,[\s\S]*?light:scaledKukriMode\("light"\)[\s\S]*?heavy:scaledKukriMode\("heavy"\)/,
  'the final live melee mode remains inspectable during browser QA');
assert.match(main,/KUKRI_TARGET_DEFAULTS = Object\.freeze\(\[[\s\S]*?distance: 1\.65, angle: -30[\s\S]*?distance: 1\.35, angle: 18[\s\S]*?distance: 1\.8, angle: 35/,
  'three independently positioned training targets have stable defaults');
assert.match(main,/vtKukriTarget\$\{index \+ 1\}/,
  'all training-target positions persist in the preview URL');
assert.match(main,/pointerdown[\s\S]*?pointermove[\s\S]*?kukriTargetCanvasPoint/,
  'target markers can be dragged directly in the top-down preview');
assert.match(main,/function ensureKukriTrainingTargets\(\)[\s\S]*?scene\.add\(group\); kukriTrainingTargets\.push\(group\)/,
  'the tuner creates visible world-space target dummies');
assert.match(main,/function previewKukriTargetHits\(kind, mode\)[\s\S]*?\.\.\.kukriTrainingTargetMeshes, \.\.\.obstacleFlat[\s\S]*?raycaster\.far = kukriCombatLive\.range/,
  'preview hits use the live melee reach and respect nearer world walls');
assert.match(main,/a\.previewOnly&&!a\.previewTargetChecked&&a\.t>=mode\.hitStart[\s\S]*?previewKukriTargetHits\(a\.kind,mode\)/,
  'preview buttons evaluate targets at the real attack hit window');
const accumulateStart=main.indexOf('function accumulateMeleeRayHits(');
const accumulateEnd=main.indexOf('function resolveMeleeSweep(',accumulateStart);
assert.ok(accumulateStart>=0&&accumulateEnd>accumulateStart,'shared multi-target melee collector exists');
const meleeContext={};
vm.createContext(meleeContext);
vm.runInContext(`${main.slice(accumulateStart,accumulateEnd)};this.accumulateMeleeRayHits=accumulateMeleeRayHits;`,meleeContext);
const enemyA={dead:false},enemyB={dead:false},enemyBehindWall={dead:false};
const bodyA={object:{userData:{enemy:enemyA,part:'body'}},distance:.5};
const headA={object:{userData:{enemy:enemyA,part:'head'}},distance:.55};
const bodyB={object:{userData:{enemy:enemyB,part:'body'}},distance:.9};
const wall={object:{userData:{}},distance:1.1};
const blocked={object:{userData:{enemy:enemyBehindWall,part:'body'}},distance:1.2};
const collected=new Map(),direction={ray:'sample'};
assert.equal(meleeContext.accumulateMeleeRayHits([bodyA,headA,bodyB,wall,blocked],collected,direction),wall,
  'the first wall is returned as the stopping surface');
assert.equal(collected.size,2,'all distinct enemies before the wall are collected, including aligned enemies');
assert.equal(collected.get(enemyA).hit,headA,'one enemy is stored once and a sampled head contact takes precedence');
assert.equal(collected.get(enemyB).hit,bodyB,'the second aligned enemy is not treated as a bullet blocker');
assert.equal(collected.has(enemyBehindWall),false,'a solid wall still blocks enemies behind it');
const sweepBlock=main.slice(main.indexOf('function resolveMeleeSweep('),main.indexOf('function resolveKnifeHit('));
assert.match(sweepBlock,/const enemyHits=new Map\(\)/,'a swing deduplicates enemies across every sampled ray');
assert.match(sweepBlock,/const steps=64/,'the complete sweep sector is sampled densely');
assert.match(sweepBlock,/for\(const \{hit,direction\} of enemyHits\.values\(\)\)resolveKnifeHit/,
  'every enemy collected in the sector receives one damage resolution');
assert.match(sweepBlock,/if\(enemyHits\.size===0&&wallImpact\)resolveKnifeHit/,
  'wall feedback is emitted only when the swing hit no enemy');
assert.match(main,/resolveMeleeSweep\(a,mode,meleeSkin\)/,
  'both the Phoenix Axe and Kukri use the shared multi-target sweep');
const resolveKnifeHit=main.slice(main.indexOf('function resolveKnifeHit('),main.indexOf('// 炫金雷神源 MDL'));
assert.match(resolveKnifeHit,/silentEnemyImpact=meleeSkin==="dragon"/,
  'Kukri enemy contact is explicitly silent without changing other melee skins');
assert.match(resolveKnifeHit,/if\(head&&!silentEnemyImpact\)sfx\.headshot\(\)/,
  'Kukri head hits do not play the generic headshot contact cue');
assert.match(resolveKnifeHit,/if\(!head&&!silentEnemyImpact\)sfx\.hit\(\)/,
  'Kukri body hits do not play the generic hit-confirmation cue');
assert.match(resolveKnifeHit,/if\(!silentEnemyImpact\)sfx\.impact\(h\.point,"knife_flesh",meleeSkin\)/,
  'Kukri does not play its source flesh-impact samples');
assert.match(resolveKnifeHit,/sfx\.impact\(h\.point,"knife_wall",activeSkinId\("knife"\)\)/,
  'Kukri wall impact remains connected');
assert.match(skins,/id: "dragon", name: "屠龙", displayName: "屠龙"/);
assert.match(text('scripts/classic_view.js'),/p\.linearAdditive\?THREE\.NoColorSpace:THREE\.SRGBColorSpace/,
  'only opted-in Source additive cards bypass sRGB darkening');
assert.match(text('scripts/classic_view.js'),/else if\(p\.unlit\)/,'source-colour viewmodel path exists');
assert.match(text('scripts/classic_view.js'),/maps\.reflectionMap/,'Source $envmapmask gets an independent overlay');
for(const id of ['kukri_dragon_deploy','kukri_dragon_slash1','kukri_dragon_slash2','kukri_dragon_stab','kukri_dragon_hit','kukri_dragon_hitwall'])assert.ok(audio.includes(id));
assert.match(audio,/heavy && stage === "windup"[\s\S]*\? "kukri_dragon_slash2"/,
  'heavy windup uses the requested source knife_slash2 WAV');
assert.match(audio,/heavy \? "kukri_dragon_stab"/,
  'the second heavy stage uses the requested source knife_stab WAV');
assert.match(audio,/rateJitter: meleeSkin === "dragon" \? 0 : 0\.05/);
console.log('PASS: 凤凰斧与屠龙会对挥击范围内墙前的所有敌人各结算一次，屠龙仍保留源动作/墙面声并静音敌人接触声。');

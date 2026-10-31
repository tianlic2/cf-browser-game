import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const [html,js]=await Promise.all([read('preview/unity-skin-motion.html'),read('preview/unity-skin-motion.js')]);
assert.match(html,/真实模型 \+ 当前动作/);assert.match(html,/仅预览，不接入游戏/);assert.match(html,/不是同骨架原生动作/);
assert.match(js,/const TARGET='\.\.\/Unity\/unity\.Fbx'/);assert.match(js,/HumanM@AssaultRifle_Aim01\.fbx/);assert.match(js,/HumanM@AssaultRifle_Reload01\.fbx/);
assert.match(js,/HumanM@Walk01_Left\.fbx/);assert.match(js,/HumanM@Walk01_Right\.fbx/);assert.match(js,/HumanM@Run01_Forward\.fbx/);
assert.match(js,/\['B-hand\.R','CC_Base_R_Hand'\]/);assert.match(js,/\['B-upperArm\.L','CC_Base_L_Upperarm'\]/);
assert.match(js,/replace\(\/\[\^a-z0-9\]\/g,''\)/,'FBX-sanitized .L/.R names are normalized before mapping');
assert.match(js,/setFromUnitVectors\(currentDirection,sourceDirection\)/,
  'major arm and leg segments follow authored source directions despite different local bone axes');
assert.match(js,/multiply\(pair\.sourceBindInv\)\.multiply\(pair\.targetBind\)/,
  'unmapped segment endpoints keep a world-space bind correction');
assert.match(js,/sourceRifle\.getWorldQuaternion\(tempQ1\)/,
  'rifle keeps the authored world direction instead of inheriting incompatible CC3 wrist axes');
assert.match(js,/setFromAxisAngle\(new THREE\.Vector3\(0,1,0\),Math\.PI\)/,
  'preview corrects the source rifle asset whose visible muzzle axis is reversed');
assert.match(js,/getWorldQuaternion\(tempQ1\)\.premultiply\(RIFLE_DIRECTION_FLIP\)/,
  'the direction correction is applied in world space without changing the retargeted arms');
assert.match(js,/sourceRifle\.getWorldPosition\(tempV3\)\.sub\(sourceGrip\).*\.add\(targetGrip\)/,
  'rifle grip position still follows the retargeted right hand');
assert.match(js,/formalGameChanged:false/);assert.doesNotMatch(js,/scripts\/main\.js|HumanSoldierRig\(/);
console.log('PASS: isolated CC3 skin motion lab uses current rifle clips, explicit bone retargeting and a hand-following rifle without changing the formal game.');

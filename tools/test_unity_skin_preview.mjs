import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const [html,css,js,sourceInfo,jsonInfo]=await Promise.all([
  read('preview/unity-skin.html'),read('preview/unity-skin.css'),read('preview/unity-skin.js'),
  stat(new URL('Unity/unity.Fbx',root)),stat(new URL('Unity/unity.json',root)),
]);

assert.ok(sourceInfo.size>190_000_000,'the preview keeps the complete supplied source FBX');
assert.ok(jsonInfo.size>100_000,'the Character Creator material manifest remains present');
assert.match(html,/源模型 \/ 源姿势 \/ 源贴图/);
assert.match(html,/未接入正式游戏/);
assert.match(html,/没有把现有 Human Soldier 动作强行套到不同骨架上/);
assert.match(html,/明确标为眉毛而不是头发/);
assert.match(js,/const sourceUrl='\.\.\/Unity\/unity\.Fbx'/);
assert.match(js,/new FBXLoader\(manager\)/);
assert.match(js,/CC_Base_Body\|CC_Game_Eye/);
assert.match(js,/Bra\|Underwear_Bottoms\|Female_Angled/);
assert.match(js,/material\.visible=true/,
  'CC exports that mark optional clothes or hair materials hidden are exposed in the isolated appearance review');
assert.match(js,/material\.alphaMap=null;material\.opacity=1;material\.transparent=true/,
  'CC brows and lashes use the embedded diffuse alpha instead of treating their dark green channel as opacity');
assert.match(js,/material\.opacity=1;material\.transparent=false;material\.alphaTest=0/,
  'opaque source clothing is not lost to an imported transparency flag');
assert.match(js,/new THREE\.SkeletonHelper\(actor\)/);
assert.match(js,/window\.__unitySkinPreview=/);
assert.doesNotMatch(js,/HumanM@|HumanSoldierRig|movementWithHold|WeaponHold/,
  'the appearance preview must not pretend that the current NPC animation rig is compatible');
assert.match(css,/\.loading\.hidden/);

console.log('PASS: the isolated page previews the supplied CC3+ FBX and source materials without wiring it into the game or faking animation compatibility.');

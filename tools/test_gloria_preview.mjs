import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root));
const [htmlBytes,jsBytes,glb]=await Promise.all([read('preview/gloria-model.html'),read('preview/gloria-model.js'),read('gloria/source/dgloria.glb')]);
const html=htmlBytes.toString('utf8'),js=jsBytes.toString('utf8');
assert.match(html,/Gloria · 原始模型准入预览/);assert.match(html,/静态外貌候选 \/ 不能直接动画/);assert.match(html,/JOINTS_0/);assert.match(html,/WEIGHTS_0/);
assert.match(js,/new GLTFLoader\(\)/);assert.match(js,/gloria\/source\/dgloria\.glb/);assert.match(js,/formalGameChanged:false/);assert.doesNotMatch(js,/scripts\/main\.js|HumanSoldierRig\(/);
assert.equal(glb.toString('ascii',0,4),'glTF');const jsonLength=glb.readUInt32LE(12);const json=JSON.parse(glb.toString('utf8',20,20+jsonLength).replace(/\u0000+$/,''));
assert.equal(json.skins?.length||0,0,'Gloria source has no skeleton skin');assert.equal(json.animations?.length||0,0,'Gloria source has no animation clips');
const attributes=json.meshes?.flatMap(mesh=>mesh.primitives||[]).map(primitive=>Object.keys(primitive.attributes||{}))||[];
assert.ok(attributes.length>0);assert.ok(attributes.every(list=>!list.includes('JOINTS_0')&&!list.includes('WEIGHTS_0')),'Gloria source has no vertex skin weights');
console.log('PASS: Gloria is shown from its real static GLB in an isolated preview and cannot be mistaken for a rigged game-ready character.');

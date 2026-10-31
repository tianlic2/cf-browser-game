import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root));
const text=async p=>(await read(p)).toString();
const specs={
  m200:{candidate:'cheytac-m200',bones:88,clips:['idle_0','select','fire','reload'],
    reload:[8,38,110,175],select:1,worldTriangles:8885},
  akgold:{candidate:'ak47-imperial-gold',bones:59,
    clips:['idle_0','select','shoot1','shoot2','shoot3','reload'],
    // Excludes spare magazines and other geometry used only during reload.
    reload:[9,19,25],select:0,worldTriangles:4180},
};

for(const [id,spec] of Object.entries(specs)){
  const base=`assets/local/${id}/`,candidate=`assets/preview/gamebanana-weapons/${spec.candidate}/`;
  const data=JSON.parse(await text(base+'view.json'));
  const provenance=JSON.parse(await text(base+'provenance.json'));
  assert.equal(data.bones.length,spec.bones);
  assert.equal(data.uvConvention,'classic-smd-v');
  for(const clip of spec.clips)assert.ok(data.clips[clip]?.count>0,`${id} ${clip}`);
  assert.deepEqual(data.events.reload.map(e=>e.frame),spec.reload);
  assert.equal(data.events.select[0].frame,spec.select);
  for(const [file,hash] of Object.entries(provenance.files)){
    assert.deepEqual(await read(base+file),await read(candidate+file),`${id} ${file} changed after review`);
    assert.equal(hash.length,64);
  }
  assert.equal(provenance.publicRedistributionApproved,false);
  assert.equal(provenance.userApprovedAt,'2026-10-24');
  assert.match(provenance.license,/CC BY-NC-ND/);
  assert.ok(execFileSync('git',['check-ignore',base+'view.json'],{encoding:'utf8'}).trim());
  const glb=await read(base+'world.glb');
  assert.equal(glb.toString('ascii',0,4),'glTF');
  const doc=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
  assert.equal(doc.skins,undefined,'world model must contain no first-person arm rig');
  const triangles=doc.meshes[0].primitives.reduce((n,p)=>n+doc.accessors[p.attributes.POSITION].count/3,0);
  assert.equal(triangles,spec.worldTriangles);
  assert.ok((await stat(new URL(base+'world.glb',root))).size>1000);
}

const admitted=await text('scripts/admitted_gamebanana.js');
assert.match(admitted,/m200:[\s\S]*?reloadDuration: 2\.19/);
assert.match(admitted,/akgold:[\s\S]*?reloadDuration: 34 \/ 13/);
const main=await text('scripts/main.js'),audio=await text('scripts/audio.js'),catalog=await text('scripts/guncatalog.js');
assert.match(main,/loadAdmittedGameBananaView\(id\)/);
assert.match(main,/primary: "m200"/);assert.match(main,/primary: "akgold"/);
assert.match(main,/\^Digit\[1-8\]\$/);
assert.match(catalog,/WORLD_GUN_IDS = \[[^\]]*"m200", "akgold", "kn57"\]/);
assert.match(catalog,/ENEMY_GUN_IDS = \["ak", "m4", "barrett"\]/,
  'new local weapons stay out of NPC random loadouts');

const sandbox=vm.createContext({addEventListener(){}});
vm.runInContext(audio.replace('export class SFX','class SFX')+'\nglobalThis.SFX=SFX;',sandbox);
const sfx=Object.create(sandbox.SFX.prototype),played=[];
sfx.ready=()=>true;sfx._playMapped=(method,options)=>played.push({method,...options});
sfx._sample=(id,options)=>{played.push({id,...options});return {};};sfx._note=()=>{};
sfx.shoot('sniper','m200','stock');assert.equal(played[0].sample,'m200_fire');assert.equal(played[0].wet,0);
played.length=0;sfx.bolt('m200');assert.equal(played[0].id,'m200_blowback');assert.equal(played[0].delay,.41);
played.length=0;sfx.reload({id:'m200',dur:2.19});
assert.deepEqual(played.map(p=>p.id),['m200_clipout','m200_reload','m200_clipin','m200_reload_tail']);
assert.deepEqual(played.map(p=>p.delay),[.08,.38,1.1,1.75]);
played.length=0;sfx.deploy('sniper',{weaponId:'m200'});assert.equal(played[0].id,'m200_select');assert.equal(played[0].delay,.01);
played.length=0;sfx.shoot('rifle','akgold','stock');assert.equal(played[0].sample,'akgold_fire');assert.equal(played[0].wet,0);
played.length=0;sfx.reload({id:'akgold',dur:34/13});
assert.deepEqual(played.map(p=>p.id),['akgold_gas','akgold_clipin','akgold_reload']);
for(const [i,frame] of [9,19,25].entries())assert.ok(Math.abs(played[i].delay-frame/13)<1e-12);
played.length=0;sfx.deploy('rifle',{weaponId:'akgold'});assert.equal(played[0].id,'akgold_select');assert.equal(played[0].delay,0);

console.log('PASS: M200 and Imperial Gold use the reviewed byte-identical rigs, native clips/event audio, arm-free world models, backpacks 6/7, and remain local-only and outside NPC loadouts.');

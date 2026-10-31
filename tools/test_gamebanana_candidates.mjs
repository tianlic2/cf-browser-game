import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base=new URL('../assets/preview/gamebanana-weapons/',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,base),'utf8'));
const catalog=await read('catalog.json');
assert.equal(catalog.entries.length,11);assert.equal(catalog.scope,'local-isolated-preview-only');
assert.equal(catalog.assetVersion,'native-uv-3');
// Independent UV oracle: read original MDL triangle commands in texel space.
// Compare unordered UV triples so the importer's normal/winding correction
// cannot make a wrong V convention accidentally pass this check.
function nativeUVs(mdl){
 const groups=new Map(),nt=mdl.readInt32LE(180),to=mdl.readInt32LE(184),textures=[];
 const string=at=>mdl.subarray(at,at+64).toString().split('\0')[0];
 for(let i=0;i<nt;i++)textures.push({w:mdl.readInt32LE(to+i*80+68),h:mdl.readInt32LE(to+i*80+72)});
 const skins=mdl.readInt32LE(200),count=mdl.readInt32LE(204),parts=mdl.readInt32LE(208);
 for(let i=0;i<count;i++){
  const part=parts+i*76,name=string(part),model=mdl.readInt32LE(part+72);
  const meshes=mdl.readInt32LE(model+72),meshAt=mdl.readInt32LE(model+76);
  for(let m=0;m<meshes;m++){
   const mesh=meshAt+m*20,tex=mdl.readUInt16LE(skins+mdl.readInt32LE(mesh+8)*2),size=textures[tex],key=`${tex}/${name}`;
   if(!groups.has(key))groups.set(key,[]);const faces=groups.get(key);let at=mdl.readInt32LE(mesh+4);
   while(true){
    const n=mdl.readInt16LE(at);at+=2;if(!n)break;const records=[];
    for(let j=0;j<Math.abs(n);j++){records.push([mdl.readInt16LE(at+4)/size.w,mdl.readInt16LE(at+6)/size.h]);at+=8;}
    for(let j=2;j<records.length;j++)faces.push(n<0?[records[0],records[j-1],records[j]]:[records[j-2],records[j-1],records[j]]);
   }
  }
 }
 return groups;
}
// Float32 serialization can move a native rational UV by one unit at 1e-6.
// A 1e-5 oracle remains far tighter than a texel while avoiding false failures.
const uvKey=pair=>pair.map(v=>Math.round(v*1e5)).join(',');
const report=[];
for(const entry of catalog.entries){
 const d=await read(`${entry.id}/view.json`),b=await readFile(new URL(`${entry.id}/view.bin`,base));
 assert.ok(Object.values(entry.checks).every(Boolean));assert.deepEqual(d.candidate.missingSounds,[]);
 assert.ok(d.bones.filter(b=>/finger/i.test(b.name)).length>=30);
 assert.ok(d.parts.some(p=>p.bodypart.toLowerCase()==='hands'));assert.ok(d.parts.some(p=>p.weapon));
 const floats=new Float32Array(b.buffer,b.byteOffset,b.length/4);
 assert.ok(floats.every(Number.isFinite));
 assert.equal(d.uvConvention,'classic-smd-v');
 const sourceUV=nativeUVs(await readFile(d.candidate.sourceFile));let checkedTriangles=0;
 for(const part of d.parts){
  const texture=Number(part.map.match(/^tex(\d+)\.png$/)[1]),faces=sourceUV.get(`${texture}/${part.bodypart}`);
  assert.equal(faces.length,part.count/3);
  for(let f=0;f<faces.length;f++){
   const actual=[];
   for(let j=0;j<3;j++){const i=part.offset/4+(f*3+j)*16;actual.push(uvKey([floats[i+6],1-floats[i+7]]));}
   assert.deepEqual(actual.sort(),faces[f].map(uvKey).sort(),`${entry.id}: final GPU UV must match native MDL texel coordinates`);
   checkedTriangles++;
  }
 }
 const weightedFingers=new Set();
 for(const part of d.parts.filter(p=>p.bodypart.toLowerCase()==='hands'))for(let i=0;i<part.count;i++){
  const joint=floats[part.offset/4+i*16+8];
  if(/finger/i.test(d.bones[joint].name))weightedFingers.add(joint);
 }
 assert.ok(weightedFingers.size>=28,'both hands must actually weight vertices to the native finger joints');
 for(const name of ['idle_0','select','fire','reload']){
  const c=d.clips[name];assert.ok(c?.count>5);assert.ok(c.offset+c.count*d.bones.length*28<=b.length);
  assert.ok(c.times.every((v,i)=>i===0||v>c.times[i-1]));
  let delta=0;
  for(let f=1;f<c.count;f++)for(let j=0;j<d.bones.length*7;j++)
   delta=Math.max(delta,Math.abs(floats[c.offset/4+f*d.bones.length*7+j]-floats[c.offset/4+j]));
  assert.ok(delta>.001,`${entry.id} ${name} must contain real changing poses`);
 }
 for(const clip of d.candidate.nativeClips){
  const c=d.clips[clip.key];assert.equal(c.count,clip.frames,'retain every native animation frame');
  assert.ok(Math.abs(c.times.at(-1)-(clip.frames-1)/clip.fps)<.0001);
  for(const raw of clip.events.filter(e=>e.id===5004)){
   const e=d.events[clip.key].find(e=>e.frame===raw.frame&&e.option===raw.option);
   assert.ok(e);assert.ok(Math.abs(e.time-raw.frame/clip.fps)<.0001,'native sound frame must not move');
  }
 }
 const audio=[...new Set([...Object.values(d.events).flatMap(v=>v.map(e=>e.audio)),...d.fireSounds])];
 for(const file of audio){
  assert.ok(file);const wav=await readFile(new URL(`${entry.id}/${file}`,base));
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.ok(wav.length>44);
 }
 for(const p of d.parts)assert.ok((await stat(new URL(`${entry.id}/${p.map}`,base))).size>100);
 if(entry.kind==='pump-action'||entry.kind==='bolt-action')assert.ok(d.events.fire.length>0,'native mechanical-cycle sound is required');
 if(entry.reloadShells){
  assert.deepEqual(d.candidate.reloadSegments,['reload_0','reload_1','reload_1','reload_1','reload_2']);
  assert.equal(d.clips.reload.count,d.clips.reload_0.count+3*d.clips.reload_1.count+d.clips.reload_2.count);
 }
 const ignored=execFileSync('git',['check-ignore',`assets/preview/gamebanana-weapons/${entry.id}/view.json`],{encoding:'utf8'});
 assert.ok(ignored.trim(),'restricted asset must not be silently published');
 report.push({id:entry.id,bones:d.bones.length,sounds:audio.length,triangles:entry.triangles,nativeUVTriangles:checkedTriangles});
}
const runtime=(await Promise.all(['scripts/main.js','scripts/guncatalog.js','scripts/audio.js','index.html'].map(p=>readFile(new URL('../'+p,import.meta.url),'utf8')))).join('\n');
assert.doesNotMatch(runtime,/gamebanana-weapons|assets\/preview\/gamebanana/,'candidate assets must stay out of startup/gameplay');
console.log(JSON.stringify({passed:report.length,candidates:report},null,2));

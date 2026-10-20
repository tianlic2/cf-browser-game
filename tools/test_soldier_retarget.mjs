import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = p => readFile(new URL('../'+p,import.meta.url),'utf8');
const THREE=await import('data:text/javascript;base64,'+Buffer.from(await read('vendor/three/build/three.module.js')).toString('base64'));
const data=JSON.parse(await read('assets/classic/swat/swat.json'));
const source=await read('scripts/classic_soldier.js');
const method=source.slice(source.lastIndexOf('  _retarget() {'),source.lastIndexOf('}'));
const optimized=new Function('THREE','asset','return class {'+method+'}')(THREE,{data}).prototype._retarget;

// Frozen mathematical reference from the pre-allocation implementation.
function reference() {
  this.root.updateWorldMatrix(true,true);
  const inv=this.root.matrixWorld.clone().invert();
  const iq=this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const pos=n=>n.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const rot=n=>iq.clone().multiply(n.getWorldQuaternion(new THREE.Quaternion()));
  const pelvis=pos(this.pelvis),chest=pos(this.chest),neck=pos(this.neck),targets=new Map();
  const set=(i,p,q)=>targets.set(i,{p,q});
  set(0,pelvis,rot(this.pelvis));set(9,pos(this.spine),rot(this.spine));
  set(10,pos(this.spine).lerp(chest,.45),rot(this.spine));set(11,chest,rot(this.chest));
  set(12,chest.clone().lerp(neck,.78),rot(this.chest));set(13,neck,rot(this.neck));set(14,pos(this.head),rot(this.head));
  const segment=(i,j,a,b)=>{
    const p=pos(a),end=pos(b),from=this.bindPos[j].clone().sub(this.bindPos[i]).normalize();
    set(i,p,new THREE.Quaternion().setFromUnitVectors(from,end.clone().sub(p).normalize()).multiply(this.bindQ[i]));
  };
  for(const [leg,a,b,c] of [[this.legL,1,2,3],[this.legR,5,6,7]]){
    segment(a,b,leg.hip,leg.knee);segment(b,c,leg.knee,leg.ankle);
    set(c,pos(leg.ankle),rot(leg.ankle).multiply(this.bindQ[c]));
  }
  for(const [arm,cl,a,b,c] of [[this.armL,15,16,17,18],[this.armR,28,29,30,31]]){
    set(cl,chest.clone().lerp(neck,.86).lerp(pos(arm.sh),.22),rot(this.chest).multiply(this.bindQ[cl]));
    segment(a,b,arm.sh,arm.el);segment(b,c,arm.el,arm.hd);
    set(c,pos(arm.hd),rot(arm.hd).multiply(this.bindQ[c]));
  }
  this.bones.forEach((bone,i)=>{
    const t=targets.get(i),parent=data.bones[i].parent;
    bone.position.copy(this.rest[i].p);bone.quaternion.copy(this.rest[i].q);
    if(t){
      const pm=parent>=0?this.bones[parent].matrixWorld:new THREE.Matrix4();
      bone.position.copy(t.p).applyMatrix4(pm.clone().invert());
      const pq=new THREE.Quaternion().setFromRotationMatrix(pm).invert(),q=t.q.clone();
      if([0,9,10,11,12,13,14].includes(i))q.multiply(this.bindQ[i]);
      bone.quaternion.copy(pq).multiply(q);
    }
    bone.updateMatrix();bone.matrixWorld.copy(parent>=0?this.bones[parent].matrixWorld:new THREE.Matrix4()).multiply(bone.matrix);
  });
  this.skinRoot.updateMatrixWorld(true);this.skeleton.update();
}
function fixture(){
  const r={root:new THREE.Group(),skinRoot:new THREE.Group()};
  r.root.position.set(4,.3,-9);r.root.rotation.y=.87;r.root.add(r.skinRoot);
  const node=(parent,x,y,z)=>{const n=new THREE.Group();n.position.set(x,y,z);parent.add(n);return n;};
  r.pelvis=node(r.root,0,.95,0);r.spine=node(r.pelvis,0,.06,0);r.chest=node(r.spine,0,.28,0);r.neck=node(r.spine,0,.5,0);r.head=node(r.neck,0,.1,0);
  for(const [key,side] of [['legL',1],['legR',-1]]){
    const hip=node(r.pelvis,side*.1,-.04,0),knee=node(hip,0,-.42,0),ankle=node(knee,0,-.4,0);r[key]={hip,knee,ankle};
  }
  for(const [key,side] of [['armL',1],['armR',-1]]){
    const sh=node(r.chest,side*.185,.205,0),el=node(sh,0,-.32,0),hd=node(el,0,-.29,0);r[key]={sh,el,hd};
  }
  r.bones=data.bones.map(b=>{const n=new THREE.Bone();n.position.fromArray(b.position).multiplyScalar(.0254);n.quaternion.fromArray(b.quaternion);return n;});
  r.bones.forEach((b,i)=>(data.bones[i].parent<0?r.skinRoot:r.bones[data.bones[i].parent]).add(b));
  r.skinRoot.updateMatrixWorld(true);
  r.bindPos=r.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));r.bindQ=r.bones.map(b=>b.getWorldQuaternion(new THREE.Quaternion()));
  r.rest=r.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));r.skeleton=new THREE.Skeleton(r.bones);
  return r;
}
const before=fixture(),after=fixture();let worst=0,scratch;
for(let frame=0;frame<240;frame++){
  for(const r of [before,after]){
    r.root.rotation.y=.87+frame*.02;r.armL.sh.rotation.x=Math.sin(frame*.05)*.6;
    r.legR.hip.rotation.x=Math.sin(frame*.11)*.7;r.chest.rotation.x=Math.sin(frame*.04)*.15;
  }
  reference.call(before);optimized.call(after);
  if(scratch)assert.equal(after._retargetScratch,scratch,'reuse the actor scratch pool');
  scratch=after._retargetScratch;
  for(let i=0;i<data.bones.length;i++)for(let j=0;j<16;j++){
    const delta=Math.abs(before.bones[i].matrixWorld.elements[j]-after.bones[i].matrixWorld.elements[j]);
    assert.ok(Number.isFinite(delta));worst=Math.max(worst,delta);
  }
}
assert.ok(worst<1e-8,`bone matrix error ${worst}`);
console.log(`PASS: 240 moving/turning poses, ${data.bones.length} source bones, max matrix error ${worst}; scratch pool reused.`);

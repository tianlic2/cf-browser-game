import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/build/three.module.js';
import {TRACER_MUZZLE_CALIBRATION,applyTracerLaunchCorrection,tracerMuzzleKey} from '../scripts/tracer_muzzle.js';

const expected={ak:[3.7,2.6],m4:[1.3,.6],ironbeast:[.6,.5],barrett:[4.1,1.4],deagle:[.9,1]};
for(const [key,[yaw,pitch]] of Object.entries(expected)){
  const p=TRACER_MUZZLE_CALIBRATION[key];assert.equal(p.yawDeg,yaw);assert.equal(p.pitchDeg,pitch);
  assert.deepEqual(p.offset,{x:0,y:0,z:0});
  const source=new THREE.Vector3(.013,-.007,-1).normalize();
  const d=applyTracerLaunchCorrection(source,p,new THREE.Vector3());
  const reference=source.clone().applyEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(p.pitchDeg),THREE.MathUtils.degToRad(p.yawDeg),0,'YXZ'));
  assert(Math.abs(d.length()-1)<1e-9);
  assert(d.distanceTo(reference)<1e-12,'calibration rotation must match Three.js YXZ');
}
assert.equal(tracerMuzzleKey('m4','classic'),'m4');
assert.equal(tracerMuzzleKey('m4','ironbeastgold'),'ironbeast');
const main=fs.readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
assert.match(main,/classicView\.muzzle\(_muzzleLocal\);cachePlayerMuzzle\(_muzzleLocal,'ak'\)/);
assert.match(main,/barrettView\.muzzle\(_muzzleLocal\);cachePlayerMuzzle\(_muzzleLocal,'barrett'\)/);
assert.match(main,/playerMuzzleKey===tracerKey/,'stale gun muzzle cache must be rejected');
assert.match(main,/impactVfx\.tracer\(_playerTraceStart,_playerTraceEnd,"player",\{launchDirection:_playerTraceLaunchDir\}\)/);
const impact=fs.readFileSync(new URL('../scripts/impact_vfx.js',import.meta.url),'utf8');
assert.match(impact,/p\.copy\(item\.start\).*addScaledVector\(item\.end,t\*t\)/s);
assert.match(impact,/item\.pathLengths\[i\]=total/);
console.log('tracer muzzle runtime checks passed');

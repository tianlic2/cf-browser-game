import * as THREE from 'three';
import { merge, textTexture } from './geom';
import { heightAt, terrainRenderedHeightAt, WORLD } from './heightfield';
import { stoneMaterial, woodMaterial } from './materials';
import { RIDGE_HALF_WIDTH, RIDGE_LOOKOUTS, RIDGE_SURFACE_LIFT, RIDGE_TRAILS,
  ridgeGuardSections, ridgeRouteFrames } from '../../../scripts/lingyin_hillside_route.js';

const Y = WORLD.platform.y;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x,y,z);

function railBeam(a: THREE.Vector3,b: THREE.Vector3,width=.16,height=.14) {
  const d=b.clone().sub(a);
  const g=new THREE.BoxGeometry(width,height,d.length());
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(v3(0,0,1),d.clone().normalize()));
  g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
  return g;
}

/** One batched stone path, timber rails and a small defensive overlook. */
export class HillsideTrail {
  readonly group=new THREE.Group();

  constructor() {
    this.group.name='hillside-pilgrimage-trail';
    const stone=stoneMaterial(.3),timber=woodMaterial(true);
    const pathPositions: number[]=[];
    const pathUvs: number[]=[];
    const pathIndices: number[]=[];
    const guard: THREE.BufferGeometry[]=[];
    const curbs: THREE.BufferGeometry[]=[];
    const roadY=(x:number,z:number)=>
      Math.max(heightAt(x,z)+RIDGE_SURFACE_LIFT,terrainRenderedHeightAt(x,z)+.055);
    for(const route of RIDGE_TRAILS) {
      const frames=ridgeRouteFrames(route);
      const base=pathPositions.length/3;
      for(const [j,frame] of frames.entries()) {
        for(const side of [-1,0,1]) {
          const x=frame.x+frame.nx*RIDGE_HALF_WIDTH*side;
          const z=frame.z+frame.nz*RIDGE_HALF_WIDTH*side;
          pathPositions.push(x,roadY(x,z),z);
          pathUvs.push(frame.along/2.2,(side+1)*1.1);
        }
        if(j<frames.length-1) {
          const k=base+j*3;
          pathIndices.push(k,k+1,k+3,k+1,k+4,k+3,
            k+1,k+2,k+4,k+2,k+5,k+4);
        }
      }
    }

    // Shared guard sections stop only where another walkable branch or a
    // lookout really meets the path; corners remain continuous.
    for(let routeIndex=0;routeIndex<RIDGE_TRAILS.length;routeIndex++) {
      for(const section of ridgeGuardSections(routeIndex)) {
        let lastPost=-Infinity;
        for(const [i,p] of section.points.entries()) {
          const here=v3(p.x,Y+p.y,p.z);
          if(i===0||i===section.points.length-1||p.along-lastPost>=2.25) {
            const post=new THREE.BoxGeometry(.2,1.76,.2);
            post.translate(here.x,here.y+.7,here.z);
            guard.push(post);
            const foot=new THREE.BoxGeometry(.36,.28,.36);
            foot.translate(here.x,here.y-.05,here.z);
            curbs.push(foot);
            lastPost=p.along;
          }
          if(i>0) {
            const prev=section.points[i-1];
            const before=v3(prev.x,Y+prev.y,prev.z);
            curbs.push(railBeam(before.clone().add(v3(0,-.055,0)),
              here.clone().add(v3(0,-.055,0)),.31,.18));
            for(const beamY of [1.03,1.45])
              guard.push(railBeam(before.clone().add(v3(0,beamY,0)),
                here.clone().add(v3(0,beamY,0))));
          }
        }
      }
    }

    const path=new THREE.BufferGeometry();
    path.setAttribute('position',new THREE.Float32BufferAttribute(pathPositions,3));
    path.setAttribute('uv',new THREE.Float32BufferAttribute(pathUvs,2));
    path.setIndex(pathIndices);
    path.computeVertexNormals();
    const paving=new THREE.Mesh(path,stone);
    paving.name='graded-mountain-stone-path';
    paving.receiveShadow=true;
    this.group.add(paving);

    // Two rests offer different decisions: the lower terrace has a broad
    // courtyard sightline; the upper ridge reveals the roofs and skyline.
    for(const [index,p] of RIDGE_LOOKOUTS.entries()) {
      const deckY=Y+p.y;
      const platform=new THREE.Mesh(new THREE.BoxGeometry(p.hx*2,.18,p.hz*2),stone);
      platform.position.set(p.x,deckY-.09,p.z);
      platform.castShadow=true;
      platform.receiveShadow=true;
      platform.name=`temple-overlook-terrace-${index+1}`;
      this.group.add(platform);
      const parapet: THREE.BufferGeometry[]=[];
      const openRail: THREE.BufferGeometry[]=[];
      const block=(x:number,z:number,w:number,d:number) => {
        // A knee-high stone sill and open timber rail keep the whole temple
        // visible from standing height. A full-height stone wall hid the view.
        const g=new THREE.BoxGeometry(w,.72,d);
        g.translate(x,deckY+.36,z);
        parapet.push(g);
        const cap=new THREE.BoxGeometry(w+.04,.12,d+.04);
        cap.translate(x,deckY+1.02,z);
        openRail.push(cap);
        const horizontal=w>d;
        const length=horizontal?w:d;
        const count=Math.max(1,Math.round(length/2.4));
        for(let i=0;i<=count;i++) {
          const offset=(i/count-.5)*length;
          const post=new THREE.BoxGeometry(.18,.36,.18);
          post.translate(x+(horizontal?offset:0),deckY+.9,z+(horizontal?0:offset));
          openRail.push(post);
        }
      };
      block(p.x-p.hx,p.z,.34,p.hz*2);
      block(p.x+p.hx,p.z,.34,p.hz*2);
      block(p.x,p.z-p.hz,p.hx*2,.34);
      const north=p.z+p.hz,left=p.x-p.hx,right=p.x+p.hx;
      const gap0=Math.max(left,p.entryX-1.5),gap1=Math.min(right,p.entryX+1.5);
      if(gap0-left>.2)block((left+gap0)/2,north,gap0-left,.34);
      if(right-gap1>.2)block((gap1+right)/2,north,right-gap1,.34);
      const edge=new THREE.Mesh(merge(parapet),stone);
      edge.castShadow=true;
      edge.receiveShadow=true;
      edge.name=`overlook-stone-parapet-${index+1}`;
      this.group.add(edge);
      const railing=new THREE.Mesh(merge(openRail),timber);
      railing.castShadow=true;
      railing.name=`overlook-open-rail-${index+1}`;
      this.group.add(railing);
    }

    for(const [name,geos,material] of [
      ['mountain-guardrail',guard,timber],
      ['mountain-post-foundations',curbs,stone],
    ] as const) {
      const m=new THREE.Mesh(merge(geos),material);
      m.name=name;
      m.castShadow=true;
      m.receiveShadow=true;
      this.group.add(m);
    }

    // The trail starts behind a real opening in the northern terrace rail;
    // one small sign makes the route discoverable without adding HUD clutter.
    const signPost=new THREE.Mesh(new THREE.BoxGeometry(.16,2.25,.16),timber);
    signPost.position.set(3.35,heightAt(3.35,47)+1.125,47);
    signPost.castShadow=true;
    this.group.add(signPost);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.65,.5),
      new THREE.MeshStandardMaterial({map:textTexture('登山道',512,160,
        {bg:'#302923',fg:'#d4b674',border:'#8f7755'}),side:THREE.DoubleSide,
        roughness:.9}));
    sign.rotation.y=Math.PI;
    sign.position.set(3.35,heightAt(3.35,47)+2.02,46.9);
    this.group.add(sign);
  }
}

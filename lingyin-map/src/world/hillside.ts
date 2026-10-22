import * as THREE from 'three';
import { merge } from './geom';
import { heightAt, terrainRenderedHeightAt, WORLD } from './heightfield';
import { roofMaterial, stoneMaterial, woodMaterial } from './materials';
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

/** One batched stone path, timber rails and a mountaintop pavilion overlook. */
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
          const y=roadY(x,z);
          pathPositions.push(x,y,z);
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
      const splitVertical=(x:number,entryZ:number) => {
        const south=p.z-p.hz,north=p.z+p.hz;
        const gap0=Math.max(south,entryZ-1.5),gap1=Math.min(north,entryZ+1.5);
        if(gap0-south>.2)block(x,(south+gap0)/2,.34,gap0-south);
        if(north-gap1>.2)block(x,(gap1+north)/2,.34,north-gap1);
      };
      const splitHorizontal=(z:number,entryX:number) => {
        const left=p.x-p.hx,right=p.x+p.hx;
        const gap0=Math.max(left,entryX-1.5),gap1=Math.min(right,entryX+1.5);
        if(gap0-left>.2)block((left+gap0)/2,z,gap0-left,.34);
        if(right-gap1>.2)block((gap1+right)/2,z,right-gap1,.34);
      };
      if(p.entrySide==='west')splitVertical(p.x-p.hx,p.entryZ);
      else block(p.x-p.hx,p.z,.34,p.hz*2);
      if(p.entrySide==='east')splitVertical(p.x+p.hx,p.entryZ);
      else block(p.x+p.hx,p.z,.34,p.hz*2);
      if(p.entrySide==='south')splitHorizontal(p.z-p.hz,p.entryX);
      else block(p.x,p.z-p.hz,p.hx*2,.34);
      if(p.entrySide==='north')splitHorizontal(p.z+p.hz,p.entryX);
      else block(p.x,p.z+p.hz,p.hx*2,.34);
      const edge=new THREE.Mesh(merge(parapet),stone);
      edge.castShadow=true;
      edge.receiveShadow=true;
      edge.name=`overlook-stone-parapet-${index+1}`;
      this.group.add(edge);
      const railing=new THREE.Mesh(merge(openRail),timber);
      railing.castShadow=true;
      railing.name=`overlook-open-rail-${index+1}`;
      this.group.add(railing);

      // An open octagonal pavilion gives the ascent a destination without
      // sacrificing the panoramic firing/view lanes through the platform.
      const pavilionZ=p.z-.45;
      const pavilionStone: THREE.BufferGeometry[]=[];
      const pavilionTimber: THREE.BufferGeometry[]=[];
      const postRadius=2.9,postCount=8;
      const dais=new THREE.CylinderGeometry(3.35,3.55,.24,8);
      dais.translate(p.x,deckY+.12,pavilionZ);
      pavilionStone.push(dais);
      const topPoints: THREE.Vector3[]=[];
      for(let i=0;i<postCount;i++) {
        const angle=i/postCount*Math.PI*2+Math.PI/8;
        const x=p.x+Math.cos(angle)*postRadius;
        const z=pavilionZ+Math.sin(angle)*postRadius;
        const base=new THREE.CylinderGeometry(.29,.34,.24,12);
        base.translate(x,deckY+.34,z);
        pavilionStone.push(base);
        const column=new THREE.CylinderGeometry(.17,.2,3.05,12);
        column.translate(x,deckY+1.98,z);
        pavilionTimber.push(column);
        topPoints.push(v3(x,deckY+3.48,z));
      }
      for(let i=0;i<postCount;i++)
        pavilionTimber.push(railBeam(topPoints[i],topPoints[(i+1)%postCount],.24,.28));
      const ceiling=new THREE.CircleGeometry(3.48,8);
      ceiling.rotateZ(Math.PI/8);
      ceiling.rotateX(Math.PI/2);
      ceiling.translate(p.x,deckY+3.55,pavilionZ);
      pavilionTimber.push(ceiling);
      const hub=v3(p.x,deckY+3.49,pavilionZ);
      for(const point of topPoints)
        pavilionTimber.push(railBeam(hub,point,.11,.12));
      const stoneMesh=new THREE.Mesh(merge(pavilionStone),stone);
      stoneMesh.name=`ridge-pavilion-stone-${index+1}`;
      stoneMesh.castShadow=true;
      stoneMesh.receiveShadow=true;
      this.group.add(stoneMesh);
      const timberMesh=new THREE.Mesh(merge(pavilionTimber),timber);
      timberMesh.name=`ridge-pavilion-timber-${index+1}`;
      timberMesh.castShadow=true;
      timberMesh.receiveShadow=true;
      this.group.add(timberMesh);
      const pavilionRoof=roofMaterial();
      const roof=new THREE.Mesh(new THREE.ConeGeometry(3.95,1.35,8,2),pavilionRoof);
      roof.position.set(p.x,deckY+4.15,pavilionZ);
      roof.rotation.y=Math.PI/8;
      roof.name=`ridge-pavilion-roof-${index+1}`;
      roof.castShadow=true;
      roof.receiveShadow=true;
      this.group.add(roof);
      const finial=new THREE.Mesh(new THREE.CylinderGeometry(.08,.13,.75,10),timber);
      finial.position.set(p.x,deckY+5.15,pavilionZ);
      finial.name=`ridge-pavilion-finial-${index+1}`;
      finial.castShadow=true;
      this.group.add(finial);
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

  }
}

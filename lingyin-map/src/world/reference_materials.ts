import * as THREE from 'three';
import { courtyardPavingMaterial, woodMaterial } from './materials';

let deck: THREE.MeshStandardMaterial | null = null;
let water: THREE.MeshStandardMaterial | null = null;
let waterfall: THREE.MeshBasicMaterial | null = null;
let terraceStone:THREE.MeshStandardMaterial|null=null;

/** Reuse the already loaded slab scans; no per-stone mesh or new download. */
export function pavilionTerraceMaterial() {
  if(terraceStone)return terraceStone;
  terraceStone=courtyardPavingMaterial().clone();
  terraceStone.name='pavilion-warm-weathered-stone-slabs';
  terraceStone.color.set(0xe6dcc9);
  terraceStone.roughness=.94;
  terraceStone.normalScale.set(.35,.35);
  return terraceStone;
}

/** Photographed wood grain, with plank joints baked into one shared map. */
export function boardwalkDeckMaterial() {
  if (deck) return deck;
  const source = woodMaterial(true);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#695541'; ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 4; row++) {
    if (source.map?.image) ctx.drawImage(source.map.image as CanvasImageSource, 0, row * 128, 512, 128);
    ctx.fillStyle = row % 2 ? 'rgba(179,137,80,.14)' : 'rgba(215,182,127,.09)';
    ctx.fillRect(0, row * 128, 512, 128);
    ctx.fillStyle = '#302a20'; ctx.fillRect(0, row * 128, 512, 3);
    ctx.fillStyle = 'rgba(227,204,159,.4)'; ctx.fillRect(0, row * 128 + 4, 512, 2);
    for (const x of [12, 499]) {
      ctx.fillStyle = '#3c3429';
      ctx.beginPath();ctx.arc(x,row*128+16,2.2,0,Math.PI*2);ctx.fill();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.name = 'lingyin-weathered-deck-planks'; map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 16;
  deck = new THREE.MeshStandardMaterial({
    name: 'lingyin-reference-wooden-deck', map, bumpMap: map,
    bumpScale: .024, roughness: .88, metalness: 0,
  });
  source.dispose();
  return deck;
}

/** Small reusable ripple map, without reflections or extra render passes. */
export function referenceStreamMaterial() {
  if (water) return water;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, pixels = ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    const u=x/256*Math.PI*2,v=y/256*Math.PI*2;
    const dx=Math.cos(u*4+Math.sin(v*2))*.22+Math.cos(u*9-v*3)*.08;
    const dy=Math.cos(v*6+Math.sin(u*3))*.18-Math.cos(u*9-v*3)*.06;
    const k=(y*256+x)*4, inv=1/Math.hypot(dx,dy,1);
    pixels.data[k]=(dx*inv*.5+.5)*255;
    pixels.data[k+1]=(dy*inv*.5+.5)*255;
    pixels.data[k+2]=(inv*.5+.5)*255; pixels.data[k+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const normal=new THREE.CanvasTexture(canvas);
  normal.name='lingyin-fine-stream-ripples';
  normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(2,7);
  water=new THREE.MeshStandardMaterial({name:'lingyin-reference-jade-stream',
    color:0x397c78,normalMap:normal,normalScale:new THREE.Vector2(.33,.33),
    roughness:.26,metalness:.12,transparent:true,opacity:.83,
    depthWrite:false,side:THREE.DoubleSide});
  return water;
}

export function referenceWaterfallMaterial() {
  if(waterfall)return waterfall;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    const u=x/255,v=y/256;
    const edge=Math.min(1,u*9,(1-u)*9);
    const streak=.62+.18*Math.sin(u*180+Math.sin(v*Math.PI*6)*.7)
      +.12*Math.sin(u*59-v*Math.PI*8);
    const k=(y*256+x)*4;
    pixels.data[k]=209;pixels.data[k+1]=230;pixels.data[k+2]=230;
    pixels.data[k+3]=Math.max(0,edge*streak)*230;
  }
  ctx.putImageData(pixels,0,0);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapT=THREE.RepeatWrapping;
  waterfall=new THREE.MeshBasicMaterial({name:'lingyin-waterfall-white-streams',map,
    transparent:true,depthWrite:false,side:THREE.DoubleSide});
  return waterfall;
}

export function updateReferenceWater(time:number) {
  if(water?.normalMap)water.normalMap.offset.y=-time*.018;
  if(waterfall?.map)waterfall.map.offset.y=time*.24;
}

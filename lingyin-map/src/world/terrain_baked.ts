import * as THREE from 'three';
import { clamp, fbm2, hash2, lerp, smoothstep } from '../core/math';
import { WORLD } from './heightfield';

export function terrainColor(x: number, y: number, z: number, slope: number,
  path: number, water: number, ao: number): [number, number, number] {
  // Evaluate broad biome variation once per vertex. A tiled texture supplies
  // close-up grain without the former multi-octave fragment shader.
  const n1 = clamp((fbm2(x * .045, z * .045) + 1) * .5, 0, 1);
  const n2 = clamp((fbm2(x * .22 + 7.3, z * .22 + 7.3) + 1) * .5, 0, 1);
  const c: [number, number, number] = [
    lerp(.055, .135, n1 * .7 + n2 * .3),
    lerp(.082, .17, n1 * .7 + n2 * .3),
    lerp(.032, .062, n1 * .7 + n2 * .3),
  ];
  const blend = (target: [number, number, number], amount: number) => {
    for (let k=0;k<3;k++) c[k] = lerp(c[k], target[k], clamp(amount, 0, 1));
  };
  blend([.12 + n2 * .08, .09 + n2 * .07, .06 + n2 * .05], smoothstep(.42,.82,n1) * .34);
  blend([.26 + n1 * .16, .255 + n1 * .15, .225 + n1 * .12], smoothstep(.13,.56,slope));
  blend([.078,.095,.057], (1-smoothstep(0,2.2,water))*.72);
  const court = Math.abs(x+3)<30 && Math.abs(z)<44 && Math.abs(y-WORLD.platform.y)<.55;
  const stone = .32 + hash2(Math.floor(x/1.35),Math.floor(z/.78))*.14;
  blend([stone,stone*.99,stone*.91],
    Math.max(court?1:0,1-smoothstep(.15,.55,path))*(1-smoothstep(.5,.9,slope)));
  const forest = smoothstep(.43,.73,(fbm2(x*.011+3.2,z*.011+3.2)+1)*.5);
  const shade = (1-forest*.21)*lerp(.62,1,ao);
  for(let k=0;k<3;k++) c[k] *= shade;
  return c;
}

let detail: THREE.CanvasTexture | null = null;
let normalDetail: THREE.CanvasTexture | null = null;
let scannedGround: THREE.Texture | null = null;
let scannedGroundNormal: THREE.Texture | null = null;
let scannedGroundLoading: Promise<void> | null = null;

// The playable map waits for these two photographs before constructing its
// terrain. The standalone art preview can still use the generated fallback.
export function preloadTerrainTextures() {
  if (scannedGroundLoading) return scannedGroundLoading;
  const loader = new THREE.TextureLoader();
  const load = async (name: string, srgb: boolean) => {
    const url = new URL(`./assets/lingyin/temple-textures/${name}.jpg`, document.baseURI).href + '?v=1';
    const texture = await loader.loadAsync(url);
    texture.name = `lingyin-${name}`;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / 2.8, 1 / 2.8);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    return texture;
  };
  scannedGroundLoading = Promise.all([
    load('forest-ground-albedo', true),
    load('forest-ground-normal', false),
  ]).then(([albedo, normal]) => {
    scannedGround = albedo;
    scannedGroundNormal = normal;
  });
  return scannedGroundLoading;
}

export function terrainBakedMaterial(): THREE.MeshStandardMaterial {
  if (scannedGround && scannedGroundNormal) {
    return new THREE.MeshStandardMaterial({
      name: 'terrain-scanned-forest-floor',
      map: scannedGround,
      normalMap: scannedGroundNormal,
      normalScale: new THREE.Vector2(.29, .29),
      // Preserve the broad vertex-painted biomes while compensating for the
      // photographed albedo's lower average value than the former white grain.
      color: new THREE.Color().setRGB(1.38, 1.38, 1.38),
      vertexColors: true,
      roughness: .97,
      metalness: 0,
    });
  }
  if (!detail) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(512,512);
    const heights = new Float32Array(512*512);
    for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
      const broad = fbm2(x*.035,y*.035,3);
      const grain = hash2(x,y)-.5;
      const v = clamp(.91+broad*.075+grain*.065,.77,1);
      heights[y*512+x]=v;
      const i=(y*512+x)*4;
      image.data[i]=Math.round(v*255);
      image.data[i+1]=Math.round(v*253);
      image.data[i+2]=Math.round(v*247);
      image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    detail = new THREE.CanvasTexture(canvas);
    detail.name='terrain-baked-grain';
    detail.colorSpace=THREE.SRGBColorSpace;
    detail.wrapS=detail.wrapT=THREE.RepeatWrapping;
    detail.repeat.set(1/3,1/3);
    detail.minFilter=THREE.LinearMipmapLinearFilter;
    detail.magFilter=THREE.LinearFilter;
    detail.anisotropy=8;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = 512;
    const normalCtx = normalCanvas.getContext('2d')!;
    const normalImage = normalCtx.createImageData(512,512);
    const height = (x: number, y: number) => heights[((y+512)&511)*512+((x+512)&511)];
    for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
      const dx = (height(x+1,y)-height(x-1,y))*1.9;
      const dy = (height(x,y+1)-height(x,y-1))*1.9;
      const inv = 1/Math.hypot(dx,dy,1);
      const i=(y*512+x)*4;
      normalImage.data[i]=Math.round((-.5*dx*inv+.5)*255);
      normalImage.data[i+1]=Math.round((-.5*dy*inv+.5)*255);
      normalImage.data[i+2]=Math.round((.5*inv+.5)*255);
      normalImage.data[i+3]=255;
    }
    normalCtx.putImageData(normalImage,0,0);
    normalDetail = new THREE.CanvasTexture(normalCanvas);
    normalDetail.name='terrain-baked-normal';
    normalDetail.wrapS=normalDetail.wrapT=THREE.RepeatWrapping;
    normalDetail.repeat.copy(detail.repeat);
    normalDetail.minFilter=THREE.LinearMipmapLinearFilter;
    normalDetail.magFilter=THREE.LinearFilter;
    normalDetail.anisotropy=8;
  }
  return new THREE.MeshStandardMaterial({
    name:'terrain-baked-pbr',map:detail,normalMap:normalDetail,
    normalScale:new THREE.Vector2(.7,.7),vertexColors:true,roughness:.91,metalness:0,
  });
}

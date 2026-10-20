import * as THREE from 'three';
import { procMaterial } from '../core/materials';

let floorMaterial: THREE.MeshStandardMaterial | null = null;
let plasterTexture: THREE.CanvasTexture | null = null;
let paperTexture: THREE.CanvasTexture | null = null;
let roofTexture: THREE.CanvasTexture | null = null;

type TempleTextureName =
  | 'courtyard-albedo' | 'courtyard-normal' | 'courtyard-roughness'
  | 'roof-albedo' | 'roof-normal'
  | 'plaster-albedo' | 'plaster-normal' | 'plaster-roughness'
  | 'stone-albedo' | 'stone-normal' | 'stone-roughness'
  | 'wood-albedo' | 'wood-red-albedo' | 'wood-teal-albedo'
  | 'wood-normal' | 'wood-roughness'
  | 'plaque-gate' | 'plaque-main';
let templeTextures: Partial<Record<TempleTextureName, THREE.Texture>> = {};
let templeTexturesLoading: Promise<void> | null = null;

// All maps are reused across the entire temple rather than allocating
// per beam, wall or stair. Loading is awaited by the FPS map builder.
export function preloadTempleTextures() {
  if (templeTexturesLoading) return templeTexturesLoading;
  const names: TempleTextureName[] = [
    'courtyard-albedo', 'courtyard-normal', 'courtyard-roughness',
    'roof-albedo', 'roof-normal',
    'plaster-albedo', 'plaster-normal', 'plaster-roughness',
    'stone-albedo', 'stone-normal', 'stone-roughness',
    'wood-albedo', 'wood-red-albedo', 'wood-teal-albedo',
    'wood-normal', 'wood-roughness',
    'plaque-gate', 'plaque-main',
  ];
  const loader = new THREE.TextureLoader();
  templeTexturesLoading = Promise.all(names.map(async name => {
    const url = new URL(`./assets/lingyin/temple-textures/${name}.webp`, document.baseURI).href
      + '?v=3';
    const texture = await loader.loadAsync(url);
    texture.name = `lingyin-${name}`;
    texture.colorSpace = name.endsWith('albedo') || name.startsWith('plaque-')
      ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = name.startsWith('plaque-')
      ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    templeTextures[name] = texture;
  })).then(() => {});
  return templeTexturesLoading;
}

export function templePlaqueTexture(name: 'gate' | 'main') {
  // The team map preloads these images. The older standalone procedural
  // preview can still draw its original canvas lettering without that preload.
  return templeTextures[`plaque-${name}`];
}

let courtyardMaterial: THREE.MeshStandardMaterial | null = null;
export function courtyardPavingMaterial() {
  if (courtyardMaterial) return courtyardMaterial;
  const albedo = templeTextures['courtyard-albedo'];
  const normal = templeTextures['courtyard-normal'];
  const roughnessMap = templeTextures['courtyard-roughness'];
  if (!albedo || !normal || !roughnessMap)
    throw new Error('Lingyin courtyard maps must be preloaded');
  // The scan contains three large slabs per side. One photograph spans about
  // five metres in the level, giving real-world-sized joints without geometry.
  for (const texture of [albedo, normal, roughnessMap])
    texture.repeat.set(48 / 5.1, 32 / 5.1);
  courtyardMaterial = new THREE.MeshStandardMaterial({
    name: 'courtyard-photogrammetry',
    map: albedo, normalMap: normal, roughnessMap,
    normalScale: new THREE.Vector2(.34, .34),
    roughness: 1, metalness: 0,
  });
  return courtyardMaterial;
}

function texturedTempleMaterial(
  name: string, albedo: TempleTextureName, normal: TempleTextureName,
  roughnessMap: TempleTextureName, roughness: number, normalStrength: number,
) {
  const map = templeTextures[albedo];
  if (!map) return null;
  return new THREE.MeshStandardMaterial({
    name, map, normalMap: templeTextures[normal],
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    roughnessMap: templeTextures[roughnessMap], roughness, metalness: 0,
  });
}

export function ricePaperTexture() {
  if (paperTexture) return paperTexture;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!;
  const image=ctx.createImageData(256,256);
  let seed=0x72696365;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const fiber=Math.sin(x*.36+y*.015)*.012;
    const v=Math.max(.78,Math.min(.96,.88+(rand()-.5)*.065+fiber));
    const at=(y*256+x)*4;
    image.data[at]=Math.round(v*255);
    image.data[at+1]=Math.round(v*248);
    image.data[at+2]=Math.round(v*230);
    image.data[at+3]=255;
  }
  ctx.putImageData(image,0,0);
  paperTexture=new THREE.CanvasTexture(canvas);
  paperTexture.colorSpace=THREE.SRGBColorSpace;
  paperTexture.minFilter=THREE.LinearMipmapLinearFilter;
  paperTexture.magFilter=THREE.LinearFilter;
  paperTexture.anisotropy=8;
  return paperTexture;
}

export function agedPlasterTexture() {
  if (plasterTexture) return plasterTexture;
  const size=512;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d')!;
  const image=ctx.createImageData(size,size);
  let seed=0x2a62b91;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const patches=new Float32Array(32*32);
  for(let i=0;i<patches.length;i++)patches[i]=rand();
  const field=(x:number,y:number)=>{
    const px=x/16,py=y/16,ix=Math.floor(px),iy=Math.floor(py);
    const fx=(px-ix)**2*(3-2*(px-ix)),fy=(py-iy)**2*(3-2*(py-iy));
    const a=(xx:number,yy:number)=>patches[Math.min(31,yy)*32+Math.min(31,xx)];
    return (a(ix,iy)*(1-fx)+a(ix+1,iy)*fx)*(1-fy)+
      (a(ix,iy+1)*(1-fx)+a(ix+1,iy+1)*fx)*fy;
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const n=field(x,y);
    const dust=rand()-.5;
    const v=Math.max(.57,Math.min(.96,.75+n*.15+dust*.07));
    const at=(y*size+x)*4;
    const gray=Math.round(v*255);
    image.data[at]=image.data[at+1]=image.data[at+2]=gray;
    image.data[at+3]=255;
  }
  ctx.putImageData(image,0,0);
  plasterTexture=new THREE.CanvasTexture(canvas);
  plasterTexture.colorSpace=THREE.SRGBColorSpace;
  plasterTexture.wrapS=plasterTexture.wrapT=THREE.RepeatWrapping;
  plasterTexture.minFilter=THREE.LinearMipmapLinearFilter;
  plasterTexture.magFilter=THREE.LinearFilter;
  plasterTexture.anisotropy=8;
  return plasterTexture;
}

// One small, filtered albedo/bump texture for the many courtyard and hall
// slabs. Per-slab vertex tint breaks repetition without extra draw calls.
export function weatheredFloorMaterial() {
  if (floorMaterial) return floorMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(512,512);
  let seed = 0x619ab4;
  const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const coarse = new Float32Array(64*64);
  for(let i=0;i<coarse.length;i++)coarse[i]=rand();
  const broad = new Float32Array(16*16);
  for(let i=0;i<broad.length;i++)broad[i]=rand();
  const sample=(field:Float32Array,size:number,x:number,y:number)=>
    field[Math.min(size-1,y)*size+Math.min(size-1,x)];
  const smooth=(v:number)=>v*v*(3-2*v);
  const noise=(field:Float32Array,size:number,x:number,y:number)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
    return (sample(field,size,ix,iy)*(1-fx)+sample(field,size,ix+1,iy)*fx)*(1-fy)+
      (sample(field,size,ix,iy+1)*(1-fx)+sample(field,size,ix+1,iy+1)*fx)*fy;
  };
  for(let y=0;y<512;y++)for(let x=0;x<512;x++) {
    const gx=x/8,gy=y/8,ix=Math.floor(gx),iy=Math.floor(gy);
    const fx=(gx-ix)**2*(3-2*(gx-ix));
    const fy=(gy-iy)**2*(3-2*(gy-iy));
    const pat=(sample(coarse,64,ix,iy)*(1-fx)+sample(coarse,64,ix+1,iy)*fx)*(1-fy)+
      (sample(coarse,64,ix,iy+1)*(1-fx)+sample(coarse,64,ix+1,iy+1)*fx)*fy;
    const mineral=noise(broad,16,x/32,y/32);
    const grain=rand()-.5;
    const edge=Math.min(x,511-x,y,511-y);
    const joint=(1-Math.min(1,edge/27))*.105;
    const deposit=Math.max(0,mineral-.57)*.13;
    const v=Math.max(.45,Math.min(.86,.63+pat*.13+(mineral-.5)*.085+grain*.048-joint-deposit));
    const at=(y*512+x)*4;
    image.data[at]=Math.round(v*217);
    image.data[at+1]=Math.round(v*212);
    image.data[at+2]=Math.round(v*199);
    image.data[at+3]=255;
  }
  ctx.putImageData(image,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.anisotropy=8;
  floorMaterial=new THREE.MeshStandardMaterial({
    name:'weathered-stone-slabs',map:texture,bumpMap:texture,bumpScale:.048,
    roughness:.94,metalness:0,vertexColors:true,
  });
  return floorMaterial;
}

export function tintFloorSlab(geometry: THREE.BufferGeometry, amount: number) {
  const count=geometry.getAttribute('position').count;
  const color=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const t=amount*(.96+.04*(i%3));
    color[i*3]=t; color[i*3+1]=t*.992; color[i*3+2]=t*.978;
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(color,3));
  return geometry;
}

export function stoneMaterial(warm = 0) {
  const textured = texturedTempleMaterial('stone-photogrammetry',
    'stone-albedo', 'stone-normal', 'stone-roughness', .98, .23);
  if (textured) {
    textured.color.set(warm > .5 ? 0xd6cab8 : 0xffffff);
    return textured;
  }
  return procMaterial({
    name: 'stone',
    params: { color: 0xffffff, roughness: 0.9, metalness: 0.0 },
    uniforms: { uWarm: { value: warm } },
    head: 'uniform float uWarm;',
    color: /* glsl */ `
      float n = cgFbm3(cgP * vec3(.52,.43,.52));
      float fine = cgNoise3(cgP * 5.8);
      float quartz = smoothstep(.73,.9,cgNoise3(cgP * 19.0));
      vec3 base = mix(vec3(.235,.234,.225),vec3(.425,.412,.385),n*.86+fine*.14);
      base = mix(base,base*vec3(1.10,1.04,.93),uWarm*.55);
      base += quartz*.019;
      // Water-darkened joints, fine mineral deposits and moss on top faces.
      float streak = smoothstep(.57,.78,cgNoise2(vec2(cgP.x*.8+cgP.z*.33,cgP.y*.18)));
      base *= 1.0-streak*.22;
      float moss=smoothstep(.57,.76,cgFbm2(cgP.xz*.87+4.0))*smoothstep(.43,.91,cgN.y);
      base=mix(base,vec3(.145,.18,.105),moss*.42);
      base*=.87+.20*smoothstep(.1,.9,cgN.y);
      diffuseColor.rgb = base;
    `,
    normal: /* glsl */ `
      float h0=cgNoise3(cgP*6.0);
      cgBump=vec3(h0-cgNoise3(cgP*6.0+vec3(.13,0,0)),
                  h0-cgNoise3(cgP*6.0+vec3(0,.13,0)),
                  h0-cgNoise3(cgP*6.0+vec3(0,0,.13)))*.25;
    `,
    roughness: /* glsl */ `
      roughnessFactor = .82+.15*cgNoise3(cgP*2.3);
    `,
  });
}

export function roofMaterial() {
  const photographed = templeTextures['roof-albedo'];
  const roofNormal = templeTextures['roof-normal'];
  if (photographed && roofNormal) {
    photographed.repeat.set(1 / 5, 1 / 5);
    roofNormal.repeat.set(1 / 5, 1 / 5);
    return new THREE.MeshStandardMaterial({
      name: 'roof-tile-photogrammetry',
      map: photographed, normalMap: roofNormal,
      normalScale: new THREE.Vector2(.28, .28),
      roughness: .86, metalness: .02, side: THREE.DoubleSide,
    });
  }
  if (!roofTexture) {
    // The roof occupies many screen pixels. Bake its tile relief, age and moss
    // once instead of evaluating several layers of fractal noise per fragment.
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    const hash = (x: number, y: number) => {
      let n = Math.imul(x + 31, 374761393) + Math.imul(y + 17, 668265263);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const tx = x / 64, ty = y / 64;
      const u = tx - Math.floor(tx), v = ty - Math.floor(ty);
      const arch = Math.sqrt(Math.max(0, 1 - (Math.abs(u - .5) * 2) ** 2));
      const joint = Math.max(0, (Math.abs(v - .5) * 2 - .58) / .28);
      const tile = hash(Math.floor(tx), Math.floor(ty));
      const mineral = hash(Math.floor(tx * 3), Math.floor(ty * 3));
      const fleck = hash(x, y) - .5;
      const moss = Math.max(0, hash(Math.floor(tx * .5), Math.floor(ty * .5)) - .58) * (1 - arch);
      const shade = (76 + arch * 29 + tile * 22 + (mineral - .5) * 18 + fleck * 13) * (1 - joint * .27);
      const at = (y * canvas.width + x) * 4;
      pixels.data[at] = Math.max(0, Math.min(255, shade + moss * 2));
      pixels.data[at + 1] = Math.max(0, Math.min(255, shade + 3 + moss * 30));
      pixels.data[at + 2] = Math.max(0, Math.min(255, shade + 5 - moss * 20));
      pixels.data[at + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    roofTexture = new THREE.CanvasTexture(canvas);
    roofTexture.name = 'baked-weathered-roof-tiles';
    roofTexture.colorSpace = THREE.SRGBColorSpace;
    roofTexture.wrapS = roofTexture.wrapT = THREE.RepeatWrapping;
    roofTexture.repeat.set(1 / (12 * .34), 1 / (8 * .52));
    roofTexture.minFilter = THREE.LinearMipmapLinearFilter;
    roofTexture.magFilter = THREE.LinearFilter;
    roofTexture.anisotropy = 8;
  }
  return new THREE.MeshStandardMaterial({
    name: 'roof-tile-baked', map: roofTexture, bumpMap: roofTexture,
    bumpScale: .045, roughness: .82, metalness: .02, side: THREE.DoubleSide,
  });
}

export function wallMaterial() {
  const textured = texturedTempleMaterial('plaster-photogrammetry',
    'plaster-albedo', 'plaster-normal', 'plaster-roughness', .98, .18);
  if (textured) return textured;
  const plaster=agedPlasterTexture();
  return procMaterial({
    name: 'ochre-wall',
    params: { color: 0xffffff, map:plaster, bumpMap:plaster, bumpScale:.05,
      roughness: 0.86, metalness: 0 },
    color: /* glsl */ `
      float n=cgFbm3(cgP*vec3(.56,.45,.56));
      float fine=cgNoise3(cgP*3.9);
      vec3 c=mix(vec3(.43,.38,.30),vec3(.63,.55,.43),n*.77+fine*.23);
      float streak=smoothstep(.57,.78,cgNoise2(vec2(cgP.x*1.9+cgP.z*1.2,cgP.y*.13)));
      c*=1.0-streak*.21;
      float damp=1.0-smoothstep(3.2,4.7,cgO.y);
      c=mix(c,vec3(.31,.29,.25),damp*.30);
      float salt=smoothstep(.62,.77,cgFbm3(cgP*vec3(1.2,.65,1.2)));
      c=mix(c,vec3(.67,.63,.55),salt*.16);
      float pits=smoothstep(.69,.82,cgNoise3(cgP*5.6));
      c*=1.0-pits*.08;
      diffuseColor.rgb = c * mix(.88,1.12,diffuseColor.r);
    `,
    normal: /* glsl */ `
      float grain=cgNoise3(cgP*5.0);
      cgBump=vec3(grain-cgNoise3(cgP*5.0+vec3(.09,0,0)),
                  grain-cgNoise3(cgP*5.0+vec3(0,.09,0)),
                  grain-cgNoise3(cgP*5.0+vec3(0,0,.09)))*.25;
    `,
    roughness: /* glsl */ `roughnessFactor=.84+.13*cgNoise3(cgP*2.0);`,
  });
}

export function woodMaterial(dark = false) {
  const textured = texturedTempleMaterial(dark ? 'aged-wood' : 'red-lacquer-wood',
    dark ? 'wood-albedo' : 'wood-red-albedo',
    'wood-normal', 'wood-roughness', .82, .16);
  if (textured) return textured;
  return procMaterial({
    name: dark ? 'wood-dark' : 'wood-red',
    params: { color: 0xffffff, roughness: 0.52, metalness: 0.0 },
    uniforms: { uDark: { value: dark ? 1 : 0 } },
    head: 'uniform float uDark;',
    color: /* glsl */ `
      float grain=cgFbm2(vec2(cgP.x*2.0+cgP.z*1.4,cgP.y*12.0));
      float wear=cgFbm3(cgP*vec3(.36,.46,.36));
      vec3 red=mix(vec3(.165,.044,.035),vec3(.29,.095,.07),grain*.70+.2);
      vec3 darkw=mix(vec3(.063,.043,.035),vec3(.14,.092,.069),grain);
      vec3 c = mix(red, darkw, uDark);
      c=mix(c,c*vec3(.78,.82,.81),smoothstep(.58,.79,wear)*.39);
      c*=.92+.17*smoothstep(.2,.9,cgN.y);
      float fineGrain=smoothstep(.62,.84,cgNoise2(vec2(cgP.x*.9+cgP.z*.9,cgP.y*17.0)));
      c*=1.0-fineGrain*.10;
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `roughnessFactor = 0.46 + 0.14 * cgNoise2(cgP.xz * 4.0);`,
  });
}

export function goldMaterial() {
  return procMaterial({
    name: 'gold',
    params: { color: 0xffffff, roughness: 0.42, metalness: 0.46,
      emissive: 0x35200a, emissiveIntensity: 0.12 },
    color: /* glsl */ `
      float n = cgFbm2(cgP.xy * 3.0 + cgP.z * 2.0);
      vec3 c = mix(vec3(0.50,0.33,0.10), vec3(0.95,0.72,0.32), n * 0.65 + 0.35);
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `roughnessFactor = 0.30 + 0.18 * cgNoise2(cgP.xz * 5.0);`,
  });
}

// A matte, worn gilding for the scanned clay figure. Its scan has no UVs, so
// triplanar world-space variation supplies subtle aged pigment without seams.
export function buddhaMaterial() {
  return procMaterial({
    name: 'buddha-aged-gilt',
    params: { color: 0xffffff, roughness: 0.72, metalness: 0.16,
      emissive: 0x33210d, emissiveIntensity: 0.12 },
    color: /* glsl */ `
      float large = cgFbm2(cgP.xy * 2.7 + cgP.z * 1.2);
      float grain = cgNoise2(cgP.xz * 18.0 + cgP.y * 9.0);
      float wear = smoothstep(0.34, 0.78, large);
      vec3 clay = vec3(0.34, 0.245, 0.125);
      vec3 gilt = vec3(0.77, 0.595, 0.315);
      vec3 c = mix(clay, gilt, 0.45 + wear * 0.43);
      c *= 0.91 + grain * 0.13;
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `roughnessFactor = 0.62 + 0.18 * cgNoise2(cgP.xz * 7.0 + cgP.y * 2.0);`,
  });
}

export function bronzeMaterial() {
  return procMaterial({
    name: 'bronze',
    params: { color: 0xffffff, roughness: 0.6, metalness: 0.42 },
    color: /* glsl */ `
      float n = cgFbm2(cgP.xy * 4.0 + cgP.z * 3.0);
      vec3 c = mix(vec3(0.16,0.115,0.065), vec3(0.36,0.27,0.14), n);
      float patina = smoothstep(0.58, 0.8, cgFbm2(cgP.xz * 2.2 + 9.0));
      c = mix(c, vec3(0.14,0.22,0.17), patina * 0.55);
      diffuseColor.rgb = c;
    `,
    roughness: /* glsl */ `roughnessFactor = 0.42 + 0.25 * cgNoise2(cgP.xz * 3.0);`,
  });
}

export function dougongMaterial() {
  const textured = texturedTempleMaterial('teal-painted-wood',
    'wood-teal-albedo', 'wood-normal', 'wood-roughness', .9, .12);
  if (textured) return textured;
  return procMaterial({
    name: 'dougong',
    params: { color: 0xffffff, roughness: 0.6, metalness: 0.02 },
    color: /* glsl */ `
      float n = cgNoise2(cgP.xz * 5.0 + cgP.y * 2.0);
      vec3 teal = mix(vec3(0.035,0.095,0.085), vec3(0.09,0.17,0.145), n);
      float gold = smoothstep(0.75, 0.95, cgNoise2(cgP.xz * 9.0));
      vec3 c = mix(teal, vec3(0.55,0.40,0.16), gold * 0.55);
      diffuseColor.rgb = c;
    `,
  });
}

export function windowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a1a0c'),
    emissive: new THREE.Color('#8a4a1e'),
    emissiveIntensity: 0.03,
    roughness: 0.9,
  });
}

export function lanternMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#7e1e18'),
    emissive: new THREE.Color('#ff5a2a'),
    emissiveIntensity: 0.3,
    roughness: 0.7,
  });
}

export function emissiveWindowMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1b1510'),
    emissive: new THREE.Color('#ffb45c'),
    emissiveIntensity: 0.05,
    roughness: 0.9,
  });
}

export function rockMaterial() {
  return procMaterial({
    name: 'limestone-crag',
    params: { color: 0xffffff, roughness: 0.95, metalness: 0.0 },
    color: /* glsl */ `
      float n = cgFbm2(cgP.xz * 0.09 + cgP.y * 0.06);
      float fine = cgNoise2(cgP.xz * 0.9 + cgP.y * 0.35);
      vec3 c = mix(vec3(0.10,0.105,0.10), vec3(0.29,0.285,0.26), n * 0.8 + fine * 0.2);
      // vertical karst flutes / rain streaks
      float flute = cgNoise2(vec2(cgP.x * 0.25 + cgP.z * 0.2, cgP.y * 0.035));
      c *= 0.78 + 0.3 * smoothstep(0.2, 0.8, flute);
      float streak = smoothstep(0.62, 0.9, cgNoise2(vec2(cgP.x * 1.3 + cgP.z * 0.7, cgP.y * 0.06)));
      c *= 1.0 - streak * 0.35;
      // moss and lichen on upward faces and in the damp crevices
      float up = smoothstep(0.25, 0.85, cgN.y);
      float moss = smoothstep(0.45, 0.72, cgFbm2(cgP.xz * 0.55 + cgP.y * 0.2));
      c = mix(c, vec3(0.16,0.21,0.075), moss * (0.35 + up * 0.45));
      c = mix(c, vec3(0.34,0.37,0.26), smoothstep(0.65, 0.85, cgNoise2(cgP.xz * 2.1)) * 0.3);
      diffuseColor.rgb = c;
    `,
    normal: /* glsl */ `
      float e = 0.08;
      float h0 = cgFbm2(cgP.xz * 0.6 + cgP.y * 0.4);
      float hx = cgFbm2((cgP.xz + vec2(e,0.0)) * 0.6 + cgP.y * 0.4);
      float hz = cgFbm2((cgP.xz + vec2(0.0,e)) * 0.6 + cgP.y * 0.4);
      cgBump = vec3(h0-hx, 0.0, h0-hz) * 0.9;
    `,
  });
}

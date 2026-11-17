import * as THREE from 'three';

// Keep the source paint, logos, damage and UV layout. At close range these
// 256 px atlases otherwise magnify as soft blocks, so selected broad surfaces
// receive a higher-resolution colour layer with restrained micrograin.
const HERO_SIZES=new Map([
  ['transportship/texture_95',1024],
  ['transportship/texture_78',1024],
  ['transportship/texture_81',1024],
  ['ship/m_00001',1024],
  ['transportship/texture_83',512],
  ['transportship/texture_93',512],
  ['transportship/texture_94',512],
  ['transportship/texture_73',512],
  ['transportship/texture_234',512],
  ['transportship/texture_80',512],
]);

export function upgradeTransportTexture(source,name) {
  const size=HERO_SIZES.get(name);
  if(!source?.image||!size)return source;
  const sourceWidth=source.image.width,sourceHeight=source.image.height;
  if(!sourceWidth||!sourceHeight)return source;
  const width=sourceWidth>=sourceHeight?size:Math.round(size*sourceWidth/sourceHeight);
  const height=sourceHeight>=sourceWidth?size:Math.round(size*sourceHeight/sourceWidth);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(source.image,0,0,width,height);
  const data=ctx.getImageData(0,0,width,height),input=data.data.slice(),out=data.data;
  let seed=0;
  for(let i=0;i<name.length;i++)seed=Math.imul(seed^name.charCodeAt(i),16777619);
  const hash=(x,y)=>{
    let n=Math.imul(x+seed,374761393)^Math.imul(y+71,668265263);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const canvasFabric=name==='transportship/texture_81'||name==='transportship/texture_83';
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++) {
    const i=(y*width+x)*4;
    const fine=(hash(x,y)-.5)*7.5,coarse=(hash(x>>3,y>>3)-.5)*3;
    const edge=Math.abs(input[i]-input[i-4])+Math.abs(input[i]-input[i+4])+
      Math.abs(input[i]-input[i-width*4])+Math.abs(input[i]-input[i+width*4]);
    // Keep printed labels and the frame at the foot of the tarp clean.
    const cloth=canvasFabric && (name.endsWith('_81') || y<height*.70);
    const weave=cloth ? (((x%4<2)!==(y%4<2))?4:-4) : 0;
    const grain=(fine+coarse+weave)*(1-Math.min(.7,edge/150));
    for(let channel=0;channel<3;channel++) {
      const center=input[i+channel];
      const neighbors=(input[i+channel-4]+input[i+channel+4]+
        input[i+channel-width*4]+input[i+channel+width*4])*.25;
      out[i+channel]=Math.max(0,Math.min(255,
        center+(center-neighbors)*.36+grain));
    }
  }
  ctx.putImageData(data,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.name=`${name}-high-detail`;
  texture.colorSpace=source.colorSpace;
  texture.wrapS=source.wrapS;texture.wrapT=source.wrapT;
  texture.magFilter=source.magFilter;texture.minFilter=source.minFilter;
  texture.generateMipmaps=source.generateMipmaps;
  texture.anisotropy=source.anisotropy;
  texture.repeat.copy(source.repeat);
  return texture;
}

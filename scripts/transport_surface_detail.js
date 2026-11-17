import * as THREE from 'three';

// Seamless grain and roughness for the imported painted surfaces. The
// imported colour textures and baked lightmap still define the ship itself.
export function createTransportSurfaceDetail() {
  const size=256, heights=new Float32Array(size*size);
  const hash=(x,y)=>{
    let n=Math.imul((x+131)*374761393,(y+173)*668265263);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const noise=(x,y,frequency)=>{
    const px=x/size*frequency, py=y/size*frequency;
    const ix=Math.floor(px), iy=Math.floor(py);
    const fx=px-ix, fy=py-iy;
    const sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
    const cell=(cx,cy)=>hash((cx+frequency)%frequency,(cy+frequency)%frequency);
    const a=cell(ix,iy)*(1-sx)+cell(ix+1,iy)*sx;
    const b=cell(ix,iy+1)*(1-sx)+cell(ix+1,iy+1)*sx;
    return a*(1-sy)+b*sy;
  };
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const coarse=noise(x,y,16);
    const grain=hash(x,y);
    heights[y*size+x]=.58*coarse+.28*grain+.14*noise(x,y,64);
  }
  const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=size;return c;};
  const normalCanvas=canvas(), roughCanvas=canvas();
  const nc=normalCanvas.getContext('2d'),rc=roughCanvas.getContext('2d');
  const ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  const at=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(y*size+x)*4;
    const dx=(at(x-1,y)-at(x+1,y))*.32,dy=(at(x,y-1)-at(x,y+1))*.32;
    const len=Math.hypot(dx,dy,1);
    ni.data[i]=Math.round(127.5*(1+dx/len));ni.data[i+1]=Math.round(127.5*(1+dy/len));
    ni.data[i+2]=Math.round(255/len);ni.data[i+3]=255;
    const r=Math.round(176+at(x,y)*68);
    ri.data[i]=ri.data[i+1]=ri.data[i+2]=r;ri.data[i+3]=255;

  }
  nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  const make=canvas=>{
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(3,3);texture.anisotropy=8;
    return texture;
  };
  const gritSize=512,gritCanvas=document.createElement('canvas');
  gritCanvas.width=gritCanvas.height=gritSize;
  const gc=gritCanvas.getContext('2d'),gi=gc.createImageData(gritSize,gritSize);
  for(let y=0;y<gritSize;y++)for(let x=0;x<gritSize;x++) {
    const i=(y*gritSize+x)*4;
    const fine=hash(x,y),fleck=hash(x>>2,y>>2);
    const value=Math.round(126+fine*67+fleck*27);
    gi.data[i]=gi.data[i+1]=gi.data[i+2]=value;gi.data[i+3]=255;
  }
  gc.putImageData(gi,0,0);
  const grit=make(gritCanvas);grit.repeat.set(1,1);
  return {normal:make(normalCanvas),roughness:make(roughCanvas),grit};
}

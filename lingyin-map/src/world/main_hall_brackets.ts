import * as THREE from 'three';
import { box, merge } from './geom';

// Draw one bay in the proportions of a long painted timber. The narrow
// outlines separate mineral pigments; broad fields remain legible in shade.
export function porchBeamPainting(source: THREE.Texture) {
  const canvas=document.createElement('canvas');
  canvas.width=1024; canvas.height=256;
  const c=canvas.getContext('2d')!;
  c.fillStyle='#214c58';c.fillRect(0,0,1024,256);
  c.lineJoin='round';c.lineCap='round';
  function outlined(path:Path2D,fill:string){
    c.fillStyle=fill;c.fill(path);
    c.strokeStyle='#173c47';c.lineWidth=10;c.stroke(path);
    c.strokeStyle='#ccad69';c.lineWidth=3;c.stroke(path);
  }
  for(const y of [0,230]){
    c.fillStyle='#406d65';c.fillRect(0,y,1024,26);
    c.fillStyle='#ac8f58';c.fillRect(0,y+5,1024,3);c.fillRect(0,y+19,1024,2);
  }
  const leaf=new Path2D('M0 0 C14 -28 36 -32 52 -19 C38 -15 23 1 0 0 Z');
  for(const side of [1,-1]){
    c.save();
    if(side<0){c.translate(1024,0);c.scale(-1,1);}
    outlined(new Path2D('M5 31 H247 C231 66 182 70 174 102 Q168 125 145 128 Q168 132 175 153 C181 184 229 191 247 225 H5 Z'),'#417e76');
    outlined(new Path2D('M92 128 C64 98 47 112 53 124 C36 108 44 75 73 79 C97 54 131 70 130 92 C150 89 162 103 152 115 C148 97 127 104 118 117 C108 133 90 142 73 134 Q82 134 92 128 Z'),'#7eaea0');
    c.strokeStyle='#85aaa2';c.lineWidth=5;
    c.stroke(new Path2D('M200 144 C238 105 250 101 284 139 S349 155 386 105'));
    for(const [x,y,a] of [[223,123,-.30],[274,131,-.88],[315,151,-.20],[355,134,-.50]]){
      c.save();c.translate(x,y);c.rotate(a);outlined(leaf,'#558c78');c.restore();
    }
    c.restore();
  }
  outlined(new Path2D('M375 128 Q400 117 409 86 Q453 92 476 62 Q512 79 548 62 Q571 92 615 86 Q624 117 649 128 Q624 139 615 170 Q571 164 548 194 Q512 177 476 194 Q453 164 409 170 Q400 139 375 128 Z'),'#386879');
  c.save();c.translate(512,128);
  for(let i=0;i<8;i++){
    c.rotate(Math.PI/4);outlined(new Path2D('M0 7 C-15 -4 -13 -24 0 -38 C13 -24 15 -4 0 7 Z'),i%2?'#809d84':'#bc9a66');
  }
  c.fillStyle='#975b44';c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.fill();c.restore();
  // Carry the existing hand-painted blossoms and mineral patina into the
  // framed panels. Clip each inset to its timber field so it ends at a bay.
  const art=source.image as HTMLImageElement;
  c.save();
  c.globalCompositeOperation='soft-light';c.globalAlpha=.62;
  c.drawImage(art,0,0,1024,256);c.restore();
  for(const side of [1,-1]){
    c.save();if(side<0){c.translate(1024,0);c.scale(-1,1);}
    c.clip(new Path2D('M20 40 H228 Q211 64 176 83 Q161 123 136 128 Q168 149 178 176 Q204 194 229 217 H20 Z'));
    c.globalAlpha=.59;c.drawImage(art,70,164,570,396,16,36,214,185);c.restore();
  }
  c.save();c.clip(new Path2D('M377 128 Q403 116 413 90 Q455 95 478 68 Q512 85 546 68 Q568 94 610 90 Q623 118 646 128 Q624 142 611 166 Q566 161 546 188 Q512 172 478 188 Q454 160 413 165 Q401 139 377 128 Z'));
  c.globalAlpha=.86;c.drawImage(art,853,156,476,403,392,59,240,138);c.restore();
  // Broken brush marks and grain run with the timber, including the returns.
  let seed=85161;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<6800;i++){
    c.fillStyle=i%3?'rgba(228,207,159,.058)':'rgba(33,28,25,.11)';
    c.fillRect(random()*1024,random()*256,2+random()*10,.5+random()*1.35);
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.name='main-hall-porch-mineral-paint';tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=THREE.RepeatWrapping;tex.anisotropy=8;
  return tex;
}

// Build in physical metres from the column beam to the eave purlin. The
// trough between successive arms stays open in both profile and plan.
export function porchBrackets(columns: number[], beamZ: number, outerZ: number, painting: THREE.Texture) {
  const parts:THREE.BufferGeometry[]=[];
  const depth=outerZ-beamZ;
  const blue='#365970',jade='#4f796d',green='#668d79',red='#8d503d',gold='#c4a16a';
  function paint(g:THREE.BufferGeometry,color:string){
    const base=new THREE.Color(color),pos=g.getAttribute('position'),normal=g.getAttribute('normal');
    const rgb=new Float32Array(pos.count*3);
    const uv=g.getAttribute('uv');
    for(let i=0;i<pos.count;i++){
      // The lower paint border gives the timber faces a fine grain without
      // repeating the full cartouche on each short arm.
      uv.setXY(i,(pos.getX(i)+pos.getZ(i))*.65, .014+.004*Math.sin(pos.getY(i)*18));
      const end=Math.abs(normal.getX(i));
      const value=.95+.04*end+.018*Math.sin(pos.getX(i)*27+pos.getY(i)*9);
      rgb.set([base.r*value,base.g*value,base.b*value],i*3);
    }
    g.setAttribute('color',new THREE.BufferAttribute(rgb,3));parts.push(g);
  }
  function block(x:number,y:number,z:number,w:number,h:number,d:number,col:string){
    paint(box(w,h,d,x,y,z),col);
  }
  function carved(shape:THREE.Shape,thick:number,x:number,y:number,z:number,rot:number,col:string){
    const g=new THREE.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:false,curveSegments:5});
    g.translate(0,0,-thick/2);g.rotateY(rot);g.translate(x,y,z);paint(g,col);
  }
  function arm(x:number,y:number,z:number,half:number,thick:number,rot:number,col:string){
    const s=new THREE.Shape();
    s.moveTo(-half,.21);s.lineTo(half,.21);s.lineTo(half,.08);
    s.quadraticCurveTo(half*.86,.08,half*.84,.01);
    s.quadraticCurveTo(half*.80,-.09,half*.55,-.07);
    s.quadraticCurveTo(half*.38,-.09,half*.32,-.17);
    s.lineTo(-half*.32,-.17);s.quadraticCurveTo(-half*.38,-.09,-half*.55,-.07);
    s.quadraticCurveTo(-half*.8,-.09,-half*.84,.01);s.quadraticCurveTo(-half*.86,.08,-half,.08);s.closePath();
    carved(s,thick,x,y,z,rot,col);
  }
  function dou(x:number,y:number,z:number,w:number,d:number){
    const base=new THREE.CylinderGeometry(1,.73,.14,4).rotateY(Math.PI/4).scale(w/Math.SQRT2,1,d/Math.SQRT2);
    base.translate(x,y+.07,z);paint(base,blue);
    block(x,y+.162,z,w,.045,d,red);
    block(x,y+.22,z,w+.018,.076,d+.018,green);
  }
  function bracketSet(x:number,small:boolean) {
    const outer=depth-.13, middle=depth*.55;
    dou(x,-.61,.12,.57,.66);
    // The fore/aft arms tie into the inner beam. Saddle blocks receive
    // the crossing bow at the next height.
    arm(x,-.22,middle*.53,middle*.64,.34,-Math.PI/2,blue);
    dou(x,-.025,middle,.45,.43);
    arm(x,.38,middle,small?.62:.91,.34,0,jade);
    const fork=small?.43:.65;
    for(const side of [-1,1]){
      const xx=x+side*fork;
      dou(xx,.585,middle,.33,.36);
      arm(xx,.96,(middle+outer)/2,(outer-middle)/2+.19,.24,-Math.PI/2,blue);
      block(xx,1.185,outer,.29,.10,.34,green);
      block(xx,1.245,outer,.28,.025,.32,gold);
    }
    // Slanting ang nose, deeply coloured cut end and a thin ochre lip.
    const s=new THREE.Shape();s.moveTo(-.35,.18);s.lineTo(.32,.28);
    s.lineTo(.59,.095);s.lineTo(.51,-.032);s.lineTo(.12,.02);s.lineTo(-.35,.01);s.closePath();
    carved(s,.22,x,.49,outer-.42,-Math.PI/2,red);
    block(x,.61,outer-.49,.25,.20,outer-middle+.38,jade);
    arm(x,1.29,outer,small?.63:.92,.31,0,green);
  };
  for(let i=0;i<columns.length;i++){
    bracketSet(columns[i],false);
    if(i+1<columns.length)bracketSet((columns[i]+columns[i+1])/2,true);
  }
  const mesh=new THREE.Mesh(merge(parts),new THREE.MeshStandardMaterial({
    name:'main-hall-porch-bracket-paint',vertexColors:true,roughness:.88,metalness:0,
    bumpMap:painting,bumpScale:.003,
  }));
  mesh.name='main-hall-porch-brackets';mesh.receiveShadow=true;mesh.castShadow=true;
  return mesh;
}

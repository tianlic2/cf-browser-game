import * as THREE from 'three';

// A reusable 4K craft atlas. Each cell is drawn at one metre's inspection
// scale, preserving the existing eight-cell UV layout and material sharing.
export function sanctumCraftAtlas(source:THREE.Texture,stone:THREE.Texture) {
  const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;
  const c=canvas.getContext('2d')!;
  c.drawImage(source.image as HTMLImageElement,0,0,4096,2048);
  const S=1024;
  function cell(index:number,draw:()=>void){
    c.save();c.translate((index%4)*S,Math.floor(index/4)*S);
    c.beginPath();c.rect(0,0,S,S);c.clip();draw();c.restore();
  }
  function stroke(path:Path2D,width:number,color:string){
    c.strokeStyle=color;c.lineWidth=width;c.stroke(path);
  }
  function leaf(length:number,width:number,base:string,rim:string){
    const shape=new Path2D();
    shape.moveTo(0,0);shape.bezierCurveTo(-width*.75,-length*.25,-width*.57,-length*.70,0,-length);
    shape.bezierCurveTo(width*.60,-length*.70,width*.72,-length*.23,0,0);shape.closePath();
    c.fillStyle=base;c.fill(shape);stroke(shape,2,rim);
    stroke(new Path2D(`M0 -2 Q${width*.12} ${-length*.5} 0 ${-length*.94}`),1.6,rim);
  }
  cell(0,()=>{
    c.fillStyle='#713a29';c.fillRect(0,0,S,S);
    for(const [inset,color,width] of [[11,'#d9b47a',9],[29,'#647f70',14],[45,'#e3d0a0',4]] as const){
      c.strokeStyle=color;c.lineWidth=width;c.strokeRect(inset,inset,S-inset*2,S-inset*2);
    }
    c.translate(512,512);
    c.fillStyle='#555441';c.beginPath();c.arc(0,0,407,0,Math.PI*2);c.fill();
    for(const [radius,color,width] of [[412,'#dbce9f',13],[389,'#a5ae8d',8],[373,'#5e7b71',13],[363,'#d4c39b',4]] as const){
      c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.stroke();
    }
    for(let i=0;i<16;i++){
      c.save();c.rotate(i*Math.PI/8);c.translate(0,-296);c.rotate(-i*.13);
      for(let j=0;j<5;j++){c.rotate(Math.PI*2/5);leaf(57,31,j%2?'#d2cfb0':'#9baea2','#ebe0be');}
      c.fillStyle='#b78d55';c.beginPath();c.arc(0,0,9,0,Math.PI*2);c.fill();c.restore();
    }
    for(let i=0;i<8;i++){
      c.save();c.rotate(i*Math.PI/4);
      leaf(246,104,'#75998d','#dcd3ae');
      c.translate(0,-143);c.rotate(Math.PI/3);leaf(100,42,'#a4bca8','#f2deaa');c.restore();
    }
    for(let i=0;i<12;i++){
      c.save();c.rotate(i*Math.PI/6);leaf(137,52,i%2?'#d9c499':'#a4a288','#eee1be');c.restore();
    }
    c.fillStyle='#a2784e';c.beginPath();c.arc(0,0,31,0,Math.PI*2);c.fill();
    for(let i=0;i<24;i++){const a=i*2.399,r=5+Math.sqrt(i)*4;c.fillStyle='#d8bc86';c.beginPath();c.arc(Math.cos(a)*r,Math.sin(a)*r,2.2,0,Math.PI*2);c.fill();}
  });
  cell(1,()=>{
    c.fillStyle='#29282a';c.fillRect(0,0,S,S);
    c.lineJoin='miter';
    // Stepped fret interlocks at the cell edges, with a bevel on its lit lip.
    const fret=new Path2D('M-2 32 H32 V0 H96 V32 H128 V96 H96 V128 H32 V96 H0 V64 H62 V34 H66 V94 H34 V66 H-2');
    for(let row=0;row<6;row++)for(let col=0;col<6;col++){
      c.save();c.translate((col+.5)*S/6,(row+.5)*S/6);
      c.scale(S/(6*128),S/(6*128));
      if((row+col)%2)c.rotate(Math.PI/2);
      c.translate(-64,-64);
      stroke(fret,13,'#17181a');stroke(fret,8,'#63615c');
      c.translate(-1,-1.6);stroke(fret,2.6,'#a5a098');c.restore();
    }
  });
  cell(2,()=>{
    c.fillStyle='#2f2926';c.fillRect(0,0,S,S);
    for(let row=0;row<6;row++)for(let col=0;col<6;col++){
      c.save();c.translate((col+.5)*S/6,(row+.5)*S/6);
      const niche=new Path2D('M-64 69 V-12 A64 64 0 0 1 64 -12 V69 Z');
      c.fillStyle='#181918';c.fill(niche);stroke(niche,5,'#68543c');
      const g=c.createLinearGradient(-30,0,36,0);g.addColorStop(0,'#79562f');g.addColorStop(.45,'#c7a267');g.addColorStop(1,'#755532');
      c.fillStyle=g;c.beginPath();c.ellipse(0,-28,17,22,0,0,Math.PI*2);c.fill();
      c.beginPath();c.ellipse(0,10,29,32,0,0,Math.PI*2);c.fill();
      c.beginPath();c.ellipse(0,36,48,19,0,0,Math.PI*2);c.fill();
      for(let j=0;j<5;j++){c.strokeStyle='#735330';c.lineWidth=2;c.beginPath();c.ellipse(0,2+j*6,14+j*2,9,0,0,Math.PI);c.stroke();}
      c.fillStyle='#c1a273';c.fillRect(-51,56,102,5);c.fillStyle='#483a28';c.fillRect(-54,62,108,9);c.restore();
    }
  });
  cell(3,()=>{
    c.fillStyle='#3e352b';c.fillRect(0,0,S,S);
    for(let row=-1;row<5;row++)for(let col=-1;col<4;col++){
      c.save();c.translate(col*340+(row%2)*170,row*256+123);
      const vine=new Path2D('M-170 128 C-30 102 -50 -70 45 -84 C119 -99 154 -3 93 26 C27 60 17 -23 70 -28');
      c.save();c.translate(5,6);stroke(vine,24,'#221e19');c.restore();
      stroke(vine,19,'#9d7a48');stroke(vine,8,'#cfb380');stroke(vine,2,'#ead4a6');
      for(const [x,y,angle] of [[-44,18,-.9],[84,-55,1.7],[20,79,-2.3]]){
        c.save();c.translate(x,y);c.rotate(angle);leaf(112,62,'#ac8c57','#dfc696');c.restore();
      }
      c.translate(-92,-35);
      for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);leaf(70,31,'#bda170','#eee0b7');c.restore();}
      c.fillStyle='#836035';c.beginPath();c.arc(0,0,12,0,Math.PI*2);c.fill();c.restore();
    }
  });
  // Face the altar with alternating cuts of veined pale stone. Keep the
  // mortar seams narrow enough to remain legible from the centre aisle.
  cell(4,()=>{
    c.fillStyle='#897d6c';c.fillRect(0,0,S,S);
    const slab=stone.image as HTMLImageElement;
    for(let row=0;row<3;row++)for(let j=-1;j<3;j++){
      const x=(j+(row%2)*.5)*512,y=row*S/3;
      const sx=(row*117+j*83+251)%320,sy=(row*91+j*37+178)%240;
      c.drawImage(slab,sx,sy,640,400,x+2,y+2,509,S/3-4);
      c.fillStyle='rgba(244,236,216,.32)';c.fillRect(x+2,y+2,509,2);
    }
  });
  // Thin pigment gaps and grain follow deterministic coordinates. This
  // affects colour only; large carved relief is modeled separately.
  let seed=0x54396;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<42000;i++){
    c.fillStyle=i%3?'rgba(243,223,180,.033)':'rgba(22,24,21,.065)';
    c.fillRect(random()*4096,random()*1024,1+random()*4,.7+random()*1.4);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.name='hall-authored-craft-4k';texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  return texture;
}

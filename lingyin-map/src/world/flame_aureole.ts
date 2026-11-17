import * as THREE from 'three';
import {merge} from './geom';

// Flame-shaped aureole with two chased borders and raised cloud tendrils.
export function flameAureole(scrollwork:THREE.Texture){
  const pieces:THREE.BufferGeometry[]=[];
  function outline(t:number,inset:number,flames:boolean){
    const a=t*Math.PI*2,upper=Math.max(0,Math.cos(a));
    const flame=flames?.105*Math.max(0,Math.sin(a*38+1.7*Math.sin(a*3)))**3:0;
    return new THREE.Vector2((1.77-inset+flame)*Math.sin(a)*(1-.27*upper),
      (2.33-inset+flame)*Math.cos(a)+.37*upper**9);
  }
  const edge=Array.from({length:608},(_,i)=>outline(i/608,0,true));
  const plate=new THREE.ExtrudeGeometry(new THREE.Shape(edge),{depth:.066,bevelEnabled:false});
  const pos=plate.getAttribute('position'),uv=plate.getAttribute('uv');
  for(let i=0;i<pos.count;i++)uv.setXY(i,.5+pos.getX(i)/3.84,(pos.getY(i)+2.45)/5.27);
  const bronze=new THREE.MeshStandardMaterial({name:'hall-gilded-aureole-field',map:scrollwork,bumpMap:scrollwork,bumpScale:.0038,color:0xb39164,metalness:.49,roughness:.59});
  const field=new THREE.Mesh(plate,bronze);
  function wire(points:THREE.Vector3[],radius:number,closed=false){
    pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,closed),closed?144:24,radius,5,closed));
  }
  // A cast rim has a scalloped outer lip, a dark rebate and a rounded inner bead.
  // Its section follows the flame points into the field, fading towards the inside.
  const section=[
    [0,.066,0x614329],[.015,.090,0x95723e],[.043,.142,0xc39a59],
    [.068,.153,0xd2ab67],[.098,.097,0x9e7946],[.116,.084,0x74512d],
    [.153,.092,0x947043],[.19,.124,0xb28c50],[.208,.12,0xc19b5e],
    [.228,.068,0x7a5938],
  ];
  const coordinates:number[]=[],colours:number[]=[],indices:number[]=[];
  const samples=456;
  for(let i=0;i<samples;i++)for(const [inset,z,hex] of section){
    const t=i/samples,smooth=outline(t,inset,false),point=outline(t,inset,true);
    smooth.lerp(point,Math.max(0,1-inset/.21));
    coordinates.push(smooth.x,smooth.y,z);
    const c=new THREE.Color(hex);colours.push(c.r,c.g,c.b);
  }
  for(let i=0;i<samples;i++)for(let j=0;j<section.length-1;j++){
    const a=i*section.length+j,b=((i+1)%samples)*section.length+j;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  const casting=new THREE.BufferGeometry();
  casting.setIndex(indices);
  casting.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
  casting.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));casting.computeVertexNormals();
  const lip=new THREE.Mesh(casting,new THREE.MeshStandardMaterial({name:'hall-aureole-cast-border',
    vertexColors:true,metalness:.61,roughness:.45}));
  wire(Array.from({length:120},(_,i)=>{const p=outline(i/120,.44,false);return new THREE.Vector3(p.x,p.y,.08);}),.016,true);
  for(const side of [-1,1])for(let i=0;i<16;i++){
    const a=.16+i*.181, p=outline(a/(2*Math.PI),.29,false);
    const curl=Array.from({length:19},(_,j)=>{
      const t=j/18,ang=t*1.62*Math.PI,r=.18*(1-.79*t);
      return new THREE.Vector3(side*(p.x+r*Math.cos(ang)*Math.cos(a)+.14*Math.sin(ang)*Math.sin(a)),
        p.y+.21*Math.cos(ang)*Math.sin(a)-r*Math.sin(ang)*Math.cos(a),.091+.035*Math.sin(t*Math.PI));
    });
    wire(curl,.014);
  }
  const rim=new THREE.Mesh(merge(pieces),new THREE.MeshStandardMaterial({name:'hall-chased-aureole-rims',
    color:0xd0a352,metalness:.62,roughness:.43}));
  const group=new THREE.Group();group.name='hall-statue-halo';group.add(field,lip,rim);return group;
}

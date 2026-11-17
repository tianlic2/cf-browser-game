import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { compartments, luminaires, lightGrid } from './transport_compartment_layout.js';

// The rack shares an atlas with the painted steelwork. The circular panel
// depicts the exposed selvedges of one rolled lay-flat hose.
function stationAtlas() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f7f7f4';ctx.fillRect(0,0,512,512);
  let seed=5321;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<2900;i++) {
    ctx.fillStyle=random()<.82?'rgba(89,78,63,.09)':'rgba(92,64,43,.19)';
    ctx.fillRect(random()*124,random()*124,1+random()*3,1+random()*2);
  }
  ctx.fillStyle='#9b4435';ctx.fillRect(140,8,364,88);
  ctx.strokeStyle='#d1afa0';ctx.lineWidth=2;ctx.strokeRect(144,12,356,80);
  ctx.font='bold 47px sans-serif';ctx.fillStyle='#e8dfc5';ctx.fillText('FIRE HOSE',168,72);
  // Closely packed textile layers with a slightly flattened lower edge.
  ctx.fillStyle='#4c4739';ctx.fillRect(128,128,384,384);
  const cx=320,cy=320;
  const radiusAt=(a,r)=>r*(1+.021*Math.sin(3*a+.8)+.013*Math.cos(6*a))+.9*Math.sin(2*a+r*.08);
  function spiral(offset,width,ink){
    ctx.beginPath();
    const turns=11.8,steps=1900;
    for(let k=0;k<=steps;k++){
      const u=k/steps,a=u*turns*Math.PI*2;
      const r=radiusAt(a,7+u*174+offset);
      const x=cx+r*Math.cos(a),y=cy+Math.min(r*Math.sin(a),r*.943);
      if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);
    }
    ctx.strokeStyle=ink;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();
  }
  spiral(0,14,'#695d48');spiral(-1.4,10,'#b9aa8b');spiral(-3,4,'#d8c6a4');
  for(let i=0;i<23000;i++){
    const x=cx+(random()-.5)*366,y=cy+(random()-.5)*366;
    ctx.fillStyle=random()<.55?'rgba(61,48,38,.19)':'rgba(232,224,207,.22)';
    ctx.fillRect(x,y,.8+random()*1.8,.7);
  }
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  return map;
}

function buildCompartment(room, atlas) {
  const parts=[], lenses=[];
  const { height:h, facing, wall }=room;
  const roomGroup=new THREE.Group();
  roomGroup.name='transport-tween-deck-'+(facing>0?'aft':'forward');
  const position=new THREE.Vector3(), scale=new THREE.Vector3(), rotation=new THREE.Quaternion();
  const matrix=new THREE.Matrix4(), colour=new THREE.Color();
  const up=new THREE.Vector3(0,1,0);
  const cube=new THREE.BoxGeometry(), round=new THREE.CylinderGeometry(.5,.5,1,8);
  const sleeve=new THREE.CylinderGeometry(.5,.5,1,8,1,true);
  function piece(geometry,tint,emissive=false,region=[2,2,119,119]) {
    const g=geometry.clone().applyMatrix4(matrix.compose(position,rotation,scale));
    const rgb=new Float32Array(g.attributes.position.count*3);
    colour.setHex(tint);
    for(let i=0;i<rgb.length;i+=3)colour.toArray(rgb,i);
    g.setAttribute('color',new THREE.BufferAttribute(rgb,3));
    const uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)
      uv.setXY(i,(region[0]+region[2]*uv.getX(i))/512,1-(region[1]+region[3]*(1-uv.getY(i)))/512);
    (emissive?lenses:parts).push(g);
  }
  function box(x,y,z,w,b,d,tint,emissive=false) {
    position.set(x,y,z); scale.set(w,b,d); rotation.identity();
    piece(cube,tint,emissive);
  }
  function pipe(start,end,diameter,tint,capped=false) {
    const a=new THREE.Vector3(...start), b=new THREE.Vector3(...end);
    position.copy(a).lerp(b,.5); b.sub(a);
    scale.set(diameter,b.length(),diameter); rotation.setFromUnitVectors(up,b.normalize());
    piece(capped?round:sleeve,tint);
  }
  const enamel=0x868b7f, flange=0x59625b, zinc=0x9b9b8c;
  const fire=0xa54d39, rim=0x7a3730, brass=0xb49763;
  // Low-profile web frames land against the deckhead. The red fire main
  // runs above the doors, clear of their guides.
  for(const x of [-11.85,-6.55,.2,6.45,12.15]) {
    box(x,h-.068,4.21,.038,.136,8.12,enamel);
    box(x,h-.14,4.21,.165,.023,8.12,flange);
  }
  pipe([-14.55,h-.26,.64],[14.65,h-.26,.64],.103,fire);
  for(let x=-13.7;x<14;x+=3.12) {
    box(x,h-.105,.64,.061,.21,.035,flange);
    pipe([x-.036,h-.26,.64],[x+.036,h-.26,.64],.128,zinc);
  }
  for(const depth of [1.84,5.57]) {
    // Lighting circuits travel in a shallow lidded cable tray. The rolled
    // edges leave a narrow shadow along both sides at grazing angles.
    box(0,h-.078,depth,29.1,.105,.19,flange);
    for(const side of [-1,1])box(0,h-.129,depth+side*.096,29.1,.018,.025,zinc);
  }
  for(const [x,z] of luminaires) {
    box(x,h-.139,z,1.56,.082,.32,flange);
    box(x,h-.186,z,1.47,.040,.266,0xc6c7ad);
    box(x,h-.215,z,1.34,.048,.195,0xfff0ce,true);
    for(const side of [-1,1]) {
      box(x+side*.72,h-.20,z,.054,.107,.264,enamel);
      box(x,h-.237,z+side*.099,1.37,.019,.023,zinc);
    }
    for(const off of [-.52,-.17,.17,.52])
      box(x+off,h-.245,z,.013,.014,.209,zinc);
  }

  // Fire hose in a shallow open-front steel rack on the fixed bulkhead.
  // The cartridge, hose folds, valve and union sit within the jamb trim depth.
  const cx=-10.45, cy=1.26;
  box(cx,cy,.04,.69,1.12,.07,0x673c35);
  for(const sign of [-1,1]) {
    box(cx+sign*.342,cy,.098,.037,1.16,.14,fire);
    box(cx,cy+sign*.55,.098,.7,.038,.14,fire);
  }
  box(cx,cy+.45,.124,.64,.154,.068,fire);
  const header=new THREE.PlaneGeometry(.61,.143);
  position.set(cx,cy+.45,.160);scale.set(1,1,1);rotation.identity();
  piece(header,0xffffff,false,[140,8,364,88]);
  // Back flange, rolled linen and a shelf below the hose. The coupling and
  // tapered brass jet nozzle hang on two clips to the right of the roll.
  const rollX=cx-.061, rollY=cy-.047;
  pipe([rollX,rollY,.06],[rollX,rollY,.151],.474,0x73614d,true);
  const face=new THREE.CircleGeometry(.232,40);
  position.set(rollX,rollY,.155);rotation.identity();scale.set(1,1,1);
  piece(face,0xffffff,false,[138,138,364,364]);
  box(rollX,cy-.300,.095,.52,.03,.165,flange);
  pipe([cx+.239,cy-.29,.125],[cx+.239,cy+.03,.125],.068,brass,true);
  const nozzle=new THREE.CylinderGeometry(.014,.036,.16,12);
  position.set(cx+.239,cy+.112,.125);rotation.identity();scale.set(1,1,1);
  piece(nozzle,brass);
  for (const y of [cy-.281,cy-.261,cy+.03])
    pipe([cx+.239,y-.01,.125],[cx+.239,y+.01,.125],.086,flange,true);
  header.dispose();face.dispose();nozzle.dispose();
  // A branch clips to the wall beside the rack and terminates at a landing valve.
  const branch=cx-.47;
  pipe([branch,h-.26,.64],[branch,h-.26,.12],.070,fire);
  pipe([branch,h-.26,.12],[branch,.87,.12],.070,fire);
  for(const y of [2.69,2.11,1.48]) {
    box(branch,y,.055,.12,.042,.11,flange);
    pipe([branch,y-.024,.12],[branch,y+.024,.12],.09,zinc);
  }
  pipe([branch,.94,.12],[cx-.32,.94,.12],.10,brass);
  pipe([branch,1.015,.115],[branch,1.015,.201],.069,brass);
  const wheel=new THREE.TorusGeometry(.085,.012,5,16);
  position.set(branch,1.015,.20); scale.set(1,1,1); rotation.identity(); piece(wheel,rim);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3;
    pipe([branch,1.015,.20],[branch+.08*Math.cos(a),1.015+.08*Math.sin(a),.20],.015,rim);
  }
  const shell=new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.72,metalness:.17});
  const diffusers=new THREE.MeshBasicMaterial({vertexColors:true,color:new THREE.Color().setScalar(1.9)});
  for(const [pieces,material,name] of [[parts,shell,'services'],[lenses,diffusers,'diffusers']]) {
    const mesh=new THREE.Mesh(mergeGeometries(pieces),material);
    mesh.name=roomGroup.name+'-'+name;
    mesh.receiveShadow=true;
    roomGroup.add(mesh);
    pieces.forEach(g=>g.dispose());
  }
  cube.dispose();round.dispose();sleeve.dispose();wheel.dispose();
  // A local origin at the centre gives distance culling the same threshold
  // at either doorway. Fixtures farther down the run are hidden by the hull.
  roomGroup.position.z=-4.2;
  const lod=new THREE.LOD();
  lod.position.set(0,0,wall+4.2*facing); lod.rotation.y=facing>0?0:Math.PI;
  lod.addLevel(roomGroup,0);
  lod.addLevel(new THREE.Group(),24, .12);
  return lod;
}

export function createTransportCompartments() {
  const root=new THREE.Group();
  root.name='transport-tween-decks';
  const atlas=stationAtlas();
  for(const room of compartments)root.add(buildCompartment(room,atlas));
  return root;
}

// Two RGB samples reconstruct one ambient cube, one for each normal sign.
// The two source colours stay independent through the bake and interpolation.
export function addCompartmentIrradiance(shader, atlas) {
  const { width, depth, layers, cell, left, front }=lightGrid;
  const numbers=v=>Number(v).toFixed(3);
  shader.uniforms.uTweenDeckLight={value:atlas};
  shader.fragmentShader=`
    uniform sampler2D uTweenDeckLight;
    vec3 tweenFlux(vec2 uv, float tile, float heightBlend) {
      vec2 stepUV=vec2(0.,${numbers(depth)} / ${numbers(2*depth*layers)});
      vec2 origin=uv+vec2(tile*.25,0.);
      vec3 lo=texture2D(uTweenDeckLight,origin).rgb;
      vec3 hi=texture2D(uTweenDeckLight,origin+stepUV).rgb;
      return 8.*mix(lo*lo,hi*hi,heightBlend);
    }
    vec3 tweenLight(vec3 world, vec3 normal) {
      float side=world.z>0.?1.:-1.;
      float wall=side>0.?${numbers(compartments[0].wall)}:${numbers(compartments[1].wall)};
      float top=side>0.?${numbers(compartments[0].height)}:${numbers(compartments[1].height)};
      vec3 point=vec3(world.x*side,world.y,(world.z-wall)*side);
      if(point.z<-.24 || point.z>8.65 || abs(point.x)>15.35 || point.y<-.12 || point.y>top+.03) return vec3(0.);
      vec3 n=normal*vec3(side,1.,side);
      vec3 cell=clamp((point+.095*n-vec3(${numbers(left)},0.,${numbers(front)}))/${numbers(cell)},
        vec3(0.),vec3(${numbers(width-1)},${numbers(layers-1)}-.001,${numbers(depth-1)}));
      float base=side>0.?0.:${numbers(layers*depth)};
      vec2 uv=(vec2(cell.x,base+floor(cell.y)*${numbers(depth)}+cell.z)+.5) /
        vec2(${numbers(width*4)},${numbers(2*depth*layers)});
      vec3 pos=max(n,0.), neg=max(-n,0.);
      // Squared normal weights sum to one and turn continuously around edges.
      vec3 wPos=pos*pos, wNeg=neg*neg;
      float fy=fract(cell.y);
      float lamp=dot(tweenFlux(uv,0.,fy),wPos)+dot(tweenFlux(uv,1.,fy),wNeg);
      float sky=dot(tweenFlux(uv,2.,fy),wPos)+dot(tweenFlux(uv,3.,fy),wNeg);
      float edge=smoothstep(-.24,.14,point.z)*(1.-smoothstep(8.44,8.65,point.z));
      return edge*(lamp*vec3(3.45,2.94,2.32)+sky*vec3(1.58,1.86,2.15));
    }
  `+shader.fragmentShader.replace('#include <lights_fragment_end>',
    'irradiance+=tweenLight(vShipLightPosition,inverseTransformDirection(normal,viewMatrix));\n#include <lights_fragment_end>');
}

export function paintCompartmentWalls(shader) {
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    float facingRoom=sign(vTransportWorld.z);
    float distanceIn=(vTransportWorld.z-(facingRoom>0.?36.60:-37.91))*facingRoom;
    if(distanceIn>-.055 && distanceIn<8.61 && abs(vTransportWorld.x)<15.4
        && vTransportWorld.y>0. && vTransportWorld.y<3.46 && abs(vTransportNormal.y)<.4) {
      float level=vTransportWorld.y;
      float band=1.-smoothstep(1.09,1.10,level);
      float coachline=smoothstep(1.09,1.105,level)*(1.-smoothstep(1.13,1.145,level));
      // The worn steel and weld seams remain visible beneath the two topcoats.
      diffuseColor.rgb*=mix(vec3(1.29,1.24,1.03),vec3(.40,.75,.66),band);
      diffuseColor.rgb*=1.-.34*coachline;
    }`);
}

// The hands use a separate scene. Read the same baked practical-light volume
// at the eye on movement, so a sleeve brightens while walking beneath a tube.
export function createCompartmentLightProbe(atlas) {
  const { width, depth, layers, cell, left, front }=lightGrid;
  const canvas=document.createElement('canvas');
  canvas.width=atlas.image.width/2;canvas.height=atlas.image.height;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(atlas.image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const values=new Uint8Array(2*layers*depth*width);
  for(let i=0;i<values.length;i++) {
    const x=i%width,row=Math.floor(i/width);
    const a=4*(row*canvas.width+x),b=a+4*width;
    const sq=k=>(pixels[k]/255)**2;
    const level=8*(.46*sq(a+1)+.14*(sq(a)+sq(a+2)+sq(b)+sq(b+2)));
    values[i]=Math.round(255*Math.min(1,level));
  }
  return (x,y,z)=>{
    const side=z>0?1:-1,room=compartments[side>0?0:1];
    const distance=(z-room.wall)*side;
    if(distance<0 || distance>8.5 || y<0 || y>room.height || Math.abs(x)>15.35)return 0;
    const gx=(x*side-left)/cell, gy=Math.min(y/cell,layers-1.001), gz=(distance-front)/cell;
    const ix=Math.floor(gx),iy=Math.floor(gy),iz=Math.floor(gz);
    const roomOffset=side>0?0:layers;
    const lerp=THREE.MathUtils.lerp;
    const row=(layer,d)=>{
      const i=((layer+roomOffset)*depth+d)*width+ix;
      return lerp(values[i],values[i+1],gx-ix)/255;
    };
    const plane=layer=>lerp(row(layer,iz),row(layer,iz+1),gz-iz);
    return lerp(plane(iy),plane(iy+1),gy-iy)*THREE.MathUtils.smoothstep(distance,0,.25);
  };
}

import * as THREE from 'three';
import { sanctumCraftAtlas } from './sanctum_atlas';
import { OFFERING_TABLE, OFFERING_STONE, MAIN_SHRINE, MAIN_VOTIVE_LAMPS } from '../../../scripts/lingyin_columns.js';
import { box, merge } from './geom';
import { MAIN_PORTAL, MAIN_HALL_SCALE } from '../../../scripts/lingyin_main_hall.js';

// Set out the inlay one stone at a time so the border turns cleanly at all
// four corners. Mineral variation comes from the hall's existing stone scan.
export function inlaidPaving(scan: THREE.Texture,width:number,depth:number) {
  const canvas=document.createElement('canvas');canvas.width=3072;canvas.height=2304;
  const ctx=canvas.getContext('2d')!, nx=36,nz=28;
  const w=canvas.width/nx,h=canvas.height/nz,source=scan.image as HTMLImageElement;
  ctx.fillStyle='#aaa195';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=Math.min(i,nx-1-i),z=Math.min(j,nz-1-j);
    const border=Math.min(x-7,z-2);
    const steppedBorder=border>=0&&border<=1&&(x+z)%2===0;
    const corner=Math.abs(x-11)+Math.abs(z-6);
    const red=steppedBorder||corner===2||
      (z===6&&x>=13&&x<=16)||(x===11&&z>=8&&z<=10);
    const seed=((i*31+j*13)%17)/16;
    ctx.fillStyle=red?'#724a43':`hsl(${34+seed*4},${5+seed*4}%,${56+seed*9}%)`;
    ctx.fillRect(i*w+.5,j*h+.5,w-.6,h-.6);
    ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=red?.48:.70;
    const sx=((i*73+j*21)%500)/1000*source.width,sy=((j*63+i*19)%500)/1000*source.height;
    ctx.drawImage(source,sx,sy,source.width*.23,source.height*.18,i*w+1,j*h+1,w-1,h-1);ctx.restore();
  }
  // Bake soft occlusion into the stone below the apron and at the four feet.
  // The floor plane's front edge maps to the bottom of the source image.
  function contact(x:number,z:number,rx:number,rz:number,opacity:number){
    ctx.save();
    ctx.translate((.5+x/width)*canvas.width,(.5+z/depth)*canvas.height);
    ctx.scale(rx/width*canvas.width,rz/depth*canvas.height);
    const shade=ctx.createRadialGradient(0,0,0,0,0,1);
    shade.addColorStop(0,'rgba(33,24,18,'+opacity+')');
    shade.addColorStop(.55,'rgba(33,24,18,'+opacity*.65+')');
    shade.addColorStop(1,'rgba(33,24,18,0)');
    ctx.fillStyle=shade;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  const table=OFFERING_TABLE;
  contact(0,table.z-.10,table.w*.66,table.d*1.07,.39);
  for(const side of [-1,1])for(const end of [-1,1])
    contact(side*table.legX,table.z+end*table.legZ,.28,.21,.48);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  return new THREE.MeshStandardMaterial({name:'hall-inlaid-limestone',map,roughness:.54,metalness:.012});
}

export function sanctumJoinery(atlas:THREE.Texture,dragon:THREE.Texture,stoneScan:THREE.Texture,cx:number,cz:number,floor:number,ceiling:number,
  width:number,depth:number) {
  atlas=sanctumCraftAtlas(atlas,stoneScan);
  const group=new THREE.Group();group.position.set(cx,floor,cz);group.name='hall-sanctum-joinery';
  const painted:THREE.BufferGeometry[]=[],body:THREE.BufferGeometry[]=[],metal:THREE.BufferGeometry[]=[],glass:THREE.BufferGeometry[]=[];
  const h=ceiling-floor;
  function tint(g:THREE.BufferGeometry,color:string){
    const c=new THREE.Color(color),rgb=new Float32Array(g.getAttribute('position').count*3);
    for(let i=0;i<rgb.length;i+=3){rgb[i]=c.r;rgb[i+1]=c.g;rgb[i+2]=c.b}
    g.setAttribute('color',new THREE.BufferAttribute(rgb,3));return g;
  }
  function timber(w:number,t:number,d:number,x:number,y:number,z:number,col:string){
    body.push(tint(box(w,t,d,x,y,z),col));
  }
  function art(g:THREE.BufferGeometry,cell:number,col='#ffffff'){
    const uv=g.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setXY(i,((cell%4)+.004+.992*uv.getX(i))/4,
      (1-Math.floor(cell/4)+.004+.992*uv.getY(i))/2);
    painted.push(tint(g,col));
  }
  function panel(w:number,t:number,x:number,y:number,z:number,cell:number,yaw=0){
    const g=new THREE.PlaneGeometry(w,t,4,4).rotateY(yaw).translate(x,y,z);
    art(g,cell);
    const colors=g.getAttribute('color'),pos=g.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      const py=pos.getY(i),px=pos.getX(i);
      let shade=cell===1?.85:1;
      if(cell===2){
        const bay=px/MAIN_SHRINE.pitch+.5;
        const dx=bay-Math.floor(bay)-.5;
        shade=.22+.46*Math.sin(Math.PI*(dx+.5))*(1-.42*THREE.MathUtils.smoothstep(py,4.4,6.1));
      }
      if(cell===4){
        const below=y+t*.5-py;
        shade=.62+.38*THREE.MathUtils.smoothstep(below,0,.093);
      }
      colors.setXYZ(i,shade,shade,shade);
    }
  }
  function ceilingPanel(w:number,d:number,x:number,y:number,z:number,cell:number){
    const reach=Math.min(1,Math.abs(x)/(width*.5));
    const tint=new THREE.Color().setScalar(cell===0?.66+.17*reach:.63);
    art(new THREE.PlaneGeometry(w,d).rotateX(Math.PI/2).translate(x,y,z),cell,'#'+tint.getHexString());
  }
  const vermilion='#a8583d',jade='#71a293',brass='#b99a62',ebony='#383331';
  const baysX=18,baysZ=14,tx=width/baysX,tz=depth/baysZ;
  // A flat grid of painted ceiling panels surrounds the recessed octagonal centre.
  for(let i=0;i<baysX;i++)for(let j=0;j<baysZ;j++){
    if(i>=6&&i<12&&j>=4&&j<10)continue;
    const x=(i+.5-baysX/2)*tx,z=(j+.5-baysZ/2)*tz;
    ceilingPanel(tx-.036,tz-.036,x,h-.14,z,0);
  }
  for(let i=0;i<=baysX;i++){
    const x=(i-baysX/2)*tx;
    if(i<6||i>12)timber(.055,.10,depth,x,h-.15,0,vermilion);
    else for(const s of [-1,1])timber(.055,.10,4*tz,x,h-.15,s*5*tz,vermilion);
  }
  for(let j=0;j<=baysZ;j++){
    const z=(j-baysZ/2)*tz;
    if(j<4||j>10)timber(width,.10,.055,0,h-.15,z,vermilion);
    else for(const s of [-1,1])timber(6*tx,.10,.055,s*6*tx,h-.15,z,vermilion);
  }
  const cw=6*tx,cd=6*tz;
  ceilingPanel(cw,cd,0,h-.05,0,5);
  // Raised octagonal mouldings surround the original high-resolution dragon.
  const oct=(i:number,r:number,y:number)=>new THREE.Vector3(Math.cos((i+.5)*Math.PI/4)*cw*r,y,Math.sin((i+.5)*Math.PI/4)*cd*r);
  const sections=[[.46,-.21,'#a65130'],[.445,-.23,'#ceac68'],[.431,-.15,'#366d67'],[.405,-.15,'#80a48d'],
    [.391,-.10,'#cd9c64'],[.380,-.095,'#735046']] as const;
  for(let k=1;k<sections.length;k++){
    const [ra,ya]=sections[k-1],[rb,yb,color]=sections[k],vertices:number[]=[];
    for(let i=0;i<8;i++)for(const v of [oct(i,ra,h+ya),oct(i+1,ra,h+ya),oct(i,rb,h+yb),
      oct(i+1,ra,h+ya),oct(i+1,rb,h+yb),oct(i,rb,h+yb)])vertices.push(v.x,v.y,v.z);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    g.computeVertexNormals();body.push(tint(g,color));
  }
  const pg=new THREE.CircleGeometry(1,8,Math.PI/8).rotateX(Math.PI/2).scale(cw*.381,1,cd*.381);
  const uv=pg.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,.14+.72*uv.getX(i),.14+.72*uv.getY(i));
  const boss=new THREE.Mesh(pg,new THREE.MeshStandardMaterial({name:'hall-dragon-coffer-art',map:dragon,
    emissive:0xffffff,emissiveMap:dragon,emissiveIntensity:.16,roughness:.76}));
  boss.name='hall-central-dragon-coffer';boss.position.y=h-.09;group.add(boss);
  for(const [inset,col] of [[0,vermilion],[.10,jade],[.21,brass]] as const){
    for(const s of [-1,1]){
      timber(cw-2*inset,.16,.085,0,h-.19+inset*.25,s*(cd/2-inset),col);
      timber(.085,.16,cd-2*inset,s*(cw/2-inset),h-.19+inset*.25,0,col);
    }
  }
  // Individually recessed bays with an ogee opening, relief fretwork in the
  // spandrels and dark reveals. The statues retain freestanding volumes.
  const {pitch,frontZ,backZ,postWidth}=MAIN_SHRINE;
  const half=(pitch-postWidth)/2;
  for(const x of [-pitch,0,pitch]){
    const z=frontZ;
    for(let row=0;row<7;row++)for(let col=0;col<7;col++)
      panel(2*half/7,.93,x+(col-3)*2*half/7,1.38+row*.93,backZ+.01,2);
    // Panel the inner faces of the actual solid partition. These angled
    // views of tiny votive niches establish the depth from the doorway.
    for(const s of [-1,1]){
      const span=frontZ-backZ;
      for(let row=0;row<7;row++)for(let col=0;col<3;col++)
        panel(span/3,.93,x+s*(half-.006),1.38+row*.93,backZ+span*(col+.5)/3,2,-s*Math.PI/2);
      timber(.035,6.72,.045,x+s*(half-.025),4.26,z+.02,'#675a48');
    }
    for(let row=0;row<3;row++){
      const soffit=new THREE.PlaneGeometry(half*2,(frontZ-backZ)/3).rotateX(Math.PI/2)
        .translate(x,7.675,backZ+(row+.5)*(frontZ-backZ)/3);
      art(soffit,1,'#6d6255');
    }
    const opening=(t:number)=>7.23-.19*t*t-.52*Math.abs(t)**4-.77*Math.abs(t)**13;
    for(let i=0;i<32;i++){
      const a=i/16-1,b=(i+1)/16-1,ya=opening(a),yb=opening(b);
      const pts=[a,ya,b,yb,b,7.68,a,ya,b,7.68,a,7.68];
      const pos:number[]=[],uv:number[]=[];
      for(let k=0;k<pts.length;k+=2){
        pos.push(x+pts[k]*half,pts[k+1],z+.025);
        uv.push((i%8+(pts[k]===b?1:0))/8,(pts[k+1]-5.46)/2.22);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();art(g,1);
      // Follow the scallop with one continuous rebated section; the broad
      // underside becomes visible from below and the narrow bead catches light.
      const profile=[[-.03,-.31],[-.03,-.035],[-.014,.036],[.010,.067],[.026,.061],
        [.039,.034],[.068,.034],[.084,.057],[.105,.057],[.128,.025]];
      const stain=['#3d312a','#534337','#856c50','#b09467','#82684c',
        '#4d4035','#725f49','#958167','#625143'];
      const at=(t:number,k:number)=>{
        const [rise,projection]=profile[k];
        const slope=(opening(t+.0001)-opening(t-.0001))/(.0002*half);
        const norm=Math.hypot(slope,1);
        return [x+t*half-rise*slope/norm,opening(t)+rise/norm,z+projection];
      };
      for(let k=0;k<stain.length;k++){
        const strip=new THREE.BufferGeometry();
        strip.setAttribute('position',new THREE.Float32BufferAttribute(
          [...at(a,k),...at(b,k),...at(a,k+1),...at(b,k),...at(b,k+1),...at(a,k+1)],3));
        strip.computeVertexNormals();body.push(tint(strip,stain[k]));
      }
    }
    for(let i=0;i<3;i++)panel(pitch/3,.40,x+(i-1)*pitch/3,7.96,z+.018,1);
    for(const y of [7.70,8.19])timber(pitch,.09,.36,x,y,z-.14,ebony);
    // Carved stone courses continue across the front of the raised dais.
    for(let k=0;k<3;k++)panel(pitch/3,.58,x+(k-1)*pitch/3,.34,-2.96,4);
  }
  // Facing courses are inset into the existing altar apron, keeping the top
  // ledge and carved centre panel. Tall votive lamps stand on the rear dais.
  const votiveBead=new THREE.OctahedronGeometry(.024);
  const stone=OFFERING_STONE,stoneFace=stone.z+stone.d/2+.004;
  for(const side of [-1,0,1]){
    const w=side?stone.wingW:2*stone.wingX-stone.wingW;
    const top=side?stone.wingTop:stone.centreTop,x=side*stone.wingX;
    const blocks=side?4:5;
    for(let n=0;n<blocks;n++){
      const centre=x+w*((n+.5)/blocks-.5);
      panel(w/blocks-.016,top-.12,centre,top*.5-.006,stoneFace,4);
    }
    timber(w,.062,.115,x,top-.034,stoneFace-.048,'#c3b8a4');
    timber(w,.048,.086,x,.040,stoneFace-.033,'#a49b89');
  }
  for(const side of [-1,1]){
    const x=side*MAIN_VOTIVE_LAMPS.x,z=MAIN_VOTIVE_LAMPS.z;
    const profile=MAIN_VOTIVE_LAMPS.profile;
    body.push(tint(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),24).translate(x,0,z),'#a6753d'));
    for(let i=0;i<27;i++){
      const r=.33-i*.0072,y=1.21+i*.111;
      metal.push(new THREE.TorusGeometry(r,.018,5,24).rotateX(Math.PI/2).translate(x,y,z));
      for(let j=0;j<12;j++){
        const a=j*2*Math.PI/12+i*.07;
        glass.push(votiveBead.clone().translate(x+r*Math.sin(a),y+.037,z+r*Math.cos(a)));
      }
    }
  }
  // Gilded door cheeks face inward; the ornament is clear of the opening.
  for(const s of [-1,1]){
    const x=s*(MAIN_PORTAL.halfClear+.025)/MAIN_HALL_SCALE.x,z=(MAIN_PORTAL.wallZ+.17)/MAIN_HALL_SCALE.z;
    for(let j=0;j<6;j++)panel(.50,1.13,x, .65+j*1.13,z-.10,3,-s*Math.PI/2);
    timber(.105,6.90,.11,x,3.43,z+.18,'#ae673a');
    // Carved petals project from the jamb's own face. The stem and leaf
    // shoulders provide real parallax alongside the high resolution field.
    const place=(u:number,v:number,relief:number)=>new THREE.Vector3(x-s*relief,v,z-.10+s*u);
    for(let row=0;row<6;row++){
      const cy=.65+row*1.13;
      const stem=Array.from({length:25},(_,i)=>{
        const t=i/24;
        return place(.16*Math.sin(t*2*Math.PI),cy-.49+t*.98,.015);
      });
      metal.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stem),36,.012,6,false));
      for(let petal=0;petal<8;petal++){
        const angle=petal*Math.PI/4,points:number[]=[];
        const at=(u:number,v:number)=>{
          const reach=.022+.16*v,width=.048*Math.sin(Math.PI*v)*u;
          return place(Math.cos(angle)*reach-Math.sin(angle)*width,
            cy+Math.sin(angle)*reach+Math.cos(angle)*width,
            .017+.033*Math.sin(Math.PI*v)*(1-u*u));
        };
        for(let j=0;j<7;j++)for(const side of [-1,0])
          for(const q of [at(side,j/7),at(side+1,j/7),at(side,(j+1)/7),
            at(side+1,j/7),at(side+1,(j+1)/7),at(side,(j+1)/7)])points.push(q.x,q.y,q.z);
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
        g.computeVertexNormals();g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(points.length/3*2),2));metal.push(g);
      }
    }
  }
  function rod(a:THREE.Vector3,b:THREE.Vector3,r:number){
    const g=new THREE.CylinderGeometry(r,r,a.distanceTo(b),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));
    const m=a.clone().lerp(b,.5);metal.push(g.translate(m.x,m.y,m.z));
  }
  // Brass stems, bowed branches, individually seated opal globes and a pendant.
  // The vertical axis is behind the centre of the ceiling, in front of the altar.
  const lampZ=-.68, crown=h-.22, v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z+lampZ);
  rod(v(0,crown,0),v(0,crown-2.90,0),.033);
  for(const [n,rise,radius] of [[16,.81,1.38],[12,1.48,1.02],[9,2.12,.66],[6,2.62,.34]]){
    const neck=crown-rise-.16;
    metal.push(new THREE.TorusGeometry(.17,.029,6,22).rotateX(Math.PI/2).translate(0,neck,lampZ));
    for(let i=0;i<n;i++){
      const ang=2*Math.PI*i/n+rise, x=radius*Math.cos(ang),z=radius*Math.sin(ang);
      const a=v(0,neck,0),b=v(.67*x,neck-.18,.67*z),c=v(x,neck+.21,z);
      rod(a,b,.018);rod(b,c,.018);
      metal.push(new THREE.CylinderGeometry(.071,.045,.085,8).translate(c.x,c.y,c.z));
      glass.push(new THREE.SphereGeometry(.099,10,8).scale(.94,1.11,.94).translate(c.x,c.y+.119,c.z));
    }
  }
  glass.push(new THREE.SphereGeometry(.15,12,8).translate(0,crown-2.97,lampZ));
  // Low orchid offerings sit on the altar top and along the statue plinths.
  // Curved petals share one mesh batch with the stems, leaves and trays.
  const bloomColors=['#785294','#b09ac9','#a862ae','#806cad'];
  function orchid(x:number,y:number,z:number,n:number){
    const bend=Math.sin(n*2.399);
    const tip=new THREE.Vector3(x+.08*bend,y+.16+.05*Math.cos(n),z+.03*bend);
    const stem=new THREE.CylinderGeometry(.007,.011,tip.y-y,5);
    body.push(tint(stem.translate(tip.x,y+(tip.y-y)*.5,tip.z),'#546342'));
    for(let i=0;i<5;i++){
      const a=i*2*Math.PI/5+.68*bend;
      const g=new THREE.SphereGeometry(1,8,5).scale(.030,.052,.012);
      g.rotateX(-.5).rotateZ(-a).translate(tip.x+.034*Math.sin(a),tip.y+.03*Math.cos(a),tip.z);
      body.push(tint(g,bloomColors[(i+n)%4]));
    }
    body.push(tint(new THREE.SphereGeometry(.017,6,4).translate(tip.x,tip.y,tip.z+.014),'#e5bb76'));
    const leaf=new THREE.SphereGeometry(1,6,4).scale(.028,.11,.012).rotateZ(bend*1.1);
    body.push(tint(leaf.translate(x,y+.075,z),'#43583a'));
  }
  // Two staggered groups of offerings leave the seat fascias and outer stone exposed.
  function flowerTray(x:number,y:number,z:number,w:number,seed:number){
    body.push(tint(new THREE.CylinderGeometry(1,.86,.072,28).scale(w/2,1,.18)
      .translate(x,y+.036,z),'#645241'));
    for(let i=0;i<15;i++){
      const u=i/14,angle=i*2.39996+seed;
      orchid(x+(u-.5)*w*.91,y+.077+.038*Math.sin(Math.PI*u),z+.107*Math.sin(angle),seed+i);
    }
  }
  for(const side of [-1,1]){
    flowerTray(side*2.95,stone.wingTop,stone.z+.10,.93,side<0?13:37);
    flowerTray(side*.99,stone.centreTop,stone.z+.34,1.48,side<0?49:65);
  }
  // Candle feet sit on the stone; their height steps back from the flowers and cups.
  for(const x of [-5.55,-2.68,2.68,5.55]){
    const y=stone.wingTop,z=stone.z-.24;
    metal.push(new THREE.CylinderGeometry(.086,.153,.075,20).translate(x,y+.0375,z));
    metal.push(new THREE.CylinderGeometry(.052,.076,.16,16).translate(x,y+.155,z));
    metal.push(new THREE.CylinderGeometry(.117,.057,.063,20).translate(x,y+.2665,z));
    body.push(tint(new THREE.CylinderGeometry(.063,.073,.86,18).translate(x,y+.728,z),'#a53228'));
    glass.push(new THREE.SphereGeometry(.03,8,6).scale(.67,1.66,.67).translate(x,y+1.195,z));
  }
  function batch(parts:THREE.BufferGeometry[],mat:THREE.Material,name:string){
    const mesh=new THREE.Mesh(merge(parts),mat);mesh.receiveShadow=true;mesh.name=name;group.add(mesh);
  }
  batch(painted,new THREE.MeshStandardMaterial({name:'hall-sanctum-painted-carving',map:atlas,vertexColors:true,
    side:THREE.DoubleSide,bumpMap:atlas,bumpScale:.0028,roughness:.81}),'hall-painted-ceiling-and-niches');
  batch(body,new THREE.MeshStandardMaterial({vertexColors:true,name:'hall-sanctum-woodwork',side:THREE.DoubleSide,roughness:.68}),'hall-sanctum-mouldings');
  batch(metal,new THREE.MeshStandardMaterial({name:'hall-sanctum-lamp-brass',color:0xba9c68,metalness:.68,roughness:.32}),'hall-pendant-brass');
  batch(glass,new THREE.MeshStandardMaterial({name:'hall-opal-globes',color:0xfff3d9,emissive:0xffe9bf,emissiveIntensity:1.45,roughness:.32}),'hall-pendant-globes');
  return group;
}

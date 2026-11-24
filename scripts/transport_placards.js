import * as THREE from 'three';

export function orientTransportPlacard(geometry) {
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),normal=new THREE.Vector3(),uAxis=new THREE.Vector3(),right=new THREE.Vector3();
  for(let i=0;i<p.count;i+=3){
    a.set(-(p.getX(i+1)-p.getX(i)),p.getY(i+1)-p.getY(i),p.getZ(i+1)-p.getZ(i));
    b.set(-(p.getX(i+2)-p.getX(i)),p.getY(i+2)-p.getY(i),p.getZ(i+2)-p.getZ(i));
    normal.crossVectors(a,b).normalize();
    const du1=uv.getX(i+1)-uv.getX(i),du2=uv.getX(i+2)-uv.getX(i),dv1=uv.getY(i+1)-uv.getY(i),dv2=uv.getY(i+2)-uv.getY(i);
    const det=du1*dv2-du2*dv1;if(Math.abs(det)<1e-8)continue;
    uAxis.copy(a).multiplyScalar(dv2/det).addScaledVector(b,-dv1/det);right.set(normal.z,0,-normal.x);
    if(uAxis.dot(right)<0)for(let j=i;j<i+3;j++)uv.setX(j,1-uv.getX(j));
  }
  uv.needsUpdate=true;
}

// Original shipboard artwork. Shared canvas signs replace soft game adverts
// with functional cargo handling information at the same existing locations.
export function transportPlacard(name) {
  const cargo=name.endsWith('232'),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const c=canvas.getContext('2d');
  c.fillStyle=cargo?'#d2c9aa':'#546964';c.fillRect(0,0,1024,512);
  c.fillStyle='#303f3e';c.fillRect(0,0,1024,26);c.fillRect(0,486,1024,26);
  c.strokeStyle=cargo?'#6c7061':'#aebba7';c.lineWidth=4;c.strokeRect(27,44,970,424);
  c.fillStyle=cargo?'#384947':'#e0ddc6';
  c.font='bold 30px sans-serif';c.fillText('HARBOUR 04  /  CARGO OPERATIONS',56,95);
  c.font='bold 100px sans-serif';c.fillText(cargo?'WORKING PORT':'SAFETY FIRST',53,214);
  c.fillRect(56,243,904,4);
  c.font='bold 32px sans-serif';c.fillText(cargo?'KEEP LIFTING AREA CLEAR':'WEAR HELMET  /  KEEP LANES CLEAR',57,300);
  c.font='24px monospace';c.fillText(cargo?'AUTHORISED CREW ONLY  |  BERTH 04':'REPORT DAMAGE TO DECK OFFICER',57,356);
  c.fillStyle=cargo?'#9a7539':'#ceb46c';c.fillRect(57,393,901,43);
  c.fillStyle='#34423e';c.font='bold 21px monospace';c.fillText('STAY CLEAR OF SUSPENDED LOADS',79,423);
  // Small, bounded weathering follows the edges; letters remain readable.
  let seed=cargo?232:233;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<8500;i++){
    const x=rand()*1024,y=rand()*512;
    if(x>48&&x<975&&y>54&&y<458&&rand()>.055)continue;
    c.fillStyle=rand()>.5?'rgba(42,48,40,.11)':'rgba(237,230,204,.15)';c.fillRect(x,y,1+rand()*3,.6+rand()*2);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.name=cargo?'transport-cargo-placard':'transport-safety-placard';return map;
}

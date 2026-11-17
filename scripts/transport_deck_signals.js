import * as THREE from 'three';

// The imported scanner shares the deck's material batch. Separate only its
// rectangular head; the circular spindle and the deck stay on the static mesh.
export function detachMastScanner(deck) {
  const source=deck.geometry, pos=source.attributes.position;
  const fixed=[],moving=[];
  for(let i=0;i<pos.count;i+=3){
    let head=true;
    for(let j=i;j<i+3;j++) {
      if(pos.getY(j)<18.6 || pos.getZ(j)<44.03)head=false;
    }
    (head?moving:fixed).push(i,i+1,i+2);
  }
  const head=new THREE.BufferGeometry();
  for(const [key,attr] of Object.entries(source.attributes)){
    const values=[];
    for(const i of moving){
      values.push(attr.getX(i),attr.getY(i));
      if(attr.itemSize===3)values.push(attr.getZ(i));
    }
    head.setAttribute(key,new THREE.Float32BufferAttribute(values,attr.itemSize));
  }
  source.setIndex(fixed);
  // Coordinates before the ship group's X reflection.
  const pivot=new THREE.Vector3(7.97,19.23,43.81);
  head.translate(-pivot.x,-pivot.y,-pivot.z);
  const scanner=new THREE.Mesh(head,deck.material);
  scanner.name='transport-mast-scanner';
  scanner.position.copy(pivot);
  scanner.receiveShadow=true;
  scanner.userData.impactSurface=deck.userData.impactSurface;
  deck.add(scanner);
  // The gameplay ray list is flat. Include the moving visible triangles when
  // probing this batch. Keep the rotating hit object for correct world normals.
  const raycast=deck.raycast;
  deck.raycast=function(ray,hits){
    raycast.call(this,ray,hits);
    scanner.updateWorldMatrix(true,false);
    scanner.raycast(ray,hits);
  };
  return scanner;
}

function windsock() {
  const rings=13,sides=16;
  const positions=new THREE.Float32BufferAttribute(new Float32Array(rings*sides*3),3);
  positions.setUsage(THREE.DynamicDrawUsage);
  const indices=[];
  for(let r=0;r<rings-1;r++)for(let j=0;j<sides;j++){
    const a=r*sides+j,b=r*sides+(j+1)%sides;
    indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',positions);
  geo.setIndex(indices);
  const colors=[];
  const rust=new THREE.Color(0xac603d),linen=new THREE.Color(0xc4bca2);
  for(let r=0;r<rings;r++){
    const c=Math.floor(r/3)%2?linen:rust;
    for(let j=0;j<sides;j++)colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const sock=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.96,side:THREE.DoubleSide,envMapIntensity:.42,
  }));
  sock.name='transport-windsock';
  // The rim is rigid. More distant rings lift in sequence and the tapered end
  // lags the mouth during a gust. Grow the bounds once for every wind pose.
  geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(-.8,-.35,0),1.55);
  sock.userData.update=t=>{
    for(let r=0;r<rings;r++){
      const u=r/(rings-1),phase=THREE.MathUtils.euclideanModulo(t-.4*u-.65,17);
      const age=phase<6.8?phase:phase-6.8;
      const gust=THREE.MathUtils.smoothstep(age,0,.65)*(1-THREE.MathUtils.smoothstep(age,.72,2.85))*(phase<6.8?1:.68);
      const radius=.238*(1-.57*u);
      const droop=.74-.55*gust;
      const y=-droop*u*u;
      const z=u*u*(.29*Math.sin(1.9*t-3.6*u)+.11*Math.sin(3.4*t-4*u));
      for(let j=0;j<sides;j++){
        const a=j*2*Math.PI/sides;
        positions.setXYZ(r*sides+j,-(1.76+.12*gust)*u,y+radius*Math.cos(a),z+radius*Math.sin(a));
      }
    }
    positions.needsUpdate=true;geo.computeVertexNormals();
  };
  sock.userData.update(0);
  return sock;
}

export function createHoistSignals() {
  const root=new THREE.Group();
  root.name='transport-hoist-signals';
  const sock=windsock();
  const steel=new THREE.MeshStandardMaterial({color:0x74766c,metalness:.35,roughness:.72});
  const mount=new THREE.Mesh(new THREE.CylinderGeometry(.036,.047,1.22,10),steel);
  mount.position.set(11.27,10.96,9.05);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.238,.017,6,24),steel);
  collar.rotation.y=Math.PI/2;
  collar.position.set(11.27,11.78,9.05);
  sock.position.copy(collar.position);
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.205,.24,.16,16),steel);
  foot.position.set(14.12,10.44,9.05);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.147,.18,.29,24),
    new THREE.MeshStandardMaterial({color:0x985122,emissive:0xffa041,roughness:.40,metalness:.08}));
  lens.name='transport-hoist-beacon';
  lens.position.copy(foot.position);lens.position.y+=.215;
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.14,.16,.045,16),steel);
  cap.position.copy(lens.position);cap.position.y+=.161;
  root.add(mount,collar,sock,foot,lens,cap);
  root.userData.update=t=>{
    sock.userData.update(t);
    lens.material.emissiveIntensity=.14+1.55*Math.max(0,Math.cos(t*1.8))**5;
  };
  return root;
}

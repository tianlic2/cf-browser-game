import * as THREE from 'three';

// The import batches many doors into one mesh, often clipped at occluders.
// Fit hardware to each UV tile, using the actual visible triangles as a mask.
export function createTransportDoorGear(source) {
  const faces=new Map(), geometry=source.geometry;
  const xyz=geometry.attributes.position, uv=geometry.attributes.uv;
  const normal=new THREE.Vector3(), ab=new THREE.Vector3(), ac=new THREE.Vector3();
  for(let i=0;i<xyz.count;i+=3) {
    const p=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(xyz,i+j));
    for(const point of p) point.x=-point.x;
    const tri=[0,1,2].map(j=>new THREE.Vector2().fromBufferAttribute(uv,i+j));
    ab.subVectors(p[1],p[0]);ac.subVectors(p[2],p[0]);
    normal.crossVectors(ab,ac).normalize(); // outward after mirroring the inward-wound BSP faces
    if(Math.abs(normal.y)>.02)continue;
    const d1=tri[1].clone().sub(tri[0]),d2=tri[2].clone().sub(tri[0]);
    const det=d1.cross(d2);
    if(Math.abs(det)<1e-6)continue;
    const u=ab.clone().multiplyScalar(d2.y/det).addScaledVector(ac,-d1.y/det);
    const v=ac.clone().multiplyScalar(d1.x/det).addScaledVector(ab,-d2.x/det);
    if(Math.abs(v.y)<2 || Math.abs(v.y)>4 || u.length()<2.1 || u.length()>4.2)continue;
    const U=Math.floor((tri[0].x+tri[1].x+tri[2].x)/3);
    const V=Math.floor((tri[0].y+tri[1].y+tri[2].y)/3);
    const origin=p[0].clone().addScaledVector(u,U-tri[0].x).addScaledVector(v,V-tri[0].y);
    const key=[origin.x,origin.y,origin.z,normal.x,normal.z].map(a=>Math.round(a*100)).join('/');
    if(!faces.has(key))faces.set(key,{origin,u,v,n:normal.clone(),tris:[]});
    for(const t of tri){t.x-=U;t.y-=V;}
    faces.get(key).tris.push(tri);
  }

  const boxes=[],round=[];
  const metal=new THREE.MeshStandardMaterial({roughness:.65,metalness:.41,envMapIntensity:.55});
  for(const {origin,u,v,n,tris} of faces.values()) {
    function contains(x,y) {
      return tris.some(([a,b,c])=>{
        const edge=(p,q)=>(q.x-p.x)*(y-p.y)-(q.y-p.y)*(x-p.x);
        const s=edge(a,b),t=edge(b,c),r=edge(c,a);
        return (s>=-.0001&&t>=-.0001&&r>=-.0001)||(s<=.0001&&t<=.0001&&r<=.0001);
      });
    }
    function add(batch,x,y,lift,w,h,d,color) {
      const pos=origin.clone().addScaledVector(u,x).addScaledVector(v,y).addScaledVector(n,lift);
      const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(n.x,n.z));
      batch.push([new THREE.Matrix4().compose(pos,rotation,new THREE.Vector3(w,h,d)),color]);
    }
    for(const x of [.14,.425,.575,.86]) {
      // Trim the rod at map cut-outs instead of projecting past an open door.
      let start=-1;
      for(let slice=0;slice<=32;slice++) {
        const visible=slice<32&&contains(x,.05+.9*(slice+.5)/32);
        if(visible&&start<0)start=slice;
        if(!visible&&start>=0) {
          add(round,x,.05+.9*(slice+start)/64,.027,.045,v.length()*.9*(slice-start)/32,.045,0x94958a);
          start=-1;
        }
      }
      for(const y of [.11,.43,.89])if(contains(x,y)) {
        add(boxes,x,y,.022,.116,.13,.045,0x4c5654);
        add(boxes,x,y,.054,.076,.073,.035,0x838782);
      }
      const direction=x<.5?1:-1;
      if(contains(x+.039*direction,.386)){
        add(boxes,x+.039*direction,.386,.058,.25,.04,.042,0x959388);
        add(boxes,x+.071*direction,.386,.053,.06,.085,.055,0x586260);
      }
    }
    for(const x of [.047,.953])for(const y of [.18,.5,.81])if(contains(x,y)) {
      add(boxes,x,y,.022,.22,.085,.042,0x63706e);
      add(round,x,y,.05,.072,.14,.072,0x8c9087);
    }
  }
  const root=new THREE.Group();root.name='transport-door-gear';
  for(const [shape,parts,name] of [[new THREE.BoxGeometry(),boxes,'door-hinges-and-keepers'],
     [new THREE.CylinderGeometry(.5,.5,1,8),round,'door-locking-bars']]) {
    const mesh=new THREE.InstancedMesh(shape,metal,parts.length);
    mesh.name=name;mesh.receiveShadow=true;
    parts.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new THREE.Color(color));});
    mesh.computeBoundingSphere();root.add(mesh);
  }
  return root;
}

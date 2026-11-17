import * as THREE from 'three';

// Cut the source triangles at the four bends in each rib. Interpolate both UV
// sets so the paint, lightmap and silhouette follow the same sheet of steel.
export function splitAt(polygon, u, axis = 3) {
  const low = [], high = [];
  let previous = polygon.at(-1);
  for (const current of polygon) {
    if ((previous[axis] < u && current[axis] > u) || (previous[axis] > u && current[axis] < u)) {
      const t = (u - previous[axis]) / (current[axis] - previous[axis]);
      const edge = previous.map((value, i) => value + (current[i] - value) * t);
      low.push(edge);
      high.push(edge);
    }
    if (current[axis] <= u) low.push(current);
    if (current[axis] >= u) high.push(current);
    previous = current;
  }
  return [low, high];
}

export function formTransportCargoPanel(mesh) {
  const original = mesh.geometry;
  const buffer = original.getAttribute('position').data.array;
  const positions = [], uv = [], lightUv = [];
  const normal = new THREE.Vector3();
  const edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3();
  function emitFace(polygon, formed = true) {
    for (let i = 1; i + 1 < polygon.length; i++) {
      for (const point of [polygon[0], polygon[i], polygon[i + 1]]) {
        const phase = Math.abs(THREE.MathUtils.euclideanModulo(point[3]*16+.5,1)-.5)*2;
        const v = THREE.MathUtils.euclideanModulo(point[4],1);
        const rail = Math.min(1,v/.018,(1-v)/.018);
        const height = formed ? -.025 * rail * (1-THREE.MathUtils.clamp((phase-.28)/.38,0,1)) : 0;
        positions.push(point[0]+normal.x*height,point[1]+normal.y*height,point[2]+normal.z*height);
        uv.push(point[3],point[4]);
        lightUv.push(point[5],point[6]);
      }
    }
  }
  function emit(slice) {
    if(!slice.length) return;
    const min=Math.min(...slice.map(p=>p[4])), max=Math.max(...slice.map(p=>p[4]));
    for(let period=Math.floor(min);period<=Math.floor(max);period++) {
      for(const bend of [0,.018,.982]) {
        const v=period+bend;
        if(v<=min || v>=max) continue;
        const [strip,remainder]=splitAt(slice,v,4);
        emitFace(strip);
        slice=remainder;
      }
    }
    emitFace(slice);
  }
  for (let i=0; i<buffer.length; i+=21) {
    let polygon = [0,7,14].map(start=>Array.from(buffer.subarray(i+start,i+start+7)));
    const [a,b,c] = polygon;
    edge1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
    edge2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);
    normal.crossVectors(edge1,edge2);
    const area = normal.length()*.5;
    normal.normalize();
    // The Source batch also includes horizontal caps, thin reveals and tiny
    // brackets. Reserve formed steel for wall panels with a visible profile.
    if (Math.abs(normal.y)>.75 || area<.14) {
      emitFace(polygon,false);
      continue;
    }
    const min = Math.min(a[3],b[3],c[3]), max = Math.max(a[3],b[3],c[3]);
    for(let period=Math.floor(min*16); period<=Math.floor(max*16); period++) {
      for(const bend of [.14,.33,.67,.86]) {
        const u = (period+bend)/16;
        if(u<=min || u>=max) continue;
        const [slice, remainder] = splitAt(polygon,u);
        emit(slice);
        polygon = remainder;
      }
    }
    emit(polygon);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(lightUv,2));
  geometry.computeVertexNormals();
  useFormedGeometry(mesh, geometry);
}

export function useFormedGeometry(mesh, geometry) {
  const original = mesh.geometry;
  mesh.geometry = geometry;
  // Picking and gameplay still use the imported brush surface.
  const proxy = new THREE.Mesh(original,mesh.material);
  proxy.matrixWorld = mesh.matrixWorld;
  mesh.raycast = (raycaster, intersections) => {
    const start = intersections.length;
    proxy.raycast(raycaster,intersections);
    for(let i=start;i<intersections.length;i++) intersections[i].object=mesh;
  };
}

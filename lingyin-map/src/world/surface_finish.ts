import * as THREE from 'three';

export type SurfaceFinish='stone'|'plaster'|'wood'|'bark';

/** Broad weathering is baked ONCE into existing vertices, not every pixel.
 * This changes neither positions, triangles, collision nor texture count.
 * Fine pores/cracks/grain remain in the shared photographic PBR maps.
 */
export function bakeSurfaceFinish(geometry:THREE.BufferGeometry,kind:SurfaceFinish,baseY?:number) {
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  const original=geometry.getAttribute('color');
  geometry.computeBoundingBox();
  const bottom=baseY??geometry.boundingBox!.min.y;
  const colors=new Uint8Array(position.count*3);
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const broad=.965+.025*Math.sin(x*.37+z*.29)+.01*Math.cos(y*.8+z*.17);
    const foot=1-THREE.MathUtils.smoothstep(y-bottom,.04,kind==='bark'?1.65:1.1);
    const vertical=1-Math.abs(normal?.getY(i)??0);
    const damp=foot*vertical*(kind==='plaster'?.16:kind==='bark'?.20:.11);
    const stain=kind==='bark'?foot*.035:kind==='stone'?foot*.012:0;
    const factors=[broad*(1-damp)-stain,broad*(1-damp),broad*(1-damp)-stain*1.25];
    for(let c=0;c<3;c++) {
      const old=original?(c===0?original.getX(i):c===1?original.getY(i):original.getZ(i)):1;
      colors[i*3+c]=Math.round(THREE.MathUtils.clamp(old*factors[c],0,1)*255);
    }
  }
  geometry.setAttribute('color',new THREE.Uint8BufferAttribute(colors,3,true));
  geometry.userData.surfaceFinish=kind;
  return geometry;
}

import * as THREE from 'three';

// Inventory thumbnails from the actual loaded models. One render per variant,
// using the existing WebGL context; never reparent/dispose a live weapon.
const cache = new Map();
export function weaponPreview(renderer, source, key, environment, compact = false, bind = null) {
  if (!source) return null;
  if (cache.has(key)) return cache.get(key);
  const width=compact?224:512,height=224;
  const stage=new THREE.Scene();stage.environment=environment;
  const model=source.clone(true);
  model.visible=true;
  if(bind){model.position.copy(bind.p);model.quaternion.copy(bind.q);}
  const holder=new THREE.Group();holder.add(model);stage.add(holder);
  const box=new THREE.Box3().setFromObject(holder);
  if(box.isEmpty())return null;
  holder.position.sub(box.getCenter(new THREE.Vector3()));
  stage.add(new THREE.HemisphereLight(0xffffff,0x697778,1.5));
  const light=new THREE.DirectionalLight(0xfff1d7,2.1);light.position.set(2,4,-3);stage.add(light);
  const fill=new THREE.DirectionalLight(0xbadce7,.9);fill.position.set(-3,1,2);stage.add(fill);
  stage.updateMatrixWorld(true);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);
  camera.position.set(3,.4,.65);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const projected=new THREE.Box3(),corner=new THREE.Vector3();
  box.setFromObject(holder);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
    projected.expandByPoint(corner.set(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const half=Math.max((projected.max.y-projected.min.y)/2,(projected.max.x-projected.min.x)/2/(width/height)) * 1.12;
  camera.left=-half*width/height;camera.right=-camera.left;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  const target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true});
  target.texture.colorSpace=THREE.SRGBColorSpace;
  const previous={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new THREE.Vector4()),
    scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),
    color:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear};
  try {
    // setRenderTarget applies its pixel viewport directly; setViewport would
    // multiply by devicePixelRatio again and crop thumbnails on Retina screens.
    renderer.setRenderTarget(target);renderer.setScissorTest(false);
    renderer.setClearColor(0x000000,0);renderer.autoClear=true;renderer.render(stage,camera);
    const pixels=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)return null;
    const output=context.createImageData(width,height);
    for(let y=0;y<height;y++)output.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);
    context.putImageData(output,0,0);
    const url=canvas.toDataURL('image/png');cache.set(key,url);return url;
  } finally {
    renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);
    renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);
    renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.autoClear;
    target.dispose();
  }
}

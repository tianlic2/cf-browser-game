import * as THREE from 'three';

// One small, linear-HDR cache serves whichever horizontal surface the camera
// can actually see. Original BSP proxies keep this pass independent of the
// fine crate/cabinet/fastener geometry used by the main camera.
export function createTransportReflections(proxies,quay,background,environment) {
  const root=new THREE.Group();root.name='transport-wet-reflections';
  const reflected=new THREE.Scene();reflected.add(proxies);
  const mirror=new THREE.PerspectiveCamera(),matrix=new THREE.Matrix4();
  const target=new THREE.WebGLRenderTarget(1024,576,{type:THREE.HalfFloatType,depthBuffer:true,
    minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
  target.texture.name='transport-planar-reflection';target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  reflected.background=background;reflected.environment=environment;
  reflected.fog=new THREE.Fog(0xb4bdc1,42,185);
  reflected.add(new THREE.HemisphereLight(0xccdaea,0x939089,1.25));
  const sun=new THREE.DirectionalLight(0xffe0b8,2.05);sun.position.set(-40.28,27.56,87.28);reflected.add(sun);
  quay.traverse(o=>{if(o.isMesh&&!o.isShaderMaterial&&o.name!=='transport-boiler-vapour'){
    const clone=o.clone(false);clone.matrixAutoUpdate=false;clone.matrix.copy(o.matrixWorld);reflected.add(clone);
  }});
  const actors=new Map(),normal=new THREE.Vector3(0,1,0),clip=new THREE.Plane(),clipVector=new THREE.Vector4(),corner=new THREE.Vector4();
  const eye=new THREE.Vector3(),look=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();
  const oldViewport=new THREE.Vector4(),oldScissor=new THREE.Vector4();
  const lastEye=new THREE.Vector3(Infinity,0,0),lastDirection=new THREE.Vector3();
  const active={value:0},texture={value:target.texture},projection={value:matrix},texel={value:new THREE.Vector2(1/1024,1/576)};
  let last=-Infinity,plane=0,frames=0,calls=0,triangles=0,enabled=true;

  function attach(material,kind) {
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      Object.assign(shader.uniforms,{uHarbourReflection:texture,uHarbourProjection:projection,uHarbourMode:active,uHarbourTexel:texel});
      shader.vertexShader='varying vec3 vHarbourReflectionPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vec4 harbourPosition=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          harbourPosition=instanceMatrix*harbourPosition;
        #endif
        vHarbourReflectionPosition=(modelMatrix*harbourPosition).xyz;`);
      shader.fragmentShader=`varying vec3 vHarbourReflectionPosition;
        uniform sampler2D uHarbourReflection;uniform mat4 uHarbourProjection;
        uniform float uHarbourMode;uniform vec2 uHarbourTexel;\n`+shader.fragmentShader.replace('#include <opaque_fragment>',`
        vec3 harbourNormal=inverseTransformDirection(normal,viewMatrix);
        vec3 harbourEye=normalize(cameraPosition-vHarbourReflectionPosition);
        float harbourFresnel=.02+.98*pow(1.-clamp(dot(harbourNormal,harbourEye),0.,1.),5.);
        vec4 projectedHarbour=uHarbourProjection*vec4(vHarbourReflectionPosition,1.);
        vec2 harbourUv=projectedHarbour.xy/max(.0001,projectedHarbour.w);
        float harbourEdge=min(min(harbourUv.x,harbourUv.y),min(1.-harbourUv.x,1.-harbourUv.y));
        float harbourValid=smoothstep(.005,.045,harbourEdge)*step(.001,projectedHarbour.w)
          *(1.-step(.1,abs(uHarbourMode-${kind==='deck'?'1.':'2.'})));
        harbourUv+=harbourNormal.xz*${kind==='deck'?'.003':'.016'};
        vec2 blur=uHarbourTexel*${kind==='deck'?'4.':'5.'};
        vec3 harbourColour=(texture2D(uHarbourReflection,harbourUv+blur,1.5).rgb+
          texture2D(uHarbourReflection,harbourUv-blur,1.5).rgb)*.5;
        float harbourCoverage=${kind==='deck'?'wetFilm*(1.-smoothstep(.04,.10,abs(vHarbourReflectionPosition.y-.0254)))':'1.'};
        float harbourAmount=harbourValid*harbourCoverage*(${kind==='deck'?'.035+.48':'.08+.50'}*harbourFresnel);
        outgoingLight=mix(outgoingLight,harbourColour,clamp(harbourAmount,0.,.52));
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey=()=>key+'-cached-planar-'+kind+'-1';
  }
  function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
  function capture(renderer,scene,camera,force=false){
    if(!enabled){active.value=0;return;}
    if(!renderer.extensions.has('EXT_color_buffer_float')&&target.texture.type!==THREE.UnsignedByteType)target.texture.type=THREE.UnsignedByteType;
    const width=Math.min(1024,Math.max(256,Math.ceil(renderer.domElement.width*.75/128)*128));
    const height=Math.min(576,Math.max(144,Math.round(width*renderer.domElement.height/renderer.domElement.width/32)*32));
    if(width!==target.width||height!==target.height){target.setSize(width,height);texel.value.set(1/width,1/height);last=-Infinity;}
    const now=performance.now()/1000;camera.getWorldDirection(forward);
    const seaView=camera.position.y>1.6&&((Math.abs(camera.position.x)>12&&Math.abs(forward.x)>.35)||
      (Math.abs(camera.position.z)>30&&forward.z*Math.sign(camera.position.z)>.25));
    const mode=seaView?2:1,y=seaView?-3.42:.0254;
    const changed=mode!==plane||lastEye.distanceToSquared(camera.position)>.04||lastDirection.dot(forward)<.998;
    if(!force&&mode===plane&&now-last<(changed?1/24:1/12))return;
    if(camera.position.y<=y+.08){active.value=0;return;}
    plane=mode;last=now;lastEye.copy(camera.position);lastDirection.copy(forward);
    eye.copy(camera.position);eye.y=2*y-eye.y;
    look.copy(camera.position).add(forward);look.y=2*y-look.y;
    up.copy(camera.up).transformDirection(camera.matrixWorld);up.reflect(normal);
    mirror.position.copy(eye);mirror.up.copy(up);mirror.lookAt(look);mirror.near=camera.near;mirror.far=camera.far;
    mirror.projectionMatrix.copy(camera.projectionMatrix);mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    mirror.updateMatrixWorld(true);
    matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
    // Oblique near plane clips the water/deck itself without adding a clipping
    // shader variant to every animated character and material.
    clip.set(normal,-y-.012).applyMatrix4(mirror.matrixWorldInverse);
    clipVector.set(clip.normal.x,clip.normal.y,clip.normal.z,clip.constant);
    const e=mirror.projectionMatrix.elements;
    corner.set((Math.sign(clipVector.x)+e[8])/e[0],(Math.sign(clipVector.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
    clipVector.multiplyScalar(2/clipVector.dot(corner));
    e[2]=clipVector.x;e[6]=clipVector.y;e[10]=clipVector.z+1;e[14]=clipVector.w;
    mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
    scene.updateMatrixWorld(true);
    for(const clone of actors.values())clone.visible=false;
    scene.traverse(o=>{
      if(!o.isSkinnedMesh||!visible(o))return;
      o.getWorldPosition(eye);if(eye.distanceToSquared(camera.position)>24*24)return;
      let clone=actors.get(o);
      if(!clone){
        // Runtime hit regions keep object references in userData. Construct a
        // render-only skin, avoiding Object3D.copy's JSON userData cloning.
        clone=new THREE.SkinnedMesh(o.geometry,o.material);clone.bindMode=o.bindMode;
        clone.bindMatrix.copy(o.bindMatrix);clone.bindMatrixInverse.copy(o.bindMatrixInverse);
        clone.matrixAutoUpdate=false;clone.frustumCulled=false;reflected.add(clone);actors.set(o,clone);
      }
      clone.matrix.copy(o.matrixWorld);clone.visible=true;clone.skeleton=o.skeleton;
      clone.morphTargetInfluences=o.morphTargetInfluences;
    });
    reflected.backgroundIntensity=scene.backgroundIntensity;
    const previousTarget=renderer.getRenderTarget(),previousTone=renderer.toneMapping,previousAuto=renderer.autoClear;
    const previousClip=renderer.clippingPlanes,previousShadow=renderer.shadowMap.enabled,previousXR=renderer.xr.enabled;
    const previousScissor=renderer.getScissorTest();renderer.getViewport(oldViewport);renderer.getScissor(oldScissor);
    const beforeCalls=renderer.info.render.calls,beforeTriangles=renderer.info.render.triangles;
    try{
      renderer.clippingPlanes=[];renderer.shadowMap.enabled=false;
      renderer.xr.enabled=false;renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;
      renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(reflected,mirror);
      active.value=mode;frames++;calls=renderer.info.render.calls-beforeCalls;triangles=renderer.info.render.triangles-beforeTriangles;
    }finally{
      renderer.setRenderTarget(previousTarget);renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(previousScissor);
      renderer.clippingPlanes=previousClip;renderer.shadowMap.enabled=previousShadow;
      renderer.xr.enabled=previousXR;renderer.autoClear=previousAuto;renderer.toneMapping=previousTone;
    }
  }
  const stats=()=>({frames,mode:active.value,width:target.width,height:target.height,calls,triangles,actors:actors.size,proxies:proxies.children.length,enabled});
  root.userData.capture=capture;root.userData.stats=stats;
  root.userData.setEnabled=value=>{enabled=!!value;if(!enabled)active.value=0;last=-Infinity;};
  return {root,attach,capture,stats,
    prepare(renderer,scene,camera){
      const warm=new THREE.PerspectiveCamera(camera.fov,camera.aspect,camera.near,camera.far);
      warm.position.set(7,1.7,-15);warm.lookAt(7,1.5,-2);warm.updateMatrixWorld(true);
      capture(renderer,scene,warm,true);last=-Infinity;
    },reset(){active.value=0;last=-Infinity;}};
}

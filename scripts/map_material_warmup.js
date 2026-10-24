// A map is temporarily detached ONLY behind its deployment/loading screen.
// Three's compile(root,camera,targetScene) otherwise counts its lights twice.
export async function prepareMapMaterials(map,renderer,camera,scene) {
  if(map.materialProgramsReady||!renderer.compileAsync)return false;
  const root=map.visuals[0],parent=root.parent;
  const index=parent?.children.indexOf(root)??-1;
  parent?.remove(root);
  try {
    await renderer.compileAsync(root,camera,scene);
    map.materialProgramsReady=true;
    return true;
  } finally {
    if(parent) {
      parent.add(root);
      // Keep sibling ordering/editor identity intact, including on failure.
      const restored=parent.children.indexOf(root);
      if(index>=0&&restored!==index) {
        parent.children.splice(restored,1);parent.children.splice(index,0,root);
      }
    }
  }
}

// Prepare every selected-map image, including hidden LODs, while the loading
// screen is still covering the canvas. Compiling shaders does not upload maps.
export async function prepareMapTextures(map,renderer,yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0))) {
  if(map.texturesUploaded||!renderer.initTexture)return 0;
  const textures=new Set();
  map.visuals[0].traverse(object=>{
    const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
    for(const material of materials){
      for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
      for(const uniform of Object.values(material.uniforms||{}))if(uniform?.value?.isTexture)textures.add(uniform.value);
    }
  });
  let count=0;
  for(const texture of textures){renderer.initTexture(texture);if(++count%6===0)await yieldFrame();}
  map.texturesUploaded=true;return count;
}

import * as THREE from 'three';

// Only BSP map textures use this policy. Viewmodel materials/VFX are untouched.
export function configureMapTexture(texture, lightmap = false) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  if (lightmap) {
    // These atlases have one-texel gutters. Whole-atlas mipmaps average unrelated
    // faces together; anisotropic taps extend across their gutters as well.
    // Bilinear base-level sampling keeps baked shadows stable at every distance.
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.anisotropy = 1;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  } else {
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    // WebGLRenderer clamps this to the device's supported maximum.
    texture.anisotropy = 16;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

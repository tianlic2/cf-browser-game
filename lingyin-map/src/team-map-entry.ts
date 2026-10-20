// Export the authored procedural scene as a world kit for the FPS. The source
// showcase keeps its own renderer, camera and post-processing pipeline.
export { ATMO } from './core/atmosphere';
export { Sky, Backdrop } from './core/sky';
export { heightAt, WORLD } from './world/heightfield';
export { Terrain } from './world/terrain';
export { HillsideTrail } from './world/hillside';
export { Temple } from './world/temple';
export { buddhaMaterial, preloadTempleTextures } from './world/materials';
export { preloadTerrainTextures } from './world/terrain_baked';
export { preloadFoliagePhotos } from './world/vegetation';
export { Details } from './world/details';
export { Vegetation } from './world/vegetation';
export { Water } from './world/water';
export { Crag } from './world/crag';
export { Mist } from './world/mist';

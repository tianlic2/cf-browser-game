// Export the authored procedural scene as a world kit for the FPS. The source
// showcase keeps its own renderer, camera and post-processing pipeline.
export { ATMO } from './core/atmosphere';
export { Sky } from './core/sky';
export { heightAt, WORLD } from './world/heightfield';
export { Terrain } from './world/terrain';
export { HillsideTrail } from './world/hillside';
export { LingyinMasterplanBlockout } from './world/masterplan_blockout';
export { createApprovedLingyinLandscape } from './world/game_landscape';
export { Temple } from './world/temple';
export { createMainHallInterior } from './world/main_hall_study';
export { createSmallHallInteriors } from './world/small_hall_interior';
export { mainHallStatueSolids } from './world/static_collision';
export { buddhaMaterial, preloadTempleTextures } from './world/materials';
export { preloadRuntimeTextures } from './world/runtime_textures';
export { preloadTerrainTextures } from './world/terrain_baked';
export { preloadFoliagePhotos } from './world/vegetation';
export { Details } from './world/details';
export { Vegetation } from './world/vegetation';
export { Gate as ForestGate } from './gate-kit/world/gate';
export { Ground as GateGround } from './gate-kit/world/ground';
export { Vegetation as GateFramingTrees } from './gate-kit/world/vegetation';
export { Water } from './world/water';
export { Mist } from './world/mist';

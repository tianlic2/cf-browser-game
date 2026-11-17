// Shared positions for the visual stone screens, collision and minimap.
// The four cross-court screens break the long north/south firing lanes. The
// two side screens are turned through 90 degrees to interrupt lateral fire
// without narrowing the central ceremonial approach or either side-hall door.
// hx/hz are world-space extents, so visuals and gameplay never need a second
// rotation convention.
export const COURT_COVER = Object.freeze([
  { x:-14, z:27, hx:1.15, hz:.34, h:1.10 },
  { x:8, z:28, hx:1.15, hz:.34, h:1.10 },
  { x:-18, z:-11, hx:1.15, hz:.34, h:1.10 },
  { x:14, z:-10, hx:1.15, hz:.34, h:1.10 },
  { x:-20, z:19, hx:.34, hz:1.15, h:1.10 },
  { x:16, z:19, hx:.34, hz:1.15, h:1.10 },
]);

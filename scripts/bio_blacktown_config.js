// Mode-specific dressing for the infection version of Black Town. Coordinates
// are authored against the same 1.2x GoldSrc conversion used by the TDM map.
// Keep prop and AI positions here so collision/navigation tests can validate them
// without loading Three.js or the browser GLTF pipeline.
export const BIO_BLACKTOWN_LAYOUT = Object.freeze({
  powerBox: [-26, -.09143999963998795, -30],
  wrecks: [
    { x: -32, y: 1.3716000318527222, z: 28, yaw: .56, height: 1.82 },
    { x: 18, y: 3.322319984436035, z: 34, yaw: -.42, height: 1.82 },
    { x: 44, y: 3.322319984436035, z: 4, yaw: -1.08, height: 1.82 },
  ],
  holdPoints: [
    [0, -1.554479956626892, -24],
    [4, -1.554479956626892, -28],
    [-28, -.09143999963998795, -24],
    [-24, 1.3716000318527222, 28],
    [24, 3.322319984436035, 16],
    [-26, -.09143999963998795, -30],
    [4, 3.322319984436035, 32],
    [-28, 1.859279990196228, 4],
  ],
});

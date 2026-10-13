// BSP texture coordinates were authored for the unscaled Source geometry.
// When the arena is stretched, keep bricks and floor tiles at their original
// world size by adjusting only the diffuse UVs. Lightmap UVs stay untouched.
export function preservePrisonTexelScale(vertices, horizontalScale, verticalScale) {
  const deltaX = horizontalScale - 1;
  const deltaY = verticalScale - 1;
  const deltaZ = horizontalScale - 1;
  for (let i = 0; i < vertices.length; i += 21) {
    const x0 = vertices[i], y0 = vertices[i + 1], z0 = vertices[i + 2];
    const ax = vertices[i + 7] - x0, ay = vertices[i + 8] - y0, az = vertices[i + 9] - z0;
    const bx = vertices[i + 14] - x0, by = vertices[i + 15] - y0, bz = vertices[i + 16] - z0;
    const aa = ax * ax + ay * ay + az * az;
    const ab = ax * bx + ay * by + az * bz;
    const bb = bx * bx + by * by + bz * bz;
    const determinant = aa * bb - ab * ab;
    if (determinant < 1e-12) continue;
    for (const uvOffset of [3, 4]) {
      const du = vertices[i + 7 + uvOffset] - vertices[i + uvOffset];
      const dv = vertices[i + 14 + uvOffset] - vertices[i + uvOffset];
      const alongA = (du * bb - dv * ab) / determinant;
      const alongB = (dv * aa - du * ab) / determinant;
      const gx = alongA * ax + alongB * bx;
      const gy = alongA * ay + alongB * by;
      const gz = alongA * az + alongB * bz;
      for (let k = 0; k < 3; k++) {
        const j = i + k * 7;
        vertices[j + uvOffset] += gx * deltaX * vertices[j]
          + gy * deltaY * vertices[j + 1] + gz * deltaZ * vertices[j + 2];
      }
    }
  }
  return vertices;
}

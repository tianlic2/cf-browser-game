import * as THREE from 'three';
import { clamp } from '../core/math';
import { heightAt, normalAt, pathDistance, terrainMeshHeightAt, waterEdge, WORLD } from './heightfield';
import { terrainBakedMaterial, terrainColor } from './terrain_baked';

export class Terrain {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;

  constructor(quality = 1) {
    const size = WORLD.size;
    const seg = Math.round(260 * clamp(quality, 0.5, 1));
    const half = size / 2;
    const cols = seg + 1;
    const positions = new Float32Array(cols * cols * 3);
    const uvs = new Float32Array(cols * cols * 2);
    const colors = new Float32Array(cols * cols * 3);
    const indices: number[] = [];
    const step = size / seg;
    for (let j = 0; j < cols; j++) {
      const z = -half + j * step;
      for (let i = 0; i < cols; i++) {
        const x = -half + i * step;
        const y = terrainMeshHeightAt(x, z, step);
        const k = j * cols + i;
        positions[k * 3] = x;
        positions[k * 3 + 1] = y;
        positions[k * 3 + 2] = z;
        uvs[k * 2] = x;
        uvs[k * 2 + 1] = z;
        const n = normalAt(x, z, 1.4);
        const slope = 1 - n[1];
        // cheap concavity AO: compare to the average of a ring
        let ring = 0;
        ring += heightAt(x + 3, z);
        ring += heightAt(x - 3, z);
        ring += heightAt(x, z + 3);
        ring += heightAt(x, z - 3);
        const concavity = clamp((ring / 4 - y) / 3.5, -0.4, 1);
        const path = clamp(pathDistance(x, z) / 6, 0, 1);
        const water = clamp(waterEdge(x, z), -4, 18);
        const ao = clamp(0.35 + slope * 0.9 - concavity * 0.55, 0, 1);
        const color = terrainColor(x, y, z, slope, path, water, ao);
        colors[k * 3] = color[0];
        colors[k * 3 + 1] = color[1];
        colors[k * 3 + 2] = color[2];
      }
    }
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * cols + i;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    this.material = terrainBakedMaterial();
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'terrain';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.group.add(this.mesh);
  }
}

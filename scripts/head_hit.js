import * as THREE from '../vendor/three/build/three.module.js';
import { FOX_MODEL_SCALE } from './fox_dimensions.js';

// The approved Fox headshot volume is deliberately pure geometry: the visible
// hit point must be above the animated horizontal plane and inside a vertical
// cylinder whose horizontal center is offset in the character's local X/Z.
export const FOX_HEAD_PLANE_OFFSET = -.055 * FOX_MODEL_SCALE;
export const FOX_HEAD_RADIUS = .14 * FOX_MODEL_SCALE;
export const FOX_HEAD_CENTER_OFFSET_X = -.01 * FOX_MODEL_SCALE;
export const FOX_HEAD_CENTER_OFFSET_Z = .05 * FOX_MODEL_SCALE;

const bonePosition = new THREE.Vector3();
const cylinderCenter = new THREE.Vector3();
const centerOffset = new THREE.Vector3();
const axisQuaternion = new THREE.Quaternion();

export function isHeadshotIntersection(hit, options = null) {
  const part = hit?.object?.userData?.part;
  if (part !== 'head' && part !== 'body') return false;
  const region = hit.object.userData.headRegion;
  if (!region) return part === 'head'; // Other characters keep their hit map.
  // Use the same world matrix the skinned-mesh raycast used. Updating bones
  // here could compare its hit point against a different animation frame.
  bonePosition.setFromMatrixPosition(region.bone.matrixWorld);
  const worldCutoffY = Number.isFinite(options?.worldCutoffY)
    ? options.worldCutoffY
    : bonePosition.y + FOX_HEAD_PLANE_OFFSET;
  if (hit.point.y < worldCutoffY) return false;
  const radialLimit = Number.isFinite(options?.radialLimit)
    ? options.radialLimit : FOX_HEAD_RADIUS;
  const offsetX = Number.isFinite(options?.centerOffsetX)
    ? options.centerOffsetX : FOX_HEAD_CENTER_OFFSET_X;
  const offsetZ = Number.isFinite(options?.centerOffsetZ)
    ? options.centerOffsetZ : FOX_HEAD_CENTER_OFFSET_Z;
  centerOffset.set(offsetX, 0, offsetZ);
  if (region.axisRoot) {
    region.axisRoot.getWorldQuaternion(axisQuaternion);
    centerOffset.applyQuaternion(axisQuaternion);
    // The offset follows character facing, while the cylinder remains upright
    // even when an authored animation tilts the head.
    centerOffset.y = 0;
  }
  cylinderCenter.copy(bonePosition).add(centerOffset);
  const dx = hit.point.x - cylinderCenter.x;
  const dz = hit.point.z - cylinderCenter.z;
  return dx * dx + dz * dz <= radialLimit * radialLimit;
}

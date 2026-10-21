import * as THREE from 'three';

// Aerial perspective is applied once in the grade pass from the scene depth buffer.
// Keeping it out of the materials means every object — including custom shaders — gets
// the same valley haze, and the fog can be tuned without recompiling a single material.
export const ATMO = {
  sunDir: { value: new THREE.Vector3(0.55, 0.3, -0.78).normalize() },
  sunColor: { value: new THREE.Color(1.0, 0.82, 0.62) },
  hazeColor: { value: new THREE.Color(0.18, 0.235, 0.28) },
  mistColor: { value: new THREE.Color(0.30, 0.36, 0.35) },
  sunIrr: { value: new THREE.Vector3(4.2, 3.4, 2.6) },
  hazeDensity: { value: 0.0008 },
  hazeHeight: { value: 62.0 },
  mistDensity: { value: 0.0026 },
  mistHeight: { value: 20.0 },
  hazeFar: { value: 0.000011 },
  time: { value: 0 },
};

export const ATMO_FOG_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHazeColor;
uniform vec3 uMistColor;
uniform float uHazeDensity;
uniform float uHazeHeight;
uniform float uMistDensity;
uniform float uMistHeight;
uniform float uHazeFar;
uniform float uTime;

float atmoHG(float mu, float g){
  float g2 = g * g;
  return (1.0 - g2) / (12.5663706 * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}
// optical depth of an exponential height layer along a ray
float atmoOD(float y0, float dy, float dist, float dens, float H){
  float a = dens * exp(clamp(-y0 / H, -40.0, 40.0));
  float k = dy * dist / H;
  float f = abs(k) > 1e-3 ? (1.0 - exp(-clamp(k, -40.0, 40.0))) / k : 1.0 - 0.5 * k;
  return a * dist * f;
}
vec3 atmoApply(vec3 col, vec3 camPos, vec3 wp){
  vec3 V = wp - camPos;
  float dist = length(V);
  if (dist < 0.01) return col;
  vec3 dir = V / dist;
  float odH = atmoOD(camPos.y, dir.y, dist, uHazeDensity, uHazeHeight);
  float odM = atmoOD(camPos.y, dir.y, dist, uMistDensity, uMistHeight);
  odH += uHazeFar * dist * dist;
  vec3 TH = exp(-odH * vec3(0.85, 1.0, 1.18));
  float TM = exp(-odM);
  float mu = dot(dir, uSunDir);
  float phase = atmoHG(mu, 0.72) * 12.5663706;
  vec3 hz = uHazeColor + uSunColor * (0.22 * phase);
  vec3 mz = uMistColor + uSunColor * (0.10 * (atmoHG(mu, 0.45) * 12.5663706));
  // warm sun-side tint low in the valley, cool shade away from it
  hz = mix(hz, hz * vec3(1.06, 1.0, 0.92), smoothstep(0.0, 0.5, mu));
  col = col * TH + hz * (1.0 - TH);
  col = col * TM + mz * (1.0 - TM);
  return col;
}
`;

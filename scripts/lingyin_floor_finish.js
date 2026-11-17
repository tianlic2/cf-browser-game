import * as THREE from 'three';

const napResponse = `
  vec3 pile = texture2D(uHallSurface, vMapUv).rgb;
  float traffic = pile.r;
  float lean = 2. * pile.g - 1.;
  float tufts = 2. * pile.b - 1.;
  vec2 eye = cameraPosition.xz - vDoorLightPosition.xz;
  float alongPile = eye.y / max(length(eye), .01);
  float grazing = 1. - clamp(dot(normalize(vViewPosition), normal), 0., 1.);
  float body = smoothstep(.14, .19, min(vMapUv.x, 1. - vMapUv.x));
  // Reversing the line of sight changes the broad response of brushed yarn.
  // Individual tufts average away through mipmaps before they become speckles.
  float backscatter = lean * alongPile * (.35 + .65 * grazing);
  float shade = traffic * (-.085 + .34 * backscatter) + body * (.065 + .04 * traffic) * tufts;
  diffuseColor.rgb *= (1. + shade) * mix(vec3(1.), vec3(1.035,.97,.945), traffic);
  diffuseColor.rgb *= mix(vec3(.78,.78,.76), vec3(.99,.95,.93), grazing*grazing);
  roughnessFactor = mix(roughnessFactor, .74 + .04 * lean, traffic);
  vec3 napAxis = mat3(viewMatrix) * vec3(.22*tufts, 0., 1.);
  normal = normalize(normal + napAxis * body * (traffic * (.061 + .10 * lean) + .038 * tufts));
`;

const stoneResponse = `
  vec3 stone = texture2D(uHallSurface, vMapUv).rgb;
  vec2 p = vDoorLightPosition.xz - uRunnerCenter;
  float drift = .28 * sin(.77*p.y) + .12 * sin(1.41*p.y+.83*p.x);
  float fromEdge = abs(p.x) - uRunnerHalf.x;
  float aisle = 1. - smoothstep(.42, 2.35, abs(fromEdge - 1.10 - drift));
  aisle *= 1. - smoothstep(uRunnerHalf.y - .8, uRunnerHalf.y + 1.8, abs(p.y));
  float grain = 2.*stone.b-1.;
  float polished = aisle * stone.g * (.83 + .16*grain);
  diffuseColor.rgb *= mix(vec3(1.), vec3(.79,.83,.86), polished);
  roughnessFactor = mix(roughnessFactor, .62 + .07*(1.-stone.g), polished);
  normal = normalize(mix(normal,nonPerturbedNormal,.55*polished));
`;

// Attach after doorway/window lighting, before Three constructs its physical
// material. Both use the standard material's existing map coordinates. The
// stone controls follow the exact repeat and orientation of the photograph.
export async function finishHallFloor(world) {
  const carpet = world.getObjectByName('hall-processional-carpet');
  const floor = world.getObjectByName('hall-stone-floor');
  const bounds = new THREE.Box3().setFromObject(carpet);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const loader = new THREE.TextureLoader();
  await Promise.all([
    [carpet.material, 'carpet-nap', napResponse],
    [floor.material, 'flagstone-surface', stoneResponse],
  ].map(async ([mat, name, response]) => {
    const controls = await loader.loadAsync(new URL('../assets/lingyin/hall-preview/' + name + '.webp', import.meta.url).href);
    controls.name = name;
    controls.wrapS = mat.map.wrapS;
    controls.wrapT = mat.map.wrapT;
    controls.anisotropy = mat.map.anisotropy;
    if (mat === floor.material) {
      controls.repeat.copy(mat.map.repeat);
      mat.bumpMap = controls;
      mat.bumpScale = .019;
    }
    const compile = mat.onBeforeCompile, key = mat.customProgramCacheKey();
    mat.onBeforeCompile = function(shader, renderer) {
      compile.call(this, shader, renderer);
      shader.uniforms.uHallSurface = { value: controls };
      let declarations = 'uniform sampler2D uHallSurface;\n';
      if (mat === floor.material) {
        declarations += 'uniform vec2 uRunnerCenter, uRunnerHalf;\n';
        shader.uniforms.uRunnerCenter = { value: new THREE.Vector2(center.x,center.z) };
        shader.uniforms.uRunnerHalf = { value: new THREE.Vector2(size.x*.5,size.z*.5) };
      }
      shader.fragmentShader = declarations + shader.fragmentShader.replace('#include <lights_physical_fragment>',
        response + '\n#include <lights_physical_fragment>');
    };
    mat.customProgramCacheKey = () => key + '-' + name;
  }));
}

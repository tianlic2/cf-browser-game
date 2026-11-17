// Only the reviewed BaiHu is admitted. The other candidate assets/catalog are
// never imported by the game. Local-only files deliberately stay gitignored.
export const SCAR_LIGHT_BASE = './assets/local/scar_light/';
export const SCAR_LIGHT_SELECT_DURATION = 20 / 30;
export const SCAR_LIGHT_RELOAD_DURATION = 53 / 22;
export const SCAR_LIGHT_FIRE_CLIPS = Object.freeze(['prefire', 'sequence_4', 'sequence_5']);

function addScopeLensFade(material) {
  const fade = { value: 0 };
  const previous = material.onBeforeCompile;
  material.transparent = true;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.scarScopeLensFade = fade;
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {', 'uniform float scarScopeLensFade;\nvoid main() {');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      #ifdef USE_MAP
        // tex2/tex3 share the authored cyan sight pane in this UV island.
        // Fade only that pane; the white/gold housing and blue side lamps stay intact.
        float scarLensUv = step(vMapUv.x, 0.14)
          * step(0.40, vMapUv.y) * step(vMapUv.y, 0.60);
        float scarLensCyan = step(sampledDiffuseColor.r, 0.46)
          * step(0.54, sampledDiffuseColor.g) * step(0.54, sampledDiffuseColor.b);
        diffuseColor.a *= 1.0 - scarScopeLensFade * scarLensUv * scarLensCyan;
        if (diffuseColor.a < 0.003) discard;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'scar-scope-lens-fade-1';
  material.userData.scarScopeLensFade = fade;
  material.needsUpdate = true;
  return fade;
}

export async function loadScarLightView() {
  const [{ClassicView}, THREE] = await Promise.all([
    import('./classic_view.js?v=scar-scope-smooth-1'), import('three'),
  ]);
  const base = new URL('../assets/local/scar_light/', import.meta.url);
  const url = name => new URL(name + '?v=baihu-game-1', base).href;
  const get = async name => {
    const r = await fetch(url(name));
    if (!r.ok) throw Error('白虎资源加载失败：' + name);
    return name.endsWith('.json') ? r.json() : r.arrayBuffer();
  };
  const data = await get('view.json');
  if (data.uvConvention !== 'classic-smd-v') throw Error('白虎贴图映射版本错误');
  const loader = new THREE.TextureLoader();
  const [bytes, textures] = await Promise.all([
    get('view.bin'), Promise.all(data.parts.map(async p => ({map: await loader.loadAsync(url(p.map))}))),
  ]);
  // Preserve the reviewed complete hand/sleeve rig; no procedural sleeve patch.
  const view = new ClassicView(data, bytes, textures, false);
  view.root.name = 'scar-light-baihu-first-person';
  // The opaque gun sheet and its additive overlay both contain the cyan pane.
  // Drive them with one 0..1 fade so the real model lens becomes fully clear
  // during ADS while every non-lens pixel keeps the reviewed source material.
  const lensFades = [2, 3].map(index => view.partMeshes[index]?.material)
    .filter(Boolean).map(addScopeLensFade);
  view.setScopeLensFade = value => {
    const safe = Math.max(0, Math.min(1, Number(value) || 0));
    for (const uniform of lensFades) uniform.value = safe;
  };
  view.scopeLensFade = () => lensFades[0]?.value || 0;
  return view;
}

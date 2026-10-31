// Only the reviewed BaiHu is admitted. The other candidate assets/catalog are
// never imported by the game. Local-only files deliberately stay gitignored.
export const SCAR_LIGHT_BASE = './assets/local/scar_light/';
export const SCAR_LIGHT_SELECT_DURATION = 20 / 30;
export const SCAR_LIGHT_RELOAD_DURATION = 53 / 22;
export const SCAR_LIGHT_FIRE_CLIPS = Object.freeze(['prefire', 'sequence_4', 'sequence_5']);

export async function loadScarLightView() {
  const [{ClassicView}, THREE] = await Promise.all([
    import('./classic_view.js?v=kukri-hand-material-2'), import('three'),
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
  return view;
}

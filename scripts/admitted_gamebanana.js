// User-approved local gameplay imports. Assets remain gitignored because their
// CC BY-NC-ND / original-game rights do not permit public redistribution here.
export const ADMITTED_GAMEBANANA = Object.freeze({
  kn57: Object.freeze({
    base: './assets/local/kn57/', selectDuration: 37/42, reloadDuration: 91/37,
    fireClips: Object.freeze(['shoot1','shoot2','shoot3']),
  }),
  m200: Object.freeze({
    base: './assets/local/m200/', selectDuration: .84, reloadDuration: 2.19,
    fireClips: Object.freeze(['fire']),
  }),
  akgold: Object.freeze({
    base: './assets/local/akgold/', selectDuration: 34 / 38, reloadDuration: 34 / 13,
    fireClips: Object.freeze(['shoot1', 'shoot2', 'shoot3']),
  }),
});

export async function loadAdmittedGameBananaView(id) {
  const spec = ADMITTED_GAMEBANANA[id];
  if (!spec) throw Error('未知的本地枪械：' + id);
  const [{ ClassicView }, THREE] = await Promise.all([
    import('./classic_view.js?v=kn57-source-4'), import('three'),
  ]);
  const base = new URL('../' + spec.base.replace(/^\.\//, ''), import.meta.url);
  const url = name => new URL(name + '?v=kn57-source-4', base).href;
  const get = async name => {
    const response = await fetch(url(name));
    if (!response.ok) throw Error(`${id} 资源加载失败：${name}`);
    return name.endsWith('.json') ? response.json() : response.arrayBuffer();
  };
  const data = await get('view.json');
  if (!['classic-smd-v','source-vtf'].includes(data.uvConvention)) throw Error(`${id} 贴图映射版本错误`);
  const loader = new THREE.TextureLoader();
  const textureCache = new Map();
  const loadTexture = name => {
    if (!textureCache.has(name)) textureCache.set(name, loader.loadAsync(url(name)));
    return textureCache.get(name);
  };
  const [bytes, textures] = await Promise.all([
    get('view.bin'),
    Promise.all(data.parts.map(async part => ({ map: await loadTexture(part.map), normalMap: part.normalMap ? await loadTexture(part.normalMap) : null, emissiveMap: part.emissiveMap ? await loadTexture(part.emissiveMap) : null, roughnessMap: part.roughnessMap ? await loadTexture(part.roughnessMap) : null, specularIntensityMap: part.specularIntensityMap ? await loadTexture(part.specularIntensityMap) : null, phongMap: part.phongMap ? await loadTexture(part.phongMap) : null }))),
  ]);
  const view = new ClassicView(data, bytes, textures, false);
  view.root.name = `${id}-first-person`;
  return view;
}

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Temple } from './world/temple';
import { buddhaMaterial, preloadMainHallTextures } from './world/materials';
import { createMainHallInterior } from './world/main_hall_study';
import { WORLD } from './world/heightfield';

const canvas = document.querySelector<HTMLCanvasElement>('#hall-canvas')!;
const status = document.querySelector<HTMLElement>('#hall-status')!;
const metrics = document.querySelector<HTMLElement>('#hall-metrics')!;
const studyToggle = document.querySelector<HTMLInputElement>('#study-toggle')!;
if (!canvas || !status || !metrics || !studyToggle)
  throw new Error('Main hall preview controls are missing');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9bacae');
scene.fog = new THREE.Fog('#9bacae', 45, 100);
const camera = new THREE.PerspectiveCamera(72, 1, .06, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.minDistance = .5;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * .94;
let renderScheduled = false;
function requestRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    controls.update();
    renderer.render(scene, camera);
    metrics.textContent = `${renderer.info.render.calls} draw calls · ${Math.round(renderer.info.render.triangles / 1000)}k triangles`;
  });
}
// The review scene is static. Redraw while orbiting or after a UI change,
// instead of running the full render loop continuously in an idle tab.
controls.addEventListener('change', requestRender);

scene.add(new THREE.HemisphereLight(0xd9e7ed, 0x66513c, 1.55));
const sun = new THREE.DirectionalLight(0xffebc8, 2.15);
sun.position.set(-12, 28, 19);
scene.add(sun);
const courtyard = new THREE.Mesh(
  new THREE.PlaneGeometry(58, 90),
  new THREE.MeshStandardMaterial({ color: '#77756d', roughness: .96 }),
);
courtyard.rotation.x = -Math.PI / 2;
courtyard.position.set(-2, WORLD.platform.y - .18, 12);
courtyard.name = 'preview-only-ground';
scene.add(courtyard);

const presets: Record<string, { position: [number, number, number]; target: [number, number, number]; fov?: number }> = {
  exterior: { position: [-2, 9.5, 19.5], target: [-2, 11.8, -12], fov: 50 },
  front: { position: [-2, 6.15, -5.5], target: [-2, 7.9, -14.5] },
  entrance: { position: [-9.1, 6.15, -5.75], target: [-2, 7.7, -14.5] },
  side: { position: [6.8, 6.35, -8.8], target: [-2, 7.7, -14.5] },
  ceiling: { position: [-5.1, 6.55, -8.25], target: [-2, 11.7, -12] },
};
function setView(name: string) {
  const view = presets[name];
  if (!view) return;
  camera.position.set(...view.position);
  camera.fov = view.fov ?? 72;
  camera.updateProjectionMatrix();
  controls.target.set(...view.target);
  controls.update();
  requestRender();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))
    button.setAttribute('aria-pressed', String(button.dataset.view === name));
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]'))
  button.addEventListener('click', () => setView(button.dataset.view || 'front'));
setView('exterior');

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(canvas);
resize();

async function load() {
  status.textContent = '正在载入大殿贴图…';
  await preloadMainHallTextures();
  status.textContent = '正在载入彩绘与佛像…';
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('./vendor/three/examples/jsm/libs/draco/', document.baseURI).href);
  const gltf = new GLTFLoader().setDRACOLoader(draco);
  const imageLoader = new THREE.TextureLoader();
  const [scan, sideScan, coffer, paintedBeam, redLacquer, stoneFloor, carvedAltar, redRoof] = await Promise.all([
    gltf.loadAsync(new URL('./assets/lingyin/buddha-clay-scan.glb', document.baseURI).href),
    gltf.loadAsync(new URL('./assets/lingyin/buddha-clay-scan-lod.glb', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/dragon-coffer.webp', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/painted-beam.webp', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/worn-red-lacquer.webp', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/aged-stone-floor.webp', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/carved-altar.webp', document.baseURI).href),
    imageLoader.loadAsync(new URL('./assets/lingyin/hall-preview/red-ceramic-roof.webp', document.baseURI).href),
  ]);
  draco.dispose();
  for (const texture of [coffer, paintedBeam, redLacquer, stoneFloor, carvedAltar, redRoof]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
  }
  redLacquer.wrapS = redLacquer.wrapT = THREE.RepeatWrapping;
  redRoof.wrapS = redRoof.wrapT = THREE.RepeatWrapping;
  redRoof.repeat.set(.2, .2);
  redRoof.needsUpdate = true;
  status.textContent = '正在构建三佛殿内空间…';
  const temple = new Temple({ onlyMainHall: true, omitMainHallShrine: true,
    studyHallEave: 11, studyFacade: true });
  scene.add(temple.group);
  const study = createMainHallInterior(temple, {
    coffer, paintedBeam, redLacquer, stoneFloor, carvedAltar, redRoof,
    buddhaScan: scan.scene, buddhaSideLod: sideScan.scene,
  });
  temple.group.add(study);
  let original: THREE.Group | null = null;
  async function showOriginal() {
    if (!original) {
      status.textContent = '正在载入原版供对照…';
      const mural = await imageLoader.loadAsync(
        new URL('./assets/lingyin/lotus-mural.jpg', document.baseURI).href);
      mural.colorSpace = THREE.SRGBColorSpace;
      const group = new THREE.Group();
      group.name = 'main-hall-original-comparison';
      group.add(new Temple({ onlyMainHall: true }).group);
      const statue = new THREE.Group();
      statue.position.set(-2, WORLD.platform.y + 1.78, -10.85);
      const sourceFigure = scan.scene.clone(true);
      sourceFigure.rotation.x = Math.PI / 2;
      sourceFigure.scale.setScalar(.027);
      sourceFigure.position.set(-1.607, 0, -.413);
      sourceFigure.traverse(object => {
        if (object instanceof THREE.Mesh) object.material = buddhaMaterial();
      });
      statue.add(sourceFigure);
      group.add(statue);
      const painting = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4.2),
        new THREE.MeshStandardMaterial({ map: mural, roughness: .91 }));
      painting.position.set(-2, WORLD.platform.y + 4.1, -11.28);
      group.add(painting);
      const light = new THREE.PointLight(0xffd39a, 14, 10, 2);
      light.position.set(-5, WORLD.platform.y + 4.7, -6);
      group.add(light);
      original = group;
      scene.add(group);
    }
    temple.group.visible = false;
    original.visible = true;
    status.textContent = '正在查看旧版 · 勾选开关返回重做版';
    requestRender();
  }
  studyToggle.addEventListener('change', () => {
    if (studyToggle.checked) {
      if (original) original.visible = false;
      temple.group.visible = true;
      status.textContent = '正在查看三佛殿重做版';
      requestRender();
    } else {
      showOriginal().catch(error => {
        console.error(error);
        status.textContent = '原版对照载入失败';
      });
    }
  });
  status.textContent = '三佛殿已载入 · 拖动旋转、滚轮缩放，切换机位检查细节';
  document.body.classList.add('hall-ready');
  requestRender();
}
load().catch(error => {
  console.error('Main hall preview failed', error);
  status.textContent = `预览载入失败：${error instanceof Error ? error.message : String(error)}`;
});

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ATMO } from './core/atmosphere';
import { PostFX } from './core/post';
import { Sky, Backdrop } from './core/sky';
import { clamp, easeInOut } from './core/math';
import { SHOTS } from './data/shots';
import { Crag } from './world/crag';
import { Details } from './world/details';
import { HillsideTrail } from './world/hillside';
import { Mist } from './world/mist';
import { Temple } from './world/temple';
import { Terrain } from './world/terrain';
import { Vegetation } from './world/vegetation';
import { Water } from './world/water';
import { Hud } from './ui/hud';

type CamAnim = {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  fromFov: number;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  toFov: number;
  t: number;
  dur: number;
};

function dirFromAzEl(azDeg: number, elDeg: number) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
}

export class App {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private post!: PostFX;
  private sky: Sky;
  private backdrop: Backdrop;
  private terrain: Terrain;
  private hillside: HillsideTrail;
  private water: Water;
  private crag: Crag;
  private temple: Temple;
  private vegetation: Vegetation;
  private details: Details;
  private mist: Mist;
  private sun: THREE.DirectionalLight;
  private hud: Hud;
  private clock = new THREE.Clock();
  private time = 0;
  private frame = 0;
  private shotIndex = 0;
  private anim: CamAnim | null = null;
  private tour = false;
  private tourTimer = 0;
  private paused = false;
  private needsReset = true;
  private maxSamples = 48;
  private quality = 0;
  private disposed = false;
  private loaded = false;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = this.currentDpr();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      stencil: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.25, 2400);
    const shot = SHOTS[0];
    this.camera.position.set(...shot.pos);
    this.camera.fov = shot.fov;
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...shot.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 260;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.53;
    this.controls.update();

    // ---- lighting
    const sunDir = dirFromAzEl(98, 9.5);
    ATMO.sunDir.value.copy(sunDir);
    ATMO.sunColor.value.setRGB(1.0, 0.66, 0.42);
    ATMO.sunIrr.value.set(4.4, 3.4, 2.5);
    ATMO.hazeColor.value.setRGB(0.18, 0.235, 0.28);
    ATMO.mistColor.value.setRGB(0.30, 0.36, 0.35);

    this.sun = new THREE.DirectionalLight(0xffb277, 4.6);
    this.sun.position.copy(sunDir).multiplyScalar(280);
    this.sun.target.position.set(0, 6, 0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.near = 20;
    this.sun.shadow.camera.far = 680;
    this.sun.shadow.camera.left = -180;
    this.sun.shadow.camera.right = 180;
    this.sun.shadow.camera.top = 180;
    this.sun.shadow.camera.bottom = -180;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.normalBias = 0.055;
    this.scene.add(this.sun, this.sun.target);

    const hemi = new THREE.HemisphereLight(0x809bb8, 0x2c2a20, 0.34);
    this.scene.add(hemi);
    const fill = new THREE.DirectionalLight(0x8fb2cd, 0.35);
    fill.position.set(-120, 80, -150);
    this.scene.add(fill);
    // ---- sky and world
    this.sky = new Sky();
    this.sky.uniforms.uSunDir = ATMO.sunDir;
    this.scene.add(this.sky.mesh);
    this.backdrop = new Backdrop();
    this.scene.add(this.backdrop.group);
    this.terrain = new Terrain(1);
    this.scene.add(this.terrain.group);
    this.hillside = new HillsideTrail();
    this.scene.add(this.hillside.group);
    this.water = new Water();
    this.scene.add(this.water.group);
    this.crag = new Crag();
    this.scene.add(this.crag.group);
    this.temple = new Temple();
    this.scene.add(this.temple.group);
    this.vegetation = new Vegetation();
    this.scene.add(this.vegetation.group);
    this.details = new Details();
    this.scene.add(this.details.group);
    this.mist = new Mist(this.details.smokeOrigin);
    this.scene.add(this.mist.group);

    // ---- IBL from the same sky
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    const envSky = this.sky.makeEnvSky();
    envScene.add(envSky);
    const envRT = pmrem.fromScene(envScene, 0.02, 0.1, 100);
    this.scene.environment = envRT.texture;
    this.scene.environmentIntensity = 0.34;
    pmrem.dispose();

    // ---- post
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post = new PostFX(this.renderer, this.scene, this.camera, size.x, size.y);
    this.post.setExposure(1.0);
    this.post.setDepthExclude([this.water.group, this.mist.group]);

    this.hud = new Hud(
      SHOTS,
      (i) => {
        this.setTour(false);
        this.goToShot(i, true);
      },
      () => this.setTour(!this.tour),
      () => this.cycleQuality(),
    );
    this.hud.setActive(0);
    this.hud.setQuality('精細');
    this.hud.setSamples(0, this.maxSamples);

    this.controls.addEventListener('start', () => {
      this.setTour(false);
      this.needsReset = true;
    });
    this.controls.addEventListener('change', () => {
      this.needsReset = true;
    });

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    this.exposeHooks();
    // first frame
    this.applyShotImmediate(0);
    this.needsReset = true;
    requestAnimationFrame(this.animate);
  }

  private currentDpr() {
    const cap = this.quality === 0 ? 1.35 : 0.9;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  private cycleQuality() {
    this.quality = (this.quality + 1) % 2;
    this.maxSamples = this.quality === 0 ? 48 : 16;
    this.hud.setQuality(this.quality === 0 ? '精細' : '流暢');
    this.renderer.setPixelRatio(this.currentDpr());
    this.onResize();
    this.needsReset = true;
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.portraitFov(SHOTS[this.shotIndex]?.fov ?? 42);
    this.camera.updateProjectionMatrix();
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(size.x, size.y);
    this.needsReset = true;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key >= '1' && e.key <= '5') {
      this.setTour(false);
      this.goToShot(Number(e.key) - 1, true);
    }
    if (e.key === 't' || e.key === 'T') this.setTour(!this.tour);
  };

  private portraitFov(fov: number) {
    return fov * (this.camera.aspect < 1 ? 1.28 : 1);
  }

  private applyShotImmediate(i: number) {
    const s = SHOTS[clamp(i, 0, SHOTS.length - 1)];
    this.shotIndex = s.index - 1;
    this.camera.position.set(...s.pos);
    this.camera.fov = this.portraitFov(s.fov);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(...s.target);
    this.controls.update();
    this.camera.updateMatrixWorld(true);
    this.needsReset = true;
    const s0 = SHOTS[this.shotIndex];
    this.water.group.visible = s0.id === 'spring' || s0.id === 'aerial';
    this.hud.setActive(this.shotIndex);
  }

  private goToShot(i: number, animate: boolean) {
    const s = SHOTS[clamp(i, 0, SHOTS.length - 1)];
    this.shotIndex = s.index - 1;
    this.hud.setActive(this.shotIndex);
    if (!animate) {
      this.applyShotImmediate(i);
      return;
    }
    this.anim = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      fromFov: this.camera.fov,
      toPos: new THREE.Vector3(...s.pos),
      toTarget: new THREE.Vector3(...s.target),
      toFov: this.portraitFov(s.fov),
      t: 0,
      dur: 2.1,
    };
    this.controls.enabled = false;
  }

  private setTour(on: boolean) {
    this.tour = on;
    this.tourTimer = 0;
    this.hud.setTour(on);
    if (on) this.goToShot((this.shotIndex + 1) % SHOTS.length, true);
  }

  private updateAnim(dt: number) {
    if (!this.anim) return;
    this.anim.t += dt;
    const u = clamp(this.anim.t / this.anim.dur, 0, 1);
    const e = easeInOut(u);
    this.camera.position.lerpVectors(this.anim.fromPos, this.anim.toPos, e);
    this.controls.target.lerpVectors(this.anim.fromTarget, this.anim.toTarget, e);
    this.camera.fov = this.anim.fromFov + (this.anim.toFov - this.anim.fromFov) * e;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    if (u >= 1) {
      this.anim = null;
      this.controls.enabled = true;
      this.needsReset = true;
    }
  }

  private animate = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.renderer.info.reset();

    if (this.anim) {
      this.updateAnim(dt);
    } else {
      this.controls.update();
    }

    if (!this.paused) {
      if (this.anim || this.tour) this.time += dt;
      if (this.tour && !this.anim) {
        this.tourTimer += dt;
        if (this.tourTimer > 7.5) {
          this.tourTimer = 0;
          this.goToShot((this.shotIndex + 1) % SHOTS.length, true);
        }
      }
    }
    ATMO.time.value = this.time;
    this.mist.update(this.time, this.camera);
    this.water.update(dt);
    this.vegetation.update();

    if (this.needsReset || this.anim) {
      this.post.begin();
      this.needsReset = false;
      this.post.addSample(0);
    } else if (this.post.count < this.maxSamples) {
      this.post.addSample(this.post.count);
    }
    this.post.resolve(this.frame++);
    if (!this.loaded) {
      this.loaded = true;
      this.hud.ready();
    }
    this.hud.setSamples(this.post.count, this.maxSamples);

    const info = this.renderer.info;
    (window as unknown as { __STATS: unknown }).__STATS = {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      samples: this.post.count,
      build: 'procedural',
    };
  };

  private exposeHooks() {
    const w = window as unknown as Record<string, unknown>;
    w.__READY = false;
    const hooks = {
      setState: (name: string) => {
        const idx = SHOTS.findIndex((s) => s.id === name);
        if (idx < 0) throw new Error(`unknown state: ${name}`);
        this.setTour(false);
        this.anim = null;
        this.controls.enabled = true;
        this.applyShotImmediate(idx);
        this.paused = true;
        this.needsReset = true;
        // converge a little before the capture so the screenshot is not a 1-spp frame
        this.post.begin();
        for (let i = 0; i < 8; i++) this.post.addSample(i);
        this.post.resolve(0);
        this.hud.setSamples(this.post.count, this.maxSamples);
        return { state: name };
      },
      setPausedForScreenshot: (p: boolean) => {
        this.paused = p;
        if (!p) this.needsReset = true;
      },
      setShot: (i: number) => {
        this.setTour(false);
        this.goToShot(i, false);
      },
      seed: (_n: number) => true,
    };
    w.__scene = hooks;
    w.__THREE_GAME_TEST_HOOKS__ = hooks;
    w.__SHOTS = SHOTS.map((s) => ({ id: s.id, name: s.name, index: s.index }));
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    w.__GPU_INFO = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    w.__READY = true;
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.controls.dispose();
    this.renderer.dispose();
  }
}

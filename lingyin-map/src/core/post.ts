import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ATMO, ATMO_FOG_GLSL } from './atmosphere';
import { clamp, halton } from './math';

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

function makeRT(w: number, h: number, type: THREE.TextureDataType, depth = false) {
  return new THREE.WebGLRenderTarget(w, h, {
    type,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

export class PostFX {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
  sceneRT: THREE.WebGLRenderTarget;
  private depthRT: THREE.WebGLRenderTarget;
  private depthMat: THREE.ShaderMaterial;
  private depthExclude: THREE.Object3D[] = [];
  private acc: THREE.WebGLRenderTarget[];
  private accIndex = 0;
  count = 0;
  private mips: THREE.WebGLRenderTarget[] = [];
  private quad = new FullScreenQuad();
  private blendMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private gradeMat: THREE.ShaderMaterial;
  private copyMat: THREE.ShaderMaterial;
  private sunScreen = new THREE.Vector2(-10, -10);
  private sunFacing = -1;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, width: number, height: number) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.width = width;
    this.height = height;
    this.sceneRT = makeRT(width, height, THREE.HalfFloatType, true);
    this.depthRT = new THREE.WebGLRenderTarget(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      generateMipmaps: false,
    });
    this.depthMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying float vZ;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z; gl_Position = projectionMatrix * mv; }
      `,
      fragmentShader: /* glsl */ `
        varying float vZ;
        void main(){ gl_FragColor = vec4(vZ, 0.0, 0.0, 1.0); }
      `,
      side: THREE.DoubleSide,
    });
    this.acc = [makeRT(width, height, THREE.HalfFloatType), makeRT(width, height, THREE.HalfFloatType)];

    this.blendMat = new THREE.ShaderMaterial({
      uniforms: { tNew: { value: null }, tPrev: { value: null }, uW: { value: 1 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tNew; uniform sampler2D tPrev; uniform float uW;
        varying vec2 vUv;
        void main(){
          vec4 n = texture2D(tNew, vUv);
          n.rgb = min(n.rgb, vec3(4.0e4));
          vec4 p = texture2D(tPrev, vUv);
          gl_FragColor = mix(p, n, uW);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.copyMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; varying vec2 vUv;
        void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 }, uThreshold: { value: 1.4 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uFirst; uniform float uThreshold;
        varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
        float kw(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
        void main(){
          vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
          vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
          vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
          vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
          vec3 r;
          if (uFirst > 0.5) {
            vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
            float w0 = kw(g0), w1 = kw(g1), w2 = kw(g2), w3 = kw(g3), w4 = kw(g4);
            r = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4 * 4.0) / (w0 + w1 + w2 + w3 + w4 * 4.0);
            float lum = dot(r, vec3(0.2126, 0.7152, 0.0722));
            r *= smoothstep(uThreshold, uThreshold * 2.2, lum);
            r = min(r, vec3(40.0));
          } else {
            r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
          }
          gl_FragColor = vec4(r, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.upMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
        void main(){
          vec3 r = s(vec2(0,0)) * 4.0 + (s(vec2(-1,0)) + s(vec2(1,0)) + s(vec2(0,-1)) + s(vec2(0,1))) * 2.0
                 + s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1));
          gl_FragColor = vec4(r / 16.0, 1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.gradeMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: ATMO.sunDir,
        uSunColor: ATMO.sunColor,
        uHazeColor: ATMO.hazeColor,
        uMistColor: ATMO.mistColor,
        uHazeDensity: ATMO.hazeDensity,
        uHazeHeight: ATMO.hazeHeight,
        uMistDensity: ATMO.mistDensity,
        uMistHeight: ATMO.mistHeight,
        uHazeFar: ATMO.hazeFar,
        uTime: ATMO.time,
        tHDR: { value: null },
        tBloom: { value: null },
        tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uTanHalf: { value: 0.35 },
        uAspect: { value: width / height },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uExposure: { value: 0.78 },
        uContrast: { value: 1.34 },
        uSaturation: { value: 1.06 },
        uVibrance: { value: 0.1 },
        uLift: { value: new THREE.Vector3(0.02, 0.022, 0.028) },
        uGain: { value: new THREE.Vector3(1.01, 1.0, 0.985) },
        uVignette: { value: 0.26 },
        uGrain: { value: 0.018 },
        uBloom: { value: 0.075 },
        uSunScreen: { value: this.sunScreen },
        uSunFacing: { value: -1 },
        uRays: { value: 0.22 },
        uDebugDepth: { value: 0 },
        uResolution: { value: new THREE.Vector2(width, height) },
        uFrame: { value: 0 },
        toneMappingExposure: { value: 1.0 },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        #include <tonemapping_pars_fragment>
        ${ATMO_FOG_GLSL}
        uniform sampler2D tHDR;
        uniform sampler2D tBloom;
        uniform sampler2D tDepth;
        uniform mat4 uInvProj;
        uniform float uTanHalf;
        uniform float uAspect;
        uniform mat4 uCamWorld;
        uniform vec3 uCamPos;
        uniform float uExposure;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uVibrance;
        uniform vec3 uLift;
        uniform vec3 uGain;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uBloom;
        uniform vec2 uSunScreen;
        uniform float uSunFacing;
        uniform float uRays;
        uniform float uDebugDepth;
        uniform vec2 uResolution;
        uniform float uFrame;
        varying vec2 vUv;
        float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        vec3 aces(vec3 x){
          const mat3 I = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
          const mat3 O = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
          x = I * x; vec3 a = x * (x + 0.0245786) - 0.000090537; vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
          return clamp(O * (a / b), 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0031308)), vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c));
        }
        vec3 sCurve(vec3 x, float k){
          vec3 a = x * x * (3.0 - 2.0 * x);
          return mix(x, a, clamp(k - 1.0, 0.0, 2.0) * 0.55);
        }
        void main(){
          vec2 uv = vUv;
          vec3 c = texture2D(tHDR, uv).rgb;
          vec3 bloom = texture2D(tBloom, uv).rgb;
          c += bloom * uBloom;
          // depth -> world position
          float z = texture2D(tDepth, uv).x;
          if (uDebugDepth > 0.5) { gl_FragColor = vec4(vec3(z / 300.0), 1.0); return; }
          vec2 ndc = uv * 2.0 - 1.0;
          vec3 vpos = vec3(ndc.x * z * uTanHalf * uAspect, ndc.y * z * uTanHalf, -z);
          vec3 wp = (uCamWorld * vec4(vpos, 1.0)).xyz;
          if (z < 2000.0) c = atmoApply(c, uCamPos, wp);
          // screen-space sun shafts: march the HDR toward the sun, keep only the core
          if (uSunFacing > 0.15 && uSunScreen.x > -0.1 && uSunScreen.x < 1.1 && uSunScreen.y > -0.1 && uSunScreen.y < 1.1) {
            vec2 stepv = (uSunScreen - uv) / 22.0;
            vec3 acc = vec3(0.0);
            float wsum = 0.0;
            for (int i = 0; i < 22; i++) {
              vec2 p = uv + stepv * float(i);
              vec3 sc = texture2D(tHDR, p).rgb;
              float l = dot(sc, vec3(0.2126, 0.7152, 0.0722));
              float w = smoothstep(5.0, 24.0, l);
              float fall = 1.0 - float(i) / 22.0;
              acc += sc * w * fall;
              wsum += w * fall;
            }
            c += acc / max(wsum, 1e-3) * uRays * smoothstep(0.1, 0.5, uSunFacing);
          }
          // soft sun glow + veil (lens bloom is already in the bloom chain)
          vec2 sd = (uv - uSunScreen) * vec2(uResolution.x / uResolution.y, 1.0);
          float sr = length(sd);
          float glow = exp(-sr * 7.0) * 0.14 + exp(-sr * 2.2) * 0.05;
          c += uSunColor * glow * max(uSunFacing, 0.0);
          c *= uExposure * uGain;
          vec3 tm = AgXToneMapping(c);
          vec3 o = toSRGB(tm);
          // filmic S-curve around mid grey, gentle toe and shoulder
          o = clamp((o - 0.5) * uContrast + 0.5, 0.0, 1.0);
          o = mix(o, o * o * (3.0 - 2.0 * o), 0.18);
          o += uLift * (1.0 - o);
          float l = luma(o);
          // split toning: cool shadows, warm highlights
          o += vec3(-0.008, 0.002, 0.014) * (1.0 - smoothstep(0.05, 0.45, l));
          o += vec3(0.014, 0.007, -0.008) * smoothstep(0.5, 0.95, l);
          l = luma(o);
          float sat = max(max(o.r, o.g), o.b) - min(min(o.r, o.g), o.b);
          o = mix(vec3(l), o, uSaturation + uVibrance * (1.0 - sat));
          // narrow-wavelength vignette
          vec2 q = uv - 0.5;
          q.x *= uResolution.x / uResolution.y;
          float vig = smoothstep(0.95, 0.25, length(q));
          o *= mix(1.0 - uVignette, 1.0, vig);
          // grain + dither
          float g = hash12(gl_FragCoord.xy + uFrame * 19.7) - 0.5;
          o += g * uGrain * (1.0 - o * 0.55);
          o += (hash12(gl_FragCoord.xy * 1.31 + 9.7) - 0.5) / 255.0;
          gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.buildMips(width, height);
  }

  private buildMips(w: number, h: number) {
    this.mips.forEach((m) => m.dispose());
    this.mips = [];
    let mw = w;
    let mh = h;
    for (let i = 0; i < 6; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      this.mips.push(makeRT(mw, mh, THREE.HalfFloatType));
    }
  }

  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.sceneRT.dispose();
    this.sceneRT = makeRT(w, h, THREE.HalfFloatType, true);
    this.depthRT.setSize(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
    this.gradeMat.uniforms.uAspect.value = w / h;
    this.acc.forEach((a) => a.setSize(w, h));
    this.buildMips(w, h);
    this.gradeMat.uniforms.uResolution.value.set(w, h);
  }

  begin() {
    this.count = 0;
  }

  /** render one jittered sub-frame into the accumulation buffer */
  addSample(index: number) {
    const cam = this.camera;
    cam.updateProjectionMatrix();
    const P = cam.projectionMatrix.elements;
    const jx = halton(index + 1, 2) - 0.5;
    const jy = halton(index + 1, 3) - 0.5;
    P[8] += (2 * jx) / this.width;
    P[9] += (2 * jy) / this.height;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true);

    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, false);
    r.render(this.scene, cam);

    const src = this.acc[this.accIndex];
    const dst = this.acc[1 - this.accIndex];
    this.blendMat.uniforms.tNew.value = this.sceneRT.texture;
    this.blendMat.uniforms.tPrev.value = src.texture;
    this.blendMat.uniforms.uW.value = 1 / (this.count + 1);
    this.quad.material = this.blendMat;
    r.setRenderTarget(dst);
    this.quad.render(r);
    this.accIndex = 1 - this.accIndex;
    this.count++;
    cam.updateProjectionMatrix();
  }

  private bloom() {
    const r = this.renderer;
    this.quad.material = this.downMat;
    let src: THREE.Texture = this.acc[this.accIndex].texture;
    let sw = this.width;
    let sh = this.height;
    for (let i = 0; i < this.mips.length; i++) {
      this.downMat.uniforms.tSrc.value = src;
      this.downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
      r.setRenderTarget(this.mips[i]);
      this.quad.render(r);
      src = this.mips[i].texture;
      sw = this.mips[i].width;
      sh = this.mips[i].height;
    }
    this.quad.material = this.upMat;
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i];
      this.upMat.uniforms.tSrc.value = s.texture;
      this.upMat.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      r.setRenderTarget(this.mips[i - 1]);
      this.quad.render(r);
    }
    return this.mips[0].texture;
  }

  updateSun() {
    const cam = this.camera;
    const p = ATMO.sunDir.value.clone().multiplyScalar(3000).add(cam.position).project(cam);
    this.sunScreen.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    this.sunFacing = fwd.dot(ATMO.sunDir.value.clone().normalize());
    this.gradeMat.uniforms.uSunFacing.value = this.sunFacing;
    this.gradeMat.uniforms.uSunScreen.value.copy(this.sunScreen);
  }

  setDepthExclude(objects: THREE.Object3D[]) { this.depthExclude = objects; }

  private renderDepth() {
    const r = this.renderer;
    const vis = this.depthExclude.map((o) => o.visible);
    this.depthExclude.forEach((o) => (o.visible = false));
    const prev = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.depthMat;
    r.setRenderTarget(this.depthRT);
    r.clear(true, true, false);
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = prev;
    this.depthExclude.forEach((o, i) => (o.visible = vis[i]));
    r.setRenderTarget(null);
  }

  resolve(frame = 0) {
    const r = this.renderer;
    this.renderDepth();
    const b = this.qualityBloom() ? this.bloom() : this.acc[this.accIndex].texture;
    const U = this.gradeMat.uniforms;
    U.tHDR.value = this.acc[this.accIndex].texture;
    U.tBloom.value = b;
    U.tDepth.value = this.depthRT.texture;
    U.uTanHalf.value = Math.tan((this.camera.fov * Math.PI) / 360);
    U.uAspect.value = this.camera.aspect;
    U.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(this.camera.matrixWorld);
    U.uCamPos.value.setFromMatrixPosition(this.camera.matrixWorld);
    U.uFrame.value = frame;
    this.updateSun();
    this.quad.material = this.gradeMat;
    r.setRenderTarget(null);
    this.quad.render(r);
  }

  private qualityBloom() {
    return true;
  }

  /** draw the current accumulation straight to the screen (used for a single quick frame) */
  present() {
    this.copyMat.uniforms.tSrc.value = this.acc[this.accIndex].texture;
    this.quad.material = this.copyMat;
    this.renderer.setRenderTarget(null);
    this.quad.render(this.renderer);
  }

  samplesToConverge() {
    return 48;
  }

  debugDepth(on: boolean) {
    this.gradeMat.uniforms.uDebugDepth.value = on ? 1 : 0;
  }

  setExposure(v: number) {
    this.gradeMat.uniforms.uExposure.value = clamp(v, 0.1, 4);
  }
}

import * as THREE from "three";

// Shared procedural textures keep the effects crisp without loading a separate
// image for every shot. The alpha edges are deliberately uneven, not circles.
function texture(size, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  paint(canvas.getContext("2d"), size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  return map;
}

function raggedPath(ctx, cx, cy, radius, count, seed) {
  let n = seed;
  const rand = () => { n = (Math.imul(n, 1664525) + 1013904223) | 0; return (n >>> 0) / 4294967296; };
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const r = radius * (0.77 + rand() * 0.42);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function bulletTexture() {
  return texture(128, (ctx, s) => {
    const c = s / 2;
    let haze = ctx.createRadialGradient(c, c, 5, c, c, 59);
    haze.addColorStop(0, "rgba(8,7,6,.78)");
    haze.addColorStop(.42, "rgba(25,23,21,.54)");
    haze.addColorStop(.78, "rgba(45,42,38,.15)");
    haze.addColorStop(1, "rgba(45,42,38,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, s, s);
    // Chipped material around a small dark puncture; off-center marks keep it
    // from reading like a stamped target icon.
    raggedPath(ctx, c + 2, c - 1, 24, 19, 791);
    ctx.fillStyle = "rgba(135,128,115,.52)";
    ctx.fill();
    raggedPath(ctx, c + 1, c, 18, 17, 203);
    ctx.fillStyle = "rgba(35,32,28,.9)";
    ctx.fill();
    raggedPath(ctx, c, c + 1, 11, 14, 403);
    ctx.fillStyle = "rgba(5,5,5,.98)";
    ctx.fill();
    ctx.strokeStyle = "rgba(16,15,14,.52)";
    ctx.lineWidth = 1.4;
    for (const [a, len] of [[.3, 28], [1.75, 33], [3.55, 31], [5.25, 27]]) {
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 18, c + Math.sin(a) * 18);
      ctx.lineTo(c + Math.cos(a + .08) * len, c + Math.sin(a + .08) * len);
      ctx.stroke();
    }
  });
}

function dropletTexture() {
  return texture(64, (ctx, s) => {
    const c = s / 2;
    raggedPath(ctx, c, c, 25, 17, 301);
    const fill = ctx.createRadialGradient(c - 7, c - 9, 2, c, c, 28);
    fill.addColorStop(0, "rgba(119,25,27,.94)");
    fill.addColorStop(.58, "rgba(76,13,15,.96)");
    fill.addColorStop(1, "rgba(43,8,10,0)");
    ctx.fillStyle = fill;
    ctx.fill();
  });
}

function cloudTexture(red) {
  return texture(128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 5, c, c, 58);
    if (red) {
      g.addColorStop(0, "rgba(97,25,27,.46)");
      g.addColorStop(.48, "rgba(79,24,25,.2)");
      g.addColorStop(1, "rgba(74,22,23,0)");
    } else {
      g.addColorStop(0, "rgba(135,125,110,.48)");
      g.addColorStop(.5, "rgba(113,105,95,.21)");
      g.addColorStop(1, "rgba(100,94,85,0)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

export class ImpactVfx {
  constructor(scene) {
    this.scene = scene;
    this.normalMatrix = new THREE.Matrix3();
    this.up = new THREE.Vector3(0, 0, 1);
    this.markCursor = 0;
    this.markCount = 0;
    // 弹孔使用单个 InstancedMesh 循环覆写：持续交火时画面能留下足够多的战斗痕迹，
    // 但不会为每一发永久增加一个 Mesh / draw call。
    this.markLimit = 144;
    this.markMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        map: bulletTexture(), transparent: true, opacity: .94, depthWrite: false,
        roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1,
      }), this.markLimit,
    );
    this.markMesh.count = 0;
    this.markMesh.frustumCulled = false;
    this.markMesh.renderOrder = 1;
    this.markMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.markMesh);

    const drop = dropletTexture();
    const bloodHaze = cloudTexture(true);
    const dust = cloudTexture(false);
    this.particles = [];
    for (let i = 0; i < 96; i++) {
      const material = new THREE.SpriteMaterial({
        map: i < 48 ? drop : i < 64 ? bloodHaze : dust,
        transparent: true, depthWrite: false, opacity: 0,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.particles.push({ sprite, t: 1, life: 0, vel: new THREE.Vector3(), gravity: 0, size: 0, grow: 0, kind: i < 48 ? "drop" : i < 64 ? "bloodHaze" : "dust" });
    }

    // 曳光弹是短距离高速移动的亮段，而不是从枪口一直连到落点的激光线。
    // 每条共用同一个低面数圆柱几何，只保留独立材质以便逐条淡出；池耗尽时循环复用。
    this.tracerCursor = 0;
    this.tracerGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    this.tracers = [];
    this.tracerUp = new THREE.Vector3(0, 1, 0);
    this.tracerMid = new THREE.Vector3();
    this.tracerHead = new THREE.Vector3();
    this.tracerTail = new THREE.Vector3();
    this.tracerControl = new THREE.Vector3();
    this.tracerVector = new THREE.Vector3();
    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffd28a, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.tracerGeometry, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      this.tracers.push({
        mesh, start: new THREE.Vector3(), dir: new THREE.Vector3(),
        end: new THREE.Vector3(), launchDir: new THREE.Vector3(),
        pathPoints:Array.from({length:13},()=>new THREE.Vector3()),
        pathLengths:new Float32Array(13),curved:false,
        distance: 0, t: 1, life: 0, speed: 0, segment: 0, radius: 0,
      });
    }
  }

  _placeTracer(tracer) {
    // Give the tracer a small head start so even a single 60 Hz frame shows it.
    const travel = tracer.t * tracer.speed + .42;
    const head = Math.min(tracer.distance, travel);
    const tail = Math.max(0, travel - tracer.segment);
    if (tail >= tracer.distance || head <= tail + .002) {
      tracer.mesh.visible = false;
      return;
    }
    this._tracerPoint(tracer,tail,this.tracerTail);
    this._tracerPoint(tracer,head,this.tracerHead);
    const length=this.tracerHead.distanceTo(this.tracerTail);
    this.tracerMid.copy(this.tracerHead).add(this.tracerTail).multiplyScalar(.5);
    tracer.mesh.position.copy(this.tracerMid);
    tracer.mesh.quaternion.setFromUnitVectors(this.tracerUp,
      this.tracerVector.copy(this.tracerHead).sub(this.tracerTail).normalize());
    tracer.mesh.scale.set(tracer.radius, length, tracer.radius);
    const fade = Math.min(1, Math.max(0, (tracer.life - tracer.t) / .045));
    tracer.mesh.material.opacity = fade * (tracer.kind === "enemy" ? .82 : .72);
    tracer.mesh.visible = true;
  }

  _tracerPoint(tracer,distance,out){
    if(!tracer.curved)return out.copy(tracer.start).addScaledVector(tracer.dir,distance);
    const lengths=tracer.pathLengths,points=tracer.pathPoints;
    let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;
    const a=lengths[i-1],b=lengths[i],f=b>a?(distance-a)/(b-a):0;
    return out.copy(points[i-1]).lerp(points[i],f);
  }

  tracer(start, end, kind = "player",options={}) {
    const item = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % this.tracers.length;
    item.start.copy(start);item.end.copy(end);
    item.dir.copy(end).sub(start);
    item.distance = item.dir.length();
    if (item.distance < .08) return;
    item.dir.multiplyScalar(1 / item.distance);
    item.curved=!!options.launchDirection;
    if(item.curved){
      item.launchDir.copy(options.launchDirection).normalize();
      const chord=item.distance;
      const controlDistance=Math.min(5.5,chord*.45,Math.max(.25,chord*.22));
      this.tracerControl.copy(item.start).addScaledVector(item.launchDir,controlDistance);
      let total=0;
      for(let i=0;i<item.pathPoints.length;i++){
        const t=i/(item.pathPoints.length-1),u=1-t,p=item.pathPoints[i];
        p.copy(item.start).multiplyScalar(u*u)
          .addScaledVector(this.tracerControl,2*u*t).addScaledVector(item.end,t*t);
        if(i)total+=p.distanceTo(item.pathPoints[i-1]);
        item.pathLengths[i]=total;
      }
      item.distance=total;
    }
    item.kind = kind;
    item.speed = kind === "enemy" ? 175 : 235;
    item.segment = kind === "enemy" ? 1.25 : 1.65;
    item.radius = kind === "enemy" ? .012 : .009;
    item.t = 0;
    item.life = Math.min(.32, Math.max(.055,
      (item.distance + item.segment - .42) / item.speed));
    item.mesh.material.color.setHex(kind === "enemy" ? 0xff6a32 : 0xffd28a);
    this._placeTracer(item);
  }

  normal(hit) {
    if (!hit?.face || !hit.object?.matrixWorld) return null;
    this.normalMatrix.getNormalMatrix(hit.object.matrixWorld);
    return hit.face.normal.clone().applyMatrix3(this.normalMatrix).normalize();
  }

  surface(hit, bullet = true) {
    const n = this.normal(hit);
    if (!n) return;
    if (bullet) {
      const q = new THREE.Quaternion().setFromUnitVectors(this.up, n);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(this.up, Math.random() * Math.PI * 2));
      const radius = .075 + Math.random() * .04;
      const pos = hit.point.clone().addScaledVector(n, .006);
      const matrix = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(radius, radius, 1));
      this.markMesh.setMatrixAt(this.markCursor, matrix);
      this.markCursor = (this.markCursor + 1) % this.markLimit;
      this.markCount = Math.min(this.markCount + 1, this.markLimit);
      this.markMesh.count = this.markCount;
      this.markMesh.instanceMatrix.needsUpdate = true;
    }
    // A few muted chips and one soft dust wisp; no glowing yellow spheres.
    for (let i = 0; i < 3; i++) {
      const v = n.clone().multiplyScalar(.35 + Math.random() * 1.1);
      v.x += (Math.random() - .5) * 1.1;
      v.y += (Math.random() - .3) * 1.0;
      v.z += (Math.random() - .5) * 1.1;
      this.emit("dust", hit.point, v, .065 + Math.random() * .055, .22 + Math.random() * .18, 2.0);
    }
  }

  emit(kind, point, velocity, size, life, gravity) {
    const p = this.particles.find((item) => item.kind === kind && item.t >= item.life);
    if (!p) return;
    p.sprite.position.copy(point);
    p.sprite.position.x += (Math.random() - .5) * .045;
    p.sprite.position.y += (Math.random() - .5) * .045;
    p.sprite.position.z += (Math.random() - .5) * .045;
    p.vel.copy(velocity);
    p.size = size;
    p.life = life;
    p.t = 0;
    p.gravity = gravity;
    p.grow = kind === "drop" ? .7 : 1.65;
    p.sprite.material.opacity = kind === "drop" ? .9 : .52;
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.scale.setScalar(size);
    p.sprite.visible = true;
  }

  blood(point, shotDir) {
    const dir = shotDir.clone().normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i < 10; i++) {
      // Entrance spatter is visible in front of the target; a smaller portion
      // follows the projectile and can be occluded by the body.
      const v = dir.clone().multiplyScalar((i < 6 ? -1 : 1) * (.6 + Math.random() * 1.2));
      v.addScaledVector(side, (Math.random() - .5) * 4.2);
      v.y += (Math.random() - .25) * 2.0;
      this.emit("drop", point, v, .025 + Math.random() * .023, .23 + Math.random() * .18, 5.8);
    }
    this.emit("bloodHaze", point.clone().addScaledVector(dir, -.04),
      dir.clone().multiplyScalar(-.25), .18, .2, 0);
  }

  headshot(point, shotDir) {
    const dir = shotDir.clone().normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let i = 0; i < 5; i++) {
      const v = dir.clone().multiplyScalar((i < 2 ? -1 : 1) * (1.4 + Math.random() * 1.1));
      v.addScaledVector(side, (Math.random() - .5) * 3.8);
      v.y += .55 + Math.random() * .9;
      this.emit("drop", point, v, .022 + Math.random() * .024, .22 + Math.random() * .13, 5.8);
    }
  }

  update(dt) {
    for (const tracer of this.tracers) {
      if (tracer.t >= tracer.life) continue;
      tracer.t += dt;
      if (tracer.t >= tracer.life) tracer.mesh.visible = false;
      else this._placeTracer(tracer);
    }
    for (const p of this.particles) {
      if (p.t >= p.life) continue;
      p.t += dt;
      if (p.t >= p.life) { p.sprite.visible = false; continue; }
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const f = p.t / p.life;
      p.sprite.scale.setScalar(p.size * (1 + p.grow * f));
      p.sprite.material.opacity = (p.kind === "drop" ? .9 : .52) * (1 - f) ** 1.25;
    }
  }

  clear() {
    this.markCursor = 0;
    this.markCount = 0;
    this.markMesh.count = 0;
    for (const tracer of this.tracers) { tracer.t = tracer.life; tracer.mesh.visible = false; }
    for (const p of this.particles) { p.t = p.life; p.sprite.visible = false; }
  }

  stats() {
    return {
      marks: this.markCount,
      active: this.particles.filter((p) => p.t < p.life).length,
      tracers: this.tracers.filter((p) => p.t < p.life).length,
    };
  }
}

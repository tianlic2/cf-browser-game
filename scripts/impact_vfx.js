import { enemyRoundProfile } from './enemy_ballistics.js';
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

const surfaces = ['stone', 'metal', 'wood', 'cloth'];

// Four rows of deterministic variants share a single instanced decal draw.
function bulletAtlas() {
  return texture(512, ctx => {
    for (let column = 0; column < surfaces.length; column++) {
      const surface = surfaces[column];
      for (let row = 0; row < 4; row++) {
        let seed = 109 + column * 3929 + row * 773;
        const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
        ctx.save();
        ctx.translate(column * 128 + 64, row * 128 + 64);
        const patch = (x,y,rx,ry,color) => {
          ctx.save();
          ctx.translate(x,y);
          ctx.scale(rx,ry);
          raggedPath(ctx,0,0,1,17,Math.round(random()*65535));
          ctx.fillStyle=color;
          ctx.fill();
          ctx.restore();
        };
        const stroke = (x,y,dx,dy,color,width) => {
          ctx.beginPath(); ctx.moveTo(x,y);
          ctx.quadraticCurveTo(x+dx*.48+random()*2-1,y+dy*.57,x+dx,y+dy);
          ctx.lineWidth=width; ctx.strokeStyle=color; ctx.stroke();
        };
        if (surface === 'metal') {
          // Broken paint lip with a narrow, interrupted exposed-steel edge.
          patch(0,0,24,21,'rgba(39,40,39,.64)');
          patch(1,1,19,17,'#797e79');
          patch(-2,-2,17,15,'#3c4140');
          for(let i=0;i<7;i++) {
            const a=random()*Math.PI*2, r=19+random()*9;
            patch(Math.cos(a)*r,Math.sin(a)*r,1+random()*3,1+random()*2,'#777b75');
          }
          patch(-1,0,9,10,'#171b1a');
        } else if (surface === 'wood') {
          for(let i=0;i<18;i++) {
            const x=(random()-.5)*24, sign=i%2?1:-1, length=10+random()*42;
            stroke(x,sign*4,(random()-.5)*6,sign*length,
              i%3?'rgba(156,123,84,.83)':'rgba(39,29,22,.87)',1+random()*3);
          }
          patch(0,0,14,23,'#947656');
          patch(-1,2,11,15,'#543e30');
          patch(0,0,8,11,'#251f1a');
        } else if (surface === 'cloth') {
          ctx.rotate((random()-.5)*.7);
          patch(0,0,14,9,'rgba(84,84,65,.76)');
          patch(-1,1,11,8,'rgba(42,43,34,.95)');
          const pull = row % 2 ? 1 : -1;
          for(let i=0;i<13;i++) {
            const j=(random()-.5)*11;
            const x=(random()-.5)*16, y=(random()-.5)*10;
            const dx = i<8 ? pull*(3+random()*13) : j;
            const dy = i<8 ? j*.65 : (i%2?1:-1)*(3+random()*7);
            stroke(x,y,dx,dy,i%3?'rgba(134,131,102,.73)':'rgba(62,65,49,.88)',.6+random()*1.25);
          }
          patch(-2,1,7,5,'#1b201a');
        } else {
          patch(0,0,32,25,'rgba(117,111,99,.65)');
          patch(2,1,23,20,'#a29a87');
          patch(-2,-2,17,14,'#615e55');
          patch(-1,0,10,9,'#302f2a');
          for(let i=0;i<15;i++) {
            const a=random()*Math.PI*2, r=22+random()*24;
            patch(Math.cos(a)*r,Math.sin(a)*r,1+random()*3,1+random()*2,'rgba(156,149,131,.68)');
          }
        }
        // Break up flat pigment on the cut edges without painting beyond the tear.
        ctx.globalCompositeOperation='source-atop';
        for(let i=0;i<1600;i++) {
          ctx.fillStyle=i%2 ? 'rgba(12,14,13,.21)' : 'rgba(196,188,161,.14)';
          ctx.fillRect(random()*94-47,random()*94-47,.7+random()*2,.8+random()*2);
        }
        ctx.restore();
      }
    }
  });
}

function fleckTexture() {
  return texture(32, ctx => {
    ctx.fillStyle='white';
    ctx.beginPath();ctx.moveTo(1,14);ctx.lineTo(15,9);ctx.lineTo(31,15);
    ctx.lineTo(23,20);ctx.lineTo(9,19);ctx.closePath();ctx.fill();
  });
}

function sparkTexture() {
  return texture(64, ctx => {
    const tail = ctx.createLinearGradient(3,0,61,0);
    tail.addColorStop(0,'rgba(245,117,45,0)');
    tail.addColorStop(.65,'rgba(255,204,130,.73)');
    tail.addColorStop(.9,'#fff7df');
    tail.addColorStop(1,'rgba(255,237,196,.22)');
    ctx.fillStyle = tail;
    ctx.beginPath(); ctx.moveTo(3,32); ctx.lineTo(52,24);
    ctx.quadraticCurveTo(67,32,52,40); ctx.closePath(); ctx.fill();
  });
}

function dustTexture() {
  return texture(128, ctx => {
    // Overlapping, translucent lobes keep the edge porous as the puff expands.
    for (let i = 0; i < 23; i++) {
      const a = i * 2.39996, d = Math.sqrt(i/23)*34;
      const x = 64 + Math.cos(a)*d, y = 64 + Math.sin(a)*d*.78;
      const radius = 16 + 8*(1+Math.cos(i*3.17));
      const g = ctx.createRadialGradient(x,y,0,x,y,radius);
      g.addColorStop(0,'rgba(255,255,255,.30)');
      g.addColorStop(.58,'rgba(246,244,236,.13)');
      g.addColorStop(1,'rgba(245,243,235,0)');
      ctx.fillStyle = g; ctx.fillRect(x-radius,y-radius,2*radius,2*radius);
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

function bloodCloudTexture() {
  return texture(128, (ctx, size) => {
    const center = size/2;
    const g = ctx.createRadialGradient(center,center,5,center,center,58);
    g.addColorStop(0, "rgba(97,25,27,.46)");
    g.addColorStop(.48, "rgba(79,24,25,.2)");
    g.addColorStop(1, "rgba(74,22,23,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,size,size);
  });
}

export class ImpactVfx {
  constructor(scene, camera = null) {
    this.camera = camera;
    this.detailRay = new THREE.Raycaster();
    this.instanceWorld = new THREE.Matrix4();
    this.screenVelocity = new THREE.Vector3();
    this.scene = scene;
    this.normalMatrix = new THREE.Matrix3();
    this.viewRotation = new THREE.Matrix3();
    this.up = new THREE.Vector3(0, 0, 1);
    this.markCursor = 0;
    this.markCount = 0;
    // 弹孔使用单个 InstancedMesh 循环覆写：持续交火时画面能留下足够多的战斗痕迹，
    // 但不会为每一发永久增加一个 Mesh / draw call。每个实例单独计时，
    // 末段逐渐透明并从提交列表删除，低频射击也不会把旧弹痕永久留在地图上。
    this.markLimit = 144;
    this.markLife = 10;
    this.markFade = 2;
    this.marks = Array.from({ length: this.markLimit }, () => ({
      matrix: new THREE.Matrix4(), t: Infinity, life: 0, tile: 0,
    }));
    const markGeometry = new THREE.PlaneGeometry(1, 1);
    this.markOpacity = new THREE.InstancedBufferAttribute(
      new Float32Array(this.markLimit), 1,
    );
    this.markOpacity.setUsage(THREE.DynamicDrawUsage);
    markGeometry.setAttribute("instanceOpacity", this.markOpacity);
    this.markTiles = new THREE.InstancedBufferAttribute(new Float32Array(this.markLimit), 1);
    this.markTiles.setUsage(THREE.DynamicDrawUsage);
    markGeometry.setAttribute("instanceTile", this.markTiles);
    // 运输船的 Source 几何整体做过镜像，且地图表面用烘焙光照的
    // MeshBasicMaterial。弹痕是覆在表面上的贴花，不应再被世界灯光压黑；
    // DoubleSide 则防止导入网格的镜像/双面三角形让贴花在某些朝向被剔除。
    const markMaterial = new THREE.MeshBasicMaterial({
      map: bulletAtlas(), transparent: true, opacity: .94, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1,
    });
    markMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float instanceOpacity;\nattribute float instanceTile;\nvarying float vInstanceOpacity;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMapUv = (vMapUv + vec2(mod(instanceTile,4.),3.-floor(instanceTile/4.))) * .25;")
        .replace("#include <begin_vertex>", "vInstanceOpacity = instanceOpacity;\n#include <begin_vertex>");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vInstanceOpacity;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= vInstanceOpacity;");
    };
    markMaterial.customProgramCacheKey = () => "impact-mark-surface-atlas-v2";
    this.markMesh = new THREE.InstancedMesh(
      markGeometry, markMaterial, this.markLimit,
    );
    this.markMesh.count = 0;
    this.markMesh.name = "bullet-impact-marks";
    this.markMesh.frustumCulled = false;
    this.markMesh.renderOrder = 1;
    this.markMesh.raycast = () => {};
    this.markMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.markMesh);

    const drop = dropletTexture();
    const bloodHaze = bloodCloudTexture();
    const dust = dustTexture();
    this.sparkMap = sparkTexture();
    this.dustMap = dust;
    this.fleckMap = fleckTexture();
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
    this.tracerCursor = 0;this.enemyShotSerial=0;this.pendingImpacts=[];
    this.tracerGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    this.enemyTracerGeometry=new THREE.CylinderGeometry(1,1,1,6,8,true);
    this.tracerGeometry.setAttribute('color',new THREE.Float32BufferAttribute(
      new Float32Array(this.tracerGeometry.attributes.position.count*3).fill(1),3));
    const ep=this.enemyTracerGeometry.attributes.position,ec=[];
    for(let i=0;i<ep.count;i++){
      const t=ep.getY(i)+.5,r=.12+.88*Math.sin(t*Math.PI*.5),energy=t*t;
      ep.setX(i,ep.getX(i)*r);ep.setZ(i,ep.getZ(i)*r);
      ec.push(energy,energy*.88,energy*.65);
    }
    this.enemyTracerGeometry.setAttribute('color',new THREE.Float32BufferAttribute(ec,3));
    this.smokeOrigin=new THREE.Vector3();
    this.smokeVelocity=new THREE.Vector3();
    this.tracers = [];
    this.tracerUp = new THREE.Vector3(0, 1, 0);
    this.tracerMid = new THREE.Vector3();
    this.tracerHead = new THREE.Vector3();
    this.tracerTail = new THREE.Vector3();
    this.tracerControl = new THREE.Vector3();
    this.tracerVector = new THREE.Vector3();
    for (let i = 0; i < 40; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffd28a, vertexColors:true, transparent: true, opacity: 0,
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

  _syncMarks() {
    let visible = 0;
    for (const mark of this.marks) {
      if (mark.t >= mark.life) continue;
      const fadeAt = Math.max(0, mark.life - this.markFade);
      const opacity = mark.t <= fadeAt ? 1 : Math.max(0, (mark.life - mark.t) / this.markFade);
      this.markMesh.setMatrixAt(visible, mark.matrix);
      this.markOpacity.setX(visible, opacity);
      this.markTiles.setX(visible, mark.tile);
      visible++;
    }
    this.markCount = visible;
    this.markMesh.count = visible;
    this.markMesh.instanceMatrix.needsUpdate = true;
    this.markOpacity.needsUpdate = true;
    this.markTiles.needsUpdate = true;
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
    const fade = tracer.kind==="enemy" ? 1 : Math.min(1, Math.max(0, (tracer.life - tracer.t) / .045));
    tracer.mesh.material.opacity = fade * (tracer.kind === "enemy" ? tracer.opacity : .72);
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
    if(kind==='enemy'){
      const profile=enemyRoundProfile(options.weaponId);
      item.speed=options.speed||profile.speed;item.segment=profile.segment;item.radius=profile.radius;
      item.mesh.geometry=this.enemyTracerGeometry;item.opacity=(this.enemyShotSerial++%3===0)?.62:.22;
      item.mesh.material.color.setHex(0xffe8bd);item.mesh.material.toneMapped=false;
      item.life=(item.distance+item.segment-.42)/item.speed;
    }else{
      item.mesh.geometry=this.tracerGeometry;
      item.life=Math.min(.32,Math.max(.055,(item.distance+item.segment-.42)/item.speed));
      item.mesh.material.color.setHex(0xffd28a);
    }
    item.t=0;
    this._placeTracer(item);
    return item;
  }

  surfaceAtArrival(hit,solid,direction,delay,onArrival){
    if(this.pendingImpacts.length>=48)this.pendingImpacts.shift();
    this.pendingImpacts.push({hit,solid,direction:direction.clone(),delay,onArrival});
  }

  normal(hit, incomingDirection = null) {
    if (!hit?.face || !hit.object?.matrixWorld) return null;
    let world = hit.object.matrixWorld;
    if (hit.instanceId != null && hit.object.isInstancedMesh) {
      hit.object.getMatrixAt(hit.instanceId, this.instanceWorld);
      world = this.instanceWorld.premultiply(world);
    }
    this.normalMatrix.getNormalMatrix(world);
    const normal = hit.face.normal.clone().applyMatrix3(this.normalMatrix).normalize();
    // DoubleSide 射线可以命中三角形的背面，镜像导入还会翻转绕序。
    // 可视贴花必须朝向子弹来处：法线与入射方向同向时就翻转。
    if (incomingDirection && normal.dot(incomingDirection) > 0) normal.multiplyScalar(-1);
    return normal;
  }

  surface(hit, bullet = true, incomingDirection = null) {
    // Decorative sheets and battens can sit just in front of the resolved box.
    // Look back along this shot only within its surface skin, after gameplay resolved it.
    if (bullet && hit.object.impactLayers && incomingDirection) {
      const ray = this.detailRay;
      const skin = Math.min(.32,hit.distance ?? .32);
      ray.ray.origin.copy(hit.point).addScaledVector(incomingDirection,-skin);
      ray.ray.direction.copy(incomingDirection);
      ray.far = skin + .25;
      hit = ray.intersectObjects(hit.object.impactLayers,false)[0] ?? hit;
    }
    const n = this.normal(hit, incomingDirection);
    if (!n) return;
    const info = hit.object.userData;
    const surface = info.impactSurfaceAt?.(hit.uv) ?? info.impactSurface ??
      (info.bulletMaterial === 'wood' ? 'wood' : 'stone');
    const pos = hit.point.clone().addScaledVector(n, .006);
    if (bullet) {
      const q = new THREE.Quaternion().setFromUnitVectors(this.up,n);
      let angle = Math.random() * Math.PI * 2;
      if (surface === 'wood' || surface === 'cloth') {
        // Vertical crate planks and woven sides have a persistent local direction.
        const localUp = new THREE.Vector3(0,1,0);
        if (info.impactGrainAxis && hit.instanceId != null) {
          localUp.copy(info.impactGrainAxis).transformDirection(this.instanceWorld);
        }
        localUp.applyQuaternion(q.clone().invert());
        if (Math.hypot(localUp.x,localUp.y)>.1) angle = Math.atan2(-localUp.x,localUp.y);
        angle += (Math.random()-.5)*.25;
      }
      q.multiply(new THREE.Quaternion().setFromAxisAngle(this.up,angle));
      const size = (.15 + Math.random()*.045) * (surface==='cloth' ? .85 : 1);
      const mark = this.marks[this.markCursor];
      mark.matrix.compose(pos,q,new THREE.Vector3(size,size,1));
      mark.tile = surfaces.indexOf(surface) + 4 * Math.floor(Math.random()*4);
      mark.t = 0;
      mark.life = this.markLife;
      this.markCursor = (this.markCursor + 1) % this.markLimit;
      this._syncMarks();
    }
    if (bullet && (surface === 'metal' || surface === 'wood' || surface === 'stone')) {
      this.impactBurst(surface,pos,n,incomingDirection,info.impactGrainAxis);
      return;
    }
    if (bullet) {
      for (let i=0; i<2; i++) {
        const v=n.clone().multiplyScalar(.5+Math.random());
        v.x+=(Math.random()-.5)*.8; v.y+=Math.random()*.6;
        this.emit("dust",pos,v,.028,.25+Math.random()*.12,2,surface);
      }
    }
    this.puff(pos,n,surface,false);
  }

  impactBurst(surface,pos,n,incoming,grainAxis) {
    const metal = surface==='metal', wood = surface==='wood';
    // One tangent fan per impact, with individual spread inside it. At grazing
    // angles its axis follows the shot across the wall; head-on fans vary.
    const tangent = incoming ? incoming.clone() : new THREE.Vector3();
    tangent.addScaledVector(n,-tangent.dot(n));
    const grazing = Math.min(1,tangent.length());
    if (wood && grainAxis) {
      tangent.copy(grainAxis).transformDirection(this.instanceWorld);
      tangent.addScaledVector(n,-tangent.dot(n));
    } else if (grazing<.18 || wood) {
      tangent.set(Math.random()-.5,wood ? .8 : Math.random()-.5,Math.random()-.5);
      tangent.addScaledVector(n,-tangent.dot(n));
    }
    if (tangent.lengthSq()<.0001) tangent.set(1,0,0).addScaledVector(n,-n.x);
    tangent.normalize();
    if (wood && Math.random()<.5) tangent.negate();
    const across = new THREE.Vector3().crossVectors(n,tangent);
    const energy = Math.random();
    const count = (metal ? 2 : 1) + Math.floor(energy*(metal ? 5 : 4));
    // Behind penetrated crates, distant bursts read as a few specks. Keep
    // their longer-lived debris from displacing the nearer impact.
    const distant = this.camera && this.camera.position.distanceToSquared(pos)>144;
    for (let i=0; i<(distant ? Math.min(count,2) : count); i++) {
      const speed = .4+Math.random()*(metal?3.2:1.9);
      const v = n.clone().multiplyScalar((.32+Math.random()*.80)*speed);
      const fan = (Math.random()-.5)*(metal?1.85:1.6);
      v.addScaledVector(tangent,Math.cos(fan)*speed*(.48+grazing*.8));
      v.addScaledVector(across,Math.sin(fan)*speed);
      v.y += (metal?.2:.36)+Math.random()*.42;
      const size = metal ? .020+speed*.017 : .014+Math.random()*.046;
      const life = metal ? .06+speed*.04+Math.random()*.07 : .24+size*3+Math.random()*.17;
      this.emit("dust",pos,v,size,life,metal?5.0:wood?7.2:9.1,surface);
    }
    if (!metal || (!distant && energy>.79)) this.puff(pos,n,surface,distant);
  }

  muzzleSmoke(pos,dir) {
    // The narrow jet outruns the softer gas at the crown, then drag and
    // buoyancy take over. One pair per discharge, including shotguns.
    for (const jet of [true,false]) {
      const vel=this.smokeVelocity.copy(dir).multiplyScalar(jet?1.75:.47);
      vel.y+=jet?.18:.40;
      vel.x+=(Math.random()-.35)*.24;
      const p=this.emit('dust',pos,vel,jet?.095:.12,(jet?.53:.72)+Math.random()*.18,0);
      if (!p) continue;
      p.alpha=jet?.58:.44;
      p.grow=jet?3.7:2.7;
      p.sprite.material.color.setHex(jet?0xc2c8c9:0xa6adaf);
      p.sprite.material.opacity=0;
    }
  }

  puff(pos,n,surface,distant) {
    const wood = surface==='wood', mineral = surface==='stone';
    // Feed an existing young plume at nearby hits. Its age keeps advancing
    // so repeated shots cannot freeze the plume or pin it to the crosshair.
    const nearby = this.particles.find(p=>p.kind==='dust' && !p.fragment &&
      p.dustSurface===surface && p.t<p.life && p.t<.38 && p.sprite.position.distanceToSquared(pos)<.14);
    if (nearby) {
      nearby.size = Math.min(.43,nearby.size+.037);
      nearby.alpha = Math.min(.65,nearby.alpha+.065);
      nearby.life = Math.min(1.1,nearby.life+.09);
      nearby.vel.addScaledVector(n,.035);
      return;
    }
    const v=n.clone().multiplyScalar(.18+Math.random()*.23);
    v.x+=.10; v.y+=.16+Math.random()*.22;
    const size = (mineral?.22:wood?.17:.09)*(.83+Math.random()*.45);
    const p = this.emit('dust',pos,v,size,(wood || mineral ? .72 : .38)+Math.random()*.22,0);
    if (!p) return;
    p.dustSurface = surface;
    p.alpha = (mineral?.58:wood?.50:.25)*(distant?.55:1);
    p.sprite.material.color.setHex(wood?0xb09a79:mineral?0xb5b0a2:0x97968b);
  }

  emit(kind, point, velocity, size, life, gravity, fragment = null) {
    let p = this.particles.find(item=>item.kind===kind && item.t>=item.life);
    if (!p && kind==='dust' && this.camera && this.camera.position.distanceToSquared(point)<16) {
      // Reclaim the faintest finished-looking or distant fleck, never a fresh local puff.
      let best=.7;
      for (const item of this.particles) {
        if (item.kind!=='dust') continue;
        const rank=item.t/item.life+(this.camera.position.distanceToSquared(item.sprite.position)>144 ? .7 : 0);
        if (rank>best) { best=rank; p=item; }
      }
    }
    if (!p) return;
    p.fragment = fragment;
    p.dustSurface = null;
    p.aspect = fragment==='metal' ? .23+Math.random()*.22 : fragment ? .30+Math.random()*.65 : 1;
    p.spin = fragment==='wood' || fragment==='stone' ? (Math.random()-.5)*21 : 0;
    if (kind==="dust") {
      const material = p.sprite.material;
      material.map = fragment==='metal' ? this.sparkMap : fragment ? this.fleckMap : this.dustMap;
      material.color.setHex(({metal:0xffe4ab,wood:0xbf976b,cloth:0x999680,stone:0xafa99b})[fragment] ?? 0xffffff);
      if (fragment==='wood' || fragment==='stone') material.color.multiplyScalar(.65+Math.random()*.65);
      material.blending = fragment==='metal' ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
    p.sprite.position.copy(point);
    if (kind !== "dust") {
      p.sprite.position.x += (Math.random() - .5) * .045;
      p.sprite.position.y += (Math.random() - .5) * .045;
      p.sprite.position.z += (Math.random() - .5) * .045;
    }
    p.vel.copy(velocity);
    p.size = size;
    p.life = life;
    p.t = 0;
    p.gravity = gravity;
    p.grow = fragment ? -.55 : kind === "drop" ? .7 : 1.65;
    p.alpha = fragment || kind === "drop" ? .9 : .60;
    p.sprite.material.opacity = p.alpha;
    p.sprite.material.rotation = Math.random() * Math.PI * 2;
    p.sprite.scale.set(size, size*p.aspect,1);
    p.sprite.visible = true;
    return p;
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
    let marksChanged = false;
    for (const mark of this.marks) {
      if (mark.t >= mark.life) continue;
      mark.t = Math.min(mark.life, mark.t + dt);
      if (mark.t > mark.life - this.markFade) marksChanged = true;
    }
    if (marksChanged) this._syncMarks();
    for(let i=this.pendingImpacts.length-1;i>=0;i--){
      const p=this.pendingImpacts[i];p.delay-=dt;
      if(p.delay<=0){this.pendingImpacts.splice(i,1);this.surface(p.hit,p.solid,p.direction);p.onArrival?.();}
    }
    for (const tracer of this.tracers) {
      if (tracer.t >= tracer.life) continue;
      tracer.t += dt;
      if (tracer.t >= tracer.life) tracer.mesh.visible = false;
      else this._placeTracer(tracer);
    }
    if (this.camera) this.viewRotation.setFromMatrix4(this.camera.matrixWorldInverse);
    for (const p of this.particles) {
      if (p.t >= p.life) continue;
      p.t += dt;
      if (p.t >= p.life) { p.sprite.visible = false; continue; }
      if (p.kind==='dust') {
        const drag=p.fragment==='metal'?3.5:p.fragment?1.3:2.1;
        p.vel.multiplyScalar(Math.exp(-drag*dt));
        if (!p.fragment) { p.vel.y+=.34*dt; p.vel.x+=.10*dt; }
      }
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const f = p.t / p.life;
      const size = p.size * (1 + p.grow * f);
      const mat = p.sprite.material;
      p.sprite.scale.set(size,size*p.aspect,1);
      if (p.fragment==='metal') {
        // Hot, fast streaks contract into dim embers instead of fading at a fixed length.
        if (this.camera) {
          this.screenVelocity.copy(p.vel).applyMatrix3(this.viewRotation);
          mat.rotation=Math.atan2(this.screenVelocity.y,this.screenVelocity.x);
          const speed=Math.hypot(this.screenVelocity.x,this.screenVelocity.y);
          p.sprite.scale.x=size*(.24+Math.min(1.9,speed*.64))*(1-.45*f);
        }
        mat.color.setRGB(1,1-.72*f,.73*(1-f));
      } else if (p.spin) {
        mat.rotation+=p.spin*dt;
        p.sprite.scale.y*=.29+.71*Math.abs(Math.cos(p.t*p.spin*1.32));
      }
      if (p.kind==='dust' && !p.fragment) {
        const appear=Math.min(1,p.t/.065);
        mat.opacity=p.alpha*appear*(1-f)**1.35;
      } else {
        mat.opacity=p.alpha*(1-f)**(p.fragment==='metal' ? .77 : 1.25);
      }
    }
  }

  clear() {
    this.markCursor = 0;
    for (const mark of this.marks) { mark.t = Infinity; mark.life = 0; }
    this._syncMarks();
    this.pendingImpacts.length=0;
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

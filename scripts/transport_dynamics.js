import * as THREE from 'three';
import { freightGust } from './transport_wind.js';

// Metre-spaced geometry around the ship, coarser rings beyond the fog. Reuses
// the original sea draw; no second water plane or reflection render target.
export function harbourWaterGeometry() {
  const axis=[-800,-400,-240,-160,-120];
  for(let x=-100;x<=100;x+=2)axis.push(x);
  axis.push(120,160,240,400,800);
  const p=[],uv=[],n=[],indices=[],size=axis.length;
  for(const z of axis)for(const x of axis){p.push(x,z,0);uv.push(x/1600+.5,z/1600+.5);n.push(0,0,1);}
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){
    const a=y*size+x,b=a+1,c=a+size,d=c+1;
    indices.push(a,b,c,b,d,c);
  }
  const g=new THREE.BufferGeometry();g.setIndex(indices);
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
  g.computeBoundingSphere();g.boundingSphere.radius+=.4;
  return g;
}

// Deep-water dispersion: omega=sqrt(g*k). Derivatives supply coherent PBR
// normals; the pre-existing normal atlas still supplies the fine capillary waves.
export const harbourSwellGLSL=`
  uniform float uHarbourTime;
  vec3 harbourWave(vec2 p,vec2 dir,float k,float amplitude,float phase){
    float a=dot(p,dir)*k-sqrt(9.81*k)*uHarbourTime+phase;
    return vec3(amplitude*sin(a),dir*amplitude*k*cos(a));
  }
  vec3 harbourSwell(vec2 p){
    vec3 w=harbourWave(p,vec2(.94,.342),.31,.15,0.)
      +harbourWave(p,vec2(-.6,.8),.49,.074,1.7)
      +harbourWave(p,vec2(.8,-.6),.91,.032,3.1);
    float fade=1.-smoothstep(100.,220.,length(p));
    return w*fade;
  }`;

export function harbourWaveHeight(x,z,t) {
  const fade=1-THREE.MathUtils.smoothstep(Math.hypot(x,z),100,220);
  return fade*(.15*Math.sin((x*.94+z*.342)*.31-Math.sqrt(9.81*.31)*t)
    +.074*Math.sin((-x*.6+z*.8)*.49-Math.sqrt(9.81*.49)*t+1.7)
    +.032*Math.sin((x*.8-z*.6)*.91-Math.sqrt(9.81*.91)*t+3.1));
}

function runoffAtlas(cover) {
  const {width,height}=cover.image,canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(cover.image,0,0);
  const a=ctx.getImageData(0,0,width,height).data;
  return (x,z)=>{
    const u=Math.floor((x+18)/36*width),v=Math.floor((z+49)/98*height);
    if(u<0||u>=width||v<0||v>=height)return null;
    const i=4*(v*width+u);return {y:a[i]/255*40-4,wet:a[i+1]/255,kind:a[i+2]};
  };
}

// Sample the existing rain-cover atlas only at construction. Every drip starts
// just outside a visible roof, terminates on its lower receiver, and keeps that
// receiver fixed. Neither CPU raycasts nor particle allocation run per frame.
function roofRunoff(cover,clock,roofAt) {
  const at=runoffAtlas(cover),sources=[];
  for(let z=-45;z<45;z+=.42)for(let x=-15;x<15;x+=.42){
    const top=at(x,z);
    if(!top||top.kind<128||top.y<1.8||top.y>5)continue;
    for(const [dx,dz] of [[-.26,0],[.26,0],[0,-.26],[0,.26]]){
      const lower=at(x+dx,z+dz),inside=at(x-dx*.5,z-dz*.5);
      if(!lower||lower.y<-.12||top.y-lower.y<.9||Math.abs(inside?.y-top.y)>.09)continue;
      const px=x+dx,pz=z+dz;
      if(sources.some(s=>(s.x-px)**2+(s.z-pz)**2<2.25))continue;
      const roof=roofAt(x,z),floor=roofAt(px,pz);
      if(Math.abs(roof-top.y)>.15||roof-floor<.9||floor<-.12)continue;
      sources.push({x:px,z:pz,top:roof-.015,bottom:floor+.016,cloth:top.kind===255});break;
    }
  }
  const p=[],drop=[];
  for(let i=0;i<sources.length;i++){
    const s=sources[i];
    for(let j=0;j<4;j++)for(let end=0;end<2;end++){
      p.push(s.x,s.top,s.z);
      drop.push(s.bottom,(i*.6180339+j*.25)%1,end,s.cloth?1:0);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('drip',new THREE.Float32BufferAttribute(drop,4));
  const material=new THREE.ShaderMaterial({uniforms:{clock},transparent:true,depthWrite:false,
    vertexShader:`attribute vec4 drip;uniform float clock;varying float alpha;
      void main(){
        float span=max(.1,position.y-drip.x),fallTime=sqrt(2.*span/9.81);
        float period=fallTime+.35+drip.w*.19;
        float age=mod(clock+drip.y*period,period),u=min(age,fallTime);
        float distance=.5*9.81*u*u;
        float streak=(.028+.08*u)*drip.z;
        vec3 p=position+vec3(-.035*u*u,-min(span,distance+streak),.012*u);
        vec4 eye=modelViewMatrix*vec4(p,1.);
        alpha=step(age,fallTime)*(.38-.23*drip.z)*smoothstep(.02,.12,u)
          *(1.-smoothstep(12.,27.,-eye.z))*smoothstep(.05,.35,span-distance);
        gl_Position=projectionMatrix*eye;
      }`,fragmentShader:`varying float alpha;void main(){gl_FragColor=vec4(.71,.80,.84,alpha);}`});
  const mesh=new THREE.LineSegments(g,material);mesh.name='transport-roof-runoff';
  mesh.frustumCulled=false;mesh.raycast=()=>{};mesh.userData.sources=sources;
  return mesh;
}

// Original gull mesh: tapered body, tail fan and bent, narrow primaries.
// Nine silhouettes share one instanced draw and one analytic flight clock.
function harbourGulls(clock) {
  const p=[],col=[],colours=[new THREE.Color(0xbfc5c1),new THREE.Color(0x46504f)];
  function tri(a,b,c,tint=0){for(const v of [a,b,c]){p.push(...v);col.push(...colours[tint].toArray());}}
  const rings=[[.27,.018],[.18,.065],[-.05,.075],[-.22,.015]];
  for(let r=0;r<3;r++)for(let j=0;j<8;j++){
    const point=(k,theta)=>[Math.cos(theta)*rings[k][1],Math.sin(theta)*rings[k][1]*.8,rings[k][0]];
    const a=j*Math.PI/4,b=(j+1)*Math.PI/4;
    tri(point(r,a),point(r,b),point(r+1,a));tri(point(r,b),point(r+1,b),point(r+1,a));
  }
  tri([-.025,0,-.16],[.10,.008,-.32],[-.10,.008,-.32]);
  for(const s of [-1,1]){
    const leading=[[s*.04,.015,.10],[s*.24,.045,.07],[s*.47,.012,-.03],[s*.69,-.025,-.21]];
    const trailing=[[s*.04,.015,-.10],[s*.25,.045,-.16],[s*.48,.012,-.17],[s*.69,-.025,-.21]];
    for(let j=0;j<3;j++){
      tri(leading[j],trailing[j],leading[j+1],j===2?1:0);
      tri(trailing[j],trailing[j+1],leading[j+1],j===2?1:0);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide,envMapIntensity:.4});
  m.onBeforeCompile=shader=>{
    shader.uniforms.uGullTime=clock;
    shader.vertexShader='uniform float uGullTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float beat=.5+.5*sin(uGullTime*.67+instanceMatrix[3].x*.1);
      float lift=sin(uGullTime*7.1+instanceMatrix[3].x*.12)*smoothstep(.56,.9,beat);
      transformed.y+=pow(abs(position.x),1.3)*.65*lift;
      transformed.z+=abs(position.x)*.07*lift;`);
  };
  m.customProgramCacheKey=()=>'harbour-gull-wings-1';
  const mesh=new THREE.InstancedMesh(g,m,9);mesh.name='transport-harbour-gulls';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.raycast=()=>{};
  const pose=new THREE.Object3D();
  mesh.userData.update=t=>{
    for(let i=0;i<9;i++){
      const a=t*(.037+i*.0015)+i*2.399,r=62+(i%3)*12;
      pose.position.set(Math.cos(a)*r,16+(i%4)*3.2+Math.sin(t*.22+i)*1.1,Math.sin(a)*r*1.12);
      pose.rotation.set(.025*Math.sin(t*.3+i),-a, .10*Math.sin(t*.27+i)-.10);
      pose.scale.setScalar(.94+(i%3)*.09);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
    }mesh.instanceMatrix.needsUpdate=true;
  };
  mesh.userData.update(0);return mesh;
}

export function createTransportDynamics(cover,roofAt) {
  const root=new THREE.Group();root.name='transport-environment-dynamics';
  const clock={value:0},gulls=harbourGulls(clock),runoff=roofRunoff(cover,clock,roofAt);
  root.add(runoff,gulls);
  root.userData.update=t=>{clock.value=t;gulls.userData.update(t);};
  root.userData.clock=clock;
  root.userData.stats=()=>({time:clock.value,gust:freightGust(clock.value),runoffSources:runoff.userData.sources.length,
    gulls:gulls.count,batches:2,visualOnly:true});
  return root;
}

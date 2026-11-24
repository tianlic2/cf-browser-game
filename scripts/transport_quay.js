import * as THREE from 'three';

// The working waterfront sits in a shallow layer of haze. Resolve the
// upper gantries against the sky while leaving the quayside in denser air.
function quayFinish(parameters, corrugated = false) {
  const material = new THREE.MeshStandardMaterial(parameters);
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vQuayWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>', `#include <project_vertex>
      vec4 quayPosition = vec4(transformed,1.);
      #ifdef USE_INSTANCING
        quayPosition = instanceMatrix * quayPosition;
      #endif
      vQuayWorld = (modelMatrix * quayPosition).xyz;`);
    shader.fragmentShader = 'varying vec3 vQuayWorld;\n' + shader.fragmentShader.replace(
      '#include <fog_fragment>', `#ifdef USE_FOG
        float distanceFog = smoothstep(fogNear,fogFar,vFogDepth);
        float waterHaze = mix(.96,.56,smoothstep(9.,43.,vQuayWorld.y));
        gl_FragColor.rgb = mix(gl_FragColor.rgb,fogColor,distanceFog*waterHaze);
      #endif`);
    if (corrugated) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        // Broad courses and runoff are visible at lane distances; fine ribs
        // are attenuated once the pixel footprint exceeds their spacing.
        float height = vQuayWorld.y;
        float course = abs(fract(height/3.5)-.5);
        float aa = max(.013,fwidth(height)/3.5);
        float seam = 1.-smoothstep(.004,.008+aa,course);
        float u = vQuayWorld.x*.81 + vQuayWorld.z*.54;
        float ribs = cos(u*10.)*(1.-smoothstep(.08,.35,fwidth(u)));
        float runoff = sin(u*2.1+.6*sin(u*.87))*sin(height*.19+u*.8);
        diffuseColor.rgb *= 1.-.19*seam+.042*ribs+.062*runoff;`);
    }
    if(!corrugated){
      shader.vertexShader='attribute float yardRole; varying float vYardRole;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvYardRole=yardRole;');
      shader.fragmentShader='varying float vYardRole;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec3 yardN=inverseTransformDirection(normalize(vNormal),viewMatrix);
        float yardSide=abs(yardN.x)>.5?vQuayWorld.z:vQuayWorld.x;
        float yardFilter=1.-smoothstep(.12,.55,fwidth(yardSide));
        float yardVertical=1.-smoothstep(.15,.7,abs(yardN.y));
        if(vYardRole>.5&&vYardRole<1.5){
          float ribs=cos(yardSide*22.5)*yardFilter*yardVertical;
          float streak=sin(yardSide*.85+sin(yardSide*2.4))*.05;
          diffuseColor.rgb*=.93+.09*ribs+streak*yardVertical;
        }
        if(vYardRole>1.5&&vYardRole<2.5){
          float joint=1.-smoothstep(.008,.025+fwidth(yardSide),abs(fract(yardSide/4.)-.5));
          float tide=exp(-pow((vQuayWorld.y+2.9)*1.7,2.));
          float mineral=sin(yardSide*3.1+sin(vQuayWorld.y*2.))*sin(yardSide*.43)*.045;
          diffuseColor.rgb*=1.-.15*joint-.29*tide+mineral;
        }
        if(vYardRole>2.5){
          float seam=1.-smoothstep(.006,.025+fwidth(vQuayWorld.y),abs(fract(vQuayWorld.y/1.8)-.5));
          diffuseColor.rgb*=1.-.12*seam+.04*sin(yardSide*3.2)*yardVertical;
        }`).replace('#include <emissivemap_fragment>',`
        if(vYardRole>.5&&vYardRole<1.5){
          vec3 tangent=abs(yardN.x)>.5?vec3(0.,0.,1.):vec3(1.,0.,0.);
          normal=normalize(normal+mat3(viewMatrix)*tangent*sin(yardSide*22.5)*.26*yardFilter*yardVertical);
        }
        #include <emissivemap_fragment>`);
    }
  };
  material.customProgramCacheKey = () => 'quay-altitude-detail-2-' + corrugated;
  return material;
}

// Off-ship scenery. Dimensions in metres, relative to the waterline at -3.42.
function boilerVapour(clock) {
  const positions=[], corners=[], phases=[], indices=[];
  const stacks=[[-54,52.4,139],[24,45.4,-118]];
  for(const [x,y,z] of stacks) for(let j=0;j<13;j++){
    const start=positions.length/3;
    for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      positions.push(x,y,z); corners.push(u,v); phases.push(j/13);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(indices);
  for(const [key,values,n] of [['position',positions,3],['corner',corners,2],['phase',phases,1]])
    geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,n));
  const material=new THREE.ShaderMaterial({
    uniforms:{clock},transparent:true,depthWrite:false,
    vertexShader:`
      attribute vec2 corner; attribute float phase; uniform float clock;
      varying vec2 local; varying float age; varying float seed;
      void main(){
        age=fract(phase+clock*.087);
        seed=phase*43.+position.x*.18;
        vec3 p=position+vec3(-20.*age*age+sin(seed+age*5.)*age,
          15.*age-4.*age*age,2.4*age);
        vec4 view=modelViewMatrix*vec4(p,1.);
        view.xy+=corner*vec2(1.+6.*age,1.5+3.7*age);
        local=corner; gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`
      varying vec2 local; varying float age; varying float seed;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.31,17.73)))*14373.17);}
      float noise(vec2 p){
        vec2 cell=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),
                   mix(hash(cell+vec2(0.,1.)),hash(cell+1.),f.x),f.y);
      }
      void main(){
        vec2 p=local*2.3+vec2(seed,age*1.8);
        float cloud=.68*noise(p)+.32*noise(p*2.3);
        float edge=1.-smoothstep(.18,.98,length(local)+.54*(.5-cloud));
        float alpha=edge*(.09+.23*cloud)*smoothstep(0.,.12,age)*(1.-smoothstep(.42,1.,age));
        gl_FragColor=vec4(mix(vec3(.36,.33,.29),vec3(.78,.76,.71),cloud+.12*local.y),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const vapour=new THREE.Mesh(geometry,material);
  vapour.name='transport-boiler-vapour';
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius+=31;
  return vapour;
}

export function createTransportQuay(clock) {
  const parts=[], silos=[];
  const upright=new THREE.Vector3(0,1,0);
  const origin=new THREE.Vector3(), delta=new THREE.Vector3(), rotation=new THREE.Quaternion();
  const column='#525e60', brace='#445355', rail='#818783', machinery='#a58151';
  function box(x,y,z,w,h,d,colour,role=0) {
    parts.push({matrix:new THREE.Matrix4().makeScale(w,h,d).setPosition(x,y,z),colour,role});
  }
  function beam(a,b,width,depth,colour=brace) {
    origin.fromArray(a);
    delta.fromArray(b).sub(origin);
    const length=delta.length();
    origin.addScaledVector(delta,.5);
    rotation.setFromUnitVectors(upright,delta.normalize());
    parts.push({matrix:new THREE.Matrix4().compose(origin,rotation,new THREE.Vector3(width,length,depth)),colour});
  }
  // Portals straddle two rails on the wharf. The projecting truss carries
  // the trolley; the rear machinery house counterbalances the waterside arm.
  function crane(cx,cz,scale,heading) {
    const first=parts.length;
    for(const z of [-6,6]) {
      for(const x of [-8,8]) {
        box(x,-.6,z,2.6,2.2,4,column);
        beam([x,0,z],[x*.7,21,z],1.1,1.15,column);
      }
      beam([-6.9,10,z],[6.9,10,z],.72,.72,column);
      beam([-6.9,10,z],[5.6,21,z],.52,.52);
      beam([6.9,10,z],[-5.6,21,z],.52,.52);
      beam([-5.6,21,z],[1,31,z],.75,.75,column);
      beam([7,21,z],[1,31,z],.75,.75,column);
      beam([1,31,z],[-25,22,z],.2,.2,rail);
      beam([1,31,z],[14,22,z],.24,.24,rail);
      for(const y of [20,22]) beam([-30,y,z],[16,y,z],.52,.48,column);
      for(let x=-30;x<15;x+=3) beam([x,20,z],[x+3,22,z],.18,.18);
    }
    for(const x of [-8,8]) {
      beam([x,1,-6],[x,1,6],.7,.8,column);
      beam([x*.8,13,-6],[x*.7,20,6],.48,.5);
      beam([x*.8,13,6],[x*.7,20,-6],.48,.5);
    }
    for(const x of [-30,-18,-6,6,16]) beam([x,20,-6],[x,20,6],.42,.42,column);
    beam([1,31,-6],[1,31,6],.65,.65,column);
    box(10,23,0,8,3.1,11,machinery);
    box(10,24.7,0,8.6,.38,11.6,rail);
    box(-12,20,0,4,1.4,12,column);
    box(-12,18.6,5,2.6,2.1,2.7,machinery);
    box(-12,18.9,6.36,2.25,.82,.05,'#384d54');
    for(const x of [-13,-11]) for(const z of [-2,2]) beam([x,19,z],[x,9,z],.10,.10);
    box(-12,8.8,0,2.9,.6,6,machinery);
    const transform=new THREE.Matrix4().makeRotationY(heading).scale(new THREE.Vector3(scale,scale,scale)).setPosition(cx,0,cz);
    for(let i=first;i<parts.length;i++) parts[i].matrix.premultiply(transform);
  }
  box(33,-2.65,101,116,4,26,'#686967',2);
  box(74,-2.65,-10,43,4,198,'#686967',2);
  box(33,-.57,88,116,.16,.34,'#8e9389');
  box(52.5,-.57,-10,.34,.16,198,'#8e9389');
  crane(18,101,1.03,.22);
  crane(65,52,.90,.04);
  crane(65,-62,1.14,-.14);
  const freightColours=['#536568','#946653','#606f77','#a18d6e'];
  for(let bay=0;bay<13;bay++) {
    for(let tier=0;tier<1+(bay*7%4);tier++) {
      const x=64+bay%2*8,y=.63+tier*2.59,z=-94+bay*13;
      box(x,y,z,2.44,2.59,12.1,freightColours[(bay+tier*3)%4],1);
      for(const sx of [-1,1])for(const sz of [-1,1])box(x+sx*1.19,y,z+sz*6.02,.075,2.59,.075,'#657579');
      for(const sy of [-1,1]){
        for(const sx of [-1,1])box(x+sx*1.19,y+sy*1.26,z,.075,.075,12.1,'#81908b');
        for(const sz of [-1,1])box(x,y+sy*1.26,z+sz*6.02,2.44,.075,.075,'#81908b');
      }
    }
  }
  // Bulk terminal behind the working quay. The elevator headhouse breaks the
  // skyline above the ship's stack, with lower bins stepping away to port.
  function bin(x,z,r,h) {
    const metal='#a5aba3', rim='#727e7b';
    function ring(y,height,lower,upper,colour,open=true) {
      silos.push({x,y,z,height,lower,upper,colour,open});
    }
    ring(h/2-.6,h,r,r,metal);
    ring(h-.60+.92,1.84,r+.12,.57,'#8b9895');
    for(const y of [h-.7,h*.48,h*.73]) ring(y,.16,r+.08,r+.08,rim);
    ring(h+1.39,.30,.6,.6,rim,false);
  }
  function conveyor(x1,y1,z1,x2,y2,z2) {
    for(const dx of [-.90,.90]) {
      for(const dy of [0,1.65]) beam([x1+dx,y1+dy,z1],[x2+dx,y2+dy,z2],.19,.19,brace);
      const segments=Math.ceil(Math.hypot(y2-y1,z2-z1)/3.7);
      for(let i=0;i<segments;i++) {
        const t=i/segments,u=(i+1)/segments;
        beam([x1+(x2-x1)*t+dx,y1+(y2-y1)*t+(i%2)*1.65,z1+(z2-z1)*t],
          [x1+(x2-x1)*u+dx,y1+(y2-y1)*u+(1-i%2)*1.65,z1+(z2-z1)*u],.12,.12,brace);
      }
    }
    beam([x1,y1,z1],[x2,y2,z2],2.12,.32,'#737e78');
  }
  box(-10,-2.6,126,91,4,48,'#838581',2);
  for(const [x,z,h] of [[-30,117,37],[-20.8,117,35],[-30,126,38],[-20.8,126,36]])bin(x,z,4.38,h);
  // Hopper legs and access platforms are visible through the space below the headhouse.
  for(const dx of [-3.1,3.1])for(const dz of [-3,3]) {
    box(-5+dx,14,125+dz,.68,29,.74,column);
    beam([-5+dx,1,125+dz],[-5-dx,14.5,125+dz],.32,.32,brace);
    beam([-5+dx,14.5,125+dz],[-5-dx,28,125+dz],.32,.32,brace);
  }
  box(-5,35.5,125,7.4,17,7.0,'#969f97');
  box(-5,44.26,125,8.1,.52,7.6,rail);
  box(-5,40.6,121.44,5.5,1.32,.18,'#46565b');
  for(const x of [-6.7,-5,-3.3]) box(x,40.6,121.30,.14,1.36,.15,rail);
  box(-5,28,125,8.2,.42,7.9,rail);
  conveyor(1,15.8,104,-5,28,125);
  conveyor(-5,38.2,125,-23,36.8,122);

  // A ship-loader gallery crosses the gap from the elevator to the pier.
  // The glazed operator floor projects over the rusty cladding below it.
  const oxide='#966650', fascia='#a48b70', glass='#435b61', enamel='#c1bda8';
  box(-13,12.4,98,9,26,9,'#6d7775');
  box(-13,30.4,98,9.2,10.2,9.4,oxide);
  box(-13,36.8,97.3,11.8,3.3,11.6,glass);
  box(-13,38.6,97.3,12.5,.48,12.1,enamel);
  box(-13,35.25,97.1,12.4,.52,12.2,fascia);
  for(let i=0;i<6;i++)box(-18.7+i*2.28,36.8,91.46,.19,3.0,.18,enamel);
  for(let i=0;i<5;i++)box(-7.02,36.8,92.3+i*2.24,.16,3.0,.18,enamel);
  for(let i=0;i<5;i++)box(-16.8+i*1.9,30.4,93.21,.13,9.8,.21,fascia);
  // Sloping covered belt, its lower service walk and the open trestle below.
  beam([-34,25,110],[-13,32.1,98],3.0,3.2,'#93765d');
  beam([-34,23.4,110],[-13,30.5,98],3.5,.48,column);
  for(const t of [.22,.58]){
    const x=-34+21*t,z=110-12*t,y=23.4+7.1*t;
    for(const dx of [-1.5,1.5]){
      box(x+dx,y/2,z,.54,y,.58,column);
      beam([x+dx,9,z],[x-dx,19,z],.26,.27,brace);
    }
  }
  // Dog-leg maintenance stair. Landings project on alternating floors.
  for(let i=0;i<3;i++){
    const low=14+i*5, a=i%2===0?-17.1:-9,b=i%2===0?-9:-17.1;
    beam([a,low,92.2],[b,low+5,92.2],.54,1.45,brace);
    beam([a,low+1.1,91.45],[b,low+6.1,91.45],.11,.11,fascia);
    for(const t of [0,.5,1])box(a+(b-a)*t,low+5*t+.55,91.45,.11,1.1,.11,fascia);
    box(b,low+5,92.2,1.9,.34,2.4,rail);
  }

  // Beyond the terminal, the channel bridge picks up more of the scene fog.
  const bridgeZ=155;
  const abutments=[-83,-62,42,63];
  for(const x of abutments) {
    box(x,7,bridgeZ,2.5,17,5.1,'#858e8c');
    box(x,15.7,bridgeZ,3.8,1.3,6.5,'#838c89');
  }
  box(-10,16.85,bridgeZ,146,.87,5.6,'#7d8a88');
  // Leave the navigable span open. Two arch ribs support the deck on hangers.
  const ribY=t=>18+26*4*t*(1-t);
  for(const side of [-2.65,2.65]) {
    const z=bridgeZ+side;
    for(let i=0;i<16;i++) {
      const t=i/16,u=(i+1)/16,x=-62+104*t,nextX=-62+104*u;
      beam([x,ribY(t),z],[nextX,ribY(u),z],.72,.82,'#66797b');
      if(i>0)beam([x,17.25,z],[x,ribY(t),z],.18,.22,'#718183');
      if(side<0 && i%2===0)beam([x,ribY(t),z],[x,ribY(t),bridgeZ-side],.25,.34,'#718183');
    }
  }

  // A repair-yard hammerhead stands across the water from the grain bins.
  // The inclined legs, turning deck, overhanging cab and short counterweight
  // remain visible as separate shapes from the two deck lanes.
  const towerX=11,towerZ=115;
  for(const dz of [-3.5,3.5]) {
    for(const sign of [-1,1]) {
      beam([towerX+sign*6,0,towerZ+dz],[towerX+sign*2.5,45,towerZ+dz],.94,.94,column);
    }
    for(let j=0;j<4;j++) {
      const y=3+j*10;
      const width=6-y*.077;
      beam([towerX-width,y,towerZ+dz],[towerX+width-.77,y+10,towerZ+dz],.48,.45,brace);
      beam([towerX+width,y,towerZ+dz],[towerX-width+.77,y+10,towerZ+dz],.48,.45,brace);
    }
    for(const y of [46,50])beam([towerX-18,y,towerZ+dz],[towerX+11,y,towerZ+dz],.64,.54,'#7b7667');
    for(let j=0;j<8;j++) {
      const x=towerX-18+j*3.6;
      beam([x,46+4*(j%2),towerZ+dz],[x+3.6,50-4*(j%2),towerZ+dz],.39,.37,'#796e5e');
    }
  }
  box(towerX,45.2,towerZ,7.7,1.35,8.7,column);
  box(towerX+8.1,48.4,towerZ,6.7,4.8,7.8,'#947453');
  box(towerX-9.5,45,towerZ-2.5,4,2,3,'#a08b68');
  box(towerX-9.6,45.35,towerZ-4.05,3.3,.85,.12,'#454f51');
  for(const dx of [-1,1])beam([towerX-16+dx,46,towerZ],[towerX-16+dx,31,towerZ],.15,.15,brace);
  box(towerX-16,30.8,towerZ,3.2,.61,1.7,column);

  // The boiler house is a solid sawtooth roof, not a row of disconnected
  // gables. Its tall north lights face the channel. A lower annex steps down
  // toward the bridge. Reuse the terminal's vertex-colour draw for the roofs.
  const roofFaces=[];
  function roofTriangle(a,b,c,colour) {roofFaces.push({a,b,c,colour});}
  function workshop(x,z,base,width,depth,bays,rise) {
    box(x+width/2,base/2-1,z,width,base+2,depth,'#88918b',3);
    const near=z-depth/2,far=z+depth/2,span=width/bays;
    for(let i=0;i<bays;i++) {
      const left=x+i*span, right=left+span;
      const a=[left,base,near],b=[right,base+rise,near],c=[right,base,near];
      const d=[left,base,far],e=[right,base+rise,far],f=[right,base,far];
      roofTriangle(a,b,c,'#90958c'); roofTriangle(d,f,e,'#828b89');
      roofTriangle(a,e,b,'#606e70'); roofTriangle(a,d,e,'#606e70');
      roofTriangle(c,e,f,'#58686a'); roofTriangle(c,b,e,'#58686a');
    }
    box(x+width/2,base-2,near-.05,width-.6,1.85,.17,'#5d6e6d');
    for(let i=0;i<=bays;i++)box(x+i*span,base-2,near-.14,.35,2.1,.27,'#90968c');
  }
  workshop(-71,132,23,36,17,4,5.8);
  workshop(-82,137,16,11,13,2,3.6);
  workshop(8,-110,26,37,18,5,5.1);
  for(const [x,z,h] of [[-54,139,52],[-60,144,43],[24,-118,45]]) {
    silos.push({x,y:h/2,z,height:h,lower:1.65,upper:1.16,colour:'#92796f'});
    for(const f of [.80,.94])silos.push({x,y:h*f,z,height:h*.052,lower:1.30,upper:1.27,colour:'#c0b9a9'});
    silos.push({x,y:h,z,height:.60,lower:1.30,upper:1.34,colour:'#636a69'});
  }

  // Cull the far and near ends independently as the player turns on deck.
  const cube=new THREE.BoxGeometry(1,1,1);
  const yardPaint=quayFinish({roughness:.92,metalness:.05,envMapIntensity:.18});
  const reaches=[[],[],[]];
  for(const part of parts){
    const z=part.matrix.elements[14];
    reaches[z<0?2:z<82?1:0].push(part);
  }
  const batches=reaches.map(reach=>{
    const geometry=cube.clone();geometry.setAttribute('yardRole',new THREE.InstancedBufferAttribute(new Float32Array(reach.map(p=>p.role||0)),1));
    const batch=new THREE.InstancedMesh(geometry,yardPaint,reach.length);
    reach.forEach(({matrix,colour},i)=>{batch.setMatrixAt(i,matrix);batch.setColorAt(i,new THREE.Color(colour));});
    batch.computeBoundingSphere();
    return batch;
  });
  const [mesh,...otherReaches]=batches;
  mesh.add(...otherReaches);
  mesh.name='transport-distant-quay';
  const fenders=[];
  for(let z=-102;z<90;z+=8)fenders.push([52.23,-1.8,z,-Math.PI/2]);
  for(let x=-20;x<91;x+=8)fenders.push([x,-1.8,87.73,Math.PI]);
  const tires=new THREE.InstancedMesh(new THREE.TorusGeometry(.43,.13,6,12),new THREE.MeshStandardMaterial({color:0x26302d,roughness:.96}),fenders.length);
  const pose=new THREE.Object3D();fenders.forEach(([x,y,z,yaw],i)=>{pose.position.set(x,y,z);pose.rotation.set(0,yaw,0);pose.updateMatrix();tires.setMatrixAt(i,pose.matrix);});
  tires.name='transport-quay-fenders';tires.computeBoundingSphere();mesh.add(tires);
  // Merge the bin walls, rolled seams and roofs for a single terminal draw.
  const positions=[],normals=[],colours=[];
  for(const {a,b,c,colour} of roofFaces) {
    const normal=new THREE.Vector3().fromArray(b).sub(new THREE.Vector3().fromArray(a))
      .cross(new THREE.Vector3().fromArray(c).sub(new THREE.Vector3().fromArray(a))).normalize();
    const tint=new THREE.Color(colour);
    for(const p of [a,b,c]){positions.push(...p);normals.push(normal.x,normal.y,normal.z);colours.push(tint.r,tint.g,tint.b);}
  }
  for(const {x,y,z,height,lower,upper,colour,open} of silos) {
    const section=new THREE.CylinderGeometry(upper,lower,height,lower<2?12:20,1,open ?? (lower<2 && height<4)).toNonIndexed();
    const pos=section.attributes.position, n=section.attributes.normal, c=new THREE.Color(colour);
    for(let i=0;i<pos.count;i++) {
      positions.push(pos.getX(i)+x,pos.getY(i)+y,pos.getZ(i)+z);
      normals.push(n.getX(i),n.getY(i),n.getZ(i));colours.push(c.r,c.g,c.b);
    }
    section.dispose();
  }
  const bins=new THREE.BufferGeometry();
  for(const [key,values] of [['position',positions],['normal',normals],['color',colours]])
    bins.setAttribute(key,new THREE.Float32BufferAttribute(values,3));
  const terminal=new THREE.Mesh(bins,quayFinish({
    vertexColors:true,roughness:.81,metalness:.14,envMapIntensity:.35,
  },true));
  terminal.name='transport-bulk-terminal';
  mesh.add(terminal,boilerVapour(clock));
  return mesh;
}

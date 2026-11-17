import { MAIN_PORTAL, mainPortalWallHalf, MAIN_HALL, MAIN_HALL_FLOOR_Y, MAIN_HALL_SCALE, MAIN_HALL_STAIRS, mainHallStair } from './lingyin_main_hall.js?v=grand-portal-1';

// Use the existing lime / timber atlas. These surfaces already receive the
// hall's doorway daylight; this layer only changes albedo and roughness.
function porchFinish(material, atlas, name, surface) {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.uPorchCraft = { value: atlas };
    shader.fragmentShader = 'uniform sampler2D uPorchCraft;\n' + shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n{\n' + surface + '\n}');
  };
  material.customProgramCacheKey = () => key + '-porch-' + name;
}

export function finishHallPorch(world) {
  const wall = world.getObjectByName('temple-mainWall').material;
  const atlas = wall.bumpMap;
  const wallZ = MAIN_HALL.z + MAIN_HALL.d / 2 - 1.35 + .15;
  const bayPitch = (MAIN_HALL.w - 2.2) / 5;
  const head = MAIN_HALL.eave - MAIN_HALL.plinth - .75 + 1.25;
  const coords = `
    vec3 porch=vec3(vDoorLightPosition.x-(${MAIN_HALL.x.toFixed(2)}),
                    vDoorLightPosition.y,vDoorLightPosition.z-(${wallZ.toFixed(3)}));
    vec2 panel=vec2(abs(porch.x)-${MAIN_PORTAL.flankX.toFixed(4)},
                    porch.y-${(MAIN_HALL_FLOOR_Y+2.65).toFixed(2)});
  `;
  porchFinish(wall, atlas, 'lime', coords + `
    if(porch.z>-.025 || (abs(abs(porch.x)-${mainPortalWallHalf.toFixed(3)})<.025 && porch.z>-.30)) {
      // Signed distance to the raised frame, not a dark outline on every bay.
      vec2 q=abs(panel)-vec2(${(2.095*MAIN_HALL_SCALE.x).toFixed(4)},2.69);
      float frameDist=abs(length(max(q,0.))+min(max(q.x,q.y),0.));
      float headDist=abs(porch.y-${head.toFixed(3)});
      float edgeDist=abs(abs(porch.x)-${mainPortalWallHalf.toFixed(3)});
      float plaster=texture2D(uPorchCraft,porch.xy*.29+vec2(.21,.03)).r-.5;
      float sand=texture2D(uPorchCraft,porch.xy*1.72).r-.5;
      float sheltered=exp(-headDist*1.85);
      float bed=exp(-frameDist*10.)+.55*exp(-edgeDist*14.);
      float foot=1.-smoothstep(2.45,3.15,porch.y+plaster*.18);
      float flank=smoothstep(${mainPortalWallHalf.toFixed(3)},${(mainPortalWallHalf+.35).toFixed(3)},abs(porch.x))*(1.-smoothstep(9.38,10.38,porch.y));
      diffuseColor.rgb*=mix(vec3(.936,.912,.875),vec3(.98,.625,.222),flank)*(1.+.23*plaster+.07*sand);
      diffuseColor.rgb*=1.-.27*bed-.28*sheltered-.10*foot;
      roughnessFactor=clamp(.92+.10*sand+.04*bed,.85,1.);
    }`);

  // The rails butt between the stiles; orient grain separately even around
  // their corners. Restrict the response to the two existing facade frames.
  porchFinish(world.getObjectByName('hall-structure-lacquer').material,atlas,'frame',coords + `
    if(porch.z>.035 && porch.z<.285 && abs(panel.x)<2.45 && abs(panel.y)<2.78) {
      bool stile=abs(panel.x)>${(1.925*MAIN_HALL_SCALE.x-.001).toFixed(4)};
      vec2 grainUv=stile?porch.xy:porch.yx;
      float grain=texture2D(uPorchCraft,grainUv*vec2(1.5,.51)).b-.5;
      float across=stile?abs(abs(panel.x)-${(2.01*MAIN_HALL_SCALE.x).toFixed(4)}):abs(abs(panel.y)-2.7);
      float arris=smoothstep(stile?.070:.058,stile?.094:.080,across);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.138,.038,.020)*(1.+.72*grain),.84);
      diffuseColor.rgb*=1.+.19*arris;
      roughnessFactor=.59+.12*grain-.08*arris;
    }`);

  porchFinish(world.getObjectByName('temple-mainWood').material,atlas,'joinery',coords + `
    // The wide tie beams run across the front; the lower bay heads have short
    // upright jambs. Leave the hand-polished round columns outside both masks.
    bool beam=porch.y>10.48 && porch.y<11.24 && porch.z>.06 && porch.z<1.27;
    float bay=clamp(floor(abs(porch.x)/${bayPitch.toFixed(3)}+.5),1.,2.);
    float nearBay=abs(abs(porch.x)-bay*${bayPitch.toFixed(3)});
    bool casing=porch.z>-.095 && porch.z<.155 && porch.y<4.94 &&
      (abs(nearBay-2.845)<.084 || (abs(porch.y-4.85)<.09 && nearBay<2.85));
    float pillar=step(.11,porch.z)*step(porch.z,.65)*step(2.36,porch.y)*step(porch.y,10.42);
    if(pillar>.5 && !beam && !casing) diffuseColor.rgb=mix(diffuseColor.rgb,
      diffuseColor.rgb*vec3(1.62,1.11,.98)+vec3(.032,.002,.001),.78);
    if(beam || casing) {
      bool alongX=beam || abs(porch.y-4.85)<.09;
      vec2 uvWood=alongX?vec2(porch.y+.6*porch.z,porch.x):porch.xy;
      float grain=texture2D(uPorchCraft,uvWood*vec2(1.45,.64)).b-.5;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.128,.048,.027)*(1.+.72*grain),.69);
      float seam=beam?exp(-abs(porch.y-10.88)*15.):exp(-abs(porch.y-4.77)*24.);
      diffuseColor.rgb*=1.-.20*seam;
      roughnessFactor=.64+.16*grain;
    }`);

  const frontNose=MAIN_HALL.z+mainHallStair(0).z+(MAIN_HALL_STAIRS.treadDepth+.02)/2;
  const stone=world.getObjectByName('temple-mainStone').material;
  const rail=world.getObjectByName('main-hall-stair-carving').material;
  rail.bumpMap=atlas;rail.bumpScale=.0035;
  porchFinish(rail,stone.map,'carving',`
    vec2 uvStone=vBumpMapUv;
    float sand=texture2D(bumpMap,uvStone*2.65).r-.5;
    float cloud=dot(texture2D(uPorchCraft,uvStone*.72+vec2(.17,.43)).rgb,vec3(.24,.59,.17));
    diffuseColor.rgb*=vec3(.92,.95,.97)*(.82+.54*sqrt(cloud)+.19*sand);
    float up=clamp(inverseTransformDirection(normalize(vNormal),viewMatrix).y,0.,1.);
    roughnessFactor=.91-.12*up+.07*sand;`);

  porchFinish(stone,atlas,'terrace',`
    vec3 p=vTemplePosition;
    float architecturalStone=step(${(MAIN_HALL.z+MAIN_HALL.d/2-.5).toFixed(2)},p.z);
    if(architecturalStone>.5 && p.y<${(MAIN_HALL_FLOOR_Y+.08).toFixed(2)}) {
      float luma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      float mineral=texture2D(uPorchCraft,(p.xy+p.z*.26)*1.15).r-.5;
      vec3 granite=vec3(.29,.282,.262)*(.78+.57*sqrt(max(luma,0.))+.11*mineral);
      diffuseColor.rgb=mix(diffuseColor.rgb,granite,.73);
      roughnessFactor=max(.74,roughnessFactor);
      float course=(${frontNose.toFixed(3)}-p.z)/${MAIN_HALL_STAIRS.treadDepth};
      if(course>=0. && course<${MAIN_HALL_STAIRS.count.toFixed(1)} && abs(p.x-(${MAIN_HALL.x.toFixed(2)}))<=${(MAIN_HALL_STAIRS.width/2).toFixed(2)}) {
        float shift=mod(floor(course+.02),2.)*.78;
        float joint=abs(fract((p.x+shift)/1.62+.5)-.5)*1.62;
        float cut=1.-smoothstep(.003,.009+min(fwidth(p.x),.015),joint);
        float stepIndex=clamp(floor((p.y+.02-.24)/${MAIN_HALL_STAIRS.treadHeight}+.01),0.,11.);
        float dist=${frontNose.toFixed(3)}-stepIndex*${MAIN_HALL_STAIRS.treadDepth}-p.z;
        float up=clamp(inverseTransformDirection(normalize(vNormal),viewMatrix).y,0.,1.);
        float axis=p.x-(${MAIN_HALL.x.toFixed(2)})+.24*sin(stepIndex*1.37);
        float path=(1.-smoothstep(.55,3.25,abs(axis)+mineral*.50));
        float slab=fract(sin(dot(vec2(floor((p.x+shift)/1.62+.5),stepIndex),vec2(43.27,17.61)))*3183.3);
        float surface=dot(texture2D(map,vMapUv*1.72+vec2(.127,.46)).rgb,vec3(.27,.52,.21));
        float crystal=texture2D(uPorchCraft,(p.xz+p.y*.17)*4.6).r-.5;
        float tread=path*smoothstep(.28,.94,up);
        float lip=(1.-smoothstep(.005,.075+.024*slab,max(0.,dist)))*smoothstep(.15,.88,up);
        float interrupted=.46+.54*smoothstep(-.18,.15,mineral+.18*sin(p.x*4.3+stepIndex));
        vec3 rock=vec3(.28,.294,.294)*(.77+.34*surface+.27*mineral+.11*crystal+.16*(slab-.5));
        diffuseColor.rgb=mix(diffuseColor.rgb,rock,.84);
        diffuseColor.rgb*=1.-.25*cut-.11*tread+.19*path*lip*interrupted;
        roughnessFactor=mix(.94,.73,tread)+.025*mineral;

      }
    }
    // These front-row shoes are the only mainStone faces above terrace level
  // at the post line. Shoulders are rubbed; a fine-grained skirt remains below.
    float shoeY=vTemplePosition.y-${MAIN_HALL_FLOOR_Y};
    if(shoeY>.001 && shoeY<.302 && abs(vTemplePosition.z-(${(MAIN_HALL.z+MAIN_HALL.d/2-.9).toFixed(3)}))<.47){
      vec3 p=vTemplePosition;
      float grit=texture2D(uPorchCraft,p.xy*2.7+p.z*.84).r-.5;
      float grain=dot(texture2D(map,vMapUv*1.38).rgb,vec3(.29,.55,.16));
      vec3 n=inverseTransformDirection(normalize(vNormal),viewMatrix);
      float rub=smoothstep(.17,.265,shoeY+.021*grit)*(.35+.65*max(0.,n.z));
      float dust=1.-smoothstep(.035,.115,shoeY+grit*.022);
      diffuseColor.rgb=vec3(.232,.238,.226)*(.84+.52*grain+.27*grit+.13*rub-.22*dust);
      roughnessFactor=.94-.17*rub;
    }`);
  const compileStone=stone.onBeforeCompile;
  stone.onBeforeCompile=function(shader,renderer){
    compileStone.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       if(vTemplePosition.z>${(frontNose-MAIN_HALL_STAIRS.count*MAIN_HALL_STAIRS.treadDepth-.02).toFixed(3)}
          && vTemplePosition.z<=${(frontNose+.02).toFixed(3)} && abs(vTemplePosition.x-(${MAIN_HALL.x.toFixed(2)}))<${(MAIN_HALL_STAIRS.width/2+.01).toFixed(2)})
         normal=normalize(mix(normal,nonPerturbedNormal,.68));`);
  };

  const fascia=world.getObjectByName('hall-exterior-painted-eaves').material;
  porchFinish(fascia,atlas,'fascia',`
    float rim=min(vMapUv.y,1.-vMapUv.y);
    float rebate=exp(-rim*19.);
    float brush=texture2D(uPorchCraft,vDoorLightPosition.yx*vec2(2.1,.61)).b-.5;
    diffuseColor.rgb*=mix(vec3(.96,.95,.93),vec3(.68,.64,.59),rebate)*(1.+.09*brush);
    roughnessFactor=clamp(roughnessFactor+.08*rebate+.05*brush,.64,.94);`);
}

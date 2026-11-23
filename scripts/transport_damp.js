// Added after the underlying material's colour, normal and wear adjustments.
// vShipLightPosition is the game-space position from lightTransportSurfaces,
// also correct for instanced hatch covers and the moving corner sheets.
export function dampenTransportMaterial(material, mask, finish,clock={value:0}) {
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey();
  const cloth=finish==='side' || finish==='top' || finish==='sheet';
  material.onBeforeCompile=function(shader,renderer) {
    previous.call(this,shader,renderer);
    shader.uniforms.uRainCover={value:mask};
    shader.fragmentShader='uniform sampler2D uRainCover;\n'+shader.fragmentShader;
    if(finish==='deck'){
      shader.uniforms.uShipSurfaceTime=clock;
      shader.fragmentShader=`uniform float uShipSurfaceTime;
        vec2 shipRainRing(vec2 p,float offset){
          vec2 cell=floor(p/.73),v=p-.73*(cell+.5);
          float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
          float age=mod(uShipSurfaceTime+seed*2.7+offset,1.45+seed*.9);
          float r=length(v),radius=age*.67;
          float band=(r-radius)*83.;
          float shape=band*exp(-band*band*.5);
          float fade=(1.-smoothstep(.12,.42,age))*smoothstep(0.,.035,age);
          return v/max(r,.015)*shape*fade*.07;
        }\n`+shader.fragmentShader;
    }
    const coverage=cloth ? `
      // Read just outside the formed canvas, so its own brush does not
      // shelter its side. Real overhead boxes still occlude the sky.
      vec2 outside=worldFace.xz*.36;
      vec2 uvRain=(vShipLightPosition.xz+outside+vec2(18.,49.))/vec2(36.,98.);
      float canopy=texture2D(uRainCover,uvRain).r*40.-4.;
      float open=1.-smoothstep(.16,.38,canopy-vShipLightPosition.y);
      float crown=clamp(worldFace.y,0.,1.);
      float falling=smoothstep(.40,2.65,vShipLightPosition.y);
      float edge=dot(vShipLightPosition.xz,vec2(.73,.68));
      float runoff=.5+.5*sin(edge*7.3+.64*sin(edge*3.8)+.52*vShipLightPosition.y);
      float wet=open*mix(falling*(.42+.36*runoff),1.,crown);
      ${finish==='side' ? 'wet*=smoothstep(.02,.35,texelRoughness.r);' : ''}
      diffuseColor.rgb*=1.-wet*.30;
      roughnessFactor=mix(roughnessFactor,min(roughnessFactor,max(.63,roughnessFactor-.16)),wet);
    ` : `
      vec2 uvRain=(vShipLightPosition.xz+vec2(18.,49.))/vec2(36.,98.);
      vec2 rainCover=texture2D(uRainCover,uvRain).rg;
      float canopy=rainCover.r*40.-4.;
      float open=1.-smoothstep(.14,.36,canopy-vShipLightPosition.y);
      float foot=smoothstep(.22,.78,rainCover.g*1.5);
      float wet=open*max(foot,smoothstep(.16,.5,vShipLightPosition.y))*smoothstep(.72,.98,worldFace.y);
      ${finish==='deck' ? 'wet*=mix(.54,.98,smoothstep(.42,.76,grain))*(1.-.43*dust);' : ''}
      diffuseColor.rgb*=1.-.25*wet;
      roughnessFactor=mix(roughnessFactor,min(roughnessFactor,max(.60,roughnessFactor-.17)),wet);
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',
      `vec3 worldFace=inverseTransformDirection(normalize(vNormal),viewMatrix);
       if (dot(worldFace,cameraPosition-vShipLightPosition)<0.) worldFace=-worldFace;
       ${coverage}
       #include <metalnessmap_fragment>`);
    if(finish==='deck')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      // Perturb the steel itself; roof and dry margins remain motionless.
      vec2 ripple=shipRainRing(vShipLightPosition.xz,0.)+
        shipRainRing(vShipLightPosition.xz+vec2(.31,.43),.71)*.65;
      normal=normalize(normal+mat3(viewMatrix)*vec3(ripple.x,0.,ripple.y)*wet);`);
  };
  material.customProgramCacheKey=()=>previousKey+'-rain-damp-'+finish+(finish==='deck'?'-ripples-1':'');
}

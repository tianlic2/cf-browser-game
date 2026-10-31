// Source-inspired KN-57 shader adaptation. Source's authored values stay in
// the asset metadata; Three's scene lights and PMREM remain engine-specific.
import * as THREE from 'three';
export function makeKn57SourceMaterial(part, maps) {
  const p=part.sourceMaterial, tex=maps.phongMap || maps.normalMap;
  const mat=new THREE.MeshPhysicalMaterial({map:maps.map,normalMap:maps.normalMap,
    transparent:!!part.transparent,depthWrite:!part.transparent,
    side:part.doubleSided?THREE.DoubleSide:THREE.FrontSide,
    roughness:.5,metalness:0,specularIntensity:0,envMapIntensity:1,
    emissiveMap:maps.emissiveMap||null,
    emissive:part.emissive?new THREE.Color(part.emissive):new THREE.Color(0),
    emissiveIntensity:part.emissiveIntensity??0});
  if(part.normalScale)mat.normalScale.fromArray(part.normalScale);
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      sourceExponentMap:{value:tex}, sourceHasExponent:{value:!!maps.phongMap},
      sourceExponent:{value:p.exponent},sourceBoost:{value:p.boost},
      sourceFresnel:{value:new THREE.Vector3(...p.fresnel)},
      sourceTint:{value:new THREE.Vector3(...p.tint)},sourceHasTint:{value:p.hasTint},
      sourceAlbedoTint:{value:p.albedoTint},sourceRim:{value:p.rim},
      sourceRimExponent:{value:p.rimExponent},sourceRimBoost:{value:p.rimBoost},
      sourceEnvTint:{value:new THREE.Vector3(...p.envTint)},
      sourceEnvFresnel:{value:new THREE.Vector3(...p.envFresnel)},
      sourceEnvFresnelEnabled:{value:p.envFresnelEnabled!==false},
      sourceEnvMask:{value:p.envMask},sourcePhongMask:{value:p.phongMask},
      sourceHalfLambert:{value:p.halfLambert},
    });
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D sourceExponentMap;
      uniform bool sourceHasExponent, sourceHasTint, sourceAlbedoTint, sourceRim, sourceEnvMask, sourcePhongMask, sourceHalfLambert, sourceEnvFresnelEnabled;
      uniform float sourceExponent, sourceBoost, sourceRimExponent, sourceRimBoost;
      uniform vec3 sourceFresnel, sourceTint, sourceEnvTint, sourceEnvFresnel;
    `).replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
      'float sourceNdotL = dot( geometryNormal, directLight.direction );\n\tfloat dotNL = sourceHalfLambert ? pow( clamp( sourceNdotL * 0.5 + 0.5, 0.0, 1.0 ), 2.0 ) : saturate( sourceNdotL );'
    )).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      vec4 sourceExpTex = texture2D(sourceExponentMap, vMapUv);
      float sourceExp = sourceExponent >= 0.0 ? sourceExponent : (sourceHasExponent ? 1.0 + 149.0 * sourceExpTex.r : 5.0);
      float sourceAlpha = texture2D(normalMap, vNormalMapUv).a;
      float sourceMask = sourcePhongMask ? sourceAlpha : 1.0;
      float sourceNV = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
      float sourceEdge = pow(1.0 - sourceNV, 5.0);
      float sourceFr = sourceEdge < .5 ? mix(sourceFresnel.x, sourceFresnel.y, sourceEdge * 2.0) : mix(sourceFresnel.y, sourceFresnel.z, sourceEdge * 2.0 - 1.0);
      vec3 sourceColor = sourceHasTint ? sourceTint : (sourceAlbedoTint ? mix(vec3(1.0), diffuseColor.rgb, sourceExpTex.g) : vec3(1.0));
      vec3 sourceHighlight = vec3(0.0);
      vec3 sourceRimLight = vec3(0.0);
      #if NUM_DIR_LIGHTS > 0
      for (int i=0; i<NUM_DIR_LIGHTS; i++) {
        vec3 L = normalize(directionalLights[i].direction);
        float lit = max(dot(normal,L),0.0);
        vec3 H = normalize(L+geometryViewDir);
        sourceHighlight += directionalLights[i].color * lit * pow(max(dot(normal,H),0.0),sourceExp);
        if (sourceRim) sourceRimLight += directionalLights[i].color * lit * pow(max(1.0-sourceNV,0.0),sourceRimExponent) * sourceRimBoost;
      }
      #endif
      reflectedLight.directSpecular += max(sourceHighlight * sourceMask * sourceBoost * sourceFr, sourceRimLight) * sourceColor * RECIPROCAL_PI * RECIPROCAL_PI;
      #ifdef USE_ENVMAP
        float envFr = sourceEnvFresnelEnabled ? mix(sourceEnvFresnel.x, sourceEnvFresnel.y, pow(1.0-sourceNV,sourceEnvFresnel.z)) : 1.0;
        reflectedLight.indirectSpecular += getIBLRadiance(geometryViewDir, normal, .08) * sourceEnvTint * envFr * (sourceEnvMask ? sourceAlpha : 1.0);
      #endif
    `);
  };
  mat.customProgramCacheKey=()=> 'kn57-source-phong-v1';
  return mat;
}

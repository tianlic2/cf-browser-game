# 靈隱 · 冷泉 — a procedural temple valley

A small, fully procedural Three.js scene inspired by Lingyin Temple (靈隱寺) and Feilai Feng
(飛來峰) in Hangzhou: a misty dawn valley, an ochre-walled temple courtyard, a two-tier main hall,
a stone pagoda, a stream, bamboo and pine forest, incense smoke, and a carved cliff.

Everything you see is generated in code — no models, no textures, no HDRIs. The look is built from
procedural GLSL materials, a heightfield valley, instanced vegetation, and an offline-style
accumulation + AgX + fog pipeline.

![main hall](artifacts/final-hall.png)

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:5188
```

Production:

```bash
npm run build
npm run preview      # http://127.0.0.1:4188
```

Requires WebGL2. On macOS, Chrome with `--use-angle=metal` is recommended.

## Controls

- Drag to orbit, wheel to zoom. Panning is disabled to protect the composition.
- `1`–`4` switch viewpoints (山門 / 大雄寶殿 / 庭院 / 遠眺).
- `巡游` (or `T`) starts a slow guided tour: it eases between viewpoints and holds still at each,
  so the image keeps accumulating.
- `精細` / `流暢` toggles resolution and the accumulation budget.
- While the camera is still, the renderer accumulates up to 48 jittered samples; the HUD shows
  `STILL` when it has converged.

## What is procedural

- **Valley**: analytic heightfield (`src/world/heightfield.ts`) with a carved stream/pond, a flat
  temple terrace, a crag shoulder, and layered hills. A 260² mesh with slope/water/path splatting.
- **Temple**: parametric halls, platforms, steps, columns, dougong brackets, curved hip roofs with
  tile shader, ridge ornaments, lattice doors, plaques (canvas text), warm windows, red lanterns,
  a stone pagoda, enclosure walls, and a seated gilded Buddha.
- **World kit**: cobbled courtyard, puddles, stone lanterns with point lights, a bronze censer with
  rising smoke, stone lions, a stele, prayer ribbons, three monks, a pavilion, and a stone bridge.
- **Vegetation**: canvas-painted leaf atlas; instanced pines, broadleaf, maples, bamboo, shrubs,
  grass, ferns; a cheap conifer far-forest; boulders. Wind and backlit translucency in the vertex
  and fragment shaders.
- **Crag**: displaced limestone crags with a dressed niche face and three gilded Buddha figures.
- **Atmosphere**: procedural sky dome with a cloud deck and cirrus; screen-space linear-depth fog
  (exp height haze + valley mist + sun in-scatter); ground mist billboards; incense smoke.
- **Render**: jittered accumulation (AA), bloom mip chain, AgX tone mapping, filmic S-curve, split
  toning, vignette, grain, chromatic aberration, and a screen-space sun-shaft pass.
- **IBL**: PMREM generated from the procedural sky on start.

## Architecture

```
src/
  App.ts                  renderer, camera, shots, tour, accumulation loop, test hooks
  core/
    math.ts               seeded RNG, value noise, fbm, spline helpers
    materials.ts          proceduralMaterial() world-space GLSL hooks + noise chunk
    atmosphere.ts         fog uniforms + analytic height fog GLSL
    sky.ts                sky dome, clouds, far ridge backdrop
    post.ts               accumulation, linear-depth pass, bloom, grade (AgX + shafts)
  world/
    heightfield.ts        terrain + water layout, height queries
    terrain.ts            terrain mesh and splat material
    temple.ts             halls, roofs, brackets, pagoda, Buddha, enclosure
    details.ts            bridge, lanterns, censer, lions, stele, pavilion, monks, paving, puddles
    crag.ts               Feilai Feng rocks and niches
    vegetation.ts         leaf atlas, tree/bamboo/grass geometry, scatter, far forest
    water.ts              stream/pond surface + waterfall
    mist.ts               instanced ground mist, spray, incense smoke
    materials.ts          stone, roof tile, ochre wall, wood, gold, bronze, window
    geom.ts               roof surfaces, ring roofs, arches, lattice, merge helpers
  data/shots.ts           four viewpoints
  ui/hud.ts               DOM UI
```

The scene is deterministic: all placement uses seeded RNG (`Rng('...')`), and nothing reads
`Math.random()` in world generation.

## Performance notes

Measured on an Apple M4 / Chrome (ANGLE Metal), 1440×900, 48 accumulated samples:

| view | draw calls | triangles | geometries | textures |
| --- | ---: | ---: | ---: | ---: |
| 山門 | 240 | 1.39 M | 151 | 21 |
| 大雄寶殿 | 196 | 1.36 M | 151 | 21 |
| 庭院 | 205 | 1.36 M | 151 | 21 |
| 遠眺 | 284 | 1.39 M | 157 | 21 |

The triangle count is above the usual 750k desktop starting budget; that is a deliberate tradeoff
for a still-image showcase (dense terrain, trees, and roof geometry). The 48-sample accumulation
is the expensive part in motion; the `流暢` preset reduces resolution and the sample budget.

## Known limitations

- This is a **stylized procedural concept**, not photoreal. The terrain is smooth and sparse away
  from the courtyard; the crag and the stream/bridge are the weakest surfaces; tree crowns read as
  cards at close range.
- The crag niche, pagoda, and pond are not yet at the same authored level as the main hall.
- Water is flat (normal-only ripples) and the bridge/pond view was cut from the viewpoint list.
- No collision or first-person movement; the showcase is orbit + guided tour.
- The scene targets desktop WebGL2. Mobile is laid out and tested, but the geometry budget is not
  reduced for phones.
- Loading takes a few seconds on first paint (shader compilation + PMREM); no baked assets are used.

## Evidence

Verification captures and the visual self-assessment are in
[artifacts/final-evidence.md](artifacts/final-evidence.md).

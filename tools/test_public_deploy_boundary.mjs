import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../scripts/main.js', import.meta.url), 'utf8');
const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

assert.match(main, /const PUBLIC_DEPLOY = \/\\\.github\\\.io\$\/i/,
  'GitHub Pages is detected as a public redistribution target');
assert.match(main, /const PRIMARY_IDS = PUBLIC_DEPLOY[\s\S]*?\["ak", "m4", "barrett"\]/,
  'public weapon preload contains only publishable primary weapons');
assert.match(main, /\.\.\.\(!PUBLIC_DEPLOY \? \{[\s\S]*?bio:/,
  'local-only Zone 13 map is omitted from public metadata');
assert.doesNotMatch(main, /pyramid_map|name: '生化金字塔'/,
  'retired pyramid study is not registered by the formal game');
assert.match(main, /button\.hidden = !MAP_META\[button\.dataset\.map\]/,
  'unpublished maps are hidden rather than left as broken buttons');
assert.match(main, /\.\.\.\(!PUBLIC_DEPLOY \? \[trackAsset\(loadScarLightView/,
  'BaiHu is not fetched by the public boot sequence');
assert.match(main, /\.\.\.\(!PUBLIC_DEPLOY \? \[trackAsset\(loadBioZombieView/,
  'local zombie view is not fetched by the public boot sequence');

for (const path of ['scar_light/', 'm200/', 'akgold/', 'kn57/', 'cf_bio_candidates/']) {
  assert.match(ignore, new RegExp('/assets/local/' + path.replace('/', '\\/')),
    `${path} remains excluded from GitHub`);
}

console.log('PASS: GitHub Pages skips and hides all local-only weapon and bio-map packages.');

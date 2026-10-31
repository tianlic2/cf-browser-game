import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, 'assets/local/cf_bio_candidates/zone13/runtime-character/ghost-view');
const data = JSON.parse(fs.readFileSync(path.join(runtime, 'view.json'), 'utf8'));
assert.equal(data.source, 'Zone13 downloaded v_knife_cfghost MDL v49');
assert.equal(data.bones.length, 45);
assert.deepEqual(Object.keys(data.clips), [
  'select', 'idle_0', 'idle_1', 'light_miss1', 'light_miss2',
  'light_hit1', 'light_hit2', 'light_backstab', 'light_backstab2',
  'heavy_miss1', 'heavy_hit1', 'heavy_backstab',
]);
assert.equal(data.parts.length, 3);
assert.ok(data.clips.light_hit1.times.at(-1) > .72);
assert.ok(fs.statSync(path.join(runtime, 'view.bin')).size > 1000000);
const binary = fs.readFileSync(path.join(runtime, 'view.bin'));
const idle = data.clips.idle_0;
const rootPose = Array.from({ length: 7 }, (_, index) => binary.readFloatLE(idle.offset + index * 4));
assert.ok(Math.abs(rootPose[0] - 11.3828125) < 1e-5 && Math.abs(rootPose[2] + 17.703125) < 1e-5,
  'RAWROT2 must be consumed before RAWPOS so the authored root position survives');
assert.ok(Math.abs(rootPose[5] - Math.SQRT1_2) < 1e-5 && Math.abs(rootPose[6] - Math.SQRT1_2) < 1e-5,
  'the source root keeps its authored 90-degree compressed rotation');
function maxQuaternionStep(clipName, frame) {
  const clip = data.clips[clipName], stride = data.bones.length * 7 * 4;
  let maximum = 0;
  for (let bone = 0; bone < data.bones.length; bone++) {
    const before = clip.offset + (frame - 1) * stride + (bone * 7 + 3) * 4;
    const after = clip.offset + frame * stride + (bone * 7 + 3) * 4;
    let dot = 0;
    for (let axis = 0; axis < 4; axis++) dot += binary.readFloatLE(before + axis * 4) * binary.readFloatLE(after + axis * 4);
    maximum = Math.max(maximum, 2 * Math.acos(Math.min(1, Math.abs(dot))) * 180 / Math.PI);
  }
  return maximum;
}
assert.ok(maxQuaternionStep('light_miss1', 31) < 30 && maxQuaternionStep('light_miss1', 61) < 30,
  '30-frame Source animation sections must switch streams instead of decoding past their payload');
for (const name of ['tex0.png', 'tex1.png', 'tex2.png']) {
  assert.ok(fs.statSync(path.join(runtime, name)).size > 1000, `${name} is converted`);
}
console.log('zone13 ghost view import ok: complete downloaded first-person rig, three textures and twelve native clips');

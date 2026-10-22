import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../preview/tracer-muzzle.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../preview/tracer-muzzle.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');

assert.match(html,/枪口曳光校准/);
assert.match(html,/复制全部参数/);
for(const asset of ['ak\/view','m4c_view','m4_ironbeast','barrett','deagle_festa'])assert.match(js,new RegExp(`asset:'${asset}'`));
for(const id of ['ak','m4','ironbeast','barrett','deagle'])assert.match(js,new RegExp(`id:'${id}'`));
assert.match(js,/activeView\.muzzle\(autoMuzzle\)/,'校准基准必须来自动画中的模型枪口');
assert.match(js,/tunedMarker\.position\.x-autoMuzzle\.x/,'拖动结果必须保存为相对枪口修正');
assert.match(js,/direction:\{yawDeg:/,'应导出每把枪的方向参数');
assert.match(js,/localStorage\.setItem\(STORAGE_KEY/,'校准草稿应本地保存');
assert.match(js,/barrett:\{x:0,y:0,z:0,yaw:4\.1,pitch:1\.4\}/,'preview defaults should match approved runtime values');
assert.match(js,/if\(current\.id!==requested\.id\)return/,'快速切枪时不得显示过期异步模型');
assert.doesNotMatch(main,/cf-tracer-muzzle-calibration-v1/,'预览参数未经用户确认不得接入正式游戏');
console.log('tracer muzzle preview checks passed');

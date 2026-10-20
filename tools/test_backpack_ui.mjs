import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Run without a browser: node tools/test_backpack_ui.mjs
// Exercise real handlers against deterministic DOM/pointer-lock event doubles.
const source=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
class Element {
 constructor(){this.children=[];this.dataset={};this.attrs={};this.classes=new Set();this.classList={add:(x)=>this.classes.add(x),remove:(x)=>this.classes.delete(x),contains:(x)=>this.classes.has(x),toggle:(x,b)=>b===undefined?(this.classes.has(x)?this.classes.delete(x):this.classes.add(x)):(b?this.classes.add(x):this.classes.delete(x))};}
 set className(v){this.classes=new Set(v.split(' '))}get className(){return [...this.classes].join(' ')}
 append(...v){this.children.push(...v)}appendChild(v){this.append(v)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}addEventListener(){}blur(){}focus(){document.activeElement=this}getClientRects(){return [this]}
}
const nodes=Object.fromEntries(['backpack','bpList','bpLoadout','bpHint','bpCurrent','startBtn','restartBtn','goLobbyBtn','gameMenu','gameMenuHome','gameMenuSettings','gameMenuSettingsOpen','gameMenuSettingsBack','gameMenuResume','gameMenuPause','gameMenuReset','gameMenuEnd','gameMenuStatus','hudPauseBtn','hudUtility'].map(id=>[id,new Element()]));nodes.backpack.classList.add('hidden');nodes.gameMenu.classList.add('hidden');
const listeners={},pending=[];let lockRequests=0,shots=0,switched=[],denyLock=false,allowed=true;
const document={getElementById:id=>nodes[id],createElement:()=>new Element(),createTextNode:s=>s,querySelectorAll:()=>[nodes.gameMenuResume,nodes.gameMenuPause,nodes.gameMenuReset,nodes.gameMenuEnd],activeElement:null,addEventListener:(name,cb)=>(listeners[name]??=[]).push(cb),exitPointerLock:()=>{document.pointerLockElement=null;pending.push(()=>emit('pointerlockchange',{}));}};
const viewport=new Element();viewport.requestPointerLock=()=>{lockRequests++;if(denyLock)throw Error('denied');document.pointerLockElement=viewport;pending.push(()=>emit('pointerlockchange',{}));};document.pointerLockElement=viewport;
const emit=(type,e)=>{for(const f of listeners[type]||[])f(e)};
const flush=()=>{while(pending.length)pending.shift()()};
const key=(code,repeat=false)=>emit('keydown',{code,repeat,preventDefault(){}});
const noop=()=>{};
const ctx={console,document,viewport,window:{addEventListener:noop},state:'playing',locked:true,matchPaused:false,lockRequestCancelled:false,dead:false,curBp:0,selectedMapId:'transport',sniperOnlyMatch:()=>ctx.selectedMapId==='prison',keys:{},fireEnabled:false,BACKPACKS:[['ak','classic','stock'],['m4','classic','stock'],['barrett','classic','dragon'],['m4','ironbeastgold','dragon']].map(([primary,skin,meleeSkin])=>({primary,skin,secondary:'deagle',meleeSkin})),GEAR_SKIN:{deagle:'classic',knife:'classic'},owned:Object.fromEntries(['ak','m4','barrett','deagle','knife','frag','flash','smoke'].map(id=>[id,{state:{mag:30,reserve:90,count:1}}])),WEAPON_DEFS:Object.fromEntries(['ak','m4','barrett','deagle','knife','frag','flash','smoke'].map(id=>[id,{type:id==='barrett'?'sniper':id==='knife'?'melee':['frag','flash','smoke'].includes(id)?'grenade':id==='deagle'?'pistol':'rifle',stats:{magSize:30,reserve:90}}])),emptySlot:{},lifePickup:{primary:null,secondary:null},gunDisplayName:id=>id,activeSkinId:id=>id==='knife'?ctx.BACKPACKS[ctx.curBp].meleeSkin:ctx.BACKPACKS[ctx.curBp].skin,syncMagazineCapacity:noop,magazineSizeFor:(id,skin)=>id==='m4'&&skin==='ironbeastgold'?35:ctx.WEAPON_DEFS[id].stats.magSize,startingReserve:(id,stats,skin)=>{const reserve=id==='m4'&&skin==='ironbeastgold'?105:stats.reserve;return ctx.bioMatch()?reserve*2:reserve},worldModel:()=>({}),classicNades:{},weaponPreview:()=>null,renderer:{},scene:{},knifeBind:null,weaponIconSvg:()=>'<svg/>',sfx:{ui:noop,empty:noop,cancelStreak:noop},canSwapBackpack:()=>allowed,swapBlockReason:()=> 'blocked',showToast:noop,updateMapChoiceUi:noop,cancelMelee:noop,cancelGrenade:noop,showScoreboard:noop,clearTrainingTargets:noop,renderTrainingPanel:noop,chat:{cancel:noop,handleKey:()=>false,isTyping:()=>false},hud:new Element(),menu:new Element(),gameover:new Element(),lobby:{setResume:noop,refresh:noop},setScoped:noop,clearFlash:noop,gameStart:()=>{throw Error('must not restart')},equippedPrimary:()=>ctx.BACKPACKS[ctx.curBp].primary,switchWeapon:(id)=>switched.push(id),scoreboardEl:new Element(),IS_SNEAK:'sneak',IS_CROUCH:'crouch',performance:{now:()=>0},crouchDownAt:0,dropWeapon:()=>{throw Error('must not drop')},startReload:()=>{throw Error('must not reload')},switchToPrimary:noop,switchToSecondary:noop,switchNade:noop,quickSwitch:noop};
ctx.actedThisLife=false;
ctx.bioMatch=()=>false;
ctx.trainingMatch=()=>false;
ctx.tdmMatch=()=>true;
ctx.placePlayerAtClearSpawn=noop;
ctx.bioMode=null;
document.body=new Element();
ctx.menu.classList.add('hidden');vm.createContext(ctx);
const run=s=>vm.runInContext(s,ctx);
run(source.slice(source.indexOf('function switchBackpack(i)'),source.indexOf('// 数字键 4：')));
run(source.slice(source.indexOf('let previewBp ='),source.indexOf('// ---- 皮肤：')));
run(source.slice(source.indexOf('function updateBackpack()'),source.indexOf('// ---------- 地面掉落武器')));
run(source.slice(source.indexOf('function gameMenuOpen()'),source.indexOf('document.addEventListener("mousemove"')));
run(source.slice(source.indexOf('document.addEventListener("keydown", (e) => {'),source.indexOf('// 切走窗口时 keyup')));
// Use the real mouse-fire handler: clicking inventory must never shoot.
ctx.isSecondaryClick=()=>false;ctx.fire=()=>shots++;ctx.currentId='ak';
run(source.slice(source.indexOf('document.addEventListener("mousedown"'),source.indexOf('document.addEventListener("mouseup"')));
key('KeyB');assert.ok(ctx.backpackOpen());emit('mousedown',{button:0});assert.equal(shots,0);flush();assert.equal(ctx.locked,false);assert.equal(ctx.menu.classList.contains('hidden'),true);assert.equal(ctx.hud.classList.contains('hidden'),false);
const tabs=nodes.bpList.children;
assert.equal(tabs.length,4,'four backpack tabs are rendered');
const ammoText=slot=>nodes.bpLoadout.children[slot].children.at(-1)?.textContent;
ctx.owned.ak.state.mag=17;ctx.owned.ak.state.reserve=61;ctx.previewBackpack(0);
assert.equal(ammoText(0),'17 / 61','equipped backpack shows the live magazine and reserve');
ctx.owned.ak.state.mag=30;ctx.owned.ak.state.reserve=90;
tabs[3].onmouseenter();
assert.equal(ammoText(0),'35 / 105','Iron Beast preview uses its own 35-round magazine and three reserves');
ctx.bioMatch=()=>true;ctx.previewBackpack(3);
assert.equal(ammoText(0),'35 / 210','bio preview applies the real doubled reserve to Iron Beast');
ctx.bioMatch=()=>false;ctx.trainingMatch=()=>true;ctx.previewBackpack(3);
assert.equal(ammoText(0),'35 / ∞','training preview keeps the real magazine capacity and infinite reserve');
ctx.trainingMatch=()=>false;ctx.actedThisLife=true;ctx.owned.m4.state.mag=35;ctx.owned.m4.state.reserve=105;ctx.previewBackpack(1);
assert.equal(ammoText(0),'30 / 110','acted backpack preview mirrors the capacity-conversion result that switching will apply');
ctx.actedThisLife=false;ctx.owned.m4.state.mag=30;ctx.owned.m4.state.reserve=90;ctx.previewBackpack(0);
tabs[2].onmouseenter();assert.equal(nodes.bpLoadout.children[0].dataset.weapon,'barrett');assert.equal(ctx.curBp,0);assert.deepEqual(switched,[]);assert.ok(tabs[2].classList.contains('active'));assert.ok(tabs[0].classList.contains('equipped'));assert.equal(nodes.bpList.children[2],tabs[2],'hover preserves button node');
key('KeyG');key('KeyR');key('KeyW');assert.ok(!ctx.keys.KeyW);
ctx.emptySlot.primary=true;ctx.previewBackpack(0);assert.ok(nodes.bpLoadout.children[0].classList.contains('is-empty'));ctx.previewBackpack(1);assert.ok(!nodes.bpLoadout.children[0].classList.contains('is-empty'));
emit('mousedown',{button:0});nodes.bpList.children[1].onclick();assert.equal(shots,0);assert.equal(ctx.curBp,1);assert.equal(ctx.backpackOpen(),false);flush();assert.equal(ctx.locked,true);assert.equal(lockRequests,1);
key('KeyB');flush();nodes.bpList.children[2].onmouseenter();key('Digit1');flush();assert.equal(ctx.curBp,0,'digit confirms its own number, not hovered one');assert.equal(ctx.backpackOpen(),false);assert.equal(ctx.locked,true);
key('KeyB');flush();allowed=false;nodes.bpList.children[2].onclick();assert.equal(ctx.backpackOpen(),true);assert.equal(ctx.curBp,0);key('Digit2');assert.equal(ctx.backpackOpen(),true);allowed=true;key('KeyB');flush();assert.equal(ctx.curBp,0);assert.equal(ctx.locked,true);
// A second B before the asynchronous unlock event must still return to battle.
key('KeyB');key('KeyB');flush();assert.equal(ctx.backpackOpen(),false);assert.equal(ctx.locked,true);
// Same-number confirmation closes, and cancellation does not equip hover.
key('KeyB');flush();key('Digit1');flush();assert.equal(ctx.backpackOpen(),false);
key('KeyB');flush();nodes.bpList.children[2].onmouseenter();key('Escape');flush();assert.equal(ctx.curBp,0);assert.equal(ctx.locked,true);
// 捡来的枪只活一条命（复活那条清空在 respawnPlayer 里，不在本切片）：确认一个背包
// ——**包括自己正在用的那个编号**——必须把拾取记录作废并换回这个背包的配枪。
key('KeyB');flush();
ctx.lifePickup.primary={id:'m4',skin:'classic'};switched.length=0;
ctx.previewBackpack(0);assert.ok(nodes.bpCurrent.textContent.includes('手持拾取 m4'),'panel names the held pickup');
key('Digit1');flush();
assert.equal(ctx.lifePickup.primary,null,'confirming the current backpack discards the pickup');
assert.deepEqual(switched,['ak'],'and re-equips the backpack gun');
key('KeyB');flush();nodes.bpList.children[2].onmouseenter();assert.equal(nodes.bpLoadout.children[0].dataset.weapon,'barrett','third backpack previews Barrett');assert.equal(nodes.bpLoadout.children[1].dataset.weapon,'deagle','every backpack previews Desert Eagle in secondary slot');
key('Digit3');flush();assert.equal(ctx.curBp,2,'Digit3 confirms the shifted Barrett backpack');assert.equal(ctx.backpackOpen(),false);assert.equal(switched.at(-1),'barrett');
key('KeyB');flush();nodes.bpList.children[3].onmouseenter();assert.equal(nodes.bpLoadout.children[0].dataset.weapon,'m4','fourth backpack previews Iron Beast M4');assert.equal(nodes.bpLoadout.children[1].dataset.weapon,'deagle','Iron Beast backpack also uses Desert Eagle');
key('Digit4');flush();assert.equal(ctx.curBp,3,'Digit4 confirms the shifted Iron Beast backpack');assert.equal(switched.at(-1),'m4');
// 经典生化在感染倒计时内允许 B 换包；感染爆发后立即锁定。
ctx.bioMatch=()=>true;ctx.bioMode={playerZombie:false,phase:'prepare'};allowed=true;
key('KeyB');flush();assert.equal(ctx.backpackOpen(),true,'bio preparation accepts B');
key('Digit2');flush();assert.equal(ctx.curBp,1,'bio preparation switches backpack');assert.equal(ctx.backpackOpen(),false);
let bioToast='';ctx.showToast=(text='')=>{bioToast=text};ctx.bioMode.phase='live';
key('KeyB');assert.equal(ctx.backpackOpen(),false,'live infection blocks the backpack panel');assert.equal(bioToast,'僵尸已出现，无法更换背包');
ctx.bioMatch=()=>false;ctx.bioMode=null;ctx.showToast=noop;
// pickUpItem 不在任何切片里，所以这条直接对着源码断言：它写拾取记录，绝不改写背包配装。
const pick=source.slice(source.indexOf('function pickUpItem('),source.indexOf('// 每帧：自转 + 起伏 + 拾取判定'));
assert.ok(pick.includes('lifePickup[it.slotKind]'),'pickup records into lifePickup');
assert.ok(!/BACKPACKS\[curBp\]|GEAR_SKIN\.deagle\s*=/.test(pick),'pickup must never rewrite the backpack config');
assert.ok(source.includes('{ primary: "m4", skin: "ironbeastgold", secondary: "deagle", meleeSkin: "dragon" }'),'fourth pack is configured as Iron Beast M4, Desert Eagle and 屠龙');
const productPacks=source.slice(source.indexOf('const BACKPACKS = ['),source.indexOf('let curBp ='));
assert.equal((productPacks.match(/secondary: "deagle"/g)||[]).length,4,'all four product backpacks use Desert Eagle');
assert.doesNotMatch(productPacks,/secondary: "pistol"|primary: "awm"/,'AWM and USP are absent from product backpacks');
const productDefs=source.slice(source.indexOf('const WEAPON_DEFS ='),source.indexOf('const PRIMARY_IDS'));
assert.doesNotMatch(productDefs,/\n  (?:awm|pistol): \{/,'AWM and USP definitions are removed from the playable weapon table');
const productInit=source.slice(source.indexOf('let assetsDone = 0;'),source.indexOf('// 手臂加载失败'));
assert.doesNotMatch(productInit,/["'](?:awm|pistol)["']/,'startup no longer loads AWM or USP');
// Re-lock denial must expose Return to Battle instead of leaving dead controls.
key('KeyB');flush();denyLock=true;key('Digit2');assert.equal(ctx.backpackOpen(),false);assert.equal(ctx.gameMenuOpen(),true);assert.equal(ctx.menu.classList.contains('hidden'),true);assert.equal(ctx.hud.classList.contains('hidden'),false);
// Ordinary Escape/unlock opens the battle dialog, never the lobby.
denyLock=false;ctx.requestLock();flush();document.exitPointerLock();flush();assert.equal(ctx.gameMenuOpen(),true);assert.equal(ctx.menu.classList.contains('hidden'),true);
console.log('PASS: native cursor mode, hover without equipping, accurate empty slots, mouse and digit confirmation, same-number close, rule rejection, B/Escape cancel, held-pickup disclosure and pickup discard on backpack confirm (config never rewritten), rapid close/unlock race, re-lock denial recovery, normal game-dialog unlock, no click-through fire or movement.');

// Esc menu regressions share the same real keyboard and pointer-lock handlers.
ctx.toggleMatchPause();assert.equal(ctx.matchPaused,true);
run(source.slice(source.indexOf('function update(dt, rawDt)'),source.indexOf('// ---------- 大厅机位')));
ctx.time=50;ctx.timeLeft=120;ctx.deathT=2;ctx.grenadePool=[{remaining:3}];
ctx.update(30,30);assert.equal(ctx.time,50);assert.equal(ctx.timeLeft,120);assert.equal(ctx.deathT,2);assert.equal(ctx.grenadePool[0].remaining,3);
// Failed Continue keeps the pause and usable dialog; success resumes this match.
denyLock=true;ctx.resumeFromGameMenu();assert.equal(ctx.matchPaused,true);assert.equal(ctx.gameMenuOpen(),true);
denyLock=false;ctx.toggleMatchPause();flush();assert.equal(ctx.matchPaused,false);assert.equal(ctx.gameMenuOpen(),false);
key('Escape');flush();assert.equal(ctx.gameMenuOpen(),true);assert.equal(ctx.menu.classList.contains('hidden'),true);
// Native button navigation cannot move focus into the battlefield/lobby.
document.activeElement=nodes.gameMenuEnd;key('Tab');assert.equal(document.activeElement,nodes.gameMenuResume);
const vec=(x=0,y=0,z=0)=>({x,y,z,set(x,y,z){Object.assign(this,{x,y,z});return this},fromArray(a){return this.set(...a)}});
ctx.player={pos:vec(5,4,3),vel:vec(2,3,4),yaw:2,pitch:1,viewDip:.4,stepLift:.3,groundY:4,hp:42};
ctx.mapData={spawns:{player:[[1,0,20]]}};ctx.bounds={hl:30};ctx.actedThisLife=true;ctx.kills=8;ctx.owned.ak.state.mag=7;
ctx.dead=true;ctx.updateGameMenu();assert.equal(nodes.gameMenuReset.disabled,true);ctx.refreshPlayerPosition();assert.equal(ctx.player.pos.x,5);
ctx.dead=false;ctx.toggleMatchPause();ctx.refreshPlayerPosition();flush();assert.deepEqual([ctx.player.pos.x,ctx.player.pos.y,ctx.player.pos.z],[1,0,20]);assert.deepEqual([ctx.player.vel.x,ctx.player.vel.y,ctx.player.vel.z],[0,0,0]);assert.equal(ctx.player.hp,42);assert.equal(ctx.owned.ak.state.mag,7);assert.equal(ctx.kills,8);assert.equal(ctx.actedThisLife,true);assert.equal(ctx.matchPaused,false);assert.equal(ctx.gameMenuOpen(),false);
// Quit has no result overlay, disposes no shared assets, and starts a NEW match next time.
let releases=0,removed=0,starts=0;
ctx.enemyManager={enemies:[{}],corpses:[{}],release:()=>releases++};ctx.scene={remove:()=>removed++};ctx.smokes=[{sprites:[{visible:true}]}];ctx.smokePool=[];ctx.clearGroundItems=noop;ctx.resetSwitchState=noop;ctx.cancelDeath=()=>ctx.dead=false;ctx.chat.clear=noop;
key('Escape');flush();ctx.toggleMatchPause();ctx.quitMatchToLobby();assert.equal(ctx.state,'menu');assert.equal(ctx.matchPaused,false);assert.equal(ctx.gameMenuOpen(),false);assert.equal(ctx.menu.classList.contains('hidden'),false);assert.equal(ctx.hud.classList.contains('hidden'),true);assert.equal(ctx.gameover.classList.contains('hidden'),true);assert.equal(releases,2);assert.equal(removed,1);assert.equal(ctx.grenadePool.length,0);assert.equal(ctx.smokes.length,0);assert.equal(ctx.smokePool[0].visible,false);
// A delayed successful lock from before Quit must not restart behind the lobby.
document.pointerLockElement=viewport;emit('pointerlockchange',{});flush();assert.equal(ctx.state,'menu');assert.equal(ctx.locked,false);
ctx.gameStart=()=>{starts++;ctx.state='playing'};ctx.requestLock();flush();assert.equal(starts,1);assert.equal(ctx.state,'playing');assert.equal(ctx.gameMenuOpen(),false);
console.log('PASS: Esc dialog, pause freezes simulation, resume denial/success, focus wrap, dead-player reset guard, position-only reset, quit cleanup, stale-lock cancellation and fresh match start.');

ctx.selectedMapId='prison';ctx.curBp=2;allowed=true;
key('KeyB');flush();
assert.equal(nodes.bpList.children[0].disabled,true,'AK backpack disabled in prison');
assert.equal(nodes.bpList.children[1].disabled,true,'M4 backpack disabled in prison');
assert.equal(nodes.bpList.children[2].disabled,false,'Barrett backpack enabled in prison');
assert.equal(nodes.bpList.children[3].disabled,true,'M4 Iron Beast backpack disabled in prison');
assert.equal(nodes.bpLoadout.children.length,2,'prison previews sniper and melee slots');
assert.equal(nodes.bpLoadout.children[1].dataset.weapon,'knife','prison backpack includes the knife');
assert.equal(ctx.switchBackpack(0),false,'programmatic AK selection is blocked too');
assert.equal(ctx.curBp,2);
assert.equal(ctx.switchBackpack(2),true,'Barrett selection remains valid');
assert.equal(ctx.curBp,2);
run(source.slice(source.indexOf('const prisonWeaponAllowed ='),source.indexOf('let obstacleMeshes =')));
assert.equal(run('prisonWeaponAllowed("awm")'),false);
assert.equal(run('prisonWeaponAllowed("barrett")'),true);
assert.equal(run('prisonWeaponAllowed("knife")'),true);
for(const id of ['ak','m4','pistol','deagle','frag','flash','smoke'])
  assert.equal(run(`prisonWeaponAllowed(${JSON.stringify(id)})`),false,`${id} stays prohibited`);
run(source.slice(source.indexOf('function canQuickSwitchTo('),source.indexOf('// 当前手上该是哪把主武器')));
ctx.slotWeapon=()=>ctx.BACKPACKS[ctx.curBp].primary;ctx.lastWeaponId=null;
key('KeyB');flush();
switched.length=0;ctx.currentId='barrett';key('Digit3');assert.equal(switched.at(-1),'knife','3 equips knife in prison');
key('KeyQ');assert.equal(switched.at(-1),'knife','Q switches sniper to knife');
ctx.currentId='knife';key('KeyQ');assert.equal(switched.at(-1),'barrett','Q switches knife back to selected sniper');
console.log('PASS: prison disables rifle backpacks, previews knife, allows sniper/knife only, and Q switches between them.');

// 直接运行产品里的真实资格判定：生化准备期忽略出生区与 actedThisLife，live 后拒绝；
// 团队竞技仍保留原来的出生区 + 未开火双门槛。
const gateCtx={state:'playing',dead:false,player:{pos:{x:99,z:99}},mapData:{spawns:{player:[[0,0,20]]}},bounds:{hl:30},
  actedThisLife:true,bioMode:{phase:'prepare'},bioMatch:()=>true,trainingMatch:()=>false};
vm.createContext(gateCtx);
vm.runInContext('const SPAWN_SAFE_R=9;'+source.slice(source.indexOf('function inSpawnZone()'),source.indexOf('// ---------- 切枪')),gateCtx);
assert.equal(gateCtx.canSwapBackpack(),true,'bio preparation ignores position and prior shots');
gateCtx.bioMode.phase='live';
assert.equal(gateCtx.canSwapBackpack(),false,'bio live phase locks backpacks');
assert.equal(gateCtx.swapBlockReason(),'僵尸已出现，无法更换背包');
gateCtx.bioMatch=()=>false;gateCtx.player.pos={x:0,z:20};
assert.equal(gateCtx.canSwapBackpack(),false,'TDM still blocks after acting');
gateCtx.actedThisLife=false;
assert.equal(gateCtx.canSwapBackpack(),true,'TDM still allows an unacted player in spawn');
gateCtx.trainingMatch=()=>true;gateCtx.actedThisLife=true;gateCtx.player.pos={x:99,z:99};
assert.equal(gateCtx.canSwapBackpack(),true,'training mode allows backpack changes anywhere after firing');
assert.equal(gateCtx.swapBlockReason(),'训练模式可在任意位置更换背包');
console.log('PASS: training always allows backpack changes, bio preparation allows them before infection, and TDM rules stay unchanged.');

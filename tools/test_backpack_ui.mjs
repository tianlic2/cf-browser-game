import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Run without a browser: node tools/test_backpack_ui.mjs
// Exercise real handlers against deterministic DOM/pointer-lock event doubles.
const source=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
class Element {
 constructor(){this.children=[];this.dataset={};this.attrs={};this.classes=new Set();this.classList={add:(x)=>this.classes.add(x),remove:(x)=>this.classes.delete(x),contains:(x)=>this.classes.has(x),toggle:(x,b)=>b===undefined?(this.classes.has(x)?this.classes.delete(x):this.classes.add(x)):(b?this.classes.add(x):this.classes.delete(x))};}
 set className(v){this.classes=new Set(v.split(' '))}get className(){return [...this.classes].join(' ')}
 append(...v){this.children.push(...v)}appendChild(v){this.append(v)}replaceChildren(){this.children=[]}setAttribute(k,v){this.attrs[k]=v}addEventListener(){}blur(){}focus(){document.activeElement=this}
}
const nodes=Object.fromEntries(['backpack','bpList','bpLoadout','bpHint','bpCurrent','startBtn','restartBtn','gameMenu','gameMenuResume','gameMenuPause','gameMenuReset','gameMenuEnd','gameMenuStatus'].map(id=>[id,new Element()]));nodes.backpack.classList.add('hidden');nodes.gameMenu.classList.add('hidden');
const listeners={},pending=[];let lockRequests=0,shots=0,switched=[],denyLock=false,allowed=true;
const document={getElementById:id=>nodes[id],createElement:()=>new Element(),createTextNode:s=>s,querySelectorAll:()=>[nodes.gameMenuResume,nodes.gameMenuPause,nodes.gameMenuReset,nodes.gameMenuEnd],activeElement:null,addEventListener:(name,cb)=>(listeners[name]??=[]).push(cb),exitPointerLock:()=>{document.pointerLockElement=null;pending.push(()=>emit('pointerlockchange',{}));}};
const viewport=new Element();viewport.requestPointerLock=()=>{lockRequests++;if(denyLock)throw Error('denied');document.pointerLockElement=viewport;pending.push(()=>emit('pointerlockchange',{}));};document.pointerLockElement=viewport;
const emit=(type,e)=>{for(const f of listeners[type]||[])f(e)};
const flush=()=>{while(pending.length)pending.shift()()};
const key=(code,repeat=false)=>emit('keydown',{code,repeat,preventDefault(){}});
const noop=()=>{};
const ctx={console,document,viewport,window:{addEventListener:noop},state:'playing',locked:true,matchPaused:false,lockRequestCancelled:false,dead:false,curBp:0,keys:{},fireEnabled:false,BACKPACKS:['ak','m4','awm'].map(primary=>({primary,skin:'classic'})),GEAR_SKIN:{pistol:'classic',knife:'classic'},owned:Object.fromEntries(['ak','m4','awm','pistol','knife','frag','flash','smoke'].map(id=>[id,{state:{mag:30,reserve:90,count:1}}])),WEAPON_DEFS:Object.fromEntries(['ak','m4','awm','pistol','knife','frag','flash','smoke'].map(id=>[id,{type:['frag','flash','smoke'].includes(id)?'grenade':'gun'}])),emptySlot:{},gunDisplayName:id=>id,worldModel:()=>({}),classicNades:{},weaponPreview:()=>null,renderer:{},scene:{},knifeBind:null,weaponIconSvg:()=>'<svg/>',sfx:{ui:noop,empty:noop,cancelStreak:noop},canSwapBackpack:()=>allowed,swapBlockReason:()=> 'blocked',showToast:noop,cancelMelee:noop,cancelGrenade:noop,showScoreboard:noop,chat:{cancel:noop,handleKey:()=>false,isTyping:()=>false},hud:new Element(),menu:new Element(),gameover:new Element(),lobby:{setResume:noop,refresh:noop},setScoped:noop,clearFlash:noop,gameStart:()=>{throw Error('must not restart')},equippedPrimary:()=>ctx.BACKPACKS[ctx.curBp].primary,switchWeapon:(id)=>switched.push(id),scoreboardEl:new Element(),IS_SNEAK:'sneak',IS_CROUCH:'crouch',performance:{now:()=>0},crouchDownAt:0,dropWeapon:()=>{throw Error('must not drop')},startReload:()=>{throw Error('must not reload')},switchToPrimary:noop,switchToSecondary:noop,switchNade:noop,quickSwitch:noop};
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
tabs[2].onmouseenter();assert.equal(nodes.bpLoadout.children[0].dataset.weapon,'awm');assert.equal(ctx.curBp,0);assert.deepEqual(switched,[]);assert.ok(tabs[2].classList.contains('active'));assert.ok(tabs[0].classList.contains('equipped'));assert.equal(nodes.bpList.children[2],tabs[2],'hover preserves button node');
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
// Re-lock denial must expose Return to Battle instead of leaving dead controls.
key('KeyB');flush();denyLock=true;key('Digit2');assert.equal(ctx.backpackOpen(),false);assert.equal(ctx.gameMenuOpen(),true);assert.equal(ctx.menu.classList.contains('hidden'),true);assert.equal(ctx.hud.classList.contains('hidden'),false);
// Ordinary Escape/unlock opens the battle dialog, never the lobby.
denyLock=false;ctx.requestLock();flush();document.exitPointerLock();flush();assert.equal(ctx.gameMenuOpen(),true);assert.equal(ctx.menu.classList.contains('hidden'),true);
console.log('PASS: native cursor mode, hover without equipping, accurate empty slots, mouse and digit confirmation, same-number close, rule rejection, B/Escape cancel, rapid close/unlock race, re-lock denial recovery, normal game-dialog unlock, no click-through fire or movement.');

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

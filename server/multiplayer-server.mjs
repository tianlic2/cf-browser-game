import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const PATH = '/ws';
const VERSION = 1;
const MATCH_MS = Number(process.env.MATCH_MS || 10 * 60 * 1000);
const rooms = new Map();
const clients = new Map();
const FIRE_MS = Object.freeze({ ak:100, m4:90, scar:90, akgold:100, barrett:1550, m200:1455, deagle:240 });
const DAMAGE = Object.freeze({ ak:[36,108], m4:[33,99], scar:[33,99], akgold:[36,108], barrett:[300,400], m200:[300,400], deagle:[54,162] });
const SPAWNS = Object.freeze({ a:[0,0,27], b:[0,0,-27] });

const cleanName = value => String(value || '玩家').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,16) || '玩家';
const roomCode = () => {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code=''; const bytes=crypto.randomBytes(6);
    for(let i=0;i<6;i++) code+=chars[bytes[i]%chars.length];
    if(!rooms.has(code)) return code;
  }
};
const send=(ws,data)=>{ if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data)); };
const broadcast=(room,data,except=null)=>{ for(const p of room.players.values()) if(p.ws!==except) send(p.ws,data); };
const roster=room=>[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,hp:p.hp,score:p.score,dead:p.dead}));
const vector=(value,n=3)=>Array.isArray(value)&&value.length===n&&value.every(Number.isFinite)?value.map(Number):null;
const norm=v=>{const l=Math.hypot(...v);return l>.9&&l<1.1?v.map(x=>x/l):null};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const pointOnRay=(origin,dir,t)=>origin.map((v,i)=>v+dir[i]*t);
function rayHit(origin,dir,target){
  const base=target.state?.pos;if(!base)return null;
  const head=[base[0],base[1]+1.58,base[2]];
  const th=dot(sub(head,origin),dir); const ph=pointOnRay(origin,dir,Math.max(0,th));
  if(th>=0&&Math.hypot(...sub(ph,head))<=.23)return {head:true,distance:th};
  const center=[base[0],base[1]+.85,base[2]];
  const tc=dot(sub(center,origin),dir);if(tc<0)return null;
  const pc=pointOnRay(origin,dir,tc);
  const horizontal=Math.hypot(pc[0]-base[0],pc[2]-base[2]);
  if(horizontal<=.46&&pc[1]>=base[1]&&pc[1]<=base[1]+1.72)return {head:false,distance:tc};
  return null;
}
function removePlayer(player){
  const room=rooms.get(player.room);if(!room)return;
  room.players.delete(player.id);clients.delete(player.ws);
  broadcast(room,{type:'peer-left',id:player.id});
  if(!room.players.size){clearTimeout(room.endTimer);rooms.delete(room.code)}
  else {clearTimeout(room.endTimer);room.endTimer=null;room.started=false;broadcast(room,{type:'waiting',room:room.code,players:roster(room)});}
}
function welcome(room,player){
  send(player.ws,{type:'welcome',version:VERSION,id:player.id,room:room.code,team:player.team,host:player.host,players:roster(room)});
  broadcast(room,{type:'roster',players:roster(room)});
  if(room.players.size===2){
    room.started=true;room.startedAt=Date.now();
    for(const p of room.players.values()){
      p.hp=100;p.score=0;p.dead=false;p.invulnUntil=Date.now()+3000;p.state={pos:[...SPAWNS[p.team]],yaw:p.team==='a'?Math.PI:0,pitch:0,weapon:'ak',moving:false};
    }
    broadcast(room,{type:'match-start',map:'transport',limit:40,durationMs:MATCH_MS,players:roster(room),spawns:SPAWNS});
    clearTimeout(room.endTimer);
    room.endTimer=setTimeout(()=>{
      if(!room.started)return;room.started=false;
      const scores=roster(room);const ordered=[...room.players.values()].sort((a,b)=>b.score-a.score);
      const winner=ordered[0]?.score===ordered[1]?.score?null:ordered[0]?.id;
      broadcast(room,{type:'match-end',winner,scores});
    },MATCH_MS);room.endTimer.unref?.();
  }
}
function join(ws,msg){
  if(clients.has(ws))return;
  let room;
  if(msg.action==='create'){
    room={code:roomCode(),players:new Map(),started:false,startedAt:0,endTimer:null};rooms.set(room.code,room);
  }else{
    room=rooms.get(String(msg.room||'').toUpperCase());
    if(!room)return send(ws,{type:'error',code:'ROOM_NOT_FOUND',message:'房间不存在'});
    if(room.players.size>=2)return send(ws,{type:'error',code:'ROOM_FULL',message:'房间已满'});
  }
  const id=crypto.randomUUID();
  const player={id,ws,room:room.code,name:cleanName(msg.name),team:room.players.size?'b':'a',host:room.players.size===0,hp:100,score:0,dead:false,invulnUntil:0,lastStateAt:0,lastShotAt:0,state:null};
  room.players.set(id,player);clients.set(ws,player);welcome(room,player);
}
function state(player,msg){
  const room=rooms.get(player.room);if(!room?.started||player.dead)return;
  const pos=vector(msg.pos);if(!pos)return;
  const now=Date.now();
  if(player.state&&player.lastStateAt){
    const dt=Math.max(.05,Math.min(.5,(now-player.lastStateAt)/1000));
    if(Math.hypot(...sub(pos,player.state.pos))>12*dt+1.5)return;
  }
  if(Math.abs(pos[0])>40||Math.abs(pos[2])>75||pos[1]<-4||pos[1]>18)return;
  player.lastStateAt=now;
  player.state={pos,yaw:Number(msg.yaw)||0,pitch:Number(msg.pitch)||0,weapon:String(msg.weapon||'ak').slice(0,16),moving:!!msg.moving,crouching:!!msg.crouching,seq:Number(msg.seq)||0};
  broadcast(room,{type:'snapshot',id:player.id,...player.state,hp:player.hp,dead:player.dead},player.ws);
}
function shot(player,msg){
  const room=rooms.get(player.room);if(!room?.started||player.dead||!player.state)return;
  const now=Date.now();const weapon=String(msg.weapon||player.state.weapon);
  const interval=FIRE_MS[weapon];if(!interval||now-player.lastShotAt<interval*.84)return;
  const origin=vector(msg.origin),dir0=vector(msg.dir),dir=dir0&&norm(dir0);if(!origin||!dir)return;
  const eye=[player.state.pos[0],player.state.pos[1]+1.55,player.state.pos[2]];
  if(Math.hypot(...sub(origin,eye))>1.6)return;
  player.lastShotAt=now;
  broadcast(room,{type:'peer-shot',id:player.id,weapon,origin,dir},player.ws);
  const target=[...room.players.values()].find(p=>p!==player&&!p.dead);
  if(!target||now<target.invulnUntil)return;
  const hit=rayHit(origin,dir,target);
  const maxDistance=Math.max(0,Math.min(300,Number(msg.maxDistance)||0));
  if(!hit||hit.distance>maxDistance+.2)return;
  const pair=DAMAGE[weapon]||DAMAGE.ak;const damage=hit.head?pair[1]:pair[0];
  target.hp=Math.max(0,target.hp-damage);
  broadcast(room,{type:'damage',target:target.id,attacker:player.id,damage,head:hit.head,hp:target.hp});
  if(target.hp>0)return;
  target.dead=true;player.score++;
  broadcast(room,{type:'kill',killer:player.id,victim:target.id,head:hit.head,weapon,scores:roster(room)});
  if(player.score>=40){clearTimeout(room.endTimer);room.endTimer=null;room.started=false;broadcast(room,{type:'match-end',winner:player.id,scores:roster(room)});return;}
  setTimeout(()=>{
    if(!rooms.has(room.code)||!room.players.has(target.id)||!room.started)return;
    target.hp=100;target.dead=false;target.invulnUntil=Date.now()+3000;
    target.state={...target.state,pos:[...SPAWNS[target.team]],yaw:target.team==='a'?Math.PI:0,pitch:0};
    broadcast(room,{type:'respawn',id:target.id,pos:target.state.pos,yaw:target.state.yaw,hp:100,invulnMs:3000});
  },3000).unref?.();
}

const server=http.createServer((req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*'});return res.end(JSON.stringify({ok:true,rooms:rooms.size,players:clients.size,version:VERSION}));}
  res.writeHead(404,{'content-type':'text/plain'});res.end('CrossFire multiplayer WebSocket server');
});
const wss=new WebSocketServer({noServer:true,maxPayload:16*1024});
server.on('upgrade',(req,socket,head)=>{
  if(new URL(req.url,'http://localhost').pathname!==PATH){socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw)}catch{return}if(msg?.type==='hello')join(ws,msg);else{const p=clients.get(ws);if(!p)return;if(msg.type==='state')state(p,msg);else if(msg.type==='shot')shot(p,msg);else if(msg.type==='leave')removePlayer(p);}});
  ws.on('close',()=>{const p=clients.get(ws);if(p)removePlayer(p)});
  ws.on('error',()=>{});
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping();}},15000);
heartbeat.unref();
server.listen(PORT,()=>console.log(`CrossFire multiplayer server listening on :${PORT}${PATH}`));
export { server, rooms };

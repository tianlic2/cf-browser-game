import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const port = 18800 + Math.floor(Math.random() * 800);
const child = spawn(process.execPath, ['server/multiplayer-server.mjs'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const inbox = new WeakMap();
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    inbox.set(ws, []);
    ws.on('message', data => inbox.get(ws).push(JSON.parse(data)));
    ws.once('open', () => resolve(ws)); ws.once('error', reject);
  });
}
async function message(ws, type, timeout = 1500) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const list = inbox.get(ws); const index = list.findIndex(item => item.type === type);
    if (index >= 0) return list.splice(index, 1)[0];
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${type}`);
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server startup timeout')), 2500);
    child.stdout.on('data', data => { if (String(data).includes('listening')) { clearTimeout(timer); resolve(); } });
    child.once('exit', code => reject(new Error(`server exited ${code}`)));
  });
  const health = await fetch(`http://127.0.0.1:${port}/health`).then(response => response.json());
  assert.equal(health.ok, true);

  const a = await connect();
  a.send(JSON.stringify({ type: 'hello', version: 1, action: 'create', name: '房主' }));
  const aw = await message(a, 'welcome');
  assert.match(aw.room, /^[A-Z2-9]{6}$/); assert.equal(aw.team, 'a');
  const b = await connect();
  b.send(JSON.stringify({ type: 'hello', version: 1, action: 'join', room: aw.room, name: '好友' }));
  const bw = await message(b, 'welcome');
  assert.equal(bw.room, aw.room); assert.equal(bw.team, 'b');
  await Promise.all([message(a, 'match-start'), message(b, 'match-start')]);

  a.send(JSON.stringify({ type: 'state', pos: [0, 0, 27], yaw: Math.PI, pitch: 0, weapon: 'ak', seq: 1 }));
  b.send(JSON.stringify({ type: 'state', pos: [0, 0, -27], yaw: 0, pitch: 0, weapon: 'ak', seq: 1 }));
  const snap = await message(b, 'snapshot');
  assert.equal(snap.id, aw.id); assert.deepEqual(snap.pos, [0, 0, 27]);

  // Spawn protection is part of the public-room contract.
  a.send(JSON.stringify({ type: 'shot', origin: [0, 1.55, 27], dir: [0, 0, -1], weapon: 'ak', maxDistance: 100 }));
  await wait(100); assert.equal(inbox.get(a).some(item => item.type === 'damage'), false);
  await wait(3000);
  // A wall before the target must cap the authoritative ray.
  a.send(JSON.stringify({ type: 'shot', origin: [0, 1.55, 27], dir: [0, 0, -1], weapon: 'ak', maxDistance: 8 }));
  await wait(120); assert.equal(inbox.get(a).some(item => item.type === 'damage'), false);
  a.send(JSON.stringify({ type: 'shot', origin: [0, 1.55, 27], dir: [0, 0, -1], weapon: 'ak', maxDistance: 100 }));
  const damage = await message(a, 'damage');
  assert.equal(damage.target, bw.id); assert.equal(damage.head, true); assert.equal(damage.hp, 0);
  const kill = await message(a, 'kill');
  assert.equal(kill.killer, aw.id); assert.equal(kill.scores.find(p => p.id === aw.id).score, 1);
  const respawn = await message(a, 'respawn', 4000);
  assert.equal(respawn.id, bw.id); assert.equal(respawn.hp, 100);
  a.close(); b.close();
  console.log('multiplayer server: room, snapshot, protection, hit, score and respawn passed');
} finally {
  child.kill('SIGTERM');
}

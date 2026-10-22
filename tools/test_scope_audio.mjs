import fs from 'node:fs';
import assert from 'node:assert/strict';

function wav(path){
  const b=fs.readFileSync(path);
  assert.equal(b.toString('ascii',0,4),'RIFF');
  assert.equal(b.toString('ascii',8,12),'WAVE');
  let at=12,rate=0,channels=0,bits=0,data=null;
  while(at+8<=b.length){
    const id=b.toString('ascii',at,at+4),size=b.readUInt32LE(at+4),start=at+8;
    if(id==='fmt '){channels=b.readUInt16LE(start+2);rate=b.readUInt32LE(start+4);bits=b.readUInt16LE(start+14);}
    if(id==='data'){data=b.subarray(start,start+size);break;}
    at=start+size+(size&1);
  }
  assert(data,'missing data chunk');
  const samples=[];for(let i=0;i<data.length;i+=2)samples.push(data.readInt16LE(i));
  return {rate,channels,bits,samples};
}

const inside=wav(new URL('../audio/sw/scope_in_click.wav',import.meta.url));
const outside=wav(new URL('../audio/sw/scope_out_click.wav',import.meta.url));
for(const clip of [inside,outside]){
  assert.equal(clip.rate,44100);assert.equal(clip.channels,1);assert.equal(clip.bits,16);
  assert(Math.abs(clip.samples.length/clip.rate-.2264)<.002);
  const peak=Math.max(...clip.samples.map(Math.abs))/32767;assert(peak>.93&&peak<.95);
}
let error=0,energy=0;
for(let i=150;i<inside.samples.length-150;i++){
  const a=inside.samples[i],b=outside.samples[outside.samples.length-1-i];error+=(a-b)**2;energy+=a*a;
}
assert(error/energy<.0001,'scope-out must be the reversed scope-in transient');
const audio=fs.readFileSync(new URL('../scripts/audio.js',import.meta.url),'utf8');
assert.match(audio,/volJitter: 0, rateJitter: 0, wet: 0/);
assert.match(audio,/heavy \? \(stage === 2 \? 1\.06 : 0\.96\)/);
assert.match(audio,/last\+"\?v=scope-210018-1"/,'replaced scope files need a cache-busting URL');
const credits=fs.readFileSync(new URL('../audio/CREDITS.txt',import.meta.url),'utf8');
assert.match(credits,/freesound\.org\/s\/210018\//);assert.match(credits,/CC0/);
console.log('scope audio checks passed');

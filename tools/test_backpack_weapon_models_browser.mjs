import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:8123/?debug&debugMode=training&debugMap=transport&debugAutoStart=1');
  await page.waitForFunction(()=>window.__tactical?.ready()&&!document.getElementById('hud')?.classList.contains('hidden'),null,{timeout:120000});
  await page.evaluate(()=>{Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>document.getElementById('viewport')});document.dispatchEvent(new Event('pointerlockchange'));});
  await page.keyboard.press('b');
  const previews=[];
  for(let i=0;i<8;i++) {
    const data=await page.evaluate(async i=>{
      document.querySelector(`[data-bp="${i}"]`).dispatchEvent(new Event('mouseenter'));
      const cards=[...document.querySelectorAll('.bp-weapon-card')];
      const image=cards[0].querySelector('img');if(!image)return null;
      await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const c=canvas.getContext('2d');c.drawImage(image,0,0);const p=c.getImageData(0,0,canvas.width,canvas.height).data;
      let minX=canvas.width,maxX=0,minY=canvas.height,maxY=0,count=0;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(p[(y*canvas.width+x)*4+3]>25){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}
      return {name:cards[0].querySelector('.bp-weapon-name').textContent, width:maxX-minX,height:maxY-minY,count,melee:!!cards[2].querySelector('img')};
    },i);
    assert.ok(data&&data.count>500&&data.width>data.height*1.25,`backpack ${i+1} shows a legible side-on primary weapon: ${JSON.stringify(data)}`);
    assert.equal(data.melee,true,'melee thumbnail renders');previews.push(data);
  }
  await page.keyboard.press('b');
  const drops=await page.evaluate(async()=>{
    const t=window.__tactical; const THREE=await import('/vendor/three/build/three.module.js');
    const catalog=await import('/scripts/guncatalog.js?v=weapon-world-3');const result=[];
    for(let i=0;i<t.BACKPACKS.length;i++) {
      t.switchBackpack(i);t.clearSwitch();const {primary:id,skin}=t.BACKPACKS[i];
      const template=catalog.worldModel(id,skin);const size=new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
      const materials=[];template?.traverse(o=>{if(o.isMesh)materials.push(o.material?.name)});
      t.dropWeapon();const drop=t.groundItems().filter(x=>x.id===id&&x.skin===skin).at(-1);
      const pickup=t.pickUpNearest();
      result.push({id,skin,size:size.toArray(),materials,drop,pickup,held:t.backpackState().life.primary});
    }
    return result;
  });
  assert.equal(drops.length,8);
  for(const [i,entry] of drops.entries()) {
    assert.ok(entry.drop?.inScene&&entry.drop.meshes>0,`backpack ${i+1} drops its own weapon`);
    assert.equal(entry.pickup?.id,entry.id,`backpack ${i+1} can pick its dropped weapon back up`);
    assert.equal(entry.held?.skin,entry.skin,`backpack ${i+1} preserves the dropped skin after pickup`);
    assert.ok(entry.size[2]>entry.size[0] && entry.size[2]>entry.size[1],`backpack ${i+1} rigid model is aligned to the gun barrel: ${entry.size}`);
  }
  assert.ok(drops[3].materials.some(name=>/IronBeast/i.test(name)),`Iron Beast must use its source model: ${drops[3].materials}`);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  console.log('PASS: eight backpack images and matching aligned dropped weapons.',{previews,drops});
}finally{await browser.close();}

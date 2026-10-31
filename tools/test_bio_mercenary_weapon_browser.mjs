import assert from 'node:assert/strict';
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ headless:true, channel:'chrome' });
try {
  for (const map of ['bio','pyramid']) {
    const page=await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:8123/?debug&debugMap=${map}&debugMode=bio&debugAutoStart=1`);
    await page.waitForFunction(()=>window.__tactical?.bioMode?.phase==='live',null,{timeout:120000});
    const audit=await page.evaluate(()=>{
      const t=window.__tactical;t.pause();const mode=t.bioMode;
      for(let i=0;i<60;i++)mode.update(1/60,t.player,1/60);
      return mode.humans.filter(h=>h.alive).map(h=>{
        const r=h.rig; r.root.updateMatrixWorld(true);
        let meshes=0,visible=0;r.rifle?.traverse(o=>{if(o.isMesh){meshes++;if(o.visible)visible++;}});
        const gun=r.rifle?.getWorldPosition(r.root.position.clone());
        const hand=r.hand?.getWorldPosition(r.root.position.clone());
        return {hasRifle:!!r.rifle,meshes,visible,mounted:r.rifle?.parent===r.mount,
          mountVisible:r.mount.visible,handDistance:gun&&hand?gun.distanceTo(hand):null};
      });
    });
    console.log(map, JSON.stringify(audit));
    assert.ok(audit.length>0,'live match must contain human mercenaries');
    for(const actor of audit){
      assert.ok(actor.hasRifle && actor.meshes>0 && actor.visible>0 && actor.mounted && actor.mountVisible,
        `${map} mercenary must hold a visible gun in its weapon mount`);
      assert.ok(actor.handDistance<1,`${map} gun must follow the hand`);
    }
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: all surviving bio mercenaries hold visible mounted weapons on both maps.');
} finally { await browser.close(); }

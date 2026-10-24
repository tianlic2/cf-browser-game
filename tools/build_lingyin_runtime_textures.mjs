// Bake the authored Canvas maps once; the game downloads compact WebP maps.
import { chromium } from '../lingyin-map/node_modules/playwright-core/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out = new URL('../assets/lingyin/runtime-textures/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    window.__lingyinObserved = [];
    window.__THREE_DEVTOOLS__ = { dispatchEvent(event) {
      if (event.type === 'observe') window.__lingyinObserved.push(event.detail);
    } };
  });
  await page.goto('http://127.0.0.1:8123/preview/lingyin-editor.html?editor=lingyin&bakeLingyinTextures=1');
  await page.waitForFunction(() => !document.querySelector('#loading'), { timeout: 120000 });
  const maps = await page.evaluate(async () => {
    const scene = window.__lingyinObserved.find(object => object.isScene);
    const maps = {};
    scene.traverse(object => {
      if (!object.isMesh || Array.isArray(object.material)) return;
      const material = object.material;
      const names = { 'leaf-card': 'forest-atlas', 'lingyin-leaf-card': 'gate-atlas',
        'flagstone-platform': 'gate-paving' };
      if (names[material.name] && material.map?.image)
        maps[names[material.name]] = material.map.image;
    });
    for (const [name, file] of [
      ['forest-ground-albedo', 'forest-ground-albedo.jpg'],
      ['forest-ground-normal', 'forest-ground-normal.jpg'],
    ]) {
      const response = await fetch(`assets/lingyin/temple-textures/${file}`);
      maps[name] = await createImageBitmap(await response.blob());
    }
    const result = {};
    for (const [name, image] of Object.entries(maps)) {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      result[name] = canvas.toDataURL('image/webp', name.endsWith('normal') ? .96 : .94).split(',')[1];
    }
    return result;
  });
  for (const [name, data] of Object.entries(maps)) {
    const bytes = Buffer.from(data, 'base64');
    await writeFile(new URL(`${name}.webp`, out), bytes);
    console.log(`${name}: ${bytes.length} bytes`);
  }
} finally { await browser.close(); }

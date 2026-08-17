// Genera pares apagado/encendido sintéticos para desarrollar sin gastar API.
// No pretenden ser bonitos: solo alineados al píxel y con la misma geometría,
// que es lo único que el shader necesita para poder afinarse.
//
//   node tools/placeholders.mjs

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdir } from 'node:fs/promises';

const ROOMS = [
  { id: 'umbral', hue: 28, boxes: 3, depth: 0.55 },
  { id: 'salon', hue: 24, boxes: 5, depth: 0.35 },
  { id: 'cocina', hue: 34, boxes: 6, depth: 0.45 },
  { id: 'pasillo', hue: 20, boxes: 4, depth: 0.75 },
  { id: 'dormitorio', hue: 18, boxes: 3, depth: 0.4 },
  { id: 'jardin', hue: 40, boxes: 7, depth: 0.25 },
];

const page = (r, lit) => `
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#05070d}
  .room{position:relative;width:1600px;height:900px;
    background:radial-gradient(120% 90% at 50% ${r.depth * 100}%,
      hsl(${r.hue} ${lit ? 45 : 12}% ${lit ? 26 : 6}%),
      hsl(${r.hue + 190} ${lit ? 18 : 22}% ${lit ? 6 : 3}%) 70%);}
  .b{position:absolute;background:hsl(${r.hue} ${lit ? 30 : 10}% ${lit ? 18 : 7}%);
     box-shadow:0 0 ${lit ? 90 : 0}px hsl(${r.hue} 80% 60% / ${lit ? 0.35 : 0});
     border:1px solid hsl(${r.hue} ${lit ? 50 : 15}% ${lit ? 34 : 10}%)}
  .l{position:absolute;border-radius:50%;
     background:hsl(${r.hue} 90% ${lit ? 72 : 12}%);
     box-shadow:0 0 ${lit ? 160 : 4}px ${lit ? 40 : 0}px hsl(${r.hue} 95% 62% / ${lit ? 0.5 : 0})}
  .f{position:absolute;inset:auto 0 0 0;height:34%;
     background:linear-gradient(hsl(${r.hue} ${lit ? 25 : 8}% ${lit ? 16 : 5}%),
       hsl(${r.hue} ${lit ? 18 : 6}% ${lit ? 8 : 3}%))}
</style>
<div class="room">
  <div class="f"></div>
  ${Array.from({ length: r.boxes }, (_, i) => {
    const x = 60 + i * (1480 / r.boxes);
    const w = 1480 / r.boxes - 70;
    const h = 200 + ((i * 137) % 320);
    return `<div class="b" style="left:${x}px;top:${420 - h / 2}px;width:${w}px;height:${h}px"></div>`;
  }).join('')}
  ${Array.from({ length: r.boxes }, (_, i) => {
    const x = 90 + i * (1480 / r.boxes);
    return `<div class="l" style="left:${x}px;top:${180 + ((i * 71) % 90)}px;width:26px;height:26px"></div>`;
  }).join('')}
</div>`;

const out = new URL('../public/rooms/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });

for (const r of ROOMS) {
  for (const lit of [false, true]) {
    await p.setContent(page(r, lit));
    await p.waitForTimeout(80);
    await p.screenshot({
      path: `${out}${r.id}-${lit ? 'on' : 'off'}.jpg`,
      type: 'jpeg',
      quality: 88,
    });
  }
  console.log('·', r.id);
}

await browser.close();
console.log('placeholders →', out);

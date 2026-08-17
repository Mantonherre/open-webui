// Ciclo de crítica visual: levantar, mover el ratón como lo haría alguien,
// capturar. Una captura vale más que cualquier descripción del estado.
//
//   node tools/shots.mjs

import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
import { mkdir } from 'node:fs/promises';

const OUT = new URL('../shots/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:5199/', { waitUntil: 'load' });
await page.waitForTimeout(3000);

// 1. Intro, sin tocar nada.
await page.screenshot({ path: `${OUT}01-intro.png` });

// 2. Barrer el ratón: la casa se enciende por donde pasa.
for (const [x, y] of [[420, 520], [620, 480], [820, 500], [980, 430]]) {
  await page.mouse.move(x, y, { steps: 14 });
  await page.waitForTimeout(140);
}
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}02-encendido.png` });

// 3. Estela: soltar el ratón en una esquina y ver cómo decae.
await page.mouse.move(1300, 200, { steps: 20 });
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}03-estela.png` });

// 4-6. Capítulos.
const h = await page.evaluate(() => document.body.scrollHeight);
console.log('scrollHeight', h);
let i = 4;
for (const p of [0.25, 0.5, 0.78]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(h * p));
  await page.waitForTimeout(1200);
  await page.mouse.move(700 + p * 300, 430 + p * 120, { steps: 16 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}0${i++}-cap-${p}.png` });
}

const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
        else res(Math.round((n * 1000) / (performance.now() - t0)));
      };
      requestAnimationFrame(tick);
    })
);

console.log('fps(swiftshader, suelo pesimista):', fps);
console.log('errores:', errors.slice(0, 6));
await browser.close();

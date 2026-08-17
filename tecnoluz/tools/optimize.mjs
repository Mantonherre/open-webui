// Los assets salen de la API a 2048 y ~600 KB. Servirlos así se carga el
// presupuesto de LCP, y a 1920 en una pasada fullscreen no se distingue.
//
//   node tools/optimize.mjs

import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FF = '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const dir = new URL('../public/rooms/', import.meta.url).pathname;

const files = (await readdir(dir)).filter((f) => f.endsWith('.jpg'));
let before = 0;
let after = 0;

for (const f of files) {
  const src = dir + f;
  const dst = src.replace(/\.jpg$/, '.webp');
  before += (await stat(src)).size;

  await run(FF, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', src,
    '-vf', 'scale=1920:-2:flags=lanczos',
    // Las apagadas son casi planas y aguantan más compresión que las
    // encendidas, donde el degradado de la luz es lo que hay que preservar.
    '-quality', f.includes('-off') ? '72' : '82',
    dst,
  ]);

  after += (await stat(dst)).size;
  await unlink(src);
}

console.log(
  `${files.length} imágenes · ${Math.round(before / 1024 / 1024 * 10) / 10} MB → ` +
  `${Math.round(after / 1024 / 1024 * 10) / 10} MB`
);

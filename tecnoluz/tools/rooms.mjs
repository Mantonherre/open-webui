// Genera los pares apagado/encendido con la API de ByteDance (Ark).
//
// La clave del método: la imagen ENCENDIDA se genera de cero, y la APAGADA se
// genera EDITANDO esa misma imagen. No son dos generaciones independientes —
// si lo fueran, no coincidirían y el shader mezclaría dos casas distintas.
//
//   ARK_API_KEY=... node tools/rooms.mjs            # todas
//   ARK_API_KEY=... node tools/rooms.mjs salon      # una
//
// Variables:
//   ARK_API_KEY   (obligatoria)
//   ARK_BASE_URL  https://ark.ap-southeast.bytepluses.com  (BytePlus, por defecto)
//                 https://ark.cn-beijing.volces.com        (Volcengine)
//   ARK_MODEL     id del modelo de imagen (Seedream)

import { writeFile, mkdir, readFile } from 'node:fs/promises';

const KEY = process.env.ARK_API_KEY;
const BASE = process.env.ARK_BASE_URL || 'https://ark.ap-southeast.bytepluses.com';
const MODEL = process.env.ARK_MODEL || 'seedream-4-0-250828';

if (!KEY) {
  console.error('Falta ARK_API_KEY');
  process.exit(1);
}

// Una sola dirección de arte, repetida. La coherencia entre estancias es lo
// que hace que parezca una casa y no seis fotos de stock.
const LOOK = [
  'cinematic architectural interior photograph, modern Mediterranean house in',
  'Alicante, Spain. Travertine, walnut wood, lime plaster walls, linen.',
  'Shot on 35mm, f/2.8, eye level, symmetrical composition, deep perspective.',
  'Night. Warm 2700K architectural lighting: cove lighting, recessed downlights,',
  'linear LED under cabinets. Nothing overlit. Deep shadows preserved.',
  'Muted palette: charcoal blue, warm amber accents, bone white. No people.',
  'No text, no watermark, no logo.',
].join(' ');

const ROOMS = {
  umbral:
    'the entrance threshold seen from outside, a pivoting walnut door half open, stone path, olive tree',
  salon: 'the living room, low sofa, coffee table, large window to a dark garden',
  cocina: 'the kitchen, long island, matte cabinetry, linear light under the wall units',
  pasillo: 'a narrow corridor with doorways, a bench, art on one wall, receding perspective',
  dormitorio: 'the bedroom, low bed, headboard, bedside wall sconces, curtains',
  jardin: 'the garden and pool at night seen from the terrace, the lit house in the background',
};

// La instrucción de apagado. Lo único que puede cambiar es la luz.
//
// Decir "luz de luna" hace que el modelo pinte las luminarias de azul en vez
// de apagarlas. Hay que prohibir explícitamente que cualquier fuente emita:
// el contrato con el shader es que TODA la luz de la escena la pone el usuario.
const OFF_EDIT = [
  'A total blackout of this exact scene. Every single light fixture is switched',
  'OFF and emits no light whatsoever: no glowing bulbs, no lit LED strips,',
  'no illuminated downlights, no bright spots anywhere.',
  'Keep the exact same camera, framing, composition, geometry, furniture,',
  'materials and textures — do not move, add or redraw anything.',
  'The only illumination is a very weak ambient night sky, desaturated,',
  'near-monochrome dark blue-grey. Shapes are barely readable silhouettes.',
  'Underexposed, deep shadows, no warm tones at all.',
].join(' ');

const out = new URL('../public/rooms/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

async function ark(body) {
  const res = await fetch(`${BASE}/api/v3/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 400)}`);
  const d = json.data?.[0];
  if (!d) throw new Error('respuesta sin data: ' + JSON.stringify(json).slice(0, 400));
  return d.url || `data:image/jpeg;base64,${d.b64_json}`;
}

async function save(url, path) {
  const buf = url.startsWith('data:')
    ? Buffer.from(url.split(',')[1], 'base64')
    : Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(path, buf);
  return buf.length;
}

const args = process.argv.slice(2);
// La encendida buena cuesta iteraciones de prompt. Cuando ya la tienes, se
// conserva y solo se rehace la apagada: --off-only
const offOnly = args.includes('--off-only');
const only = args.find((a) => !a.startsWith('--'));
const targets = only ? [[only, ROOMS[only]]] : Object.entries(ROOMS);

for (const [id, subject] of targets) {
  if (!subject) {
    console.error('estancia desconocida:', id);
    continue;
  }

  let onUrl;
  let onBytes = 0;

  if (offOnly) {
    process.stdout.write(`${id} · encendida en disco… `);
    const buf = await readFile(`${out}${id}-on.jpg`);
    onUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
    onBytes = buf.length;
  } else {
    process.stdout.write(`${id} · encendida… `);
    onUrl = await ark({
      model: MODEL,
      prompt: `${LOOK} Subject: ${subject}.`,
      size: '2048x1152', // 16:9 — el encaje "cover" del shader es más limpio
      response_format: 'url',
      watermark: false,
    });
    onBytes = await save(onUrl, `${out}${id}-on.jpg`);
  }

  process.stdout.write(`apagada… `);
  const offUrl = await ark({
    model: MODEL,
    prompt: OFF_EDIT,
    image: onUrl, // ← la edición sobre la misma imagen: alineación al píxel
    size: '2048x1152',
    response_format: 'url',
    watermark: false,
  });
  const offBytes = await save(offUrl, `${out}${id}-off.jpg`);

  console.log(`ok (${Math.round(onBytes / 1024)}KB / ${Math.round(offBytes / 1024)}KB)`);
}

console.log('\nlisto →', out);

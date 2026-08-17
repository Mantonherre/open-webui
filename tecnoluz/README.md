# Tecnoluz — "La casa te espera a oscuras"

Web cinemática de una sola idea: **la casa está apagada y el usuario la enciende
con el cursor**. No es un vídeo scrubbeado — es una escena WebGL que reacciona.

## Cómo funciona

Cada estancia son **dos imágenes alineadas al píxel**: apagada y encendida.
Un shader interpola entre las dos usando una máscara que el usuario pinta con
el puntero. La máscara se acumula en un ping-pong de render targets y decae con
una vida media de ~2,6 s, así que la luz se queda un momento y se va.

    src/canvas/Scene.js              renderer, ping-pong, damping
    src/canvas/shaders/light.frag    pasada de acumulación (dónde hay luz)
    src/canvas/shaders/room.frag     composición + grano + dithering + viñeta
    src/motion/lenis.js              un único ticker para Lenis + GSAP + render
    src/content.js                   las seis estancias y sus textos
    tools/rooms.mjs                  generación de assets (ByteDance Ark)
    tools/placeholders.mjs           pares sintéticos para desarrollar sin API
    tools/shots.mjs                  ciclo de crítica visual

## Uso

    npm install
    node tools/placeholders.mjs      # assets de trabajo
    npm run dev

Con la API de ByteDance:

    ARK_API_KEY=xxx node tools/rooms.mjs

## Decisiones que no son negociables

- Las dos imágenes de cada estancia se generan como **edición de la misma**,
  nunca por separado: si no coinciden al píxel, el mix mezcla dos casas.
- `dpr` limitado a 2 y la máscara a media resolución.
- Dithering en la composición: sin él una escena oscura hace banding.
- Damping independiente del frame rate (`1 - pow(k, delta)`), no lerp fijo.
- `prefers-reduced-motion`: la casa aparece encendida, sin recorrido.

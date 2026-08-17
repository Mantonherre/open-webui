// Pasada de acumulación: pinta la luz que el usuario deja a su paso.
// Sale a un render target de un solo canal conceptual (usamos .r).
//
// Sin esto el cursor sería una linterna. Con esto, la casa se queda encendida
// donde ya has pasado y se apaga despacio detrás — que es lo que hace que se
// sienta que estás encendiendo algo, no alumbrando.

precision highp float;

varying vec2 vUv;

uniform sampler2D uPrev;
uniform vec2  uPointer;    // en espacio corregido por aspecto
uniform float uAspect;
uniform float uRadius;
uniform float uDecay;      // ya calculado frame-rate independiente en JS
uniform float uTime;
uniform float uStrength;   // 0 cuando el puntero no está activo
uniform float uWipe;       // 1 = conservar, 0 = limpiar (cambio de capítulo)

void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);

  // Borde irregular: un círculo perfecto se lee como "filtro de Photoshop".
  float warp = fbm(p * 3.2 + uTime * 0.06) * 0.055;
  float d = distance(p, uPointer) + warp;

  float stamp = 1.0 - smoothstep(uRadius * 0.08, uRadius, d);
  stamp = pow(max(stamp, 0.0), 1.5) * uStrength;

  float prev = texture2D(uPrev, vUv).r * uDecay * uWipe;

  // max() y no suma: la luz no se acumula hasta quemarse al pasar dos veces.
  gl_FragColor = vec4(max(prev, stamp), 0.0, 0.0, 1.0);
}

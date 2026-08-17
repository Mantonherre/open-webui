// Composición final.
//
// Cada estancia son DOS imágenes alineadas al píxel: apagada y encendida.
// La máscara acumulada decide, por píxel, cuánta luz hay ahí.
// Todo lo demás (grano, dithering, viñeta) es acabado, y es la diferencia
// entre "un mix de dos texturas" y algo que parece rodado.

precision highp float;

varying vec2 vUv;

uniform sampler2D uOffA, uOnA, uOffB, uOnB;
uniform vec2  uScaleA, uScaleB;
uniform sampler2D uMask;
uniform float uBlend;      // 0 = estancia A, 1 = estancia B
uniform float uAmbient;    // luz de base: nunca negro absoluto
uniform float uGain;
uniform float uTime;
uniform float uReveal;     // entrada desde negro del preloader
uniform float uDip;        // caída a negro al cruzar de una estancia a otra
uniform vec3  uBrasa;
uniform vec2  uResolution;

void main() {
  vec2 uvA = coverUv(vUv, uScaleA);
  vec2 uvB = coverUv(vUv, uScaleB);

  vec3 off = mix(texture2D(uOffA, uvA).rgb, texture2D(uOffB, uvB).rgb, uBlend);
  vec3 on  = mix(texture2D(uOnA,  uvA).rgb, texture2D(uOnB,  uvB).rgb, uBlend);

  float m = texture2D(uMask, vUv).r;
  float lit = clamp(m * uGain + uAmbient, 0.0, 1.0);
  lit = smoothstep(0.0, 1.0, lit);

  vec3 col = mix(off, on, lit);

  // La luz tiene temperatura: el núcleo tira a brasa, no a blanco.
  col += uBrasa * pow(m, 3.0) * 0.14;

  // Viñeta — contenida. Se nota cuando falta, no cuando está.
  float v = 1.0 - smoothstep(0.55, 1.25, length(vUv - 0.5) * 1.6);
  col *= mix(0.78, 1.0, v);

  // Grano de película: unifica la imagen y disimula el resto.
  float g = hash12(vUv * uResolution + fract(uTime) * 431.0) - 0.5;
  col += g * 0.028;

  // Dithering: sin esto, una escena oscura hace banding y se lee barata.
  col += (hash12(vUv * uResolution + 17.0) - 0.5) / 255.0;

  col *= uReveal * uDip;

  gl_FragColor = vec4(col, 1.0);
}

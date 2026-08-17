import * as THREE from 'three';

import './tokens.css';
import './styles.css';

import { rooms } from './content.js';
import { Scene } from './canvas/Scene.js';
import { gsap, ScrollTrigger, lenis, reducedMotion } from './motion/lenis.js';

const canvas = document.querySelector('[data-scene]');
const scene = new Scene(canvas, rooms);

// --- Carga ---------------------------------------------------------------
// El preloader es parte de la experiencia. No se revela la escena hasta que
// hay algo que revelar.

const loader = new THREE.TextureLoader();
const loadTexture = (url) =>
  new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace; // textura de color, no de datos
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });

const bar = document.querySelector('[data-preload-bar]');
const label = document.querySelector('[data-preload-label]');
const preloader = document.querySelector('[data-preloader]');

async function loadAll() {
  const urls = rooms.flatMap((r) => [r.off, r.on]);
  let done = 0;
  const textures = await Promise.all(
    urls.map((u) =>
      loadTexture(u).then((t) => {
        done++;
        const p = done / urls.length;
        if (bar) bar.style.transform = `scaleX(${p})`;
        if (label) label.textContent = String(Math.round(p * 100)).padStart(2, '0');
        return t;
      })
    )
  );
  return rooms.map((r, i) => ({
    ...r,
    off: textures[i * 2],
    on: textures[i * 2 + 1],
  }));
}

// --- DOM de los capítulos ------------------------------------------------

const main = document.querySelector('.dom');

function buildChapters() {
  rooms.forEach((r) => {
    const s = document.createElement('section');
    s.className = 'chapter';
    s.dataset.room = r.id;
    s.innerHTML = `
      <div class="chapter__meta">
        <span class="chapter__num">${r.num}</span>
        <span class="chapter__rule"></span>
        <span class="chapter__label">${r.label}</span>
      </div>
      <p class="chapter__line">${r.line}</p>
    `;
    main.appendChild(s);
  });
}

// --- Arranque ------------------------------------------------------------

async function start() {
  buildChapters();
  const loaded = await loadAll();

  scene.setTextures(loaded[0], loaded[1]);
  scene.resize();

  // Los start/end de ScrollTrigger se calculan sobre alturas que solo son
  // definitivas cuando fuentes e imágenes ya están.
  await document.fonts?.ready;
  ScrollTrigger.refresh();

  gsap.to(preloader, {
    autoAlpha: 0,
    duration: 0.8,
    ease: 'power2.out',
    onComplete: () => preloader.remove(),
  });

  if (reducedMotion) {
    // Estados finales, sin transición: la casa encendida.
    scene.reveal = 1;
    scene.roomMat.uniforms.uAmbient.value = 1;
    gsap.set('.intro__title, .chapter__meta, .chapter__line', { autoAlpha: 1, y: 0 });
  } else {
    gsap.to(scene, { reveal: 1, duration: 1.4, ease: 'power2.out', delay: 0.1 });
    introAnimation();
    chapterAnimations();
  }

  scrollBinding(loaded);
}

function introAnimation() {
  // Stagger. Nada entra a la vez: 60 ms entre hermanos.
  const words = document.querySelectorAll('.intro__title em, .intro__title');
  gsap.from(words, {
    yPercent: 40,
    autoAlpha: 0,
    duration: 1.2,
    ease: 'expo.out',
    stagger: 0.06,
    delay: 0.35,
  });
  gsap.from('[data-hint]', {
    autoAlpha: 0,
    duration: 0.7,
    ease: 'power2.out',
    delay: 1.4,
  });
  // La pista desaparece en cuanto entiendes el gesto. No se queda pidiendo.
  window.addEventListener(
    'pointermove',
    () => gsap.to('[data-hint]', { autoAlpha: 0, duration: 0.5 }),
    { once: true }
  );
}

function chapterAnimations() {
  document.querySelectorAll('.chapter:not(.chapter--intro)').forEach((el) => {
    const parts = el.querySelectorAll('.chapter__meta, .chapter__line');

    gsap.from(parts, {
      scrollTrigger: { trigger: el, start: 'top 65%', toggleActions: 'play none none reverse' },
      yPercent: 30,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'expo.out',
      stagger: 0.07,
    });

    // Y se va. Se anima la sección, no sus hijos: si dos tweens pelean por el
    // mismo autoAlpha, gana el último que renderice y el resultado es azaroso.
    gsap.to(el, {
      scrollTrigger: { trigger: el, start: 'bottom 55%', end: 'bottom 15%', scrub: true },
      autoAlpha: 0,
      ease: 'none',
    });
  });
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function scrollBinding(loaded) {
  const n = loaded.length;
  let current = -1;

  ScrollTrigger.create({
    trigger: '.dom',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      // El primer 100vh es la intro sobre la estancia 0: el recorrido de
      // estancias empieza después.
      const p = self.progress;
      const f = Math.min(Math.max(p * n - 0.6, 0), n - 1.001);
      const i = Math.floor(f);
      const blend = f - i;

      if (i !== current) {
        current = i;
        scene.setTextures(loaded[i], loaded[Math.min(i + 1, n - 1)]);
        // Al cambiar de estancia la luz pintada no vale: es otro sitio.
        scene.wipe = 0;
        gsap.delayedCall(0.06, () => (scene.wipe = 1));
      }
      // Un crossfade lineal entre dos fotografías da doble exposición: durante
      // medio capítulo se ven dos casas encima. Se concentra el cambio en el
      // 16% central del tramo y se cruza con una caída a negro — se lee como
      // pasar por un umbral, que es lo que la web está contando.
      scene.roomMat.uniforms.uBlend.value = smoothstep(0.42, 0.58, blend);
      const cross = 1 - Math.abs(blend - 0.5) * 2; // 0 en los extremos, 1 en medio
      scene.roomMat.uniforms.uDip.value = 1 - Math.pow(Math.max(cross - 0.72, 0) / 0.28, 2) * 0.85;
    },
  });
}

// --- Entrada ---------------------------------------------------------------

window.addEventListener('pointermove', (e) => {
  scene.onPointer(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
});
window.addEventListener('pointerleave', () => scene.onPointerLeave());

// Táctil: no hay cursor, así que la luz sigue al dedo y, si no hay dedo,
// recorre sola. En móvil la idea tiene que sostenerse, no desaparecer.
let idle = 0;
function ambientPointer(t) {
  if (scene.pointerActiveTarget > 0.5) return;
  idle = t;
  scene.onPointer(0.5 + Math.sin(t * 0.00021) * 0.28, 0.5 + Math.cos(t * 0.00017) * 0.2);
  scene.pointerActiveTarget = 1;
}

const isTouch = window.matchMedia('(hover: none)').matches;

window.addEventListener('resize', () => {
  scene.resize();
  ScrollTrigger.refresh();
});

// Un solo bucle: el ticker de GSAP, que ya mueve Lenis.
gsap.ticker.add((time) => {
  if (isTouch) ambientPointer(time * 1000);
  scene.render();
});

start();

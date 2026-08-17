import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Una sola fuente de verdad. Lenis, GSAP y el render loop cuelgan del mismo
// ticker: tres bucles independientes producen micro-jitter que no se ve en un
// GIF pero se siente con el ratón en la mano.

export const lenis = new Lenis({
  lerp: 0.1,
  smoothWheel: true,
  // Sin esto en táctil el scroll se siente roto, no suave.
  smoothTouch: false,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

export { gsap, ScrollTrigger };

export const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

if (reducedMotion) lenis.destroy();

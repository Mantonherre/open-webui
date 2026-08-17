import * as THREE from 'three';

import quadVert from './shaders/quad.vert.glsl?raw';
import lib from './shaders/lib.glsl?raw';
import lightFrag from './shaders/light.frag.glsl?raw';
import roomFrag from './shaders/room.frag.glsl?raw';

// Vite no resuelve #include en GLSL. Concatenar es más honesto que fingir
// un preprocesador que no existe.
const withLib = (src) => {
  const i = src.indexOf('\n', src.lastIndexOf('precision'));
  return src.slice(0, i + 1) + lib + src.slice(i + 1);
};

const BRASA = new THREE.Color('#e8a84c').convertSRGBToLinear();

export class Scene {
  constructor(canvas, rooms) {
    this.rooms = rooms;
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // pasada fullscreen: el antialias no aporta y cuesta
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.geometry = new THREE.PlaneGeometry(2, 2);

    // --- Puntero, con damping. El objetivo salta; lo que se dibuja, no.
    this.pointer = { x: 0.5, y: 0.5 };
    this.pointerTarget = { x: 0.5, y: 0.5 };
    this.pointerActive = 0;
    this.pointerActiveTarget = 0;

    // --- Estado de scroll
    this.progress = 0; // 0..1 sobre todas las estancias
    this.reveal = 0;
    this.wipe = 1;

    this._initTargets();
    this._initMaterials();

    this.clock = new THREE.Clock();
    this.resize();
  }

  // Ping-pong: la máscara de luz de este frame se calcula leyendo la del
  // anterior. Half-float porque en 8 bits el decay se escalona a ojo.
  _initTargets() {
    const opts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
  }

  _initMaterials() {
    this.lightMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: withLib(lightFrag),
      uniforms: {
        uPrev: { value: null },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: 1 },
        uRadius: { value: 0.26 },
        uDecay: { value: 0.99 },
        uTime: { value: 0 },
        uStrength: { value: 0 },
        uWipe: { value: 1 },
      },
    });

    this.roomMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: withLib(roomFrag),
      uniforms: {
        uOffA: { value: null },
        uOnA: { value: null },
        uOffB: { value: null },
        uOnB: { value: null },
        uScaleA: { value: new THREE.Vector2(1, 1) },
        uScaleB: { value: new THREE.Vector2(1, 1) },
        uMask: { value: null },
        uBlend: { value: 0 },
        uAmbient: { value: 0.06 },
        uGain: { value: 1.15 },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uDip: { value: 1 },
        uBrasa: { value: BRASA },
        uResolution: { value: new THREE.Vector2(1, 1) },
      },
    });

    this.lightScene = new THREE.Scene();
    this.lightScene.add(new THREE.Mesh(this.geometry, this.lightMat));

    this.roomScene = new THREE.Scene();
    this.roomScene.add(new THREE.Mesh(this.geometry, this.roomMat));
  }

  setTextures(a, b) {
    const u = this.roomMat.uniforms;
    u.uOffA.value = a.off;
    u.uOnA.value = a.on;
    u.uOffB.value = (b || a).off;
    u.uOnB.value = (b || a).on;
    this._applyCover();
  }

  _applyCover() {
    const u = this.roomMat.uniforms;
    const screen = this.width / this.height;
    const fit = (tex, out) => {
      if (!tex?.image?.width) return;
      const img = tex.image.width / tex.image.height;
      if (img > screen) out.set(img / screen, 1);
      else out.set(1, screen / img);
    };
    fit(u.uOffA.value, u.uScaleA.value);
    fit(u.uOffB.value, u.uScaleB.value);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(dpr);

    // La máscara no necesita resolución completa: es un degradado suave.
    // A la mitad ahorra la mitad de fill rate y no se distingue.
    const mw = Math.round((this.width * dpr) / 2);
    const mh = Math.round((this.height * dpr) / 2);
    this.rtA.setSize(mw, mh);
    this.rtB.setSize(mw, mh);

    this.aspect = this.width / this.height;
    this.lightMat.uniforms.uAspect.value = this.aspect;
    this.roomMat.uniforms.uResolution.value.set(this.width, this.height);
    this._applyCover();
  }

  onPointer(x, y) {
    this.pointerTarget.x = x;
    this.pointerTarget.y = 1 - y;
    this.pointerActiveTarget = 1;
  }

  onPointerLeave() {
    this.pointerActiveTarget = 0;
  }

  render() {
    const delta = Math.min(this.clock.getDelta(), 1 / 30);
    const time = this.clock.elapsedTime;

    // Damping independiente del frame rate. Un lerp con factor fijo corre al
    // doble de velocidad en un monitor de 120 Hz.
    const k = 1 - Math.pow(0.0015, delta);
    this.pointer.x += (this.pointerTarget.x - this.pointer.x) * k;
    this.pointer.y += (this.pointerTarget.y - this.pointer.y) * k;
    this.pointerActive +=
      (this.pointerActiveTarget - this.pointerActive) * (1 - Math.pow(0.02, delta));

    const lu = this.lightMat.uniforms;
    lu.uPointer.value.set(this.pointer.x * this.aspect, this.pointer.y);
    lu.uTime.value = time;
    lu.uStrength.value = this.pointerActive;
    lu.uWipe.value = this.wipe;
    // Vida media de la luz ≈ 2.6 s. Ni linterna ni permanente.
    lu.uDecay.value = Math.pow(0.5, delta / 2.6);
    lu.uPrev.value = this.rtA.texture;

    this.renderer.setRenderTarget(this.rtB);
    this.renderer.render(this.lightScene, this.camera);
    this.renderer.setRenderTarget(null);

    const tmp = this.rtA;
    this.rtA = this.rtB;
    this.rtB = tmp;

    const ru = this.roomMat.uniforms;
    ru.uMask.value = this.rtA.texture;
    ru.uTime.value = time;
    ru.uReveal.value = this.reveal;

    this.renderer.render(this.roomScene, this.camera);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.geometry.dispose();
    this.lightMat.dispose();
    this.roomMat.dispose();
    this.renderer.dispose();
  }
}

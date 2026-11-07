/**
 * A crème brûlée blowtorch: gas canister, valve head, angled nozzle. Modeled
 * in three.js from turned (lathe) parts and rendered once to a transparent
 * canvas for the develop layer on /about. Also reports where the nozzle tip
 * lands in the image, so a click can blow fire out of it.
 */
import * as THREE from 'three';

export interface Render { canvas: HTMLCanvasElement; tip: { x: number; y: number }; dir: { x: number; y: number } }

const lathe = (pts: [number, number][], mat: THREE.Material) =>
  new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 64), mat);

export function renderBlowtorch(size = 800): Render | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.3, 9);
  camera.lookAt(0, 0.2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(4, 1, -3);
  scene.add(rim);

  const body = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.25, metalness: 0.4 });

  const torch = new THREE.Group();

  // gas canister with a domed shoulder and a rolled base
  torch.add(lathe([[0, -2.0], [0.6, -2.0], [0.66, -1.92], [0.66, -0.3], [0.6, -0.05], [0.42, 0.15], [0.22, 0.25], [0, 0.26]], body));
  // grip band
  const band = lathe([[0.675, -1.25], [0.69, -1.2], [0.69, -0.75], [0.675, -0.7]], dark);
  torch.add(band);

  // valve head: a short neck, then the block with the gas knob
  torch.add(lathe([[0, 0.2], [0.2, 0.2], [0.2, 0.45], [0, 0.45]], metal));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.5, 4, 4, 4), body);
  head.position.set(0.1, 0.72, 0);
  torch.add(head);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 32), dark);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(0.0, 0.7, 0.32);
  torch.add(knob);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.22), dark);
  trigger.position.set(-0.28, 0.58, 0);
  trigger.rotation.z = 0.25;
  torch.add(trigger);

  // nozzle: barrel and a flared tip, angled up and forward
  const nozzle = new THREE.Group();
  nozzle.add(lathe([[0, 0], [0.12, 0], [0.11, 1.15], [0.15, 1.2], [0.15, 1.42], [0.12, 1.45], [0, 1.45]], metal));
  nozzle.position.set(0.32, 0.86, 0);
  nozzle.rotation.z = -1.05;
  torch.add(nozzle);

  torch.rotation.set(0.12, -0.5, 0.18);
  torch.position.set(-0.35, 0.25, 0);
  scene.add(torch);

  renderer.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);

  // where the nozzle tip and its direction land in the image (0..1)
  scene.updateMatrixWorld(true);
  const tip3 = new THREE.Vector3(0, 1.48, 0).applyMatrix4(nozzle.matrixWorld);
  const back3 = new THREE.Vector3(0, 0.6, 0).applyMatrix4(nozzle.matrixWorld);
  const toImg = (v: THREE.Vector3) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }; };
  const tip = toImg(tip3), back = toImg(back3);
  const len = Math.hypot(tip.x - back.x, tip.y - back.y) || 1;

  scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
  renderer.dispose();
  renderer.forceContextLoss();
  return { canvas, tip, dir: { x: (tip.x - back.x) / len, y: (tip.y - back.y) / len } };
}

/**
 * A real torch flame: a tapered cone pointing out of the nozzle, with a
 * bright blue-white inner core, a translucent blue-violet outer jacket and a
 * faint warm tip. It lights, flickers while it holds, then cuts out.
 * Several clicks share one animation loop, so flames never wipe each other.
 */
interface Burn { x: number; y: number; ang: number; s: number; t0: number }
const burns: Burn[] = [];
let running = false;
const LIFE = 1.5; // seconds a flame burns

export function flame(layer: HTMLCanvasElement, x: number, y: number, dir: { x: number; y: number }, scale = 1) {
  burns.push({ x, y, ang: Math.atan2(dir.y, dir.x), s: scale, t0: performance.now() });
  if (running) return;
  running = true;
  const ctx = layer.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // one cone: base half-width w0 at the nozzle, swelling to w at ~35%, closing to a point at L
  const cone = (L: number, w0: number, w: number, wob: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -w0);
    ctx.bezierCurveTo(L * 0.18, -w * 1.05, L * 0.55, -w * 0.8 + wob, L, wob * 0.6);
    ctx.bezierCurveTo(L * 0.55, w * 0.8 + wob, L * 0.18, w * 1.05, 0, w0);
    ctx.closePath();
  };

  const run = (now: number) => {
    const DPR = layer.width / (layer.clientWidth || layer.width);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, layer.width, layer.height);
    for (let i = burns.length - 1; i >= 0; i--) {
      const b = burns[i];
      const t = (now - b.t0) / 1000;
      if (t > LIFE) { burns.splice(i, 1); continue; }
      // ignite fast, hold, cut out
      const k = Math.min(1, t / 0.12) * (t > LIFE - 0.25 ? (LIFE - t) / 0.25 : 1);
      const f = reduced ? 0 : Math.sin(now / 37) * 0.5 + Math.sin(now / 23 + 1.3) * 0.35 + Math.sin(now / 71) * 0.3;
      const L = (95 + f * 9) * b.s * k;
      const W = (19 + f * 2) * b.s * Math.max(0.35, k);
      const wob = f * 3 * b.s;

      ctx.setTransform(DPR, 0, 0, DPR, b.x * DPR, b.y * DPR);
      ctx.rotate(b.ang);

      // outer jacket: pale blue fading to violet, then to nothing
      let g = ctx.createLinearGradient(0, 0, L * 1.05, 0);
      g.addColorStop(0, 'rgba(70,110,255,0.75)');
      g.addColorStop(0.45, 'rgba(110,105,255,0.45)');
      g.addColorStop(0.8, 'rgba(170,110,230,0.18)');
      g.addColorStop(1, 'rgba(255,170,120,0)');
      ctx.fillStyle = g;
      cone(L, W * 0.35, W, wob);
      ctx.fill();

      // a faint warm lick at the end of the jacket
      g = ctx.createLinearGradient(L * 0.55, 0, L * 1.1, 0);
      g.addColorStop(0, 'rgba(255,150,90,0)');
      g.addColorStop(0.6, 'rgba(255,150,90,0.22)');
      g.addColorStop(1, 'rgba(255,150,90,0)');
      ctx.fillStyle = g;
      cone(L * 1.08, W * 0.2, W * 0.55, wob * 1.4);
      ctx.fill();

      // inner core: the sharp blue-white cone
      const Lc = L * 0.38;
      g = ctx.createLinearGradient(0, 0, Lc, 0);
      g.addColorStop(0, 'rgba(235,245,255,0.98)');
      g.addColorStop(0.5, 'rgba(120,180,255,0.95)');
      g.addColorStop(1, 'rgba(40,90,255,0.6)');
      ctx.fillStyle = g;
      cone(Lc, W * 0.28, W * 0.42, wob * 0.2);
      ctx.fill();

      // a soft glow at the nozzle
      const r = W * 1.4;
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(150,190,255,0.45)');
      g.addColorStop(1, 'rgba(150,190,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (burns.length) requestAnimationFrame(run);
    else { ctx.clearRect(0, 0, layer.width, layer.height); running = false; }
  };
  requestAnimationFrame(run);
}

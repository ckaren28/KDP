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

/** Blow a short burst of blue flame from a point, in the given direction. */
export function flame(layer: HTMLCanvasElement, x: number, y: number, dir: { x: number; y: number }, scale = 1) {
  const ctx = layer.getContext('2d')!;
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const parts = Array.from({ length: 70 }, (_, i) => {
    const spread = (Math.random() - 0.5) * 0.35;
    const c = Math.cos(spread), s = Math.sin(spread);
    const dx = dir.x * c - dir.y * s, dy = dir.x * s + dir.y * c;
    const speed = (180 + Math.random() * 260) * scale;
    return { x, y, vx: dx * speed, vy: dy * speed, life: 1, delay: i * 0.012, r: (6 + Math.random() * 9) * scale };
  });
  let last = performance.now();
  const run = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, layer.width, layer.height);
    let alive = false;
    for (const p of parts) {
      if (p.delay > 0) { p.delay -= dt; alive = true; continue; }
      p.life -= dt * 1.6;
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 60 * dt * scale; // hot air rises
      const r = p.r * (1.6 - p.life) * DPR;
      const g = ctx.createRadialGradient(p.x * DPR, p.y * DPR, 0, p.x * DPR, p.y * DPR, r);
      // a blowtorch flame is blue at the core, violet at the edge
      g.addColorStop(0, `rgba(170,200,255,${0.9 * p.life})`);
      g.addColorStop(0.45, `rgba(110,120,255,${0.55 * p.life})`);
      g.addColorStop(1, 'rgba(120,80,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x * DPR, p.y * DPR, r, 0, Math.PI * 2); ctx.fill();
    }
    if (alive) requestAnimationFrame(run); else ctx.clearRect(0, 0, layer.width, layer.height);
  };
  requestAnimationFrame(run);
}

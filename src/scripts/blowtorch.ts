/**
 * A pistol-grip kitchen torch: tall handle on a wide foot, a horizontal head
 * with vent slots and a dark rear cap, a black trigger guard with a ribbed
 * trigger, and a straight barrel angled slightly up. Modeled in three.js and
 * rendered once to a transparent canvas for the develop layer on /about. Also
 * reports where the barrel mouth lands in the image, so a click can fire it.
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
  camera.position.set(0, 0.2, 9.4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(4, 1, -3);
  scene.add(rim);

  const body = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x404040, roughness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.22, metalness: 0.45 });

  const torch = new THREE.Group();

  // handle: tapers in toward the top, oval in section
  const handle = lathe([[0, -2.0], [0.56, -2.0], [0.52, -1.2], [0.46, -0.3], [0.44, 0.35], [0, 0.35]], body);
  handle.scale.z = 0.72;
  handle.position.x = 0.35;
  torch.add(handle);
  // wide glossy foot
  const foot = lathe([[0, -2.22], [0.98, -2.22], [1.0, -2.14], [0.82, -2.02], [0.55, -1.96], [0, -1.96]], dark);
  foot.scale.z = 0.7;
  foot.position.x = 0.4;
  torch.add(foot);
  // lock slider on the front of the handle
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), dark);
  lock.position.set(0.42, -0.35, 0.34);
  torch.add(lock);

  // head: a horizontal housing across the top of the handle
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 56), body);
  head.rotation.z = Math.PI / 2;
  head.position.set(0.3, 0.78, 0);
  torch.add(head);
  // dark rear cap with an air ring
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  cap.rotation.z = -Math.PI / 2;
  cap.scale.y = 0.45;
  cap.position.set(1.05, 0.78, 0);
  torch.add(cap);
  // three vent slots on the side of the head
  for (const dx of [0, 0.16, 0.32]) {
    const slot = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.32, 4, 12), dark);
    slot.position.set(0.42 + dx, 0.84, 0.49);
    slot.rotation.z = -0.12;
    torch.add(slot);
  }

  // black trigger guard under the front of the head, with the gas knob dot
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.62, 2, 2, 2), dark);
  guard.position.set(-0.02, -0.02, 0);
  torch.add(guard);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 24), metal);
  dot.rotation.x = Math.PI / 2;
  dot.position.set(0.22, 0.25, 0.33);
  torch.add(dot);
  // ribbed trigger sticking out the front of the guard
  for (let i = 0; i < 6; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.34 - i * 0.015, 0.075, 0.42), metal);
    rib.position.set(-0.46, 0.32 - i * 0.12, 0);
    torch.add(rib);
  }

  // barrel: a straight tube with a collar, angled slightly up, dark at the mouth
  const nozzle = new THREE.Group();
  nozzle.add(lathe([[0, 0], [0.34, 0], [0.34, 0.12], [0.3, 0.16], [0.3, 1.5], [0.26, 1.52], [0, 1.52]], metal));
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 32), dark);
  mouth.position.y = 1.53;
  nozzle.add(mouth);
  nozzle.position.set(-0.4, 0.86, 0);
  nozzle.rotation.z = Math.PI / 2 - 0.2;
  torch.add(nozzle);

  // a touch of three-quarter so the side and the vents read
  torch.rotation.set(0.06, 0.32, 0);
  torch.position.set(0.45, 0.45, 0);
  scene.add(torch);

  renderer.render(scene, camera);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.getContext('2d')!.drawImage(renderer.domElement, 0, 0);

  // where the nozzle tip and its direction land in the image (0..1)
  scene.updateMatrixWorld(true);
  const tip3 = new THREE.Vector3(0, 1.55, 0).applyMatrix4(nozzle.matrixWorld);
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
 * A torch jet like the real thing: a long, thin, straight blade of flame out
 * of the barrel. A near-white core along the axis, a bright blue body that
 * narrows to a needle, and a wide soft blue haze around it. It lights,
 * flickers while it holds, then cuts out. Several clicks share one loop.
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

  // a blade: half-width w at the nozzle, closing to a point at L
  const blade = (L: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(L * 0.45, -w * 0.85, L, 0);
    ctx.quadraticCurveTo(L * 0.45, w * 0.85, 0, w);
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
      const k = Math.min(1, t / 0.1) * (t > LIFE - 0.2 ? (LIFE - t) / 0.2 : 1);
      const f = reduced ? 0 : Math.sin(now / 29) * 0.5 + Math.sin(now / 17 + 1.3) * 0.3;
      const L = (85 + f * 4) * b.s * k;
      const W = 3.5 * b.s * Math.max(0.4, k);

      ctx.setTransform(DPR, 0, 0, DPR, b.x * DPR, b.y * DPR);
      ctx.rotate(b.ang);

      // haze: a wide, soft blue glow along the jet
      ctx.save();
      ctx.filter = `blur(${Math.round(7 * b.s)}px)`;
      let g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, 'rgba(60,140,255,0.55)');
      g.addColorStop(0.6, 'rgba(60,140,255,0.25)');
      g.addColorStop(1, 'rgba(60,140,255,0)');
      ctx.fillStyle = g;
      blade(L * 1.05, W * 3.2);
      ctx.fill();
      ctx.restore();

      // body: saturated blue, fading out toward the needle point
      g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, 'rgba(40,120,255,0.95)');
      g.addColorStop(0.55, 'rgba(30,100,255,0.7)');
      g.addColorStop(1, 'rgba(30,90,255,0)');
      ctx.fillStyle = g;
      blade(L, W);
      ctx.fill();

      // core: a near-white line down the middle of the jet
      g = ctx.createLinearGradient(0, 0, L * 0.8, 0);
      g.addColorStop(0, 'rgba(240,250,255,1)');
      g.addColorStop(0.35, 'rgba(170,215,255,0.9)');
      g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = g;
      blade(L * 0.8, W * 0.38);
      ctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (burns.length) requestAnimationFrame(run);
    else { ctx.clearRect(0, 0, layer.width, layer.height); running = false; }
  };
  requestAnimationFrame(run);
}

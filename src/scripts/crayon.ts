/**
 * A crayon with a worn tip, modeled in three.js and rendered once to a
 * transparent canvas, in the same style as the gloves (src/scripts/gloves.ts).
 * The develop layer on /about turns it into a print that only appears where
 * the cursor has been. Also reports where the tip lands in the image, so a
 * click can draw a crescent moon from it.
 *
 * Stylized: wax body, paper wrapper with two printed bands, a cone tip worn
 * flat on one side, and a flat end.
 */
import * as THREE from 'three';

export interface CrayonRender { canvas: HTMLCanvasElement; tip: { x: number; y: number } }

export function renderCrayon(size = 800): CrayonRender | null {
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
  camera.position.set(0, 0, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(4, 1, -3);
  scene.add(rim);

  const wax = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 0.85, metalness: 0 });
  const band = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.8, metalness: 0 });

  const crayon = new THREE.Group();
  const R = 0.42, L = 4.2;

  // wax body
  crayon.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 48), wax));

  // paper wrapper, a touch wider, covering the middle
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.025, R + 0.025, L * 0.72, 48, 1, true), paper);
  wrap.position.y = -L * 0.08;
  crayon.add(wrap);
  // two printed bands near each end of the wrapper
  for (const y of [L * 0.22, -L * 0.38]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.16, 48, 1, true), band);
    b.position.y = y;
    crayon.add(b);
  }

  // tip: a cone, then worn flat on one side by pushing vertices in
  const tipGeo = new THREE.CylinderGeometry(0.1, R, 0.95, 48, 8);
  const p = tipGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + 0.475) / 0.95; // 0 at the base, 1 at the point
    const wear = Math.max(0, x) * t * 0.55;
    p.setXYZ(i, x - wear, y - wear * 0.15, z);
  }
  tipGeo.computeVertexNormals();
  const tip = new THREE.Mesh(tipGeo, wax);
  tip.position.y = L / 2 + 0.47;
  crayon.add(tip);

  // laid on a diagonal, turned a little toward the light
  crayon.rotation.set(0.35, 0.4, -0.78);
  scene.add(crayon);

  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  out.getContext('2d')!.drawImage(renderer.domElement, 0, 0);

  // where the point touches the page (0..1)
  scene.updateMatrixWorld(true);
  const t3 = new THREE.Vector3(0, 0.47, 0).applyMatrix4(tip.matrixWorld).project(camera);
  const tipAt = { x: (t3.x + 1) / 2, y: (1 - t3.y) / 2 };

  scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
  renderer.dispose();
  renderer.forceContextLoss();
  return { canvas: out, tip: tipAt };
}

/**
 * A pair of boxing gloves hanging from their laces, modeled in three.js and
 * rendered once to a transparent canvas. The develop layer on /about turns the
 * render into a "print" that only appears where the cursor has been.
 *
 * Stylized on purpose: rounded fist, thumb, padded cuff with a wrap strap.
 */
import * as THREE from 'three';

function glove(mat: THREE.Material, strapMat: THREE.Material) {
  const g = new THREE.Group();

  // fist: a sphere pushed into a glove shape (taller, flatter at the back)
  const fistGeo = new THREE.SphereGeometry(1, 72, 56);
  const p = fistGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.8; y *= 1.28; z *= z < 0 ? 0.7 : 0.95;
    // taper toward the wrist so it reads as a glove, not a ball
    if (y < 0) { const t = 1 + y * 0.18; x *= t; z *= t; }
    // knuckle roll across the front top
    const k = Math.max(0, z) * Math.max(0, y) * 0.18;
    z += k; y += k * 0.4;
    p.setXYZ(i, x, y, z);
  }
  fistGeo.computeVertexNormals();
  const fist = new THREE.Mesh(fistGeo, mat);
  fist.position.y = 0.5;
  g.add(fist);

  // thumb, tucked along the side
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.75, 10, 24), mat);
  thumb.position.set(0.58, 0.1, 0.55);
  thumb.rotation.set(0.45, 0, -0.28);
  g.add(thumb);

  // padded cuff
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.74, 1.05, 56, 1), mat);
  cuff.scale.z = 0.86;
  cuff.position.y = -0.72;
  g.add(cuff);

  // wrap strap around the cuff, and two stitched seams
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.79, 0.42, 56, 1, true), strapMat);
  strap.scale.z = 0.88;
  strap.position.y = -0.68;
  g.add(strap);
  for (const y of [-0.22, -1.22]) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.045, 10, 64), mat);
    seam.rotation.x = Math.PI / 2;
    seam.scale.y = 0.86;
    seam.position.y = y;
    g.add(seam);
  }
  return g;
}

export function renderGloves(size = 900): HTMLCanvasElement | null {
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
  camera.position.set(0, 0.4, 11.5);
  camera.lookAt(0, 0.55, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(4, 1, -3);
  scene.add(rim);

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });

  const left = glove(mat, strapMat);
  left.position.set(-0.85, -0.2, 0);
  left.rotation.set(0.15, 0.95, 0.2);
  scene.add(left);

  const right = glove(mat, strapMat);
  right.scale.x = -1; // mirrored: the other hand
  right.position.set(0.9, -0.45, -0.3);
  right.rotation.set(0.05, -1.0, -0.22);
  scene.add(right);

  // the laces they hang from
  const laceMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.7 });
  const lace = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.05, -1.2, 0.2),
    new THREE.Vector3(-1.4, 0.6, 0.4),
    new THREE.Vector3(-0.3, 2.6, 0.2),
    new THREE.Vector3(0.1, 3.1, 0),
    new THREE.Vector3(0.5, 2.6, 0),
    new THREE.Vector3(1.6, 0.4, -0.1),
    new THREE.Vector3(1.15, -1.45, -0.1),
  ]);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(lace, 160, 0.035, 8, false), laceMat));

  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  out.getContext('2d')!.drawImage(renderer.domElement, 0, 0);

  scene.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}

/**
 * The homepage bubble.
 *
 * A pearly, iridescent sphere that leans toward the cursor, squishes when
 * clicked, and pops on the third click ("Sorry to burst your bubble"). Karen's
 * portrait sits inside as a pale reflection caught on the film; the portrait is
 * drawn by a shader that evaluates the bubble's own surface formula, so it
 * wobbles, squishes and clips with the bubble exactly.
 *
 * If WebGL is unavailable the slot keeps its static fallback portrait.
 */
import * as THREE from 'three';

// The bubble's surface: shared by the JS vertex loop and the portrait shader.
// Change one and change the other.
const RADIUS_GLSL = /* glsl */ `
  float radiusAt(vec3 d){
    float n = .5*sin(d.x*1.8+time*.9)*cos(d.y*2.2-time*.7) + .35*sin(d.z*2.6+d.x*1.1+time*1.1) + .2*sin((d.x+d.y+d.z)*3.1-time*uK);
    float b = max(0., dot(d,uPtr));
    return 1. + uA*n + uBump*b*b*b;
  }`;

export function initBubble(slot: HTMLElement) {
  const canvas = slot.querySelector('canvas') as HTMLCanvasElement | null;
  const pop = slot.querySelector('.bb-pop') as HTMLElement | null;
  const hint = slot.querySelector('.bb-hint') as HTMLElement | null;
  const photoSrc = slot.dataset.photo;
  if (!canvas || !photoSrc) return;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return; // fallback portrait stays
  }
  slot.classList.add('bb-live');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 760px), (hover: none)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.z = 5.4;

  // soft studio reflections: pink, cobalt and white panels
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envS = new THREE.Scene();
  envS.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0x2a2630, side: THREE.BackSide })));
  for (const [c, i, p] of [[0xff2e8a, 3.2, [-4, 2, 3]], [0x5b6cff, 2.6, [4, -1, 3]], [0xffffff, 4, [0, 4, -2]], [0xffe3d0, 2, [0, -4, 4]]] as const) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(p[0], p[1], p[2]);
    m.lookAt(0, 0, 0);
    envS.add(m);
  }
  scene.environment = pmrem.fromScene(envS, 0.04).texture;

  // ---------- portrait: a pale reflection on the film ----------
  const photoMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      map: { value: new THREE.TextureLoader().load(photoSrc) },
      time: { value: 0 },
      uInv: { value: new THREE.Matrix3() },
      uScale: { value: new THREE.Vector2(1, 1) },
      uA: { value: 0.085 }, uK: { value: 1.3 }, uBump: { value: 0.06 },
      uPtr: { value: new THREE.Vector3(0, 0, 1) },
      uZoom: { value: 1 },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float time; uniform mat3 uInv; uniform vec2 uScale;
      uniform float uA; uniform float uK; uniform float uBump; uniform vec3 uPtr; uniform float uZoom;
      varying vec3 vW;
      ${RADIUS_GLSL}
      void main(){
        vec3 L = uInv * vec3(vW.xy, 0.);
        float len = length(L);
        vec3 d = len > 1e-4 ? L/len : vec3(0.,0.,1.);
        float rr = radiusAt(d);
        float inside = smoothstep(1.015, .985, len/rr);
        if(inside <= 0.) discard;
        vec2 q = vW.xy / (uScale * rr);            // the bubble's unit disc: the portrait moves with every wobble
        q *= mix(.9, 1., clamp(dot(q,q),0.,1.));   // slight lens bulge
        q /= uZoom;
        q += vec2(sin(q.y*6.+time*1.3), cos(q.x*5.-time*1.1)) * .006;
        vec2 uv = vec2(q.x/1.996 + .5, (q.y + .22)/2.7 + .5);
        if(uv.x<0. || uv.x>1. || uv.y<0. || uv.y>1.) discard;
        vec4 t = texture2D(map, uv);
        float g = dot(t.rgb, vec3(.299,.587,.114));
        vec3 col = mix(vec3(1., .42, .7), vec3(1., .97, .99), smoothstep(.1, .85, g));
        gl_FragColor = vec4(col, t.a * inside * (.32 + .38*(1.-g)));
      }`,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), photoMat);
  photo.renderOrder = 0;
  scene.add(photo);
  const inv = new THREE.Matrix3();

  // ---------- the bubble ----------
  const film = { color: 0xf7dce8, roughness: 0.1, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.9, iridescenceIOR: 1.33, transparent: true, opacity: 0.42, depthWrite: false };
  const geo = new THREE.SphereGeometry(1, small ? 72 : 140, small ? 52 : 100);
  const base = (geo.attributes.position.array as Float32Array).slice();
  const bubbleMat = new THREE.MeshPhysicalMaterial(film);
  bubbleMat.iridescenceThicknessRange = [120, 700];
  const bubble = new THREE.Mesh(geo, bubbleMat);
  bubble.renderOrder = 1;
  scene.add(bubble);

  const dropMat = new THREE.MeshPhysicalMaterial({ ...film, opacity: 0.9 });
  const dropGeo = new THREE.SphereGeometry(1, 16, 12);
  const drops = Array.from({ length: 46 }, () => {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.visible = false; m.renderOrder = 2; scene.add(m);
    return { m, v: new THREE.Vector3(), life: 0, size: 0 };
  });

  const resize = () => {
    const r = slot.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(slot);
  resize();

  // ---------- interaction ----------
  const ptr = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    ptr.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  }, { passive: true });

  const rot = { x: 0, y: 0, vx: 0, vy: 0 }, sq = { v: 0, s: 0 };
  let photoS = 1, photoV = 0, press = 0, clicks = 0, popped = false, grow = 1, growV = 0, swell = 0;
  let clickTimer = 0, regrowTimer = 0;
  const words = ['Click · click · click', 'Again', 'One more…'];
  const say = (t: string) => { if (hint) hint.textContent = t; };

  function poke() {
    if (popped) return;
    clicks++;
    clearTimeout(clickTimer);
    if (clicks >= 3) { burst(); return; }
    sq.v -= 0.07 + clicks * 0.035; press = 1; swell = clicks * 0.07;
    say(words[clicks]);
    clickTimer = window.setTimeout(() => { clicks = 0; swell = 0; say(words[0]); }, 2400);
  }
  function burst() {
    popped = true; clicks = 0; swell = 0; bubble.visible = false;
    const s = bubble.scale.x;
    for (const d of drops) {
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      d.m.position.copy(dir).multiplyScalar(s * 0.95);
      d.v.copy(dir).multiplyScalar(2.2 + Math.random() * 2.6); d.v.y += 1.2;
      d.life = 1; d.size = 0.03 + Math.random() * 0.06; d.m.scale.setScalar(d.size); d.m.visible = true;
    }
    pop?.classList.add('on'); say('Popped');
    clearTimeout(regrowTimer);
    regrowTimer = window.setTimeout(regrow, 3200);
  }
  function regrow() {
    popped = false; pop?.classList.remove('on'); grow = 0; growV = 0;
    bubble.visible = true; say(words[0]);
  }
  slot.addEventListener('pointerdown', poke);
  slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke(); } });

  // ---------- animate (paused off screen and in background tabs) ----------
  let onScreen = true;
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }).observe(slot);
  let t = 0, last = performance.now();
  const dir = new THREE.Vector3();

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (!onScreen || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduce) t += dt;

    rot.vx += (ptr.y * 0.55 - rot.x) * 0.09; rot.vy += (ptr.x * 0.75 - rot.y) * 0.09;
    rot.vx *= 0.78; rot.vy *= 0.78; rot.x += rot.vx; rot.y += rot.vy;
    bubble.rotation.set(rot.x, rot.y + t * 0.15, 0);

    sq.v += (0 - sq.s) * 0.18; sq.v *= 0.82; sq.s += sq.v;
    growV += (1 - grow) * 0.12; growV *= 0.72; grow += growV;
    const s = Math.max(0.001, (1.05 + swell) * grow);
    bubble.scale.set(s * (1 - sq.s * 0.6), s * (1 + sq.s), s * (1 - sq.s * 0.6));
    photoV += ((1 + clicks * 0.28) - photoS) * 0.14; photoV *= 0.72; photoS += photoV;
    press *= 0.93;

    const A = 0.085 + swell * 0.25;
    dir.set(ptr.x, -ptr.y, 0.9).normalize();
    const p = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < p.length; i += 3) {
      const x = base[i], y = base[i + 1], z = base[i + 2];
      const n = 0.5 * Math.sin(x * 1.8 + t * 0.9) * Math.cos(y * 2.2 - t * 0.7) + 0.35 * Math.sin(z * 2.6 + x * 1.1 + t * 1.1) + 0.2 * Math.sin((x + y + z) * 3.1 - t * (1.3 + swell * 14));
      const d = Math.max(0, x * dir.x + y * dir.y + z * dir.z);
      const r = 1 + A * n + (0.06 + press * 0.12) * d * d * d;
      p[i] = x * r; p[i + 1] = y * r; p[i + 2] = z * r;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();

    bubble.updateMatrixWorld(true);
    const U = photoMat.uniforms;
    U.uInv.value.copy(inv.setFromMatrix4(bubble.matrixWorld).invert());
    U.uScale.value.set(bubble.scale.x, bubble.scale.y);
    U.time.value = t; U.uA.value = A; U.uK.value = 1.3 + swell * 14; U.uBump.value = 0.06 + press * 0.12; U.uPtr.value.copy(dir);
    U.uZoom.value = photoS * (small ? 1.15 : 1);
    photo.visible = bubble.visible && grow > 0.03;

    for (const d of drops) {
      if (!d.m.visible) continue;
      d.v.y -= 6 * dt; d.v.multiplyScalar(0.985);
      d.m.position.addScaledVector(d.v, dt);
      d.life -= dt * 1.1;
      d.m.scale.setScalar(Math.max(0, d.size * d.life));
      if (d.life <= 0) d.m.visible = false;
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

/* ── FACE CLOUD ────────────────────────────────────────────────────────────
   478 face landmarks from MediaPipe, drawn as an additive-blended point cloud
   in Three.js. Ported from the standalone face-cloud repo to run inside the
   work page rather than as a full-bleed page of its own.

   Three things differ from the standalone version, all of them because this
   one lives on a page that has other work to do:

   1. Nothing downloads until the section is scrolled to. Three.js is a big
      dependency to hand someone who came to read case studies, so it arrives
      through a dynamic import fired by an IntersectionObserver. MediaPipe and
      its model wait longer still — until the camera is actually asked for.
   2. There is no camera until it is asked for. The cloud opens in its idle
      state, which is the piece's own resting behavior when no face is in
      frame, so the section has something alive in it without anyone being
      put in front of a lens they didn't consent to.
   3. It sizes to its container and stops rendering when it scrolls away.
      A WebGL loop running against a canvas nobody can see is just a warm
      laptop.
   ─────────────────────────────────────────────────────────────────────────── */

const MAX_LANDMARKS = 478; // 468 face + 10 iris
const IRIS_START = 468;

const CONFIG = {
  pointSize: 0.055,
  faceScale: 2.8,
  zScale: 1.4,
  lerpSpeed: 0.1,
  idleSpeed: 0.018,
  cameraZ: 3.0,
  // The idle ring was sized for a full-window canvas, where it had the whole
  // viewport to sit in. In a boxed stage on a page it read as a small mark
  // adrift in a lot of black, so it is scaled up to hold the frame. The face
  // is unaffected — that has its own faceScale.
  idleScale: 2.6,
};

// Zone index sets, from the MediaPipe canonical face model topology.
const LEFT_EYE = new Set([
  33, 7, 163, 144, 145, 153, 154, 155, 133, 246, 161, 160, 159, 158, 157, 173,
  130, 25, 110, 24, 23, 22, 26, 112, 243,
]);

const RIGHT_EYE = new Set([
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
  398, 359, 255, 339, 254, 253, 252, 256, 341, 463,
]);

const LIPS = new Set([
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 146, 91, 181, 84, 17, 314,
  405, 321, 375, 308, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 95, 88, 178,
  87, 14, 317, 402, 318, 324, 76, 62, 96, 89, 179, 86, 15, 316, 403, 319, 325,
  292,
]);

export function initFaceCloud() {
  const canvas = document.getElementById('faceCanvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const stage = canvas.closest('.canvas-section') as HTMLElement | null;
  const video = document.getElementById('faceVideo') as HTMLVideoElement | null;
  const status = document.getElementById('faceStatus');
  const button = document.getElementById('faceCameraBtn') as HTMLButtonElement | null;
  if (!stage || !video || !status || !button) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let booted = false;

  // Three.js only when the section is actually reached.
  const io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && !booted) {
          booted = true;
          io.disconnect();
          boot().catch(err => {
            console.error('face cloud failed to start:', err);
            status.textContent = 'this one needs WebGL';
            button.hidden = true;
          });
        }
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(stage);

  async function boot() {
    const THREE = await import('three');

    const renderer = new THREE.WebGLRenderer({ canvas: canvas!, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    // The cloud is additive glow, so it needs a dark ground to bloom against
    // in both themes — this box reads as a screen, not as a page surface.
    scene.background = new THREE.Color(0x0b0507);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
    camera.position.z = CONFIG.cameraZ;

    // Sizes to the stage, not the window — it's a box on a page now.
    function resize() {
      const { width, height } = stage!.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    resize();
    new ResizeObserver(resize).observe(stage!);

    // Glow sprite: a radial gradient baked to a canvas and used as the point
    // map. Additive blending is what makes overlapping points bloom.
    function makeGlowTexture(size = 128) {
      const offscreen = document.createElement('canvas');
      offscreen.width = size;
      offscreen.height = size;
      const ctx = offscreen.getContext('2d')!;
      const c = size / 2;
      const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.15, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.4, 'rgba(220, 235, 255, 0.45)');
      grad.addColorStop(0.7, 'rgba(180, 210, 255, 0.12)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(offscreen);
    }

    const positions = new Float32Array(MAX_LANDMARKS * 3);
    const colors = new Float32Array(MAX_LANDMARKS * 3);
    const currentPos = new Float32Array(MAX_LANDMARKS * 3);
    const targetPos = new Float32Array(MAX_LANDMARKS * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: CONFIG.pointSize,
      vertexColors: true,
      map: makeGlowTexture(),
      alphaTest: 0.005,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    scene.add(new THREE.Points(geometry, material));

    // Seed the idle ring so the first painted frame is already the piece.
    for (let i = 0; i < MAX_LANDMARKS; i++) {
      const t = (i / MAX_LANDMARKS) * Math.PI * 2;
      const r = (0.3 + Math.sin(t * 3) * 0.04) * CONFIG.idleScale;
      currentPos[i * 3] = Math.cos(t) * r * 1.2;
      currentPos[i * 3 + 1] = Math.sin(t) * r;
      currentPos[i * 3 + 2] = Math.sin(t * 2) * 0.08 * CONFIG.idleScale;
      targetPos[i * 3] = currentPos[i * 3];
      targetPos[i * 3 + 1] = currentPos[i * 3 + 1];
      targetPos[i * 3 + 2] = currentPos[i * 3 + 2];
    }

    let faceLandmarker: any = null;
    let faceDetected = false;
    let lastVideoTime = -1;
    let time = 0;
    let running = false;
    let frame = 0;

    function hslToRgb(h: number, s: number, l: number): [number, number, number] {
      if (s === 0) return [l, l, l];
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
    }

    function applyLandmarks(landmarks: any[]) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      for (const lm of landmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
        if (lm.z < minZ) minZ = lm.z;
        if (lm.z > maxZ) maxZ = lm.z;
      }

      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const range = Math.max(maxX - minX, maxY - minY);
      const zRange = maxZ - minZ || 1;

      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];

        // Mirror X for the selfie cam, flip Y — MediaPipe's Y grows down.
        targetPos[i * 3] = -((lm.x - cx) / range) * CONFIG.faceScale;
        targetPos[i * 3 + 1] = -((lm.y - cy) / range) * CONFIG.faceScale;
        targetPos[i * 3 + 2] = (lm.z / range) * CONFIG.zScale * CONFIG.faceScale;

        if (i >= IRIS_START) {
          colors[i * 3] = 0.3; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
        } else if (LEFT_EYE.has(i) || RIGHT_EYE.has(i)) {
          colors[i * 3] = 0.55; colors[i * 3 + 1] = 0.78; colors[i * 3 + 2] = 1.0;
        } else if (LIPS.has(i)) {
          colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 0.65;
        } else {
          // Everything else is depth-mapped: closer reads brighter.
          const depth = (lm.z - minZ) / zRange;
          const bright = 0.55 + (1.0 - depth) * 0.45;
          colors[i * 3] = bright;
          colors[i * 3 + 1] = bright;
          colors[i * 3 + 2] = bright * 1.05;
        }
      }

      geometry.attributes.color.needsUpdate = true;
    }

    function runDetection() {
      if (!running) return;
      if (!faceLandmarker || video!.readyState < 2) {
        requestAnimationFrame(runDetection);
        return;
      }
      if (video!.currentTime !== lastVideoTime) {
        lastVideoTime = video!.currentTime;
        const result = faceLandmarker.detectForVideo(video, performance.now());
        if (result.faceLandmarks?.length > 0) {
          faceDetected = true;
          applyLandmarks(result.faceLandmarks[0]);
        } else {
          faceDetected = false;
        }
      }
      requestAnimationFrame(runDetection);
    }

    // One pass of the idle ring — also used to paint the single static frame
    // under reduced motion, so that reading stays a still image of the piece.
    function stepIdle() {
      const breathe = 1 + Math.sin(time * 0.6) * 0.025;
      const spin = time * CONFIG.idleSpeed;

      for (let i = 0; i < MAX_LANDMARKS; i++) {
        const t = (i / MAX_LANDMARKS) * Math.PI * 2;
        const r = (0.28 + Math.sin(t * 4 + time * 0.3) * 0.03) * breathe * CONFIG.idleScale;
        targetPos[i * 3] = Math.cos(t + spin) * r * 1.2;
        targetPos[i * 3 + 1] = Math.sin(t + spin) * r;
        targetPos[i * 3 + 2] = Math.sin(t * 2 + time * 0.5) * 0.07 * CONFIG.idleScale;

        const hue = ((i / MAX_LANDMARKS) + time * 0.015) % 1.0;
        const [r2, g2, b2] = hslToRgb(hue, 0.5, 0.55);
        colors[i * 3] = r2;
        colors[i * 3 + 1] = g2;
        colors[i * 3 + 2] = b2;
      }
      geometry.attributes.color.needsUpdate = true;
    }

    function draw() {
      for (let k = 0; k < MAX_LANDMARKS * 3; k++) {
        currentPos[k] += (targetPos[k] - currentPos[k]) * CONFIG.lerpSpeed;
        positions[k] = currentPos[k];
      }
      geometry.attributes.position.needsUpdate = true;

      // Gentle drift, so it stays alive even when you hold still.
      camera.position.x = Math.sin(time * 0.09) * 0.06;
      camera.position.y = Math.cos(time * 0.07) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    function animate() {
      if (!running) return;
      frame = requestAnimationFrame(animate);
      time += 0.008;
      if (!faceDetected) stepIdle();
      draw();
    }

    if (reduced) {
      // Settle the ring, paint once, and leave it there.
      stepIdle();
      for (let i = 0; i < 60; i++) draw();
      status.textContent = 'motion paused — turn on the camera to run it';
    } else {
      running = true;
      animate();
    }

    // Stop the loop when the section leaves the viewport. A WebGL loop against
    // a canvas nobody can see is just a warm laptop.
    const vis = new IntersectionObserver(entries => {
      const onScreen = entries.some(e => e.isIntersecting);
      if (onScreen && !running && !reduced) {
        running = true;
        animate();
        if (faceLandmarker) runDetection();
      } else if (!onScreen && running) {
        running = false;
        cancelAnimationFrame(frame);
      }
    });
    vis.observe(stage!);

    // ── Camera, only when asked for ──
    button!.addEventListener('click', async () => {
      button!.disabled = true;
      status.textContent = 'loading the model…';

      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        status.textContent = 'asking for the camera…';

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        video!.srcObject = stream;
        video!.addEventListener('loadeddata', () => {
          status.textContent = 'look at the camera';
          button!.hidden = true;
          if (!running && !reduced) {
            running = true;
            animate();
          }
          running = true;
          runDetection();
        });
      } catch (err) {
        console.error('face cloud camera:', err);
        status.textContent = 'no camera — the idle cloud is still running';
        button!.disabled = false;
        button!.textContent = 'try the camera again';
      }
    });
  }
}

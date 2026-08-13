/* ═══════════════════════════════════════════════
   nSchool — WebGL particle field
   Four morph states driven by scroll:
   0 · 3D valley terrain     (hero — sits lower-centre)
   1 · market surface wave   (manifesto / method)
   2 · sphere of perspective (courses / evidence)
   3 · compounding spiral    (faculty → cta)

   States 0 & 1 share the SAME grid, so the hero valley
   eases straight into the market wave with no teleporting.
   ═══════════════════════════════════════════════ */

import * as THREE from "three";

const canvas = document.getElementById("gl");
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 100
);
camera.position.set(0, 1.7, 7.6);
camera.rotation.x = -0.05;

/* ── particle targets ─────────────────────────── */
const isSmall = Math.min(window.innerWidth, window.innerHeight) < 760;
const COUNT = isSmall ? 17000 : 34000; // finer grain for a silkier field

const posWave = new Float32Array(COUNT * 3);
const posSphere = new Float32Array(COUNT * 3);
const posSpiral = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);

// deterministic pseudo-random so layout is stable
let s = 42;
const rand = () => {
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
};

const GRID = Math.ceil(Math.sqrt(COUNT));
for (let i = 0; i < COUNT; i++) {
  const i3 = i * 3;

  // 0 & 1 — shared terrain grid, 20 × 13 world units, jittered.
  //  Disc-shaped density: denser toward the centre so the valley reads
  //  as a mound of particles in the lower-centre, fading at the rim.
  const gx = (i % GRID) / GRID - 0.5;
  const gz = Math.floor(i / GRID) / GRID - 0.5;
  posWave[i3]     = gx * 20 + (rand() - 0.5) * 0.14;
  posWave[i3 + 1] = 0;
  posWave[i3 + 2] = gz * 13 + (rand() - 0.5) * 0.14;

  // 2 — fibonacci sphere
  const t = i / COUNT;
  const phi = Math.acos(1 - 2 * t);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  const r = 2.6 + rand() * 0.08;
  posSphere[i3]     = r * Math.sin(phi) * Math.cos(theta);
  posSphere[i3 + 1] = r * Math.cos(phi);
  posSphere[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

  // 3 — rising logarithmic spiral (compounding)
  const u = rand();
  const turns = 5.5;
  const ang = u * Math.PI * 2 * turns;
  const rad = 0.35 + u * 3.1 + (rand() - 0.5) * 0.34;
  posSpiral[i3]     = Math.cos(ang) * rad;
  posSpiral[i3 + 1] = (u - 0.5) * 6.4 + (rand() - 0.5) * 0.3;
  posSpiral[i3 + 2] = Math.sin(ang) * rad;

  seeds[i] = rand();
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(posWave, 3));
geometry.setAttribute("aSphere", new THREE.BufferAttribute(posSphere, 3));
geometry.setAttribute("aSpiral", new THREE.BufferAttribute(posSpiral, 3));
geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

const uniforms = {
  uTime: { value: 0 },
  uMorph: { value: 0 },           // 0 wave → 1 sphere → 2 spiral
  uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  uDim: { value: 1 },
  uGold: { value: new THREE.Color("#c026d3") },   // peaks  — magenta
  uJade: { value: new THREE.Color("#7c3aed") },   // mid    — violet
  uInk: { value: new THREE.Color("#b9aede") },    // valley — pale lavender
  uFog: { value: new THREE.Color("#eef0f7") },    // atmosphere — page tint
  uMouse: { value: new THREE.Vector2(0, 0) },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending, // light background — additive would wash out
  vertexShader: /* glsl */ `
    attribute vec3 aSphere;
    attribute vec3 aSpiral;
    attribute float aSeed;
    uniform float uTime;
    uniform float uMorph;
    uniform float uPixelRatio;
    uniform vec2 uMouse;
    varying float vAlpha;
    varying float vMix;
    varying float vSeed;
    varying float vFogT;    // 0 near → 1 far (atmospheric depth)
    varying float vCrest;   // ridge highlight strength
    varying float vCore;    // 0 soft valley grain → 1 crisp peak jewel

    // ── simplex-ish value noise, cheap and smooth ──
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
               dot(p, vec3(269.5, 183.3, 246.1)),
               dot(p, vec3(113.5, 271.9, 124.6)));
      return fract(sin(p) * 43758.5453123);
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      vec3 u = f * f * (3.0 - 2.0 * f);
      float n000 = dot(hash3(i + vec3(0,0,0)) - 0.5, f - vec3(0,0,0));
      float n100 = dot(hash3(i + vec3(1,0,0)) - 0.5, f - vec3(1,0,0));
      float n010 = dot(hash3(i + vec3(0,1,0)) - 0.5, f - vec3(0,1,0));
      float n110 = dot(hash3(i + vec3(1,1,0)) - 0.5, f - vec3(1,1,0));
      float n001 = dot(hash3(i + vec3(0,0,1)) - 0.5, f - vec3(0,0,1));
      float n101 = dot(hash3(i + vec3(1,0,1)) - 0.5, f - vec3(1,0,1));
      float n011 = dot(hash3(i + vec3(0,1,1)) - 0.5, f - vec3(0,1,1));
      float n111 = dot(hash3(i + vec3(1,1,1)) - 0.5, f - vec3(1,1,1));
      return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
                 mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 2.0;
    }

    void main() {
      // ── state 0: 3D valley — ridged mountains flanking a central basin,
      //   slowly flowing toward camera. Same grid as the wave below.
      vec3 pValley = position;
      // broad rolling base
      float b1 = noise(vec3(position.x * 0.20, position.z * 0.26 - uTime * 0.05, 3.0));
      // ridged crests (sharp mountain lines)
      float rr = noise(vec3(position.x * 0.46 + 11.0, position.z * 0.5 - uTime * 0.04, 8.0));
      float ridge = 1.0 - abs(rr);
      ridge *= ridge;
      // fine sparkle relief
      float b3 = noise(vec3(position.x * 1.25, position.z * 1.4 - uTime * 0.08, 1.0));
      float vh = b1 * 2.1 + ridge * 1.35 + b3 * 0.28;
      // carve a valley running into depth: lower along the centre band of x
      float centreDip = smoothstep(0.0, 5.5, abs(position.x));
      vh *= (0.30 + 0.70 * centreDip);
      // radial falloff so the mound sits in the lower-centre and fades at rim
      float rim = 1.0 - smoothstep(5.0, 11.0, length(position.xz * vec2(0.62, 1.0)));
      vh *= mix(0.25, 1.0, rim);
      pValley.y = vh - 0.35;        // settle the basin slightly below zero
      pValley.z += 1.2;             // pull the mass toward camera / lower in frame

      // ── state 1: gentler market surface wave (same grid)
      vec3 pWave = position;
      float n1 = noise(vec3(position.x * 0.32, position.z * 0.42, uTime * 0.18));
      float n2 = noise(vec3(position.x * 0.9 + 50.0, position.z * 1.1, uTime * 0.32));
      pWave.y = n1 * 1.5 + n2 * 0.45;

      // ── state 2: breathing sphere
      vec3 pSphere = aSphere * (1.0 + 0.05 * noise(aSphere * 0.9 + uTime * 0.25));
      float rotA = uTime * 0.08;
      pSphere = vec3(
        pSphere.x * cos(rotA) - pSphere.z * sin(rotA),
        pSphere.y,
        pSphere.x * sin(rotA) + pSphere.z * cos(rotA)
      );

      // ── state 3: spiral, slow rotation + drift upward
      vec3 pSpiral = aSpiral;
      float rotB = uTime * 0.12 + aSeed * 0.2;
      pSpiral = vec3(
        pSpiral.x * cos(rotB) - pSpiral.z * sin(rotB),
        pSpiral.y + sin(uTime * 0.5 + aSeed * 6.28) * 0.06,
        pSpiral.x * sin(rotB) + pSpiral.z * cos(rotB)
      );

      float m1 = clamp(uMorph, 0.0, 1.0);
      float m2 = clamp(uMorph - 1.0, 0.0, 1.0);
      float m3 = clamp(uMorph - 2.0, 0.0, 1.0);
      // ease the blends
      m1 = m1 * m1 * (3.0 - 2.0 * m1);
      m2 = m2 * m2 * (3.0 - 2.0 * m2);
      m3 = m3 * m3 * (3.0 - 2.0 * m3);

      vec3 p = mix(pValley, pWave, m1);
      p = mix(p, pSphere, m2);
      p = mix(p, pSpiral, m3);

      // mouse parallax push
      p.x += uMouse.x * 0.35 * (0.4 + aSeed * 0.6);
      p.y += uMouse.y * 0.22 * (0.4 + aSeed * 0.6);

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      // ── height / radius drives the colour ramp ──
      float mixValley = clamp(pValley.y * 0.42 + 0.45, 0.0, 1.0);
      float mixWave = clamp(pWave.y * 0.5 + 0.5, 0.0, 1.0);
      vMix = mix(mixValley, mixWave, m1);
      vMix = mix(vMix, clamp(length(p) / 3.2, 0.0, 1.0), max(m2, m3));
      vSeed = aSeed;

      // ── atmospheric depth: how far into the scene this grain sits ──
      vFogT = smoothstep(4.5, 22.0, -mv.z);

      // ── ridge highlight: only the upper band of the terrain catches light,
      //    plus a slow light-sweep travelling across the field for life ──
      float crest = smoothstep(0.62, 0.96, vMix);
      float sweep = sin(p.x * 0.24 + p.z * 0.12 - uTime * 0.55);
      sweep = smoothstep(0.55, 1.0, sweep);
      vCrest = clamp(crest + sweep * 0.35, 0.0, 1.0);

      // peaks render as crisp jewels, valley floor as soft haze; near > far
      vCore = clamp(crest * 0.8 + (1.0 - vFogT) * 0.5, 0.0, 1.0);

      // ── refined size grading: lots of fine grain, few prominent grains;
      //    peaks slightly larger, distance shrinks them ──
      float grain = 0.42 + aSeed * aSeed * 2.3;     // skew toward tiny
      grain *= (1.0 + crest * 0.6);                  // peaks read bigger
      grain *= uPixelRatio;
      gl_PointSize = clamp(grain * (24.0 / -mv.z), 0.6, 8.5 * uPixelRatio);

      float depthFade = smoothstep(-26.0, -3.5, mv.z);
      float nearFade = smoothstep(-1.4, -3.6, mv.z); // melt away before hitting the lens
      vAlpha = depthFade * nearFade * (0.22 + 0.42 * aSeed);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uGold;
    uniform vec3 uJade;
    uniform vec3 uInk;
    uniform vec3 uFog;
    uniform float uTime;
    uniform float uDim;
    varying float vAlpha;
    varying float vMix;
    varying float vSeed;
    varying float vFogT;
    varying float vCrest;
    varying float vCore;

    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;

      // ── jewel particle: soft halo + crisp core (core grows on peaks) ──
      float halo = smoothstep(0.5, 0.02, d);
      float core = smoothstep(0.30, 0.0, d);
      float shape = halo * (0.55 + 0.45 * vCore) + core * (0.35 + 0.65 * vCore);
      shape = clamp(shape, 0.0, 1.2);

      // ── colour ramp: lavender valley → violet → magenta peaks ──
      vec3 col = mix(uInk, uJade, smoothstep(0.12, 0.6, vMix));
      col = mix(col, uGold, smoothstep(0.55, 0.96, vMix));
      // ridge light + travelling sweep lift the crests
      col += uGold * vCrest * 0.35;

      // ── rare, slow sparkle — only on crisp near grains ──
      float spark = step(0.978, vSeed) * (0.5 + 0.5 * sin(uTime * 1.4 + vSeed * 40.0));
      col += spark * uGold * 0.8 * (1.0 - vFogT);

      // ── atmospheric perspective: distant grains dissolve into page tint ──
      col = mix(col, uFog, vFogT * 0.80);
      float a = vAlpha * shape * uDim * (1.0 - vFogT * 0.30);

      gl_FragColor = vec4(col, a);
    }
  `,
});

const points = new THREE.Points(geometry, material);
points.rotation.x = 0.14;
points.position.y = isSmall ? -1.0 : -0.55; // sit the valley in the lower-centre of the frame
scene.add(points);

/* ── horizon line accents (thin gold rings, spiral state) ── */
const ringGeo = new THREE.BufferGeometry();
const RING_PTS = 240;
const ringPos = new Float32Array(RING_PTS * 3);
for (let i = 0; i < RING_PTS; i++) {
  const a = (i / RING_PTS) * Math.PI * 2;
  ringPos[i * 3] = Math.cos(a) * 3.4;
  ringPos[i * 3 + 1] = 0;
  ringPos[i * 3 + 2] = Math.sin(a) * 3.4;
}
ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
const ringMat = new THREE.LineBasicMaterial({
  color: 0x7c3aed,
  transparent: true,
  opacity: 0,
});
const ring = new THREE.LineLoop(ringGeo, ringMat);
scene.add(ring);

/* ── scroll + mouse state ─────────────────────── */
const state = {
  morph: 0,
  camY: 1.2,
  camZ: 7.5,
  camRX: 0,
  mouseX: 0,
  mouseY: 0,
  dim: 1,
};

window.addEventListener("pointermove", (e) => {
  state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  state.mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });

// main.js drives this through a custom event once ScrollTrigger is ready
window.addEventListener("nschool:progress", (e) => {
  const p = e.detail; // 0..1 page progress
  // phases: helix (hero) → wave → sphere → spiral
  if (p < 0.08) {
    state.morph = 0;
  } else if (p < 0.3) {
    state.morph = (p - 0.08) / 0.22;
  } else if (p < 0.5) {
    state.morph = 1 + (p - 0.3) / 0.2;
  } else if (p < 0.72) {
    state.morph = 2 + (p - 0.5) / 0.22;
  } else {
    state.morph = 3;
  }
  // camera choreography — look down across the valley, then lift & dolly in
  state.camZ = 7.6 - p * 1.3;
  state.camY = 1.7 - Math.sin(p * Math.PI) * 0.7;
  state.camRX = -0.05 + p * 0.17;
  // ring fades in with the spiral
  ringMat.opacity = Math.max(0, (state.morph - 2.45) * 0.5) * 0.35;
  // dim the field through the content-heavy middle of the page
  const sm = (a, b, x) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };
  const band = sm(0.07, 0.2, p) * (1 - sm(0.78, 0.9, p));
  state.dim = 1 - 0.85 * band;
});

/* ── resize ───────────────────────────────────── */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const pr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pr);
  uniforms.uPixelRatio.value = pr;
});

/* ── render loop ──────────────────────────────── */
const clock = new THREE.Clock();
let raf = null;

function tick() {
  const t = clock.getElapsedTime();
  uniforms.uTime.value = t;

  // smooth-follow morph & camera
  uniforms.uMorph.value += (state.morph - uniforms.uMorph.value) * 0.045;
  camera.position.z += (state.camZ - camera.position.z) * 0.05;
  camera.position.y += (state.camY - camera.position.y) * 0.05;
  camera.rotation.x += (state.camRX - camera.rotation.x) * 0.05;

  uniforms.uDim.value += (state.dim - uniforms.uDim.value) * 0.06;
  uniforms.uMouse.value.x += (state.mouseX - uniforms.uMouse.value.x) * 0.04;
  uniforms.uMouse.value.y += (state.mouseY - uniforms.uMouse.value.y) * 0.04;

  ring.rotation.y = t * 0.1;
  ring.rotation.x = 0.4;
  ring.position.y = -0.6;

  renderer.render(scene, camera);
  raf = requestAnimationFrame(tick);
}

if (prefersReduced) {
  // single static frame
  uniforms.uTime.value = 4;
  renderer.render(scene, camera);
} else {
  tick();
  // pause when tab hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      clock.start();
      tick();
    }
  });
}

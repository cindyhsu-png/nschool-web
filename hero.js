// ============================================================
//  Persistent hero scene
//  Displaced mineral core + glass dispersion rings + afterimage
//  smear, scroll-scrubbed across the whole page, mouse-reactive.
// ============================================================
import * as THREE from "three";
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/addons/postprocessing/AfterimagePass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const BG = new THREE.Color(0xdfe4e5);
const canvas = document.getElementById("scene");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = innerWidth < 760;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(BG, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();

// ---- atmospheric background: directional light + focal pool + vignette ----
function makeBackground() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const x = c.getContext("2d");
  // directional base — bright top-right, deeper cool bottom-left
  let base = x.createLinearGradient(1024, 0, 80, 1024);
  base.addColorStop(0, "#eef0f5");
  base.addColorStop(0.5, "#d2d8df");
  base.addColorStop(1, "#aeb6c2");
  x.fillStyle = base; x.fillRect(0, 0, 1024, 1024);
  // focal light pool behind the orb (right-of-centre) — the bright key
  let pool = x.createRadialGradient(630, 430, 30, 630, 440, 660);
  pool.addColorStop(0, "rgba(255,255,255,0.9)");
  pool.addColorStop(0.42, "rgba(246,244,253,0.38)");
  pool.addColorStop(1, "rgba(246,244,253,0)");
  x.fillStyle = pool; x.fillRect(0, 0, 1024, 1024);
  // brand-violet wash, lower-left (richer colour)
  let v = x.createRadialGradient(250, 830, 10, 250, 830, 760);
  v.addColorStop(0, "rgba(139,92,246,0.36)");
  v.addColorStop(1, "rgba(139,92,246,0)");
  x.fillStyle = v; x.fillRect(0, 0, 1024, 1024);
  // pink wash, upper-right edge
  let p = x.createRadialGradient(910, 180, 10, 910, 180, 540);
  p.addColorStop(0, "rgba(236,114,214,0.22)");
  p.addColorStop(1, "rgba(236,114,214,0)");
  x.fillStyle = p; x.fillRect(0, 0, 1024, 1024);
  // teal-cool wash, bottom-right for temperature contrast
  let cool = x.createRadialGradient(880, 920, 10, 880, 920, 560);
  cool.addColorStop(0, "rgba(70,110,160,0.18)");
  cool.addColorStop(1, "rgba(70,110,160,0)");
  x.fillStyle = cool; x.fillRect(0, 0, 1024, 1024);
  // vignette — darken corners to push depth and frame the orb
  let vig = x.createRadialGradient(540, 460, 240, 512, 512, 780);
  vig.addColorStop(0, "rgba(26,22,46,0)");
  vig.addColorStop(1, "rgba(26,22,46,0.32)");
  x.fillStyle = vig; x.fillRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
scene.background = makeBackground();

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 6.2);

// studio environment for glass refraction / reflections (sharp, high quality)
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.015).texture;
scene.environmentIntensity = 1.5;   // richer image-based reflections

// directional, temperature-split lighting → form & depth (less flat)
const key = new THREE.DirectionalLight(0xfff4e8, 3.6);   // warm key, top-right
key.position.set(4, 5, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xa9c4ff, 1.9);   // cool rim, back-left
rim.position.set(-5, 1, -4);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xead7ff, 0.7);  // soft violet fill, below
fill.position.set(-2, -4, 2);
scene.add(fill);
scene.add(new THREE.AmbientLight(0xffffff, 0.32));

// ---------- the moving group ----------
const group = new THREE.Group();
scene.add(group);

// ---- mineral core: displaced icosahedron with mossy vertex colours ----
const noise = new ImprovedNoise();
function fbm(x, y, z) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < 5; i++) {
    v += a * noise.noise(x * f, y * f, z * f);
    f *= 2.07; a *= 0.5;
  }
  return v;
}

// brand palette (nSchool — pink / magenta / violet)
const cCore = new THREE.Color(0xffc6f2);  // hot pink-white core
const cPink = new THREE.Color(0xff6fd6);  // pink
const cMag = new THREE.Color(0xc44cf0);   // magenta
const cViolet = new THREE.Color(0x7b3ff5); // violet edge
const cDeep = new THREE.Color(0x5421d6);   // deep violet

const COUNT = mobile ? 16000 : 42000;
const positions = new Float32Array(COUNT * 3);
const pColors = new Float32Array(COUNT * 3);
const pScale = new Float32Array(COUNT);
const pSeed = new Float32Array(COUNT);
const tmp = new THREE.Vector3();
const col = new THREE.Color();
const R = 0.95;
for (let i = 0; i < COUNT; i++) {
  // uniform-in-volume radius → natural limb brightening at the rim
  let r = R * Math.cbrt(Math.random());
  // direction on unit sphere
  const u = Math.random() * 2 - 1;
  const th = Math.random() * Math.PI * 2;
  const sr = Math.sqrt(1 - u * u);
  tmp.set(sr * Math.cos(th), u, sr * Math.sin(th));
  // organic surface ripple so the orb is not a perfect ball
  const warp = 1 + 0.12 * fbm(tmp.x * 2.2, tmp.y * 2.2, tmp.z * 2.2);
  r *= warp;
  positions[i * 3] = tmp.x * r;
  positions[i * 3 + 1] = tmp.y * r;
  positions[i * 3 + 2] = tmp.z * r;
  // colour by radius: bright pink core → magenta → violet rim, with jitter
  const t = THREE.MathUtils.clamp(r / R, 0, 1);
  if (t < 0.4) col.copy(cCore).lerp(cPink, t / 0.4);
  else if (t < 0.72) col.copy(cPink).lerp(cMag, (t - 0.4) / 0.32);
  else col.copy(cMag).lerp(cViolet, (t - 0.72) / 0.28);
  // sprinkle deeper violet for depth
  if (Math.random() < 0.18) col.lerp(cDeep, Math.random() * 0.5);
  pColors[i * 3] = col.r;
  pColors[i * 3 + 1] = col.g;
  pColors[i * 3 + 2] = col.b;
  pScale[i] = 0.5 + Math.random() * 1.6;
  pSeed[i] = Math.random();
}
const orbGeo = new THREE.BufferGeometry();
orbGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
orbGeo.setAttribute("aColor", new THREE.BufferAttribute(pColors, 3));
orbGeo.setAttribute("aScale", new THREE.BufferAttribute(pScale, 1));
orbGeo.setAttribute("aSeed", new THREE.BufferAttribute(pSeed, 1));

const orbMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPR: { value: Math.min(devicePixelRatio, 2) },
    uSize: { value: mobile ? 26 : 34 },
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
  vertexShader: /* glsl */ `
    uniform float uTime; uniform float uPR; uniform float uSize;
    attribute vec3 aColor; attribute float aScale; attribute float aSeed;
    varying vec3 vColor; varying float vGlow;
    void main(){
      vColor = aColor;
      vec3 p = position;
      // differential twist: rings at different heights rotate at offset phase
      float ang = uTime * 0.32 + p.y * 2.1 + aSeed * 0.6;
      float s = sin(ang), c = cos(ang);
      p.xz = mat2(c, -s, s, c) * p.xz;
      // gentle per-particle wobble + breathing pulse
      p.x += sin(uTime * 0.8 + aSeed * 12.0) * 0.03;
      p.y += cos(uTime * 0.7 + aSeed * 9.0) * 0.03;
      float pulse = 1.0 + 0.045 * sin(uTime * 0.9 + length(position) * 5.0);
      p *= pulse;
      vGlow = 0.6 + 0.4 * sin(uTime * 1.6 + aSeed * 20.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aScale * uSize * uPR / -mv.z;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor; varying float vGlow;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d);
      a = pow(a, 1.6);
      vec3 c = vColor + vColor * vGlow * 0.5;   // subtle self-illumination shimmer
      gl_FragColor = vec4(c, a);
    }
  `,
});
const orb = new THREE.Points(orbGeo, orbMat);
group.add(orb);

// opaque luminous core — gives the glass rings high-contrast, colourful
// content to refract (dispersion/iridescence need something behind them;
// transparent points are NOT captured in the transmission pass).
// faceted crystal — high subdivision + flat shading reads as a finely cut
// gem with many small facets; subtle displacement keeps a raw-crystal feel.
const coreGeo = new THREE.IcosahedronGeometry(0.54, 12);
{
  const cp = coreGeo.attributes.position;
  const cc = [];
  const cv = new THREE.Vector3();
  // multi-stop brand gradient: deep violet → magenta → pink → bright tip
  const cDeepV = new THREE.Color(0x4f1bc4);
  const cMagC = new THREE.Color(0xb028e6);
  const cPinkC = new THREE.Color(0xff5fce);
  const cTip = new THREE.Color(0xffd1f4);
  const cx2 = new THREE.Color();
  for (let i = 0; i < cp.count; i++) {
    cv.fromBufferAttribute(cp, i);
    const n = cv.clone().normalize();
    // sharp crystalline displacement (ridged noise → angular planes)
    const ridged = Math.abs(fbm(n.x * 2.0, n.y * 2.0, n.z * 2.0));
    const d = 0.1 * (0.5 - ridged) + 0.03 * fbm(n.x * 4.0 + 5, n.y * 4.0, n.z * 4.0);
    cv.copy(n).multiplyScalar(0.54 + d);
    cp.setXYZ(i, cv.x, cv.y, cv.z);
    const t = THREE.MathUtils.clamp(n.y * 0.5 + 0.5, 0, 1);
    if (t < 0.4) cx2.copy(cDeepV).lerp(cMagC, t / 0.4);
    else if (t < 0.78) cx2.copy(cMagC).lerp(cPinkC, (t - 0.4) / 0.38);
    else cx2.copy(cPinkC).lerp(cTip, (t - 0.78) / 0.22);
    cc.push(cx2.r, cx2.g, cx2.b);
  }
  coreGeo.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
  coreGeo.computeVertexNormals();
}
const coreMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  emissive: new THREE.Color(0xff63d2),
  emissiveIntensity: 0.7,
  roughness: 0.22,
  metalness: 0.35,
  envMapIntensity: 1.8,
  flatShading: true,        // crisp gem facets
});
// Fresnel edge glow → premium energy-core rim light
coreMat.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
     float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
     totalEmissiveRadiance += vec3(1.0, 0.45, 0.95) * fres * 1.7;`
  );
};
const core = new THREE.Mesh(coreGeo, coreMat);
group.add(core);

// soft brand-violet aura behind the orb → atmospheric glow / depth
function makeGlow() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(244,214,255,0.7)");
  g.addColorStop(0.28, "rgba(196,110,250,0.42)");
  g.addColorStop(0.6, "rgba(168,92,232,0.18)");
  g.addColorStop(1, "rgba(168,92,232,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const aura = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlow(), transparent: true, depthWrite: false, depthTest: false,
  blending: THREE.AdditiveBlending, opacity: 1,
}));
aura.renderOrder = -1;
scene.add(aura);

// brand-colour rim lights to drive the iridescent rainbow highlights
const magLight = new THREE.DirectionalLight(0xff3ecb, 2.2);
magLight.position.set(4, 2, 2);
scene.add(magLight);
const cyLight = new THREE.DirectionalLight(0x6aa8ff, 1.8);
cyLight.position.set(-3, -2, 3);
scene.add(cyLight);

// ---- glass dispersion rings wrapping the core ----
const glassMat = new THREE.MeshPhysicalMaterial({
  transmission: 1,
  thickness: 2.0,
  roughness: 0.0,           // mirror-polished facets → crisp refraction
  metalness: 0,
  ior: 1.5,
  dispersion: 6.5,          // chromatic aberration / rainbow split
  iridescence: 1,
  iridescenceIOR: 1.45,
  iridescenceThicknessRange: [120, 760],
  specularIntensity: 1,
  clearcoat: 1,
  clearcoatRoughness: 0.0,
  envMapIntensity: 3.2,     // brighter, sharper thin-film reflections
  attenuationColor: new THREE.Color(0xece8ff),
  attenuationDistance: 3.0,
  flatShading: true,        // crisp prismatic facets on the hex tube
});

const rings = [];
const ringDefs = [
  { R: 1.62, r: 0.18, rot: [1.15, 0.2, 0.4] },
  { R: 1.5, r: 0.13, rot: [0.3, 1.1, -0.5] },
  { R: 1.74, r: 0.11, rot: [-0.6, 0.5, 1.2] },
];
for (const d of ringDefs) {
  // radialSegments = 6 → hexagonal cross-section (sharp, gem-like);
  // high tubular count keeps the ring sweep perfectly smooth
  const g = new THREE.TorusGeometry(d.R, d.r, 6, 440);
  const m = new THREE.Mesh(g, glassMat);
  m.rotation.set(...d.rot);
  group.add(m);
  rings.push(m);
}
// a flatter, wider "halo" disc used in the stats section
const halo = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 6, 460), glassMat);
halo.rotation.x = Math.PI / 2.1;
group.add(halo);

// ---------- post: afterimage smear + SMAA anti-aliasing (clean edges) ----------
const dpr = Math.min(devicePixelRatio, 2);
const composer = new EffectComposer(renderer);
composer.setPixelRatio(dpr);
composer.addPass(new RenderPass(scene, camera));
const afterimage = new AfterimagePass(0.82);
composer.addPass(afterimage);
const smaa = new SMAAPass(innerWidth * dpr, innerHeight * dpr);
composer.addPass(smaa);
composer.addPass(new OutputPass());

// ---------- scroll-driven keyframes ----------
// p (0..1) → object placement. Tuned to the transparent sections.
const stops = [
  // p,    x,     y,    s,    camZ, ring, halo, schem, spin
  [0.00,  1.25, -0.10, 1.72, 6.2, 1.0, 0.0, 0.92, 1.0],  // hero — stock callouts ON
  [0.07,  1.10, -0.06, 1.92, 6.0, 1.0, 0.0, 0.8,  0.95], // hero bottom — still on
  [0.14,  0.78,  0.04, 2.28, 5.6, 1.0, 0.0, 0.0,  0.85], // leaving hero → callouts OFF
  [0.24,  0.05, -0.20, 2.85, 5.2, 0.9, 0.0, 0.0,  0.7],  // clients
  [0.42, -0.30,  0.00, 2.20, 5.8, 0.6, 0.0, 0.0,  0.5],  // services/work (covered)
  [0.60, -0.95,  0.00, 2.05, 5.4, 0.8, 0.0, 0.55, 0.45], // how it works (left)
  [0.78,  0.00,  0.05, 2.55, 5.2, 0.3, 1.0, 0.45, 0.55], // stats (halo disc)
  [0.92,  0.00, -0.05, 2.15, 5.6, 0.5, 0.2, 0.6,  0.6],  // cta (contained centrepiece)
  [1.00,  0.00, -0.10, 2.25, 5.5, 0.4, 0.2, 0.6,  0.6],
];
function sample(p) {
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = THREE.MathUtils.clamp((p - a[0]) / Math.max(1e-5, b[0] - a[0]), 0, 1);
  const e = t * t * (3 - 2 * t); // smoothstep
  const out = [];
  for (let k = 1; k < a.length; k++) out.push(a[k] + (b[k] - a[k]) * e);
  return out; // [x, y, s, camZ, ring, halo, schem, spin]
}

// ---------- interaction state ----------
let progress = 0, targetProgress = 0;
const mouse = new THREE.Vector2(0, 0);
const mTarget = new THREE.Vector2(0, 0);
const _oc = new THREE.Vector3(), _oe = new THREE.Vector3();
addEventListener("pointermove", (e) => {
  mTarget.x = (e.clientX / innerWidth) * 2 - 1;
  mTarget.y = (e.clientY / innerHeight) * 2 - 1;
});

const schematicEl = document.getElementById("schematic");
function updateProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  targetProgress = max > 0 ? THREE.MathUtils.clamp(scrollY / max, 0, 1) : 0;
}
addEventListener("scroll", updateProgress, { passive: true });
updateProgress();
progress = targetProgress;

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  updateProgress();
});

// ---------- render loop ----------
const clock = new THREE.Clock();
let lastP = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  progress += (targetProgress - progress) * 0.08;
  mouse.x += (mTarget.x - mouse.x) * 0.05;
  mouse.y += (mTarget.y - mouse.y) * 0.05;

  orbMat.uniforms.uTime.value = reduce ? 0 : t;

  // aura tracks the orb's screen position + scale, with a gentle breath
  aura.position.set(group.position.x, group.position.y, -0.8);
  aura.scale.setScalar(group.scale.x * (3.5 + Math.sin(t * 0.8) * 0.14));

  const [x, y, s, camZ, ringV, haloV, schemV, spin] = sample(progress);

  group.position.x += (x - group.position.x) * 0.06;
  group.position.y += (y - group.position.y) * 0.06;
  const sc = group.scale.x + (s - group.scale.x) * 0.06;
  group.scale.setScalar(sc);
  camera.position.z += (camZ - camera.position.z) * 0.05;

  // continuous spin + scroll twist + mouse tilt
  const spd = reduce ? 0 : spin;
  group.rotation.y += dt * (0.18 * spd) + (progress - lastP) * 6.0;
  group.rotation.x = -0.15 + mouse.y * 0.25 + Math.sin(t * 0.2) * 0.05;
  group.rotation.z += dt * 0.04 * spd;
  group.position.x += mouse.x * 0.15;

  // ring / halo presence
  for (const r of rings) {
    r.visible = ringV > 0.05;
    r.scale.setScalar(0.9 + ringV * 0.25);
    r.rotation.y += dt * 0.25 * spd;
  }
  halo.visible = haloV > 0.05;
  halo.material = glassMat;
  halo.scale.setScalar(0.8 + haloV * 0.6);

  // afterimage smear grows with scroll velocity for the swirl trails
  const vel = Math.abs(targetProgress - progress);
  afterimage.uniforms.damp.value = reduce ? 0.0 : THREE.MathUtils.clamp(0.6 + vel * 16, 0.6, 0.93);

  // expose the orb's screen position + pixel radius so the hero ticker
  // can grow its stock quotes outward from the ball
  _oc.copy(group.position).project(camera);
  _oe.copy(group.position); _oe.x += 0.95 * group.scale.x; _oe.project(camera);
  window.__orb = {
    x: (_oc.x * 0.5 + 0.5) * innerWidth,
    y: (-_oc.y * 0.5 + 0.5) * innerHeight,
    r: Math.abs((_oe.x - _oc.x) * 0.5 * innerWidth),
  };

  lastP = progress;
  composer.render();
  requestAnimationFrame(tick);
}
tick();

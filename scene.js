// KEMIA — the "philosopher's stone" 3D scene, product-shot edition.
//
// Realism: a photo-studio light rig (softboxes + strip lights) baked into the environment,
// physically based materials with micro-roughness, smooth high-detail geometry, real
// stadium-shaped chain links and soft shadows.
//
// No interpenetration: every part lives in its own spherical shell around the core
// (spikes < chain A < chain B < keycaps), and a collision pass each frame keeps keycaps
// and chains apart while they move between the "wrapped" and "scattered" layouts.
//
// Motion: critically damped springs (weight, no wobble), slow inertial spin.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = {
  paper: new THREE.Color('#ECEAE4'),
  ink: new THREE.Color('#141518'),
  molten: new THREE.Color('#FF4A1C'),
  gold: new THREE.Color('#E2B04A'),
  elixir: new THREE.Color('#8AF5FF'),
  chrome: new THREE.Color('#F1F2F4'),
  gunmetal: new THREE.Color('#6B6F76'),
  blackChrome: new THREE.Color('#2B2D31'),
};

// Shell radii in "core units" (multiplied by the core's scale). Keeping each family of
// objects in its own band is what guarantees nothing passes through anything else.
const R = {
  spikes: 1.32,  // tips of the longest spikes
  chainA: 1.64,  // centre-line of the inner chain (links reach ±0.14)
  chainB: 2.06,  // centre-line of the outer chain
  cubes: 2.86,   // centre of the keycaps (each reaches ±0.47)
  outer: 3.3,   // whole assembly, used to fit it on screen
};
const LINK = { straight: 0.12, radius: 0.1, tube: 0.036, pitch: 0.3, bound: 0.26 };
const CUBE = { size: 0.52, bound: 0.455 }; // bound = half-diagonal of a unit keycap

// Deterministic random so the composition is the same on every visit.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/* ---------- Critically damped spring (smooth start, smooth stop, no overshoot) ---------- */
class Spring {
  constructor(value, stiffness = 16) { this.x = value; this.v = 0; this.k = stiffness; }
  step(target, dt) {
    const k = this.k; const c = 2 * Math.sqrt(k);
    this.v += (k * (target - this.x) - c * this.v) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

/* ---------- Procedural micro-surface texture (roughness / bump variation) ---------- */
function noiseTexture(size = 256, seed = 3, lo = 0.84, hi = 1) {
  const r = rng(seed);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  // layered value noise
  const grid = (n) => { const a = []; for (let i = 0; i < (n + 1) * (n + 1); i++) a.push(r()); return a; };
  const octaves = [[8, 0.5], [32, 0.3], [128, 0.2]].map(([n, w]) => ({ n, w, g: grid(n) }));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const o of octaves) {
        const fx = (x / size) * o.n, fy = (y / size) * o.n;
        const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const at = (i, j) => o.g[(j % (o.n + 1)) * (o.n + 1) + (i % (o.n + 1))];
        const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        v += (a + (b - a) * sy) * o.w;
      }
      const p = (y * size + x) * 4;
      const byte = Math.round((lo + (hi - lo) * v) * 255);
      img.data[p] = img.data[p + 1] = img.data[p + 2] = byte; img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---------- Keycap legends, printed onto the cap (lit, not glowing) ---------- */
function glyphTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${text.length > 2 ? 82 : 112}px "Archivo Variable", "Arial Black", sans-serif`;
  g.fillText(text, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/* ---------- Photo-studio environment: what the chrome reflects ---------- */
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  // Backdrop: a sphere with a soft vertical gradient (dark floor → mid-grey horizon → dark top)
  const sky = new THREE.SphereGeometry(30, 48, 24);
  const col = [];
  const pos = sky.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 30;
    const v = y < 0 ? 0.035 + 0.06 * (1 + y) : 0.09 - 0.07 * y;
    col.push(v, v, v * 1.04);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));

  const light = (w, h, intensity, position, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...position);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  light(9, 6, 2.6, [0, 9, 1]);                  // big overhead softbox
  light(4, 7, 3.4, [-7, 2, 5]);                 // key softbox, front-left
  light(0.7, 10, 6.0, [7, 0, 2]);               // strip light, right
  light(0.7, 10, 4.0, [-6, 0, -5]);             // strip light, back-left
  light(10, 1.2, 1.8, [0, -1.5, -9]);           // low rim panel behind
  light(2.2, 2.2, 1.6, [4, -4, 6], 0xff7a4a);   // small warm card (brand accent in reflections)
  light(6, 1.5, 0.9, [0, -8, 3]);               // faint floor bounce

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return tex;
}

/* ---------- Geometry ---------- */
// A real chain link: a round tube following a stadium (two half circles + two straights).
class StadiumCurve extends THREE.Curve {
  getPoint(t, out = new THREE.Vector3()) {
    const { straight: s, radius: r } = LINK;
    const L = 4 * s + 2 * Math.PI * r; // perimeter
    let d = t * L;
    if (d < 2 * s) return out.set(-s + d, r, 0);
    d -= 2 * s;
    if (d < Math.PI * r) { const a = Math.PI / 2 - d / r; return out.set(s + r * Math.cos(a), r * Math.sin(a), 0); }
    d -= Math.PI * r;
    if (d < 2 * s) return out.set(s - d, -r, 0);
    d -= 2 * s;
    const a = -Math.PI / 2 - d / r; return out.set(-s + r * Math.cos(a), r * Math.sin(a), 0);
  }
}

// A spike with a gently curved taper and a rounded tip.
function spikeGeometry(length, baseRadius, segments) {
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const rad = baseRadius * Math.pow(1 - t, 1.5) + 0.006 * Math.sin(t * Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.max(rad, 0.004), t * length));
  }
  pts.push(new THREE.Vector2(0, length + 0.004));
  return new THREE.LatheGeometry(pts, segments);
}

export function createScene(canvas, { reduced = false, mobile = false, debug = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps brand colours true, product-shot contrast
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Resolution: phones get full retina sharpness; slow devices step down automatically.
  const dprSteps = mobile ? [2, 1.6, 1.25, 1] : [1.75, 1.4, 1.1, 1];
  let dprIndex = 0;
  const applyDpr = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprSteps[dprIndex]));
  applyDpr();

  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);

  // A longer lens (narrow field of view) = less distortion, like a product photo.
  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 60);
  camera.position.set(0, 0, 13.5);

  // Key light (casts the soft shadows), a cool rim for dark sections, a warm low fill.
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 7, 8);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(C.elixir, 0);
  rim.position.set(-6, 3, -6);
  scene.add(rim);
  const warm = new THREE.PointLight(C.molten, 0, 30, 2);
  warm.position.set(3, -4, 6);
  scene.add(warm);

  const root = new THREE.Group();
  scene.add(root);

  const micro = noiseTexture(256, 11);          // roughness variation (±8%)
  micro.repeat.set(2, 2);
  const grain = noiseTexture(256, 5, 0, 1);       // fine surface texture for plastic bump
  grain.repeat.set(6, 6);

  /* ---------------- Core: polished spiked stone ---------------- */
  const core = new THREE.Group();
  root.add(core);
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: C.chrome, metalness: 1, roughness: 0.07, roughnessMap: micro, envMapIntensity: 1.15,
  });
  const blackChromeMat = new THREE.MeshPhysicalMaterial({
    color: C.blackChrome, metalness: 1, roughness: 0.2, roughnessMap: micro, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.6, mobile ? 64 : 96, mobile ? 48 : 64), blackChromeMat);
  heart.castShadow = heart.receiveShadow = true;
  core.add(heart);

  const up = new THREE.Vector3(0, 1, 0);
  const spikeParts = [];
  const directions = (geo) => {
    const p = geo.attributes.position; const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
      const k = v.toArray().map((n) => n.toFixed(3)).join(',');
      if (!seen.has(k)) seen.set(k, v);
    }
    return [...seen.values()];
  };
  const addSpikes = (dirs, length, base, start) => {
    dirs.forEach((d) => {
      const g = spikeGeometry(length, base, mobile ? 24 : 40);
      g.applyMatrix4(new THREE.Matrix4().compose(d.clone().multiplyScalar(start), new THREE.Quaternion().setFromUnitVectors(up, d), new THREE.Vector3(1, 1, 1)));
      spikeParts.push(g);
    });
  };
  addSpikes(directions(new THREE.IcosahedronGeometry(1, 0)), R.spikes - 0.46, 0.17, 0.46);
  addSpikes(directions(new THREE.DodecahedronGeometry(1, 0)), 0.5, 0.11, 0.5);
  const spikes = new THREE.Mesh(mergeGeometries(spikeParts), chromeMat);
  spikes.castShadow = spikes.receiveShadow = true;
  core.add(spikes);

  /* ---------------- Keycaps ---------------- */
  const rand = rng(7);
  const capGeo = new RoundedBoxGeometry(CUBE.size, CUBE.size, CUBE.size, mobile ? 5 : 8, 0.085);
  const legendGeo = new THREE.PlaneGeometry(0.36, 0.36);
  const plastic = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness, roughnessMap: micro, bumpMap: grain, bumpScale: 0.012, clearcoat: 0.35, clearcoatRoughness: 0.35, ...extra,
  });
  const capMats = {
    ink: plastic(C.ink, 0.5),
    paper: plastic(C.paper, 0.55, { sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color('#ffffff') }),
    molten: plastic(C.molten, 0.42, { clearcoat: 0.6 }),
    gold: new THREE.MeshPhysicalMaterial({ color: C.gold, metalness: 1, roughness: 0.2, anisotropy: 0.5, anisotropyRotation: Math.PI / 2 }),
  };
  const legendColor = { ink: '#E9E7E1', paper: '#1A1B1E', molten: '#FFF3EC', gold: '#3A2A08' };
  const glyphs = ['Ag', 'Au', 'AI', '✦', '24/7', '⌘', '↵', 'K', '△', '@', '◯', 'Wf', 'Cl', 'Br'];
  const legendMats = new Map();
  const legendMat = (txt, kind) => {
    const k = txt + kind;
    if (!legendMats.has(k)) {
      legendMats.set(k, new THREE.MeshStandardMaterial({
        color: new THREE.Color(legendColor[kind]), alphaMap: glyphTexture(txt), transparent: true, roughness: 0.6,
        metalness: kind === 'gold' ? 0.6 : 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
      }));
    }
    return legendMats.get(k);
  };

  const kinds = ['ink', 'paper', 'molten', 'paper', 'ink', 'gold', 'paper', 'ink', 'molten'];
  const CUBES = mobile ? 12 : 15;
  const cubes = [];
  const ringTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0, 0.3));
  for (let i = 0; i < CUBES; i++) {
    const kind = kinds[i % kinds.length];
    const m = new THREE.Mesh(capGeo, capMats[kind]);
    m.castShadow = m.receiveShadow = true;
    if (i % 2 === 0) {
      const legend = new THREE.Mesh(legendGeo, legendMat(glyphs[(i / 2) % glyphs.length], kind));
      legend.position.z = CUBE.size / 2 + 0.0015;
      m.add(legend);
    }
    const s = 0.88 + rand() * 0.14;
    // Ring slot: evenly spaced angles with small jitter, small latitude offset, kept on the shell.
    const a = (i / CUBES) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const lat = (rand() - 0.5) * 0.36;
    const slot = new THREE.Vector3(Math.cos(a), lat, Math.sin(a)).normalize().multiplyScalar(R.cubes);
    m.userData = {
      s,
      slot,
      // Scattered layout: spread across the screen, mostly behind the chains' planes.
      scatter: new THREE.Vector3(rand() * 2 - 1, rand() * 1.7 - 1, -2.6 + rand() * 3.4),
      spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.35 + rand() * 0.45),
      phase: rand() * 10,
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), k: 20 + rand() * 10, ready: false,
    };
    root.add(m);
    cubes.push(m);
  }

  /* ---------------- Chains ---------------- */
  const linkGeo = new THREE.TubeGeometry(new StadiumCurve(), mobile ? 64 : 96, LINK.tube, mobile ? 10 : 14, true);
  const chainMats = [
    new THREE.MeshPhysicalMaterial({ color: C.chrome, metalness: 1, roughness: 0.09, roughnessMap: micro, envMapIntensity: 1.2 }),
    new THREE.MeshPhysicalMaterial({ color: C.gunmetal, metalness: 1, roughness: 0.2, roughnessMap: micro, envMapIntensity: 1.1 }),
  ];
  // Wrapped path: a gentle wave that always stays exactly on the chain's sphere.
  const shellPath = (radius, wave, waves, phase) => (t, out) =>
    out.set(Math.cos(t), wave * Math.sin(waves * t + phase), Math.sin(t)).normalize().multiplyScalar(radius);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const closedArcTable = (fn, n = 1600) => {
    const ts = [0], ls = [0]; let L = 0; fn(0, tmpA);
    for (let i = 1; i <= n; i++) { const t = (i / n) * Math.PI * 2; fn(t, tmpB); L += tmpB.distanceTo(tmpA); tmpA.copy(tmpB); ts.push(t); ls.push(L); }
    return { L, at(u) {
      const target = (((u % 1) + 1) % 1) * L; let lo = 0, hi = ls.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (ls[mid] < target) lo = mid; else hi = mid; }
      return ts[lo] + (ts[hi] - ts[lo]) * ((target - ls[lo]) / Math.max(1e-6, ls[hi] - ls[lo]));
    } };
  };
  const makeChain = (i, radius, wave, waves, phase, tilt, sweep) => {
    const fn = shellPath(radius, wave, waves, phase);
    const table = closedArcTable(fn);
    const N = Math.round(table.L / LINK.pitch);
    const mesh = new THREE.InstancedMesh(linkGeo, chainMats[i], N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return {
      mesh, N, fn, table, tilt: new THREE.Quaternion().setFromEuler(tilt), sweep,
      spin: new THREE.Quaternion(), angle: 0, rate: i ? -0.6 : 0.8, flow: 0,
      precAxis: new THREE.Vector3(i ? -0.4 : 0.3, 1, i ? 0.25 : -0.2).normalize(), prec: i ? -0.07 : 0.09,
      pts: Array.from({ length: N }, () => new THREE.Vector3()),
      nrm: Array.from({ length: N }, () => new THREE.Vector3()),
    };
  };
  const chains = [
    // A sweeps behind the core, B in front of it, so the two never share space.
    makeChain(0, R.chainA, 0.22, 3, 0.0, new THREE.Euler(1.05, 0.1, 0.5), { y: 0.22, amp: 0.95, freq: 1.15, speed: 0.55, z: -1 }),
    makeChain(1, R.chainB, 0.16, 2, 1.3, new THREE.Euler(-0.6, 0.4, -0.35), { y: -0.22, amp: 0.75, freq: 0.9, speed: 0.42, z: 1 }),
  ];

  /* ---------------- Particles ----------------
     Tiny coloured shards and sparks drifting through the whole page. They part around the
     pointer (or finger), react to scrolling and steer around the core, keycaps and chains. */
  const SHARDS = mobile ? 28 : 48, SPARKS = mobile ? 18 : 30;
  const shardMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true }), SHARDS);
  const sparkMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), SPARKS);
  [shardMesh, sparkMesh].forEach((mm) => { mm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mm.frustumCulled = false; scene.add(mm); });
  const shardPalette = [C.molten, C.gold, C.ink, C.paper, C.elixir, C.chrome, C.molten, C.ink];
  const sparkPalette = [new THREE.Color('#FF6A3C'), new THREE.Color('#8AF5FF'), new THREE.Color('#F2C14E'), new THREE.Color('#FFFFFF')];
  const particles = [];
  const pr = rng(21);
  for (let i = 0; i < SHARDS + SPARKS; i++) {
    const spark = i >= SHARDS;
    const idx = spark ? i - SHARDS : i;
    (spark ? sparkMesh : shardMesh).setColorAt(idx, (spark ? sparkPalette : shardPalette)[idx % (spark ? sparkPalette.length : shardPalette.length)]);
    particles.push({
      spark, idx,
      home: new THREE.Vector3(pr() * 2.3 - 1.15, pr() * 2.3 - 1.15, -4.5 + pr() * 7),
      size: spark ? 0.014 + pr() * 0.016 : 0.03 + pr() * 0.045,
      ph: pr() * 20, sp: 0.15 + pr() * 0.35,
      axis: new THREE.Vector3(pr() - 0.5, pr() - 0.5, pr() - 0.5).normalize(), spin: 0.4 + pr() * 1.4,
      q: new THREE.Quaternion(), off: new THREE.Vector3(), vel: new THREE.Vector3(), pos: new THREE.Vector3(), r: 0, vis: 1,
    });
  }
  shardMesh.instanceColor.needsUpdate = true;
  sparkMesh.instanceColor.needsUpdate = true;
  let drift = 0; // vertical drift fed by scrolling

  /* ---------------- State ---------------- */
  const target = { x: 0.1, y: -0.08, s: 0.82, explode: 0, chain: 0, dark: 0, sweepY: 0 };
  const sp = {
    x: new Spring(target.x, 30), y: new Spring(target.y, 30), s: new Spring(target.s, 30),
    explode: new Spring(0, 18), chain: new Spring(0, 14), dark: new Spring(0, 14), sweepY: new Spring(0, 16),
    px: new Spring(0, 18), py: new Spring(0, 18), spin: new Spring(0.18, 6),
  };
  const cur = { intro: reduced ? 1 : 0 };
  const pointer = { x: 0, y: 0 };
  let pointerActive = false;
  let velocity = 0;
  let halfW = 1, halfH = 1, fit = 1;

  const resize = () => {
    const w = window.innerWidth; const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
    fit = Math.min(halfW, halfH) / R.outer;
    const sc = key.shadow.camera;
    sc.left = -halfW * 1.4; sc.right = halfW * 1.4; sc.top = halfH * 1.5; sc.bottom = -halfH * 1.5;
    sc.near = 1; sc.far = 40;
    sc.updateProjectionMatrix();
  };
  resize();

  // Scratch objects (no allocations inside the frame loop)
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const tan = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3(), bin = new THREE.Vector3();
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion();
  const m4 = new THREE.Matrix4(), basis = new THREE.Matrix4(), scl = new THREE.Vector3();
  const coreC = new THREE.Vector3();
  const worldY = new THREE.Vector3(0, 1, 0), worldZ = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const ringQ = new THREE.Quaternion();

  let time = 0;
  let coreAngle = 0;
  let ringAngle = 0;
  const clock = new THREE.Clock();

  const ease = (t) => t * t * (3 - 2 * t);
  const introScale = () => { const t = Math.min(1, cur.intro); return 1 - Math.pow(1 - t, 3); };

  function stepState(dt) {
    // Springs integrate in small steps so motion is identical at 30, 60 or 120 fps.
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const k of ['x', 'y', 's', 'explode', 'chain', 'dark', 'sweepY']) sp[k].step(target[k], h);
      sp.px.step(pointer.x, h); sp.py.step(pointer.y, h);
      sp.spin.step(0.18 + Math.min(Math.abs(velocity) * 0.02, 1.4), h);
    }
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 15);
    const motion = reduced ? 0.25 : 1;
    time += dt * motion;
    velocity *= Math.exp(-3 * dt);
    stepState(dt);

    const iS = introScale();
    const cs = sp.s.x * fit * Math.max(iS, 0.0001);      // core-unit → world scale
    // Unwrapping happens in two stages so the chains never cross: the outer chain (B)
    // leaves first and comes back last; the inner chain (A) moves only while B is clear.
    const chainT = THREE.MathUtils.clamp(sp.chain.x, 0, 1);
    const mixB = ease(THREE.MathUtils.clamp(chainT * 2, 0, 1));
    const mixA = ease(THREE.MathUtils.clamp(chainT * 2 - 1, 0, 1));
    const ex = ease(THREE.MathUtils.clamp(sp.explode.x, 0, 1));
    const d = THREE.MathUtils.clamp(sp.dark.x, 0, 1);

    // Camera-like parallax: the whole set turns a little with the pointer.
    root.rotation.set(-sp.py.x * 0.1, sp.px.x * 0.16, 0);

    // Core
    coreC.set(sp.x.x * halfW, sp.y.x * halfH + Math.sin(time * 0.8) * 0.05 * fit, 0);
    coreAngle += dt * sp.spin.x * motion + (1 - Math.min(cur.intro, 1)) * dt * 1.2;
    ringAngle += dt * (0.12 + 0.25 * sp.spin.x) * motion;
    core.position.copy(coreC);
    core.scale.setScalar(cs);
    core.rotation.set(0.28, coreAngle, 0.1);

    // Lighting mood: dark sections get a cool rim and a warm low fill, studio dims a touch.
    scene.environmentIntensity = 1 - d * 0.35;
    rim.intensity = d * 3.2;
    warm.intensity = d * 14;
    key.intensity = 1.4 - d * 0.5;

    /* ---- Chains ----
       Wrapped: each chain spins, slowly precesses and its links flow round the loop, all
       inside its own shell. Unwrapped: both lie across the screen as travelling waves,
       A in a plane behind the core and B in a plane in front of it. */
    const sweepScale = fit * 1.3;
    chains.forEach((ch, ci) => {
      const m = ci ? mixB : mixA;
      ch.m = m;
      ch.scale = cs * (1 - m) + sweepScale * m;
      ch.angle += dt * ch.rate * sp.spin.x * motion;
      ch.flow += dt * (ci ? -0.01 : 0.013) * motion;
      qa.setFromAxisAngle(ch.precAxis, time * ch.prec);
      ch.spin.setFromAxisAngle(ci ? v3.set(0.3, 1, 0.2).normalize() : worldY, ch.angle).multiply(qa);
      const sw = ch.sweep;
      const length = ch.N * LINK.pitch * sweepScale;              // exact chain length when straight
      const zPlane = sw.z * (R.outer * cs + 0.5 * sweepScale);     // behind (A) / in front of (B) the core
      // closest the link centres may come to the core while travelling
      const minR = ci
        ? (R.chainA + 0.16) * cs + LINK.bound * ch.scale            // B stays outside A's shell
        : (R.spikes + 0.06) * cs + LINK.bound * ch.scale;           // A stays outside the spikes
      for (let i = 0; i < ch.N; i++) {
        const u = i / ch.N;
        ch.fn(ch.table.at(u + ch.flow), v1).applyQuaternion(ch.tilt).applyQuaternion(ch.spin);
        n1.copy(v1).normalize();
        v1.multiplyScalar(cs).add(coreC);
        const p = ch.pts[i];
        if (m <= 0) { p.copy(v1); ch.nrm[i].copy(n1); continue; }
        const x = (u - 0.5) * length;
        const phase = u * Math.PI * 2 * sw.freq * (length / 12) + time * sw.speed;
        v2.set(x, (sw.y + sp.sweepY.x) * halfH + sw.amp * fit * Math.sin(phase), zPlane + 0.3 * fit * Math.cos(phase * 0.8));
        n2.set(0, Math.cos(phase) * 0.35, 1);
        p.lerpVectors(v1, v2, m);
        ch.nrm[i].lerpVectors(n1, n2.normalize(), m).normalize();
        v3.subVectors(p, coreC);
        const L = v3.length();
        if (L < minR) p.copy(coreC).addScaledVector(v3.divideScalar(Math.max(L, 1e-5)), minR);
      }
    });
    const A = chains[0], B = chains[1];
    // Orient every link along its chain, alternating 90° so neighbours interlock.
    chains.forEach((ch) => {
      for (let i = 0; i < ch.N; i++) {
        const prev = ch.pts[(i - 1 + ch.N) % ch.N], next = ch.pts[(i + 1) % ch.N];
        const closed = ch.m < 0.5;
        if (closed || (i > 0 && i < ch.N - 1)) tan.subVectors(next, prev);
        else if (i === 0) tan.subVectors(ch.pts[1], ch.pts[0]);
        else tan.subVectors(ch.pts[i], ch.pts[i - 1]);
        tan.normalize();
        n1.copy(ch.nrm[i]).addScaledVector(tan, -ch.nrm[i].dot(tan));
        if (n1.lengthSq() < 1e-6) n1.copy(Math.abs(tan.y) > 0.9 ? worldZ : worldY).addScaledVector(tan, -tan.dot(Math.abs(tan.y) > 0.9 ? worldZ : worldY));
        n1.normalize();
        if (i % 2) n1.crossVectors(tan, n1).normalize();
        bin.crossVectors(n1, tan);
        basis.makeBasis(tan, bin, n1);
        q.setFromRotationMatrix(basis);
        scl.setScalar(Math.max(ch.scale * iS, 0.0001));
        m4.compose(ch.pts[i], q, scl);
        ch.mesh.setMatrixAt(i, m4);
      }
      ch.mesh.instanceMatrix.needsUpdate = true;
    });

    /* ---- Keycaps: ring around the core ↔ scattered, springs + collision pass ---- */
    ringQ.setFromAxisAngle(worldY, ringAngle).premultiply(ringTilt);
    const capScaleRing = cs, capScaleScatter = fit * 0.95;
    cubes.forEach((m) => {
      const u = m.userData;
      v1.copy(u.slot).applyQuaternion(ringQ).multiplyScalar(cs).add(coreC);
      v1.y += Math.sin(time * 0.9 + u.phase) * 0.05 * cs;
      v2.set(u.scatter.x * halfW * 0.92 + Math.sin(time * 0.35 + u.phase) * 0.25 * fit, u.scatter.y * halfH * 0.85 + Math.cos(time * 0.3 + u.phase) * 0.25 * fit, u.scatter.z);
      v1.lerp(v2, ex);
      if (!u.ready) { u.pos.copy(v1); u.ready = true; }
      // spring toward the target (each cap has its own stiffness → natural stagger)
      const k = u.k, c = 2 * Math.sqrt(k);
      v3.subVectors(v1, u.pos).multiplyScalar(k).addScaledVector(u.vel, -c);
      u.vel.addScaledVector(v3, dt);
      u.pos.addScaledVector(u.vel, dt);
      u.radius = CUBE.bound * u.s * (capScaleRing * (1 - ex) + capScaleScatter * ex) * iS;
      // slow zero-gravity tumble
      qa.setFromAxisAngle(v3.copy(u.spin).normalize(), u.spin.length() * dt * motion);
      u.q.premultiply(qa);
    });
    // Collision pass: caps vs core, chains and each other (positions + velocities).
    const coreR = (R.spikes + 0.14) * cs;
    const pushOut = (u, from, minDist) => {
      v3.subVectors(u.pos, from);
      const L = v3.length();
      if (L < minDist) {
        v3.divideScalar(Math.max(L, 1e-5));
        u.pos.addScaledVector(v3, minDist - L);
        const vn = u.vel.dot(v3);
        if (vn < 0) u.vel.addScaledVector(v3, -vn);
      }
    };
    for (let iter = 0; iter < 10; iter++) {
      for (let a = 0; a < cubes.length; a++) {
        const ua = cubes[a].userData;
        for (let b = a + 1; b < cubes.length; b++) {
          const ub = cubes[b].userData;
          v3.subVectors(ua.pos, ub.pos);
          const L = v3.length(); const min = ua.radius + ub.radius + 0.035;
          if (L < min) {
            v3.divideScalar(Math.max(L, 1e-5)).multiplyScalar((min - L) / 2);
            ua.pos.add(v3); ub.pos.sub(v3);
          }
        }
      }
      for (let a = 0; a < cubes.length; a++) {
        const ua = cubes[a].userData;
        for (const ch of chains) { const lr = LINK.bound * ch.scale * iS + ua.radius + 0.035; for (let i = 0; i < ch.N; i++) pushOut(ua, ch.pts[i], lr); }
        pushOut(ua, coreC, coreR + ua.radius);
      }
    }
    cubes.forEach((m) => {
      const u = m.userData;
      m.position.copy(u.pos);
      m.quaternion.copy(u.q);
      m.scale.setScalar(Math.max(u.s * (capScaleRing * (1 - ex) + capScaleScatter * ex) * iS, 0.0001));
    });

    /* ---- Particles ---- */
    drift += velocity * 0.0009 * dt * 60;
    const ps = Math.min(halfW, halfH) / 3;             // keep their on-screen size steady across screens
    const pNdc = v2.set(pointer.x, -pointer.y, 0);
    for (const pt of particles) {
      // home position + slow drift (wraps vertically so they never pile up)
      const span = halfH * 2.6;
      let y = pt.home.y * halfH + Math.sin(time * pt.sp + pt.ph) * 0.35 + drift * (0.6 + 0.4 * pt.sp);
      y = ((y + span / 2) % span + span) % span - span / 2;
      v1.set(pt.home.x * halfW + Math.cos(time * pt.sp * 0.8 + pt.ph) * 0.4 - sp.px.x * pt.home.z * 0.06,
             y + sp.py.x * pt.home.z * 0.04, pt.home.z);
      // pointer: push away in screen space, then spring home
      pt.pos.copy(v1).add(pt.off);
      v3.copy(pt.pos).project(camera);
      const dx = (v3.x - pNdc.x) * camera.aspect, dy = v3.y - pNdc.y;
      const dist = Math.hypot(dx, dy);
      if (pointerActive && dist < 0.28) {
        const f = (1 - dist / 0.28) * 14;
        pt.vel.x += (dx / (dist + 1e-4)) * f * dt;
        pt.vel.y += (dy / (dist + 1e-4)) * f * dt;
      }
      pt.vel.addScaledVector(pt.off, -6 * dt).multiplyScalar(Math.exp(-2.6 * dt));
      pt.off.addScaledVector(pt.vel, dt);
      pt.pos.copy(v1).add(pt.off);
      // steer around the 3D objects
      pt.r = pt.size * ps * 1.8;
      const avoid = (from, min) => {
        v3.subVectors(pt.pos, from); const L = v3.length();
        if (L < min) { v3.divideScalar(Math.max(L, 1e-5)).multiplyScalar(min - L); pt.pos.add(v3); pt.off.add(v3); }
      };
      for (let it = 0; it < 3; it++) {
        for (const ch of chains) { const lr = LINK.bound * ch.scale * iS + pt.r + 0.02; for (let i = 0; i < ch.N; i += 1) avoid(ch.pts[i], lr); }
        for (const c of cubes) avoid(c.userData.pos, c.userData.radius + pt.r + 0.02);
        avoid(coreC, coreR + pt.r);
      }
      // If a particle is boxed in with nowhere to go, it briefly shrinks away instead.
      let stuck = false;
      const check = (from, min) => { if (pt.pos.distanceTo(from) < min - 0.002) stuck = true; };
      check(coreC, coreR + pt.r);
      for (const c of cubes) check(c.userData.pos, c.userData.radius + pt.r);
      for (const ch of chains) { const lr = LINK.bound * ch.scale * iS + pt.r; for (let i = 0; i < ch.N; i++) check(ch.pts[i], lr); }
      pt.vis += ((stuck ? 0 : 1) - pt.vis) * (stuck ? 1 : Math.min(1, dt * 6));
      qa.setFromAxisAngle(pt.axis, pt.spin * dt * motion);
      pt.q.premultiply(qa);
      scl.setScalar(pt.size * ps * pt.vis * Math.min(1, cur.intro * 1.5 + 0.0001) + 0.00001);
      m4.compose(pt.pos, pt.q, scl);
      (pt.spark ? sparkMesh : shardMesh).setMatrixAt(pt.idx, m4);
    }
    shardMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;

    if (debug) {
      let cc = Infinity, cl = Infinity, ck = Infinity, ab = Infinity, lk = Infinity;
      for (let a = 0; a < cubes.length; a++) {
        const ua = cubes[a].userData;
        ck = Math.min(ck, ua.pos.distanceTo(coreC) - ua.radius - (R.spikes) * cs);
        for (const ch of chains) for (let i = 0; i < ch.N; i++) cl = Math.min(cl, ua.pos.distanceTo(ch.pts[i]) - ua.radius - LINK.bound * ch.scale * iS);
        for (let b = a + 1; b < cubes.length; b++) { const ub = cubes[b].userData; cc = Math.min(cc, ua.pos.distanceTo(ub.pos) - ua.radius - ub.radius); }
      }
      // chains vs each other: while A is wrapped, B must stay outside A's shell (> 1.78 core units);
      // once A moves, B is fully out, so check the actual link-to-link gap (> 0).
      if (mixA <= 0) for (let i = 0; i < B.N; i++) ab = Math.min(ab, (B.pts[i].distanceTo(coreC) - LINK.bound * B.scale) / Math.max(cs, 1e-6) - 1.78);
      else for (let i = 0; i < B.N; i++) for (let j = 0; j < A.N; j++) ab = Math.min(ab, B.pts[i].distanceTo(A.pts[j]) - LINK.bound * (A.scale + B.scale));
      for (const ch of chains) for (let i = 0; i < ch.N; i++) lk = Math.min(lk, (ch.pts[i].distanceTo(coreC) - LINK.bound * ch.scale) / Math.max(cs, 1e-6));
      const st = (window.__kemia3d = window.__kemia3d || { cubeCube: Infinity, cubeLink: Infinity, cubeCore: Infinity, chainChain: Infinity, linkCore: Infinity, frames: 0 });
      if (cur.intro >= 1) {
        let pc = Infinity;
      for (const pt of particles) {
        if (pt.vis < 0.02) continue;
        pc = Math.min(pc, pt.pos.distanceTo(coreC) - pt.r - (R.spikes) * cs);
        for (const c of cubes) pc = Math.min(pc, pt.pos.distanceTo(c.userData.pos) - pt.r - c.userData.radius);
        for (const ch of chains) for (let i = 0; i < ch.N; i++) pc = Math.min(pc, pt.pos.distanceTo(ch.pts[i]) - pt.r - LINK.bound * ch.scale * iS);
      }
      st.particle = Math.min(st.particle ?? Infinity, pc);
      st.cubeCube = Math.min(st.cubeCube, cc); st.cubeLink = Math.min(st.cubeLink, cl); st.cubeCore = Math.min(st.cubeCore, ck);
        st.chainChain = Math.min(st.chainChain, ab); st.linkCore = Math.min(st.linkCore, lk); st.frames++;
      }
    }
    renderer.render(scene, camera);
  }

  /* ---------------- Render loop ---------------- */
  // Stops while the tab is hidden; with reduced motion it only renders while something
  // changes; on slow devices it steps the resolution down instead of dropping frames.
  let running = !document.hidden;
  let lastFrame = 0;
  let wake = 1;
  let samples = [];
  let fpsCap = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!running) return;
    if (fpsCap && now - lastFrame < 1000 / fpsCap - 2) return;
    if (reduced && cur.intro >= 1 && wake <= 0) return;
    if (lastFrame && cur.intro >= 1 && dprIndex < dprSteps.length - 1) {
      samples.push(now - lastFrame);
      if (samples.length >= 90) {
        samples.sort((a, b) => a - b);
        if (samples[45] > 21) { dprIndex++; applyDpr(); resize(); } // below ~48fps: lighten
        samples = [];
      }
    }
    lastFrame = now;
    wake -= 1 / 60;
    frame();
  };
  requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; clock.getDelta(); });

  return {
    setState(s) { Object.assign(target, s); wake = 3; },
    setFpsCap(fps) { fpsCap = fps; },
    setPointer(x, y) { pointer.x = x; pointer.y = y; pointerActive = true; if (reduced) wake = Math.max(wake, 1); },
    releasePointer() { pointerActive = false; },
    setVelocity(v) { velocity = Math.max(-80, Math.min(80, v)); },
    get intro() { return cur.intro; },
    set intro(v) { cur.intro = v; },
    snap() {
      for (const k of ['x', 'y', 's', 'explode', 'chain', 'dark', 'sweepY']) { sp[k].x = target[k]; sp[k].v = 0; }
    },
    resize,
    renderer,
  };
}

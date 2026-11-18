// KEMIA — the "philosopher's stone" 3D scene.
// A chrome spiked core, a ring of keycap cubes, two interlocked chains that
// morph between wrapping the core and sweeping across the screen, and debris.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = {
  paper: new THREE.Color('#EEECE6'),
  ink: new THREE.Color('#121214'),
  molten: new THREE.Color('#FF4A1C'),
  gold: new THREE.Color('#D8A93B'),
  elixir: new THREE.Color('#8AF5FF'),
  chrome: new THREE.Color('#D4D7DC'),
};

const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Deterministic random so the composition is the same on every visit.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function glyphTexture(text, fg) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = text.length > 2 ? 86 : 118;
  g.font = `800 ${size}px "Archivo Variable", "Alexandria Variable", "Arial Black", sans-serif`;
  g.fillText(text, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createScene(canvas, { reduced = false, mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxDpr = mobile ? 1.5 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Lights (on top of the environment) — a warm key and a molten rim.
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 6);
  scene.add(key);
  const rim = new THREE.PointLight(C.molten, 30, 14, 1.6);
  rim.position.set(-2.5, -1.5, -2.5);
  scene.add(rim);
  const glow = new THREE.PointLight(C.elixir, 0, 16, 1.4);
  glow.position.set(2.5, 2, 3);
  scene.add(glow);

  const root = new THREE.Group();
  scene.add(root);

  /* ---------------- Core: the philosopher's stone ---------------- */
  const core = new THREE.Group();
  root.add(core);

  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: C.chrome, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25, flatShading: true,
  });
  const darkChrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#3a3c40'), metalness: 1, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1, flatShading: true,
  });

  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), darkChrome);
  core.add(heart);

  const spikeParts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const addSpikes = (dirs, h, r, base) => {
    dirs.forEach((d) => {
      const g = new THREE.ConeGeometry(r, h, 6, 1);
      const q = new THREE.Quaternion().setFromUnitVectors(up, d);
      const m = new THREE.Matrix4().compose(d.clone().multiplyScalar(base + h / 2), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      spikeParts.push(g);
    });
  };
  const dirsFrom = (geo) => {
    const p = geo.attributes.position; const seen = new Map();
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
      const k = v.toArray().map((n) => n.toFixed(3)).join(',');
      if (!seen.has(k)) seen.set(k, v);
    }
    return [...seen.values()];
  };
  addSpikes(dirsFrom(new THREE.IcosahedronGeometry(1, 0)), 1.05, 0.2, 0.42);
  addSpikes(dirsFrom(new THREE.DodecahedronGeometry(1, 0)), 0.55, 0.14, 0.45);
  const spikes = new THREE.Mesh(mergeGeometries(spikeParts), chromeMat);
  core.add(spikes);

  // Molten halo ring
  const haloMat = new THREE.MeshStandardMaterial({ color: C.molten, emissive: C.molten, emissiveIntensity: 1.4, roughness: 0.4 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.018, 8, 160), haloMat);
  halo.rotation.set(1.25, 0.2, 0);
  core.add(halo);

  /* ---------------- Ring of keycap cubes ---------------- */
  const ring = new THREE.Group();
  root.add(ring);
  const cubeGeo = new RoundedBoxGeometry(0.44, 0.44, 0.44, 4, 0.085);
  const glyphGeo = new THREE.PlaneGeometry(0.34, 0.34);
  const mats = {
    ink: new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }),
    paper: new THREE.MeshPhysicalMaterial({ color: C.paper.clone(), roughness: 0.45, clearcoat: 0.6, emissive: C.elixir, emissiveIntensity: 0 }),
    molten: new THREE.MeshPhysicalMaterial({ color: C.molten, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: C.molten, emissiveIntensity: 0.08 }),
    gold: new THREE.MeshPhysicalMaterial({ color: C.gold, metalness: 1, roughness: 0.24, clearcoat: 0.6, envMapIntensity: 1.2 }),
  };
  const glyphs = ['Ag', 'Au', 'AI', '✦', 'ع', '24/7', '⌘', '↵', 'K', '△', '@', '◯', 'ك', 'Wf'];
  const glyphFg = { ink: '#EEECE6', paper: '#0C0C0D', molten: '#EEECE6', gold: '#0C0C0D' };
  const texCache = new Map();
  const getGlyphMat = (txt, kind) => {
    const k = txt + kind;
    if (!texCache.has(k)) texCache.set(k, new THREE.MeshBasicMaterial({ map: glyphTexture(txt, glyphFg[kind]), transparent: true, depthWrite: false }));
    return texCache.get(k);
  };

  const rand = rng(7);
  const kinds = ['ink', 'paper', 'molten', 'ink', 'paper', 'gold', 'ink', 'paper', 'molten', 'paper'];
  const CUBES = mobile ? 20 : 28;
  const cubes = [];
  for (let i = 0; i < CUBES; i++) {
    const kind = kinds[i % kinds.length];
    const m = new THREE.Mesh(cubeGeo, mats[kind]);
    if (i % 2 === 0) {
      const gm = new THREE.Mesh(glyphGeo, getGlyphMat(glyphs[(i / 2) % glyphs.length], kind));
      gm.position.z = 0.222;
      m.add(gm);
    }
    const s = 0.7 + rand() * 0.55;
    m.userData = {
      a: (i / CUBES) * Math.PI * 2 + (rand() - 0.5) * 0.18,
      r: 2.15 + (rand() - 0.5) * 0.55,
      y: (rand() - 0.5) * 0.55,
      s,
      spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.2),
      rot0: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
      scatter: new THREE.Vector3((rand() * 2 - 1), -1 + rand() * 1.45, -1.5 + rand() * 3.2),
      phase: rand() * 10,
    };
    m.rotation.copy(m.userData.rot0);
    ring.add(m);
    cubes.push(m);
  }

  /* ---------------- Chains ---------------- */
  const linkGeo = new THREE.TorusGeometry(0.13, 0.038, 10, 26);
  linkGeo.scale(1.6, 1, 1);
  const chainMatA = new THREE.MeshPhysicalMaterial({ color: C.chrome, metalness: 1, roughness: 0.16, clearcoat: 1, envMapIntensity: 1.3, emissive: C.elixir, emissiveIntensity: 0 });
  const chainMatB = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#2b2c30'), metalness: 1, roughness: 0.2, clearcoat: 1, envMapIntensity: 1.1, emissive: C.elixir, emissiveIntensity: 0 });

  const B_LIGHT = new THREE.Color('#2b2c30'), B_DARK = new THREE.Color('#1a3d44');
  const knot = (p, q, R, r) => (t) => {
    const ct = Math.cos(q * t);
    return new THREE.Vector3((R + r * ct) * Math.cos(p * t), r * Math.sin(q * t), (R + r * ct) * Math.sin(p * t));
  };
  const arcLength = (fn, a, b, n = 800) => {
    let L = 0; let prev = fn(a);
    for (let i = 1; i <= n; i++) { const p = fn(a + (b - a) * (i / n)); L += p.distanceTo(prev); prev = p; }
    return L;
  };
  // Re-parameterise a curve by arc length so links are evenly spaced.
  const arcTable = (fn, a, b, n = 1200) => {
    const ts = [a]; const ls = [0]; let prev = fn(a); let L = 0;
    for (let i = 1; i <= n; i++) { const t = a + (b - a) * (i / n); const p = fn(t); L += p.distanceTo(prev); prev = p; ts.push(t); ls.push(L); }
    return (u) => { // u in [0,1] -> t
      const target = u * L; let lo = 0, hi = ls.length - 1;
      while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (ls[mid] < target) lo = mid; else hi = mid; }
      const f = (target - ls[lo]) / Math.max(1e-6, ls[hi] - ls[lo]);
      return ts[lo] + (ts[hi] - ts[lo]) * f;
    };
  };

  const PITCH = 0.33;
  const makeChain = (mat, knotFn, tilt, sweepCfg) => {
    const L = arcLength(knotFn, 0, Math.PI * 2);
    const N = Math.round(L / PITCH);
    const mesh = new THREE.InstancedMesh(linkGeo, mat, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    root.add(mesh);
    return { mesh, N, knotFn, uToT: arcTable(knotFn, 0, Math.PI * 2), tilt, sweep: sweepCfg, L };
  };
  // A loop around the core with a gentle vertical wave (a "saddle" ring).
  const ringPath = (R, r, waves, stretch = 1) => (t) => new THREE.Vector3(R * stretch * Math.cos(t), r * Math.sin(waves * t), R * Math.sin(t));
  const chains = [
    makeChain(chainMatA, ringPath(2.05, 0.38, 3, 1.08), new THREE.Euler(0.5, 0, 0.32), { amp: 0.95, freq: 1.15, y: 0.2, z: 0.6, phase: 0, speed: 0.55 }),
    makeChain(chainMatB, ringPath(1.75, 0.3, 2, 1.0), new THREE.Euler(-0.95, 0.5, -0.5), { amp: 0.75, freq: 0.9, y: -0.55, z: -0.4, phase: 2.1, speed: 0.42 }),
  ];

  /* ---------------- Debris ---------------- */
  const DEB = mobile ? 16 : 28;
  const debGeo = new THREE.TetrahedronGeometry(0.07, 0);
  const debMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.3, flatShading: true });
  const debris = new THREE.InstancedMesh(debGeo, debMat, DEB);
  debris.frustumCulled = false;
  const debData = [];
  const palette = [C.ink, C.molten, C.chrome, C.ink, C.gold, C.paper];
  for (let i = 0; i < DEB; i++) {
    debData.push({
      p: new THREE.Vector3((rand() * 2 - 1) * 1.15, (rand() * 2 - 1) * 1.1, -3 + rand() * 4.5),
      s: 0.5 + rand() * 1.3,
      r: new THREE.Vector3(rand() * 6, rand() * 6, rand() * 6),
      v: 0.2 + rand() * 0.6,
      ph: rand() * 10,
    });
    debris.setColorAt(i, palette[i % palette.length]);
  }
  root.add(debris);

  /* ---------------- State ---------------- */
  const target = { x: 0.1, y: -0.08, s: 0.82, explode: 0, chain: 0, dark: 0, sweepY: 0 };
  const cur = { ...target, intro: reduced ? 1 : 0 };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let velocity = 0;
  let halfW = 1, halfH = 1, fit = 1;

  const resize = () => {
    const w = window.innerWidth; const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    halfW = halfH * camera.aspect;
    fit = Math.min(halfW, halfH) / 2.9;
  };
  resize();

  // Reusable temporaries
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const sc = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const spinQ = new THREE.Quaternion();
  const tiltQ = new THREE.Quaternion();
  const coreQ = new THREE.Quaternion();
  const e = new THREE.Euler();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const altUp = new THREE.Vector3(0, 0, 1);

  let time = 0;
  let coreRot = 0;
  const clock = new THREE.Clock();

  const sweepPoint = (cfg, u, t, out) => {
    const span = Math.max(halfW, 4.2) * 2.6;
    const x = (u - 0.5) * span;
    out.set(
      x,
      (cfg.y + cur.sweepY) * halfH + cfg.amp * Math.sin(u * Math.PI * 2 * cfg.freq + t * cfg.speed + cfg.phase),
      cfg.z + 0.9 * Math.cos(u * Math.PI * 2 * 0.8 + t * cfg.speed * 0.7 + cfg.phase)
    );
    return out;
  };

  const frame = () => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    time += reduced ? dt * 0.25 : dt;

    // Ease everything towards the current section's target.
    const L = 3.2;
    cur.x = damp(cur.x, target.x, L, dt);
    cur.y = damp(cur.y, target.y, L, dt);
    cur.s = damp(cur.s, target.s, L, dt);
    cur.explode = damp(cur.explode, target.explode, 2.4, dt);
    cur.chain = damp(cur.chain, target.chain, 2.2, dt);
    cur.dark = damp(cur.dark, target.dark, 3, dt);
    cur.sweepY = damp(cur.sweepY, target.sweepY, 2.2, dt);
    velocity = damp(velocity, 0, 3, dt);
    pointer.x = damp(pointer.x, pointer.tx, 4, dt);
    pointer.y = damp(pointer.y, pointer.ty, 4, dt);

    const intro = cur.intro;
    const introS = intro >= 1 ? 1 : Math.max(0, easeOutBack(intro));

    // Root parallax
    root.rotation.y = pointer.x * 0.22;
    root.rotation.x = -pointer.y * 0.14;

    // Core transform (positions are fractions of the visible half-size)
    const cx = cur.x * halfW;
    const cy = cur.y * halfH;
    const cs = cur.s * fit * introS;
    core.position.set(cx, cy + Math.sin(time * 0.8) * 0.06, 0);
    core.scale.setScalar(Math.max(cs, 0.0001));
    coreRot += dt * (0.18 + Math.min(Math.abs(velocity) * 0.02, 1.4)) * (reduced ? 0.3 : 1) + (1 - intro) * dt * 3;
    core.rotation.set(0.25 + Math.sin(time * 0.3) * 0.1, coreRot, 0.12);
    halo.rotation.z = time * 0.4;

    // Dark-mode colour shifts
    const d = cur.dark;
    chainMatA.emissiveIntensity = d * 0.55;
    chainMatB.emissiveIntensity = d * 0.85;
    chainMatB.color.lerpColors(B_LIGHT, B_DARK, d);
    mats.paper.color.lerpColors(C.paper, C.elixir, d * 0.75);
    mats.paper.emissiveIntensity = d * 0.35;
    glow.intensity = d * 60;
    rim.intensity = 30 + d * 20;
    renderer.toneMappingExposure = 1.05 + d * 0.15;

    // Cubes: ring around the core <-> scattered across the screen
    const ex = smooth(Math.min(1, Math.max(0, cur.explode)));
    const ringRot = time * 0.16 + coreRot * 0.2;
    tiltQ.setFromEuler(e.set(1.12, 0, 0.32));
    cubes.forEach((m, i) => {
      const u = m.userData;
      const a = u.a + ringRot;
      const rr = u.r * (0.2 + 0.8 * introS);
      v1.set(Math.cos(a) * rr, u.y + Math.sin(time * 0.9 + u.phase) * 0.08, Math.sin(a) * rr).applyQuaternion(tiltQ);
      v1.multiplyScalar(cs).add(core.position);
      v2.set(
        u.scatter.x * halfW * 0.92 + Math.sin(time * 0.35 + u.phase) * 0.25,
        u.scatter.y * halfH * 0.85 + Math.cos(time * 0.3 + u.phase) * 0.25,
        u.scatter.z
      );
      m.position.lerpVectors(v1, v2, ex);
      const scale = u.s * (cs * (1 - ex) + fit * 0.85 * ex);
      m.scale.setScalar(Math.max(scale, 0.0001));
      m.rotation.set(
        u.rot0.x + time * u.spin.x * (reduced ? 0.2 : 1),
        u.rot0.y + time * u.spin.y * (reduced ? 0.2 : 1),
        u.rot0.z + time * u.spin.z * (reduced ? 0.2 : 1)
      );
    });

    // Chains
    const mix = smooth(Math.min(1, Math.max(0, cur.chain)));
    coreQ.setFromEuler(core.rotation);
    chains.forEach((ch, ci) => {
      tiltQ.setFromEuler(ch.tilt);
      spinQ.setFromAxisAngle(worldUp, coreRot * (ci ? -0.6 : 0.8));
      const flow = (time * (ci ? 0.012 : 0.016)) % 1;
      for (let i = 0; i < ch.N; i++) {
        const u = i / ch.N;
        // wrap position (local knot -> world)
        const uw = (u + flow) % 1;
        const t0 = ch.uToT(uw);
        const t1 = ch.uToT((uw + 0.002) % 1);
        v1.copy(ch.knotFn(t0)).applyQuaternion(tiltQ).applyQuaternion(spinQ);
        tA.copy(ch.knotFn(t1)).applyQuaternion(tiltQ).applyQuaternion(spinQ).sub(v1);
        v1.multiplyScalar(cs * (0.35 + 0.65 * introS)).add(core.position);
        // sweep position
        sweepPoint(ch.sweep, u, time, v2);
        sweepPoint(ch.sweep, u + 0.002, time, v3);
        tB.subVectors(v3, v2);
        v1.lerp(v2, mix);
        tA.normalize().lerp(tB.normalize(), mix).normalize();
        // Orthonormal basis with the link's long axis along the tangent
        const ref = Math.abs(tA.dot(worldUp)) > 0.9 ? altUp : worldUp;
        nrm.copy(ref).addScaledVector(tA, -tA.dot(ref)).normalize();
        if (i % 2) nrm.crossVectors(tA, nrm).normalize(); // alternate 90°
        bin.crossVectors(tA, nrm);
        basis.makeBasis(tA, nrm, bin);
        q.setFromRotationMatrix(basis);
        const ls = (cs * (1 - mix) + fit * 0.95 * mix) * Math.min(1, intro * 1.5);
        sc.setScalar(Math.max(ls, 0.0001));
        m4.compose(v1, q, sc);
        ch.mesh.setMatrixAt(i, m4);
      }
      ch.mesh.instanceMatrix.needsUpdate = true;
    });

    // Debris
    for (let i = 0; i < DEB; i++) {
      const dd = debData[i];
      v1.set(
        dd.p.x * halfW + Math.sin(time * dd.v + dd.ph) * 0.3,
        dd.p.y * halfH + ((time * dd.v * 0.12 + dd.ph) % 2 - 1) * 0.4,
        dd.p.z
      );
      e.set(dd.r.x + time * dd.v, dd.r.y + time * dd.v * 0.7, dd.r.z);
      q.setFromEuler(e);
      sc.setScalar(dd.s * fit * (0.6 + 0.4 * introS) * Math.min(1, intro * 2));
      m4.compose(v1, q, sc);
      debris.setMatrixAt(i, m4);
    }
    debris.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  };

  let raf = 0;
  let running = true;
  const loop = () => { if (running) frame(); raf = requestAnimationFrame(loop); };
  loop();
  document.addEventListener('visibilitychange', () => { running = !document.hidden; clock.getDelta(); });

  return {
    setState(s) { Object.assign(target, s); },
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; },
    setVelocity(v) { velocity = Math.max(-80, Math.min(80, v)); },
    get intro() { return cur.intro; },
    set intro(v) { cur.intro = v; },
    snap() { Object.assign(cur, target); },
    resize,
    renderer,
  };
}

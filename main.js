import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { T } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);

const WEBHOOK = 'https://vmi3330209.contaboserver.net/webhook/kemia-website-lead';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 900;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ==========================================================
   Language
   ========================================================== */
// Each language is its own pre-rendered page (/ and /ar/), so the page tells us its language.
const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
// Old links used ?lang=ar on the English page: send them to the Arabic page.
if (lang === 'en' && new URLSearchParams(location.search).get('lang') === 'ar') location.replace('./ar/');

const GOLD_WORDS = ['gold', 'gold.', 'growth.', 'لدهب.', 'النمو.', 'دهب'];

function splitWords(el) {
  const text = el.textContent.trim();
  el.innerHTML = '';
  text.split(/\s+/).forEach((w, i, arr) => {
    const s = document.createElement('span');
    s.className = 'w' + (GOLD_WORDS.includes(w.toLowerCase()) ? ' gold' : '');
    s.textContent = w;
    el.appendChild(s);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

/* ==========================================================
   Smooth scroll
   ========================================================== */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : $(id);
  if (target === null) return;
  e.preventDefault();
  setMenu(false);
  if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -20, duration: 1.6 });
  else (id === '#top' ? window.scrollTo({ top: 0 }) : target.scrollIntoView());
}));

/* ==========================================================
   3D scene (loaded lazily so text paints first)
   ========================================================== */
let scene = null;
const SCENES = {
  hero:      { x: 0.22, y: -0.1, s: 0.8, explode: 0, chain: 0, dark: 0, sweepY: 0 },
  manifesto: { x: 0.6, y: -0.45, s: 0.5, explode: 0.1, chain: 1, dark: 0, sweepY: -0.58 },
  services:  { x: 0.05, y: -0.3, s: 1.0, explode: 0.9, chain: 1, dark: 1, sweepY: -0.45 },
  demo:      { x: 0.1, y: -0.32, s: 0.55, explode: 0.15, chain: 0, dark: 1, sweepY: 0 },
  work:      { x: 0.62, y: 0.5, s: 0.42, explode: 0.2, chain: 0, dark: 0, sweepY: 0 },
  process:   { x: 0.45, y: 0.25, s: 0.52, explode: 0.05, chain: 0, dark: 0, sweepY: 0 },
  faq:       { x: -0.62, y: -0.35, s: 0.5, explode: 0.1, chain: 0, dark: 0, sweepY: 0 },
  contact:   { x: 0.5, y: 0.0, s: 1.1, explode: 0, chain: 0, dark: 1, sweepY: 0 },
  footer:    { x: -0.1, y: -0.15, s: 0.9, explode: 0, chain: 0, dark: 1, sweepY: 0 },
};
// On phones the text fills the width, so the object moves into the gaps.
const MOBILE = {
  hero:      { x: 0.05, y: -0.5, s: 0.9 },
  manifesto: { x: 0.3, y: -0.6, s: 0.8, sweepY: -0.32 },
  services:  { x: 0, y: -0.2, s: 1.2, sweepY: -0.4 },
  demo:      { x: 0.8, y: -0.72, s: 0.6 },
  work:      { x: 0.8, y: -0.72, s: 0.6 },
  process:   { x: -0.8, y: -0.72, s: 0.6 },
  faq:       { x: 0.8, y: -0.72, s: 0.6 },
  contact:   { x: 0.8, y: -0.75, s: 0.65 },
  footer:    { x: 0, y: 0.1, s: 1.2 },
};
let currentScene = 'hero';
const NUM = ['x', 'y', 's', 'explode', 'chain', 'dark', 'sweepY'];
function sceneState(name) {
  const st = isMobile() ? { ...SCENES[name], ...MOBILE[name] } : { ...SCENES[name] };
  if (document.documentElement.dir === 'rtl') st.x = -st.x; // mirror the layout in Arabic
  return st;
}
function setTheme(name) {
  if (name === document.body.dataset.scene) return;
  currentScene = name;
  const s = sceneState(name);
  document.body.dataset.theme = s.dark > 0.5 ? 'dark' : 'light';
  document.body.dataset.scene = name;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', s.dark > 0.5 ? '#0A0A0B' : '#EEECE6');
}

// Every section has a pose for the 3D piece. Around each section boundary the pose blends
// smoothly from one to the next as you scroll (eased, over ~60% of a screen), so the motion
// is tied to the scroll itself instead of jumping when a section edge is crossed.
let stops = [];
function measureStops() {
  const secs = [...$$('[data-scene]'), $('.footer')].filter(Boolean);
  stops = [];
  secs.forEach((el) => {
    const name = el.dataset.scene || 'footer';
    // A section near the bottom (the footer) may never reach the probe line, so its pose is
    // pulled in far enough to be fully reached when the page is scrolled to the end.
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    let top = el.getBoundingClientRect().top + window.scrollY - (name === 'footer' ? window.innerHeight * 0.15 : 0);
    top = Math.min(top, maxScroll + window.innerHeight * 0.25);
    if (stops.length && stops[stops.length - 1].name === name) return; // same pose continues
    stops.push({ name, top });
  });
}
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function updateScene() {
  if (!stops.length) measureStops();
  const vh = window.innerHeight;
  const probe = (lenis ? lenis.scroll : window.scrollY) + vh * 0.55;
  const win = vh * 0.6;
  const st = { ...sceneState(stops[0].name) };
  let name = stops[0].name;
  for (let k = 1; k < stops.length; k++) {
    const t = smooth(Math.min(1, Math.max(0, (probe - (stops[k].top - win / 2)) / win)));
    if (t <= 0) break;
    const next = sceneState(stops[k].name);
    NUM.forEach((key) => { st[key] += (next[key] - st[key]) * t; });
    if (t >= 0.5) name = stops[k].name;
  }
  setTheme(name);
  if (scene) scene.setState(st);
}
function setScene() { updateScene(); }

// Machines without a graphics card render WebGL in software, which is too slow for this
// scene, so they get the page without the 3D (it still looks complete).
function hasRealGPU() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !/swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { return false; }
}

async function initScene() {
  if (!new URLSearchParams(location.search).has('force3d') && !hasRealGPU()) {
    document.documentElement.classList.add('no-webgl');
    return false;
  }
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene($('#gl'), { reduced, mobile: isMobile(), debug: new URLSearchParams(location.search).has('debug3d') });
    setScene(currentScene);
    scene.snap();
    scene.intro = 0;
    window.addEventListener('resize', () => { scene.resize(); measureStops(); updateScene(); });
    // Pointer (mouse or finger) drives the parallax and lets the particles part around it.
    const toScene = (x, y) => scene.setPointer((x / window.innerWidth) * 2 - 1, (y / window.innerHeight) * 2 - 1);
    window.addEventListener('pointermove', (e) => toScene(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) toScene(t.clientX, t.clientY); }, { passive: true });
    window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) toScene(t.clientX, t.clientY); }, { passive: true });
    window.addEventListener('touchend', () => scene.releasePointer(), { passive: true });
    document.documentElement.addEventListener('mouseleave', () => scene.releasePointer());
    if (lenis) lenis.on('scroll', ({ velocity }) => scene.setVelocity(velocity));
    return true;
  } catch (err) {
    console.warn('3D disabled:', err);
    document.documentElement.classList.add('no-webgl');
    return false;
  }
}

/* ==========================================================
   Scroll choreography
   ========================================================== */
function setupScroll() {
  // Section poses blend continuously with the scroll position
  ScrollTrigger.addEventListener('refresh', () => { measureStops(); updateScene(); });
  if (lenis) lenis.on('scroll', updateScene); else window.addEventListener('scroll', updateScene, { passive: true });
  measureStops(); updateScene();

  // Hero: wordmark letters spread and fade as you leave
  gsap.to('.wordmark span', {
    yPercent: (i) => [-10, 14, -18, 10, -6][i], ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
  });
  gsap.to('.hero__grid', {
    yPercent: -30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: 0.6 },
  });

  // Manifesto words light up with scroll
  const words = () => $$('.manifesto__text .w');
  ScrollTrigger.create({
    trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: (self) => {
      const ws = words(); const n = ws.length;
      ws.forEach((w, i) => { w.style.opacity = Math.min(1, Math.max(0.14, (self.progress * n * 1.15 - i) * 0.6 + 0.14)); });
    },
  });

  // Generic reveals
  ScrollTrigger.batch('.h2, .offer, .card, .step, .why__item, .faq details, .demo__points li, .stat, .form, .contact__text, .demo__text, .label', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out', stagger: 0.07, overwrite: true, force3D: true }),
  });
  ScrollTrigger.batch('.el', {
    start: 'top 90%',
    onEnter: (els) => gsap.fromTo(els, { y: 56, opacity: 0 }, { y: 0, opacity: 1, duration: 1.25, ease: 'power3.out', stagger: 0.06, overwrite: true, force3D: true }),
  });
  gsap.fromTo('.contact__title > *', { yPercent: 100, opacity: 0 }, {
    yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.contact', start: 'top 70%' },
  });
  gsap.fromTo('.footer__word', { yPercent: 40 }, {
    yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
  });

  // Counters
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => { const o = { v: 0 }; gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }); },
    });
  });

  // Chat demo plays when visible
  ScrollTrigger.create({ trigger: '[data-chat]', start: 'top 75%', onEnter: () => playChat(), onEnterBack: () => playChat() });
}

/* ==========================================================
   Nav, menu, cursor
   ========================================================== */
const nav = $('.nav');
let lastY = 0;
function onScroll() {
  const y = window.scrollY;
  nav.classList.toggle('is-solid', y > 40);
  nav.classList.toggle('is-hidden', y > 300 && y > lastY && !document.body.classList.contains('menu-open'));
  lastY = y;
}
window.addEventListener('scroll', onScroll, { passive: true });

const menu = $('.menu');
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  $('.nav__burger').setAttribute('aria-expanded', open);
  menu.inert = !open;
  if (lenis) open ? lenis.stop() : lenis.start();
  updateMcta();
}
$('.nav__burger').addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) setMenu(false); });

/* Phones: a "Start a project" bar that stays on screen, except while the hero
   buttons or the contact form are already in view. */
const mcta = $('[data-mcta]');
const seen = { hero: true, contact: false, footer: false };
function updateMcta() {
  const show = isMobile() && !seen.hero && !seen.contact && !seen.footer && !document.body.classList.contains('menu-open');
  mcta.classList.toggle('is-on', show);
  mcta.tabIndex = show ? 0 : -1;
}
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { seen[en.target.dataset.watch] = en.isIntersecting; });
    updateMcta();
  });
  [['.hero__ctas', 'hero'], ['#contact', 'contact'], ['.footer', 'footer']].forEach(([sel, key]) => {
    const el = $(sel); el.dataset.watch = key; io.observe(el);
  });
}
window.addEventListener('resize', updateMcta);

const cursor = $('.cursor');
const cursorLabel = $('.cursor__label');
function bindCursorTargets() {
  if (isTouch) return;
  $$('[data-cursor], a, button, summary, .chip').forEach((el) => {
    if (el.dataset.cursorBound) return;
    el.dataset.cursorBound = '1';
    el.addEventListener('pointerenter', () => {
      cursor.classList.add('is-hover');
      cursorLabel.textContent = el.dataset.cursor || '';
      cursor.querySelector('i').style.opacity = el.dataset.cursor ? '1' : '.9';
    });
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
  });
}
if (!isTouch) {
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });

  // Magnetic buttons
  $$('.btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.18, y: (e.clientY - r.top - r.height / 2) * 0.28, duration: 0.4, ease: 'power3.out' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, .4)' }));
  });
}

/* ==========================================================
   Wordmark fitting
   ========================================================== */
let wordWidth = 0;
function fitWordmark() {
  const fontIn = !document.fonts || document.fonts.check('900 100px "Archivo Variable"', 'KEMIA');
  if (!wordWidth || !fontIn) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:900 100px "Archivo Variable",sans-serif;font-stretch:125%;letter-spacing:-.05em';
    probe.textContent = 'KEMIA';
    document.body.appendChild(probe);
    wordWidth = probe.getBoundingClientRect().width;
    probe.remove();
  }
  if (!wordWidth) return;
  [['.wordmark', 1.0], ['.footer__word', 0.98]].forEach(([sel, k]) => {
    const el = $(sel); if (!el) return;
    el.style.fontSize = `${Math.floor(((el.parentElement.clientWidth * k) / wordWidth) * 100)}px`;
  });
}
window.addEventListener('resize', () => { fitWordmark(); });

/* ==========================================================
   WhatsApp demo
   ========================================================== */
const CHATS = {
  en: [
    { me: true, t: 'Hi, I’d like to book a dental check-up', at: '17:02' },
    { me: false, t: 'Hi there 👋 Happy to help! Which day works for you?', at: '17:02' },
    { me: true, t: 'Tomorrow afternoon if possible', at: '17:03' },
    { me: false, t: 'Tomorrow we have 4:00, 5:30 or 7:00 PM. Which one suits you?', at: '17:03' },
    { me: true, t: '5:30 works', at: '17:03' },
    { me: false, t: 'Done ✅ You’re booked for tomorrow at 5:30 PM. I’ll send you a reminder an hour before.', at: '17:03' },
  ],
  ar: [
    { me: true, t: 'السلام عليكم، عايز أحجز كشف أسنان', at: '17:02' },
    { me: false, t: 'وعليكم السلام 👋 أهلًا بيك! تحب الكشف يوم إيه؟', at: '17:02' },
    { me: true, t: 'بكرة بعد الضهر لو ينفع', at: '17:03' },
    { me: false, t: 'بكرة متاح 4:00 أو 5:30 أو 7:00 بالليل. أنهي ميعاد يناسبك؟', at: '17:03' },
    { me: true, t: '5:30 تمام', at: '17:03' },
    { me: false, t: 'تمام ✅ حجزتلك كشف بكرة الساعة 5:30، وهبعتلك تذكير قبلها بساعة.', at: '17:03' },
  ],
};
const CHAT = CHATS[lang] || CHATS.en;
let chatTl = null;
function playChat() {
  if (chatTl && chatTl.isActive()) return;
  const body = $('[data-chat-body]');
  const saved = $('.phone__saved');
  body.innerHTML = '';
  saved.classList.remove('show');
  chatTl = gsap.timeline();
  let t = 0.3;
  CHAT.forEach((m) => {
    if (!m.me) {
      chatTl.call(() => {
        const ty = document.createElement('div');
        ty.className = 'msg msg--them typing';
        ty.innerHTML = '<span></span><span></span><span></span>';
        body.appendChild(ty);
        requestAnimationFrame(() => ty.classList.add('in'));
      }, null, t);
      t += reduced ? 0.2 : 1.1;
    }
    chatTl.call(() => {
      const ty = body.querySelector('.typing'); if (ty) ty.remove();
      const el = document.createElement('div');
      el.className = `msg ${m.me ? 'msg--me' : 'msg--them'}`;
      el.innerHTML = `${m.t}<small>${m.at}${m.me ? ' ✓✓' : ''}</small>`;
      body.appendChild(el);
      requestAnimationFrame(() => el.classList.add('in'));
    }, null, t);
    t += reduced ? 0.2 : (m.me ? 1.0 : 0.9);
  });
  chatTl.call(() => saved.classList.add('show'), null, t + 0.2);
}

/* ==========================================================
   Contact form -> n8n webhook
   ========================================================== */
const form = $('[data-form]');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = T[lang];
  const status = $('.form__status');
  const fd = new FormData(form);
  if (fd.get('website')) return; // bot honeypot
  const name = (fd.get('name') || '').trim();
  const phone = (fd.get('phone') || '').trim();
  $$('.field', form).forEach((f) => f.classList.remove('is-error'));
  if (!name || phone.replace(/\D/g, '').length < 8) {
    if (!name) form.name.closest('.field').classList.add('is-error');
    if (phone.replace(/\D/g, '').length < 8) form.phone.closest('.field').classList.add('is-error');
    status.className = 'form__status err';
    status.textContent = t['form.required'];
    return;
  }
  const btn = form.querySelector('button[type=submit]');
  const label = btn.querySelector('span');
  btn.disabled = true;
  label.textContent = t['form.sending'];
  status.className = 'form__status';
  status.textContent = '';
  const payload = {
    name,
    business: (fd.get('business') || '').trim(),
    phone,
    email: (fd.get('email') || '').trim(),
    services: fd.getAll('services').map((k) => T.en[`svc.${k}.name`]).join(', '),
    message: (fd.get('message') || '').trim(),
    language: lang,
    page: location.href.split('?')[0],
    submittedAt: new Date().toISOString(),
  };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(WEBHOOK, {
      // Form-encoded keeps this a "simple" CORS request (no preflight) and n8n parses it natively.
      method: 'POST', body: new URLSearchParams(payload), signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.status);
    form.reset();
    status.className = 'form__status ok';
    status.textContent = t['form.ok'];
    gsap.fromTo(status, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 });
  } catch (err) {
    status.className = 'form__status err';
    status.textContent = t['form.err'];
  } finally {
    btn.disabled = false;
    label.textContent = t['form.send'];
  }
});

/* ==========================================================
   Boot: loader -> intro
   ========================================================== */
async function boot() {
  splitWords($('.manifesto__text'));
  bindCursorTargets();
  const pct = $('.loader__pct');
  const bar = $('.loader__bar i');
  const prog = { v: 0 };
  gsap.to(prog, {
    v: 90, duration: 0.9, ease: 'power2.out',
    onUpdate: () => { pct.textContent = Math.round(prog.v); bar.style.width = `${prog.v}%`; },
  });
  // Reveal as soon as the fonts are in (never wait more than ~1s); the 3D loads alongside.
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const wordFont = document.fonts ? document.fonts.load('900 100px "Archivo Variable"', 'KEMIA') : Promise.resolve();
  await Promise.race([Promise.all([document.fonts ? document.fonts.ready : null, wordFont]), timeout(1000)]);
  // If the display font arrives after the reveal, re-fit the wordmarks once it does.
  wordFont.then(() => { wordWidth = 0; fitWordmark(); }).catch(() => {});
  fitWordmark();
  pct.textContent = '100'; bar.style.width = '100%';

  setupScroll();
  setScene('hero');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: reduced ? 0.2 : 0.8, ease: 'expo.inOut' }, 0)
    .add(() => { document.body.classList.remove('is-loading'); $('.loader').style.display = 'none'; if (lenis) lenis.start(); })
    .from('.wordmark span', { yPercent: 110, duration: 1.3, stagger: 0.05 }, 0.3)
    .from('.hero__title .line > *', { yPercent: 110, duration: 1.2, stagger: 0.08 }, 0.4)
    .from('.kicker, .hero__sub, .hero__ctas, .hero__stat > *, .hero__meta, .nav > *', { y: 24, opacity: 0, duration: 1, stagger: 0.04 }, 0.55);
  // The 3D starts once the page is showing, so building it never delays the first paint.
  tl.add(() => {
    // Wait two frames so the revealed page paints before the 3D compiles its shaders.
    requestAnimationFrame(() => requestAnimationFrame(async () => {
      const ok = await initScene();
      if (ok && scene) gsap.to(scene, { intro: 1, duration: reduced ? 0.2 : 2.2, ease: 'power3.out' });
    }));
  }, reduced ? 0.25 : 0.85);
}

boot();

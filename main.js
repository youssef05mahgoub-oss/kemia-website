import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { T, SERVICES } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);

const WEBHOOK = 'https://vmi3330209.contaboserver.net/webhook/kemia-website-lead';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
const isMobile = () => window.innerWidth < 900;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/* ==========================================================
   Language
   ========================================================== */
const params = new URLSearchParams(location.search);
let lang = params.get('lang') || store.get('kemia-lang') || ((navigator.language || '').startsWith('ar') ? 'ar' : 'en');
if (!T[lang]) lang = 'en';

const GOLD_WORDS = ['gold', 'gold.', 'growth.', 'لدهب.', 'النمو.', 'دهب'];

function splitWords(el, text) {
  el.innerHTML = '';
  text.split(/\s+/).forEach((w, i, arr) => {
    const s = document.createElement('span');
    s.className = 'w' + (GOLD_WORDS.includes(w.toLowerCase()) ? ' gold' : '');
    s.textContent = w;
    el.appendChild(s);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}

function renderServices() {
  const t = T[lang];
  $('[data-services]').innerHTML = SERVICES.map((s) => `
    <article class="el" tabindex="0" data-cursor="${lang === 'ar' ? 'اكتشف' : 'Formula'}">
      <div class="el__top"><span class="el__n">${s.n}</span><span>${t[`svc.${s.key}.tags`].split('·')[0].trim()}</span></div>
      <div class="el__sym">${s.sym}</div>
      <h3 class="el__name">${t[`svc.${s.key}.name`]}</h3>
      <p class="el__line">${t[`svc.${s.key}.line`]}</p>
      <div class="el__more"><p>${t[`svc.${s.key}.desc`]}</p><span class="el__tags">${t[`svc.${s.key}.tags`]}</span></div>
    </article>`).join('');
  const checked = new Set($$('[data-chips] input:checked').map((i) => i.value));
  $('[data-chips]').innerHTML = SERVICES.map((s) => `
    <label class="chip"><input type="checkbox" name="services" value="${s.key}" ${checked.has(s.key) ? 'checked' : ''}/><span><b>${s.sym}</b>${t[`svc.${s.key}.name`]}</span></label>`).join('');
}

function applyLang(next) {
  lang = next;
  const t = T[lang];
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t['meta.title'];
  $$('[data-i18n]').forEach((el) => {
    const v = t[el.dataset.i18n];
    if (v == null) return;
    if (el.classList.contains('split-words')) splitWords(el, v);
    else el.textContent = v;
  });
  renderServices();
  bindCursorTargets();
  store.set('kemia-lang', lang);
  try {
    const u = new URL(location.href);
    if (lang === 'ar') u.searchParams.set('lang', 'ar'); else u.searchParams.delete('lang');
    history.replaceState(null, '', u);
  } catch { /* sandboxed previews */ }
}

/* ==========================================================
   Smooth scroll
   ========================================================== */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
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
  document.body.classList.remove('menu-open');
  if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -20, duration: 1.6 });
  else (id === '#top' ? window.scrollTo({ top: 0 }) : target.scrollIntoView());
}));

/* ==========================================================
   3D scene (loaded lazily so text paints first)
   ========================================================== */
let scene = null;
const SCENES = {
  hero:      { x: 0.2, y: -0.1, s: 0.78, explode: 0, chain: 0, dark: 0, sweepY: 0 },
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
  manifesto: { x: 0.3, y: -0.6, s: 0.8, sweepY: -0.6 },
  services:  { x: 0, y: -0.2, s: 1.2, sweepY: -0.4 },
  demo:      { x: 0.8, y: -0.72, s: 0.6 },
  work:      { x: 0.8, y: -0.72, s: 0.6 },
  process:   { x: -0.8, y: -0.72, s: 0.6 },
  faq:       { x: 0.8, y: -0.72, s: 0.6 },
  contact:   { x: 0.8, y: -0.75, s: 0.65 },
  footer:    { x: 0, y: 0.1, s: 1.2 },
};
let currentScene = 'hero';
function sceneState(name) {
  const st = isMobile() ? { ...SCENES[name], ...MOBILE[name] } : { ...SCENES[name] };
  if (document.documentElement.dir === 'rtl') st.x = -st.x; // mirror the layout in Arabic
  return st;
}
function setScene(name) {
  currentScene = name;
  const s = sceneState(name);
  document.body.dataset.theme = s.dark > 0.5 ? 'dark' : 'light';
  document.body.dataset.scene = name;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', s.dark > 0.5 ? '#0A0A0B' : '#EEECE6');
  if (scene) scene.setState(s);
}

async function initScene() {
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene($('#gl'), { reduced, mobile: isMobile() });
    scene.setState(sceneState(currentScene));
    scene.snap();
    scene.intro = 0;
    window.addEventListener('resize', () => { scene.resize(); scene.setState(sceneState(currentScene)); });
    if (!isTouch) {
      window.addEventListener('pointermove', (e) => {
        scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      }, { passive: true });
    }
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
  // Section -> scene state
  $$('[data-scene]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) setScene(sec.dataset.scene); },
    });
  });
  ScrollTrigger.create({
    trigger: '.footer', start: 'top 70%', end: 'bottom top',
    onToggle: (self) => { if (self.isActive) setScene('footer'); },
  });

  // Hero: wordmark letters spread and fade as you leave
  gsap.to('.wordmark span', {
    yPercent: (i) => [-10, 14, -18, 10, -6][i], ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__grid', {
    yPercent: -30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true },
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
  ScrollTrigger.batch('.h2, .card, .step, .why__item, .faq details, .demo__points li, .stat, .form, .contact__text, .demo__text, .label', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
  ScrollTrigger.batch('.el', {
    start: 'top 90%',
    onEnter: (els) => gsap.fromTo(els, { y: 80, opacity: 0, rotateX: -18 }, { y: 0, opacity: 1, rotateX: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07, overwrite: true }),
  });
  gsap.fromTo('.contact__title > *', { yPercent: 100, opacity: 0 }, {
    yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: '.contact', start: 'top 70%' },
  });
  gsap.fromTo('.footer__word', { yPercent: 40 }, {
    yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
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

$('.nav__burger').addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  $('.nav__burger').setAttribute('aria-expanded', open);
  $('.menu').setAttribute('aria-hidden', !open);
  if (lenis) open ? lenis.stop() : lenis.start();
});

$$('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => {
  const next = lang === 'en' ? 'ar' : 'en';
  gsap.to('main, .footer', {
    opacity: 0, duration: 0.25, onComplete: () => {
      applyLang(next);
      document.body.classList.remove('menu-open');
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
      fitWordmark();
      setScene(currentScene);
      gsap.to('main, .footer', { opacity: 1, duration: 0.4 });
      // manifesto words: re-apply current progress
      ScrollTrigger.getAll().forEach((st) => st.update && st.update());
    },
  });
}));

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
function fitWordmark() {
  ['.wordmark', '.footer__word'].forEach((sel) => {
    const el = $(sel); if (!el) return;
    el.style.fontSize = '100px';
    const w = el.scrollWidth;
    const avail = el.parentElement.clientWidth * (sel === '.wordmark' ? 1.0 : 0.98);
    // measure natural text width with inline-flex
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:900 100px "Archivo Variable",sans-serif;font-stretch:125%;letter-spacing:-.05em';
    probe.textContent = 'KEMIA';
    document.body.appendChild(probe);
    const natural = probe.getBoundingClientRect().width || w;
    probe.remove();
    el.style.fontSize = `${Math.floor((avail / natural) * 100)}px`;
  });
}

/* ==========================================================
   WhatsApp demo
   ========================================================== */
const CHAT = [
  { me: true, t: 'السلام عليكم، عايز أحجز كشف أسنان', at: '17:02' },
  { me: false, t: 'وعليكم السلام 👋 أهلاً بيك! تحب الكشف يوم إيه؟', at: '17:02' },
  { me: true, t: 'بكرة بعد الضهر لو ينفع', at: '17:03' },
  { me: false, t: 'بكرة متاح ٤:٠٠ أو ٥:٣٠ أو ٧:٠٠ مساءً. أنهي ميعاد يناسبك؟', at: '17:03' },
  { me: true, t: '٥:٣٠ تمام', at: '17:03' },
  { me: false, t: 'تمام ✅ حجزتلك كشف بكرة الساعة ٥:٣٠ مساءً، وهبعتلك تذكير قبلها بساعة.', at: '17:03' },
];
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
  applyLang(lang);
  fitWordmark();
  const pct = $('.loader__pct');
  const bar = $('.loader__bar i');
  const prog = { v: 0 };
  const counting = gsap.to(prog, {
    v: 92, duration: reduced ? 0.2 : 1.6, ease: 'power2.inOut',
    onUpdate: () => { pct.textContent = Math.round(prog.v); bar.style.width = `${prog.v}%`; },
  });
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  const [hasGL] = await Promise.all([fontsReady.then(initScene), counting]);
  fitWordmark();
  pct.textContent = '100'; bar.style.width = '100%';

  setupScroll();
  setScene('hero');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: reduced ? 0.2 : 1.1, ease: 'expo.inOut' }, 0.15)
    .add(() => { document.body.classList.remove('is-loading'); $('.loader').style.display = 'none'; if (lenis) lenis.start(); })
    .from('.wordmark span', { yPercent: 110, duration: 1.4, stagger: 0.06 }, 0.55)
    .from('.hero__title .line > *', { yPercent: 110, duration: 1.3, stagger: 0.09 }, 0.7)
    .from('.kicker, .hero__sub, .hero__ctas, .hero__stat > *, .hero__meta, .nav > *', { y: 24, opacity: 0, duration: 1.1, stagger: 0.04 }, 0.9);
  if (hasGL && scene) tl.to(scene, { intro: 1, duration: reduced ? 0.2 : 2.4, ease: 'power3.out' }, 0.45);
}

boot();

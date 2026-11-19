import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { T } from './i18n.js';
import { esc, servicesHTML, chipsHTML, headHTML, robotsTxt, sitemapXml } from './render.js';

// Fills every [data-i18n] element, the service tiles and the <head> for one language,
// so search engines (and visitors without JavaScript) get the full text of each page.
function localize(html, lang) {
  const t = T[lang];
  html = html.replace(/<html lang="[^"]*" dir="[^"]*">/, `<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">`);
  html = html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, `<!--seo-->${headHTML(lang)}<!--/seo-->`);
  html = html.replace(/(<!--svc-->)[\s\S]*?(<!--\/svc-->)/, `$1${servicesHTML(lang)}$2`);
  html = html.replace(/(<!--chips-->)[\s\S]*?(<!--\/chips-->)/, `$1${chipsHTML(lang)}$2`);
  html = html.replace(/(<([a-z0-9]+)\b[^>]*?\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g,
    (m, open, tag, key, inner, close) => (t[key] == null ? m : open + esc(t[key]) + close));
  html = html.replace(/(\bdata-i18n-label="([^"]+)"\s+aria-label=")[^"]*"/g, (m, pre, key) => `${pre}${esc(t[key])}"`);
  return html;
}

function kemiaPages() {
  return {
    name: 'kemia-pages',
    enforce: 'post',
    transformIndexHtml: { order: 'pre', handler: (html) => localize(html, 'en') },
    generateBundle: { order: 'post', handler(_, bundle) {
      const en = bundle['index.html'];
      // Arabic page lives one folder down, so every relative URL gains a "../".
      let ar = localize(String(en.source), 'ar')
        .replace(/(href|src|content)="\.\/(?!ar\/)/g, '$1="../')
        .replace(/href="\.\.\/ar\/" hreflang="ar"/g, 'href="../" hreflang="en"')
        .replace(/href="\.\/ar\/" hreflang="ar"/g, 'href="../" hreflang="en"');
      this.emitFile({ type: 'asset', fileName: 'ar/index.html', source: ar });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(new Date().toISOString().slice(0, 10)) });
      for (const f of ['apple-touch-icon.png', 'kemia-logo.svg', 'kemia-mark.svg', 'favicon.svg']) {
        if (existsSync(f)) this.emitFile({ type: 'asset', fileName: f, source: readFileSync(f) });
      }
    } },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [kemiaPages()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], motion: ['gsap', 'lenis'] },
      },
    },
  },
});

// Markup shared by the build (pre-rendering both language pages) and the browser.
import { T, SERVICES } from './i18n.js';

// Public address of the site. Change this one line when the custom domain is connected.
export const SITE = 'https://youssef05mahgoub-oss.github.io/kemia-website/';

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function servicesHTML(lang) {
  const t = T[lang];
  return SERVICES.map((s) => `
      <article class="el" tabindex="0" data-cursor="${lang === 'ar' ? 'اكتشف' : 'Formula'}">
        <div class="el__top"><span class="el__n">${s.n}</span><span>${esc(t[`svc.${s.key}.tags`].split('·')[0].trim())}</span></div>
        <div class="el__sym" aria-hidden="true">${s.sym}</div>
        <h3 class="el__name">${esc(t[`svc.${s.key}.name`])}</h3>
        <p class="el__line">${esc(t[`svc.${s.key}.line`])}</p>
        <div class="el__more"><p>${esc(t[`svc.${s.key}.desc`])}</p><span class="el__tags">${esc(t[`svc.${s.key}.tags`])}</span></div>
      </article>`).join('') + '\n    ';
}

export function chipsHTML(lang) {
  const t = T[lang];
  return SERVICES.map((s) => `
            <label class="chip"><input type="checkbox" name="services" value="${s.key}" /><span><b>${s.sym}</b>${esc(t[`svc.${s.key}.name`])}</span></label>`).join('') + '\n          ';
}

export const pageUrl = (lang) => (lang === 'ar' ? `${SITE}ar/` : SITE);

// Everything in <head> that changes per language: title, description, canonical,
// hreflang alternates, social cards and structured data for search engines.
export function headHTML(lang) {
  const t = T[lang];
  const url = pageUrl(lang);
  const faq = [1, 2, 3, 4, 5].map((i) => ({
    '@type': 'Question',
    name: t[`faq.${i}.q`],
    acceptedAnswer: { '@type': 'Answer', text: t[`faq.${i}.a`] },
  }));
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': `${SITE}#organization`,
        name: 'KEMIA',
        alternateName: 'كيميا',
        url: SITE,
        logo: `${SITE}kemia-logo.svg`,
        image: `${SITE}og.jpg`,
        description: t['meta.desc'],
        slogan: lang === 'ar' ? 'بنحوّل الروتين لدهب.' : 'We turn busywork into gold.',
        address: { '@type': 'PostalAddress', addressLocality: 'Cairo', addressCountry: 'EG' },
        areaServed: { '@type': 'Country', name: 'Egypt' },
        knowsLanguage: ['ar', 'en'],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: t['svc.label'].replace(/[()]/g, '').trim(),
          itemListElement: [
            {
              '@type': 'Offer', price: '0', priceCurrency: 'EGP',
              itemOffered: { '@type': 'Service', name: t['offer.cta'], description: t['offer.text'] },
            },
            ...SERVICES.map((s) => ({
              '@type': 'Offer',
              itemOffered: { '@type': 'Service', name: t[`svc.${s.key}.name`], description: t[`svc.${s.key}.desc`] },
            })),
          ],
        },
      },
      { '@type': 'WebSite', '@id': `${SITE}#website`, url: SITE, name: 'KEMIA', inLanguage: ['en', 'ar'], publisher: { '@id': `${SITE}#organization` } },
      { '@type': 'FAQPage', '@id': `${url}#faq`, url, inLanguage: lang, mainEntity: faq },
    ],
  };
  return `<title>${esc(t['meta.title'])}</title>
  <meta name="description" content="${esc(t['meta.desc'])}" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${SITE}" />
  <link rel="alternate" hreflang="ar" href="${SITE}ar/" />
  <link rel="alternate" hreflang="x-default" href="${SITE}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="KEMIA" />
  <meta property="og:locale" content="${lang === 'ar' ? 'ar_EG' : 'en_US'}" />
  <meta property="og:locale:alternate" content="${lang === 'ar' ? 'en_US' : 'ar_EG'}" />
  <meta property="og:title" content="${esc(t['meta.ogTitle'])}" />
  <meta property="og:description" content="${esc(t['meta.ogDesc'])}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${SITE}og.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`;
}

export function sitemapXml(date) {
  const entry = (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${date}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}" />
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE}ar/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}" />
  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entry(SITE)}
${entry(`${SITE}ar/`)}
</urlset>
`;
}

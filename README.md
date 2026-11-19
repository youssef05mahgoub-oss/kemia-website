# KEMIA — website

Bilingual (English / Egyptian Arabic) 3D website for KEMIA, an AI studio in Cairo.

- **Stack:** Vite, Three.js (3D scene), GSAP + ScrollTrigger (scroll choreography), Lenis (smooth scroll), self-hosted fonts (Fontsource).
- **Languages:** two pre-rendered pages, English at `/` and Arabic at `/ar/`, linked with hreflang. All copy lives in `i18n.js`; the build (`vite.config.js` + `render.js`) writes it into the HTML so search engines see every word.
- **SEO files:** the build also writes `robots.txt`, `sitemap.xml`, canonical tags and structured data (business + FAQ). Change `SITE` in `render.js` when the custom domain is connected.
- **3D:** skipped on machines with no graphics card (software WebGL). Add `?force3d` to the URL to force it, e.g. for screenshots.
- **Contact form:** posts to the n8n webhook in `main.js` (`WEBHOOK`), which appends a row to the "KEMIA — Website leads" Google Sheet.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
```

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure; every text element has a `data-i18n` key |
| `i18n.js` | English + Arabic copy and the list of services |
| `style.css` | Brand tokens, layout, responsive and RTL rules |
| `scene.js` | The 3D "philosopher's stone": chrome core, keycap ring, chains, debris |
| `render.js` | Builds the service tiles, form chips, `<head>` tags, robots.txt and sitemap for each language |
| `main.js` | Loader, smooth scroll, section → 3D states, language switch, chat demo, form |
| `kemia-logo.svg`, `kemia-mark.svg`, `favicon.svg` | Logo, mark and browser icon |
| `og.mjs` | Renders the social share image (`og.jpg`) from the live hero during deploy |
| `.github/workflows/deploy.yml` | Builds and publishes to GitHub Pages on every push to `main` |

## Brand

| Token | Hex |
| --- | --- |
| Paper | `#EEECE6` |
| Ink | `#0C0C0D` |
| Molten (accent) | `#FF4A1C` |
| Gold | `#D8A93B` |
| Elixir (glow) | `#8AF5FF` |

Type: Archivo (display, variable width), Manrope (body), JetBrains Mono (labels), Alexandria + IBM Plex Sans Arabic (Arabic).

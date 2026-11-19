// Renders the social share image (dist/og.jpg) from the built site's hero.
// Run after `vite build` with `vite preview` serving on port 4173.
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
await page.addStyleTag({ content: '.nav,.hero__meta,.cursor{display:none!important}' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'dist/og.jpg', type: 'jpeg', quality: 85 });
await browser.close();
console.log('og.jpg written');

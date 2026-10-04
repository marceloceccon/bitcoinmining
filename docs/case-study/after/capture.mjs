// Captures the "after" screenshots: node docs/case-study/after/capture.mjs [baseUrl]
// Needs @playwright/test (a dev dependency) and a running build.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3300';
const OUT = path.dirname(new URL(import.meta.url).pathname);
const TABS = [
  ['build', ''],
  ['compare-miners', '?tab=compare'],
  ['energy', '?tab=energy'],
  ['deploy-and-labor', '?tab=labor'],
  ['thermal', '?tab=temperature'],
  ['projections', '?tab=forecast'],
];

const browser = await chromium.launch();
for (const [w, h, dsf, mobile, scheme] of [[1440, 900, 1, false, 'dark'], [1440, 900, 1, false, 'light'], [390, 844, 2, true, 'dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
  const page = await ctx.newPage();
  const prefix = `${w}-${scheme}`;
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${prefix}-landing.png` });
  for (const [slug, q] of TABS) {
    await page.goto(BASE + '/' + q, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${prefix}-${slug}.png`, fullPage: true });
  }
  await page.goto(BASE + '/methodology', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/${prefix}-methodology.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length, 'screenshots in', OUT);

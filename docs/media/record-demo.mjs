// Records the ~30 s demo clip: node docs/media/record-demo.mjs [baseUrl] [outDir]
// 1) presets morph the live schematic, 2) a pin in West Texas vs northern Norway
// changes the dry-cooler count, 3) Projections: break-even BTC price vs live price.
// Needs @playwright/test, a running build, and network access (Nominatim, Open-Meteo).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:3300';
const OUT = process.argv[3] ?? path.dirname(new URL(import.meta.url).pathname);
const W = 1280;
const H = 960;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  colorScheme: 'dark',
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const preset = (name) => page.getByRole('button', { name: new RegExp(`^${name}.+`) });

async function pin(query) {
  await page.getByRole('button', { name: 'Choose Location' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose Location' });
  await dialog.getByLabel('Search for a place').pressSequentially(query, { delay: 45 });
  await dialog.getByRole('option').first().click({ timeout: 15000 });
  await dialog.getByRole('button', { name: 'Confirm location' }).click({ timeout: 30000 });
  await pause(2200);
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await pause(1800);

// 1. Presets morph the schematic (hero stays in view)
for (const name of ['Home Miner', 'Garage Setup', 'Industrial']) {
  await preset(name).click();
  await pause(1600);
}

// 2. Thermal: Texas vs Norway for the hydro Industrial farm
await page.getByRole('tab', { name: 'Thermal' }).click();
await pause(800);
await pin('Midland, Texas');
await page.mouse.wheel(0, 260);
await pause(1800);
await page.mouse.wheel(0, -260);
await pin('Tromsø, Norway');
await page.mouse.wheel(0, 260);
await pause(1800);

// 3. Projections: break-even vs live price, then the bull scenario
await page.getByRole('tab', { name: 'Projections' }).click();
await pause(1200);
await page.getByText('Break-even BTC price', { exact: false }).first().scrollIntoViewIfNeeded();
await page.mouse.wheel(0, -120);
await pause(2200);
await page.getByRole('button', { name: 'Bull +30%/yr' }).click();
await pause(2400);

const video = page.video();
await ctx.close();
await browser.close();
const raw = await video.path();
fs.renameSync(raw, path.join(OUT, 'demo-raw.webm'));
console.log('recorded', path.join(OUT, 'demo-raw.webm'));

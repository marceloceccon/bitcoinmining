import { expect, test, type Page } from '@playwright/test';

const TABS = [
  { label: 'Build', heading: 'Miner Database' },
  { label: 'Energy', heading: 'Regional Settings' },
  { label: 'Deploy & Labor', heading: 'Deployment Labor Costs' },
  { label: 'Thermal', heading: 'Site Location & Climate' },
  { label: 'Projections', heading: 'Forecast Parameters' },
];

const PRESETS = ['Home Miner', 'Garage Setup', 'Small Farm', 'Industrial'];

/** Third-party noise that says nothing about our app (analytics is only served on Vercel). */
const IGNORED_ERRORS = [/\/_vercel\/insights/, /tile\.openstreetmap\.org/];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = `${msg.text()} ${msg.location().url}`;
    if (!IGNORED_ERRORS.some((re) => re.test(text))) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

// Every test is its own "visitor": the API rate limiter buckets by client IP, and a
// whole suite sharing one IP would exhaust the first-party bucket (600/min).
test.beforeEach(async ({ page }) => {
  const octet = () => Math.floor(Math.random() * 256);
  await page.setExtraHTTPHeaders({ 'x-real-ip': `10.${octet()}.${octet()}.${octet()}` });
});

/** A preset card (its accessible name is the preset name followed by its description). */
function presetButton(page: Page, name: string) {
  return page.getByRole('button', { name: new RegExp(`^${name}.+`) });
}

function tab(page: Page, label: string) {
  return page.getByRole('tab', { name: label });
}

/** The headline figures above the workbench (visible at every width). */
function summary(page: Page) {
  return page.getByRole('region', { name: 'Farm summary' });
}

test('loads without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // A fresh visit opens on the Small Farm preset, not an empty farm.
  await expect(summary(page)).toContainText('27.00 PH/s');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

for (const preset of PRESETS) {
  test(`preset "${preset}" renders metrics`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await presetButton(page, preset).click();
    await expect(page.getByRole('heading', { name: 'Farm Configuration' })).toBeVisible();
    await expect(summary(page)).not.toContainText('0.00 TH/s');
    expect(errors).toEqual([]);
  });
}

test('every tab renders', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await presetButton(page, 'Small Farm').click();
  for (const { label, heading } of TABS) {
    await tab(page, label).click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('map modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Thermal').click();
  await page.getByRole('button', { name: 'Choose Location' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose Location' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('calculations run in the browser: the UI only fetches the market snapshot', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith('/api/')) apiCalls.push(`${req.method()} ${url.pathname}`);
  });
  await page.goto('/');
  await presetButton(page, 'Industrial').click();
  await expect(page.getByRole('heading', { name: 'Farm Configuration' })).toBeVisible();
  await tab(page, 'Projections').click();
  await expect(page.getByRole('heading', { name: 'Forecast Parameters' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect([...new Set(apiCalls)]).toEqual(['GET /api/network']);
});

test('tabs are keyboard-operable and deep-linkable', async ({ page }) => {
  await page.goto('/?tab=forecast');
  await expect(tab(page, 'Projections')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Projections').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'Thermal')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\?tab=temperature/);
  await expect(page.getByRole('heading', { name: 'Site Location & Climate' })).toBeVisible();
});

test('the methodology page renders', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/methodology');
  await expect(page.getByRole('heading', { level: 1, name: 'How MineForge works' })).toBeVisible();
  expect(errors).toEqual([]);
});

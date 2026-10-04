import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.1 A/AA checks in every theme/viewport project. Leaflet's own map
// controls and third-party tiles are excluded from the scan.
const PAGES = [
  { name: 'calculator (Build)', path: '/' },
  { name: 'Compare miners', path: '/?tab=compare' },
  { name: 'Energy', path: '/?tab=energy' },
  { name: 'Deploy & Labor', path: '/?tab=labor' },
  { name: 'Thermal', path: '/?tab=temperature' },
  { name: 'Projections', path: '/?tab=forecast' },
  { name: 'Methodology', path: '/methodology' },
  { name: 'MCP', path: '/mcp' },
];

for (const { name, path } of PAGES) {
  test(`${name} has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600); // let tab transitions settle
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.leaflet-container')
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

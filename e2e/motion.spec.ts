import { expect, test } from '@playwright/test';

test('with reduced motion, nothing animates: no running CSS animations on the schematic', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion', 'reduced-motion project only');
  await page.goto('/');
  await expect(page.getByRole('img', { name: /Farm schematic/ })).toBeVisible();
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running' && (a as CSSAnimation).animationName?.startsWith('schematic')).length,
  );
  expect(running).toBe(0);
});

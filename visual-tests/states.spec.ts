import { test, expect } from '@playwright/test';
import { scenarios } from '../src/lab/scenarios';

for (const theme of ['light', 'dark']) {
  for (const scenario of scenarios) {
    test(`${scenario.id} / ${theme}`, async ({ page }) => {
      await page.goto(`/lab-frame.html?scenario=${scenario.id}&theme=${theme}&motion=reduce`);
      if (['short', 'long'].includes(scenario.id)) await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
      else if (['error', 'partial'].includes(scenario.id)) await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'error');
      else if (scenario.id === 'pending') await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
      else if (scenario.id === 'capsule') await expect(page.locator('.capsule')).toBeVisible();
      else if (scenario.id === 'notice') await expect(page.locator('.notice-pill')).toHaveText('Rien à traduire dans la fenêtre active.');
      else await expect(page.getByRole('heading', { name: 'Traduction', exact: true })).toBeVisible();
      if (scenario.id === 'history') await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
      await expect(page).toHaveScreenshot(`${scenario.id}-${theme}.png`);
      if (scenario.id === 'short') {
        await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
        await expect(page.getByRole('menu')).toBeVisible();
        await expect(page).toHaveScreenshot(`menu-${theme}.png`);
      }
    });
  }
}
// The reader band on Lucas's screens: half of 1920 and of 2560, 22/33, 45 % of the height at most.
for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
  test(`reader on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(`/lab-frame.html?scenario=long&theme=dark&motion=reduce`);
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
    await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${width / 2}px`);
    await expect(page).toHaveScreenshot(`reader-${width}.png`);
  });
}
test('settings at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 640 });
  await page.goto('/lab-frame.html?scenario=settings&motion=reduce');
  await expect(page.getByRole('heading', { name: 'Traduction', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('settings-narrow.png');
});

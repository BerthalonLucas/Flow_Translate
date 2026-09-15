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
test('settings at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 640 });
  await page.goto('/lab-frame.html?scenario=settings&motion=reduce');
  await expect(page.getByRole('heading', { name: 'Traduction', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('settings-narrow.png');
});

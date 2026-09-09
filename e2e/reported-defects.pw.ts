import { test, expect } from '@playwright/test';

test('settings background covers the widened production document', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 450 });
  await page.goto('/lab-frame.html?scenario=settings&surface=production');
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  await page.screenshot({ path: `release/ui-evidence/settings-${process.env.FLOWTRANSLATE_EVIDENCE_STAGE ?? 'current'}.png` });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(31, 33, 38)');
  await expect(page.locator('.settings-window')).toHaveCSS('background-color', 'rgb(31, 33, 38)');
});

test('native-only defects do not present a web simulation as a reproduction', async ({ page }) => {
  await page.goto('/lab.html?issue=residual');
  await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Établie pour la fermeture', { exact: false })).toBeVisible();
});

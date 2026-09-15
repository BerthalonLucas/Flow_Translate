import { test, expect } from '@playwright/test';

test('settings background covers the widened production document', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 450 });
  await page.goto('/lab-frame.html?scenario=settings&surface=production');
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  await page.screenshot({ path: `release/ui-evidence/settings-${process.env.FLOWTRANSLATE_EVIDENCE_STAGE ?? 'current'}.png` });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(31, 33, 38)');
  await expect(page.locator('.settings-window')).toHaveCSS('background-color', 'rgb(31, 33, 38)');
});

test('the frame band is documented as native-only with its established cause', async ({ page }) => {
  await page.goto('/lab.html?issue=band');
  await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Établie le 13/09/2026', { exact: false })).toBeVisible();
});

test('the fold after « Agrandir » is reproducible in the workbench and holds two seconds', async ({ page }) => {
  await page.goto('/lab.html?issue=grace');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await frame.locator('.translation-copy').hover();
  await frame.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await frame.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await expect(frame.locator('.translation-bubble')).toHaveCSS('width', '420px');
  await page.mouse.move(2, 2);
  await page.waitForTimeout(1100);
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-collapsed', 'false');
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-collapsed', 'true', { timeout: 3000 });
});

test('native-only defects do not present a web simulation as a reproduction', async ({ page }) => {
  await page.goto('/lab.html?issue=residual');
  await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Établie pour la fermeture', { exact: false })).toBeVisible();
});

test('the notice replaces the message box and is reproducible in the workbench', async ({ page }) => {
  await page.goto('/lab.html?issue=notice');
  await expect(page.getByText('capture_error appelait MessageBoxW', { exact: false })).toBeVisible();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.notice-pill')).toHaveText('Rien à traduire dans la fenêtre active.');
  await expect(frame.locator('.glass-overlay')).toHaveCount(0);
});

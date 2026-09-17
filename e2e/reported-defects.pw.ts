import { test, expect } from '@playwright/test';

// Le banc de défauts rend le verre sans le posséder : points d'accroche gelés, ou motif
// acceptant l'ancien et le nouveau libellé. Ses propres textes sont assertionnés exacts.
const moreOptions = /(Plus d’options|Options du résultat)/;

test('the frame band is documented as native-only with its established cause', async ({ page }) => {
  await page.goto('/lab.html?issue=band');
  await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('Établie le 13/09/2026', { exact: false })).toBeVisible();
});

// UI-021 (« Agrandir » useless): a long result is a reader band from the start, half the
// frame wide, without any enlarge control.
test('a long result reads as a band, half the frame wide, without « Agrandir »', async ({ page }) => {
  await page.goto('/lab.html?issue=reader');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const inner = await frame.locator('html').evaluate(() => window.innerWidth);
  expect(inner).toBeGreaterThanOrEqual(956);
  await expect(frame.locator('.translation-bubble')).toHaveCSS('width', `${Math.round(inner / 2)}px`);
  await frame.getByRole('button', { name: moreOptions }).click();
  await expect(frame.locator('.more-menu')).toBeVisible();
  // L'absence d'un libellé se vérifie sans tolérance : « Agrandir » et « Réduire » n'existent
  // ni en 0.4.0 ni en 1.0. Ce que le menu contient à la place appartient au verre.
  await expect(frame.getByRole('menuitem', { name: 'Agrandir' })).toHaveCount(0);
  await expect(frame.getByRole('menuitem', { name: 'Réduire' })).toHaveCount(0);
  expect(await frame.locator('.more-menu').getByRole('menuitem').count()).toBeGreaterThan(2);
});

// UI-022 (the glass stays too long): read, leave, gone within four seconds.
test('a glass the pointer visited dims within four seconds of its departure and then leaves', async ({ page }) => {
  await page.goto('/lab.html?issue=duration');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await frame.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(2, 2);
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  await expect(frame.locator('.glass-overlay')).toHaveCount(0, { timeout: 4000 });
});

// UI-023 (loading): shadcn's spinner in a pill alone, no ring in a big glass. La géométrie
// est contractuelle (wait-pill-width 60, pill-height 28) ; le nom de l'animation ne l'est pas.
test('waiting shows a turning spinner in a pill of 60 × 28', async ({ page }) => {
  await page.goto('/lab.html?issue=loading');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
  const pill = frame.locator('.wait-pill');
  expect(await pill.boundingBox()).toMatchObject({ width: 60, height: 28 });
  expect(await pill.locator('svg').count()).toBe(1);
  expect(await pill.locator('svg').evaluate(el => getComputedStyle(el).animationName)).not.toBe('none');
  await expect(frame.locator('.loading-ring')).toHaveCount(0);
  await expect(frame.locator('.translation-bubble')).toHaveCount(0);
});

test('native-only defects do not present a web simulation as a reproduction', async ({ page }) => {
  for (const issue of ['residual', 'screens']) {
    await page.goto(`/lab.html?issue=${issue}`);
    await expect(page.getByText('Pas de reproduction web pour ce défaut.', { exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  await page.goto('/lab.html?issue=residual');
  await expect(page.getByText('Établie pour la fermeture', { exact: false })).toBeVisible();
});

// L'avis est recopié de Rust par frame.tsx : c'est une chaîne de l'atelier, exacte.
test('the notice replaces the message box and is reproducible in the workbench', async ({ page }) => {
  await page.goto('/lab.html?issue=notice');
  await expect(page.getByText('capture_error appelait MessageBoxW', { exact: false })).toBeVisible();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.notice-pill')).toHaveText('Rien à traiter dans la fenêtre active.');
  await expect(frame.locator('.glass-overlay')).toHaveCount(0);
});

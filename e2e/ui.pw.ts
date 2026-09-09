import { test, expect } from '@playwright/test';

for (const scale of [1, 1.25, 1.5, 2]) {
  test(`bubble stays compact at ${scale * 100}% device scale`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto('/?window=overlay&demo=1');
    const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
    await expect(copy).toBeEnabled();
    const bubble = page.locator('.translation-bubble');
    const bounds = await bubble.boundingBox();
    expect(bounds?.width).toBe(280);
    expect(bounds!.height).toBeLessThanOrEqual(220);
    const style = await bubble.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, opacity: getComputedStyle(el).opacity, background: getComputedStyle(el).backgroundColor }));
    expect(style.radius).toBe('26px');
    expect(style.opacity).toBe('1'); // alpha applies to background, not text
    expect(style.background).toContain('0.82');
    await expect(bubble.getByRole('heading')).toHaveCount(0);
    await page.screenshot({ path: `test-results/bubble-scale-${scale}.png` });
    await context.close();
  });
}

test('clipboard source is shown and must be confirmed before translation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Presse-papiers', exact: true }).check();
  await page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true }).click();
  const bubble = page.locator('.translation-bubble');
  await expect(bubble).toContainText('Je vous envoie la proposition mise à jour.');
  await expect(bubble.getByRole('button', { name: 'Traduire', exact: true })).toBeVisible();
  await expect(bubble.getByRole('button', { name: 'Copier la traduction', exact: true })).toHaveCount(0);
  await bubble.getByRole('button', { name: 'Traduire', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
});

test('error never enables copy of a partial or absent result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Erreur réseau', exact: true }).check();
  await page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toContainText('indisponible');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeDisabled();
});

test('capsule fits a 200px native viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 200, height: 36 });
  await page.goto('/?window=capsule&demo=1');
  const bounds = await page.locator('.capsule').boundingBox();
  expect(bounds?.width).toBe(200);
  expect(bounds?.height).toBe(36);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(200);
});

test('reduced motion disables streaming cursor animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?window=overlay&demo=1');
  await expect(page.locator('.translation-copy')).toBeVisible();
  const duration = await page.locator('.translation-text').evaluate(el => getComputedStyle(el, '::after').animationDuration);
  expect(duration === '0s' || duration === '1e-05s' || duration === '0.00001s').toBeTruthy();
});

test('comparison shows source without replacing the translated result', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Afficher l’original', exact: true }).click();
  await expect(page.locator('.original-copy')).toContainText('Could you send the updated proposal');
  await expect(page.locator('.translation-copy')).toContainText('Pourriez-vous envoyer');
});

test('explicit replacement is accessible for an editable completed selection', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Remplacer', exact: true }).click();
  await expect(page.locator('.compact-feedback')).toContainText('Remplacement effectué');
});

test('settings keep connection details collapsed and expose history deletion', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  await expect(page.getByLabel('Clé API', { exact: true })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Conserver l’historique chiffré' }).check();
  await expect(page.locator('.history article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tout supprimer', exact: true }).click();
  await expect(page.locator('.history article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Connexion avancée', exact: true }).click();
  await expect(page.getByLabel('Clé API', { exact: true })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
});

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
  await page.getByRole('switch', { name: 'Conserver l’historique chiffré' }).check();
  await expect(page.locator('.history article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tout supprimer', exact: true }).click();
  await expect(page.locator('.history article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Connexion avancée', exact: true }).click();
  await expect(page.getByLabel('Clé API', { exact: true })).toHaveCount(2);
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
});


test('menu supports keyboard navigation and restores focus after Escape', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const trigger = page.getByRole('button', { name: 'Plus d’options', exact: true });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Agrandir', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Fermer', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.translation-bubble')).toBeVisible();
});

for (const scenario of ['selection', 'error']) {
  test(`closing stays available during ${scenario}`, async ({ page }) => {
    await page.goto(`/?window=overlay&demo=1&scenario=${scenario}`);
    if (scenario === 'error') await expect(page.locator('.error-copy')).toBeVisible();
    await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
    await expect(page.locator('.translation-bubble')).toHaveCount(0);
  });
}

test('long output scrolls within the fixed width and keeps the menu inside the bubble', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const bubble = page.locator('.translation-bubble');
  const bounds = await bubble.boundingBox();
  expect(bounds?.width).toBe(280);
  expect(bounds?.height).toBe(220);
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/bubble-long.png' });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  const close = page.getByRole('menuitem', { name: 'Fermer', exact: true });
  await expect(close).toBeVisible();
  await close.scrollIntoViewIfNeeded();
  const menuBounds = await page.getByRole('menu').boundingBox();
  const nextBounds = await bubble.boundingBox();
  expect(menuBounds!.x).toBeGreaterThanOrEqual(nextBounds!.x);
  expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(nextBounds!.x + nextBounds!.width);
  expect(await page.getByRole('menu').evaluate(el => !!el.closest('.translation-bubble'))).toBe(true);
  expect(await bubble.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.screenshot({ path: 'test-results/bubble-menu.png' });
});

test('demo can replay and change scenarios without stale capture deduplication', async ({ page }) => {
  await page.goto('/');
  const begin = page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true });
  await begin.click();
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: 'Erreur réseau', exact: true }).check();
  await begin.click();
  await expect(page.locator('.error-copy')).toContainText('indisponible');
  await page.getByRole('radio', { name: 'Sélection', exact: true }).check();
  await begin.click();
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
});

test('reduced motion paints menu immediately without transforms or opacity transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?window=overlay&demo=1');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCSS('opacity', '1');
  await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
});

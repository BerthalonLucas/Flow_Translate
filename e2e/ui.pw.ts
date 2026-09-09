import { test, expect } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`preview backgrounds and copy feedback preserve the capture and pill bounds (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?window=overlay&demo=1&background=light');
    const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
    await expect(copy).toBeEnabled();
    const text = await page.locator('.translation-text').textContent();
    const captureId = await page.locator('.glass-overlay').getAttribute('data-capture-id');
    const pillBounds = await page.locator('.action-pill').boundingBox();
    for (const name of ['Sombre', 'Coloré', 'Clair']) {
      const background = page.getByRole('button', { name, exact: true });
      await background.click();
      await expect(background).toHaveAttribute('aria-pressed', 'true');
      expect(await page.locator('.translation-text').textContent()).toBe(text);
      await expect(page.locator('.glass-overlay')).toHaveAttribute('data-capture-id', captureId!);
      expect(await page.locator('.action-pill').boundingBox()).toEqual(pillBounds);
    }
    await copy.click();
    await expect(page.locator('.compact-feedback')).toHaveText('Copié.');
    await expect(copy.locator('.lucide-check')).toHaveCount(1);
    await expect(copy.locator('.lucide-copy')).toHaveCount(0);
    expect(await page.locator('.action-pill').boundingBox()).toEqual(pillBounds);
    await page.screenshot({ path: `test-results/glass-material-${reducedMotion}.png` });
  });
}

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
    const style = await bubble.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, opacity: getComputedStyle(el).opacity }));
    expect(style.radius).toBe('26px');
    expect(style.opacity).toBe('1'); // alpha applies to background, not text
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
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeDisabled();
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

test('reader keeps its glass fixed while opening a separate menu above it', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const bubble = page.locator('.translation-bubble');
  const before = await bubble.boundingBox();
  expect(before?.width).toBe(560);
  expect(before?.height).toBeLessThanOrEqual(280);
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/reader.png' });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const after = await bubble.boundingBox();
  expect(after).toEqual(before);
  const menuBounds = await menu.boundingBox();
  expect(menuBounds!.y + menuBounds!.height).toBeLessThan(before!.y);
  expect(await menu.evaluate(el => !!el.closest('.glass-overlay'))).toBe(true);
  expect(await menu.evaluate(el => !!el.closest('.translation-bubble'))).toBe(false);
  await expect(page.locator('.glass-overlay')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: 'test-results/reader-menu.png' });
});

test('contextual menu preserves text bounds and the overlapping pill geometry', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const bubble = await page.locator('.translation-bubble').boundingBox();
  const pill = await page.locator('.action-pill').boundingBox();
  expect(pill!.width).toBe(60);
  expect(pill!.height).toBe(28);
  expect(pill!.y).toBe(bubble!.y - 14);
  expect(pill!.x + pill!.width).toBe(bubble!.x + bubble!.width - 18);
  expect(await page.locator('.translation-bubble button').count()).toBe(0);
  const textBefore = await page.locator('.translation-copy').boundingBox();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  expect(await page.locator('.translation-bubble').boundingBox()).toEqual(bubble);
  expect(await page.locator('.translation-copy').boundingBox()).toEqual(textBefore);
  const menu = await page.getByRole('menu').boundingBox();
  expect(menu!.y).toBeGreaterThanOrEqual(bubble!.y + bubble!.height + 8);
});

test('very long reader preserves all text and supports wheel and keyboard without scrollbars', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const content = page.getByRole('region', { name: 'Traduction', exact: true });
  const fullText = await page.locator('.translation-text').textContent();
  expect(fullText!.length).toBeGreaterThan(4000);
  await expect(content).toHaveCSS('scrollbar-width', 'none');
  await expect(content).toHaveAttribute('data-scroll-down', 'true');
  await content.focus();
  await page.keyboard.press('PageDown');
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('End');
  await expect(content).toHaveAttribute('data-scroll-down', 'false');
  await page.keyboard.press('Home');
  await expect(content).toHaveAttribute('data-scroll-up', 'false');
  await content.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.translation-text').textContent()).toBe(fullText);
  await expect(page.locator('.action-pill')).toBeInViewport();
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


test('reader preview fits a narrow viewport and stays above the bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 720 });
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const glass = await page.locator('.translation-bubble').boundingBox();
  expect(glass!.x).toBe(20);
  expect(glass!.width).toBe(440);
  expect(glass!.y + glass!.height).toBe(692);
});


test('explicit compact-reader-compact changes fade through each layout without scaling text', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  await page.evaluate(() => {
    const root = document.querySelector('.glass-overlay')!;
    const phases: string[] = [];
    Object.assign(window, { observedLayoutPhases: phases });
    new MutationObserver(() => phases.push(root.getAttribute('data-layout-phase')!)).observe(root, { attributes: true, attributeFilter: ['data-layout-phase'] });
  });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '560px');
  await expect(copy).toBeEnabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Réduire', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '280px');
  await expect(copy).toBeEnabled();
  await expect(page.locator('.glass-overlay')).toHaveCSS('opacity', '1');
  await expect(page.locator('.glass-overlay')).toHaveCSS('transform', 'none');
  const phases = await page.evaluate(() => (window as unknown as { observedLayoutPhases: string[] }).observedLayoutPhases);
  for (const phase of ['out', 'commit', 'in', 'idle']) expect(phases.filter(value => value === phase).length).toBeGreaterThanOrEqual(2);
});


test('browser settings identifies simulated checks and closes back to preview', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  const engine = page.getByRole('region', { name: 'Connexion du moteur' });
  await expect(engine).toContainText('Aperçu navigateur · connexion simulée');
  await page.getByRole('button', { name: 'Enregistrer et vérifier le moteur', exact: true }).click();
  await expect(engine.getByRole('status')).toContainText('Démo : connexion simulée');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true })).toBeVisible();
});

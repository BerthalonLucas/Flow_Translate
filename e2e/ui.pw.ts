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
    await expect(copy).toHaveAttribute('data-copied', 'true');
    await expect(copy.locator('.lucide-check')).toHaveCount(1);
    await expect(copy.locator('.lucide-copy')).toHaveCount(0);
    await expect(page.locator('.compact-feedback')).toHaveCount(0);
    expect(await page.locator('.action-pill').boundingBox()).toEqual(pillBounds);
    await expect(copy).not.toHaveAttribute('data-copied', 'true', { timeout: 3000 });
    await expect(copy.locator('.lucide-copy')).toHaveCount(1);
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
    expect(bounds?.width).toBe(300);
    expect(bounds!.height).toBeLessThanOrEqual(220);
    const style = await bubble.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, opacity: getComputedStyle(el).opacity }));
    expect(style.radius).toBe('28px');
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
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
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

test('long text stays in the 220px compact glass and the menu overlays it under the pill', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const bubble = page.locator('.translation-bubble');
  const before = await bubble.boundingBox();
  expect(before?.width).toBe(300);
  expect(before?.height).toBeLessThanOrEqual(220);
  await expect(page.locator('.translation-copy')).toHaveAttribute('data-scroll-edge', 'top');
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeInViewport();
  await page.screenshot({ path: 'test-results/reader.png' });
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('transform', 'none');
  const after = await bubble.boundingBox();
  expect(after).toEqual(before);
  const menuBounds = await menu.boundingBox();
  expect(Math.round(menuBounds!.y - before!.y)).toBe(20);
  expect(Math.round(before!.x + before!.width - (menuBounds!.x + menuBounds!.width))).toBe(16);
  expect(menuBounds!.width).toBe(196);
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
  expect(pill!.width).toBe(52);
  expect(pill!.height).toBe(28);
  expect(pill!.y).toBe(bubble!.y - 14);
  expect(pill!.x + pill!.width).toBe(bubble!.x + bubble!.width - 16);
  expect(await page.locator('.translation-bubble button').count()).toBe(0);
  const textBefore = await page.locator('.translation-copy').boundingBox();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCSS('transform', 'none');
  expect(await page.locator('.translation-bubble').boundingBox()).toEqual(bubble);
  expect(await page.locator('.translation-copy').boundingBox()).toEqual(textBefore);
  const menu = await page.getByRole('menu').boundingBox();
  expect(Math.round(menu!.y - bubble!.y)).toBe(20);
});

test('very long reader preserves all text and supports wheel and keyboard without scrollbars', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const content = page.getByRole('document', { name: 'Traduction', exact: true });
  const fullText = await page.locator('.translation-text').textContent();
  expect(fullText!.length).toBeGreaterThan(4000);
  await expect(content).toHaveCSS('scrollbar-width', 'none');
  await expect(content).toHaveAttribute('data-scroll-edge', 'top');
  const indicator = page.locator('.scroll-indicator');
  await expect(indicator).toHaveCSS('opacity', '0');
  await content.focus();
  await page.keyboard.press('PageDown');
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(content).toHaveAttribute('data-scroll-edge', 'middle');
  await expect(indicator).toHaveCSS('opacity', '1');
  await page.keyboard.press('End');
  await expect(content).toHaveAttribute('data-scroll-edge', 'bottom');
  await page.keyboard.press('Home');
  await expect(content).toHaveAttribute('data-scroll-edge', 'top');
  await page.mouse.move(5, 5);
  await expect(indicator).toHaveCSS('opacity', '0', { timeout: 3000 });
  await content.hover();
  await expect(indicator).toHaveCSS('opacity', '1');
  await page.mouse.wheel(0, 240);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.translation-text').textContent()).toBe(fullText);
  await expect(page.locator('.action-pill')).toBeInViewport();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
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


test('enlarged glass grows from its top-left corner without moving it', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  const before = await page.locator('.translation-bubble').boundingBox();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Agrandir', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '420px');
  await expect(copy).toBeEnabled();
  const after = await page.locator('.translation-bubble').boundingBox();
  expect(after!.x).toBe(before!.x);
  expect(after!.y).toBe(before!.y);
  expect(after!.height).toBeLessThanOrEqual(440);
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '22.4px');
  await expect(page.getByRole('button', { name: 'Réduire', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Afficher l’original', exact: true }).click();
  await expect(page.locator('.original-copy')).toContainText('Hi Alex');
  await page.getByRole('button', { name: 'Réduire', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
});

test('streaming past the ceiling keeps the view at the top and hints at the rest', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  const content = page.locator('.translation-copy');
  await expect(page.locator('.stream-hint')).toHaveText('la suite arrive');
  await expect(content).toHaveAttribute('data-capped', 'true');
  expect(await content.evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('.stream-hint')).toHaveCount(0);
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
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '420px');
  await expect(copy).toBeEnabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Réduire', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '300px');
  await expect(copy).toBeEnabled();
  await expect(page.locator('.glass-overlay')).toHaveCSS('opacity', '1');
  await expect(page.locator('.glass-overlay')).toHaveCSS('transform', 'none');
  const phases = await page.evaluate(() => (window as unknown as { observedLayoutPhases: string[] }).observedLayoutPhases);
  for (const phase of ['out', 'commit', 'in', 'idle']) expect(phases.filter(value => value === phase).length).toBeGreaterThanOrEqual(2);
});


test('browser settings save automatically, identify simulated checks and close back to preview', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await page.getByRole('button', { name: 'Connexion', exact: true }).click();
  await expect(page.getByText('Aperçu navigateur · connexion simulée')).toBeVisible();
  const quality = page.locator('.profile').first();
  await expect(quality.getByRole('status')).toHaveText('Non vérifié');
  await quality.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(quality.getByRole('status')).toContainText('Connecté ·');
  await expect(quality.getByRole('status')).toContainText('ms');
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page.locator('.keycaps')).toContainText('Pressez la combinaison…');
  await page.keyboard.press('Control+Shift+K');
  await expect(page.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Shift', 'K']);
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true })).toBeVisible();
});

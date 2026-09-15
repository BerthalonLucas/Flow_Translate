import { test, expect } from '@playwright/test';
import { menu as menuLayout } from '../src/layout';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`preview backgrounds and copy feedback preserve the capture and pill bounds (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/?window=overlay&demo=1&background=light');
    const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
    await expect(copy).toBeEnabled();
    const text = await page.locator('.translation-text').textContent();
    const captureId = await page.locator('.glass-overlay').getAttribute('data-capture-id');
    await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
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
  test(`the short glass keeps 380 px and eight lines at most at ${scale * 100}% device scale`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto('/?window=overlay&demo=1');
    const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
    await expect(copy).toBeEnabled();
    const bubble = page.locator('.translation-bubble');
    const bounds = await bubble.boundingBox();
    expect(bounds?.width).toBe(380);
    expect(bounds!.height).toBeLessThanOrEqual(8 * 24 + 29);
    const style = await bubble.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, opacity: getComputedStyle(el).opacity }));
    expect(style.radius).toBe('28px');
    expect(style.opacity).toBe('1'); // alpha applies to background, not text
    await expect(bubble.getByRole('heading')).toHaveCount(0);
    await page.screenshot({ path: `test-results/bubble-scale-${scale}.png` });
    await context.close();
  });
}

test('a capture without an anchor translates at once at the bottom, as a short glass', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Presse-papiers', exact: true }).check();
  await page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true }).click();
  const overlay = page.locator('.glass-overlay');
  await expect(overlay).toHaveAttribute('data-placement', 'bottom');
  await expect(overlay).toHaveAttribute('data-form', 'short');
  await expect(overlay.locator('.dock-tab')).toHaveCount(0);
  await expect(overlay.getByRole('button', { name: 'Traduire', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  expect(((await page.locator('.translation-text .reveal').textContent()) ?? '').length).toBeGreaterThan(0);
  // Bottom centre of the preview.
  const box = (await overlay.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
});

// Reading budget (2026-09-14): a glass the pointer visited and left dims within four
// seconds, then leaves on its own; no tab, no fold.
test('leaving a finished glass after a visit dims it within four seconds, then closes it', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  await expect(page.locator('.glass-overlay')).toHaveCount(0, { timeout: 4000 });
});

test('a pinned reader never leaves on its own', async ({ page }) => {
  test.slow(); // twelve seconds of deliberate waits, plus a cold first load of the dev server
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const pin = page.getByRole('button', { name: 'Épingler', exact: true });
  await pin.click();
  await expect(page.getByRole('button', { name: 'Détacher', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(4500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await page.getByRole('button', { name: 'Détacher', exact: true }).click();
  // Unpinned: a read of a second, then gone, and the band dims within four seconds.
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
});

test('the spinner turns while the engine streams; a long result then lands whole as a reader band', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const pill = page.locator('.wait-pill');
  await expect(pill).toHaveAttribute('aria-label', 'Traduction en cours');
  expect(await pill.boundingBox()).toMatchObject({ width: 60, height: 28 });
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'pending');
  // A long source waits at the bottom from the start (UI-025): the band is born there.
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
  expect(await pill.locator('svg').count()).toBe(1);
  expect(await pill.locator('svg').evaluate(el => [getComputedStyle(el).animationName, getComputedStyle(el).animationDuration, getComputedStyle(el).animationTimingFunction, Number(el.getAttribute('width'))])).toEqual(['wait-spin', '1s', 'linear', 18]);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled({ timeout: 30000 });
  await expect(pill).toHaveCount(0);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-placement', 'bottom');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-moving', 'false');
  await expect(page.locator('.translation-copy')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.translation-bubble')).toHaveAttribute('data-reveal', 'true');
  expect(await page.locator('.translation-bubble').evaluate(el => getComputedStyle(el).animationName)).toBe('band-in');
  expect(((await page.locator('.translation-text .reveal').textContent()) ?? '').length).toBeGreaterThan(200);
});

test('the reader band is half the viewport wide, 22/33, whole lines within 45 % of the height, and its menu opens above the pill', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled({ timeout: 15000 });
  const bubble = page.locator('.translation-bubble');
  const box = (await bubble.boundingBox())!;
  expect(box.width).toBe(700);
  expect(Math.abs(box.x + box.width / 2 - 700)).toBeLessThanOrEqual(1);
  const lines = Math.floor((Math.round(800 * 0.45) - 34) / 33);
  expect(box.height).toBe(lines * 33 + 34);
  expect(box.height).toBeLessThanOrEqual(360);
  await expect(page.locator('.translation-copy')).toHaveCSS('font-size', '22px');
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '33px');
  await expect(page.locator('.translation-copy')).toHaveCSS('color', 'rgb(232, 234, 239)');
  await expect(page.locator('.translation-copy')).toHaveAttribute('data-scroll-edge', 'top');
  await expect(page.getByRole('button', { name: 'Épingler', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toBeVisible();
  await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('transform', 'none');
  const menuBox = (await menu.boundingBox())!;
  const pill = (await page.locator('.action-pill').boundingBox())!;
  expect(Math.round(pill.y - (menuBox.y + menuBox.height))).toBe(6);
  expect(await menu.getByRole('menuitem').count()).toBe(5);
  expect(menuBox.height).toBeLessThanOrEqual(menuLayout.reserve);
  await expect(menu.getByRole('menuitem', { name: 'Agrandir' })).toHaveCount(0);
  await expect(menu).toHaveCSS('background-color', 'rgba(24, 26, 31, 0.96)');
});

test('a click restores the whole budget: the glass stays at least two and a half seconds after the pointer leaves', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=long');
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Afficher l’original', exact: true }).click();
  await expect(page.locator('.original-copy')).toBeVisible();
  // The click restored the whole budget (33 s for this text); a visit of a second then a
  // departure brings what remains to four seconds, never under two and a half.
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2000);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 4000 });
});

test('a pointer resting beside the glass keeps it; it dims once the pointer is 32 px away', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.locator('.translation-copy').hover();
  await page.waitForTimeout(1100);
  const box = (await page.locator('.glass-overlay').boundingBox())!;
  await page.mouse.move(box.x + box.width + 16, box.y + box.height / 2);
  await page.waitForTimeout(4500);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2);
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'true', { timeout: 5000 });
  // Coming back while it dims brings it back for five seconds.
  await page.locator('.translation-copy').hover();
  await expect(page.locator('.glass-overlay')).toHaveAttribute('data-dimming', 'false');
  await expect(page.locator('.glass-overlay')).toHaveCSS('opacity', '1', { timeout: 2000 });
});

test('the original reads two sizes down on a light field and the text keeps 22 px from the rounded edge', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Afficher l’original', exact: true }).click();
  const original = page.locator('.original-copy');
  await expect(original).toHaveCSS('font-size', '14px');
  await expect(original).toHaveCSS('color', 'rgba(250, 251, 253, 0.85)');
  await expect(original).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.05)');
  await expect(page.locator('.translation-copy')).toHaveCSS('padding', '16px 22px 13px');
  await expect(page.locator('.translation-copy')).toHaveCSS('letter-spacing', 'normal');
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

test('reduced motion freezes the spinner and skips the reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?window=overlay&demo=1&scenario=long');
  await expect(page.locator('.wait-pill')).toHaveCount(1);
  expect(['0s', '1e-05s', '0.00001s']).toContain(await page.locator('.wait-pill svg').evaluate(el => getComputedStyle(el).animationDuration));
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled({ timeout: 30000 });
  const durations = await page.evaluate(() => ['.translation-bubble', '.translation-text .reveal'].map(selector => { const el = document.querySelector(selector); return el ? getComputedStyle(el).animationDuration : 'missing'; }));
  for (const duration of durations) expect(['0s', '1e-05s', '0.00001s']).toContain(duration);
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
  await expect(page.locator('.compact-feedback')).toContainText('Résultat collé dans la sélection');
});

test('settings keep connection details collapsed, offer the reading presets and expose history deletion', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('heading', { name: 'Réglages', exact: true })).toBeVisible();
  await expect(page.getByLabel('Clé API', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Très grande', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Jamais', exact: true })).toBeVisible();
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
  await expect(page.getByRole('menuitem', { name: 'Afficher l’original', exact: true })).toBeFocused();
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

test('the short glass menu overlays the glass under the pill, on the same graphite', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  const bubble = page.locator('.translation-bubble');
  const before = await bubble.boundingBox();
  expect(before?.width).toBe(380);
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeInViewport();
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
  expect(menuBounds!.height).toBeLessThanOrEqual(menuLayout.reserve);
  await expect(menu).toHaveCSS('background-color', 'rgba(24, 26, 31, 0.96)');
  await expect(bubble).toHaveCSS('background-color', 'rgba(24, 26, 31, 0.96)');
  await expect(bubble).toHaveCSS('background-image', 'none');
  expect(await menu.evaluate(el => !!el.closest('.glass-overlay'))).toBe(true);
  expect(await menu.evaluate(el => !!el.closest('.translation-bubble'))).toBe(false);
  await expect(page.locator('.glass-overlay')).toHaveCSS('transform', 'none');
  await page.screenshot({ path: 'test-results/short-menu.png' });
});

test('the short glass pill holds Copier, the menu and Fermer, biting the upper-right edge', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled();
  await expect(page.locator('.action-pill')).toHaveCSS('transform', 'none');
  const bubble = await page.locator('.translation-bubble').boundingBox();
  const pill = await page.locator('.action-pill').boundingBox();
  expect(pill!.width).toBe(76);
  expect(pill!.height).toBe(28);
  expect(pill!.y).toBe(bubble!.y - 14);
  expect(pill!.x + pill!.width).toBe(bubble!.x + bubble!.width - 16);
  expect(await page.locator('.translation-bubble button').count()).toBe(0);
  await expect(page.getByRole('button', { name: 'Épingler', exact: true })).toHaveCount(0);
  const textBefore = await page.locator('.translation-copy').boundingBox();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  expect(await page.locator('.translation-bubble').boundingBox()).toEqual(bubble);
  expect(await page.locator('.translation-copy').boundingBox()).toEqual(textBefore);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.glass-overlay')).toHaveCount(0);
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
  // Off the reading area but still on the glass: the indicator fades, the glass stays.
  await page.locator('.action-pill').hover();
  await expect(indicator).toHaveCSS('opacity', '0', { timeout: 3000 });
  await content.hover();
  await expect(indicator).toHaveCSS('opacity', '1');
  await page.mouse.wheel(0, 240);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.locator('.translation-text').textContent()).toBe(fullText);
  await expect(page.locator('.action-pill')).toBeInViewport();
  await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${page.viewportSize()!.width / 2}px`);
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

test('a short result opens beside the selection from the pill row and never becomes a reader', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1');
  const copy = page.getByRole('button', { name: 'Copier la traduction', exact: true });
  await expect(copy).toBeEnabled();
  const overlay = page.locator('.glass-overlay');
  await expect(overlay).toHaveAttribute('data-form', 'short');
  await expect(overlay).toHaveAttribute('data-placement', 'anchored');
  expect(await page.locator('.translation-bubble').evaluate(el => getComputedStyle(el).animationName)).toBe('glass-open');
  await expect(page.locator('.translation-copy')).toHaveCSS('line-height', '24px');
  await expect(page.getByRole('menuitem', { name: 'Agrandir' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Réduire' })).toHaveCount(0);
});

test('a result past the ceiling lands whole and keeps the view at the top', async ({ page }) => {
  await page.goto('/?window=overlay&demo=1&scenario=very-long');
  const content = page.locator('.translation-copy');
  await expect(page.locator('.wait-pill')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copier la traduction', exact: true })).toBeEnabled({ timeout: 15000 });
  await expect(content).toHaveAttribute('data-capped', 'true');
  expect(await content.evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator('.wait-pill')).toHaveCount(0);
});

test('browser settings save automatically, identify simulated checks and close back to preview', async ({ page }) => {
  await page.goto('/?window=settings&demo=1');
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Lente', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await page.getByRole('radio', { name: 'Grande', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Grande', exact: true })).toHaveAttribute('data-state', 'on');
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

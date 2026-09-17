import { test, expect } from '@playwright/test';

// L'atelier rend le verre et les Réglages sans les posséder : il les adresse par leurs
// points d'accroche gelés, ou par un motif qui accepte l'ancien et le nouveau libellé.
// Ses propres chaînes — boutons de scénario, avis recopié de Rust — sont exactes.
const copyResult = /Copier (la traduction|le résultat)/;
const moreOptions = /(Plus d’options|Options du résultat)/;

test('workbench replays the real result and keeps a reproducible URL', async ({ page }) => {
  await page.goto('/lab.html?view=states');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.action-pill').getByRole('button', { name: copyResult })).toBeEnabled();
  await page.screenshot({ path: 'test-results/workbench.png', fullPage: true });
  await frame.getByRole('button', { name: moreOptions }).click();
  await expect(frame.locator('.more-menu')).toBeVisible();
  // Échap ferme le menu, puis le verre : deux gestes stables, là où le libellé de l'entrée
  // « Fermer » gagne une indication « Échap » en 1.0.
  await page.keyboard.press('Escape');
  await expect(frame.locator('.more-menu')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(frame.locator('.glass-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rejouer', exact: true }).click();
  await expect(frame.locator('.action-pill').getByRole('button', { name: copyResult })).toBeEnabled();
  await page.getByRole('button', { name: 'Résultat long (bande de lecture)' }).click();
  await expect(page).toHaveURL(/scenario=long/);
  await expect(frame.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  // The reader band: half of the frame (its border leaves 898 px inside the 900 px iframe).
  await expect(frame.locator('.glass-overlay')).toHaveAttribute('data-form', 'reader');
  const inner = await frame.locator('html').evaluate(() => window.innerWidth);
  await expect(frame.locator('.translation-bubble')).toHaveCSS('width', `${Math.round(inner / 2)}px`);
  expect(await frame.locator('.translation-copy').evaluate(el => el.scrollTop)).toBe(0);
});

for (const scenario of ['pending', 'partial'] as const) {
  test(`${scenario} is inspectable, cannot be copied and can be dismissed`, async ({ page }) => {
    await page.goto(`/lab-frame.html?scenario=${scenario}&motion=reduce`);
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', scenario === 'pending' ? 'streaming' : 'error');
    if (scenario === 'pending') { await expect(page.locator('.wait-pill')).toBeVisible(); await expect(page.getByRole('button', { name: copyResult })).toHaveCount(0); }
    else await expect(page.locator('.action-pill').getByRole('button', { name: copyResult })).toBeDisabled();
    if (scenario === 'partial') await expect(page.locator('.translation-text')).toHaveText('Pourriez-vous envoyer la proposition');
    await page.keyboard.press('Escape');
    await expect(page.locator('.glass-overlay')).toHaveCount(0);
  });
}

test('history fixture is isolated from the other settings scenarios', async ({ page }) => {
  await page.goto('/lab-frame.html?scenario=history');
  await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-lab-history', 'true');
  await page.goto('/lab-frame.html?scenario=privacy');
  await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-lab-history', 'false');
});

// tokens.css ne connaît que :root, [data-theme="dark"] et [data-theme="light"] : sans cette
// règle dans frame.tsx, émuler le thème du navigateur ne changeait rien et les références
// « claires » des Réglages ressortaient en sombre. C'est la seule preuve avant la fusion.
for (const theme of ['light', 'dark'] as const) {
  test(`a settings scenario follows the emulated Windows theme (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/lab-frame.html?scenario=engines&motion=reduce');
    await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
    // La page demandée est écrite dans l'URL, à l'orthographe du contrat : c'est là que la
    // fenêtre Réglages la lira quand aucune cible native ne lui est remise.
    await expect(page).toHaveURL(/window=settings.*page=engines|page=engines.*window=settings/);
  });
}

// L'overlay natif est une fenêtre transparente : poser color-scheme sur sa racine
// remplacerait le canevas transparent par une couleur opaque — le rectangle gris sur le
// bureau. data-theme ne pilote que des propriétés personnalisées, et reste graphite.
test('an overlay scenario carries no inline color-scheme and stays graphite', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/lab-frame.html?scenario=short&theme=light&motion=reduce');
  await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.locator('html').evaluate(el => (el as HTMLElement).style.colorScheme)).toBe('');
});

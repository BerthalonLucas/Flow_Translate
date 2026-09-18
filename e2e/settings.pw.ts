import { test, expect, type Page } from '@playwright/test';

// The browser preview of the settings window: `?window=settings&demo=1`.
const open = async (page: Page, query = '') => {
  await page.goto(`/?window=settings&demo=1${query}`);
  await expect(page.locator('[data-settings-ready="true"]')).toHaveCount(1);
};

test('the window opens on Actions, offers the reading presets and deletes history entries', async ({ page }) => {
  await open(page);
  await expect(page.locator('.settings-window')).toHaveAttribute('data-settings-page', 'actions');
  await expect(page.locator('.settings-titlebar')).toHaveText('FlowTranslate · RéglagesEnregistré');
  await expect(page.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(page.locator('.settings-window')).toHaveAttribute('data-settings-page', 'reading');
  await expect(page.getByRole('radio', { name: 'Très grande', exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Jamais', exact: true })).toBeVisible();
  // The reading preview never borrows a selector the native geometry measures.
  await expect(page.locator('.reading-preview-copy')).toHaveCount(1);
  for (const measured of ['.translation-bubble', '.wait-pill', '.action-pill', '.more-menu', '.compact-feedback']) {
    await expect(page.locator(measured)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Confidentialité', exact: true }).click();
  await page.getByRole('switch', { name: 'Conserver l’historique chiffré' }).check();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await expect(page.locator('.history-foot')).toContainText('2 entrées · 7 jours au plus');
  await page.locator('.history-item').first().getByRole('button', { name: 'Supprimer cette entrée' }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tout supprimer', exact: true }).click();
  await expect(page.getByText('Aucun résultat enregistré.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/settings.png', fullPage: true });
});

test('choices save on their own, the engine check is simulated and Fermer returns to the preview', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await page.getByRole('radio', { name: 'Lente', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await page.getByRole('radio', { name: 'Grande', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Grande', exact: true })).toHaveAttribute('data-state', 'on');
  await page.getByRole('button', { name: 'Moteurs', exact: true }).click();
  await expect(page.getByText('Aperçu navigateur · connexion simulée').first()).toBeVisible();
  const quality = page.locator('.engine-card[data-engine="quality"]');
  await expect(quality.getByRole('status')).toHaveText('Non vérifié');
  await quality.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(quality.getByRole('status')).toContainText('Connecté ·');
  await expect(quality.getByRole('status')).toContainText('ms');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.locator('.action-card').first().locator('.action-head').click();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page.locator('.keycaps[data-state="recording"]')).toContainText('Pressez la combinaison…');
  await page.keyboard.press('Control+Shift+K');
  await expect(page.locator('.binding-row .keycaps kbd')).toHaveText(['Ctrl', 'Shift', 'K']);
  await page.getByRole('button', { name: 'Fermer les réglages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simuler Ctrl + Alt + T', exact: true })).toBeVisible();
});

// Named check 1: the tokens are loaded and `data-theme` follows Windows, so the same page renders
// with different computed colours in light and in dark.
test('the same page renders in two themes', async ({ page }) => {
  const read = async (scheme: 'light' | 'dark') => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    return page.locator('.settings-window').evaluate(element => ({
      theme: document.documentElement.dataset.theme,
      colorScheme: document.documentElement.style.colorScheme,
      surface: getComputedStyle(element).backgroundColor,
      ink: getComputedStyle(element).color,
    }));
  };
  const dark = await read('dark');
  const light = await read('light');
  expect(dark).toMatchObject({ theme: 'dark', colorScheme: 'dark', surface: 'rgb(24, 25, 28)' });
  expect(light).toMatchObject({ theme: 'light', colorScheme: 'light', surface: 'rgb(243, 243, 241)' });
  expect(light.ink).not.toBe(dark.ink);
});

// Named check 2: `--focus` on the settings window is `signal-ink`, never the 0.4.0 blue. Keeping
// `--focus` in the styles.css `:root` block would have won by declaration order, not specificity.
for (const [scheme, expected] of [['dark', '#ffd24a'], ['light', '#6e5200']] as const) {
  test(`the focus ring is signal-ink in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    const resolved = await page.locator('.settings-window').evaluate(element => {
      const style = getComputedStyle(element);
      return { focus: style.getPropertyValue('--focus').trim().toLowerCase(), signalInk: style.getPropertyValue('--signal-ink').trim().toLowerCase() };
    });
    expect(resolved.focus).toBe(expected);
    expect(resolved.focus).toBe(resolved.signalInk);
    expect(resolved.focus).not.toBe('#7db6ff');
  });
}

// Named check 3: the only string this unit shares with the native one, character for character.
// `settings.rs:249` has no space before the semicolon today; the contract fixes U+00A0 there.
test('a remote address without HTTPS is refused with the shared message', async ({ page }) => {
  await open(page, '&page=engines');
  const address = page.locator('.engine-card[data-engine="quality"]').getByLabel('Adresse', { exact: true });
  await address.fill('http://exemple.test/v1');
  await address.blur();
  await expect(page.locator('.engine-card[data-engine="quality"] .field-error'))
    .toHaveText('Un serveur distant doit utiliser HTTPS ; HTTP est réservé au bouclage local.');
  await expect(address).toHaveAttribute('aria-invalid', 'true');
});

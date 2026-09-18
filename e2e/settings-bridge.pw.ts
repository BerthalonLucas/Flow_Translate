import { test, expect, type Page } from '@playwright/test';
import type { Settings, SettingsTarget } from '../src/types';

declare global {
  interface Window {
    settingsFixture: {
      calls: Array<{ command: string; args?: Record<string, unknown> }>;
      saved: () => Settings | undefined;
      saves: () => number;
      recoverSettings: () => void;
      connect: () => void;
      refuseShortcut: () => void;
      breakCopy: () => void;
      addHistory: (id: string, text: string, actionName?: string) => void;
      open: (target: SettingsTarget) => Promise<void>;
    };
  }
}

async function openFixture(page: Page, query = '') {
  await page.route('**/?window=settings&fixture=1*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/settings-fixture.ts') });
  });
  await page.goto(`/?window=settings&fixture=1${query}`);
}
const ready = (page: Page) => expect(page.locator('[data-settings-ready="true"]')).toHaveCount(1);

test('IPC fixture: settings recover from load failure', async ({ page }) => {
  await openFixture(page, '&settingsError=1');
  await expect(page.getByRole('alert')).toContainText('réglages sont indisponibles');
  await expect(page.getByText('Chargement des réglages…')).toHaveCount(0);
  await page.evaluate(() => window.settingsFixture.recoverSettings());
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await ready(page);
  await expect(page.getByLabel('Moteur par défaut')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Actions', exact: true })).toBeVisible();
});

test('IPC fixture: choices save at once, typing saves after a pause, no check leaves on its own', async ({ page }) => {
  await openFixture(page);
  await ready(page);
  expect(await page.evaluate(() => window.settingsFixture.calls.some(call => call.command === 'check_connection'))).toBe(false);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await page.getByRole('radio', { name: 'Grande', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Enregistré à l’instant');
  await page.getByRole('radio', { name: 'Lente', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.settingsFixture.saved())).toMatchObject({ autoClose: 'slow', textSize: 'large' });
  await page.getByRole('button', { name: 'Moteurs', exact: true }).click();
  await page.getByRole('radio', { name: 'Rapide', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.settingsFixture.saved())).toMatchObject({ mode: 'fast' });
  const fast = page.locator('.engine-card[data-engine="fast"]');
  await expect(fast).toContainText('Rapide');
  const saves = await page.evaluate(() => window.settingsFixture.saves());
  await fast.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(fast.getByRole('status')).toHaveText('Échec de connexion');
  await expect(fast).toContainText('Le moteur Rapide ne répond pas.');
  await page.evaluate(() => window.settingsFixture.connect());
  await fast.getByRole('button', { name: 'Vérifier', exact: true }).click();
  await expect(fast.getByRole('status')).toContainText('Connecté ·');
  expect(await page.evaluate(() => window.settingsFixture.saves())).toBe(saves);
  await fast.getByLabel('Modèle', { exact: true }).fill('changed-model');
  await expect(fast.getByRole('status')).toHaveText('Non vérifié');
  await expect.poll(() => page.evaluate(() => window.settingsFixture.saved())).toMatchObject({ profiles: { fast: { model: 'changed-model' } } });
  const calls = await page.evaluate(() => window.settingsFixture.calls);
  expect(calls.filter(call => call.command === 'check_connection').map(call => call.args?.mode)).toEqual(['fast', 'fast']);
  expect(calls.some(call => call.command === 'translate')).toBe(false);
  await page.getByRole('button', { name: 'Fermer les réglages', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.settingsFixture.calls.some(call => call.command === 'plugin:window|close'))).toBe(true);
});

test('IPC fixture: a half-typed address never saves and never complains, the blur decides', async ({ page }) => {
  await openFixture(page, '&target=engines');
  await ready(page);
  const quality = page.locator('.engine-card[data-engine="quality"]');
  const address = quality.getByLabel('Adresse', { exact: true });
  const saves = await page.evaluate(() => window.settingsFixture.saves());
  await address.fill('http://1');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.settingsFixture.saves())).toBe(saves);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
  await expect(quality.locator('.field-error')).toHaveCount(0);
  // The refusal appears under the field, on the blur, and still nothing is written.
  await address.blur();
  await expect(quality.locator('.field-error')).toContainText('L’adresse doit viser la racine du serveur ou son chemin /v1.');
  expect(await page.evaluate(() => window.settingsFixture.saves())).toBe(saves);
  // An accepted address is on disk before the check leaves: `check_connection` reads what is saved.
  await address.fill('http://127.0.0.1:9100/v1');
  await address.blur();
  await expect.poll(() => page.evaluate(() => window.settingsFixture.saved())).toMatchObject({ profiles: { quality: { endpoint: 'http://127.0.0.1:9100/v1' } } });
  await expect(quality.locator('.field-error')).toHaveCount(0);
  const calls = await page.evaluate(() => window.settingsFixture.calls);
  const check = calls.findIndex(call => call.command === 'check_connection');
  const save = calls.map(call => call.command).lastIndexOf('save_settings');
  expect(check).toBeGreaterThan(save);
});

test('IPC fixture: a refused shortcut keeps the previous combination and explains the conflict', async ({ page }) => {
  await openFixture(page);
  await ready(page);
  await page.evaluate(() => window.settingsFixture.refuseShortcut());
  await page.locator('.action-card').first().locator('.action-head').click();
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.keyboard.press('Control+Alt+Y');
  await expect(page.getByRole('alert')).toHaveText('Le raccourci est déjà utilisé ou indisponible.');
  await expect(page.locator('.binding-row .keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'T']);
  await expect(page.locator('.save-status')).toHaveText('Enregistré');
});

test('IPC fixture: each opening lands on its target and reads settings and history again', async ({ page }) => {
  await openFixture(page, '&target=engines&targetEngine=fast&targetReason=Le%20raccourci%20est%20refus%C3%A9.');
  await ready(page);
  // `take_settings_target` is read at mount: the window already exists, hidden, when Rust emits.
  await expect(page.locator('.settings-window')).toHaveAttribute('data-settings-page', 'engines');
  await expect(page.locator('.engine-card[data-engine="fast"]')).toHaveAttribute('data-highlighted', 'true');
  await expect(page.locator('.engine-card[data-engine="fast"]')).toContainText('Le raccourci est refusé.');
  await page.getByRole('button', { name: 'Confidentialité', exact: true }).click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  // A second opening: a stale list and a stale page are both refreshed.
  await page.evaluate(() => window.settingsFixture.addHistory('h2', 'Je vous envoie le devis corrigé demain matin.'));
  await page.evaluate(() => window.settingsFixture.open({ page: 'privacy' }));
  await expect(page.locator('.settings-window')).toHaveAttribute('data-settings-page', 'privacy');
  await expect(page.locator('.history-item')).toHaveCount(2);
});

test('IPC fixture: Alt-Tab to an already visible window reads the history again', async ({ page }) => {
  await openFixture(page, '&target=privacy');
  await ready(page);
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.evaluate(() => window.settingsFixture.addHistory('h2', 'Je vous envoie le devis corrigé demain matin.'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.history-item')).toHaveCount(2);
});

test('IPC fixture: history copies by id, shows the result alone and reports a refusal', async ({ page }) => {
  await openFixture(page, '&target=privacy');
  await ready(page);
  const item = page.locator('.history-item').first();
  await expect(item).toContainText('Pourriez-vous envoyer la proposition mise à jour ?');
  await expect(item).not.toContainText('never shown');
  await item.getByRole('button', { name: 'Copier le résultat' }).click();
  await expect(item.getByRole('button', { name: 'Copié' })).toHaveCount(1);
  const copy = await page.evaluate(() => window.settingsFixture.calls.filter(call => call.command === 'copy_history').at(-1));
  expect(copy?.args).toEqual({ id: 'h1' });
  expect(JSON.stringify(copy?.args)).not.toContain('Pourriez-vous');
  await expect(item.getByRole('button', { name: 'Copier le résultat' })).toHaveCount(1, { timeout: 3000 });
  await page.evaluate(() => window.settingsFixture.breakCopy());
  await item.getByRole('button', { name: 'Copier le résultat' }).click();
  await expect(page.locator('.history-error')).toHaveText('Copie indisponible. Réessayez.');
});

test('IPC fixture: unreadable settings are announced on Actions and consumed once', async ({ page }) => {
  await openFixture(page, '&startupNotice=1');
  await ready(page);
  await expect(page.locator('.callout[data-tone="danger"]'))
    .toHaveText('Vos réglages étaient illisibles : la dernière sauvegarde est chargée.');
  const notices = await page.evaluate(() => window.settingsFixture.calls.filter(call => call.command === 'take_startup_notice').length);
  expect(notices).toBe(1);
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(page.locator('.callout[data-tone="danger"]')).toHaveCount(0);
});

import { test, expect, type Page } from '@playwright/test';

async function openSettings(page: Page) {
  await page.route('**/?window=settings&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=settings&fixture=1');
  await expect(page.getByRole('heading', { name: 'Actions et consignes' })).toBeVisible();
}
const saved = (page: Page) => page.evaluate(() => (window as any).nativeFixture.calls.filter((c: any) => c.command === 'save_settings').at(-1)?.args.settings);

test('a custom instruction and a second shortcut retain their action and destination', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: 'Ajouter une action', exact: true }).click();
  const action = page.locator('.action-card').filter({ hasText: 'Nouvelle action' });
  await action.locator('summary').click();
  await action.getByLabel('Nom de l’action', { exact: true }).fill('Résumer');
  const custom = page.locator('.action-card').filter({ hasText: 'Personnalisée' });
  await custom.getByRole('textbox', { name: 'Consigne Résumer', exact: true }).fill('Résume le texte en une phrase.');
  await expect.poll(() => saved(page)).toMatchObject({ actions: expect.arrayContaining([expect.objectContaining({ name: 'Résumer', promptTemplate: 'Résume le texte en une phrase.' })]) });
  const id = (await saved(page)).actions.find((a: any) => a.name === 'Résumer').id;
  await page.getByRole('button', { name: 'Ajouter un raccourci', exact: true }).click();
  const second = page.locator('.shortcut-card').nth(1);
  await second.locator('.shortcut-options select').nth(0).selectOption(id);
  await second.locator('.shortcut-options select').nth(1).selectOption('replace');
  await second.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.keyboard.press('Control+Alt+R');
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: 'correct' }), expect.objectContaining({ shortcut: 'Ctrl+Alt+R', actionId: id, outputMode: 'replace', enabled: true })] });
  await expect(custom.getByRole('button', { name: /Supprimer l’action/ })).toBeDisabled();
});

test('an empty instruction is explained and never sent for persistence', async ({ page }) => {
  await openSettings(page);
  await page.locator('.action-card').first().locator('summary').click();
  await page.getByRole('textbox', { name: 'Consigne Fix grammar', exact: true }).fill('   ');
  await expect(page.locator('.save-status')).toContainText('Non enregistré');
  expect(await saved(page)).toBeUndefined();
  await page.getByRole('textbox', { name: 'Consigne Fix grammar', exact: true }).fill('Corrige seulement les fautes.');
  await expect.poll(() => saved(page)).toMatchObject({ actions: expect.arrayContaining([expect.objectContaining({ id: 'correct', promptTemplate: 'Corrige seulement les fautes.' })]) });
});

test('reserved chords are refused immediately and AZERTY letters use their label', async ({ page }) => {
  await openSettings(page);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.keyboard.press('Control+F12');
  await expect(page.getByRole('alert')).toContainText('F12 est réservée');
  expect(await saved(page)).toBeUndefined();
  await page.getByRole('textbox', { name: 'Raccourci', exact: true }).dispatchEvent('keydown', { key: 'a', code: 'KeyQ', ctrlKey: true, altKey: true });
  await expect.poll(() => saved(page)).toMatchObject({ shortcutBindings: [expect.objectContaining({ shortcut: 'Ctrl+Alt+A' })] });
  await expect(page.locator('.keycaps kbd')).toHaveText(['Ctrl', 'Alt', 'A']);
});

test('settings scroll inside a fixed frame at the minimum window size', async ({ page }) => {
  await page.setViewportSize({ width: 460, height: 420 });
  await openSettings(page);
  const dimensions = await page.locator('.settings-scroll-viewport').evaluate(el => ({ height: el.clientHeight, content: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
  expect(dimensions.content).toBeGreaterThan(dimensions.height);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  await page.getByRole('button', { name: 'Ajouter un raccourci', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.locator('.settings-titlebar')).toBeInViewport();
  await expect(page.locator('.settings-window footer')).toBeInViewport();
  await page.screenshot({ path: 'test-results/actions-settings-compact.png' });
});

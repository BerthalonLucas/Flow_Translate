import { test, expect, type Page } from '@playwright/test';
import { scenarios } from '../src/lab/scenarios';

// Le thème des Réglages vient de prefers-color-scheme, pas de ?theme= : c'est l'émulation
// qui fait de -dark et -light deux images différentes. ?theme= ne décrit que le décor
// derrière le verre, qui reste graphite dans les deux cas.
async function open(page: Page, id: string, theme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`/lab-frame.html?scenario=${id}&theme=${theme}&motion=reduce`);
}

for (const theme of ['dark', 'light'] as const) {
  for (const scenario of scenarios) {
    test(`${scenario.id} / ${theme}`, async ({ page }) => {
      await open(page, scenario.id, theme);
      if (scenario.surface === 'settings') {
        await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      }
      else if (['short', 'long'].includes(scenario.id)) await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
      else if (['error', 'partial'].includes(scenario.id)) await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'error');
      else if (scenario.id === 'pending') await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'streaming');
      else if (scenario.id === 'notice') await expect(page.locator('.notice-pill')).toHaveText('Rien à traiter dans la fenêtre active.');
      await expect(page).toHaveScreenshot(`${scenario.id}-${theme}.png`);
      if (scenario.id === 'short') {
        await page.getByRole('button', { name: /(Plus d’options|Options du résultat)/ }).click();
        await expect(page.locator('.more-menu')).toBeVisible();
        await expect(page).toHaveScreenshot(`menu-${theme}.png`);
      }
    });
  }
}
// The reader band on Lucas's screens: half of 1920 and of 2560, 22/33, 45 % of the height at most.
for (const [width, height] of [[1920, 1080], [2560, 1440]]) {
  test(`reader on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, 'long', 'dark');
    await expect(page.locator('[data-lab-phase]')).toHaveAttribute('data-lab-phase', 'complete');
    await expect(page.locator('.translation-bubble')).toHaveCSS('width', `${width / 2}px`);
    await expect(page).toHaveScreenshot(`reader-${width}.png`);
  });
}
// Sous 640 px, la navigation des Réglages se replie en onglets : la fenêtre s'ouvre à
// 760 × 640, son minimum reste 460 × 420.
test('actions at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 640 });
  await open(page, 'actions', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-lab-ready', 'true');
  await expect(page).toHaveScreenshot('actions-narrow.png');
});

import { expect, test } from '@playwright/test';

test('the enlarged native overlay measures 560px from a 280px host window', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 220 });
  await page.goto('/?window=overlay&demo=1');

  await expect(page.getByRole('button', { name: 'Plus d’options' })).toBeEnabled();
  await page.locator('.standalone-demo').evaluate(element => { element.className = 'native-overlay'; });
  await page.getByRole('button', { name: 'Plus d’options' }).click();

  const enlarge = page.getByRole('menuitem', { name: 'Agrandir' });
  await expect(enlarge).toBeVisible();
  await enlarge.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('.translation-bubble')).toHaveCSS('width', '560px');
});

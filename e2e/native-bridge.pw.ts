import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    nativeFixture: {
      calls: Array<{ command: string; args?: Record<string, unknown> }>;
      capture: (id: string) => Promise<void>;
      delta: (text: string) => Promise<void>;
      done: () => Promise<void>;
    };
  }
}

test('IPC fixture: every new capture rebinds native sizing and preserves dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 220 });
  await page.route('**/?window=overlay&fixture=1', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('/src/main.tsx', '/e2e/native-fixture.ts') });
  });
  await page.goto('/?window=overlay&fixture=1');
  await expect(page.locator('.translation-bubble')).toBeVisible();
  const lastHeight = () => page.evaluate(() => window.nativeFixture.calls.filter(call => call.command === 'resize_overlay').at(-1)?.args?.height);
  await expect.poll(lastHeight).toBe(55);
  await page.evaluate(() => window.nativeFixture.delta('Une traduction assez longue pour dépasser plusieurs lignes. '.repeat(15)));
  await expect.poll(lastHeight).toBe(220);
  await page.evaluate(() => window.nativeFixture.capture('second'));
  await expect.poll(lastHeight).toBe(55);
  await page.evaluate(() => window.nativeFixture.delta('La deuxième traduction grandit elle aussi pendant le flux. '.repeat(15)));
  await expect.poll(lastHeight).toBe(220);
  await expect(page.getByRole('button', { name: 'Plus d’options', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Fermer', exact: true }).click();
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
  expect(await page.evaluate(() => window.nativeFixture.calls.some(call => call.command === 'dismiss_overlay'))).toBe(true);
  await page.evaluate(() => window.nativeFixture.delta('Late stream'));
  await expect(page.locator('.translation-bubble')).toHaveCount(0);
});

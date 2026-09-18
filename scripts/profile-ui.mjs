// Bounded synthetic Chromium rendering probe; this is not native Windows FPS.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const baseURL = process.env.FLOWTRANSLATE_PROFILE_URL ?? 'http://127.0.0.1:5173';
const output = resolve(process.argv[2] ?? 'test-results/ui-profile.json');
const browser = await chromium.launch({ headless: true });
const report = { label: process.argv[3] ?? 'working-tree', measuredAt: new Date().toISOString(),
  environment: 'Headless Chromium, 1280x800, deviceScaleFactor=1; simulated translation; no native acrylic',
  browser: browser.version(), samples: [] };
const percentile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)] : null;
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const scenario of ['selection', 'long']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion });
      const page = await context.newPage();
      await page.addInitScript(() => {
        const probe = { frameIntervals: [], longTasks: [], stopped: false };
        window.__flowRenderProbe = probe;
        const observer = new PerformanceObserver(list => {
          for (const item of list.getEntries()) probe.longTasks.push(item.duration);
        });
        observer.observe({ type: 'longtask', buffered: true });
        let previous;
        const frame = now => {
          if (probe.stopped) { observer.disconnect(); return; }
          if (previous !== undefined) probe.frameIntervals.push(now - previous);
          previous = now;
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.goto(`${baseURL}/?window=overlay&demo=1&scenario=${scenario}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Copier le résultat', exact: true }).waitFor();
      // Exercise the actual simulated stream, menu open/close and bounded idle.
      await page.waitForFunction(() => {
        const copy = document.querySelector('button[aria-label="Copier le résultat"]');
        return copy && !copy.disabled;
      }, undefined, { timeout: 10_000 });
      await page.getByRole('button', { name: 'Plus d’options', exact: true }).click();
      await page.getByRole('menu').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
      const result = await page.evaluate(() => { window.__flowRenderProbe.stopped = true; return window.__flowRenderProbe; });
      const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]));
      report.samples.push({ scenario, reducedMotion, measuredFrames: result.frameIntervals.length,
        medianFrameIntervalMs: percentile(result.frameIntervals, .5), p95FrameIntervalMs: percentile(result.frameIntervals, .95),
        intervalsOver32ms: result.frameIntervals.filter(value => value > 32).length,
        longTaskCount: result.longTasks.length, maxLongTaskMs: Math.max(0, ...result.longTasks),
        layoutCount: metrics.LayoutCount, recalcStyleCount: metrics.RecalcStyleCount,
        layoutDurationMs: metrics.LayoutDuration * 1000, scriptDurationMs: metrics.ScriptDuration * 1000,
        taskDurationMs: metrics.TaskDuration * 1000, jsHeapUsedBytes: metrics.JSHeapUsedSize });
      await context.close();
    }
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

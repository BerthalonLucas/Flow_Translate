import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

// Agent worktrees live under .claude/worktrees: full copies of the repository whose HTML
// pages, sources and tests must be neither crawled for dependencies, watched nor run.
const foreign = ['**/.claude/**', '**/design-lab/**'];

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // The e2e IPC fixture is the only importer of the Tauri mocks: discovered late, they would
  // make Vite re-optimise mid-run, which fails on Windows (EPERM renaming .vite/deps).
  optimizeDeps: { entries: ['index.html', 'lab.html', 'lab-frame.html', 'e2e/native-fixture.ts'] },
  server: { watch: { ignored: foreign } },
  test: { environment: 'jsdom', globals: true, exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'visual-tests/**', ...foreign] }
});

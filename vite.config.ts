import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: { environment: 'jsdom', globals: true, exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'visual-tests/**'] }
});

import type { Theme } from './types';

export type ResolvedTheme = 'light' | 'dark';

// « Thème : suivre Windows / clair / sombre ». In WebView2, prefers-color-scheme follows the
// Windows app mode; the resolved theme is written as data-theme on <html> for the CSS tokens.
export function resolveTheme(preference: Theme, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDark ? 'dark' : 'light';
}

// Applies the theme now and follows the system while the preference is « system ».
export function applyTheme(preference: Theme, root: HTMLElement = document.documentElement): () => void {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  const update = () => { root.dataset.theme = resolveTheme(preference, Boolean(query?.matches)); };
  update();
  if (preference !== 'system' || !query) return () => undefined;
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}

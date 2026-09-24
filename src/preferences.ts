import { useEffect } from 'react';
import { applyTheme } from './theme';
import { applyMotion } from './motion/preference';
import type { Settings } from './types';

// Document-level preferences of every window: the interface language, the Îlot switch, the
// theme and the motion. Before the settings load, the system decides theme and motion.
export function useDocumentPreferences(settings: Settings | null) {
  const root = document.documentElement;
  const theme = settings?.theme ?? 'system';
  const motion = settings?.motion ?? 'system';
  useEffect(() => {
    root.lang = settings?.language ?? 'en';
    root.dataset.ui = settings?.uiVersion ?? 'v4';
  }, [root, settings?.language, settings?.uiVersion]);
  useEffect(() => applyTheme(theme, root), [root, theme]);
  useEffect(() => applyMotion(motion, root), [root, motion]);
}

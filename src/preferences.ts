import { useEffect } from 'react';
import { applyTheme } from './theme';
import { applyMotion } from './motion/preference';
import { applyMotionPreset } from './motion/tokens';
import type { Settings } from './types';

// Document-level preferences of every window: the interface language, the Îlot switch, the
// theme, the motion and its preset (CSS custom properties for the animations Motion does not
// drive). Before the settings load, the system decides theme and motion.
export function useDocumentPreferences(settings: Settings | null) {
  const root = document.documentElement;
  const theme = settings?.theme ?? 'system';
  const motion = settings?.motion ?? 'system';
  const preset = settings?.motionPreset ?? 'smooth';
  useEffect(() => {
    root.lang = settings?.language ?? 'en';
    root.dataset.ui = settings?.uiVersion ?? 'v4';
  }, [root, settings?.language, settings?.uiVersion]);
  useEffect(() => applyTheme(theme, root), [root, theme]);
  useEffect(() => applyMotion(motion, root), [root, motion]);
  useEffect(() => applyMotionPreset(preset, root), [root, preset]);
}

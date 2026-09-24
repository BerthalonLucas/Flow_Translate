import { useEffect, useState } from 'react';
import { bridge } from './bridge';
import type { Settings } from './types';

// The settings every window reads for its appearance (language, theme, motion): loaded once,
// then kept current through `settings-changed`. The overlay and the settings window still
// hold their own copy for their logic; this one only feeds document-level preferences.
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    let disposed = false;
    let off: (() => void) | undefined;
    void bridge.getSettings().then(next => { if (!disposed) setSettings(next); }).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', next => { if (!disposed) setSettings(next); }).then(unlisten => {
      if (disposed) unlisten(); else off = unlisten;
    });
    return () => { disposed = true; off?.(); };
  }, []);
  return settings;
}

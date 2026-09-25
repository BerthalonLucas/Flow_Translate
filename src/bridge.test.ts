import { describe, expect, it, vi } from 'vitest';
import { bridge } from './bridge';

// The browser preview (no Tauri): the Îlot commands answer without a native window.
describe('bridge preview', () => {
  it('answers the AltGr question for French AZERTY (lot 4)', async () => {
    expect(await bridge.shortcutConflict('Ctrl+Alt+E')).toEqual({ altGr: true, character: '€' });
    expect(await bridge.shortcutConflict('Ctrl+Alt+Digit0')).toEqual({ altGr: true, character: '@' });
    expect(await bridge.shortcutConflict('Ctrl+Alt+Space')).toEqual({ altGr: false });
    expect(await bridge.shortcutConflict('Ctrl+Shift+E')).toEqual({ altGr: false });
  });
  it('starts from the defaults of a fresh install', async () => {
    const settings = await bridge.getSettings();
    expect(settings.defaultActionId).toBe('correct');
    expect(settings.menuActionIds).toEqual(['correct', 'translate', 'professionalize', 'shorten', 'email']);
    expect(settings.shortcutBindings.map(binding => [binding.kind, binding.shortcut])).toEqual([['menu', 'Ctrl+Alt+Space']]);
    // The Îlot, as Rust's UiVersion::Ilot.
    expect(settings.uiVersion).toBe('ilot');
  });
  it('asks for the 0.4 journey with ?ui=v4 only', async () => {
    const at = location.href;
    const loaded = async (search: string) => {
      history.replaceState(null, '', `/${search}`);
      vi.resetModules();
      return (await (await import('./bridge')).bridge.getSettings()).uiVersion;
    };
    try {
      expect(await loaded('?ui=v4')).toBe('v4');
      expect(await loaded('?ui=v5')).toBe('ilot');
      expect(await loaded('')).toBe('ilot');
    } finally {
      history.replaceState(null, '', at);
      vi.resetModules();
    }
  });
});

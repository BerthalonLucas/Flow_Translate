import { invoke } from '@tauri-apps/api/core';
import { bridge } from './bridge';

// The glass's own side of the bridge. 0.5.0 splits the overlay from the settings window,
// and each side names what it needs: the settings window keeps `src/bridge.ts`. Until the
// two halves meet again this module carries what the overlay alone calls — `open_settings`
// with a target — over the shared transport. The duplication leaves with the split.

export type SettingsPage = 'actions' | 'reading' | 'engines' | 'privacy';
export type SettingsTarget = { page: SettingsPage; actionId?: string; engine?: 'fast' | 'quality'; reason?: string };

// One spelling for both gateways (contract § 6): natively the settings window reads its
// page from `take_settings_target()`, in the browser preview from these parameters.
export function settingsSearch(target?: SettingsTarget): string {
  const params = new URLSearchParams({ window: 'settings' });
  if (target) {
    params.set('page', target.page);
    if (target.actionId) params.set('actionId', target.actionId);
    if (target.engine) params.set('engine', target.engine);
  }
  params.set('demo', '1');
  return `?${params}`;
}

export const overlay = {
  ...bridge,
  // Without an argument Rust reads it as { page: "actions" }; a glass error names the
  // engine card of the profile that failed.
  openSettings: async (target?: SettingsTarget) => {
    if (bridge.native) return invoke<void>('open_settings', target ? { target } : {});
    location.assign(settingsSearch(target));
  },
};

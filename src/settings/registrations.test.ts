import { describe, expect, it } from 'vitest';
import type { ShortcutStatus } from '../types';
import { registrationOf } from './registrations';

describe('registrationOf', () => {
  const statuses: ShortcutStatus[] = [
    { bindingId: 'menu', shortcut: 'Ctrl+Alt+Space', state: 'taken' },
    { bindingId: 'direct', shortcut: 'Ctrl+Alt+T', state: 'failed' },
    { bindingId: 'off', shortcut: 'Ctrl+Alt+O', state: 'disabled' },
  ];
  it('gives each binding what Windows answered for its chord', () => {
    expect(registrationOf(statuses, { id: 'menu', shortcut: 'Ctrl+Alt+Space' })).toBe('taken');
    expect(registrationOf(statuses, { id: 'direct', shortcut: 'ctrl + alt + t' })).toBe('failed');
    expect(registrationOf(statuses, { id: 'off', shortcut: 'Ctrl+Alt+O' })).toBe('disabled');
  });
  it('says nothing for a chord Windows has not answered for yet, nor before any answer', () => {
    // Just recorded: the next `shortcut-status` will tell.
    expect(registrationOf(statuses, { id: 'menu', shortcut: 'Ctrl+Shift+Space' })).toBeUndefined();
    expect(registrationOf(statuses, { id: 'unknown', shortcut: 'Ctrl+Alt+U' })).toBeUndefined();
    expect(registrationOf(null, { id: 'menu', shortcut: 'Ctrl+Alt+Space' })).toBeUndefined();
  });
});

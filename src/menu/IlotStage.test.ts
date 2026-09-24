import { describe, expect, it } from 'vitest';
import { defaultActions } from '../actionDefaults';
import type { ActionDefinition, Settings } from '../types';
import { menuActions } from './IlotStage';

const extra: ActionDefinition[] = [
  { id: 'summary', name: 'Summarise', promptTemplate: 'x' },
  { id: 'formal', name: 'Formal', promptTemplate: 'x' },
];
const settingsWith = (menuActionIds: string[], actions: ActionDefinition[] = [...defaultActions, ...extra]) => ({ actions, menuActionIds }) as unknown as Settings;

describe('the Îlot’s actions in the overlay', () => {
  it('follows menuActionIds in the user’s order and drops ids that no longer exist', () => {
    expect(menuActions(settingsWith(['email', 'gone', 'correct', 'summary'])).map(action => action.id)).toEqual(['email', 'correct', 'summary']);
  });
  it('falls back to the first six actions without a menu, and never shows more than six', () => {
    expect(menuActions(settingsWith([])).map(action => action.id)).toEqual(['correct', 'translate', 'professionalize', 'shorten', 'email', 'summary']);
    expect(menuActions(settingsWith(['summary', 'formal', 'correct', 'translate', 'professionalize', 'shorten', 'email']))).toHaveLength(6);
    expect(menuActions(null)).toEqual([]);
  });
  it('keeps an action without a letter letterless: Rust assigns the letters', () => {
    expect(menuActions(settingsWith(['summary'])).map(action => action.key)).toEqual([undefined]);
  });
});

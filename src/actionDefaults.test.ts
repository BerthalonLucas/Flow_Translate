import { describe, expect, it } from 'vitest';
import { defaultActionId, defaultActions, defaultBindings, defaultMenuActionIds, newActionTemplate, outputRules, promptError } from './actionDefaults';

describe('editable instructions', () => {
  it('accepts each preset, the new-action template and any plain instruction', () => {
    for (const action of defaultActions) {
      expect(promptError(action.promptTemplate)).toBeNull();
      expect(action.promptTemplate.endsWith(outputRules)).toBe(true);
      expect(action.promptTemplate).not.toContain('{{');
    }
    expect(promptError(newActionTemplate)).toBeNull();
    expect(promptError('Corrige sans changer la langue.')).toBeNull();
  });
  it('names both languages in the one translation preset (French ↔ English)', () => {
    const translate = defaultActions.find(a => a.id === 'translate')?.promptTemplate;
    expect(translate).toContain('If the text is in French, translate it into English; otherwise translate it into French.');
  });
  it('mirrors the fresh install of Rust: five actions of the grid, one menu shortcut', () => {
    expect(defaultActions.map(a => [a.id, a.name, a.key, a.shortName, a.icon])).toEqual([
      ['correct', 'Fix grammar', 'F', 'Fix', 'SpellCheck'],
      ['translate', 'Translate', 'T', 'Translate', 'Languages'],
      ['professionalize', 'Make professional', 'P', 'Pro', 'BriefcaseBusiness'],
      ['shorten', 'Shorten', 'S', 'Shorten', 'FoldVertical'],
      ['email', 'Write email', 'E', 'Email', 'Mail'],
    ]);
    expect(defaultMenuActionIds).toEqual(['correct', 'translate', 'professionalize', 'shorten', 'email']);
    expect(defaultActionId).toBe('correct');
    expect(defaultBindings).toEqual([{ id: 'menu', kind: 'menu', shortcut: 'Ctrl+Alt+Space', actionId: 'correct', outputMode: 'replace', enabled: true }]);
  });
  it('rejects empty, oversized and null-bearing instructions', () => {
    for (const prompt of ['', '   ', 'a\0b', 'a'.repeat(8001)]) expect(promptError(prompt)).not.toBeNull();
  });
});

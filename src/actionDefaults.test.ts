import { describe, expect, it } from 'vitest';
import { defaultActions, newActionTemplate, outputRules, promptError } from './actionDefaults';

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
  it('names the language in the two translation presets', () => {
    expect(defaultActions.find(a => a.id === 'translate-fr')?.promptTemplate).toContain('into French');
    expect(defaultActions.find(a => a.id === 'translate-en')?.promptTemplate).toContain('into English');
  });
  it('rejects empty, oversized and null-bearing instructions', () => {
    for (const prompt of ['', '   ', 'a\0b', 'a'.repeat(8001)]) expect(promptError(prompt)).not.toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { defaultActions, promptError } from './actionDefaults';

describe('editable prompts', () => {
  it('accepts each preset and a correction without a target language', () => {
    for (const action of defaultActions) expect(promptError(action.promptTemplate)).toBeNull();
    expect(promptError('Corrige sans changer la langue : {{text}}')).toBeNull();
  });
  it('rejects missing, duplicate, unknown variables and oversized prompts', () => {
    for (const prompt of ['', 'Texte', '{{text}} {{text}}', '{{text}} {{other}}', '{{text}}\0', 'a'.repeat(8000) + '{{text}}']) {
      expect(promptError(prompt)).not.toBeNull();
    }
  });
});

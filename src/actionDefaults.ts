import type { ActionDefinition, ShortcutBinding } from './types';

export const defaultActions: ActionDefinition[] = [
  { id: 'translate', name: 'Traduire', promptTemplate: 'Translate the following text into {{targetLanguage}}. Output only the translated result without any additional explanation:\n{{text}}' },
  { id: 'correct', name: 'Corriger', promptTemplate: 'Correct spelling, grammar and punctuation. Preserve the original language and meaning. Output only the corrected text:\n{{text}}' },
  { id: 'professionalize', name: 'Professionnaliser', promptTemplate: 'Rewrite the text in a clear, professional tone. Preserve its language and meaning. Output only the rewritten text:\n{{text}}' },
];
export const defaultBindings: ShortcutBinding[] = [{ id: 'primary', shortcut: 'Ctrl+Alt+T', actionId: 'translate', outputMode: 'display', enabled: true }];
export function promptError(template: string): string | null {
  if (!template.trim() || [...template].length > 8000 || template.includes('\0')) return 'Le prompt doit contenir de 1 à 8 000 caractères, sans caractère nul.';
  if ((template.match(/\{\{text\}\}/g) ?? []).length !== 1) return 'Le prompt doit contenir exactement une variable {{text}}.';
  if (/\{\{|\}\}/.test(template.replaceAll('{{text}}', '').replaceAll('{{targetLanguage}}', ''))) return 'Variable inconnue : utilisez {{text}} et éventuellement {{targetLanguage}}.';
  return null;
}


import type { MessageKey, Translate } from '../i18n';

// Rust still refuses a save with a French sentence (lot 10 turns errors into codes). The
// refusals the Settings window can meet are shown in the interface's language; any other
// message stays as Rust wrote it (it never holds a payload or a secret).
const refusals: Record<string, MessageKey> = {
  'Le raccourci est déjà utilisé ou indisponible.': 'shortcuts.taken',
  'Deux raccourcis actifs utilisent la même combinaison.': 'shortcuts.duplicate',
  'Le raccourci n’est pas reconnu.': 'shortcuts.unknown',
  'Le raccourci est trop long.': 'shortcuts.unknown',
  'La touche Windows est réservée au système.': 'shortcuts.windowsKey',
  'F12 est réservée par Windows.': 'shortcuts.f12',
  'Ajoutez Ctrl ou Alt à la combinaison.': 'shortcuts.needModifier',
  'Cette combinaison est réservée à Windows.': 'shortcuts.system',
  'La touche d’une action est une seule lettre.': 'grid.lettersInvalid',
  'La touche d’une action est une lettre, différente pour chaque action.': 'grid.lettersInvalid',
  'La grille du menu contient six actions au plus.': 'grid.tooMany',
  'La consigne doit contenir de 1 à 8 000 caractères, sans caractère nul.': 'actions.promptInvalid',
  'Démarrage automatique indisponible.': 'settings.autostartUnavailable',
};

export function describeRefusal(message: string, t: Translate): string {
  const key = refusals[message.trim()];
  return key ? t(key) : message;
}

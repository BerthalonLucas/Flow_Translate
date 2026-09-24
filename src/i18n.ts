import { useSyncExternalStore } from 'react';
import type { Language } from './types';

// The interface language (docs/DA-PLAN.md, lot 1): English by default, French complete.
// No dependency: one typed dictionary, `t(key, params)`, and a hook that follows
// settings.language. Action names are user data and never pass through here; the
// French messages Rust sends stay as they are until the error codes of lot 10.
const dictionary = {
  // Overlay: the glass, its pill and its menu.
  'glass.copy': { en: 'Copy translation', fr: 'Copier la traduction' },
  'glass.more': { en: 'More options', fr: 'Plus d’options' },
  'glass.close': { en: 'Close', fr: 'Fermer' },
  'glass.pin': { en: 'Pin', fr: 'Épingler' },
  'glass.unpin': { en: 'Unpin', fr: 'Détacher' },
  'glass.actions': { en: 'Translation actions', fr: 'Actions de traduction' },
  'glass.menu': { en: 'Translation options', fr: 'Options de traduction' },
  'glass.document': { en: 'Translation', fr: 'Traduction' },
  'glass.original': { en: 'Original', fr: 'Original' },
  'glass.working': { en: 'Translating', fr: 'Traduction en cours' },
  'glass.replaced': { en: 'Selection replaced', fr: 'Sélection remplacée' },
  'glass.complete': { en: 'Translation complete', fr: 'Traduction terminée' },
  'glass.copied': { en: 'Translation copied', fr: 'Traduction copiée' },
  'glass.errorHint': { en: 'Settings and Try again are in the ⋯ menu.', fr: 'Réglages et Réessayer dans le menu ⋯.' },
  'menu.showOriginal': { en: 'Show original', fr: 'Afficher l’original' },
  'menu.hideOriginal': { en: 'Hide original', fr: 'Masquer l’original' },
  'menu.replace': { en: 'Replace', fr: 'Remplacer' },
  'menu.retry': { en: 'Try again', fr: 'Réessayer' },
  'menu.rerun': { en: 'Run again in {mode}', fr: 'Relancer en {mode}' },
  'menu.settings': { en: 'Settings', fr: 'Réglages' },
  'menu.close': { en: 'Close', fr: 'Fermer' },
  'feedback.pasted': { en: 'Result pasted into the selection.', fr: 'Résultat collé dans la sélection.' },
  'feedback.copyRefused': { en: 'Copy was refused.', fr: 'La copie a été refusée.' },
  'feedback.replaceUnavailable': { en: 'Replace is unavailable; use Copy.', fr: 'Remplacement indisponible; utilisez Copier.' },
  'feedback.displayUnavailable': { en: 'Display unavailable. Try again.', fr: 'Affichage indisponible. Réessayez.' },
  'feedback.moveUnavailable': { en: 'Moving unavailable. Try again.', fr: 'Déplacement indisponible. Réessayez.' },
  'feedback.openSettingsFromTray': { en: 'Open the settings from the FlowTranslate icon.', fr: 'Ouvrez les réglages depuis l’icône FlowTranslate.' },
  'error.failed': { en: 'The translation did not complete.', fr: 'La traduction n’a pas abouti.' },
  'error.startFailed': { en: 'The action could not start.', fr: 'L’action n’a pas pu démarrer.' },
  'error.deliveryTimeout': { en: 'The replacement did not answer; the result stays in the bubble.', fr: 'Le remplacement n’a pas répondu; le résultat reste dans la bulle.' },
  'init.connection': { en: 'The connection to FlowTranslate is unavailable.', fr: 'La connexion à FlowTranslate est indisponible.' },
  'init.close': { en: 'Closing failed. Try again.', fr: 'La fermeture a échoué. Réessayez.' },
  'init.restart': { en: 'Restart the app if the problem persists.', fr: 'Relancez l’application si le problème persiste.' },
  'common.retry': { en: 'Try again', fr: 'Réessayer' },
  'common.close': { en: 'Close', fr: 'Fermer' },
  'common.settings': { en: 'Settings', fr: 'Réglages' },
  'mode.quality': { en: 'Quality', fr: 'Qualité' },
  'mode.fast': { en: 'Fast', fr: 'Rapide' },
  // Capsule (removed with the Îlot, still routed today).
  'capsule.show': { en: 'Show translation', fr: 'Afficher la traduction' },
  'capsule.settings': { en: 'Open settings', fr: 'Ouvrir les réglages' },
  // Browser preview.
  'preview.label': { en: 'Browser preview · simulated response', fr: 'Aperçu navigateur · réponse simulée' },
  'preview.backgrounds': { en: 'Preview background', fr: 'Fond de l’aperçu' },
  'preview.light': { en: 'Light', fr: 'Clair' },
  'preview.dark': { en: 'Dark', fr: 'Sombre' },
  'preview.color': { en: 'Color', fr: 'Coloré' },
  'demo.mail': { en: 'Mail', fr: 'Courrier' },
  'demo.messages': { en: 'Messages', fr: 'Messages' },
  'demo.settings': { en: 'Settings', fr: 'Réglages' },
  'demo.newMessage': { en: '✉ New message', fr: '✉ Nouveau message' },
  'demo.search': { en: 'Search', fr: 'Rechercher' },
  'demo.send': { en: 'Send', fr: 'Envoyer' },
  'demo.to': { en: 'To', fr: 'À' },
  'demo.badge': { en: 'Browser preview', fr: 'Aperçu navigateur' },
  'demo.intro': { en: 'Simulated responses. This preview checks the components; Windows rendering, focus and moving are tested in the app.', fr: 'Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.' },
  'demo.scenario': { en: 'Scenario', fr: 'Scénario' },
  'demo.selection': { en: 'Selection', fr: 'Sélection' },
  'demo.clipboard': { en: 'Clipboard', fr: 'Presse-papiers' },
  'demo.long': { en: 'Long text', fr: 'Texte long' },
  'demo.veryLong': { en: 'Very long text', fr: 'Texte très long' },
  'demo.error': { en: 'Network error', fr: 'Erreur réseau' },
  'demo.start': { en: 'Simulate Ctrl + Alt + T', fr: 'Simuler Ctrl + Alt + T' },
  'demo.openSettings': { en: 'Open settings', fr: 'Voir les réglages' },
  // Settings window.
  'settings.title': { en: 'Settings', fr: 'Réglages' },
  'settings.windowTitle': { en: 'FlowTranslate Settings', fr: 'Réglages FlowTranslate' },
  'settings.close': { en: 'Close', fr: 'Fermer' },
  'settings.loading': { en: 'Loading settings…', fr: 'Chargement des réglages…' },
  'settings.loadError': { en: 'Settings are unavailable. Try again or restart FlowTranslate.', fr: 'Les réglages sont indisponibles. Réessayez ou redémarrez FlowTranslate.' },
  'settings.notSaved': { en: 'Settings were not saved.', fr: 'Les réglages n’ont pas été enregistrés.' },
  'settings.appearance': { en: 'Appearance', fr: 'Apparence' },
  'settings.language': { en: 'Language', fr: 'Langue' },
  'settings.languageHelp': { en: 'Menus, messages and settings. Action names stay as written.', fr: 'Menus, messages et réglages. Les noms des actions restent tels quels.' },
  'settings.theme': { en: 'Theme', fr: 'Thème' },
  'settings.themeHelp': { en: 'Follow Windows, or keep one look.', fr: 'Suivre Windows, ou garder un seul aspect.' },
  'settings.themeSystem': { en: 'Follow Windows', fr: 'Suivre Windows' },
  'settings.themeLight': { en: 'Light', fr: 'Clair' },
  'settings.themeDark': { en: 'Dark', fr: 'Sombre' },
  'settings.translation': { en: 'Translation', fr: 'Traduction' },
  'settings.defaultProfile': { en: 'Default profile', fr: 'Profil par défaut' },
  'settings.defaultProfileHelp': { en: 'Quality: slower, better phrasing. Can be changed from the bubble menu.', fr: 'Qualité : plus lent, meilleures tournures. Changeable depuis le menu de la bulle.' },
  'settings.textSize': { en: 'Text size', fr: 'Taille du texte' },
  'settings.textSizeHelp': { en: 'Short glass 16, 18 or 20 px; reader 22, 24 or 26 px. The reader takes half the screen.', fr: 'Verre court 16, 18 ou 20 px ; lecteur 22, 24 ou 26 px. Le lecteur occupe la moitié de l’écran.' },
  'settings.textNormal': { en: 'Normal', fr: 'Normale' },
  'settings.textLarge': { en: 'Large', fr: 'Grande' },
  'settings.textXLarge': { en: 'Extra large', fr: 'Très grande' },
  'settings.autoClose': { en: 'Auto close', fr: 'Fermeture automatique' },
  'settings.autoCloseHelp': { en: 'The estimated reading time, then a fade. Hovering, scrolling or pinning holds it.', fr: 'Le temps de lecture estimé, puis un fondu. Survoler, faire défiler ou épingler la retient.' },
  'settings.closeFast': { en: 'Fast', fr: 'Rapide' },
  'settings.closeNormal': { en: 'Normal', fr: 'Normale' },
  'settings.closeSlow': { en: 'Slow', fr: 'Lente' },
  'settings.closeNever': { en: 'Never', fr: 'Jamais' },
  'settings.device': { en: 'On this device', fr: 'Sur cet appareil' },
  'settings.history': { en: 'Keep encrypted history', fr: 'Conserver l’historique chiffré' },
  'settings.historyHelp': { en: '7 days, 100 entries, protected by Windows (DPAPI). Nothing leaves the device.', fr: '7 jours, 100 entrées, protégé par Windows (DPAPI). Rien ne quitte l’appareil.' },
  'settings.historyRemove': { en: 'Delete this entry', fr: 'Supprimer cette entrée' },
  'settings.historyEmpty': { en: 'No saved translations.', fr: 'Aucune traduction enregistrée.' },
  'settings.historyCountOne': { en: '{count} entry', fr: '{count} entrée' },
  'settings.historyCountOther': { en: '{count} entries', fr: '{count} entrées' },
  'settings.historyClear': { en: 'Delete all', fr: 'Tout supprimer' },
  'settings.deleteFailed': { en: 'Deletion failed.', fr: 'La suppression a échoué.' },
  'settings.autostart': { en: 'Start when you sign in', fr: 'Lancer à l’ouverture de session' },
  'settings.autostartHelp': { en: 'Only the notification area icon shows at rest.', fr: 'Seule l’icône de notification est visible au repos.' },
  'settings.connection': { en: 'Connection', fr: 'Connexion' },
  'settings.check': { en: 'Check', fr: 'Vérifier' },
  'settings.checking': { en: 'Checking…', fr: 'Vérification…' },
  'settings.connected': { en: 'Connected · {ms} ms', fr: 'Connecté · {ms} ms' },
  'settings.connectionFailed': { en: 'Connection failed', fr: 'Échec de connexion' },
  'settings.notChecked': { en: 'Not checked', fr: 'Non vérifié' },
  'settings.checkImpossible': { en: 'Check failed. Start the server, then try again.', fr: 'Vérification impossible. Démarrez le serveur puis réessayez.' },
  'settings.endpoint': { en: 'Address', fr: 'Adresse' },
  'settings.model': { en: 'Model', fr: 'Modèle' },
  'settings.apiKey': { en: 'API key', fr: 'Clé API' },
  'settings.apiKeyPlaceholder': { en: 'Optional for a local server', fr: 'Facultative pour un serveur local' },
  'settings.apiKeyProtected': { en: 'Protected by Windows', fr: 'Protégée par Windows' },
  'settings.previewConnection': { en: 'Browser preview · simulated connection', fr: 'Aperçu navigateur · connexion simulée' },
  'settings.saveRetry': { en: 'Not saved — try again', fr: 'Non enregistré — réessayer' },
  'settings.savedNow': { en: 'Saved just now', fr: 'Enregistré à l’instant' },
  'settings.saving': { en: 'Saving…', fr: 'Enregistrement…' },
  'settings.saved': { en: 'Saved', fr: 'Enregistré' },
  'settings.quit': { en: 'Quit FlowTranslate', fr: 'Quitter FlowTranslate' },
  'settings.resize': { en: 'Resize settings', fr: 'Redimensionner les réglages' },
  'settings.resizeHint': { en: 'Drag to resize', fr: 'Glisser pour redimensionner' },
  'settings.resizeUnavailable': { en: 'Resizing unavailable. Use the window edges.', fr: 'Redimensionnement indisponible. Utilisez les bords de la fenêtre.' },
  // Actions and shortcuts.
  'actions.title': { en: 'Actions and instructions', fr: 'Actions et consignes' },
  'actions.intro': { en: 'The instruction alone; the selected text is sent after it.', fr: 'La consigne seule ; le texte sélectionné est envoyé après elle.' },
  'actions.add': { en: 'Add an action', fr: 'Ajouter une action' },
  'actions.newName': { en: 'New action', fr: 'Nouvelle action' },
  'actions.default': { en: 'Default action', fr: 'Action par défaut' },
  'actions.untitled': { en: 'Untitled action', fr: 'Action sans nom' },
  'actions.builtIn': { en: 'Built-in', fr: 'Prédéfinie' },
  'actions.custom': { en: 'Custom', fr: 'Personnalisée' },
  'actions.name': { en: 'Action name', fr: 'Nom de l’action' },
  'actions.instruction': { en: 'Instruction', fr: 'Consigne' },
  'actions.instructionFor': { en: 'Instruction {name}', fr: 'Consigne {name}' },
  'actions.instructionHelp': { en: 'Write the language you want in the instruction. The output rules at the end keep small models to the text alone.', fr: 'Écrivez la langue voulue dans la consigne. Les règles de sortie à la fin gardent les petits modèles au texte seul.' },
  'actions.promptInvalid': { en: 'The instruction must hold 1 to 8,000 characters, without a null character.', fr: 'La consigne doit contenir de 1 à 8 000 caractères, sans caractère nul.' },
  'actions.restore': { en: 'Restore the instruction', fr: 'Rétablir la consigne' },
  'actions.inUseHint': { en: 'First change the shortcuts and the default action that use it.', fr: 'Changez d’abord les raccourcis et l’action par défaut qui l’utilisent.' },
  'actions.delete': { en: 'Delete action', fr: 'Supprimer l’action' },
  'actions.inUse': { en: ' · in use', fr: ' · utilisée' },
  'actions.help': { en: 'Hy-MT models can only translate. To fix or rephrase, point a Connection profile to a general model (the “general” profile of the bundled server, or any OpenAI-compatible server).', fr: 'Les modèles Hy-MT ne savent que traduire. Pour corriger ou reformuler, pointez un profil de Connexion vers un modèle généraliste (le profil « general » du serveur livré, ou tout serveur compatible OpenAI).' },
  'shortcuts.title': { en: 'Shortcuts', fr: 'Raccourcis' },
  'shortcuts.intro': { en: 'One combination, one action, one destination.', fr: 'Une combinaison, une action, une destination.' },
  'shortcuts.add': { en: 'Add a shortcut', fr: 'Ajouter un raccourci' },
  'shortcuts.enable': { en: 'Enable this shortcut', fr: 'Activer ce raccourci' },
  'shortcuts.on': { en: 'On', fr: 'Actif' },
  'shortcuts.off': { en: 'Off', fr: 'Désactivé' },
  'shortcuts.delete': { en: 'Delete this shortcut', fr: 'Supprimer ce raccourci' },
  'shortcuts.field': { en: 'Shortcut', fr: 'Raccourci' },
  'shortcuts.press': { en: 'Press the combination…', fr: 'Pressez la combinaison…' },
  'shortcuts.unset': { en: 'Not set', fr: 'À définir' },
  'shortcuts.cancel': { en: 'Cancel', fr: 'Annuler' },
  'shortcuts.change': { en: 'Change', fr: 'Modifier' },
  'shortcuts.action': { en: 'Action', fr: 'Action' },
  'shortcuts.result': { en: 'Result', fr: 'Résultat' },
  'shortcuts.display': { en: 'Show in the bubble', fr: 'Afficher dans la bulle' },
  'shortcuts.replace': { en: 'Replace the selection', fr: 'Remplacer la sélection' },
  'shortcuts.saved': { en: 'Shortcut saved.', fr: 'Raccourci enregistré.' },
  'shortcuts.windowsKey': { en: 'The Windows key is reserved for the system.', fr: 'La touche Windows est réservée au système.' },
  'shortcuts.altGr': { en: 'AltGr cannot be part of a global shortcut.', fr: 'AltGr ne peut pas servir de raccourci global.' },
  'shortcuts.needModifier': { en: 'Add Ctrl or Alt to the combination.', fr: 'Ajoutez Ctrl ou Alt à la combinaison.' },
  'shortcuts.f12': { en: 'F12 is reserved by Windows.', fr: 'F12 est réservée par Windows.' },
  'shortcuts.system': { en: 'This combination is reserved by Windows.', fr: 'Cette combinaison est réservée à Windows.' },
  'shortcuts.badKey': { en: 'This key cannot be part of a global shortcut.', fr: 'Cette touche ne peut pas servir de raccourci global.' },
  'shortcuts.help': { en: 'Ctrl or Alt required. Windows, F12 and system combinations are refused. A new valid combination is active as soon as it is saved. “Replace the selection” pastes the result over the selected text, in any field; if the paste fails, the result stays in the bubble.', fr: 'Ctrl ou Alt requis. Windows, F12 et les combinaisons système sont refusés. Une nouvelle combinaison valide est activée dès son enregistrement. « Remplacer la sélection » colle le résultat à la place du texte sélectionné, dans n’importe quel champ ; si le collage échoue, le résultat reste dans la bulle.' },
} satisfies Record<string, Record<Language, string>>;

export type MessageKey = keyof typeof dictionary;
export const messageKeys = Object.keys(dictionary) as MessageKey[];
export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export const languages: readonly Language[] = ['en', 'fr'];
export const locales: Record<Language, string> = { en: 'en-US', fr: 'fr-FR' };

export function translate(language: Language, key: MessageKey, params?: Params): string {
  const text = dictionary[key][language] ?? dictionary[key].en;
  return params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => name in params ? String(params[name]) : whole) : text;
}

// The active language of this window: set by useDocumentPreferences from settings.language;
// every useT() re-renders at once when it changes (no reload).
let active: Language = 'en';
const listeners = new Set<() => void>();
export function setLanguage(language: Language) {
  if (language === active || !languages.includes(language)) return;
  active = language;
  listeners.forEach(listener => listener());
}
export function currentLanguage(): Language { return active; }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

// For messages composed outside a render (a timer's notice): the language at that moment.
export const t: Translate = (key, params) => translate(active, key, params);

const bound: Record<Language, Translate> = {
  en: (key, params) => translate('en', key, params),
  fr: (key, params) => translate('fr', key, params),
};
export function useLanguage(): Language { return useSyncExternalStore(subscribe, currentLanguage, currentLanguage); }
export function useT(): Translate { return bound[useLanguage()]; }

// Ce que la matrice de références doit montrer de la 1.0 : l'overlay graphite dans ses
// cinq états, et les quatre pages des Réglages dans les deux thèmes Windows. Chaque entrée
// coûte deux images (sombre et clair) : elle n'existe que si elle prouve quelque chose.
export type Surface = 'overlay' | 'settings';
export type SettingsPage = 'actions' | 'reading' | 'engines' | 'privacy';

type Entry = {
  readonly id: string;
  readonly label: string;
  readonly ref: string;
  readonly surface: Surface;
  readonly page?: SettingsPage;
  readonly history?: boolean;
  readonly expected: string;
};

export const scenarios = [
  { id: 'short', label: 'Résultat court', ref: 'UI-003', surface: 'overlay',
    expected: 'Verre court de 380 px (huit lignes au plus) ouvert depuis la pilule d’attente ; étiquette d’action, « Copier le résultat », ⋯ et Fermer dans la pilule qui mord le bord ; texte glass-ink 16/24 sur un seul graphite, sans reflet.' },
  { id: 'long', label: 'Résultat long (bande de lecture)', ref: 'UI-021', surface: 'overlay',
    expected: 'Bande centrée en bas, moitié de la largeur de la zone (450 px ici), 22/33, hauteur au plus 45 % de l’écran puis défilement ; Copier · Épingler · ⋯ · Fermer ; aucun « Agrandir ».' },
  { id: 'pending', label: 'Attente du moteur', ref: 'UI-023', surface: 'overlay',
    expected: 'Pilule seule de 60 × 28 avec LoaderCircle 18 px (un tour par seconde), balayage signal après 1,5 s ; annulation possible ; le texte arrive d’un bloc.' },
  { id: 'partial', label: 'Réponse interrompue', ref: 'UI-003', surface: 'overlay',
    expected: 'Texte partiel identifié ; copie et remplacement désactivés.' },
  { id: 'error', label: 'Le moteur ne répond pas', ref: 'UI-003', surface: 'overlay',
    expected: 'GlassError : la raison puis quoi faire, Réessayer et Réglages en ligne. Aucune estompe et aucune fermeture automatique : l’erreur tient jusqu’à Échap, Fermer ou la capture suivante.' },
  { id: 'notice', label: 'Rien à traiter', ref: 'UI-020', surface: 'overlay',
    expected: 'Pilule seule, « Rien à traiter dans la fenêtre active. », aucune boîte de dialogue ; disparaît d’elle-même après quatre secondes (rejouée ici toutes les trois secondes).' },
  { id: 'actions', label: 'Réglages · Actions', ref: 'UX §8', surface: 'settings', page: 'actions', history: false,
    expected: 'Page d’ouverture des Réglages. Une carte par action avec ses raccourcis et sa consigne, badge « Par défaut », segment « Afficher » | « Remplacer », compteur « {n} / 8 000 ».' },
  { id: 'reading', label: 'Réglages · Lecture', ref: 'UX §8', surface: 'settings', page: 'reading', history: false,
    expected: '« Taille du texte » et « Fermeture automatique », avec l’aperçu du verre à la taille choisie. Cet aperçu porte ses propres classes (.reading-preview) : aucun des cinq sélecteurs mesurés ne sort de l’overlay.' },
  { id: 'engines', label: 'Réglages · Moteurs', ref: 'UX §8', surface: 'settings', page: 'engines', history: false,
    expected: 'Deux EngineCard seulement, Qualité et Rapide (les serveurs multiples sont 0.6.0) ; moteur par défaut, adresse vérifiée à la sortie du champ, clé « Chiffrée par Windows (DPAPI), jamais écrite en clair. ».' },
  { id: 'privacy', label: 'Réglages · Confidentialité', ref: 'UX §8', surface: 'settings', page: 'privacy', history: false,
    expected: '« Conserver l’historique chiffré » éteint et « Lancer à l’ouverture de session » ; le groupe « Historique » annonce « Aucun résultat enregistré. ».' },
  { id: 'history', label: 'Réglages · Historique rempli', ref: 'UX §8', surface: 'settings', page: 'privacy', history: true,
    expected: 'Historique activé : une ligne par résultat, « {Action} · {Qualité|Rapide} · 17 sept. 09:12 », « Copier le résultat » et « Supprimer cette entrée ». Jamais le texte source. Données fictives uniquement.' },
] as const satisfies readonly Entry[];

// Retirés de la matrice mais encore rendus : la capsule n'est plus affichée depuis le
// 10/09 et le design system ne la dessine pas. Le banc de défauts y renvoie encore, et
// l'identifiant « settings » reste l'alias de la page d'ouverture pour les liens existants.
const retired = [
  { id: 'capsule', label: 'Capsule (fenêtre retirée)', ref: 'UI-002', surface: 'overlay',
    expected: 'Conservée câblée, plus affichée ni référencée. Style graphite minimal en attendant son retrait avec les serveurs multiples.' },
] as const satisfies readonly Entry[];

const aliases: Record<string, string> = { settings: 'actions' };

export type Scenario = typeof scenarios[number]['id'] | typeof retired[number]['id'];

export function scenarioFrom(value: string | null): Entry {
  const id = (value && aliases[value]) ?? value;
  return [...scenarios, ...retired].find(item => item.id === id) ?? scenarios[0];
}

export const scenarios = [
  { id: 'short', label: 'Traduction courte', issue: 'UI-003', expected: 'Texte compact ; actions satellites ; fermeture explicite sans surface résiduelle.' },
  { id: 'long', label: 'Traduction longue', issue: 'UI-004', expected: 'Lecture complète à la molette dans un panneau plus large ; défilement discret.' },
  { id: 'pending', label: 'Attente du moteur', issue: 'UI-003', expected: 'Indicateur discret ; copie désactivée ; annulation possible.' },
  { id: 'partial', label: 'Réponse interrompue', issue: 'UI-003', expected: 'Texte partiel identifié ; copie et remplacement désactivés.' },
  { id: 'error', label: 'Erreur réseau', issue: 'UI-003', expected: 'Erreur courte, possibilité de réessayer et de fermer.' },
  { id: 'settings', label: 'Réglages', issue: 'UI-005', expected: 'Surface cohérente sur toute la fenêtre ; thème Windows ; aucune marge blanche parasite.' },
  { id: 'history', label: 'Historique de démonstration', issue: 'UI-005', expected: 'Anciennes traductions accessibles et lisibles. Données fictives uniquement.' },
  { id: 'capsule', label: 'Capsule actuelle', issue: 'UI-002', expected: 'À refaire : trait au repos, commandes au survol, déplacement avec aimantation.' },
] as const;
export type Scenario = typeof scenarios[number]['id'];
export function scenarioFrom(value: string | null) { return scenarios.find(item => item.id === value) ?? scenarios[0]; }

export const scenarios = [
  { id: 'short', label: 'Traduction courte', issue: 'UI-003', expected: 'Texte compact ; actions satellites ; fermeture explicite sans surface résiduelle.' },
  { id: 'long', label: 'Traduction longue', issue: 'UI-004', expected: 'La bulle grandit jusqu’à 220 px puis le texte défile à la molette ; indicateur discret, Agrandir depuis le menu ; 22 px entre le texte et le bord arrondi ; menu graphite dans la même matière que le verre.' },
  { id: 'pending', label: 'Attente du moteur', issue: 'UI-010', expected: 'Anneau discret, un tour en 1,4 s et un arc qui respire ; copie désactivée ; annulation possible ; le texte arrive d’un bloc.' },
  { id: 'partial', label: 'Réponse interrompue', issue: 'UI-003', expected: 'Texte partiel identifié ; copie et remplacement désactivés.' },
  { id: 'error', label: 'Erreur réseau', issue: 'UI-003', expected: 'Erreur courte, possibilité de réessayer et de fermer.' },
  { id: 'settings', label: 'Réglages', issue: 'UI-005', expected: 'Surface cohérente sur toute la fenêtre ; thème Windows ; aucune marge blanche parasite.' },
  { id: 'history', label: 'Historique de démonstration', issue: 'UI-005', expected: 'Anciennes traductions accessibles et lisibles. Données fictives uniquement.' },
  { id: 'capsule', label: 'Capsule (fenêtre retirée)', issue: 'UI-002', expected: 'Remplacée par l’onglet du verre replié ; conservée ici pour mémoire.' },
] as const;
export type Scenario = typeof scenarios[number]['id'];
export function scenarioFrom(value: string | null) { return scenarios.find(item => item.id === value) ?? scenarios[0]; }

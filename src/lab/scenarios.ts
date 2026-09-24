export const scenarios = [
  { id: 'short', label: 'Traduction courte', issue: 'UI-003', expected: 'Verre court de 380 px (huit lignes au plus) ouvert depuis la pilule d’attente ; Copier · ⋯ · Fermer ; texte #e8eaef 16/24 sur un seul graphite, sans reflet.' },
  { id: 'long', label: 'Traduction longue (lecteur)', issue: 'UI-021', expected: 'Bande centrée en bas, moitié de la largeur de la zone (450 px ici), 22/33, hauteur au plus 45 % de l’écran puis défilement ; Copier · Épingler · ⋯ · Fermer ; aucun « Agrandir ».' },
  { id: 'pending', label: 'Attente du moteur', issue: 'UI-023', expected: 'Pilule seule de 60 × 28 avec le spinner de shadcn (LoaderCircle 18 px, un tour par seconde), trait de progression après 1,5 s ; annulation possible ; le texte arrive d’un bloc.' },
  { id: 'partial', label: 'Réponse interrompue', issue: 'UI-003', expected: 'Texte partiel identifié ; copie et remplacement désactivés.' },
  { id: 'error', label: 'Erreur réseau', issue: 'UI-003', expected: 'Erreur courte, possibilité de réessayer et de fermer.' },
  { id: 'notice', label: 'Rien à traduire', issue: 'UI-020', expected: 'Pilule seule à 13 px, « Rien à traduire dans la fenêtre active », aucune boîte de dialogue ; disparaît d’elle-même après quatre secondes (rejouée ici toutes les trois secondes).' },
  { id: 'settings', label: 'Réglages', issue: 'UI-005', expected: 'Surface cohérente sur toute la fenêtre ; thème Windows ; aucune marge blanche parasite.' },
  { id: 'history', label: 'Historique de démonstration', issue: 'UI-005', expected: 'Anciennes traductions accessibles et lisibles. Données fictives uniquement.' },
  { id: 'halo', label: 'Halo : balayage de lumière', issue: 'Îlot lot 6', expected: 'Une bande par ligne sélectionnée, rayon 3 px, dégradé violet, rose, ambre à 0,32 qui passe d’une ligne à la suivante sans repartir (1,6 s) ; voile fixe dans les mêmes couleurs en animations réduites (le rendu de référence). La vraie fenêtre halo ne prend jamais un clic.' },
] as const;
export type Scenario = typeof scenarios[number]['id'];
export function scenarioFrom(value: string | null) { return scenarios.find(item => item.id === value) ?? scenarios[0]; }

export const scenarios = [
  { id: 'short', label: 'Traduction courte', issue: 'UI-003', expected: 'Verre court de 380 px (huit lignes au plus) ouvert depuis la pilule d’attente ; Copier · ⋯ · Fermer ; texte #e8eaef 16/24 sur un seul graphite, sans reflet.' },
  { id: 'long', label: 'Traduction longue (lecteur)', issue: 'UI-021', expected: 'Bande centrée en bas, moitié de la largeur de la zone (450 px ici), 22/33, hauteur au plus 45 % de l’écran puis défilement ; Copier · Épingler · ⋯ · Fermer ; aucun « Agrandir ».' },
  { id: 'pending', label: 'Attente du moteur', issue: 'UI-023', expected: 'Pilule seule de 60 × 28 avec le spinner de shadcn (LoaderCircle 18 px, un tour par seconde), trait de progression après 1,5 s ; annulation possible ; le texte arrive d’un bloc.' },
  { id: 'partial', label: 'Réponse interrompue', issue: 'UI-003', expected: 'Texte partiel identifié ; copie et remplacement désactivés.' },
  { id: 'error', label: 'Erreur réseau', issue: 'UI-003', expected: 'Erreur courte, possibilité de réessayer et de fermer.' },
  { id: 'notice', label: 'Rien à traduire', issue: 'UI-020', expected: 'Pilule seule à 13 px, « Rien à traduire dans la fenêtre active », aucune boîte de dialogue ; disparaît d’elle-même après quatre secondes (rejouée ici toutes les trois secondes).' },
  { id: 'settings', label: 'Réglages', issue: 'UI-005', expected: 'Surface cohérente sur toute la fenêtre ; thème Windows ; aucune marge blanche parasite.' },
  { id: 'history', label: 'Historique de démonstration', issue: 'UI-005', expected: 'Anciennes traductions accessibles et lisibles. Données fictives uniquement.' },
  { id: 'capsule', label: 'Capsule (fenêtre retirée)', issue: 'UI-002', expected: 'Remplacée par l’onglet du verre replié ; conservée ici pour mémoire.' },
  // Îlot, lot 8 (docs/DA-PLAN.md §9 « Indicateurs »): the working pill in each indicator; the theme is the « Fond d’essai ».
  { id: 'working-perle', label: 'Pilule de travail · Perle', issue: 'Lot 8', expected: 'Îlot : pilule de verre 44 × 28, rayon 14, vide pendant 250 ms puis la Perle (14 px, tour 3 s, respiration 0,9 ↔ 1 en 2,4 s) centrée, fondu 150 ms ; rien de textuel, la pilule ne grandit jamais ; orbe fixe en mouvements réduits.' },
  { id: 'working-nebuleuse', label: 'Pilule de travail · Nébuleuse', issue: 'Lot 8', expected: 'Îlot : pilule 44 × 28, Nébuleuse 16 px (taches bleue, corail, ambre), mélange multiply en clair, screen en sombre ; après 250 ms, centrée.' },
  { id: 'working-ruban', label: 'Pilule de travail · Ruban', issue: 'Lot 8', expected: 'Îlot : pilule 52 × 28 dès le départ (espace du Ruban 28 × 12 réservé), trois ondes bleue, corail, ambre, bords fondus ; après 250 ms, centré.' },
] as const;
export type Scenario = typeof scenarios[number]['id'];
export function scenarioFrom(value: string | null) { return scenarios.find(item => item.id === value) ?? scenarios[0]; }

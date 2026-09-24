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

// The Îlot (lot 7), apart from the list above: visual-tests/ keeps one reference image per entry
// of `scenarios`. Theme, preset (smooth / bouncy) and motion are parameters of the frame.
export const ilotScenarios = [
  { id: 'ilot-compact', label: 'Îlot au repos', issue: 'Lot 7', expected: 'Compact, 32 px de haut : dernière action (Entrée la relance) · pastille ✦. Tab, ↓ ou un survol de 450 ms déplient la grille ; F T P S E lancent ; 1-6 choisissent une tuile ; Espace ou / ouvrent la consigne ; une lettre libre ouvre la consigne déjà tapée ; Échap ferme. Un choix transforme l’Îlot en pilule (contenu factice), puis il revient.' },
  { id: 'ilot-grid', label: 'Îlot en grille', issue: 'Lot 7', expected: 'Grille 3 × 2 de tuiles 66 × 50 (218 × 116, rayon 16), surbrillance sur la dernière action ; flèches, Tab, Entrée, lettres, chiffres ; Échap revient au compact, puis ferme.' },
  { id: 'ilot-prompt', label: 'Îlot : consigne libre', issue: 'Lot 7', expected: 'Champ de 283 × 34 (saisie de 230) : un vrai champ, accents, AltGr et touches mortes compris ; Entrée envoie, Échap revient au compact. La consigne n’est affichée nulle part ailleurs.' },
  { id: 'ilot-injected', label: 'Îlot sans le clavier (repli natif)', issue: 'Lot 7', expected: 'Les touches arrivent de Rust (menu-key) : boutons « Touche reçue » en bas. La consigne libre est indisponible, pastille et tuile estompées, Espace ignoré.' },
  { id: 'ilot-pill', label: 'Îlot → pilule', issue: 'Lot 7', expected: 'La même surface, jamais démontée, devient la pilule de 44 × 28 (rayon 14) sur le ressort « morph », contenu centré ; bouton « Menu ⇄ pilule » en bas. Contenu factice : le vrai indicateur vient du lot 8.' },
] as const;
export type IlotScenario = typeof ilotScenarios[number]['id'];
export function ilotScenarioFrom(value: string | null) { return ilotScenarios.find(item => item.id === value); }

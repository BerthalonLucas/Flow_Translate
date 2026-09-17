# Overlay

Une session de l’overlay telle que le produit la pose : le verre, la pilule d’actions qui mord son bord haut droit, le menu ⋯ contre la pilule, un retour sous le verre (au-dessus en placement bas).

## Quand
Tout résultat d’action affiché : verre court (`form="short"`, 8 lignes au plus à 380 px), bande de lecture (`form="reader"`), pilule seule (`form="pending"`) avant le premier résultat et en mode Remplacer. Une relance depuis un verre ouvert (Réessayer, Relancer en …) garde la forme et passe `busy`.

La forme ne décide pas du placement. `placement="anchored"` : près de la sélection. `placement="bottom"` : en bas au centre de l’écran du curseur, pour la bande de lecture mais aussi pour un verre court sans ancre (copie faite par FlowTranslate sans rectangle de sélection, « Revoir le dernier résultat », source longue au résultat court). En bas, le menu s’ouvre au-dessus de la pilule, le retour se tient au-dessus du verre et la pilule d’attente est centrée.

## À fournir
- `children` : le texte du résultat, ou `GlassError` / `PartialNote`.
- `placement` : `anchored` ou `bottom` ; par défaut `bottom` pour la bande, `anchored` sinon.
- `tag` : `ExecutionInfo.actionName` tel quel (le nom de l’action, 60 caractères au plus), coupé par des points de suspension au-delà de 132 px de contenu ; `tagTitle` « Nom de l’action · moteur ».
- `menuItems` quand le menu est ouvert, `feedback` pour un `Notice size="sm"` (caché tant que le menu est ouvert), `busy` pendant une relance.

## Géométrie (contrat natif)
`glass-width` 380, `radius-glass` 28, `pill-height` 28, `pill-inset` 16, `pill-overlap` 14, `menu-width` 196, halo 32/20/44. Ces valeurs vivent aussi dans `src/layout.ts` et le hit-test Rust : les changer ici sans y toucher casse le placement.

## Règles
- L’overlay est toujours graphite (`glass`), quel que soit le thème Windows.
- Rien ne change de taille pendant une interaction : entrées et sorties sont opacité, transform ou clip-path.
- Le verre ne prend jamais le focus à l’apparition ; Entrée copie quand la lecture a le focus, Échap ferme le menu puis le verre.

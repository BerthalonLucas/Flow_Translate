# ActionPill

La pilule opaque qui mord le bord haut droit du verre : étiquette d’action, Copier, Épingler (bande de lecture seulement), ⋯, Fermer.

## Nouveau en 1.0
L’étiquette d’action (`tag`) dit quelle action a produit le texte, indispensable depuis que plusieurs raccourcis coexistent. Elle affiche `ExecutionInfo.actionName` tel quel, commence par un tiret de surligneur (`signal`), est coupée par des points de suspension au-delà de 132 px et porte le nom de l’action et le moteur en `title`.

## États
- Copier : coche `signal` 1,6 s (« Copié »), sans changer la largeur.
- Épingler : `aria-pressed`, fond `glass-pressed`, épingle en `signal`.
- ⋯ ouvert : `aria-expanded`, fond `glass-pressed`.
- Copier est désactivé tant que le résultat n’est pas complet.

## Règles
- Boutons de 24 px (`pill-button`), icônes 15 px (croix 13), focus `signal` 2 px.
- Jamais plus de quatre boutons ; toute autre commande va dans le menu.
- Sans action connue (capture sans `execution`, comme l’aperçu navigateur), ni étiquette ni filet. Une relecture depuis la zone de notification garde l’étiquette de son action.

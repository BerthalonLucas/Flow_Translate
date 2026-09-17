# Button

Les boutons des Réglages : `primary` (un par page au plus, `signal` + `on-signal`), `secondary` (champ + contour), `ghost` (texte), `danger` (texte `danger`, survol `danger-soft`) ; `IconButton` pour une icône seule.

## Tailles
`md` 32 px (`control-md`), `sm` 28 px (`control-sm`) dans les cartes et les lignes.

## Règles
- Libellé à l’infinitif : « Vérifier », « Ajouter un raccourci », « Supprimer l’action ». Jamais « OK ».
- En cours : désactiver et changer le libellé (« Vérification… »), pas de spinner dans un bouton principal.
- `IconButton` exige `label` (nom accessible et infobulle).
- Focus : anneau `focus` 2 px à 2 px du bord.
- Dans le verre, utiliser les puces de `GlassError`, pas `Button`.

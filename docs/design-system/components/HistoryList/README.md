# HistoryList

Les derniers résultats enregistrés (historique chiffré, sur activation) : texte sur une ligne, « Action · Moteur · date », suppression unitaire, Tout supprimer, état vide.

## À fournir
`entries` déjà formatées (`text` = le résultat, `meta` avec une date absolue `fr-FR` « 17 sept. 09:12 »), `onRemove(id)`, `onClear`.

## Règles
- Visible seulement quand « Conserver l’historique chiffré » est activé.
- Jamais le texte source ; ni recherche ni export.
- Tout supprimer n’ouvre pas de confirmation modale : l’action est nommée clairement, placée à part, en `danger`.

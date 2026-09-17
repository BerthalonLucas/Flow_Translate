# TextArea

La zone de consigne d’une action : chasse fixe (`prompt`, Cascadia Mono 12/18), redimensionnable en hauteur, compteur de caractères sur 8 000.

## À fournir
`label`, `value`, `onChange`, `hint` ; `error` quand la consigne est vide ou trop longue (le compteur reste visible).

## Règles
Pas de correcteur orthographique (`spellCheck=false`) : la consigne est souvent en anglais pour les petits modèles. Le texte sélectionné n’apparaît jamais dans cette zone.

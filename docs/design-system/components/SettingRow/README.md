# SettingRow

Une ligne de réglage : libellé `label`, description `caption` en `ink-muted`, contrôle aligné à droite ; groupées dans une carte par `SettingGroup`.

## À fournir
`label`, `description` (une phrase courte), un contrôle en enfant : `Segmented`, `Switch` ou un `Button size="sm"`. `icon` seulement quand la ligne ouvre un sujet (Historique).

## Règles
- Hauteur 56 px au moins ; filet `line` entre deux lignes, jamais autour.
- Un changement s’enregistre aussitôt (interrupteurs, segments) ou 300 ms après la frappe : pas de bouton Enregistrer.
- Sous 640 px, le contrôle passe sous le texte.

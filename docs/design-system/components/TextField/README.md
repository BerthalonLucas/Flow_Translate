# TextField

Champ de saisie des Réglages, avec `SelectField` pour une liste : fond `surface-field`, contour `line-strong`, trait bas `field-underline` qui passe à `focus` au focus.

## À fournir
`label` visible au-dessus (jamais un simple placeholder), `value`, `onChange(value)` ; `hint` pour une aide d’une ligne, `error` pour un refus (icône `triangle-alert`, texte `warning`).

## Règles
- Adresse de moteur : `type="url"`, exemple en placeholder. Clé API : `type="password"`, `autoComplete="new-password"`, mention « Chiffrée par Windows (DPAPI) ».
- Enregistrement 300 ms après la dernière frappe ; l’erreur apparaît sous le champ, jamais dans une boîte.
- Deux champs côte à côte (`ft-grid-2`) passent l’un sous l’autre sous 640 px.

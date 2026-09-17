# Segmented

Un choix parmi deux à quatre options courtes, enregistré dès le clic : Taille du texte, Fermeture automatique, Moteur par défaut, Afficher / Remplacer.

## À fournir
`label` (nom du groupe radio), `value`, `options` (libellés d’un ou deux mots), `onChange`. `size="sm"` dans une ligne de raccourci.

## Règles
- Piste `surface-sunken`, segment choisi `surface-inverse` / `on-inverse` avec `shadow-thumb` ; graisse constante (500) pour que rien ne saute.
- Flèches gauche et droite changent la valeur ; un seul arrêt de tabulation.
- Plus de quatre options ou des libellés longs : une liste (`SelectField`).

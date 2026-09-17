# Mark

La marque FlowTranslate : trois lignes de texte, celle du milieu passée au surligneur, avec la pointe biseautée d’un marqueur.

## Usage
- Tuile graphite (`variant="tile"`, défaut) : icône d’application, barre de titre des Réglages, installateur.
- Glyphe (`variant="glyph"`) : sur une surface claire ou sombre quand une tuile ferait double cadre ; les lignes prennent `currentColor`, la bande reste `signal`.
- Zone de notification : jamais la tuile en couleur, toujours les SVG monochromes du groupe **Tray** (repos, travail, alerte).

## À fournir
`size` en px ; `title` seulement quand aucun nom n’est écrit à côté.

## À ne pas faire
- Pas de dégradé, d’ombre ni de reflet sur la tuile.
- Ne pas recolorer la bande : elle est `signal` (#ffd24a) partout, sauf en zone de notification où tout est d’une seule encre.
- Sous 16 px, utiliser l’icône de zone de notification, pas la tuile.

Remplace `src-tauri/icons/mark.svg` (tuile #1d1f24, trois traits, coche bleue).

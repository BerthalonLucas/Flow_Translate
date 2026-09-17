# Glass

La surface de lecture : du texte seul dans un verre graphite aux coins de 28 px, sans en-tête, sans pied, sans barre de défilement visible.

## Formes
- Court : 380 px, texte `glass-copy` (16/24, 18/27, 20/30 selon « Taille du texte »), marges `glass-pad-*` 16/22/13, 8 lignes au plus.
- Bande de lecture : moitié de la zone de travail, `reader-copy` (22/33 à 26/39) en Segoe UI Variable Display, marges 18/28/16, hauteur au plus 45 % de l’écran, fondus de bord et indicateur 3 px au survol ou au défilement (800 ms).

## Contenu
- Résultat : `glass-ink`. Sélection de texte : `selection` (le surligneur à 30 %).
- Original : bloc `glass-raised` au-dessus, étiquette « Original » en `glass-ink-subtle`, texte deux pixels sous le résultat (14/20 en Normale) en `glass-ink-muted`.
- Erreur : `GlassError` — icône `glass-danger`, une phrase sur ce qui s’est passé, une phrase sur quoi faire, puis **Réessayer** (puce `signal`) et **Réglages**. Plus de « Réglages et Réessayer dans le menu ⋯ ».
- Résultat partiel : `PartialNote` sous le texte, icône `glass-warning`.
- Relance (Réessayer, Relancer en …) : le verre garde sa forme, son placement, l’étiquette d’action et l’original s’il est affiché ; le texte fait place à la roue sur la première ligne (`busy` sans enfants) ; Copier et Relancer sont désactivés.

## Focus
La lecture est un arrêt de tabulation : au focus clavier, le verre entier prend l’anneau `signal` 2 px, posé à l’intérieur de son contour (jamais sur la page derrière, où le jaune n’a que 1,4:1 sur blanc).

## Mouvement
Ouverture du verre court : clip-path depuis la ligne de la pilule, 260 ms `cubic-bezier(.2,0,0,1)`, texte en fondu 180 ms après 80 ms. Bande : montée de 8 px et fondu, 220 ms. Estompe : `opacity-dimmed` en 600 ms, tenue 1,4 s, sortie 300 ms.

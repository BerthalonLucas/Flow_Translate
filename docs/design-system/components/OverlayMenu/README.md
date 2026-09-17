# OverlayMenu

Le menu ⋯ du résultat : même graphite que le verre, une icône par entrée, un seul séparateur avant Fermer.

## Entrées, dans cet ordre
1. Afficher / Masquer l’original (`eye` / `eye-off`)
2. Remplacer (`clipboard-paste`), seulement si la sélection est encore valide ; ou Réessayer (`rotate-ccw`) après une erreur
3. Relancer en Qualité / Rapide (`refresh-cw`)
4. Réglages (`settings-2`)
5. Fermer (`x`, indication « Échap »), après le séparateur

## Règles
- Six entrées au plus : la réserve native fait 236 px ; une entrée fait 32 px (`menu` 13/16 + 8 × 2).
- Sous la pilule en placement ancré (près de la sélection) ; au-dessus de la pilule, 6 px d’écart, en placement bas (bande de lecture, mais aussi verre court sans ancre, issu d’une source longue ou relu depuis la zone de notification) ; 196 px de large.
- Libellés à l’infinitif, sans point ni points de suspension. Entrée désactivée à `opacity-disabled`.
- Clavier : flèches, Entrée, Échap ; l’entrée active prend la surbrillance `glass-hover`.

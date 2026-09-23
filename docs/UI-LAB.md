# Labo d’interface (23 septembre 2026)

Page unique de test, tout en données simulées : `docs/design/labo-flowtranslate.html`, source dans `design-lab/`.
Reconstruire : `cd design-lab && npm install && npm run build` (esbuild, React 18 chargé depuis cdnjs).

Vérifié dans Chromium (Playwright, navigateur seulement) : parcours au clavier des 10 menus, erreurs et
renvoi vers le champ fautif des Réglages, effets sur le texte, annulation par Ctrl+Z, galeries, largeur
400 px sans défilement horizontal, mode « animations réduites ». Rien n’est validé dans la vraie
fenêtre Windows.

## Contenu

- Faux bureau avec un mail de trois paragraphes et des sorties préécrites par action.
- 10 menus Ctrl+Alt : Îlot, Éventail, Invite, Boussole, Molette, Touches, Tonalité, Aperçu direct,
  Recette, Writing Tools (référence Apple).
- 23 indicateurs de chargement (points, orbes, symbole, anneaux, barres, lignes, effets de pilule,
  plus le spinner actuel comme témoin), chacun avec ses réglages.
- 7 effets sur le texte sélectionné pendant le travail (piste « sans bulle » façon Writing Tools).
- Arrivée du texte (net, fondu, flou → net, mot à mot), mots changés (surlignés, soulignés), coche,
  Annuler avec compte à rebours.
- Mouvement : préréglages Apple (snappy, smooth, bouncy), Windows 11 Fluent, Material 3 Expressive,
  Emil Kowalski ; éditeur ressort (durée + rebond) ou courbe ; vitesse ½× à ⅒×.
- Matières : verre Apple clair, dépoli, liquide (filtre SVG), clair opaque, Acrylic simulé
  (coins 8 px), verre sombre, graphite 0.4.0.
- Bouton « Copier ma config » : résumé lisible plus JSON, à recoller dans la conversation.

## Constats des recherches

- **Animations coupées par Windows.** WebView2 suit « Effets d’animation » (Accessibilité → Effets
  visuels). L’app respecte ce réglage : désactivé, aucune animation n’est visible. Prévoir
  « Animations : suivre Windows / toujours / réduites ».
- **Ctrl+Alt = AltGr sur AZERTY.** Ctrl+Alt seul se déclenche en tapant @, €, #… et Ctrl+Alt+T
  entre en conflit avec `{` sur l’AZERTY AFNOR. Ctrl+Alt+Espace, Maj deux fois ou une touche F
  sont sûrs.
- **Verre réel.** Une fenêtre WebView2 transparente ne voit pas le bureau : `backdrop-filter` n’y
  floute rien. Options : Acrylic Windows (`DWMSBT_TRANSIENTWINDOW`) avec une fenêtre par surface,
  coins imposés à 8 ou 4 px, pas de fondu CSS, matériau plat quand la fenêtre est inactive
  (à contourner avec `WM_NCACTIVATE`) ; ou capture de l’écran sous la pilule (question de
  confidentialité) ; ou verre « peint » sans transparence réelle. Un essai natif d’un à deux jours
  est nécessaire avant de choisir.
- **Chargement.** Pas d’indicateur sous 250 à 500 ms (aucun clignotement pour une réponse rapide) ;
  animation calme ; au-delà d’environ 2,5 s, ajouter un libellé plutôt qu’une fausse progression.
- **Mouvement.** Entrée 140 à 200 ms, sortie plus courte que l’entrée, jamais d’échelle depuis 0
  (0,95 environ), ressorts pour les changements de forme, pas d’animation pour une action répétée
  cent fois par jour si elle ralentit.
- **Erreurs.** Erreur de configuration → bouton vers le champ exact (adresse, clé, modèle) ;
  erreur transitoire → Réessayer ; sélection modifiée → rien remplacé, résultat à copier.

Sources principales : NN/g (temps de réponse, indicateurs de progression, messages d’erreur),
documentation SwiftUI `Spring`, *Motion in Windows* et jetons Fluent 2, jetons Material 3,
code source de Motion (motion.dev), Emil Kowalski (animations.dev, Sonner), dépôts
jacobamobin/AppleIntelligenceGlowEffect, rdev/liquid-glass-react et shuding/liquid-glass,
documentation Microsoft DWM et tauri-apps/window-vibrancy.

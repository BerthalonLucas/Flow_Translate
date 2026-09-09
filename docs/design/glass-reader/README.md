# Exploration verre et lecteur bas

Statut : Lucas a choisi la pilule horizontale chevauchant légèrement le bord supérieur droit, d'après sa capture Claude Design. La planche C applique ce choix ; matière et présentation du lecteur bas sont montrées pour validation avant intégration. Ces images ne remplacent pas encore les références approuvées dans leur ensemble.

## Intention confirmée le 9 septembre 2026

- Verre graphite translucide contenant uniquement la traduction.
- Copier et Plus dans une petite pilule horizontale à cheval sur le bord supérieur droit ; le texte ne passe pas sous la pilule.
- Traduction courte près de la sélection ; traduction longue dans un lecteur plus large centré en bas du moniteur.
- Aucune barre de défilement visible dans une microbulle. Le traitement des textes dépassant le lecteur (défilement discret ou pagination) reste à valider.
- Astra reste propriétaire du frontend, raisonnement medium minimum (high pour cette exploration).

## Images générées

- [A — satellite latéral](a-satellite.png) : actions verticales à droite, pour texte court et lecteur bas.
- [B — pilule sous la bulle](b-under-bubble.png) : actions horizontales sous le bord droit, pour les deux présentations.
- [C — pilule chevauchante](c-overlapping-pill.png) : disposition préférée par Lucas, reprise pour texte court et lecteur bas. Cette planche remplace A et B pour l'emplacement des actions.

Les deux planches sont des maquettes raster générées avec l'outil intégré image_gen ; leurs dimensions, leur dépoli et leurs textes ne prouvent pas le rendu natif. Aucun fichier de l'interface exécutable n'a changé pour cette exploration. Les prompts exacts sont conservés dans PROMPTS.md.

## Préparation technique par Astra — propositions

Le pont actuel limite la largeur à 420 px : un lecteur autour de 560–640 px nécessitera une évolution explicite du contrat et du placement natif. Détecter les textes probablement longs avant le premier fragment ; ne pas déplacer la fenêtre à chaque token. Si la traduction dépasse l'estimation, une seule transition peut être proposée à la complétion. Conserver la traduction complète et toujours copier tout le résultat.

Séparer la surface du texte et la pilule dans TranslationBubble/BubbleMenu. Les interstices transparents nécessitent un traitement natif des clics : pointer-events CSS ne fait pas traverser une fenêtre Windows. Conserver Motion, Radix et Lucide. Prévoir réduction des mouvements et validation réelle de la transparence, du focus, du déplacement et des transitions Tauri.

Les images ne présentent pas encore le cas extrêmement long ou l'animation. Ces états suivront après choix du style.

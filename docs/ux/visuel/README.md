# Étude visuelle de la bulle d’actions

Maquettes HTML rendues à l’échelle 1 pour juger la bulle d’actions à l’œil avant de l’écrire, pendant
la réflexion UX du 17/09/2026. Elles servent la spec voisine (`../SPEC-UX.md`), qui les cite ; la bulle
elle-même est prévue pour la 0.8.0.

- `bulles.html` → `v1-*` à `v5-*` : cinq formes de bulle, chacune posée sur deux contextes crédibles,
  un mail sur page claire et une messagerie sombre. `v4-*` montre pourquoi la barre horizontale a été
  écartée : avec les quatre noms écrits elle atteint 620 px, sans eux on ne lit plus les actions. **V5 est la forme retenue.**
- `transition.html` → `t1-*` à `t5-*` : l’instant d’après, de la bulle au verre — bulle, fondu,
  pilule d’attente, résultat affiché, remplacement.
- `shoot.mjs` : rend chaque `.shot` d’une page en PNG (`node shoot.mjs bulles.html`), avec le Chromium
  de Playwright du dépôt.

Ce ne sont pas des captures de l’application : Outlook et la messagerie sont dessinés en HTML, et le
contenu des messages est un exemple neutre, écrit pour la maquette.

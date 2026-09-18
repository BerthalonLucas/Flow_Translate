# Rapports des unités

Le workflow a été coupé par la limite de session : deux unités ont rendu leur rapport, les trois autres ont été interrompues en cours de travail. L’état réel de chaque branche est décrit dans `REPRISE.md`.

---

## unité:marque

- Branche : `wt-050-marque`
- Dernier commit : `1e2c6097d66573e20e2a002b3d8ada1ceb1abcd8`

### Ce qui a été fait

Le worktree était neuf (HEAD sur b42312a) : rebranché sur 2fbfdac via `git checkout -B wt-050-marque 2fbfdac`.

Deux commits, 20 fichiers, tous dans le lot marque (`scripts/build-icons.mjs`, `scripts/check-icons.mjs`, `src-tauri/icons/`). Ni `tauri.conf.json`, ni Rust, ni `package.json` touchés.

**8120cc7 — la chaîne**
`scripts/build-icons.mjs` rasterise les SVG du design system avec le Chromium de `@playwright/test`, sans nouvelle dépendance. Plutôt que `page.screenshot`, il dessine le SVG à sa taille intrinsèque dans un canevas (width/height de la balise racine réécrits, aucune mise à l'échelle) et récupère les octets RGBA bruts par `getImageData` ; l'encodage PNG est fait en Node (RGBA 8 bits, filtre None, IHDR/IDAT/IEND seuls, CRC32 maison). Conséquence utile : les PNG livrés n'ont ni chunk annexe ni variation d'encodeur, et la seconde génération sort identique octet pour octet. L'ICO est assemblé à la main — répertoire d'entrées puis PNG concaténés, 256 déclaré 0 sur son octet, plans 1, 32 bpp.

`scripts/check-icons.mjs` embarque son propre décodeur PNG (profondeur 8, types 0/2/3/4/6, filtres 0 à 4) et **réécrit l'inventaire attendu au lieu de l'importer du générateur** : un contrôle qui lirait sa liste dans le script qu'il contrôle ne contrôlerait rien. 175 assertions de propriétés, jamais d'empreinte : existence, dimensions réelles relues dans l'IHDR, structure de l'ICO (5 entrées, tailles déclarées, chaque couche redécodée et remesurée), pixels témoins des six glyphes (encre `#ffffff` ou `#16171b` sur ligne haute, bande et ligne basse ; fond transparent au coin), moitié droite de la bande à 35 % pour `busy` et pleine ailleurs, pastille `#e5534b` comptée présente dans les deux `alert` et à **zéro pixel** partout ailleurs. Pour la tuile : fond graphite, bande `#ffd24a`, les deux lignes claires, le coin arrondi transparent, et la dissymétrie (ligne basse plus courte) — sur les PNG comme sur chaque couche de l'ICO. Sous 32 px les traits d'encre passent sous le pixel : le contrôle y bascule sur une mesure de contraste (luminance max dans la bande de la ligne haute ≥ 120 contre ~23 pour la tuile), ce qui teste la lisibilité réelle plutôt qu'une teinte que l'antialiasing ne peut pas rendre.

**1e2c609 — les images**
Tuile graphite au surligneur (l'ancienne coche bleue disparaît) : `icon.png` 512, `128x128@2x.png` 256, `128x128.png`, `32x32.png`, `icon.ico` en 16/24/32/48/256, et `mark.svg` remplacé par la source vectorielle nouvelle identité — mêmes noms qu'avant, `tauri.conf.json` n'a pas eu à bouger. Six glyphes de notification en `src-tauri/icons/tray/<nom>.png` (16) et `<nom>@2x.png` (32), aux noms exacts du contrat § 5.

### Vérifications lancées

- `node scripts/build-icons.mjs` → 18 fichiers régénérés depuis docs/design-system/assets/ (4 PNG d'application, icon.ico, mark.svg, 12 glyphes de notification).
- `node scripts/check-icons.mjs` → 175 contrôles passés, exit 0.
- `node scripts/check-icons.mjs — trois tests négatifs` → Le contrôle mord bien. (1) Glyphe alerte remplacé par le glyphe repos → 2 échecs, exit 1 (« pastille rouge présente — 0 pixels »). (2) 32x32.png remplacé par le 128, tray-busy-light-taskbar@2x.png supprimé, icon.ico tronqué à 4000 o → 3 échecs, exit 1 (dimensions 128×128, fichier absent, entrée 4 hors du fichier).
- `cargo build (src-tauri/, CARGO_TARGET_DIR partagé)` → Finished dev profile en 22,6 s — tauri-codegen lit et parse le nouvel icon.ico à la compilation. Vérifié aussi en négatif : avec un ICO tronqué, cargo build échoue en exit 101 sur generate_context!() avec « failed to parse icon … icons/icon.ico: failed to fill whole buffer ». C'est la preuve que ce fichier est bien un point de passage pour tout le dépôt, pas une simple icône. Rebuild vert après régénération.
- `npm run build` → vite v8.2.2, 2341 modules, built in 661 ms — aucun fichier du front touché, sanity OK.
- `git status après une seconde génération (index à jour)` → Arbre propre, git diff vide : la seconde passe reproduit les 18 fichiers octet pour octet sur cette machine.
- `Inspection visuelle (planche de contact Chromium, envoyée à Lucas)` → Les cinq couches de l'ICO agrandies : la tuile reste lisible à 16 px, les trois lignes et la bande au surligneur restent distinctes. Les six glyphes posés sur #202020 et #f3f3f3 : encre correcte selon la barre des tâches, moitié droite estompée pour busy, ligne haute raccourcie et pastille rouge en haut à droite pour alert.
- `git diff 2fbfdac..HEAD --name-only` → 20 fichiers, tous dans scripts/build-icons.mjs, scripts/check-icons.mjs et src-tauri/icons/. Aucun fichier hors lot, aucune ligne d'attribution dans les deux messages de commit, aucun push.

### Écarts au contrat

Le contrat a été suivi sans déviation. Trois points à signaler pour l'après-fusion, aucun ne demande d'action d'une autre unité.

**1. La couche 64 de l'ICO disparaît.** L'ICO de 0.4.0 portait six entrées (16, 24, 32, 48, **64**, 256) ; le contrat § 5 en fixe cinq, « (16, 24, 32, 48, 256) », et c'est ce que je livre. Conséquence réelle et mineure : dans l'affichage « Grandes icônes » de l'Explorateur, Windows interpole désormais le 48 vers 64 au lieu de tirer une couche dessinée. Si Lucas la veut, c'est une valeur à ajouter dans `ICO_SIZES` des deux scripts, rien d'autre — le générateur et le contrôle la prendront telles quelles.

**2. `mark.svg` : le contrat le nomme sans dire ce qu'il doit contenir.** Il ne sert à rien dans le code (aucune référence dans `tauri.conf.json`, le Rust, le front ou les scripts PowerShell — vérifié par grep). Je l'ai remplacé par la source vectorielle de la nouvelle tuile, pour qu'aucun fichier du dépôt ne porte encore l'ancienne identité (coche bleue `#b8d7ff` sur `#1d1f24`). Si l'intention était d'en faire le glyphe sans tuile, c'est `flowtranslate-glyph-light.svg` qu'il faudrait copier à la place — une ligne dans `build-icons.mjs`.

**3. Ce que mon lot ne peut pas prouver seul.** Le contrôle vérifie que les douze PNG de notification existent, mesurent bien 16 et 32, et portent la bonne encre. Que le natif les *trouve* à l'exécution — déclaration `"resources": ["icons/tray/*.png"]`, résolution par `BaseDirectory::Resource`, `@2x` au-delà de 1,5 — appartient à l'unité natif, et le bundling des ressources n'est exercé que par `tauri build`, hors acceptation des unités par le contrat. Le repli silencieux sur `app.default_window_icon()` couvre le cas où mon lot arriverait en dernier ; dans l'autre sens, si le natif arrive sans le mien, rien ne casse non plus.

Signalé aussi, sans conséquence : le README des Logos décrit la pastille d'alerte comme « 6 px » et le SVG la dessine en `r="3"` centrée à `cx="13" cy="3"` — donc bien 6 px de diamètre, mais tangente au bord haut de la grille. Le rendu est correct, la pastille n'est simplement pas détourée du côté supérieur. Je n'ai pas touché aux SVG, qui sont en lecture seule.

### Pas fait

Rien du périmètre de l'unité marque n'est resté de côté. Les limites volontaires, toutes conformes au contrat :

- **`tauri build` n'a pas été lancé** : le contrat le met hors acceptation des unités (« `cargo build` ne bundle pas les ressources ») et le réserve à une passe unique après la fusion. C'est donc après la fusion, et seulement là, que la copie effective de `src-tauri/icons/tray/*.png` dans les ressources de l'application installée sera exercée.
- **Aucun essai en vraie zone de notification** : le chargement à l'exécution, le choix de variante par `SystemUsesLightTheme` et la relecture sur `WM_SETTINGCHANGE` sont du code Rust, propriété de l'unité natif. Je n'ai pas touché au Rust ni à `tauri.conf.json`.
- **Aucune modification de `tauri.conf.json`** : les noms de l'icône d'application sont inchangés, donc il n'y avait rien à y faire. La ligne `"resources": ["icons/tray/*.png"]` revient au natif.
- **Rien dans `docs/design-system/`** : lecture seule. Les SVG livrés ont été rasterisés tels quels, sans retouche de tracé, d'encre ou de grille.
- **Aucun serveur LLM ni processus GPU sollicité**, aucun push, aucun fichier hors lot, et ni le zip d'exploration, ni `release/`, ni `test-results/`, ni `playwright-report/` n'ont approché l'index.
- **Déterminisme octet pour octet non promis** : le contrat l'écarte explicitement comme critère. Je l'ai constaté sur cette machine (seconde génération, arbre propre) et je le rapporte comme observation, pas comme garantie — un changement de pilote ou de fontes peut le faire bouger sans qu'aucune propriété contrôlée ne dérive.

---

## unité:atelier

- Branche : `wt-050-atelier`
- Dernier commit : `5b5f6a56962f59202d2ea127daf52cedf0439ba5`

### Ce qui a été fait

Le worktree partait de b42312a : rebranché sur 2fbfdac par `git checkout -B wt-050-atelier 2fbfdac`, puis trois commits (b74919a, 4145478, 5b5f6a5). Dix fichiers touchés, tous de l'atelier ; aucun fichier d'une autre unité modifié (vérifié par `git diff --stat 2fbfdac HEAD -- e2e/native-*.ts src/App.tsx src/styles.css src/glass.css src/layout.ts` : vide).

Le mensonge des références est réparé à sa cause. `src/lab/frame.tsx` applique désormais la règle de `src/main.tsx` (contrat § 6) : `data-theme` vient de `matchMedia('(prefers-color-scheme: dark)')` pour les scénarios Réglages, `dark` en dur pour l'overlay et la capsule, réévalué au changement. `documentElement.style.colorScheme` n'est posé que pour les Réglages — vérifié dans le navigateur : un scénario overlay sous `colorScheme: light` émulé ressort `data-theme=dark`, `style.colorScheme` vide, `getComputedStyle(...).colorScheme` à `normal`, donc rien ne peint la racine d'une fenêtre transparente. `?theme=` ne pilote plus que `data-preview-background`.

La matrice passe de neuf à onze scénarios et de 23 à 27 images : les quatre pages des Réglages (`actions`, `reading`, `engines`, `privacy`) en sombre et en clair, `history` (Confidentialité avec l'historique activé, défilé sur le groupe), le verre dans ses cinq états plus l'avis, `menu-*`, `reader-1920/2560`, `actions-narrow`. La capsule sort de la matrice et de la navigation des états (décision 13) mais reste rendue par `lab-frame.html?scenario=capsule` pour le banc de défauts. `scenarioFrom` garde l'alias `settings` → `actions`, pour que l'URL `?scenario=settings&surface=production` du test que les Réglages reprennent continue de résoudre.

`frame.tsx` écrit l'orthographe du contrat dans l'URL avant le rendu (`window=settings&page=<page>&demo=1`), sans nouvelle prop sur `SettingsWindow`. Il pose `data-lab-ready` après `[data-settings-ready="true"]` ou, à défaut, après un repli borné de 1,5 s — ce qui rend le banc utilisable avant comme après le portage des Réglages —, plus `data-lab-history` pour que l'isolation de la fixture se vérifie sans `.history`.

Les deux fichiers de test de l'atelier adressent le verre par ses points d'accroche gelés et par les trois motifs tolérants du § 14. Le premier test de `reported-defects.pw.ts` (fond des Réglages) est supprimé ici : il part chez les Réglages. Deux tests nouveaux prouvent le signal de thème dans les deux sens.

`tsconfig.test.json` couvre `e2e` et `visual-tests` avec son propre `tsBuildInfoFile`, et `tsconfig.json` le référence.

### Vérifications lancées

- `npm ci` → vert — 0 vulnérabilité
- `npx tsc -b tsconfig.app.json` → vert — le code applicatif compile
- `npx vite build` → vert — built in 602ms, dist/ produit
- `npm run build` → ROUGE — `tsc -b` échoue sur 7 erreurs préexistantes dans e2e/native-bridge.pw.ts et e2e/native-fixture.ts, fichiers du verre que je n'ai pas touchés. Ni `tsc -b tsconfig.app.json` ni `vite build` ne bronchent : c'est le nouveau projet de test, ajouté aux references comme le contrat § 12 l'exige, qui les révèle.
- `npx tsc -b tsconfig.test.json` → ROUGE pour la même raison, et pour elle seule. Détail : e2e/native-bridge.pw.ts:12 déclare `done: () => Promise<void>` alors que e2e/native-fixture.ts:49 implémente `done: (text?: string)` et que quatre appels (478, 495, 513, 542) lui passent le texte final ; e2e/native-fixture.ts:23/26/29, `args` de `mockIPC` est `InvokeArgs` (= Record<string, unknown> | number[]), pas `Record<string, unknown>`.
- `npx tsc --ignoreConfig --noEmit <options de tsconfig.test.json> e2e/workbench.pw.ts e2e/reported-defects.pw.ts visual-tests/states.spec.ts src/env.d.ts` → vert — les fichiers de test que l'atelier possède compilent tous
- `$env:FLOWTRANSLATE_TEST_PORT='5313'; npx playwright test e2e/workbench.pw.ts e2e/reported-defects.pw.ts` → vert — 13 passed (15,5 s), dans un worktree où le verre et les Réglages sont encore en 0.4.0
- `$env:FLOWTRANSLATE_TEST_PORT='5314'; npx playwright test --config playwright.visual.config.ts --list` → vert — 25 tests, soit 27 images (les deux tests `short` en produisent deux chacun)
- `Vérification manuelle dans le navigateur sur le serveur Vite du worktree` → scenario=privacy sous colorScheme light émulé : data-theme=light, style color-scheme: light ; scenario=short sous la même émulation : data-theme=dark, aucun color-scheme inline, computed `normal` ; scenario=history : défilement posé sur le groupe Historique, data-lab-history=true

### Écarts au contrat

1. **`npm run build` est rouge sur ma branche, et le restera sur main si le verre ne corrige pas ses deux fichiers.** Le contrat § 12 impose d'ajouter `tsconfig.test.json` aux `references` de `tsconfig.json` ; `npm run build` lance `tsc -b` sans argument, donc le projet de test entre dans la construction. Les 7 erreurs sont antérieures à mon travail (fichiers intacts depuis 2fbfdac) et appartiennent au verre, qui doit les voir par sa propre invocation autonome. Je suis le contrat plutôt que de retenir la référence en silence, mais **à vérifier explicitement au moment de la fusion** : si le verre ne les a pas corrigées, la CI de main casse.

2. **`include` de `tsconfig.test.json` : j'ai ajouté `src/env.d.ts` aux deux dossiers prévus par le § 12.** Ce n'est pas un module importé mais la déclaration ambiante de `__APP_VERSION__` (injecté par `vite.config.ts`), que `tsconfig.app.json` voit par son `include: ["src"]`. Sans elle, tout fichier de test qui atteint `src/App.tsx` est rouge sur `TS2304: Cannot find name '__APP_VERSION__'`. L'invocation autonome du verre et des Réglages butera sur la même chose. La liste du § 12 est donc incomplète, pas fausse.

3. **`e2e/reported-defects.pw.ts:7` employait `process.env.FLOWTRANSLATE_EVIDENCE_STAGE`** dans le test qui part chez les Réglages. Sans `@types/node`, ce test ne type-checkera pas dans `tsconfig.test.json` une fois recopié dans `e2e/settings-surface.pw.ts` : les Réglages devront soit lire la variable autrement, soit le signaler. Je ne l'ai pas résolu, le fichier ne m'appartient plus.

4. **Alias de scénario, non prévu par le contrat.** Les Réglages reprennent le premier test de `reported-defects.pw.ts` tel quel, avec son URL `?scenario=settings&surface=production`. J'ai renommé le scénario `settings` en `actions` (la matrice a maintenant quatre pages) : sans alias, cette URL retombait sur le premier scénario, un overlay, et leur test devenait faux après la fusion. `scenarioFrom` résout donc `settings` → `actions`. Le paramètre `surface` n'a plus d'effet et est simplement ignoré. À resserrer après la fusion.

5. **Classes de `body`.** J'applique le § 6 (`app-window app-window-settings`, plus de `flowtranslate-*`). Dans mon worktree, `src/styles.css` est encore en 0.4.0 et n'a de règle que pour `body.flowtranslate-settings` : les scénarios Réglages y perdent `background: var(--settings-bg)` et `height: 100vh; overflow: hidden`. Vérifié au rendu : la fenêtre reste correcte (`.settings-window` peint son propre fond) et le défilement passe du viewport au document. Transitoire, résolu quand les Réglages réécrivent `styles.css` — mais c'est la raison pour laquelle mon défilement vers l'historique bascule sur `window.scrollTo` quand `.settings-scroll-viewport` ne déborde pas.

6. **Deux assertions du § 14 que je n'ai pas pu tenir au libellé, et que j'ai remplacées par du comportement.** L'entrée de menu « Fermer » gagne une indication « Échap » en 1.0, ce qui changera son nom accessible : le test presse Échap deux fois au lieu de la cliquer. Le nom de l'animation CSS de la roue d'attente (`wait-spin`) n'est ni un point d'accroche gelé ni un motif toléré : j'assertionne `animationName !== 'none'`, et la géométrie 60 × 28, qui est contractuelle. Idem pour `data-scroll-edge`, absent de la liste des attributs conservés du § 6 : remplacé par `scrollTop === 0`.

7. **Aucune image générée ni supprimée.** Les 23 PNG de `visual-tests/references/win32/chromium/` sont ceux de la 0.4.0, avec les anciens identifiants ; ils ne correspondent plus à la matrice. `visual-tests/README.md` le dit en toutes lettres, avec le décompte réel (27) et le détail de ce que chaque image prouve. Je n'ai lancé aucune comparaison visuelle : un `playwright test` sur la config visuelle écrirait les références manquantes, ce qui est exactement la régénération réservée à l'après-fusion.

8. **Le spec visuel est rouge par construction** et le restera jusqu'à la fusion : il décrit la 1.0, et le clair ressemble au sombre tant que personne n'importe `tokens.css`. Vérifié : à 2fbfdac aucun fichier ne l'importe, donc `data-theme` n'a encore aucun effet visuel. La preuve que le signal arrive est portée par les assertions de `e2e/workbench.pw.ts`, pas par les pixels.

### Pas fait

Rien de ce qui m'était demandé n'est resté de côté. Volontairement hors de ma main, et attendu ailleurs :

- La régénération des 27 références et leur revue image par image, l'exécution réelle des comparaisons visuelles, et le resserrage des trois motifs tolérants sur la chaîne finale : après la fusion, chez l'orchestrateur.
- La correction des 7 erreurs de type dans `e2e/native-bridge.pw.ts` et `e2e/native-fixture.ts` : fichiers du verre.
- Le test du fond de la fenêtre Réglages, sorti de `e2e/reported-defects.pw.ts` : à recréer par les Réglages dans `e2e/settings-surface.pw.ts` (attention au `process.env` du point 3 des notes de contrat).
- Aucun `cargo`, aucun `tauri build`, aucun serveur LLM ni processus GPU sollicité. Aucun push.

Une limite à connaître : mes vérifications Playwright ont tourné sur les ports 5313 et 5314, ceux que la consigne de travail donne pour isoler ce worktree, et non sur les 5183/5184 du contrat § 11. Le numéro ne change rien à ce qui est exercé, et je n'ai touché ni `playwright.config.ts`, ni `playwright.visual.config.ts`, ni le bloc `scripts`.

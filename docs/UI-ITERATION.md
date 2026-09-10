# Boucle de validation visuelle

## Reprise du 9 septembre 2026 (Claude Code, handoff design « 1a »)

Les trois livrables du handoff (bulle 1a, défilement, fenêtre Réglages) sont implémentés
dans les vrais composants : `GlassOverlay.tsx`, `ui.tsx`, `App.tsx`, `glass.css`, `styles.css`,
plus `placement`/`lib.rs` (agrandi ancré, commandes de la fenêtre Réglages, champ
`connectionExpanded`). Deux primitives Radix ont été ajoutées avec l’accord de Lucas :
`react-scroll-area` (indicateur de défilement) et `react-toggle-group` (segmentés).
Les 17 références visuelles ont été régénérées **parce que le design change**, après
revue des images produites ; elles décrivent le nouveau design, pas une validation de
Lucas. Le rendu Windows (acrylique réel, contraste sur page blanche, DPI 125/150 %,
fenêtre Réglages sans cadre) reste à observer sur le bureau.

## Deuxième retour du 10 septembre 2026 (capture d’écran de Lucas)

Quatre points : cadre gris derrière les surfaces (UI-008), bulle qui ne se replie pas
quand la souris sort (UI-009), animation de streaming laide (UI-010), confirmation
avant traduction au raccourci (UI-011). La capture GDI du bureau fonctionne désormais
hors sandbox (`scratchpad/shot.ps1`), ce qui permet d’observer le rendu réel.
Décisions : plus de matériau DWM (il ignore la région, doc Microsoft), verre `.92` ;
repli en onglet 44 × 20 au bord bas dans la même fenêtre (fenêtre ancrée par le bas,
`presentation: 'docked'`), la capsule n’est plus affichée ; fragments de texte qui
s’installent et point qui respire ; traduction immédiate, raccourci toujours capture.
Références visuelles régénérées (verre plus opaque, attente, texte des réglages).

## Retour en conditions réelles du 10 septembre 2026

Lucas a testé l’exécutable du 09-09 : la bulle et la capsule affichaient un titre
« FlowTranslate » en haut à gauche et des coins carrés, avec le texte brut de reqwest
(« error sending request for url … ») pour un serveur Qualité arrêté. Ce n’est pas le
mode démo : c’est UI-007 (registre), reproduit avec `scripts/inspect-native-windows.ps1`
sur le build démo (`--demo-clipboard`, CDP). Le clic sur la capsule appelait `show()`
de Tao, dont la reconstruction différée des styles remet WS_CAPTION et fait perdre la
région ; `host::hide` repassait aussi par Tao. Correctif : activation, masquage et
réparation au niveau HWND (`host::activate`, `host::repair_handle`), et message
d’erreur réseau lisible (`inference::unreachable_message`). Le probe natif vérifie
maintenant styles et région après affichage et après `focus_overlay`.

## Correction de méthode après retour de Lucas

L’entrée par défaut de `/lab.html` est désormais la liste des **défauts signalés**,
pas le catalogue technique (`?view=states`). Chaque fiche distingue capture fournie,
gestes, diagnostic établi ou inconnu, reproduction web possible ou test Windows requis.
Les captures personnelles restent uniquement dans `release/ui-evidence`, hors Git.

Pour UI-005a, `surface=production` n’impose pas color-scheme : l’ancienne fixture
sombre masquait précisément les marges blanches. Le test a échoué avec un fond de
body transparent, puis réussi après application du fond au document des réglages.

Pour UI-001, le test du seul DOM était insuffisant. Le probe interroge maintenant
la visibilité des HWND via l’API Tauri avant/après fermeture, sur trois cycles.
Le test renforcé a échoué sur l’installation 0.1.5 : DOM vide, fenêtre encore visible.
Sur le build du 9 septembre (checkout principal, `--features tauri/custom-protocol`), le même
probe passe : `release/ui-evidence/native-after-1a/result.json`, trois cycles, overlay et capsule
masqués nativement, fenêtre 300 × 89 puis 300 × 206 avec le menu. Cela ne mesure toujours pas
le dépoli ni la composition du bureau : la capture d’écran (GDI, Windows-MCP) est refusée dans la
session d’agent, il faut une observation de Lucas sur page blanche.

## Atelier reproductible — jalon du 9 septembre 2026

Décisions à respecter : [UI-DECISIONS.md](UI-DECISIONS.md).
Défauts à traiter séparément : [UI-ISSUES.md](UI-ISSUES.md).

`npm run ui:lab` ouvre http://127.0.0.1:5174/lab.html. L’atelier est une entrée
Vite de développement, exclue du build Windows. Il réutilise GlassOverlay,
Capsule, SettingsWindow et useTranslation ; seules les réponses du pont sont
simulées. Chaque iframe remet ses données fictives à zéro. Aucun appel vLLM,
accès au presse-papiers Windows ou lecture de l’historique réel.

Huit états, taille de fenêtre, fond clair/sombre, mouvements réduits et Rejouer.
Les paramètres restent dans l’URL pour partager exactement le cas local.
Le fond demandé n’est pas une simulation du DPI Windows. La capsule réduite
et le thème automatique ne sont pas inventés dans l’atelier : leur absence
reste visible tant que les composants ne les implémentent pas.

### Références fixes

- `npm run ui:check` compare 19 images dans 17 scénarios (dont menu et largeur étroite).
- `npm run ui:reference` remplace les références : uniquement après revue de la différence.
- `npx playwright show-report playwright-report/visual` présente attendu/réel/différence en cas d’échec.
- Les premières références sont un **constat de 0.1.5 avec ses défauts**, pas un design approuvé.
- Même Windows, version Chromium, polices et paramètres pour comparer. Les références
  sont séparées par plateforme. Textes/dates fictifs et stables ; aucune donnée utilisateur.
- Les images figent les animations. `FLOWTRANSLATE_PROFILE_URL` peut cibler le serveur
  d’atelier et `npm run ui:motion` enregistre les interactions du lecteur dans
  `release/material-preview`. Cette vidéo navigateur ne mesure pas la fluidité native.

### Accès réel à Tauri / WebView2

`npm run ui:native` lance l’exécutable installé en démo explicite, ouvre un port
CDP local et utilise Playwright dans sa vraie WebView2. Fermer l’application avant
ce test ; le script refuse une session existante. Pour un autre build :
`powershell -NoProfile -File scripts/test-native-ui.ps1 -Executable CHEMIN_EXE`.
Le script termine seulement son propre processus, même si le test échoue.
La version de l’exécutable testé dépend du chemin fourni : ne jamais assimiler
le test de l’installation 0.1.5 à celui d’un futur build de la branche.

Preuves locales dans `release/native-ui-probe` : contenu court, menu, métadonnées
WebView2 et vérification de disparition du DOM après Fermer. Les profils de test
restent dans `release/native-profiles`, hors Git. Le port de débogage n’est pas
ajouté à la configuration de production. Le stockage des réglages Rust reste
celui de l’installation : le scénario ne le modifie pas et ne lit pas ses secrets.

Essai réel de ce jalon : capture du contenu WebView2, ouverture du menu et
fermeture du DOM réussies sur l’installation 0.1.5. La capture Computer Use
renvoie une image noire ; après nouvelle sélection et activation, échec
`GetCursorPos failed: Accès refusé. (0x80070005)`.
Le dépoli, le focus, les régions de clic et les animations sur le bureau
restent donc **non validés**. Une capture CDP ne remplace pas cette étape.

Les sections suivantes décrivent les anciens essais, pas leur état courant.

Le frontend doit être vu et manipulé avant chaque livraison. Les tests unitaires
et une maquette statique ne valident pas le rendu Windows.

## Aperçu React

Lancer `npm run dev -- --port 5173 --strictPort`, puis ouvrir
`http://127.0.0.1:5173/?window=overlay&demo=1` dans le navigateur contrôlé.
Le rechargement à chaud utilise les mêmes composants que Tauri, avec un pont
simulé. Vérifier le texte court/long, les menus, les réglages, les erreurs,
le clavier et les mouvements réduits. Conserver les captures des tests E2E.

Le connecteur navigateur actuel `cua_repl` permet captures et interactions.
L’ancien connecteur `browser-client` peut échouer avec « No Codex IAB backends
were discovered » ; cela ne signifie pas que tout accès au navigateur est absent.

## Fenêtre Windows

Construire et lancer une seule instance avec `--demo-selection` ou
`--demo-clipboard`. Identifier le processus par son chemin exact et retrouver
sa fenêtre avec Computer Use. Capturer avant et après chaque action native.
Le rendu navigateur ne prouve ni le dépoli du bureau, ni le cadre, ni le focus,
ni le déplacement de la fenêtre.

Points obligatoires :

- Absence de titre/cadre au premier affichage, au focus et à la perte du focus.
- Déplacement mesuré par le changement des coordonnées de la fenêtre, puis
  stabilité après ouverture du menu ou réception du texte.
- Fermeture via Échap et via une action visible, y compris pendant une requête.
- Aucun rognage pendant les changements de taille et aucun texte étiré.
- Échelles Windows et fonds clairs/sombres testés séparément des échelles navigateur.

Si une capture est noire ou une interaction échoue avec `GetCursorPos : accès
refusé`, consigner le résultat sans en déduire à lui seul un bureau verrouillé
ou un bug graphique. Rafraîchir la sélection de fenêtre et respecter la procédure
de reprise du connecteur. Ne pas déclarer le rendu validé dans cet état.

## État observé le 9 septembre 2026

L’aperçu React peut être capturé et manipulé dans le navigateur. La capture de
la fenêtre native et les clics fonctionnent de nouveau. Échap a rendu la bulle
inaccessible comme fenêtre affichée. La version 0.1.1 conserve un titre parasite
à la perte du focus et le déplacement automatisé n’a pas modifié ses coordonnées :
ces deux points restent à corriger avant validation native.

### Intégration 0.1.2

Le navigateur contrôlé montre les vrais composants Motion/Radix/Lucide ; le
menu s'ouvre et Fermer masque effectivement le résultat. Les 19 tests Playwright
et 6 tests unitaires passent dans le checkout intégré.

Le premier essai natif a révélé un blocage au démarrage : modifier le cadre
Windows directement dans le callback Focused réentrait dans des événements
protégés par un mutex du runtime. Le correctif diffère cette opération hors du
callback. Après reconstruction et installation, le processus répond et UI
Automation expose la traduction complète et les deux boutons.

La capture du dernier exécutable échoue avec
`IGraphicsCaptureItemInterop.CreateForMonitor failed (0x80070057)`, après nouvelle
sélection de fenêtre également. Le clic par accessibilité échoue avec
`coordinate input geometry is unavailable`. Aucun déplacement, rendu sans titre
au changement de focus ou effet dépoli de cette version n'est donc déclaré
validé. Le processus de démonstration a été arrêté après ces vérifications.

Les captures natives fonctionnaient plus tôt dans cette session sur 0.1.1 :
cette panne intermittente impose de garder la boucle navigateur utilisable,
puis de reprendre la recette native dès que la capture est disponible.

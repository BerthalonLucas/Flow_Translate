# Plan d’implémentation de la 0.5.0

Troisième version du plan, retenue le 17/09/2026 après deux relectures adverses (leurs points bloquants sont repris dans les décisions). Le découpage vise des unités qui travaillent en parallèle dans des worktrees séparés : un fichier n’appartient qu’à une unité, tout ce qui traverse les unités est fixé par le contrat.

---

## Décisions

**Les trois points bloquants sont tous réels : je les ai vérifiés dans le code, aucun ne tombe. Les décisions 1 à 13 tiennent, 14 à 24 tiennent avec les précisions ci-dessous, et six décisions nouvelles (25 à 30) règlent les blocages. Sept mineurs sont pris, trois écartés avec leur raison.**

1. **Page d'ouverture** = `actions`. Démarrer n'existe pas en 0.5.0 ; 10-parcours dit « Ils s'ouvrent sur Actions », le § 8 ne parle d'une autre page qu'au premier lancement (0.9.0).
2. **Moteurs garde deux EngineCard** nommées Qualité et Rapide, et « Relancer en {autre} » reste dans le menu ⋯. Le § 10 (ServerCard, moteurs renommables) est explicitement 0.6.0, et la ligne 0.5.0 du § 12 le redit.
3. **Description de « Moteur par défaut »** : la phrase du design system (« Changeable depuis le menu ⋯ du résultat ») est fausse — `useTranslation.ts:50` relance sans rien enregistrer. Texte retenu : « Qualité : plus lent, meilleures tournures. Le menu ⋯ d'un résultat relance avec l'autre, sans changer ce réglage. »
4. **« Lancer à l'ouverture de session »** (design system) plutôt que « Lancer avec Windows » (§ 8) : la formulation du § 8 arrive avec la page Démarrer, en 0.9.0.
5. **Réglages illisibles** : le § 9 donne une commande « Réglages » à une Notice que le design system dit « jamais cliquable ». Retenu : avis pilule 4 s + icône de notification en alerte + Callout `danger` en tête de la page Actions à la prochaine ouverture. Deux messages selon l'issue. Le fichier écarté est renommé `settings.illisible-AAAAMMJJ-HHMMSS.json`, jamais supprimé.
6. **Collage refusé = une erreur**, pas un avis de 3 s : ce verre porte le seul exemplaire du résultat. Pas d'estompe, raison tenue jusqu'à Échap / Fermer / capture suivante.
7. **Alerte de l'icône** réservée aux échecs qui demandent une action : moteur, collage, réglages illisibles, raccourci refusé. « Rien à traiter » reste un avis, ne touche ni le glyphe ni l'infobulle.
8. **« Corbeille du dernier raccourci désactivée » se lit globalement, pas par action.** C'est déjà le comportement 0.4.0 (`ActionSettings.tsx:72` n'affiche la corbeille que si `shortcutBindings.length > 1`) et c'est ce que `settings.rs` valide (1 à 12 raccourcis, tous raccourcis confondus). Lue par action, elle rendrait indestructible toute action à un seul raccourci. Donc : la corbeille d'un raccourci n'est désactivée que lorsqu'il est **le dernier de toute la configuration** ; « Supprimer l'action » reste bloquée tant qu'un raccourci la vise ou qu'elle est l'action par défaut.
9. **GlassError nomme le profil** (« Le moteur Qualité ne répond pas. » / « Vérifiez qu'il est démarré sur 127.0.0.1:8002. »). 401 et modèle absent gardent leur message générique : les erreurs nommées sont 0.6.0.
10. **Espace insécable U+00A0** avant « ; : ? ! » dans les chaînes d'interface. Vérifié : zéro U+00A0 aujourd'hui dans le dépôt ; `settings.rs:249` écrit « HTTPS; HTTP » sans aucune espace. Écriture par séquence d'échappement obligatoire dans toute chaîne qui franchit une frontière d'unité.
11. **Poignée de redimensionnement conservée** : la fenêtre est sans cadre, le design system ne la montre pas mais ne la remplace par rien.
12. **Historique illisible ne tue plus le démarrage non plus** : `HistoryStore::new(&root)?` (lib.rs:1293) est le même bug que `store.load()?` à la ligne au-dessus.
13. **Capsule conservée, non portée.** Toujours câblée, plus affichée depuis le 10/09. Style graphite minimal, sortie du lab et des références, retirée avec les serveurs multiples.
14. **Aucun nouveau module partagé entre unités.** Chaque worktree part de 2fbfdac et doit compiler seul : un fichier créé par A ne peut pas être importé par B. Duplications assumées, chacune avec sa date de péremption dans l'après-fusion : `src/overlay-ipc.ts`, une constante de nom par côté, l'`@import` de `tokens.css` en double (décision 19).
15. **`package.json` et `package-lock.json` appartiennent aux Réglages**, seule unité autorisée à ajouter une dépendance (au plus `@radix-ui/react-tabs`). Personne ne touche au bloc `scripts`.
16. **Les glyphes de la zone de notification sont chargés à l'exécution** depuis les ressources, avec repli silencieux sur `app.default_window_icon()`. Sans cela, `include_bytes!` ferait dépendre la compilation du natif de la livraison de l'unité marque.
17. **Renommage préparé ; la seule préparation qui ne peut pas attendre est faite maintenant.** `tauri_plugin_autostart::Builder::new()` est construit sans option (lib.rs:1288), donc le nom de la valeur `Run` est `productName`. Le natif fige `app_name("FlowTranslate")` tant que `productName` vaut encore cela, et réconcilie `Run` au démarrage (décision 29).
18. **Quatre fichiers de test sont scindés par propriétaire, et le rebranchement de la fixture fait partie de la scission.** `e2e/ui.pw.ts` garde l'overlay, ses deux tests Réglages (250 et 415) partent dans `e2e/settings.pw.ts` ; le bloc Réglages de `e2e/native-bridge.pw.ts` (258-317) part dans `e2e/settings-bridge.pw.ts` ; `e2e/native-fixture.ts` reste la fixture overlay. **`e2e/actions.pw.ts` est un test Réglages qui démarre la fixture overlay** (ligne 6) : les Réglages le rebranchent sur `settings-fixture.ts` dans le commit qui crée cette fixture.
19. **`tokens.css` est importé par `styles.css` et par `glass.css`**, chacun en première ligne, chacun chez son propriétaire : sans quoi les Réglages développeraient tout leur rendu contre des variables indéfinies (vérifié : aucun fichier n'importe `tokens.css` à 2fbfdac). **Toute surcharge d'une classe globale de `tokens.css` est écrite préfixée** (`.settings-window .label`, `.glass-overlay .original-copy`) : la spécificité gagne quel que soit l'ordre d'émission.
20. **`src/ui.tsx` reste au verre, les Réglages s'en détachent dans la même version.** Le verre ajoute les 30 noms du design system, **garde les 10 anciens en alias** et **ne touche ni à `Segmented` ni à `SettingSwitch`**, pour que son worktree — où `App.tsx:6` les importe encore — compile. Les Réglages se donnent `src/settings/controls.tsx`.
21. **`.icon-button`, `.primary-action` et `.quiet-action` sont scopés des deux côtés** : `glass.css` est émis après `styles.css`, donc les règles d'overlay réécrites repeindraient les boutons des Réglages, y compris en clair — invisible dans les deux worktrees, visible seulement après la fusion.
22. **`src/lab/frame.tsx` applique la même règle de thème que `src/main.tsx`**, et le thème des Réglages se pilote par `emulateMedia`, plus par `?theme=`. `lab-frame.html` ne charge jamais `main.tsx` : sans cette décision, l'`emulateMedia` ne changerait rien et chaque référence des Réglages ressortirait en sombre.
23. **`schemaVersion` ne traverse jamais l'IPC.** `get_settings`/`save_settings` transportent `types::Settings` (`types.rs:162-176`), pas le JSON du disque ; `PersistedSettings` (`settings.rs:20-53`) est une struct distincte. L'ajouter à `types::Settings` ferait échouer la désérialisation des objets renvoyés par le front.
24. **Le type-check des tests entre dans le dépôt, chez l'atelier.** `tsconfig.app.json` n'inclut que `"src"` (vérifié) : `tsc -b` ne vérifie ni `e2e/` ni `visual-tests/`, et Playwright transpile par esbuild sans vérification de types.

---

**25. (nouvelle, bloquant 1) Les deux variables qui entrent en collision sont supprimées de `styles.css`, parce que la règle de préfixe ne protège que les classes.** Vérifié par extraction des deux fichiers : l'intersection des noms déclarés est exactement `{--focus, --switch-on}`. `styles.css:15` pose `--focus: #7db6ff` et `:24` `--switch-on: #91bff7` sur `:root` ; `tokens.css:21,30` posent `--focus: var(--signal-ink)` et `--switch-on: var(--signal)`. Les propriétés personnalisées sur un même sélecteur se résolvent par **ordre de déclaration**, que la règle de préfixe de la décision 19 n'influence pas du tout. Conséquence mesurable : dans le worktree Réglages (tokens importé en tête de `styles.css`, puis le bloc legacy) l'anneau de focus est **bleu** ; dans le worktree verre (`styles.css` d'abord, puis tokens via `glass.css`) il est **jaune**. Les deux unités captureraient et « vérifieraient » des anneaux de focus et des interrupteurs de couleurs différentes, et l'étape 2 de l'après-fusion (retirer l'`@import` de `glass.css`) ferait gagner le bleu 0.4.0 partout, à l'encontre de `docs/design-system/README.md:8` et `:68` (focus = `signal-ink`). **Les Réglages suppriment `--focus`, `--switch-on` et `--switch-thumb-on` du bloc `styles.css:3-27` dans le même commit que l'`@import`** ; le verre, qui veut `signal` et non `signal-ink` à l'intérieur du verre (README:68), pose `.glass-overlay { --focus: var(--signal); }` — surcharge scopée, pas une redéclaration sur `:root`. Ni l'un ni l'autre ne recopie ces trois noms dans sa copie locale. Une assertion de valeur calculée dans chaque unité (contrat § 6) empêche la réintroduction.

**26. (nouvelle, bloquant 3) L'overlay et la capsule ne touchent jamais à `color-scheme`, et `index.html` garde sa balise.** `index.html:6` force `color-scheme: light` pour les trois fenêtres ; `overlay` et `capsule` sont `"transparent": true` (tauri.conf.json:24, 40) et **rien ne peint leur racine** — `glass.css:12` ne pose `background: transparent` que sur `.native-overlay`, un div, et `styles.css:29` ne donne aucun fond à `body`/`html`. Ce montage marche aujourd'hui parce que la couleur de base du canevas vient du `DefaultBackgroundColor` transparent posé par Tauri, sous un `color-scheme` clair. Poser `colorScheme = 'dark'` sur `documentElement`, comme le prévoyait le plan précédent, remplace ce défaut par une couleur sombre opaque : c'est la régression classique « l'overlay devient un rectangle gris sur le bureau », et aucune acceptation d'unité ne peut la voir (les deux tournent dans Chromium en navigateur, où la page a son propre fond d'aperçu). Elle frapperait un invariant que la consigne interdit de bouger. Donc : **`index.html` conserve `<meta name="color-scheme" content="light">`** ; l'overlay et la capsule reçoivent uniquement `data-theme="dark"`, qui ne pilote que des propriétés personnalisées et n'a aucun effet sur le canevas ; la fenêtre Réglages, seule, surcharge `documentElement.style.colorScheme` à `dark`/`light` — ce dont elle a besoin pour ses contrôles natifs et sa barre de défilement, et ce qui rend inutile le `select { color-scheme: dark }` de `styles.css:149`. En ceinture et bretelles, le verre déclare explicitement la transparence de la racine dans `glass.css` (contrat § 6) : une couleur explicite bat tout défaut d'agent utilisateur, quelle que soit l'évolution de Chromium. Le comportement de l'overlay est ainsi **strictement identique à la 0.4.0**, et la vérification en fenêtre packagée reste au programme de l'après-fusion comme contrôle, plus comme filet.

**27. (nouvelle, bloquant 2) Les deux fichiers de test qui pilotent l'atelier vont à l'atelier, et une unité n'assertionne jamais au libellé une surface qu'elle ne possède pas.** Vérifié : `e2e/ui.pw.ts` ne touche jamais l'atelier (il va sur `/?window=…`), tandis que `e2e/reported-defects.pw.ts` et `e2e/workbench.pw.ts` ne vont **que** sur `lab.html` et `lab-frame.html`, c'est-à-dire sur `src/lab/bugs.tsx` et `src/lab/frame.tsx`, tous deux à l'atelier. Leur donner au verre revenait à faire dépendre son acceptation de fichiers qu'il ne peut pas modifier. Ils passent donc **tous les deux à l'atelier**, sauf le premier test de `reported-defects.pw.ts` (lignes 3-10), qui assertionne la fenêtre Réglages (`rgb(31,33,38)` = `--settings-bg`, titre « Réglages » exact) et part aux Réglages dans `e2e/settings-surface.pw.ts`. Reste le vrai nœud : ces fichiers rendent le **verre** à l'intérieur de l'atelier et l'assertionnent au libellé français (« Copier la traduction » ×5, « Plus d'options » ×2), libellés que le verre renomme dans son worktree et que l'atelier ne voit pas changer dans le sien. La règle générale : **une unité qui assertionne une surface appartenant à une autre l'adresse par un point d'accroche gelé (`.wait-pill`, `.translation-copy`, `.translation-text`, `.action-pill`, `.more-menu`, `[data-form]`, `[data-lab-phase]`, `[data-settings-page]`, `[data-settings-ready]`) ou, quand un rôle accessible est indispensable, par un motif tolérant qui accepte l'ancien et le nouveau nom** (`{ name: /Copier (la traduction|le résultat)/ }`), dont la liste exhaustive est au contrat § 14. Le test reste vrai — il vérifie qu'un bouton Copier existe et est actif — il est vert dans le worktree de l'atelier comme après la fusion, et l'après-fusion le resserre sur la chaîne finale dans le commit qui régénère les références. Les chaînes que l'atelier possède lui-même (`frame.tsx:25`, les boutons de scénario) sont assertionnées au caractère près, sans tolérance.

**28. (nouvelle, mineur pris) La taille de la fenêtre Réglages a un propriétaire nommé.** `20-de-0-4-0-a-1-0.md:70` et l'exigence § 1 demandent 760 × 640 ; `tauri.conf.json:51-52` est encore à 620 × 720 et appartient au natif, dont le brief ne parlait que de chargement, ouverture ciblée, icônes, autostart et libellés. Les Réglages, mis en page pour 760 (navigation 184 + contenu), auraient été livrés dans une fenêtre de 620. C'est une ligne dans le brief du natif, et le minimum 460 × 420 ne bouge pas.

**29. (nouvelle, mineur pris) La réconciliation de `Run` va dans les deux sens, à cause de la récupération de réglages illisibles.** Quand `settings.json` est écarté et qu'aucun `settings.v0.json` ne charge, on repart de `Settings::default()` (types.rs:202), donc `autostart: false`, alors que la valeur `Run` existe toujours : Windows continuerait de lancer l'application pendant que la case est décochée, et l'utilisateur ne pourrait pas l'arrêter, le basculement n'ayant lieu que sur changement dans `save_settings` (lib.rs:209-229). Règle retenue : au démarrage, la valeur `Run` est lue. Si les réglages sont ceux du disque et que `autostart` est vrai, la valeur absente ou pointant ailleurs que `current_exe()` est réécrite. Si les réglages viennent d'une récupération et qu'une valeur `Run` existe en pointant sur notre exécutable, elle fait foi : `autostart` passe à vrai en mémoire et est persisté, pour que la case dise la vérité et puisse être décochée. `disable()` sur une valeur absente est toléré, jamais remonté en erreur.

**30. (nouvelle, mineur pris) L'aperçu du verre de la page Lecture a ses propres classes.** `src/main.tsx` charge `glass.css` dans toutes les fenêtres : un aperçu qui réemploierait `.translation-bubble` / `.translation-copy` / `.original-copy` serait repeint par les règles réécrites du verre, et surtout `publish()` (`GlassOverlay.tsx:353`) exige **un seul élément par sélecteur mesuré**. Le contrat gelait leurs noms sans interdire leur réemploi ailleurs. L'aperçu porte donc `.reading-preview` et `.reading-preview-copy`, et aucun des cinq sélecteurs mesurés n'apparaît hors de l'overlay.

**Mineurs pris sans numéro de décision** : `cargo check` dans l'acceptation de la marque (`tauri.conf.json:71-73` fait lire `icons/icon.ico` par tauri-codegen à la compilation Rust : un ICO malformé casse le build de tout le dépôt, et aucune des vérifications annoncées ne compilait Rust) ; assertion de la chaîne HTTPS partagée côté Réglages, pour que l'accord soit exercé avant la fusion et pas seulement à l'étape 1 de l'après-fusion ; conservation du `binding` complet à `lib.rs:1300`, qui ne collecte aujourd'hui que `b.shortcut.clone()` et perd donc l'`actionId` exigé par le contrat § 3 ; écouteur de focus pour l'historique, l'exigence § 5 demandant « à chaque ouverture **et à l'activation** » alors que `settings-target` n'est émis que par `open_settings` ; garde `window.label() == "settings"` sur `copy_history`, première commande à mettre du texte stocké en clair dans le presse-papiers, alors que `get_history`/`delete_history` (lib.rs:1038-1045) ne vérifient rien, contrairement à `get_settings` (158-161) ; `tsBuildInfoFile` propre à `tsconfig.test.json` ; et l'attribution des quatre fichiers orphelins (`scripts/test-native-ui.ps1`, `package-test-kit.ps1`, `inspect-native-windows.ps1` au natif, `src/env.d.ts` aux Réglages).

**Mineur écarté** : la promesse de déterminisme octet pour octet des PNG rasterisés par Chromium. Elle ne tient pas en travers d'un changement de pilote ou de fontes, et `git status` propre après deux générations reste un contrôle utile mais non contractuel. `check-icons.mjs` valide des propriétés — dimensions, entrées de l'ICO, pixels témoins — pas une empreinte.

**Pictogramme de l'action « Professionnaliser » : l'identifiant réel est `professionalize`** (`src/actionDefaults.ts:14`, `src-tauri/src/actions.rs:79`), pas `professional`. Écrit tel quel, il recevait `wand` au lieu de `briefcase-business`, et l'erreur serait partie dans les références visuelles approuvées.

---

## Contrat entre unités

**Ce sur quoi deux unités qui ne se voient pas doivent tomber d'accord. Tout ce qui suit est figé ; une unité qui a besoin d'en dévier le signale au lieu de l'inventer.**

## 1. Commandes Tauri

Inchangées : `get_settings`, `save_settings`, `capture_text`, `frontend_ready`, `translate`, `cancel_translation`, `copy_result`, `replace_result`, `dismiss_overlay`, `complete_overlay_dismiss`, `focus_overlay`, `start_drag`, `resize_overlay`, `overlay_dimming`, `drag_settings`, `quit_app`, `check_connection`, `get_history`, `delete_history`, `override_cursor`.

Modifiée :
- `open_settings { target?: SettingsTarget }` — sans argument, équivaut à `{ page: "actions" }`. Rust mémorise la cible, l'émet vers la fenêtre `settings`, puis `show` + `set_focus`. Chaque ouverture repart de cette cible.

Nouvelles :
- `take_settings_target() -> SettingsTarget | null` — lue au montage de la fenêtre Réglages (la fenêtre existe déjà, cachée ; l'événement peut arriver avant elle). Consomme la cible.
- `take_startup_notice() -> string | null` — le message « réglages illisibles » à afficher en Callout `danger` en tête d'Actions. Consommé à la première lecture.
- `copy_history { id: string } -> void` — **refusée si `window.label() != "settings"`**, sur le modèle de `get_settings` (lib.rs:158-161) : c'est la première commande qui met du texte stocké en clair dans le presse-papiers. Rust déchiffre la ligne, copie **le résultat seul**, et coupe le suivi du presse-papiers 1,5 s comme `copy_result` (`suppress_clipboard_tracking`). Le frontend ne fournit jamais de texte. Erreur : « Copie indisponible. Réessayez. »
- `validate_endpoint { endpoint: string } -> void` — pure, sans réseau ; `Err(message)` = le message de `settings::validate_endpoint`. Sert au contrôle à la sortie du champ, avant tout enregistrement.

```ts
type SettingsPage = 'actions' | 'reading' | 'engines' | 'privacy';
type SettingsTarget = { page: SettingsPage; actionId?: string; engine?: 'fast' | 'quality'; reason?: string };
```
`actionId` déplie et met en évidence cette carte d'action ; `engine` met en évidence cette EngineCard ; `reason` s'affiche sous la ligne concernée.

## 2. Événements

Inchangés : `capture`, `translation`, `settings-changed`, `target-invalidated`, `overlay-dismiss-requested`, `glass-near`, `capture-target`, `capture-notice`, `work-area`, `result-delivery`.

Nouveau : **`settings-target`**, payload `SettingsTarget`, émis vers la fenêtre `settings` à chaque `open_settings`. Il vaut aussi « la fenêtre vient d'être ouverte » : c'est sur lui que les Réglages relisent réglages et historique.

Pas de canal natif supplémentaire pour l'activation : l'exigence « historique relu à chaque ouverture **et à l'activation** » est couverte côté web par un écouteur de focus de fenêtre dans les Réglages, qui relit avec la même fonction que `settings-target` (et se débounce entre les deux). Alt-Tab vers une fenêtre déjà visible rafraîchit donc la liste.

## 3. Appelants d'`open_settings`

| Appelant | Cible |
|---|---|
| Icône de notification, `--settings`, deuxième lancement | `{ page: 'actions' }` |
| Menu ⋯ du verre, capsule, erreur d'initialisation du front | `{ page: 'actions' }` |
| Puce « Réglages » d'une erreur du verre | `{ page: 'engines', engine: <mode du profil utilisé> }` |
| Raccourci refusé au démarrage | `{ page: 'actions', actionId: <action du raccourci>, reason: <message de `register_shortcut`> }` |

**Le dernier cas demande un changement de collecte** : `lib.rs:1300` ne garde aujourd'hui que `b.shortcut.clone()` dans un `Vec<String>`, si bien que l'`actionId` est déjà perdu quand la boucle 1377-1382 échoue. Collecter le couple (raccourci, `action_id`).

## 4. Fichier de réglages et `schemaVersion`

- `schemaVersion: u32` vit **uniquement dans `PersistedSettings`** (`settings.rs:20-53`), avec `#[serde(default)]`. `SettingsStore::save` l'écrit inconditionnellement à `1`. **Il n'est ajouté ni à `types::Settings` (`types.rs:162-176`), ni à `src/types.ts`, ni à aucun payload IPC.** Le front n'a rien à faire.
- **Aucun `deny_unknown_fields`** nulle part dans `settings.rs` ni `actions.rs` : c'est ce qui permet à la 0.4.0 de redémarrer sur un fichier 0.5.0.
- Toujours écrits, quoi qu'il arrive : `mode`, `profiles.fast` et `profiles.quality` complets, `outputMode` par raccourci, 1 à 12 raccourcis.
- Sans `schemaVersion` : copie en `settings.v0.json` **seulement si ce fichier n'existe pas déjà** (une 0.4.0 relancée réécrit le fichier depuis sa struct et supprime tout champ inconnu ; au retour en 0.5.0 il ressemble à une v0, et une sauvegarde aveugle écraserait la vraie), puis réécriture avec `schemaVersion: 1`.
- Illisible (lecture, JSON, validation, DPAPI, ou `actions: []` qui fait paniquer `settings.rs:107` sur `actions[0]` avant `validate`) : le fichier est renommé `settings.illisible-AAAAMMJJ-HHMMSS.json`, jamais écrasé ; on charge `settings.v0.json` s'il passe, sinon des réglages neufs.

## 5. Icônes, ressources, autostart

- Application : `src-tauri/icons/icon.ico` (16, 24, 32, 48, 256), `icon.png` (512), `32x32.png`, `128x128.png`, `128x128@2x.png`, `mark.svg` — **mêmes noms qu'aujourd'hui**, donc `tauri.conf.json` n'est pas touché pour eux. Source : `docs/design-system/assets/Logos/flowtranslate-app-icon.svg`. `bundle.icon` ne liste que `icons/icon.ico` (`tauri.conf.json:71-73`) : cet ICO est lu par tauri-codegen **à la compilation Rust** (un fichier malformé casse `cargo build` pour tout le dépôt) et c'est aussi ce que renvoie `app.default_window_icon()`, donc le glyphe de notification de repli — **il doit rester lisible à 16 px**.
- Zone de notification : `src-tauri/icons/tray/<nom>.png` (16 × 16) et `<nom>@2x.png` (32 × 32), avec `<nom>` ∈ `tray-idle-dark-taskbar`, `tray-idle-light-taskbar`, `tray-busy-dark-taskbar`, `tray-busy-light-taskbar`, `tray-alert-dark-taskbar`, `tray-alert-light-taskbar`. Sources : `docs/design-system/assets/Tray/*.svg`.
- Déclarés en ressources (`"resources": ["icons/tray/*.png"]`), résolus à l'exécution (`BaseDirectory::Resource`), `@2x` si l'échelle de l'écran ≥ 1,5. Fichier absent ou illisible : on garde l'icône en place, sans erreur.
- Variante choisie par `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\SystemUsesLightTheme` (0 → `-dark-taskbar`, 1 → `-light-taskbar`), relue à chaque `WM_SETTINGCHANGE` « ImmersiveColorSet ». Jamais `AppsUseLightTheme`, jamais le thème de l'app.
- **Autostart** : `tauri_plugin_autostart::Builder::new().app_name("FlowTranslate")`, valeur figée, indépendante de `productName`. Réconciliation au démarrage, **dans les deux sens** :
  - réglages chargés depuis le disque et `autostart` vrai → une valeur `Run` absente, ou présente avec un chemin différent de `current_exe()`, est réécrite ;
  - réglages issus d'une récupération (fichier écarté, aucun `settings.v0.json`) et valeur `Run` présente pointant sur notre exécutable → elle fait foi : `autostart` passe à vrai en mémoire et est persisté, pour que la case dise la vérité et reste décochable ;
  - `autostart` faux avec réglages de confiance → rien n'est écrit, et `disable()` sur une valeur absente est toléré, jamais remonté en erreur.

## 6. CSS, thème, points d'accroche du DOM

- **`src/styles.css` et `src/glass.css` commencent chacun par `@import './tokens.css';`** (première ligne, avant tout autre bloc). Le doublon d'émission se retire après la fusion. Aucun autre fichier n'importe `tokens.css`, et personne ne modifie `src/tokens.css`.
- **Les deux propriétés personnalisées qui entrent en collision sont supprimées de `styles.css`.** L'intersection des noms déclarés par `styles.css:3-27` et `tokens.css` est exactement `{--focus, --switch-on}` ; les propriétés personnalisées sur `:root` se résolvent par ordre de déclaration, que la règle de préfixe ci-dessous n'influence pas. Les Réglages retirent **`--focus`, `--switch-on` et `--switch-thumb-on`** de ce bloc, dans le commit qui ajoute l'`@import`. Personne ne les recopie sur `:root` ni dans une copie locale. Le verre, qui veut `signal` et non `signal-ink` à l'intérieur du verre (`docs/design-system/README.md:68`), écrit `.glass-overlay { --focus: var(--signal); }` — surcharge scopée. **Chaque unité inscrit dans ses tests une assertion de valeur calculée** (le verre : `--focus` résolu sur `.glass-overlay` est la teinte `signal` ; les Réglages : `--focus` résolu sur `.settings-window` est `signal-ink`, différent en clair et en sombre) pour interdire la réintroduction.
- **Toute surcharge d'une classe globale de `tokens.css`** (`.body`, `.title`, `.label`, `.menu`, `.heading`, `.caption`, `.tag`, `.prompt`, `.original-copy`) **est écrite préfixée** : `.settings-window .label`, `.glass-overlay .original-copy`. Cas concret : `tokens.css:139` fige `.original-copy` à 14/20 alors que le produit la veut deux pixels sous la taille choisie → `.glass-overlay .original-copy { font-size: calc(var(--copy-size) - 2px); line-height: 1.45; }`.
- **`.icon-button`, `.primary-action`, `.quiet-action` sont scopés des deux côtés** : `.glass-overlay .icon-button` etc. dans `glass.css`, `.settings-window .icon-button` etc. dans `styles.css`. Aucune de ces trois classes n'existe plus à la racine d'aucun des deux fichiers.
- Le bloc de variables `--glass-*` de `styles.css:3-27` : le verre en pose sa propre copie dans `glass.css` (sans `--focus`, `--switch-on`, `--switch-thumb-on`), les Réglages laissent le reste de l'original en place. L'orphelin part après la fusion.
- `glass.css` garde `.glass-overlay { --halo-x: 0px; --halo-top: 0px; --halo-bottom: 0px; }` et la réactivation sous `.native-overlay` : `tokens.css:114-116` pose ces variables sur `:root` en 32/20/44, sans quoi l'aperçu navigateur prend le halo et les tests de boîtes cassent. Il garde aussi le forçage de `[data-radix-popper-content-wrapper]`.
- **Thème, et transparence des fenêtres sans opaque.** `index.html` **conserve `<meta name="color-scheme" content="light">`**. `overlay` et `capsule` sont `"transparent": true` (tauri.conf.json:24, 40) et rien ne peint leur racine : `glass.css:12` ne pose `background: transparent` que sur `.native-overlay`, un div, et `body`/`html` n'ont aucun fond. Le montage actuel repose sur la couleur de base transparente du WebView sous un `color-scheme` clair. Donc :
  - `src/main.tsx` et `src/lab/frame.tsx` appliquent **la même règle**, chacun chez son propriétaire, avant le rendu : poser `document.documentElement.dataset.theme` — `dark` en dur pour `overlay`, `capsule` et `demo` ; pour `settings`, `dark`/`light` selon `matchMedia('(prefers-color-scheme: dark)')`, réévalué au changement ;
  - **`documentElement.style.colorScheme` n'est posé que pour la fenêtre `settings`** (`dark` ou `light` assorti), jamais pour l'overlay ni la capsule. `data-theme` ne pilote que des propriétés personnalisées et n'a aucun effet sur le canevas ; `color-scheme: dark` en aurait un, opaque, sur une fenêtre transparente ;
  - `glass.css` déclare explicitement `body.app-window-overlay, body.app-window-capsule { background: transparent; }` et la même chose sur `html` pour ces fenêtres : une couleur explicite bat tout défaut d'agent utilisateur ;
  - la fenêtre Réglages posant `color-scheme` elle-même, `select { color-scheme: dark }` (`styles.css:149`) disparaît ;
  - **le thème des Réglages ne se pilote plus par `?theme=`** : ce paramètre ne pilote que `data-preview-background`, le décor derrière le verre. Les références visuelles des Réglages passent par `emulateMedia({ colorScheme })`.
- **Sélecteurs mesurés, inchangés et dans cet ordre** dans `publish()` : `.translation-bubble`, `.wait-pill`, `.action-pill`, `.more-menu`, `.compact-feedback`. **Un seul élément par sélecteur dans le document, donc aucun de ces cinq noms n'est employé hors de l'overlay** : l'aperçu du verre de la page Lecture porte ses propres classes `.reading-preview` et `.reading-preview-copy`. `.notice-root` / `.notice-pill` gardent leurs noms (Rust place une fenêtre 420 × 64 autour).
- Attributs du verre conservés : `data-capture-id`, `data-origin`, `data-form`, `data-placement`, `data-closing`, `data-moving`, `data-dimming`, `data-pinned`, `data-dragging`.
- Réglages : la racine garde `.settings-window`, la barre de titre `.settings-titlebar`, le viewport `.settings-scroll-viewport`. Elle gagne `data-settings-page="<page>"` et **`data-settings-ready="true"`** posé une fois réglages et historique chargés — point d'attente du lab et des tests, en remplacement de l'observation de `.history`.
- Classes de `body` : `app-window app-window-overlay | app-window-capsule | app-window-settings | app-window-demo` (plus de `flowtranslate-*`). `styles.css`, `glass.css` et `lab/frame.tsx` suivent.
- `GlassOverlay` garde sa signature `({ controller })` et l'export `dragSurface(event, onError?, onDragChange?)` ; `App.tsx` continue d'exporter `SettingsWindow` et `Capsule`.
- **Paramètres d'URL, orthographe unique pour les deux passerelles de démonstration** : `?window=settings&page=actions|reading|engines|privacy&actionId=<id>&engine=fast|quality&demo=1`. `src/bridge.ts` (Réglages) et `src/overlay-ipc.ts` (verre) écrivent la même chose. La fenêtre Réglages lit sa page initiale dans l'ordre : `take_settings_target()` en natif, sinon ces paramètres. Aucune nouvelle prop sur `SettingsWindow`.

## 7. `src/ui.tsx`, `src/settings/controls.tsx` et les 30 noms d'icônes

- **Les Réglages n'importent plus `./ui` à la fin de cette version.** `src/settings/controls.tsx` porte leur `Icon`, `IconButton`, `Segmented`, `SettingSwitch`, `useFade`, et le portage design system de `Segmented` (graisse constante) et `SettingSwitch` (à la Windows 11).
- **Le verre garde `src/ui.tsx`**, y ajoute les 30 noms du design system, **conserve les 10 anciens noms comme alias** (`more`→`ellipsis`, `close`→`x`, `chevron`→`chevron-down`, `clipboard`→`clipboard-paste`, `unpin`→`pin-off`, `spinner`→`loader-circle`, et les identiques) et **ne touche ni à `Segmented` ni à `SettingSwitch`**, pour que son worktree — où `App.tsx:6` les importe encore — compile.
- Noms partagés, identiques à `docs/design-system/components/index.d.ts` : `copy`, `check`, `ellipsis`, `x`, `pin`, `pin-off`, `loader-circle`, `eye`, `eye-off`, `clipboard-paste`, `rotate-ccw`, `refresh-cw`, `settings-2`, `info`, `triangle-alert`, `circle-alert`, `circle-check`, `languages`, `spell-check`, `briefcase-business`, `wand`, `plus`, `trash-2`, `chevron-down`, `keyboard`, `server`, `shield-check`, `type`, `power`, `history`. Trait 1,75 (2,25 pour `loader-circle`), `currentColor`, tailles 13 / 15 / 16 / 18.
- Pictogramme d'une action, déduit de l'id : `translate-*` → `languages`, `correct` → `spell-check`, **`professionalize`** → `briefcase-business`, tout le reste → `wand`.

## 8. Libellés partagés, au caractère près

**Règle d'espace insécable.** U+00A0 avant « ; », « : », « ? » et « ! » dans les chaînes d'interface, et comme séparateur de milliers. Dans toute chaîne qui franchit une frontière d'unité, l'insécable est écrit **par échappement** — `\u{00A0}` en Rust, ` ` en TypeScript — jamais par un caractère collé.

**Exclusions, aucune insécable** : le deux-points d'un `hôte:port` (« Aucune réponse de 127.0.0.1:8001. », « démarré sur 127.0.0.1:8002 »), celui d'une heure (« 17 sept. 09:12 »), et le point médian « · » qui garde des espaces ordinaires.

**Les trois chaînes qui traversent réellement une frontière** (émises par le natif, affichées et assertionnées par les Réglages) — **chacune est assertionnée des deux côtés** : par un test Rust chez le natif *et* par un test Playwright chez les Réglages, sans quoi l'accord n'est exercé qu'à la fusion :
- `"Un serveur distant doit utiliser HTTPS\u{00A0}; HTTP est réservé au bouclage local."` (aujourd'hui `settings.rs:249`, sans aucune espace avant le point-virgule)
- `"Vos réglages étaient illisibles\u{00A0}: la dernière sauvegarde est chargée."`
- `"Vos réglages étaient illisibles\u{00A0}: les réglages par défaut sont chargés."`

**Zone de notification** : menu « Revoir le dernier résultat », « Réglages », « Quitter ». Infobulle « FlowTranslate », « FlowTranslate — Démonstration simulée », « FlowTranslate — {problème} ».

**Avis de Rust** : « Aucun résultat récent. » · « Rien à traiter dans la fenêtre active. »

**Refus de collage** (deux phrases, raison puis quoi faire) : « Ce champ n'est pas modifiable. Copiez le résultat. » · « Collage impossible ici. Copiez le résultat. »

**Moteur** : « Le moteur {Qualité|Rapide} ne répond pas. Vérifiez qu'il est démarré sur {hôte}:{port}. » · « Aucune réponse de {hôte}:{port}. Démarrez le serveur, puis vérifiez. » · « Le profil fast est absent. » devient « Le moteur Rapide est absent. Rouvrez les Réglages pour le configurer. »

**Verre** : `aria-label` du document « Résultat » · pilule « Actions du résultat » · menu « Options du résultat » · bouton « Copier le résultat », puis « Copié » 1,6 s · attente « Traitement en cours » · annonces `sr-only` « Résultat prêt », « Résultat copié », « Sélection remplacée ». Menu : « Afficher l'original » / « Masquer l'original », « Remplacer », « Réessayer », « Relancer en Rapide » / « Relancer en Qualité », « Réglages », « Fermer » avec l'indication « Échap ». Plus jamais « Réglages et Réessayer dans le menu ⋯ ».

**Réglages, barre de titre** : « FlowTranslate · Réglages » ; états « Enregistré », « Enregistrement… », « Enregistré à l'instant », « Non enregistré · Réessayer » ; bouton `aria-label` « Fermer les réglages », `title` « Fermer (Échap) ». Navigation : « Actions », « Lecture », « Moteurs », « Confidentialité » ; pied « Quitter » et « FlowTranslate 0.5.0 ».

**Actions** : « Un raccourci lance une action sur le texte sélectionné. » · « Nouvelle action » · badge « Par défaut » · résumés « Prédéfinie · Remplace la sélection », « Prédéfinie · Affiche le résultat », « Personnalisée · Aucun raccourci actif » · « Nom » · « Raccourcis » · « Modifier » · segment « Afficher » | « Remplacer » · « Supprimer ce raccourci » · « Ajouter un raccourci » · « Consigne » · compteur `"{n} / 8 000"` · aide `"Écrivez la langue voulue dans la consigne ; le texte sélectionné suit."` · « Rétablir la consigne » · « Définir par défaut » · « Supprimer l'action » · Callout « Les modèles Hy-MT ne savent que traduire. Pour corriger ou reformuler, choisissez un moteur généraliste dans Moteurs. »

**Lecture** : « Comment le résultat s'affiche, et quand il s'efface. » · « Taille du texte » · « Fermeture automatique ».

**Moteurs** : « Tout serveur compatible OpenAI, local de préférence. » · « Moteur par défaut » · « Qualité » | « Rapide » · description « Qualité : plus lent, meilleures tournures. Le menu ⋯ d'un résultat relance avec l'autre, sans changer ce réglage. » · « Non vérifié », « Vérification… », « Connecté · {n} ms », « Échec de connexion » · « Vérifier » · « Adresse », « Modèle », « Clé API » · « Chiffrée par Windows (DPAPI), jamais écrite en clair. »

**Confidentialité** : « Rien ne quitte l'appareil, hors le moteur distant que vous auriez choisi. » · « Conserver l'historique chiffré » · « Lancer à l'ouverture de session » · groupe « Historique ».

**Historique** : ligne = résultat + « {Action} · {Qualité|Rapide} · 17 sept. 09:12 » ; « Copier le résultat » puis « Copié » 1,6 s ; « Supprimer cette entrée » ; vide « Aucun résultat enregistré. » ; pied « {n} entrées · 7 jours au plus » et « Tout supprimer ». **Jamais le texte source.**

**Atelier, chaînes qui lui appartiennent** (recopiées de Rust, assertionnées au caractère près par lui seul) : `src/lab/frame.tsx:25` passe à « Rien à traiter dans la fenêtre active. » ; les descriptions de `scenarios.ts` et les boutons de scénario suivent les libellés ci-dessus.

## 9. Forme des messages d'erreur montrés dans le verre

Rust garantit que tout message affiché par le verre s'écrit « Raison. Quoi faire. ». Le verre coupe à la première phrase pour le titre du `GlassError`, le reste en détail. Aucune erreur structurée en 0.5.0.

## 10. Erreurs sans estompe

Le budget de lecture ne s'applique plus à la phase `error` ni au refus de collage : ni estompe, ni fermeture automatique, ni effacement du `compact-feedback` de ton `danger`. `bridge.dimming(true)` n'est donc jamais annoncé pour une erreur, et le hook Échap côté Rust reste armé tant que l'erreur est visible : **aucun changement natif requis, mais un effet à mesurer**. `host.rs::install_escape_hook` avale Échap dès que la fenêtre au premier plan est l'application source ; en 0.4.0 le budget de lecture le relâchait en 5 à 30 s via `overlay_dimming(true)`, en 0.5.0 il n'est relâché que par Échap, Fermer ou la capture suivante. À vérifier en vraie fenêtre après la fusion.

## 11. Ports de test

Une unité, un port, passé par `FLOWTRANSLATE_TEST_PORT` : verre 5181, Réglages 5182, atelier 5183 (e2e) et 5184 (visuels). `playwright.config.ts`, `playwright.visual.config.ts`, `.github/workflows/ci.yml` et le bloc `scripts` de `package.json` ne sont touchés par personne. Le verre corrige au passage le défaut `http://127.0.0.1:5173` de `scripts/capture-ui-preview.mjs:7` et `scripts/profile-ui.mjs:6`.

## 12. Type-check des tests

`tsconfig.app.json` n'inclut que `"src"` et n'est pas modifié. L'atelier crée `tsconfig.test.json` (`include: ["e2e", "visual-tests"]`, mêmes options que `tsconfig.app.json` **sauf `tsBuildInfoFile`, qui vaut `./node_modules/.tmp/tsconfig.test.tsbuildinfo`** — deux projets partageant un même fichier d'état rendent `tsc -b` non déterministe) et l'ajoute aux `references` de `tsconfig.json`. En attendant la fusion, le verre et les Réglages type-checkent leurs propres fichiers de test par l'invocation autonome inscrite dans leur acceptation.

## 13. Géométrie, fenêtres et invariants

`src/layout.ts` et le hit-test Rust ne changent pas : aucune valeur de la famille `geometry` ne bouge (380 / 28 / 28 / 16 / 14 / 196 / 60, halo 32-20-44, marges 16-22-13 et 18-28-16, préréglages 16/24 à 26/39). L'étiquette d'action élargit la pilule : la région 1 change, le `frame` reste `regions[0]`. Rien ne prend le focus ; la garde qui revalide la sélection avant collage n'est pas affaiblie ; aucun texte, résultat, presse-papiers ni clé dans les journaux ; l'historique reste opt-in et chiffré DPAPI.

**La fenêtre `settings` passe à `width: 760, height: 640`** dans `tauri.conf.json:51-52` (aujourd'hui 620 × 720) ; `minWidth: 460, minHeight: 420` ne bougent pas. C'est le natif qui fait ce changement ; les Réglages mettent en page pour 760 (navigation 184 + contenu) et pour le repli en onglets sous 640 px.

## 14. Assertions qui franchissent une frontière d'unité

Une unité qui assertionne une surface appartenant à une autre **ne l'adresse jamais par un libellé français figé**. Deux moyens, dans cet ordre :

1. **Points d'accroche gelés**, présents en 0.4.0 comme en 0.5.0 : `.translation-bubble`, `.wait-pill`, `.action-pill`, `.more-menu`, `.compact-feedback`, `.translation-copy`, `.translation-text`, `.original-copy`, `.notice-pill`, `.glass-overlay[data-form]`, `[data-lab-phase]`, `[data-settings-page]`, `[data-settings-ready]`, `.settings-window`, `.settings-titlebar`, `.settings-scroll-viewport`.
2. **Motif tolérant** quand un rôle accessible est indispensable, acceptant l'ancien et le nouveau nom. Liste exhaustive, employée par l'atelier dans `e2e/workbench.pw.ts` et `e2e/reported-defects.pw.ts` :
   - `/Copier (la traduction|le résultat)/`
   - `/(Plus d’options|Options du résultat)/`
   - `/(Traduction|Traitement) en cours/`

Ces trois motifs sont resserrés sur la chaîne finale après la fusion, dans le commit qui régénère les références. Une unité assertionne ses **propres** chaînes au caractère près, sans tolérance.

---

## Unités

### verre — Le verre : overlay 1.0, étiquette d'action, erreurs qui restent

**Fichiers**

- `src/GlassOverlay.tsx`
- `src/glass.css`
- `src/ui.tsx`
- `src/useTranslation.ts`
- `src/reducer.ts`
- `src/reducer.test.ts`
- `src/layout.ts`
- `src/layout.test.ts`
- `src/text.ts`
- `src/text.test.ts`
- `src/overlay-ipc.ts`
- `e2e/ui.pw.ts`
- `e2e/native-bridge.pw.ts`
- `e2e/native-fixture.ts`
- `e2e/overlay.layout.spec.mjs`
- `scripts/probe-native-ui.mjs`
- `scripts/profile-ui.mjs`
- `scripts/capture-ui-preview.mjs`

**Direction**

Tu portes la surface que les gens voient trois secondes par jour. Elle est déjà juste dans sa forme : ce qui change, c'est sa matière (le bleu pâle générique laisse la place au graphite et au jaune surligneur, seule couleur porteuse de sens), ce qu'elle dit d'elle-même (une étiquette d'action dans la pilule, parce que plusieurs raccourcis produisent des résultats différents et que rien ne disait si le texte était une traduction ou une correction), et sa tenue en cas d'échec (une erreur manquée est un échec muet : elle ne s'efface plus toute seule).

Réécris `glass.css` depuis `docs/design-system/components/bundle.css` — il est écrit à la main sur `window.React` et n'est pas importable, sers-t'en comme référence de rendu, pas comme source. Les classes `ft-*` du bundle restent chez lui : dans le code, les cinq sélecteurs mesurés par `publish()` gardent leurs noms, dans leur ordre, parce que Rust réserve la fenêtre native une fois par forme à partir d'eux.

Quatre pièges de cohabitation, tous réglés par le contrat § 6, et tu es le seul à pouvoir les voir venir depuis ton worktree.

(a) `glass.css` commence par `@import './tokens.css';` — c'est ainsi que tu as des variables chez toi, où `styles.css` est encore en 0.4.0.

(b) **Ne recopie jamais `--focus`, `--switch-on` ni `--switch-thumb-on` dans ta copie locale des variables.** Ces deux premiers noms existent dans les deux fichiers ; ce sont les seuls. Comme les propriétés personnalisées sur `:root` se résolvent par ordre de déclaration et non par spécificité, chez toi (styles puis tokens) l'anneau de focus est déjà jaune, et chez les Réglages (tokens puis styles) il serait bleu : ils suppriment les trois noms du bloc legacy de leur côté. Toi, le design system te demande `signal` à l'intérieur du verre et non `signal-ink` (README:68) : écris-le en surcharge scopée, `.glass-overlay { --focus: var(--signal); }`, jamais en redéclaration sur `:root`. Et inscris dans tes tests une assertion sur la valeur calculée : c'est ce qui empêche quiconque de réintroduire le bleu.

(c) Les tokens posent `--halo-*` sur `:root` : ton reset à 0 hors `.native-overlay` doit survivre, sinon l'aperçu navigateur prend le padding et les tests de boîtes tombent.

(d) `.icon-button`, `.primary-action` et `.quiet-action` sont chez toi mais employés par les Réglages, et `glass.css` est émis **après** `styles.css` : scope-les sous `.glass-overlay`, sans quoi tes boutons d'overlay repeindront ceux des Réglages, y compris en thème clair. Même raison pour `.original-copy`, que `tokens.css:139` fige à 14/20 alors que l'original suit la taille choisie.

**La transparence est un invariant que ton CSS est seul à pouvoir défendre.** `index.html:6` garde `<meta name="color-scheme" content="light">` et personne ne posera `color-scheme` sur l'overlay : tes fenêtres sont `transparent: true` et rien ne peint leur racine aujourd'hui — `glass.css:12` ne pose la transparence que sur `.native-overlay`, un div, et `body`/`html` n'ont aucun fond. Ça tient par le fond transparent du WebView sous un canevas clair, ce qui est un équilibre fragile. Déclare-le explicitement : `html` et `body` transparents sous `body.app-window-overlay` et `body.app-window-capsule`. Une couleur explicite bat tout défaut d'agent utilisateur, et c'est invisible dans ton acceptation navigateur, où la page d'aperçu a son propre fond.

`src/ui.tsx` est à toi, mais les Réglages s'en détachent dans cette même version. Le piège est que **ton worktree contient encore un `App.tsx` 0.4.0 qui importe `Icon`, `Segmented`, `SettingSwitch` et `useFade` depuis `./ui`, avec les anciens noms de glyphes** (`more`, `close`, `chevron`, `clipboard`, `unpin`, `spinner`). Ajoute les 30 noms du design system, garde les 10 anciens en alias, ne touche ni à `Segmented` ni à `SettingSwitch` : ton build passe, la fusion compile, et le ménage se fait après.

Dans `GlassOverlay.tsx` : l'étiquette vient de `capture.execution.actionName` (un résultat revu depuis l'icône n'a pas d'`execution` — pas d'étiquette, et c'est correct) ; l'épingle se signale par l'état enfoncé, plus par `pin-off` qui se lisait « désactivé » ; le menu prend une icône par entrée et « Échap » en indication sur Fermer ; l'erreur devient icône + deux phrases + deux puces en ligne, ce qui supprime le renvoi « Réglages et Réessayer dans le menu ⋯ ». La puce Réglages ouvre Moteurs sur la carte du profil qui a échoué, par ton propre `src/overlay-ipc.ts` (contrat § 1, § 3, § 6).

Erreurs sans estompe : trois endroits, pas un. `settled` inclut `error` et alimente le budget de lecture ; le `compact-feedback` s'efface après 3 s ; le refus de collage passe aujourd'hui par ce même feedback. Traite le refus de collage comme une erreur — ce verre porte le seul exemplaire du résultat. Le corollaire est que rien n'annonce `dimming` et que le hook Échap reste armé côté Rust sans que tu aies à le demander.

L'élargissement de la pilule par l'étiquette change les largeurs mesurées dans tes tests (76/100 aujourd'hui) : recalcule-les sur le rendu réel plutôt que de relâcher les assertions. Les couleurs codées en dur qu'ils vérifient (`rgb(232,234,239)`, `rgba(24,26,31,.96)`) deviennent les tokens ; vérifie la valeur calculée, pas une constante recopiée au hasard. Les deux tests Réglages de `e2e/ui.pw.ts` (lignes 250 et 415) et le bloc Réglages de `e2e/native-bridge.pw.ts` (258-317) partent chez l'unité Réglages : retire-les, ne les réécris pas. **`e2e/reported-defects.pw.ts` ne t'appartient plus** : il ne va que sur `lab.html` et `lab-frame.html`, pages de l'atelier, qui le reprend — n'y touche pas. Enfin, `scripts/capture-ui-preview.mjs:7` et `scripts/profile-ui.mjs:6` visent encore `127.0.0.1:5173`, port qui n'appartient plus à personne : mets-les sur le tien.

**Acceptation**

`npm ci` ; `npm test` ; `npm run build` ; `npx tsc --noEmit --strict --skipLibCheck --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom,dom.iterable e2e/ui.pw.ts e2e/native-bridge.pw.ts e2e/native-fixture.ts` (le type-check des tests n'existe pas encore dans le dépôt, l'atelier l'y met) ; puis, en PowerShell, `$env:FLOWTRANSLATE_TEST_PORT='5181'; npx playwright test e2e/ui.pw.ts e2e/native-bridge.pw.ts e2e/overlay.layout.spec.mjs`. Un test vérifie que `--focus` résolu sur `.glass-overlay` vaut la teinte `signal` des tokens et non `#7db6ff`, et un autre que `html` et `body` calculent un fond `rgba(0, 0, 0, 0)` dans la fenêtre overlay. Ne lance pas le reste de la suite : elle teste des Réglages et un atelier encore en 0.4.0 dans ton worktree. Aucun serveur d'inférence n'est sollicité.

---

### reglages — Les Réglages : fenêtre à navigation, quatre pages, adresse vérifiée à la sortie du champ

**Fichiers**

- `src/App.tsx`
- `src/ActionSettings.tsx`
- `src/settings/`
- `src/styles.css`
- `src/main.tsx`
- `src/types.ts`
- `src/bridge.ts`
- `src/actionDefaults.ts`
- `src/actionDefaults.test.ts`
- `src/env.d.ts`
- `index.html`
- `package.json`
- `package-lock.json`
- `e2e/settings.pw.ts`
- `e2e/settings-bridge.pw.ts`
- `e2e/settings-surface.pw.ts`
- `e2e/settings-fixture.ts`
- `e2e/actions.pw.ts`

**Direction**

C'est la plus grosse part, et celle qui change de nature : une colonne unique à intertitres en capitales devient une fenêtre à navigation (Actions, Lecture, Moteurs, Confidentialité), avec l'état d'enregistrement dans la barre de titre et plus de pied. Actions et Raccourcis fusionnent : un raccourci vit désormais dans la carte de son action, donc le sélecteur « Action » d'un raccourci disparaît. Le thème suit Windows — la décision du 9 septembre restée non faite en 0.4.0 — pendant que l'overlay reste graphite quoi qu'il arrive. Mets en page pour **760 × 640** (navigation 184 + contenu, onglets sous 640 px) : le natif porte le changement dans `tauri.conf.json`, encore à 620 × 720.

**Trois gestes d'abord, dans le même commit, avant tout portage.**

1. `@import './tokens.css';` en toute première ligne de `src/styles.css` : aujourd'hui aucun fichier du dépôt n'importe les tokens, et sans ça tu développerais et « vérifierais » tout ton rendu, sombre et clair, contre des variables indéfinies.

2. **Supprime `--focus`, `--switch-on` et `--switch-thumb-on` du bloc `:root` de `styles.css:3-27`.** Ce n'est pas du ménage optionnel : ce sont les deux seuls noms (plus un cousin) que `styles.css` et `tokens.css` déclarent tous les deux, et les propriétés personnalisées sur un même sélecteur se résolvent par **ordre de déclaration**, pas par spécificité — la règle de préfixe du contrat ne protège que les classes. Les garder te donnerait un anneau de focus bleu `#7db6ff` et un interrupteur bleu là où le design system demande `signal-ink` et `signal` (README:8 et :68), et comme le verre, lui, voit déjà la couleur des tokens dans son worktree, vous captureriez et approuveriez deux rendus différents avant de découvrir l'écart après la fusion. Laisse le reste du bloc en place, y compris `--glass-*` dont ton lab dépend encore.

3. Donne-toi `src/settings/controls.tsx` (Icon, IconButton, Segmented, SettingSwitch, useFade) et abandonne l'import `./ui` : ce fichier appartient au verre, ses noms d'icônes sont ceux de 0.4.0. C'est chez toi que se fait le portage de `Segmented` en graisse constante et de `SettingSwitch` à la Windows 11. Le contrat § 6 te demande aussi de préfixer par `.settings-window` toute surcharge d'une classe globale des tokens et tes `.icon-button`/`.primary-action`/`.quiet-action` : le verre fait le geste symétrique.

Sors `SettingsWindow` de `App.tsx` vers `src/settings/`, en gardant l'export depuis `App.tsx` : le lab et des tests importent par ce chemin et ne t'appartiennent pas. La capsule reste là, câblée mais non portée : laisse-lui de quoi ne pas être cassée, rien de plus.

**Le thème se pose dans `src/main.tsx`, et seulement pour ta fenêtre.** La CSP interdit un script inline dans `index.html`, et la fenêtre n'a pas de `backgroundColor` : sans ça elle flashe en clair au premier affichage. Mais attention au voisinage : `index.html` **garde** son `<meta name="color-scheme" content="light">`, et tu poses `documentElement.style.colorScheme` **uniquement quand `window=settings`**. L'overlay et la capsule ne reçoivent que `data-theme="dark"`, qui ne touche que des variables. La raison est que ces deux fenêtres sont `transparent: true` et que rien ne peint leur racine : un `color-scheme: dark` y remplacerait le canevas transparent par une couleur opaque, et l'overlay deviendrait un rectangle gris posé sur le bureau — invisible dans ton acceptation navigateur, visible seulement dans la vraie fenêtre. Comme tu poses `color-scheme` toi-même, le `select { color-scheme: dark }` de `styles.css:149` disparaît. L'atelier applique exactement la même règle dans `src/lab/frame.tsx`, qui ne charge jamais `main.tsx` : écris-la de façon qu'elle se recopie sans ambiguïté.

La fenêtre est cachée, jamais fermée : elle reste montée entre deux ouvertures, origine de trois défauts que tu corriges d'un coup. Elle garde la page de la dernière fois (le contrat lui donne une cible à chaque ouverture, lue par `take_settings_target` puis par l'événement `settings-target`), elle garde une liste d'historique périmée, et son état de connexion est figé. Relis réglages et historique sur `settings-target` **et sur le focus de la fenêtre** : l'exigence demande « à chaque ouverture et à l'activation », et un Alt-Tab vers une fenêtre déjà visible n'émet aucun événement natif. Pose `data-settings-ready` une fois les deux chargés : c'est le point d'attente du lab et des tests.

L'adresse : aujourd'hui chaque frappe enregistre toute la structure, si bien que taper « http://1 » affiche « Non enregistré ». Rien d'invalide ne doit plus être enregistré ni signalé pendant la frappe. À la sortie du champ, `validate_endpoint` décide : refus affiché sous le champ, sans enregistrement ; adresse valide enregistrée tout de suite — vide le délai de 300 ms avant — puis, et seulement une fois l'enregistrement résolu, Vérifier part seul, parce que `check_connection` lit les réglages *enregistrés*. Modèle et clé gardent le délai de frappe.

L'historique gagne Copier, par identifiant, côté Rust : tu n'envoies jamais de texte, seulement l'id (`copy_history`). Tu n'affiches jamais le texte source. L'aperçu du verre de la page Lecture porte ses propres classes `.reading-preview` / `.reading-preview-copy` : `glass.css` est chargé dans ta fenêtre aussi, et surtout `publish()` exige un seul élément par sélecteur mesuré — réemployer `.translation-bubble` casserait la géométrie native.

Tu possèdes `src/bridge.ts` et `src/types.ts` : ajoute-y les commandes du contrat avec leur branche de démonstration navigateur, et le paramètre optionnel `target` d'`openSettings`, en respectant l'orthographe d'URL du contrat § 6. **N'ajoute `schemaVersion` ni à `types.ts` ni à aucun payload** : il vit uniquement dans la struct Rust du disque.

Tests : les deux tests Réglages de `e2e/ui.pw.ts` (250 et 415), le bloc 258-317 de `e2e/native-bridge.pw.ts`, le premier test de `e2e/reported-defects.pw.ts` (lignes 3-10, le fond `rgb(31,33,38)` de la fenêtre, qui devient `--settings-bg` des tokens et doit exister dans les deux thèmes) et une fixture Réglages tirée de `e2e/native-fixture.ts` sont à toi — recopie-les depuis 2fbfdac dans tes propres fichiers et fais-les vivre. **`e2e/actions.pw.ts` est aussi à toi, et il démarre aujourd'hui la fixture du verre** (ligne 6 : il réécrit `/src/main.tsx` en `/e2e/native-fixture.ts`) : rebranche-le sur `settings-fixture.ts` dans le commit qui crée cette fixture, sinon il reste vert chez toi contre la fixture 0.4.0 intacte et casse à la fusion.

Tu es la seule unité autorisée à ajouter une dépendance, et seulement si les onglets sous 640 px le justifient. Ne touche pas au bloc `scripts` de `package.json`.

**Acceptation**

`npm ci` ; `npm test` ; `npm run build` ; `npx tsc --noEmit --strict --skipLibCheck --jsx react-jsx --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom,dom.iterable e2e/settings.pw.ts e2e/settings-bridge.pw.ts e2e/settings-surface.pw.ts e2e/actions.pw.ts e2e/settings-fixture.ts` ; puis, en PowerShell, `$env:FLOWTRANSLATE_TEST_PORT='5182'; npx playwright test e2e/settings.pw.ts e2e/settings-bridge.pw.ts e2e/settings-surface.pw.ts e2e/actions.pw.ts`. Trois vérifications nommées, chacune fermant un piège du contrat : (1) une page rendue sous `emulateMedia({ colorScheme: 'light' })` diffère de la même page en sombre par une couleur calculée, preuve que les tokens sont chargés et que `data-theme` suit ; (2) `--focus` résolu sur `.settings-window` vaut `signal-ink` et jamais `rgb(125, 182, 255)`, dans les deux thèmes ; (3) le message d'adresse distante assertionné au caractère près, `"Un serveur distant doit utiliser HTTPS ; HTTP est réservé au bouclage local."`, contre la passerelle de démonstration — c'est la seule chose qui exerce l'accord d'insécable avec le natif avant la fusion (`settings.rs:249` n'a aujourd'hui aucune espace). Si une dépendance est ajoutée, `npm ci` doit repasser depuis un `node_modules` vide.

---

### natif — Le natif : chargement tolérant, ouverture ciblée, icône à trois états, autostart figé, libellés « résultat »

**Fichiers**

- `src-tauri/src/`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/capabilities/`
- `scripts/capture-matrix.mjs`
- `scripts/capture-matrix.ps1`
- `scripts/capture-matrix-helper.ps1`
- `scripts/test-native-ui.ps1`
- `scripts/package-test-kit.ps1`
- `scripts/inspect-native-windows.ps1`

**Direction**

Ta part tient en une idée : l'application ne doit plus pouvoir mourir en silence, et elle doit savoir dire où elle en est.

Aujourd'hui `store.load()?` (lib.rs:1292) suivi du `.expect` de `run()` (1421) tue le démarrage sans icône, sans avis, sans journal — en release, avec `panic = "abort"` et `windows_subsystem = "windows"`, l'utilisateur voit simplement que rien ne se passe. Les causes sont nombreuses et toutes bloquantes : JSON invalide, variante d'enum inconnue, base64 cassé, DPAPI qui refuse un fichier venu d'un autre compte Windows, et un `actions: []` qui panique sur `actions[0]` (settings.rs:107) avant même `validate`. Mets une garde avant cette indexation, écarte le fichier au lieu de l'écraser, charge la dernière sauvegarde ou des réglages neufs, et dis-le. `HistoryStore::new(&root)?` est le même bug à la ligne suivante : traite-le pareil, sinon la vérification « fichier corrompu → démarrage avec avis » est fausse dès que SQLite est en cause.

Dire, justement : `show_notice` exige que `AppState` soit géré et que l'overlay écoute déjà, et le tampon `pending_capture` / `frontend_ready` ne couvre que les captures. Un avis émis dans `setup` serait perdu — il lui faut sa propre file d'attente. Le Callout dans les Réglages passe par `take_startup_notice`, lu au montage.

`schemaVersion` : deux pièges, pas un. Le premier est qu'une 0.4.0 relancée réécrit le fichier depuis sa struct et supprime tout champ inconnu ; au retour en 0.5.0 le fichier ressemble à une v0 et une sauvegarde aveugle écraserait la vraie. Le second est de tenter de le faire voyager : **le champ ne vit que dans `PersistedSettings`**, jamais dans `types::Settings` ni sur le fil — `get_settings`/`save_settings` transportent une struct distincte, et l'y ajouter ferait échouer la désérialisation des objets renvoyés par le front. Garde `mode`, `profiles`, `outputMode` et 1 à 12 raccourcis toujours écrits, et surtout aucun `deny_unknown_fields`.

`open_settings` ne prend aucun paramètre et n'émet rien ; la fenêtre existe déjà, cachée, et ne peut donc pas se re-router au montage. Donne-lui la cible du contrat, mémorise-la, émets-la, et fais que chaque ouverture reparte de là. Attention au cas du raccourci refusé au démarrage : il doit montrer sa raison **sur la carte de son action**, or `lib.rs:1300` ne collecte aujourd'hui que `b.shortcut.clone()` dans un `Vec<String>` — l'`actionId` est déjà perdu quand la boucle 1377-1382 échoue. Collecte le couple.

L'icône de notification n'a qu'un glyphe et aucun état. Elle en gagne trois, choisis sur `SystemUsesLightTheme` et relus à `WM_SETTINGCHANGE`. Réserve l'alerte à ce qui demande une action — moteur, collage, réglages illisibles, raccourci refusé — et laisse « Rien à traiter » ne rien changer. Les fichiers viennent de l'unité marque : charge-les à l'exécution depuis les ressources et garde l'icône en place s'ils manquent, pour ne pas dépendre d'elle pour compiler.

**L'autostart est la seule préparation du renommage qui ne peut pas attendre.** `tauri_plugin_autostart::Builder::new()` est construit sans option (lib.rs:1288), donc le nom de la valeur `Run` est `package_info().name`, c'est-à-dire `productName`. Si la 0.5.0 sort ainsi, le build renommé écrira une autre valeur, laissera `Run\FlowTranslate` lancer un exe périmé, et `disable()` échouera sur la valeur absente. Fige `app_name("FlowTranslate")` maintenant, tant que `productName` vaut encore cela, et réconcilie `Run` au démarrage — rien ne l'est aujourd'hui, le seul basculement est dans `save_settings` (209-229). La réconciliation va **dans les deux sens**, et la seconde direction n'est pas un luxe : quand un fichier illisible est écarté sans sauvegarde, tu repars de `Settings::default()` (types.rs:202) donc `autostart: false`, alors que la valeur `Run` existe toujours. Windows continuerait de lancer l'application avec une case décochée que l'utilisateur ne peut pas décocher, le basculement n'ayant lieu que sur changement. Donc : réglages de confiance et `autostart` vrai → on réécrit une valeur absente ou pointant ailleurs que `current_exe()` ; réglages récupérés et valeur `Run` présente pointant sur notre exécutable → elle fait foi, `autostart` passe à vrai et est persisté ; `disable()` sur une valeur absente est toléré.

Deux détails à ne pas manquer. `tauri.conf.json:51-52` met la fenêtre `settings` à 620 × 720 ; elle passe à **760 × 640**, minimum inchangé — les Réglages sont mis en page pour cette largeur et n'ont pas la main sur le fichier. Et `copy_history` est la première commande qui met du texte stocké en clair dans le presse-papiers : refuse-la si `window.label() != "settings"`, comme `get_settings` le fait déjà (158-161) et comme `get_history`/`delete_history` (1038-1045) ont oublié de le faire.

Enfin les libellés : l'app ne parle plus seulement de traduction. La règle vaut aussi pour les chaînes à point-virgule de `capture.rs`, `lib.rs` et `inference.rs` — raison d'abord, quoi faire ensuite, ni « traduction » ni « profil ». L'espace insécable du contrat § 8 s'écrit `\u{00A0}` et pas par un caractère collé, et elle ne s'applique **pas** aux deux-points d'un `hôte:port` : trois de tes chaînes sont lues et assertionnées par les Réglages, un caractère de travers et la fusion livre des littéraux qui ne se comparent plus. « Rien à traduire dans la fenêtre active. » est attendu mot pour mot par `scripts/capture-matrix.mjs:123`, qui est à toi : mets-le à jour avec le message. Les trois scripts PowerShell natifs que tu récupères portent des littéraux `FlowTranslate` (nom d'exe, nom de processus) : ne les renomme pas, ils font partie du commit de renommage, mais sache qu'ils sont chez toi.

**Acceptation**

Dans `src-tauri/` : `cargo fmt --check` ; `cargo clippy --all-targets` sans nouvel avertissement ; `cargo test` ; `cargo build`. Ajoute des tests sur le chargement tolérant : fichier tronqué, `actions: []`, DPAPI illisible, absence de `schemaVersion` avec et sans `settings.v0.json` préexistant, relecture d'un fichier 0.5.0 par la désérialisation 0.4.0, et récupération sans sauvegarde avec une valeur `Run` présente (le drapeau `autostart` doit ressortir vrai). Un test compare les trois chaînes partagées du contrat § 8 à leur forme attendue — elles contiennent U+00A0, « Aucune réponse de 127.0.0.1:8001. » n'en contient pas — étant entendu que ce test ne prouve que ta moitié de l'accord : l'autre est assertionnée par les Réglages, et la confrontation réelle a lieu à la fusion. Aucun serveur d'inférence n'est démarré ni sollicité : `--simulate-inference` si un essai de bout en bout est nécessaire.

---

### atelier — L'atelier : scénarios, thème réel des Réglages, matrice des références, type-check des tests

**Fichiers**

- `src/lab/`
- `lab.html`
- `lab-frame.html`
- `visual-tests/states.spec.ts`
- `visual-tests/README.md`
- `e2e/workbench.pw.ts`
- `e2e/reported-defects.pw.ts`
- `tsconfig.json`
- `tsconfig.test.json`

**Direction**

L'atelier est l'endroit où la 0.5.0 se regarde. Aujourd'hui il ment sur deux points : `settings-dark` et `settings-light` sont le même fichier au md5 près, comme `history-dark` et `history-light`, et le README annonce 19 PNG là où il y en a 23.

La cause du premier mensonge est précise, et c'est ta pièce maîtresse. `src/tokens.css` n'a aucun bloc `prefers-color-scheme` : seulement `:root, [data-theme="dark"]` et `[data-theme="light"]`. La logique qui traduit la préférence système en `data-theme` vit dans `src/main.tsx` — que `lab-frame.html` ne charge jamais, son entrée étant `src/lab/frame.tsx`, qui se contente de `document.documentElement.style.colorScheme = theme` (ligne 45, sous un garde `surface !== 'production'`). Tant que personne ne pose `data-theme` dans le lab, un `emulateMedia` ne change rien et chaque référence des Réglages ressort en sombre. **Applique donc dans `frame.tsx` exactement la même règle que `main.tsx`** (contrat § 6) : `data-theme="dark"` en dur pour les scénarios overlay et capsule, `matchMedia('(prefers-color-scheme: dark)')` pour les scénarios Réglages. Un point à ne pas recopier de travers : **`colorScheme` ne se pose que pour les scénarios Réglages**, jamais pour l'overlay ni la capsule, parce que ces fenêtres sont transparentes en natif et qu'un canevas sombre opaque y ferait un rectangle gris sur le bureau. `?theme=` ne pilote plus que `data-preview-background`, le décor derrière le verre, et les références des Réglages se prennent par `emulateMedia({ colorScheme })` — ce que `visual-tests/README.md` annonçait déjà comme évolution.

Ta mission ensuite est de rendre la matrice complète pour la 1.0 : chaque page des Réglages (Actions, Lecture, Moteurs, Confidentialité) en sombre et en clair, le verre d'erreur, la pilule avec son étiquette d'action, l'historique. Tu ne régénères aucune image : c'est une opération de revue, faite après la fusion. Ce que tu livres, c'est le code qui produira la bonne matrice, et un README qui décrit ce qu'elle contient réellement.

**Tu récupères `e2e/reported-defects.pw.ts` et tu gardes `e2e/workbench.pw.ts`**, parce que ce sont les deux seuls fichiers de la suite qui ne vont jamais ailleurs que sur `lab.html` et `lab-frame.html` : tout ce qu'ils exercent passe par tes `bugs.tsx`, `frame.tsx` et `scenarios.ts`. Leur premier test — le fond `rgb(31,33,38)` de la fenêtre Réglages, lignes 3-10 — part chez les Réglages, ce n'est pas ta surface. Reste le vrai nœud : ces fichiers rendent le **verre** à l'intérieur de tes pages et l'assertionnent au libellé français (« Copier la traduction » cinq fois, « Plus d'options » deux fois), libellés que le verre renomme dans son worktree et que tu ne verras pas changer dans le tien. Applique la règle du contrat § 14 : adresse ces surfaces par leurs points d'accroche gelés (`.wait-pill`, `.translation-copy`, `.translation-text`, `.action-pill`, `.more-menu`, `[data-form]`, `[data-lab-phase]`), et quand un rôle accessible est indispensable, par l'un des trois motifs tolérants listés là-bas, qui acceptent l'ancien et le nouveau nom. Le test reste vrai, il est vert chez toi comme après la fusion, et l'après-fusion le resserre sur la chaîne finale. Tes **propres** chaînes — le « Rien à traiter dans la fenêtre active. » de `frame.tsx:25`, les boutons de scénario, les descriptions de `scenarios.ts` — se vérifient au caractère près : mets-les d'accord avec le contrat § 8, sans quoi le banc décrit une application qui n'existe plus.

Tu apportes aussi au dépôt ce qui manquait pour que ce genre de dérive se voie : `tsconfig.app.json` n'inclut que `"src"`, donc `tsc -b` ne vérifie ni `e2e/` ni `visual-tests/`, et Playwright transpile par esbuild sans vérifier les types. Crée `tsconfig.test.json` sur ces deux dossiers, aux mêmes options que `tsconfig.app.json` **mais avec son propre `tsBuildInfoFile`** — deux projets qui partagent un fichier d'état rendent `tsc -b` non déterministe — et ajoute-le aux `references` de `tsconfig.json`. Ne touche pas à `tsconfig.app.json`.

Deux contraintes de compilation. Ton worktree part de 2fbfdac : les Réglages y sont encore en 0.4.0, tout en CSS sombre codée en dur. N'importe donc rien de nouveau — la page se choisit par `?page=` dans l'URL, que la fenêtre lit elle-même, et l'attente de disponibilité vise `[data-settings-ready]` avec un repli borné, pour que tes tests passent avant comme après la fusion. Attends-toi à ce que le clair et le sombre se ressemblent chez toi : c'est normal tant que les Réglages ne sont pas portés, ton travail est de garantir que le signal arrive. Le spec visuel, lui, sera rouge : il décrit la 1.0.

La capsule sort des scénarios (plus affichée depuis le 10/09, retirée par le design system) ; laisse son import tranquille si tu ne le supprimes pas. Chaque scénario ajouté coûte deux références : choisis-les pour ce qu'ils prouvent.

**Acceptation**

`npm ci` ; `npm run build` ; `npx tsc -b tsconfig.test.json` (ton nouveau projet : c'est lui qui prouve que la matrice compile, là où `--list` ne prouvait que le parsing) ; puis, en PowerShell, `$env:FLOWTRANSLATE_TEST_PORT='5183'; npx playwright test e2e/workbench.pw.ts e2e/reported-defects.pw.ts` — les deux doivent être verts dans ton worktree, où le verre et les Réglages sont encore en 0.4.0 : c'est précisément ce que les points d'accroche et les motifs tolérants du contrat § 14 rendent possible. Puis `$env:FLOWTRANSLATE_TEST_PORT='5184'; npx playwright test --config playwright.visual.config.ts --list`. Vérifie en plus, par un test sur le lab, qu'une page Réglages rendue sous `emulateMedia({ colorScheme: 'light' })` porte `data-theme="light"` sur `documentElement`, et qu'un scénario overlay ne porte **aucun** `color-scheme` inline : c'est la seule preuve, avant la fusion, que le signal de thème arrive aux tokens sans casser la transparence. L'exécution réelle des comparaisons visuelles et la régénération viennent après la fusion.

---

### marque — La marque : icône d'application et glyphes de la zone de notification

**Fichiers**

- `src-tauri/icons/`
- `scripts/build-icons.mjs`
- `scripts/check-icons.mjs`

**Direction**

La tuile actuelle — trois traits et une coche bleue — appartient à l'ancienne identité. Le design system livre la nouvelle : trois lignes de texte dont la médiane est passée au surligneur, pointe biseautée comme un marqueur. Les sources sont dans `docs/design-system/assets/Logos/` et `assets/Tray/`, avec leur README qui fixe les encres, la grille et la zone de protection.

Deux familles, deux usages qu'il ne faut pas confondre. L'icône d'application est la tuile graphite, source de l'ICO (16, 24, 32, 48, 256) et de l'installateur. Les glyphes de notification sont monochromes, dessinés sur une grille de 16 entière, en trois états et deux encres selon la couleur de la barre des tâches — Windows les affiche sans recoloration, d'où la seule exception à l'encre unique, la pastille rouge de l'état alerte.

**Une nuance qui fait de ton lot un point de passage pour tout le dépôt.** `bundle.icon` ne liste que `icons/icon.ico` (`tauri.conf.json:71-73`), et tauri-codegen lit ce fichier **à la compilation Rust** : un ICO malformé, ou dont les couches ne sont pas celles attendues, ne casse pas seulement une icône, il casse `cargo build` pour tout le monde. C'est aussi ce que renvoie `app.default_window_icon()`, donc le repli de l'icône de notification quand les PNG d'exécution manquent : ta tuile doit rester lisible à 16 px, ce n'est pas seulement une icône de bureau.

Le travail est une chaîne de rasterisation, pas du dessin : les SVG sont livrés. Chromium est déjà installé par `@playwright/test` — c'est un rasterizer disponible sans nouvelle dépendance, et le seul du dépôt. Un ICO n'est qu'un répertoire d'entrées suivi de PNG concaténés : il s'assemble en Node pur. Écris la génération comme un script rejouable, pas comme un geste manuel, et écris le contrôle qui la vérifie — dimensions réelles, nombre et tailles des entrées de l'ICO, encre attendue sur quelques pixels témoins des six glyphes, pastille présente dans les deux variantes d'alerte et absente ailleurs. Vérifie des propriétés, pas une empreinte : un PNG rasterisé par Chromium est en général reproductible octet pour octet, mais rien ne le garantit en travers d'un changement de pilote ou de fontes, donc ne bâtis pas ton contrôle sur un md5.

Les noms de fichiers de l'icône d'application ne changent pas : `tauri.conf.json` continue de les désigner sans être modifié. Les glyphes de notification vont dans le sous-dossier et aux noms que le contrat fixe, en deux tailles ; l'unité natif les charge à l'exécution et se replie silencieusement s'ils manquent, donc rien ne casse si ton lot arrive en dernier. Ne touche ni à `tauri.conf.json`, ni au code Rust, ni à `package.json`.

**Acceptation**

`node scripts/build-icons.mjs` régénère tout depuis les SVG du design system, puis `node scripts/check-icons.mjs` valide dimensions, entrées de l'ICO et pixels témoins, et sort en erreur si un fichier manque ou dérive. **`cargo build` dans `src-tauri/`** : c'est la seule commande qui exerce la lecture de `icons/icon.ico` par tauri-codegen, donc la seule qui attrape l'ICO malformé qui casserait la compilation de tout le dépôt ; aucune des autres vérifications ne compile Rust. `npm run build` en sanity, aucun fichier du front n'étant touché. Une seconde génération ne doit pas produire de différence visible dans `git status` ; si elle en produit une, compare les propriétés avant de conclure à une régression.

---

## Après la fusion

**Dans l'ordre, une fois les cinq lots fusionnés dans `feat/0.5.0-design-1.0`.**

1. **Compilation et suite complète d'un seul tenant** : `npm ci`, `npm test`, `npm run build`, `npx tsc -b` (qui vérifie désormais `e2e/` et `visual-tests/` par le `tsconfig.test.json` de l'atelier — premier passage où les fichiers de test du verre et des Réglages sont réellement type-checkés), `npx playwright test` sans cloisonnement de port, puis `cargo test`, `cargo clippy --all-targets` et `cargo build` dans `src-tauri/`. C'est aussi le premier moment où les moitiés de tests scindées et les libellés partagés se confrontent : toute divergence d'insécable apparaît ici, entre l'assertion Rust du natif et l'assertion Playwright des Réglages sur la même chaîne.

2. **Resserrage des assertions tolérantes, en un commit.** Les trois motifs du contrat § 14 employés par l'atelier dans `e2e/workbench.pw.ts` et `e2e/reported-defects.pw.ts` (`/Copier (la traduction|le résultat)/`, `/(Plus d’options|Options du résultat)/`, `/(Traduction|Traitement) en cours/`) sont remplacés par la chaîne finale, exacte. C'est la contrepartie de ce qui les rendait verts dans deux worktrees à moitié 0.4.0 ; les laisser tolérants laisserait passer un renommage incomplet.

3. **Ménage des duplications assumées**, en un commit, avant la montée de version :
   - retirer l'`@import './tokens.css';` de `src/glass.css`, garder celui de `src/styles.css`, et vérifier par un diff visuel que rien ne bouge (les surcharges étant préfixées et les deux propriétés personnalisées en collision ayant été supprimées de `styles.css`, l'ordre ne doit plus compter) ;
   - retirer de `src/ui.tsx` les 10 alias d'icônes, `Segmented` et `SettingSwitch`, plus rien ne les important ;
   - retirer de `src/styles.css` le reste du bloc `--glass-*` (3-27) devenu orphelin, `glass.css` portant sa copie ;
   - fondre `src/overlay-ipc.ts` dans `src/bridge.ts` et les deux constantes de nom front dans un `src/brand.ts` unique. C'est la dette du travail en parallèle (décisions 14, 19, 20, 21, 25) ; la payer ici rend le commit de renommage aussi petit qu'annoncé.

4. **Montée de version 0.5.0** en un commit : `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et `Cargo.lock`. Le pied de la navigation affiche « FlowTranslate 0.5.0 » via `__APP_VERSION__`, donc la référence visuelle correspondante se régénère après, pas avant.

5. **Références visuelles** : `npm run ui:reference`, puis revue image par image avant de committer — chaque page des Réglages en sombre et en clair (vérifier d'abord que les deux diffèrent réellement, c'est le défaut historique), le verre d'erreur, la pilule à étiquette, l'historique. Une comparaison verte ne dit que « le rendu n'a pas changé » ; c'est la revue qui approuve. Contrôler au passage la couleur de l'anneau de focus : elle doit être le jaune `signal` sur le verre et l'ambre `signal-ink` dans les Réglages, jamais le bleu `#7db6ff` de la 0.4.0. Mettre `visual-tests/README.md` d'accord avec le nombre réel de fichiers.

6. **Documentation**, en un lot — livrable explicite de la ligne 0.5.0, qu'aucune unité ne porte : `docs/BRIDGE.md` (les quatre commandes nouvelles avec la garde de fenêtre sur `copy_history`, le paramètre de cible, l'événement `settings-target`, `schemaVersion` et le fait qu'il ne traverse pas l'IPC) ; `docs/DEPLOYMENT.md` et `docs/ENDPOINTS.md` réécrits — ils décrivent encore 0.2–0.4 avec « Connexion avancée », « langue cible », les ports 8001–8002 seuls et un message HTTPS sans espace, et ne donnent pas de retour arrière par `settings.v{n}.json` ; titre « Brancher un moteur », Réglages → Moteurs, Général sur 8003, procédure du § 6.2 avec `%APPDATA%\com.flowtranslate.desktop\`, messages recopiés du code **avec leurs insécables**. `docs/UI-DECISIONS.md` reçoit les décisions ci-dessus, en particulier 25 (collision de propriétés personnalisées), 26 (pourquoi l'overlay ne pose jamais `color-scheme`) et 27 (qui assertionne quelle surface). `docs/RELEASE-NOTES.md` recopie la procédure de retour arrière.

7. **Vérifications qui ne se délèguent pas.**
   - `settings.json` tronqué à la main → l'application démarre, l'avis s'affiche, `settings.v0.json` est chargé, le fichier écarté est présent avec son horodatage ; même essai avec `history.sqlite3` corrompu.
   - L'exécutable 0.4.0 lancé sur un fichier 0.5.0 → il démarre et l'historique reste lisible.
   - **La fenêtre overlay dans le produit réel, sur un fond clair et sur un fond sombre** : elle doit rester découpée, sans rectangle gris ni blanc autour du verre. C'est le contrôle de la décision 26 ; la règle CSS le prévient par construction, ce test le prouve.
   - **`tauri build` au moins une fois** : le glob `resources: ["icons/tray/*.png"]` n'est exercé que là, `cargo build` ne bundle rien. Vérifier que les glyphes sont bien résolus par `BaseDirectory::Resource` dans le produit installé.
   - **Autostart** : cocher, vérifier `HKCU\…\Run\FlowTranslate` et son chemin ; déplacer l'exe, relancer, vérifier la réécriture ; décocher, vérifier la suppression ; décocher sur une valeur déjà absente sans message d'erreur ; et le cas de la décision 29 — corrompre `settings.json` sans sauvegarde alors que `Run` existe, relancer, vérifier que la case revient cochée et reste décochable.
   - **Échap** (conséquence de la décision 6) : avec un verre d'erreur affiché, vérifier dans Word ou Teams que le hook avale Échap tant que l'erreur est là, et le relâche à Échap, Fermer ou la capture suivante. En 0.4.0 le budget de lecture le relâchait en 5 à 30 s ; c'est le changement de tenue le plus intrusif de la version.
   - Puis la vraie fenêtre Réglages : 760 × 640 à l'ouverture, thème clair et sombre, 125 %, redimensionnement au minimum 460 × 420, et l'icône de notification dans ses trois états sur barre claire et sombre. L'instance réelle se lance depuis l'exécutable du target de build, arrêtée avant toute reconstruction.

8. **Ce qui revient à Lucas** : l'inférence réelle et la matrice de capture sur le produit installé. Le § 12 les exige pour la 0.5.0 ; la consigne interdit de démarrer ou de solliciter un serveur, donc les unités s'en tiennent à `--simulate-inference` et au bridge de démonstration.

9. **Le nom**, quand Lucas l'aura choisi : un commit qui touche `src/brand.ts`, la constante Rust, les titres de fenêtres, les infobulles, `index.html`, le README, et les littéraux `FlowTranslate` des scripts PowerShell natifs (`test-native-ui.ps1`, `package-test-kit.ps1`, `inspect-native-windows.ps1`, `capture-matrix.ps1`), qui portent le nom d'exe et de processus. `autostart::Builder::app_name` est déjà figé par l'unité natif, avec la réconciliation du chemin au démarrage : c'est ce qui rend ce commit sûr. `identifier com.flowtranslate.desktop` ne bouge pas — les chemins `%APPDATA%`, le mutex de single-instance et la case « supprimer les données » de NSIS en dépendent. `productName` déplace `%LOCALAPPDATA%\<nom>\` et la clé de désinstallation : à vérifier avec un installateur NSIS réel avant de le changer. Les alias `flowtranslate-fast/quality/general` du serveur sont écrits dans les `settings.json` existants : les renommer côté serveur provoquerait « modèle non exposé ».

---

## Hors périmètre 0.5.0

**Reporté, même quand le design system ou la spec le décrit déjà.** Le faire maintenant referait les Réglages deux fois.

- **0.6.0 (Moteurs)** : serveurs distincts des moteurs, moteurs nommables, lieu, « Traduction seulement », ServerCard / EngineRow / AddEngine, moteur par action, moteur forcé et sous-menu « Moteur ▸ », « Relancer avec… », erreurs nommées (401, modèle absent), « Où vont vos textes », ajout guidé, découverte de `flowtranslate-*` sur le PC. En 0.5.0, Moteurs garde exactement deux EngineCard, Qualité et Rapide, et le menu ⋯ garde « Relancer en {autre} ».
- **0.7.0 (Actions)** : sortie habituelle par action, trois cas de cible, Remplacer dans la pilule du verre court, Essayer, Dupliquer, « Nouvelle action ▾ », suppression avec Annuler, fin de l'action par défaut, règles de sortie sorties du texte de la consigne, ordre livré, AltGr pour les nouvelles combinaisons, garde de frappe et de clic. Le badge et le bouton « Par défaut » restent donc en 0.5.0, et « Supprimer l'action » reste bloquée quand elle est utilisée.
- **0.8.0 (Bulle d'actions)** : geste Ctrl+Alt+Espace, ActionPicker, lettres, « Dans la bulle », présélection selon le contexte, 0 à 24 raccourcis, encadré « Nouveau », hooks sur thread dédié, moteur pour cette fois. `picker-width`, `picker-rows` et la forme `choosing` n'entrent pas dans la famille `geometry`, et `layout.ts` ne bouge pas.
- **0.9.0 (Premier lancement)** : page Démarrer, avis « prêt », adresse demandée sans serveur trouvé, démarrage automatique écrit à la fermeture de la page. L'ouverture reste donc sur Actions, et « Lancer à l'ouverture de session » garde sa formulation.
- **Étape 0** : le prototype jetable du hook clavier vit sur sa propre branche, en parallèle, et ne touche à rien ici.

**Hors périmètre pour d'autres raisons.**

- **Suppression de la capsule** (décision 13) : conservée câblée, retirée du lab et des références, style graphite minimal.
- **Renommage du produit** : préparé (constantes, classes de `body` neutres, `autostart::Builder::app_name` figé et `Run` réconcilié au démarrage), pas exécuté. Les littéraux `FlowTranslate` des scripts PowerShell natifs ont désormais un propriétaire (le natif) mais ne sont pas touchés dans cette version.
- **Régénération des références visuelles, resserrage des assertions tolérantes, montée de version, `docs/BRIDGE.md`, `docs/DEPLOYMENT.md`, `docs/ENDPOINTS.md`, `docs/UI-DECISIONS.md`** : après la fusion, chez l'orchestrateur, pas dans les unités.
- **Fichiers en lecture seule, qu'aucune unité ne possède ni ne modifie** : `src/tokens.css`, `docs/design-system/` (y compris `tokens.json` et `components/bundle.*`, qui servent de référence de rendu), `src/layout.ts` en valeurs et le hit-test Rust, `playwright.config.ts`, `playwright.visual.config.ts`, `tsconfig.app.json`, `.github/workflows/ci.yml`, et le bloc `scripts` de `package.json`. Les références visuelles restent win32 et hors CI.
- **`release/ui-evidence/`** : `e2e/reported-defects.pw.ts` y écrit ses captures. Le dossier `release/` n'entre jamais dans le dépôt, quelle que soit l'unité qui lance le test.
- **Inférence réelle, matrice de capture sur le produit installé, démarrage ou arrêt d'un serveur ou d'un processus GPU** : aucune unité n'y touche.
- **`tauri build`** : hors acceptation des unités (`cargo build` ne bundle pas les ressources) ; exercé une fois après la fusion. En revanche `cargo build` **entre** dans l'acceptation de la marque, parce que tauri-codegen lit `icons/icon.ico` à la compilation.
- **Déterminisme octet pour octet des images générées** : écarté comme critère. `check-icons.mjs` valide des propriétés — dimensions, entrées de l'ICO, pixels témoins — et non une empreinte, qu'un changement de pilote ou de fontes suffirait à faire bouger.
- **Le zip « FlowTranslate exploration et prototype.zip », `release/`, `test-results/`, `playwright-report/`** : jamais ajoutés au dépôt. Fichiers ajoutés un par un par leur nom, message court en français, aucune ligne d'attribution, aucun push.

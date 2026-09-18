# Cartes du dépôt avant le portage 1.0

Relevé du 17/09/2026, base `2fbfdac` (0.4.0 + design system importé). Trois lectures indépendantes du dépôt — le front, le natif, les exigences de la 0.5.0 — faites avant de découper le travail. Les références `fichier:ligne` valent pour cette base.

---

## carte:front

## Front de FlowTranslate 0.4.0 : état des lieux avant le portage 0.5.0 (lecture seule, aucun fichier modifié)

### 1. Point d'entrée
- Un seul `index.html` sert les trois fenêtres Tauri : overlay, capsule, settings (`/?window=…`, `src-tauri/tauri.conf.json:19,35,50`). Sa balise `<meta name="color-scheme" content="light">` s'applique donc à toutes.
- `src/main.tsx:5-6` importe `styles.css` et `glass.css` dans chaque fenêtre.
- **`src/tokens.css` n'est importé nulle part** : ni `main.tsx`, ni `src/lab/frame.tsx:10-11`.
- Aiguillage des fenêtres : `App.tsx:216-225`. Classe du body `flowtranslate-window flowtranslate-<fenêtre>` : `App.tsx:220`, reprise dans `frame.tsx:47` et dans `styles.css:30,32,138`.

### 2. Overlay
- **Machine d'état.** `src/reducer.ts` gère la phase (idle/streaming/complete/error/cancelled), le mode de livraison (pending/applied/fallback), `replacementValid` et `comparing`.
- **`useTranslation.ts`** :
  - les fragments du stream sont retenus en tampon jusqu'à la fin (29-37) ;
  - un avis dure 4 s (7, 43-47) ;
  - un remplacement sans réponse bascule en affichage après 3 s (136-145) ;
  - les écouteurs d'événements sont en 86-133 ;
  - `frontend_ready` est appelé au montage (123-128).
- **`GlassOverlay.tsx`** :
  - `GlassOverlay` (133) choisit entre `GlassSession` (160) et `NoticePill` (141) ;
  - états de la session : forme (171), placement (174), `moving`, `slow`, `menuOpen`, `feedback` effacé après 3 s (236-240), `copied`, `pinned`, `near`/`hovered` ;
  - budget de lecture et estompe : 289-325 ;
  - composants : `WaitPill` (59), `ReadingSurface` sur ScrollArea de Radix (90-131), entrées du menu (444-451), pilule d'actions (466-473), `compact-feedback` (477).
- **Géométrie.** `publish()` (349-398) :
  - lit les sélecteurs dans l'ordre (353, observés en 402) ;
  - lit le padding du halo, `borderTopLeftRadius` et le décalage d'entrée ;
  - envoie `resize_overlay` avec les régions et le `frame`.
  - Elle dépend de `.native-overlay .glass-overlay` (`glass.css:18,20`) et du forçage `[data-radix-popper-content-wrapper]` (`glass.css:81-82`).
  - Si la pilule s'élargit avec l'étiquette d'action, la région 1 change, mais le `frame` reste `regions[0]`, c'est-à-dire le verre.
- **Erreurs.**
  - Texte rose avec renvoi vers le menu ⋯ : 459. Avertissement de résultat partiel : 463.
  - Le budget de lecture s'applique aussi aux erreurs : `settled` inclut `error` (210, 289).
  - Les erreurs affichées en `feedback` s'effacent après 3 s (236-240).
  - « Erreurs sans estompe » touche donc ces deux endroits, plus `NOTICE_MS`.
- **CSS.** `glass.css` lit les variables de `styles.css:3-27`. Couleurs codées en dur : `#e8eaef` (33), `rgba(250,251,253,.85)` (103).
- **Étiquette d'action.** `capture.execution.actionName` existe déjà (`types.ts:11,38`). Un résultat revu depuis l'icône n'a pas d'`execution`.

### 3. Réglages (`App.tsx:36-174` et `ActionSettings.tsx`)
- **Mise en page.** Une seule colonne :
  - « Traduction » (135-140) ;
  - Actions et Raccourcis (`ActionSettings.tsx:46-83`) ;
  - « Sur cet appareil » : historique (147-150), lancement avec Windows (151-152) ;
  - « Connexion », repliable, avec `connectionExpanded` persisté (154-163).
- **Sauvegarde.**
  - File d'attente, 300 ms après la frappe, immédiate pour les choix (51-80) ;
  - validation `promptError` côté client (54-57) ;
  - retour arrière d'un raccourci refusé (89-97) ;
  - la fermeture enregistre d'abord (98-102) ; Échap ferme (126).
  - Pied de page : 165-172. Écran d'erreur de chargement : 82.
- **La fenêtre est masquée, jamais fermée** (`lib.rs:1371-1373`). Elle reste donc montée :
  - l'historique n'est lu qu'au montage (49) ;
  - la page et l'état de connexion restent ceux de la dernière ouverture ;
  - la fenêtre n'écoute aucun événement.
- **Adresse vérifiée à la sortie du champ.**
  - Aucun `onBlur` sur les champs (158).
  - `check_connection` lit les réglages **enregistrés** dans Rust (`lib.rs:1016-1026`). Il faut vider le délai de 300 ms (`saveTimer`) avant de vérifier, sinon on vérifie l'ancienne adresse.
  - `profile()` remet l'état à « Non vérifié » à chaque frappe (86).
- **CSS.** Tout est sombre, en rgba codés en dur (`styles.css:54-180`), avec `select { color-scheme: dark }` (149). Aucun thème clair.
- **Clé API.** Seule la fenêtre Réglages la reçoit (`lib.rs:160`).

### 4. Pont Tauri (`bridge.ts:79-118`)
**Commandes et arguments :**
- `get_settings` ; `save_settings {settings}` (objet complet) ; `capture_text` ; `frontend_ready` → `Capture|null`
- `translate {request:{id,captureId,text,mode,actionId}}` ; `cancel_translation {requestId}`
- `copy_result {requestId}` ; `replace_result {requestId}`
- `dismiss_overlay` ; `complete_overlay_dismiss {captureId}`
- `open_settings` (**sans argument**, `lib.rs:743-750`) ; `focus_overlay`
- `start_drag {clientX,clientY}` ; `resize_overlay {width,height,captureId,presentation,regions,frame}` ; `overlay_dimming {dimming}`
- `drag_settings` ; `quit_app` ; `check_connection {mode}` → `{connected,message}`
- `get_history` ; `delete_history {id|null}`
- `closeSettings` et `resizeSettingsCorner` passent par l'API window de Tauri, pas par une commande.
- `override_cursor` sert à la sonde native seulement ; il n'est pas dans le bridge.

**Événements :**
- `capture` (Capture), `translation` ({requestId,kind,text?,message?})
- `settings-changed` (sans clé pour overlay et capsule, `lib.rs:234-237`)
- `target-invalidated {captureId,message}` (`lib.rs:1269`)
- `overlay-dismiss-requested {captureId}`, `glass-near {near}`
- `capture-target {captureId,canReplace}`, `capture-notice {message}`
- `work-area {width,height,scale}`, `result-delivery {requestId,status,confirmed,message}`

**Il manque pour 0.5.0 :**
- **Ouvrir sur une page.** Un argument page, plus un événement vers la fenêtre déjà montée. Appelants : menu `GlassOverlay.tsx:449`, `App.tsx:29,206`, icône `lib.rs:1343`, raccourci refusé au démarrage (`lib.rs:~1380`). En aperçu navigateur : `bridge.ts:102`.
- **Copier depuis l'historique.** Aucune commande : `copy_result` est lié au `requestId` en cours.
- **Avis « réglages illisibles ».** Aucun canal vers les Réglages.
- **`schemaVersion`.** Absent de `types.ts:21`, des réglages de démo (`bridge.ts:10-13`) et de `e2e/native-fixture.ts:7`.
- Toute nouvelle interface doit aussi entrer dans `docs/BRIDGE.md`.

### 5. Correspondance avec le design system
**Existe déjà, à restyler ou compléter :**

| Code actuel | Composant du design system | À ajouter |
|---|---|---|
| `WaitPill` (`GlassOverlay:59`) | WaitPill | |
| `.action-pill` | ActionPill | étiquette, épingle enfoncée (0.4.0 bascule en pin-off, 470) |
| `BubbleMenu` (`ui.tsx:50`) | OverlayMenu | icônes, indication « Échap » |
| `NoticePill`, `compact-feedback` | Notice md et sm | tons |
| `.translation-bubble` et `ReadingSurface` | Glass | |
| `Segmented` (`ui.tsx:85`), `SettingSwitch` (77), `IconButton` (45) | mêmes noms | |
| `Icon` (32, trait 1.7/1.9/2.4, 10 glyphes en 30) | Icon (trait 1,75, 30 noms) | glyphes manquants |
| keycaps (`ActionSettings:74`) | Keycaps | |
| `.save-status` | SaveStatus | |
| `.connection-state` | StatusBadge | |
| `.profile` | EngineCard ×2 | |
| `.history` | HistoryList | |
| `.setting-row` | SettingRow | |
| `.action-card` et `.shortcut-card` | ActionRow et ShortcutBinding | |
| select, input, textarea natifs | SelectField, TextField, TextArea | |
| `.row-warning` | Callout | |
| `.primary-action`, `.text-button` | Button | |

**N'existe pas encore :** GlassError, PartialNote, Mark (l'ancien logo SVG est en ligne, `App:128`), TitleBar, SettingsNav, PageHeader, SettingGroup, Badge, thème clair.
- `bundle.js` est écrit à la main sur `window.React` : il n'est pas importable, il faut le réécrire en TSX sur Radix et lucide-react.

**Pièges de `tokens.css` :**
- **Pas de bloc `prefers-color-scheme`** (`:root,[data-theme=dark]` et `[data-theme=light]`, 1 et 52). Il faut poser `data-theme` sur les Réglages seulement.
- **Classes globales** `.body`, `.title`, `.label`, `.menu`, `.heading`, `.caption`, `.tag`, `.prompt`, `.original-copy` (133-147).
  - `.original-copy` entre en collision avec `glass.css:103` (14/20 contre `calc(size-2)`/1.45).
- **Halo** `--halo-*` défini sur `:root` (114-116) :
  - `glass.css:17` doit continuer à le remettre à 0 hors `.native-overlay` ;
  - sinon l'aperçu navigateur prend le padding et les tests de boîtes cassent.

**Capsule.** Le design system la retire, mais elle est toujours branchée :
- `App.tsx:17-31` ; `dragSurface` est exporté depuis `GlassOverlay` pour elle ;
- fenêtre `capsule` dans `tauri.conf.json`, événements dans `lib.rs:237,675,692` ;
- scénario visuel et test `ui.pw.ts:214-221`.
- À trancher par le planificateur.

### 6. Couplages entre zones
- **`ui.tsx`** : primitives partagées (Icon, IconButton, `motionTokens`/`useFade` pour les deux ; `BubbleMenu` pour l'overlay ; `Segmented`/`SettingSwitch` pour les Réglages).
- **CSS croisé :**
  - `.icon-button` est défini dans `glass.css:72-77` mais utilisé par les Réglages (`App:148`, `ActionSettings:72`) ;
  - `.primary-action`/`.quiet-action` sont en double (`styles.css:125-127`, `glass.css:105-108`) ;
  - le focus global est dans `styles.css:35` ;
  - la règle de mouvement réduit est en double.
- **`App.tsx`** contient Réglages, capsule, overlay et démo. Le sortir en premier, en séquence, avant tout travail parallèle.
- **Fichiers communs aux deux zones :** `types.ts`, `bridge.ts` (démo des deux), `e2e/native-fixture.ts`, `e2e/native-bridge.pw.ts`, `src/lab/frame.tsx` et `scenarios.ts`.
- **`layout.ts`** : lecture seule. Il servira à l'aperçu de la page Lecture.

### 7. Libellés visibles et nom du produit
**Pas de module de textes** : tout est écrit dans les composants.
- **« traduction » à reprendre en « résultat » :**
  - `App.tsx:28,134,148` ;
  - `GlassOverlay.tsx:60,123,461,466,467,478` ;
  - `ui.tsx:58` ; `reducer.ts:45` ; `ActionSettings.tsx:65`.
- **Messages en deux phrases :** `GlassOverlay:429,449`, `useTranslation:140`.
- **Côté Rust :** `capture.rs:205` (« Rien à traduire »), `lib.rs:60,350,361,1323`, `types.rs:78`. Le lab les recopie : `frame.tsx:25`, `scenarios.ts:7`.
- **« FlowTranslate » en dur :**
  - `App.tsx:19-20,82,129,169,183,220` ; `GlassOverlay.tsx:449` ; `useTranslation.ts:128,131` ;
  - classes du body dans `styles.css` ; `frame.tsx:47` ; `lab/main.tsx:25,30`, `bugs.tsx` ;
  - `<title>` des trois HTML ; `package.json` (name) ; variables `FLOWTRANSLATE_*`.
- **Pour un renommage en un seul commit :**
  - mettre le nom dans une constante unique ;
  - rendre les classes du body neutres ;
  - ne pas toucher `identifier com.flowtranslate.desktop` (`tauri.conf.json:5`) : les chemins `%APPDATA%` en dépendent.

### 8. Ce qui cassera dans les tests
**Ports et contexte :**
- e2e sur le port 5173 (`playwright.config.ts:3`), visuels sur le 5174 (`playwright.visual.config.ts:2`), qui est aussi celui de `ui:lab`.
- Les deux configs ont `strictPort` et `reuseExistingServer` en local : deux unités en parallèle se bloquent ou testent le code de l'autre. Il faut un `FLOWTRANSLATE_TEST_PORT` différent par unité.
- La CI (ubuntu) lance seulement `npm test`, `build` et `npx playwright test`. Les références visuelles sont win32 et hors CI (`ci.yml:10,18-21`).
- `reported-defects.pw.ts:7` écrit dans `release/ui-evidence/`.

**Libellés :**
- « Copier la traduction » : 22 fois dans `ui.pw.ts`, 13 dans `native-bridge.pw.ts`, 4 dans `workbench.pw.ts`.
- « Traduction en cours » (`ui.pw.ts:108`), document « Traduction » (342).
- « Rien à traduire… » : `states.spec.ts:12`, `reported-defects:73`, `native-bridge:432,451`.
- « Réglages et Réessayer » : `native-bridge:321`.
- Épingler/Détacher : `ui.pw.ts:89-97`.

**Couleurs et mesures :**
- `rgb(232,234,239)` : `ui.pw.ts:140`.
- `rgba(24,26,31,.96)` : 155, 308, 309.
- Couleurs de l'original : 200-201.
- `rgb(31,33,38)` : `reported-defects:8-9`.
- Largeur de pilule 76/100 : `ui.pw.ts:323`, `native-bridge:85,207`.
- 5 entrées de menu : `ui.pw.ts:152`.
- Notice 13 px : `native-bridge:435`.

**Structure des Réglages :**
- En-têtes « Réglages » et « Actions et consignes », bouton « Connexion » (`ui.pw.ts:260,422` ; `native-bridge:286-287` attend `connectionExpanded:true`).
- Sélecteurs `.profile`, `getByLabel('Profil par défaut'|'Modèle'|'Clé API')`.
- `.history article`, `.action-card summary`, `.shortcut-options select` nth 0/1, `.keycaps kbd`.
- `.save-status` et ses textes.
- `.settings-scroll-viewport`, `.settings-titlebar`, `.settings-window footer` (`actions.pw.ts:57-62`).
- La fermeture qui ramène à la démo : `ui.pw.ts:433-434`.

**Visuels :**
- 23 PNG, alors que le README en annonce 19.
- **`settings-dark` et `settings-light` sont identiques (même md5), de même que `history-*`** : le paramètre de thème ne touche pas les Réglages (`frame.tsx:45`).
- `states.spec.ts` devra émuler `colorScheme`.
- Points d'attente utilisés : en-tête « Traduction » (13, 37), `.history` avec `data-lab-ready` (`frame.tsx:50-54`), `data-lab-phase`.
- `scenarios.ts` alimente à la fois le lab et la boucle ×2 thèmes : chaque page ajoutée donne deux références.

**Scripts natifs** (hors CI, vraie app) :
- `capture-matrix.mjs:57,123`, `probe-native-ui.mjs:45-46,80`, `profile-ui.mjs:37,40`, `capture-ui-preview.mjs:19,25`.

### 9. Ordre de découpage suggéré
1. **Socle, en séquence :**
   - import de `tokens.css` dans `main.tsx` et `frame.tsx` ;
   - sortie de `SettingsWindow` hors de `App.tsx` ;
   - `types.ts` et bridge (page, `schemaVersion`) ;
   - primitives de `ui.tsx` ;
   - constante du nom.
2. **En parallèle :**
   - **A, overlay :** `GlassOverlay`, `glass.css`, `useTranslation` et `reducer`, tests overlay.
   - **B, Réglages :** fichiers des Réglages, `styles.css`, `ActionSettings`, tests Réglages.
   - Donner un propriétaire unique à `native-fixture.ts` et `native-bridge.pw.ts`.
3. **En dernier :** lab et visuels (scénarios, émulation du thème), puis régénération des références.

---

## carte:natif

## Natif 0.4.0 : ce que la 0.5.0 touche côté Rust (lecture seule, rien n'a été modifié)

### 1. Réglages : chargement, écriture, démarrage
- **Dossier** : `app.path().app_data_dir()`, c'est-à-dire `%APPDATA%\com.flowtranslate.desktop\`. Il est construit à partir de l'identifiant (tauri path/desktop.rs:247-251). Il est appelé dans `setup` à lib.rs:1290. Sur disque, on y trouve bien `settings.json` et `history.sqlite3`. WebView2 range ses données dans `%LOCALAPPDATA%\com.flowtranslate.desktop\EBWebView`, et le front n'utilise aucun localStorage.
- **Chargement** (settings.rs:62-126). Un fichier absent donne `Settings::default()`. Sinon, le fichier est désérialisé dans `PersistedSettings` (settings.rs:20-53). Chaque clé est décodée en base64 puis passe par DPAPI. Les anciennes versions sont migrées (targetLanguage, `{{…}}`), puis tout passe par `validate` (settings.rs:120). Après une migration, le fichier est réécrit et l'erreur est ignorée (121-124).
- **Écriture** (settings.rs:128-170) : `validate`, puis écriture dans `settings.json.tmp`, puis `MoveFileExW REPLACE_EXISTING|WRITE_THROUGH` (173-200). Aucune sauvegarde n'est faite.
- **Fichier refusé au démarrage** : `store.load()?` (lib.rs:1292), puis `setup` échoue, puis `.expect("Impossible de démarrer FlowTranslate")` (lib.rs:1421). En release, on a `panic = "abort"` (Cargo.toml) et `windows_subsystem="windows"` (main.rs:1). L'app meurt donc sans rien afficher : ni icône, ni avis, ni journal. `HistoryStore::new(&root)?` (lib.rs:1293) tue le démarrage de la même façon si SQLite est illisible.
- **Causes de refus**, toutes bloquantes :
  - fichier impossible à lire (67) ;
  - JSON invalide, champ obligatoire absent, type faux ou variante d'enum inconnue (68-69) ;
  - base64 invalide (75-77) ;
  - DPAPI qui échoue, par exemple fichier venu d'un autre compte Windows (78) ;
  - `validate` : 1 à 24 actions, ids uniques, nom de 1 à 60 caractères, consigne de 1 à 8000 caractères, action par défaut existante, 1 à 12 raccourcis, raccourci actif qui passe `parse_shortcut` sans doublon (actions.rs:118-136), profils `fast` et `quality` présents, adresse, modèle, clé (settings.rs:208-256).
- **Bug latent qui compte pour le chargement tolérant** : avec `"actions": []`, `actions[0]` à settings.rs:107 panique avant `validate`. Une garde doit passer avant cette indexation.
- **Ce que la 0.4.0 exige pour relire un fichier** :
  - Obligatoires : `mode` (`fast`/`quality`), `historyEnabled`, `autostart`, et `profiles` avec `fast` et `quality`, chacun ayant `endpoint`, `model` et `apiKeyDpapi` (settings.rs:27-53, 210-214).
  - Si `actions` est présent, chaque action demande `id`, `name`, `promptTemplate`. Si `shortcutBindings` est présent, chaque raccourci demande `id`, `shortcut`, `actionId`, `outputMode` (`display`/`replace`) et `enabled` (actions.rs:8-26).
  - Valeurs d'enum strictes : `textSize` normal/large/xlarge, `autoClose` fast/normal/slow/never (types.rs:140-158).
  - Champs inconnus : ignorés à tous les niveaux, aucun `deny_unknown_fields`. Donc `schemaVersion` passe.
  - Deux pièges :
    - Une consigne contenant `{{` déclenche une migration puis une réécriture.
    - Tout enregistrement par la 0.4.0 réécrit le fichier depuis sa struct et **supprime `schemaVersion`** et tout champ inconnu. Au retour en 0.5.0, le fichier ressemble à une v0. La sauvegarde `settings.v0.json` ne doit donc pas écraser aveuglément une v0 existante.

### 2. Historique
- `%APPDATA%\com.flowtranslate.desktop\history.sqlite3`, en mode WAL avec `secure_delete` (history.rs:24-36).
- Table `history(id, created_at, target_language '' , mode, payload_dpapi, action)`. La colonne `action` est ajoutée si elle manque (37-45).
- Le texte source et le résultat sont chiffrés ensemble par DPAPI (54-66). Rétention : 7 jours et 100 lignes, purge à l'ouverture, à l'ajout, à la lecture (67-75) et environ toutes les heures (lib.rs:1217-1219).
- **Lecture en bloc** (history.rs:81-113) : une seule ligne indéchiffrable ou un `mode` autre que fast/quality (`parse_mode` 137-143) fait échouer toute la liste.
- L'ajout se fait seulement si `history_enabled && !demo`, et son erreur est ignorée (lib.rs:561-570).
- `get_history` et `delete_history` (lib.rs:1038-1045) ne vérifient pas quelle fenêtre les appelle, contrairement à `get_settings` (158-161).
- **Copier depuis l'historique** : aucune commande native ne copie un texte quelconque. `copy_result` ne sert que le résultat visible (612-618, 652-660) et coupe le suivi du presse-papiers pendant 1,5 s (656). Une copie faite côté web ne passe pas par cette coupure. Si on appuie sur le raccourci moins de 3 s après, sans sélection UIA, le texte de l'historique serait pris comme « copie fraîche » (capture.rs:193-200).

### 3. Zone de notification, avis, messages
- **Icône** construite à lib.rs:1319-1352, id `"flowtranslate"`, avec l'icône par défaut de la fenêtre. Il n'y a qu'une icône, sans état d'alerte.
- **Menu** : `replay` « Revoir la dernière traduction » (1323), `settings` « Réglages » (1324), `quit` « Quitter » (1325).
- **Infobulle** : « FlowTranslate », ou « FlowTranslate — Démonstration simulée » (1189-1198, 1328-1332). Elle devient « FlowTranslate — {message} » sur erreur de capture (1199-1206) et revient à la normale à la capture réussie suivante (416-418).
- **Avis** : `show_notice` (lib.rs:311-348). Si un verre est visible, la ligne s'affiche dans le verre (événement `capture-notice`). Sinon, une pilule seule apparaît en bas de l'écran du curseur pendant 4 s, sans surface cliquable.
- **Limite pour l'avis « réglages illisibles »** : `show_notice` exige que `AppState` soit géré et que l'overlay écoute déjà. Le tampon `pending_capture` / `frontend_ready` (282-284, 421-426) ne couvre que les captures. Un avis émis dans `setup` serait perdu, il lui faut une file d'attente équivalente.
- **Libellés « traduction » côté Rust** : « Aucune traduction récente. » (361), « La traduction accepte de 1 à 6 000 caractères. » (435), « Traduction annulée. » (511 ; inference.rs:215, 217, 242, 274, test à 423), « Fermeture de la traduction indisponible. » (696, 724), « Traduction indisponible. » (781, 1173), « Rien à traduire dans la fenêtre active. » (capture.rs:205).
  - Le dernier est attendu mot pour mot par e2e/native-bridge.pw.ts:432-452, e2e/reported-defects.pw.ts:73 et scripts/capture-matrix.mjs:123.
  - Le front ne compare aucun message Rust.
  - Nom par défaut des anciennes lignes d'historique : « Traduire » (history.rs:108).
- **Messages d'erreur d'inférence** : inference.rs:232, 251-252, 261, 271 et 280-298 (injoignable ou délai dépassé, avec hôte:port), 300-338 (`check` : HTTP, /models invalide, « Le modèle … n'est pas exposé »).

### 4. Ouverture des Réglages
- `open_settings(app)` (lib.rs:742-750) fait `show` puis `set_focus`. Elle ne prend **aucun paramètre de page** et n'émet aucun événement de navigation.
- Appelants :
  - menu de l'icône (1343-1345) ;
  - deuxième lancement, via single-instance (1284-1286) ;
  - raccourci refusé au démarrage (1377-1382) ;
  - argument `--settings` (1392-1394) ;
  - front : menu ⋯ du verre (GlassOverlay.tsx:449), capsule (App.tsx:29), erreur d'initialisation (App.tsx:206).
- Fermer la fenêtre la cache seulement (lib.rs:1368-1376).
- Une capture est refusée si les Réglages sont visibles et au premier plan (392-396).
- Pour ouvrir « sur la bonne page », il faut un argument de section et un `emit_to("settings", …)`, ou un état en attente lu au montage, puisque la fenêtre existe déjà, cachée.
- **Adresse vérifiée à la sortie du champ** : `check_connection(mode)` lit le profil *enregistré* (1015-1037). Vérifier une adresse tapée mais pas encore enregistrée demande une commande qui reçoit endpoint, modèle et clé. `inference::check` fait déjà passer l'adresse par `validate_endpoint` via `api_url` (inference.rs:76-77), avec un délai de 5 s et sans redirection.

### 5. Fenêtres (tauri.conf.json:10-59)
- **overlay** (280×160) et **capsule** (200×36) : `create:false`, `focus:false`, invisibles, sans décorations, transparentes, sans ombre, toujours au premier plan, non redimensionnables, absentes de la barre des tâches. Le vitrage est posé par `host::apply_glass` et `silence_frame` (lib.rs:1353-1366). La capsule n'est plus affichée (1084-1085).
- **settings** : 620×720, minimum 460×420, centrée, `decorations:false`, `transparent:false`, redimensionnable. Pas de `theme` (suit Windows) ni de `backgroundColor`, donc un flash clair est possible au premier affichage en thème sombre. Le déplacement passe par `drag_settings` (751-755), le redimensionnement par la capacité `allow-start-resize-dragging` (capabilities/settings.json). Les fenêtres sont construites depuis la config dans `setup` (1316-1318).
- CSP : lib.rs n/a, voir tauri.conf.json:61-63 (`connect-src` limité à l'IPC).

### 6. Lancement avec Windows
- Plugin `tauri-plugin-autostart` construit sans options (lib.rs:1288). Le nom utilisé est `package_info().name`, c'est-à-dire `productName` (plugin lib.rs:178-182 ; tauri-codegen context.rs:268). Le chemin est `current_exe()` au moment de l'activation (186-189).
- Il écrit la valeur `HKCU\…\CurrentVersion\Run\FlowTranslate` et `StartupApproved\Run` (auto-launch windows.rs:37-57).
- Le basculement se fait seulement dans `save_settings`, quand `autostart` change (lib.rs:209-229). Au démarrage, **rien n'est réconcilié** : le Run n'est ni relu ni réécrit.
- `disable()` échoue si la valeur n'existe pas (windows.rs:65-69), ce qui donne « Démarrage automatique indisponible. ».

### 7. Commandes et événements
- **Commandes** (lib.rs:1397-1419) : `get_settings` 158, `save_settings` 184, `capture_text` 388, `frontend_ready` 422, `translate` 429, `cancel_translation` 604, `copy_result` 653, `replace_result` 664, `complete_overlay_dismiss` 729, `dismiss_overlay` 739, `open_settings` 743, `drag_settings` 752, `quit_app` 757, `override_cursor` 763, `focus_overlay` 767, `resize_overlay` 806, `overlay_dimming` 873, `start_drag` 926, `check_connection` 1016, `get_history` 1039, `delete_history` 1043.
- **Événements** :
  - `settings-changed` : clés en clair pour les Réglages (234), clés retirées pour overlay et capsule (237) ;
  - `capture` 302 ;
  - `capture-notice` 322/334 ;
  - `translation` delta/done/error : 496, 526, 573, 588 ;
  - `capture-target` 639/681 ;
  - `result-delivery`, en JSON ad hoc : 640 ;
  - `overlay-dismiss-requested` 723 ;
  - `work-area` 848/908 ;
  - `target-invalidated` 1267 ;
  - `glass-near` (host.rs:461).

### 8. Renommage : ce qui casse une installation, ce qui n'est que du texte

**Casse une installation existante :**
- **`identifier`** (tauri.conf.json:5) :
  - Le dossier de données change. `settings.json` et `history.sqlite3` sont alors introuvables et l'app redémarre sur les réglages par défaut.
  - Le mutex et la classe single-instance `{id}-sim/-sic/-siw` changent aussi (plugin windows.rs:58-67). Si l'ancienne et la nouvelle app tournent ensemble, les deux démarrent et se disputent le raccourci.
  - L'identifiant sert aussi de `BUNDLEID` NSIS pour la case « supprimer les données » (voir plus bas).
  - DPAPI n'est **pas** lié au nom : pas d'entropie ni de description (crypto.rs, `CryptProtectData(…, None, None, None, None, …)`). Des fichiers copiés vers un nouveau dossier restent lisibles pour le même compte Windows.
- **`productName`** (tauri.conf.json:3) :
  - Le nom de la valeur Run change. L'ancienne valeur « FlowTranslate » reste et lance l'ancien exe. La nouvelle n'existe pas, et désactiver le démarrage renvoie une erreur.
  - Côté NSIS (template CLI 2.11.4) : `UNINSTKEY …\Uninstall\${PRODUCTNAME}`, `INSTDIR $LOCALAPPDATA\${PRODUCTNAME}` (installé aujourd'hui dans `%LOCALAPPDATA%\FlowTranslate\`) et `MANUPRODUCTKEY Software\${MANUFACTURER}\${PRODUCTNAME}`. Le nouvel installateur ne voit pas l'ancien : les deux versions s'installent côte à côte.
  - La désinstallation de l'ancienne supprime `Run\FlowTranslate`. Si l'identifiant est gardé et la case cochée, elle fait aussi **`RmDir /r $APPDATA\${BUNDLEID}`**, ce qui efface les données partagées avec la nouvelle.
  - `MANUFACTURER` vient probablement du 2e segment de l'identifiant faute de `publisher`, à vérifier.
  - Le nom de l'exe installé et celui de l'installateur `FlowTranslate_<v>_x64-setup.exe` en dérivent.
  - Leviers disponibles : `autostart::Builder::new().app_name(…)` (plugin lib.rs:167), `bundle.windows.nsis.installerHooks`.
- **Alias de modèles** `flowtranslate-fast/quality/general` : server/compose.yaml:51, 92, 134 et server/model-lock.json:8, 17, 26. Les `settings.json` existants contiennent ces noms. Renommer côté serveur provoque « modèle non exposé ». Les valeurs par défaut de types.rs:185 et 193 ne concernent que les installations neuves.

**Outillage (pas d'impact utilisateur, mais à changer ensemble) :**
- Variables `FLOWTRANSLATE_*` : host.rs:81, 368 ; capture.rs:208 ; inference.rs:402 ; scripts/*.ps1 et *.mjs.
- Nom d'exe et de processus : scripts/capture-matrix.ps1:2 et 10, test-native-ui.ps1:2 et 10, package-test-kit.ps1:12-13 et 36-45, e2e/native-bridge.pw.ts:378.
- Cargo `name` et `[lib] flowtranslate_lib` et `[[bin]] FlowTranslate` (Cargo.toml:2-15, main.rs:4, Cargo.lock).

**Texte seul :**
- Titres de fenêtres (tauri.conf.json:18, 34, 49), infobulles (lib.rs:1192-1201, 1329-1331), message `expect` (1421), démo (capture.rs:103).
- Id interne de l'icône `"flowtranslate"` (1190, 1200, 1327).
- Description de capacité (default.json:4), `description` et `authors` de Cargo.
- Titre de release (release.yml:133), artefact CI (ci.yml:54), `index.html:7`, marque dans App.tsx:129 et 169, README.
- La CI ne dépend du nom que par le glob `bundle/nsis/*.exe` (ci.yml:55, release.yml:116).

---

## carte:exigences

# 0.5.0 : ce qu'elle doit livrer

**Tri.** Le design system se porte sur le modèle 0.4.0 intact : `mode`, `profiles.fast/quality`, `defaultActionId`, `shortcutBindings[].outputMode`, 1 à 12 raccourcis. Seul champ ajouté : `schemaVersion`.

## 1. Portage du design system

**Réglages** (`src/App.tsx`, `src/ActionSettings.tsx`, `src/styles.css`)
- Fenêtre 760 × 640 (min 460 × 420), thèmes `dark`/`light` par `prefers-color-scheme` ; l'overlay reste graphite.
- Barre de titre : marque 16 px, « FlowTranslate · Réglages », état d'enregistrement (« Enregistré », « Enregistrement… », « Enregistré à l'instant », « Non enregistré · Réessayer », raison en Callout danger en haut de page), Fermer (« Fermer les réglages », infobulle « Fermer (Échap) »). Le pied 0.4.0 disparaît.
- Navigation Actions, Lecture, Moteurs, Confidentialité ; en pied « Quitter » et « FlowTranslate 0.5.0 » ; onglets sous 640 px.
- **Actions** : « Un raccourci lance une action sur le texte sélectionné. », bouton principal « Nouvelle action ». Une carte par action : pictogramme déduit de l'id (`languages`, `spell-check`, `briefcase-business`, `wand` pour une perso), badge « Par défaut », résumé « Prédéfinie · Remplace la sélection » (ou « Affiche le résultat », « Aucun raccourci actif »), touches du premier raccourci actif et « +n ». Dépliée : « Nom » ; ses raccourcis (interrupteur, touches, « Modifier », segment Afficher | Remplacer, « Supprimer ce raccourci »), « Ajouter un raccourci » ; « Consigne » avec compteur « / 8 000 » et l'aide « Écrivez la langue voulue dans la consigne ; le texte sélectionné suit. » ; « Rétablir la consigne », « Définir par défaut », « Supprimer l'action ». Callout : « Les modèles Hy-MT ne savent que traduire. Pour corriger ou reformuler, choisissez un moteur généraliste dans **Moteurs**. » Le sélecteur « Action » d'un raccourci disparaît (un raccourci vit dans sa carte).
- **Lecture** : « Comment le résultat s'affiche, et quand il s'efface. », aperçu du verre à la taille choisie, Taille du texte, Fermeture automatique.
- **Moteurs** : « Tout serveur compatible OpenAI, local de préférence. », ligne « Moteur par défaut » Qualité | Rapide (= `mode`), deux EngineCard (Qualité, Rapide) : « Non vérifié » / « Vérification… » / « Connecté · 38 ms » / « Échec de connexion », « Vérifier », Adresse, Modèle, Clé API, « Chiffrée par Windows (DPAPI), jamais écrite en clair. ».
- **Confidentialité** : « Rien ne quitte l'appareil, hors le moteur distant que vous auriez choisi. », « Conserver l'historique chiffré », « Lancer à l'ouverture de session », groupe « Historique ».

**Overlay** (`layout.ts` et sélecteurs mesurés intacts)
- Pilule : étiquette d'action (`execution.actionName`, tiret `signal`, coupée à 132 px, infobulle « Corriger · Qualité », gardée en relecture), « Copier le résultat » puis « Copié » 1,6 s, Épingler par état enfoncé (plus de `pin-off`).
- Menu ⋯ à icônes, « Échap » en indication sur Fermer ; « Relancer en Rapide » / « Relancer en Qualité » inchangés.
- Erreur : icône, deux phrases, puces « Réessayer » et « Réglages » ; fin de « Réglages et Réessayer dans le menu ⋯ ».

**Zone de notification** : glyphes repos / travail / alerte choisis par `SystemUsesLightTheme`, relus à `WM_SETTINGCHANGE` ; nouvelle icône d'application (ICO 16–256).

## 2. Libellés « résultat »
« Revoir le dernier résultat », « Aucun résultat récent. », « Rien à traiter dans la fenêtre active. », « Traitement en cours », « Copier le résultat », verre « Résultat », « Actions du résultat », « Options du résultat », « Aucun résultat enregistré. ». Refus en deux phrases : « Ce champ n'est pas modifiable. Copiez le résultat. », « Collage impossible ici. Copiez le résultat. ». « Un serveur distant doit utiliser HTTPS ; HTTP est réservé au bouclage local. ». Même règle (raison puis quoi faire, ni « traduction » ni « profil ») pour les chaînes à « ; » de `capture.rs` (272–363), `lib.rs` (435, 635, 677), `inference.rs` (251, 294), `reducer.ts:45`, les annonces « Traduction terminée / copiée » et « Le profil fast est absent. ».

## 3. Réglages ouverts sur la bonne page
`open_settings` reçoit une cible (page, carte) ; la fenêtre cachée y navigue à chaque ouverture (docs/BRIDGE.md à jour).
- Icône, `--settings`, ⋯ → Réglages sur un résultat : Actions.
- Puce « Réglages » d'une erreur : Moteurs, carte du profil utilisé (10-parcours).
- Raccourci non enregistré au démarrage : Actions, carte de son action dépliée, raison sous la ligne.
- Chaque ouverture repart de cette cible, pas de la dernière page vue.

## 4. Adresse vérifiée à la sortie du champ
Aujourd'hui chaque frappe enregistre toute la structure : « http://1 » affiche « Non enregistré ». En 0.5.0 : rien d'invalide n'est enregistré ni signalé pendant la frappe ; à la sortie, le refus de `validate_endpoint` s'affiche sous le champ ; une adresse valide est enregistrée, puis Vérifier part seul, après l'enregistrement, car `check_connection` lit les réglages enregistrés. Échec : « Aucune réponse de 127.0.0.1:8001. Démarrez le serveur, puis vérifiez. ».

## 5. Historique
- Relu à chaque ouverture et à l'activation (aujourd'hui au montage seulement : la fenêtre cachée garde une liste périmée).
- Ligne : résultat, « Corriger · Rapide · 17 sept. 09:12 », « Copier le résultat » (« Copié » 1,6 s), « Supprimer cette entrée » ; pied « 3 entrées · 7 jours au plus », « Tout supprimer ». Jamais le texte source.
- Copier par identifiant côté Rust (nouvelle commande, `suppress_clipboard_tracking` comme `copy_result`) : le frontend ne fournit jamais le texte.

## 6. Erreurs sans estompe
Phase `error`, texte partiel ou non : pas de budget de lecture ; le verre reste jusqu'à Échap, Fermer ou la capture suivante. Icône en alerte, infobulle « FlowTranslate — » et le problème, jusqu'à la prochaine réussite. Conséquence : le hook Échap reste armé tant que l'erreur est visible.

## 7. schemaVersion, chargement tolérant, retour 0.4.0
- Sans `schemaVersion` : copie en `settings.v0.json`, puis réécriture avec `schemaVersion: 1`.
- Illisible (lecture, JSON, validation, DPAPI) : fichier écarté sans écrasement, puis `settings.v0.json` s'il se charge, sinon réglages neufs ; avis « Vos réglages étaient illisibles : la dernière sauvegarde est chargée. ». Plus de `load()?` suivi du `.expect` qui tue le démarrage.
- Toujours écrits : `mode`, `profiles` fast et quality, `outputMode`, 1 à 12 raccourcis. Aucun `deny_unknown_fields` dans `settings.rs` ni `actions.rs` : la 0.4.0 ignore `schemaVersion`.

## 8. DEPLOYMENT.md, ENDPOINTS.md
Ils existent mais décrivent 0.2–0.4 : « Connexion avancée », « langue cible », ports 8001–8002, message HTTPS sans espace, retour arrière sans `settings.v{n}.json`. À réécrire : Réglages → Moteurs, Général sur 8003, procédure § 6.2 (`%APPDATA%\com.flowtranslate.desktop\`), titre « Brancher un moteur », messages identiques au code.

## 9. Renommage en un commit
Vérifié : données sous l'identifiant `com.flowtranslate.desktop` ; DPAPI sans entropie (lié au compte Windows, pas au nom) ; nom de la valeur Run de `tauri-plugin-autostart` 2.5.1 = `productName` ; « FlowTranslate » en dur dans `lib.rs`, `App.tsx`, `GlassOverlay.tsx`, `useTranslation.ts`, `tauri.conf.json`, `index.html`. À livrer : nom affiché en une constante par côté ; identifiant et valeur Run figés à part (`Builder::app_name`), chemin de l'exe réécrit dans Run au démarrage s'il a changé (à vérifier avec NSIS, dont le dossier suit `productName`).

## Hors 0.5.0
Serveurs, moteurs nommés, lieu, « Traduction seulement », ServerCard, « Relancer avec… », moteur forcé, erreurs par cas, « Où vont vos textes » (0.6.0) ; sortie habituelle, cibles, Remplacer dans la pilule, Essayer, Dupliquer, suppression avec Annuler, fin de l'action par défaut, AltGr (0.7.0) ; geste, bulle, lettres, 0 à 24 raccourcis, encadré « Nouveau » (0.8.0) ; Démarrer, avis « prêt » (0.9.0).

## Contradictions et trous
1. **Page d'ouverture** : sans Démarrer, Actions (10-parcours ; § 8 hors premier lancement).
2. **Moteurs** : § 10 remplace EngineCard, la ligne 0.5.0 le garde ; noms fixes et « Relancer en » restent.
3. **« Moteur par défaut »** : la description du DS « Changeable depuis le menu ⋯ du résultat » est fausse, Relancer n'enregistre rien (`useTranslation.ts:50`). Proposer « Qualité : plus lent, meilleures tournures. Le menu ⋯ d'un résultat relance avec l'autre. »
4. **« Lancer avec Windows »** (§ 8) contre « Lancer à l'ouverture de session » (DS) : garder le DS jusqu'à Démarrer, qui introduit l'autre.
5. **Réglages illisibles** : § 9 donne la commande « Réglages » à une Notice « jamais cliquable ». Proposer avis 4 s, icône en alerte, Callout en tête d'Actions. Sans sauvegarde, message absent : « Vos réglages étaient illisibles : les réglages par défaut sont chargés. ». Nom du fichier écarté absent : `settings.illisible-AAAAMMJJ-HHMMSS.json`.
6. **Collage refusé** : 10-parcours donne 3 s à la raison, mais ce verre porte le seul exemplaire du résultat ; le traiter en erreur (ni estompe, raison tenue).
7. **Alerte de l'icône** : `capture_error` touche aussi l'infobulle pour « Rien à traiter » ; réserver l'alerte aux échecs (moteur, collage, réglages, raccourci).
8. **1 à 12 raccourcis** jusqu'à 0.8.0 alors que le DS montre une corbeille partout : corbeille du dernier raccourci désactivée ; « Supprimer l'action » bloquée tant que ses raccourcis ou le défaut l'utilisent.
9. **GlassError** : le DS nomme le moteur, § 12 range « erreurs nommées » en 0.6.0. En 0.5.0 : nom du profil (« Le moteur Qualité ne répond pas. » « Vérifiez qu'il est démarré sur 127.0.0.1:8002. ») ; 401 et modèle absent attendent 0.6.0.
10. **Espace insécable** : exigée par le README, absente du bundle, de la spec et du code (aucun U+00A0) ; l'appliquer aux chaînes de l'app, pas recopier les exemples.
11. **Poignée de redimensionnement** absente du DS : la garder, la fenêtre est sans cadre.
12. **Historique corrompu** : `HistoryStore::new(&root)?` bloque encore le démarrage (hors ligne 0.5.0, à signaler).
13. **Capsule** : retirée du DS, encore configurée ; ni portée ni supprimée.

## Vérifications
- `npm run ui:reference` après revue : chaque page des Réglages en sombre et clair (`emulateMedia`, comme l'annonce `visual-tests/README.md`), verre d'erreur, pilule à étiquette ; puis la vraie fenêtre Windows.
- `settings.json` tronqué → avis, `settings.v0.json` chargé, fichier écarté présent.
- Exe 0.4.0 sur un fichier 0.5.0 → démarre.
- § 12 demande « inférence » et « matrice réelle » ; la consigne interdit de solliciter un serveur : ici `--simulate-inference` et le bridge de démo, l'inférence réelle revient à Lucas.

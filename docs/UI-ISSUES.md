# Revue UI — registre des défauts

Un défaut par correction. Statuts : à reproduire → reproduit → corrigé → vérifié.
Une compilation ou une référence visuelle inchangée ne valide pas l’esthétique.

| ID | Défaut / état actuel | Reproduction | Critère de correction | État |
|---|---|---|---|---|
| UI-001 | Surface grise résiduelle / fermeture native rapportées par Lucas | Afficher, ouvrir le menu, fermer et recommencer sur fonds clair/sombre | Plus de surface visible ni de zone bloquant la souris après fermeture ; vérifier aussi pendant annulation | Reproduit sur 0.1.5 (`native-before`, HWND encore visible après Fermer) ; cause établie : `window.hide()` sans effet après un `SetWindowPos(SWP_SHOWWINDOW)` hors Tao ; correctif `host::hide` (depuis le 2026-09-10 : `ShowWindow(SW_HIDE)` seul, sans passer par Tao) **vérifié** par le probe renforcé sur le build du 2026-09-09 (`release/ui-evidence/native-after-1a/result.json` : 3 cycles, HWND overlay et capsule masqués après Fermer ; `native-after/result.json` reste l’échec de préparation antérieur). Composition du bureau toujours non mesurée : capture GDI et Windows-MCP refusées dans cette session (« Descripteur non valide »), comme pour Codex |
| UI-002 | Capsule sans repli au survol | Atelier → Capsule actuelle | Trait au repos ; langue/action/menu au survol ; aller vers le menu sans fermeture prématurée ; déplacement et aimantation | Remplacée le 2026-09-10 par l’onglet du verre replié (UI-009) ; la fenêtre capsule n’est plus affichée |
| UI-003 | États et transitions de la bulle à reprendre | Atelier → court, attente, interruption, erreur | Lecture stable ; actions seulement à la fin ; Échap ferme ; résultat persistant hors survol | Refonte « 1a » implémentée (2026-09-09, handoff design) : verre 300 px texte seul, pilule opaque mordant le bord, coche 1,6 s, menu ancré sous la pilule. Vérifiée dans le navigateur et par les 44 tests ; rendu Windows (acrylique, contraste sur page blanche, DPI) à valider par Lucas |
| UI-004 | Lecture longue et barre de défilement | Atelier → long ; molette/clavier | Tout le texte accessible, barre discrète lors du défilement | Implémenté selon le handoff : croissance ligne à ligne jusqu’à 220 px, défilement interne, fondus de bord, indicateur 3 px au survol/défilement (800 ms), chip « la suite arrive », Agrandi 420 × 440 depuis le coin ancré. Le panneau bas centré n’existe plus pour une sélection ancrée ; à revalider visuellement par Lucas |
| UI-005 | Réglages : fond incomplet, thème et historique peu lisibles | Atelier → réglages/historique ; 900 puis 480 px | Toute la fenêtre cohérente ; thème Windows ; réglages et anciennes traductions accessibles | Fenêtre 520 px graphite opaque sans cadre système, enregistrement automatique, raccourci par capture, connexion lisible (handoff design). Thème clair Windows non traité : la maquette est sombre uniquement. Fenêtre native (hauteur au contenu, déplacement par la barre) à vérifier sur le build |
| UI-006 | Capture Windows automatique indisponible | Computer Use → démo native | Capture du bureau exploitable et interactions natives mesurables | Bloqué côté outil : capture noire puis GetCursorPos 0x80070005 ; CDP fonctionne |
| UI-008 | Cadre gris derrière la bulle et la capsule (retour de Lucas, 2026-09-10, capture d’écran) | Capture réelle → observer le rectangle clair autour du verre arrondi | Aucune surface hors de la silhouette arrondie | Cause établie par la doc DWM : `DWMWA_SYSTEMBACKDROP_TYPE` peint le matériau derrière toute la fenêtre, la région ne le découpe pas ; tout matériau apparaît aussi sous les fondus. Correctif : plus de matériau natif (`host::apply_glass`, `FLOWTRANSLATE_GLASS` pour expérimenter), verre `.92` peint par le DOM. À valider sur le bureau (capture après reconstruction) |
| UI-009 | La bulle reste ouverte quand la souris sort ; Lucas veut un repli en tout petit en bas de l’écran et une réouverture au survol | Traduire, sortir le pointeur ; survoler l’onglet | Repli en onglet 44 × 20 px au bord bas 500 ms après la sortie (10 s sans visite) ; survol de l’onglet → verre au-dessus ; menu ⋯ ou × de l’onglet pour fermer | Implémenté (`presentation: 'docked'`, fenêtre ancrée par le bas) ; vérifié par `ui.pw.ts` et le fixture IPC (régions onglet/verre) ; rendu natif à observer |
| UI-010 | Animation de streaming « hyper moche » | Traduction longue | Texte qui s’installe sans sursaut, indicateur d’attente discret | Fragments qui se fondent en place (`.chunk`), point qui respire au lieu du curseur clignotant, trois points pendant l’attente ; croissance native ligne à ligne inchangée. À observer sur le bureau |
| UI-011 | Ctrl+Alt+T redemande avant de traduire | Sélection dans une app sans UIA (repli presse-papiers) | Traduction immédiate à chaque pression | Confirmation supprimée ; le raccourci capture toujours la sélection courante au lieu de donner le focus. Vérifié par `ui.pw.ts` et `reducer.test.ts` |
| UI-007 | Titre « FlowTranslate » et coins carrés sur la bulle et la capsule après un clic sur la capsule (retour de Lucas en conditions réelles, 2026-09-10) | Capture presse-papiers → clic sur la capsule → observer la bulle, puis Fermer et recapturer | Aucune barre de titre DWM ; région arrondie conservée après activation, fermeture et nouvelle capture | Reproduit sur le build du 09-09 avec `scripts/inspect-native-windows.ps1` : région perdue après `focus_overlay`, styles CAPTION/SYSMENU rétablis après `hide`. Cause établie : `focus_overlay` passait par `show()`/`set_focus()` de Tao, dont `apply_diff` reconstruit les styles avec WS_CAPTION de façon différée (titre peint par DWM sur l’acrylique) et fait tomber la région. Correctif `host::activate` / `host::repair_handle` : activation et masquage au niveau HWND, réparation du style et de la région au focus. Le probe vérifie désormais styles vides et région pleine après affichage et après `focus_overlay` (`release/ui-evidence/native-after-frameless/result.json`) |

## Fiche d’une correction

- ID et scénario ; commit de départ.
- Observé / attendu ; hypothèse technique séparée.
- Reproduction exacte : fenêtre, taille, thème, gestes.
- Capture avant ; correction limitée ; capture après dans les mêmes conditions.
- Interaction rejouée, état final et régressions vérifiées.
- Animations : observation en mouvement et profil de performance séparés des captures fixes.
- Statut de revue esthétique par Lucas, sans l’assimiler aux tests automatiques.

## Ordre

1. UI-001 et UI-006 : fiabilité/observation native.
2. UI-002 : capsule et transitions au survol.
3. UI-003 / UI-004 : résultat court et long.
4. UI-005 : application et historique.

# Hôte Windows natif

Le binaire Tauri 2 conserve les données sensibles côté Rust. Le WebView ne reçoit la clé d’API que dans l’écran des paramètres; elle est chiffrée par DPAPI avant écriture. Les textes d’historique sont regroupés dans une charge JSON chiffrée par DPAPI dans SQLite. Les métadonnées (date, langue, mode) restent lisibles afin d’appliquer la rétention de sept jours et cent entrées. L’historique est désactivé par défaut.

## Capture et remplacement

`capture_text` lit la sélection du champ actif avec UI Automation `TextPattern`, en conservant son identifiant, sa fenêtre, sa position et son texte. Les sélections multiples sont refusées. Le dernier rectangle visible ancre la bulle ; l’absence de rectangle ne désactive plus la surveillance de la cible. Pour un éditeur non Win32 modifiable, une copie réelle vérifie aussi le texte annoncé par UIA : certains fournisseurs riches dépassent les limites des nœuds inline. En cas de divergence, le texte copié fait foi et sa position doit être unique dans le document ValuePattern ou TextPattern ; il sera recopié avant livraison. `complete_target` vérifie ensuite le document complet et choisit le remplacement Win32 ou le collage natif. Une cible périmée ne réactive jamais le bouton.

Sans sélection UIA, Ctrl+Insert fournit le texte. Si le champ expose un `ValuePattern` modifiable et que le texte copié apparaît une seule fois dans sa valeur, une cible de collage est conservée. Avant livraison, une nouvelle copie doit confirmer la sélection exacte. Les occurrences multiples ou chevauchantes sont refusées. Une ancienne copie utilisateur de moins de trois secondes reste une source de traduction seulement : elle ne donne jamais le droit d’écrire dans le champ courant.

Le remplacement conserve `EM_REPLACESEL` pour les contrôles Win32 Edit/RichEdit vérifiables. Pour les champs web et éditeurs accessibles, il place le résultat Unicode dans un presse-papiers temporaire et envoie une seule corde Ctrl+V par `SendInput`. Il ne sélectionne jamais tout le champ, ne simule pas Entrée et n’utilise pas `ValuePattern.SetValue` sur l’intégralité du document. L’application cible gère ses événements de collage, sa mise en forme environnante et son annulation native.

Avant chaque écriture : fenêtre, identifiant UIA, champ non protégé et modifiable, sélection/position et document sont revérifiés ; les modificateurs doivent être relâchés. Un remplacement manuel peut réactiver la source depuis la bulle, jamais depuis une application tierce. Le verrou de session couvre la validation et la livraison manuelle comme automatique. Une cible est consommée dès la tentative, pour éviter un second collage après une réponse ambiguë.

Le collage est confirmé par la relecture du document attendu, avec normalisation CRLF/LF et des espaces insécables produits par le collage Chromium (les vérifications avant écriture restent exactes), pendant au maximum deux secondes. L’ancien presse-papiers est restauré après confirmation uniquement si son numéro de séquence correspond toujours à notre écriture, sous `OpenClipboard`. Une nouvelle copie de l’utilisateur n’est jamais écrasée. En cas de résultat non confirmé, aucun second collage n’est envoyé et le résultat reste dans le presse-papiers et la bulle ; le message invite à vérifier le champ.

`clipboard_guard` conserve les formats mémoire (texte Unicode, HTML, RTF, DIB/DIBV5, listes de fichiers et formats enregistrés), plafonnés à 64 Mio. Les bitmaps sont conservés via leur DIB, que Windows sait reconvertir. Les formats gérés par leur propriétaire ou non duplicables sont refusés avant toute modification, plutôt que détruits. Les écritures temporaires et restaurations sont exclues de l’historique et de la synchronisation Windows. Aucun contenu n’est journalisé.

Validation native reproductible : `node scripts/test-replacement-windows.mjs` sur un bureau Windows isolé. Le pilote Rust existe uniquement sous `cfg(test)` ; il utilise les fonctions de production de capture et de remplacement. Le script ouvre Edge en mode visible, prépare des données synthétiques, déclenche le vrai `SendInput`, vérifie le document, le presse-papiers multiformat et Ctrl+Z. Les vérifications couvrent input, textarea multiligne, contenteditable avec mise en forme, iframe, Shadow DOM, changement de sélection/document/focus et refus des champs protégés. Office/Teams ne sont pas installés dans cette recette : leur compatibilité dépend de leur fournisseur UIA et n’est pas présentée comme testée.

Références : [SendInput et restrictions UIPI](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput), [UI Automation et éditeurs riches](https://learn.microsoft.com/en-us/dotnet/framework/ui-automation/add-content-to-a-text-box-using-ui-automation), [formats et conversions du presse-papiers](https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats).

## Inférence et confidentialité

Les profils acceptent HTTP seulement sur une adresse de bouclage et HTTPS ailleurs. Une base terminée par `/v1` est acceptée sans dupliquer le chemin. Les redirections HTTP sont désactivées. Le flux OpenAI SSE accepte les séparateurs LF et CRLF, les fragments UTF-8 et les événements répartis entre paquets. Seule une fin `finish_reason=stop` suivie de `[DONE]` produit l’événement `done`; une limite de longueur ou une fin prématurée produit une erreur. Une nouvelle requête annule la précédente et les événements périmés sont ignorés.

Le programme n’écrit dans les journaux ni source, ni traduction, ni clé, ni presse-papiers. Il ne contient aucune commande shell ou ouverture d’URL arbitraire.

## Démonstration et essais manuels

`FlowTranslate.exe --demo-selection` injecte une sélection ancrée et diffuse un résultat synthétique. `--demo-clipboard` injecte un repli presse-papiers. Ces options explicites ne modifient aucun profil. `--demo` est un alias de la première.

`--simulate-inference` utilise la capture Windows réelle avec une réponse synthétique. Ces modes ne contactent aucun modèle et n’ajoutent pas d’historique. Ils sont indiqués dans l’infobulle de la zone de notification. Fermer l’instance existante avant de changer de mode.

Les fenêtres sont créées après l’initialisation de l’état Rust, puis le frontend installe ses listeners avant `frontend_ready`. Les dimensions logiques sont converties sur le moniteur source ; les déplacements Win32 utilisent `SWP_NOACTIVATE`. Un hook clavier traite Échap seulement quand une bulle est ouverte et que le premier plan est la source, la bulle ou la capsule. Le contrôle de la sélection et de son ancre est périodique (environ 420 ms), ce qui laisse un bref délai de détection ; le remplacement refait ses contrôles immédiatement avant l’écriture.

Avant diffusion, vérifier sur Windows 11 à 100 %, 125 %, 150 % et 200 % : Word, Outlook Web, Teams Web et un champ natif; sélection simple et multiligne; sélection déplacée ou défilée pendant le flux; fenêtre source fermée; changement de presse-papiers; Escape; second raccourci; écran secondaire avec coordonnées négatives; résultat long; arrêt du serveur; réponse SSE tronquée. Confirmer que montrer et redimensionner n’activent pas l’overlay, que le côté choisi ne change pas pendant un flux et qu’aucun remplacement n’est possible après invalidation.

## Construction

Le frontend compilé doit exister dans `dist/`, puis exécuter depuis `src-tauri` :

```powershell
cargo test
cargo build --release
```

Le bundle NSIS est installé pour l’utilisateur courant. L’application ne démarre avec Windows que si l’option est activée.

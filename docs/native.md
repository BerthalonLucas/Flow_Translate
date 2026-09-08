# Hôte Windows natif

Le binaire Tauri 2 conserve les données sensibles côté Rust. Le WebView ne reçoit la clé d’API que dans l’écran des paramètres; elle est chiffrée par DPAPI avant écriture. Les textes d’historique sont regroupés dans une charge JSON chiffrée par DPAPI dans SQLite. Les métadonnées (date, langue, mode) restent lisibles afin d’appliquer la rétention de sept jours et cent entrées. L’historique est désactivé par défaut.

## Capture et remplacement

`capture_text` interroge le contrôle focalisé avec UI Automation `TextPattern`. Il garde l’identité du contrôle, la plage de sélection, son texte et la fenêtre de premier plan. Le dernier rectangle visible de la plage sert d’ancre physique. Une sélection lisible sans rectangle reste une capture de sélection et ouvre la capsule; elle n’est jamais remplacée par le contenu du presse-papiers. Si UIA ne fournit aucun texte, le presse-papiers Unicode sert de repli explicite et `canReplace` reste faux.

Le remplacement exige un contrôle modifiable connu (`ValuePattern` ou attribut texte `IsReadOnly=false`) et un contrôle Win32 focalisé de classe `Edit` ou `RichEdit*`. Au clic, un worker MTA réactive la fenêtre source et vérifie fenêtre, identifiant UIA, plage, texte et géométrie. Il compare également l’intégralité du texte UTF-16 et les bornes natives à leur capture avant d’appeler `EM_REPLACESEL` avec un délai maximal de 250 ms, puis vérifie le document résultant. Aucun clavier synthétique ni presse-papiers temporaire n’est utilisé. Toute divergence refuse l’opération et laisse Copier disponible. Les contrôles Web et Office dépourvus de cette prise en charge utilisent Copier ; leur remplacement complet reste hors du prototype actuel.

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

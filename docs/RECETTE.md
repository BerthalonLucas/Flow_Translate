# Recette Windows

Pour chaque passage, noter la version de l’application, l’échelle Windows, la configuration
des écrans, la disposition du clavier, le thème, et la preuve de chaque ligne (capture, vidéo,
résultat de sonde). Texte synthétique uniquement : une phrase courte, puis un paragraphe de
plusieurs lignes, puis un message plus long que la bande de lecture. Référence visuelle et de
mouvement : le labo design-lab/ (docs/DA-PLAN.md).

L’acceptation ne repose jamais sur une seule capture : vérifier l’identité de la sélection, le
focus et le contenu réel du presse-papiers avant et après. Ne fermer que les fenêtres lancées
pour le test et ne jamais arrêter une autre charge (processus GPU compris). Un exécutable de
test lancé depuis `src-tauri\target\release\` se lance avec `FLOWTRANSLATE_DATA_DIR` pointé
vers un dossier jetable, pour ne jamais toucher aux réglages ni à l’historique de
l’installation de Lucas (docs/UI-DECISIONS.md, décision 11 du 24 septembre 2026).

Consigner les résultats réels dans VALIDATION.md. Une case ne se coche qu’avec une preuve
consignée ; les listes ci-dessous sont une recette, pas une déclaration de tests réussis.

## Recette de la DA Îlot (0.5.0, en cours sur la branche `da-ilot`)

Cible : lot 14 de docs/DA-PLAN.md et décisions par défaut de la dernière section de
docs/UI-DECISIONS.md. Rien n’est coché tant que la version n’est pas passée sur un vrai poste.

### Poste de Lucas au 24 septembre 2026

- Installés : Chrome, Teams, Bloc-notes, VS Code.
- Absents : Word, Outlook et Edge (le navigateur ; seul le runtime WebView2 est présent). Les
  lignes de ces applications sont des recettes manuelles à faire par Lucas.
- Écrans : trois, tous à 100 % : 2560 × 1440 (principal) et deux 1920 × 1080. Les passages à
  150 % et 200 % sont aussi des recettes manuelles à faire par Lucas.

### Parcours par application

À faire sur une phrase, puis sur un paragraphe de plusieurs lignes :

1. Îlot : Ctrl+Alt+Espace l’ouvre à côté de la sélection ; choix au clavier (Entrée, lettre,
   Tab puis flèches) et à la souris.
2. Consigne libre : Espace ou « / » ouvre le champ ; une consigne avec accents et touches
   mortes (« réécris ça plus sympa, prêt à envoyer ») s’écrit sans perte.
3. Échap depuis le menu : le menu se ferme, la source retrouve le focus et sa sélection, rien
   n’est collé.
4. Balayage : visible sur les seules lignes sélectionnées, aucun clic intercepté ; sans
   rectangles de sélection, pilule seule en bas de l’écran du curseur et aucun effet sur le
   texte.
5. Résultat : texte remplacé, coche, mots changés surlignés pendant 8 s, pilule sous le
   nouveau texte et jamais dessus.
6. Annuler : dans les 8 s, l’original revient ; après une frappe dans la source, Annuler
   disparaît.

| Application | Poste au 24/09/2026 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Word | absent : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Outlook, thème clair et sombre | absent : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Chrome : `textarea`, `contenteditable`, `input` | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Edge | absent (seul WebView2) : manuel, Lucas | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Teams | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Bloc-notes | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| VS Code | installé | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

### Clavier : AZERTY et QWERTY

- [ ] AZERTY (France) : Ctrl+Alt+Espace ouvre l’Îlot ; les caractères AltGr tapés dans la
  source (@, €, #, {) n’ouvrent jamais le menu.
- [ ] QWERTY (États-Unis) : parcours 1 à 3 dans le Bloc-notes et dans Chrome.
- [ ] Lettres F T P S E et chiffres 1 à 6 : même action sur les deux dispositions ; une lettre
  non attribuée ouvre la consigne pré-remplie avec cette lettre.
- [ ] Enregistreur de raccourci : une combinaison Ctrl+Alt+lettre en conflit avec AltGr sur la
  disposition active est signalée.
- [ ] Double appui du raccourci en moins de 400 ms : la dernière action de cette application
  est relancée sans afficher le menu.

### Échelles et écrans

- [ ] 100 % : écran principal 2560 × 1440 et un écran 1920 × 1080.
- [ ] 150 % (manuel, Lucas) : Îlot, pilule et balayage alignés sur les lignes, texte net.
- [ ] 200 % (manuel, Lucas) : mêmes vérifications.
- [ ] Deux écrans : sélection sur un écran secondaire, y compris celui à coordonnées
  négatives ; l’Îlot, la pilule et le balayage restent sur l’écran de la sélection, dans sa
  zone de travail, à la bonne échelle.
- [ ] Sélection près d’un bord : l’Îlot et la pilule restent dans la zone de travail et
  passent au-dessus si nécessaire.

### Thème et animations

- [ ] Thème clair de Windows : verre clair ; thème sombre : verre sombre ; bascule du thème
  pendant que l’app tourne.
- [ ] Lisibilité sur une page blanche, une page sombre et un fond chargé (contraste d’au moins
  4,5:1).
- [ ] Animations « suivre Windows » avec l’option Windows « Effets d’animation » coupée : mode
  réduit, et la phrase explicative affichée dans les Réglages.
- [ ] Animations « réduites » : fondus d’opacité courts seulement, orbe fixe, voile fixe à la
  place du balayage, aucun déplacement ni ressort.
- [ ] Animations « toujours » : ressorts actifs même quand Windows réduit ; préréglages
  « smooth » (défaut) et « bouncy ».

### Erreurs

- [ ] Serveur coupé : pilule d’erreur, Réessayer ; rien n’est remplacé.
- [ ] Clé fausse (401 ou 403) : le bouton ouvre les Réglages sur le champ de la clé, mis en
  évidence.
- [ ] Modèle absent (404) : le bouton ouvre le champ du modèle.
- [ ] Aucun texte source, résultat ni clé dans les journaux ; jamais le corps de la réponse du
  serveur dans le message.

### Cible, sélection et presse-papiers

- [ ] Sélection modifiée pendant le travail : rien n’est remplacé, le résultat est proposé à
  la copie.
- [ ] Fenêtre au premier plan changée pendant le travail : aucun collage dans une autre
  fenêtre.
- [ ] Fenêtre déplacée ou texte défilé pendant le travail : balayage caché, aucun collage vers
  une cible périmée.
- [ ] Presse-papiers modifié par l’utilisateur pendant l’opération : jamais restauré
  par-dessus.
- [ ] Annuler après modification du texte collé : refus propre, rien n’est modifié, message
  clair.
- [ ] Annuler en option B (Réglages) : même revalidation, l’original est recollé.
- [ ] Application sans UI Automation ou élevée : repli sûr par la copie synthétique, aucune
  injection privilégiée.

### Général

- [ ] Au repos : aucune fenêtre ni bouton de barre des tâches, seulement l’icône de
  notification.
- [ ] Historique désactivé : ni source ni résultat persistés ; activé : charges chiffrées,
  suppression et rétention fonctionnent.
- [ ] Installateur puis redémarrage : app disponible, pas de lancement automatique sans
  accord.
- [ ] Langue : anglais au premier lancement, bascule française complète sans rechargement ;
  une action existante ou personnalisée n’est jamais renommée.
- [ ] Mode « Afficher le résultat » et traduction longue : même comportement qu’en 0.4.0 dans
  la nouvelle matière.

## Historique : recette de la bulle graphite (0.1.x à 0.4.0)

Remplacée par la recette Îlot ci-dessus et gardée pour mémoire. La référence
`design/glass-reader/c-overlapping-pill.png`, la capsule, la confirmation avant envoi, le
focus par un second appui et le graphite translucide sont historiques (docs/DA-PLAN.md).

Record application version, Windows scaling, screen configuration and pass/fail evidence for each run. Use synthetic text only. Start with the approved short sentence, then a multiline paragraph and a message longer than the bottom reader viewport. Current visual reference: design/glass-reader/c-overlapping-pill.png.

| Scenario | Expected behavior | Status |
|---|---|---|
| Idle | No window/taskbar button except tray | Not run |
| Browser selected text | Small bubble at end, selection readable, source focus retained | Not run |
| Clipboard without selection | Small bottom capsule, explicit source confirmation before send | Not run |
| Repeat shortcut | Focus bubble for keyboard actions | Not run |
| Escape with source focused | Cancel/dismiss without editing source | Not run |
| Copy during generation | Unavailable | Not run |
| Normal completion | Copy copies exact final output | Not run |
| Truncated/server error | Clearly unavailable result, never insert partial text | Not run |
| Selection changed | Replacement unavailable/refused; original data untouched | Not run |
| Foreground window changed | Never paste into the new unrelated window | Not run |
| Clipboard changed during operation | Never restore old content over new clipboard | Not run |
| Window moved/scrolled | Correct re-anchor or explicit bottom fallback | Not run |
| Edge/Chrome input field | Explicit replacement only with verified target | Not run |
| Word/Outlook/Teams | Record each supported/unsupported actual version | Not run |
| UIA unavailable/elevated app | Safe clipboard fallback; no privileged injection | Not run |
| DPI100/125/150/200% |280 logicalpx bubble, correct anchor, legible15px text | Not run |
| Negative-coordinate monitor | Overlay remains within correct working area | Not run |
| Light/dark backdrop | Opaque readable text, translucent graphite only | Not run |
| Reduced motion | No animated expansion/translation | Not run |
| History off | No source/output persisted | Not run |
| History on | Encrypted local payloads, deletion/retention work | Not run |
| Wrong server/key | French actionable error, no credential/payload logging | Not run |
| Installer then restart | App available, no autostart without opt-in | Not run |

Acceptance is not based solely on a screenshot: verify selection identity, focus and actual clipboard contents before/after. Close only windows launched for this test, and never stop unrelated workloads.

### Régression verre et lecteur bas — 0.1.3

- Texte court : verre seul, pilule Copier/Plus chevauchant le bord supérieur droit, aucune première ligne masquée.
- Texte long : lecteur centré en bas du bon moniteur, aucune barre visible ; molette et clavier permettent de lire la fin du texte et Copier conserve tout.
- Ouvrir/fermer le menu du lecteur : le texte doit conserver ses coordonnées à l'écran, sauf si le moniteur est trop petit et impose un ajustement.
- Tester les coins et l'espace transparent entre menu/pilule/verre : les clics hors surfaces passent à l'application source.
- Streaming : pas d'aller-retour entre formats, pas de déplacement à chaque fragment, pas de texte étiré ni de flou animé.
- Fermer pendant le flux : annulation immédiate, disparition courte, aucun fragment tardif ne réaffiche la bulle.
- Nouvelle capture pendant la fermeture précédente : un ancien accusé de fermeture ou délai de secours ne doit jamais masquer la nouvelle capture.
- Répéter les interactions avec mouvements réduits ; pas d'animation prolongée imposée.
- Comparer un profil synthétique avant/après avec scripts/profile-ui.mjs. Les intervalles d'images de Chromium ne sont pas une mesure du compositeur Windows.

Consigner les résultats réels dans VALIDATION.md. Les points ci-dessus sont une recette, pas une déclaration de tests réussis.

### Régression 0.1.1 : cadre et déplacement

- Dans la vraie fenêtre Tauri, vérifier l’absence de barre de titre au premier affichage, après focus et après Agrandir/Réduire.
- Faire glisser le texte et le fond : la bulle suit la souris et reste à sa nouvelle position après ouverture du menu et pendant le streaming.
- Vérifier que Copier et Plus d’options ne déclenchent pas un déplacement ; faire défiler un texte long avec la molette et la barre.
- Fermer avec Échap pendant un déplacement ne doit pas réafficher la fenêtre au relâchement.
- Capturer un nouveau texte doit rétablir l’ancrage contextuel ; changer de moniteur doit conserver une bulle visible à la bonne échelle.
- Vérifier le lancement depuis le PowerShell de l’utilisateur avec le chemin réellement installé, hors redirection privée de Codex.

# Recette Windows

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

## Régression verre et lecteur bas — 0.1.3

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

# Régression 0.1.1 : cadre et déplacement

- Dans la vraie fenêtre Tauri, vérifier l’absence de barre de titre au premier affichage, après focus et après Agrandir/Réduire.
- Faire glisser le texte et le fond : la bulle suit la souris et reste à sa nouvelle position après ouverture du menu et pendant le streaming.
- Vérifier que Copier et Plus d’options ne déclenchent pas un déplacement ; faire défiler un texte long avec la molette et la barre.
- Fermer avec Échap pendant un déplacement ne doit pas réafficher la fenêtre au relâchement.
- Capturer un nouveau texte doit rétablir l’ancrage contextuel ; changer de moniteur doit conserver une bulle visible à la bonne échelle.
- Vérifier le lancement depuis le PowerShell de l’utilisateur avec le chemin réellement installé, hors redirection privée de Codex.

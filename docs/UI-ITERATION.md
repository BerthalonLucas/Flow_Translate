# Boucle de validation visuelle

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

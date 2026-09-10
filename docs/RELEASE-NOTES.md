# 0.1.6 — onglet, bords lissés, attente en anneau

La bulle se replie en un onglet de 44 × 20 px au bord bas de l’écran quand la
souris la quitte (ou après 10 s sans visite) ; le survoler la rouvre, le × ou
**Fermer** la ferme. `Ctrl+Alt+T` traduit aussitôt la sélection courante, presse-
papiers compris, sans confirmation ; la fenêtre capsule n’est plus affichée.

Plus de matériau DWM ni de région Win32 : le verre se peint lui-même, Chromium
dessine les coins et les ombres avec l’alpha par pixel, et le hit-test suit le
curseur (sondage toutes les 8 ms, `WS_EX_TRANSPARENT | WS_EX_LAYERED`). Fini le
cadre gris, les coins en escalier et les ombres coupées ; la fenêtre porte un halo
transparent pour les ombres.

Pendant la traduction, un anneau tourne ; le résultat arrive d’un bloc, la
fenêtre se redimensionne une seule fois et le verre s’ouvre en fondu. Une erreur
de connexion nomme le serveur injoignable et renvoie aux Réglages. Le rendu natif
(coins, ombre, fluidité) reste à confirmer à l’œil : la session de validation
était verrouillée, voir VALIDATION.md. Kit d’essai pour un autre poste :
`scripts/package-test-kit.ps1 -EvaluationVersion 0.1.5`.

## 0.1.5 — moteurs réels et kit de recette

Inférence réelle sous WSL2 (runner alternatif de l’image vLLM 0.28.0 épinglée,
une carte par profil), 600/600 réponses complètes sur les extraits synthétiques,
fenêtre Réglages sans cadre, premier kit de recette Windows.

## 0.1.4 — verre plus présent, interactions affinées

Le verre graphite passe de 78 % à 66 % d'opacité, les accessoires à 68 %.
Un bord asymétrique et des reflets intérieurs discrets donnent du relief sans
modifier la taille de la bulle. Le menu et la pilule partagent le même matériau.

Les retours visuels et le menu utilisent des fondus courts ; les icônes de copie
se croisent dans une zone fixe. Le flou et les ombres restent statiques. Windows
ne recalcule plus le cadre à chaque changement de géométrie lorsque le style
de la fenêtre est déjà correct. Les mouvements réduits restent respectés.

L'aperçu navigateur permet de comparer les fonds clair, sombre et coloré.
Les contrôles de fond appartiennent uniquement à cet aperçu. Le fondu acrylique
du compositeur Windows demeure distinct des animations du WebView ; les preuves
et limites de la recette sont dans VALIDATION.md.

## 0.1.3 — verre, pilule chevauchante et lecteur bas

Référence visuelle : planche C validée par Lucas. La traduction dispose de sa
propre surface de verre graphite ; Copier et Plus sont réunis dans une petite
pilule à cheval sur le bord supérieur droit. Les textes longs utilisent un
lecteur plus large en bas du moniteur, sans barre de défilement visible.

Les transitions utilisent Motion et respectent les mouvements réduits. Le
texte reste net : pas d'étirement ou d'animation du flou. La fermeture annule
immédiatement la traduction, puis coordonne la sortie visuelle avec Rust ; un
délai borné sert de secours. Les régions natives correspondent aux surfaces
réelles pour laisser passer les clics dans les espaces transparents.

Les preuves de compilation, tests, rendu et mesures sont consignées dans
VALIDATION.md. Un profil Chromium synthétique ne prouve pas la fluidité du
compositeur Windows et le dépoli doit être vérifié dans la fenêtre Tauri.

## 0.1.2 — composants éprouvés et boucle de revue visuelle

Le frontend est confié à Astra avec un effort de raisonnement medium ou supérieur.
Motion anime les apparitions et retours visuels, Radix fournit les menus et
interrupteurs accessibles, Lucide fournit les icônes. Versions épinglées et
notices de licence embarquées. La bulle courte conserve ses 280 × 76 px,
ses coins de 26 px et son fond graphite à 82 %.

Fermer reste disponible pendant le chargement et après une erreur. Les
scénarios de démonstration sont rejouables. Les 6 tests unitaires et 19 tests
navigateur passent. La revue combine désormais navigateur contrôlé et captures
de la vraie fenêtre Windows ; voir UI-ITERATION.md pour les résultats natifs.

Les transitions de dimensions et la fermeture native ne sont pas encore
animées : elles demandent une coordination explicite entre React et Rust.

## Correctifs précédents — 0.1.1

Correction du cadre Windows qui recouvrait la traduction. Le texte utilise
désormais toute la largeur et les petites actions suivent sa dernière ligne.
Faire glisser le texte ou le fond pour déplacer la bulle ; les boutons et les
barres de défilement gardent leur interaction. La position choisie reste en
place pendant le streaming et les changements de taille du résultat courant.

Le poste de développement utilise désormais un chemin explicite :
`C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`, afin d’éviter la
redirection de LocalAppData par l’environnement Codex.

## Fonctionnalités de l’aperçu V1

Premier client Windows installable : interface Tauri contextuelle, bulle 280 px,
capsule presse-papiers avec confirmation, réglages, profils, raccourci global,
streaming, copie explicite, historique DPAPI facultatif et installation NSIS.
Configuration reproductible vLLM 0.28.0 et modèles Hy-MT2 épinglés. Dépôt privé.

Les options `--demo-selection` et `--demo-clipboard` permettent d’essayer le
rendu sans serveur. `--simulate-inference` sert à tester la capture réelle avec
une réponse synthétique ; quitter l’instance avant de changer de mode.

Cet aperçu n’est pas encore une V1 entièrement réceptionnée :

- Les modèles n’ont pas été chargés ni comparés sur GPU : ressources occupées,
  moteur Docker arrêté. Aucun résultat de qualité/latence n’est inventé.
- Remplacer est limité aux contrôles Win32 Edit/RichEdit vérifiables. Les
  autres contrôles conservent Copier. La recette Office/Teams reste à faire.
- Une reprise visuelle sur le bureau Windows est nécessaire pour valider les
  derniers correctifs, les transitions de taille et le DPI multi-écrans.
- Le paquet n’est pas signé par un certificat de distribution d’entreprise.

Voir [les preuves de validation](VALIDATION.md), [la recette](RECETTE.md) et
[la procédure d’installation et de retour arrière](DEPLOYMENT.md).

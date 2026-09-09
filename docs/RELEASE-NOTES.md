# 0.1.3 — verre, pilule chevauchante et lecteur bas

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

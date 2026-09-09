# 0.1.1 — bulle compacte et déplaçable

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

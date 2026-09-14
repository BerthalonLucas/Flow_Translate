# FlowTranslate

Application Windows 11 discrète pour traduire des mails et messages FR ↔ EN.
Client **Tauri 2 + React + Rust**, serveur séparé **vLLM 0.28.0**.

Une sélection ouvre une bulle graphite de 280 px près du texte. Le presse-papiers
ouvre une capsule de 200 × 36 px et demande confirmation avant l’envoi. Au repos,
seule l’icône de notification reste présente. Langue, profil Rapide/Qualité,
raccourci et connexion se configurent dans les réglages.

**État : version d’essai 0.2.0 (lecture calibrée : verre court ou bande de lecture à la moitié de l’écran décidés une fois sur le vrai texte, spinner d’attente, fermeture d’elle-même au temps de lecture, bande qui suit la souris d’un écran à l’autre, taille du texte et fermeture réglables) ; capture directe depuis la 0.1.8 ; moteurs réels validés en 0.1.5.**
Les 100 extraits synthétiques FR↔EN ont été exécutés pour chaque modèle à 1, 4
et 10 requêtes simultanées. La revue humaine de qualité et la matrice native
Office/multimoniteur restent à terminer. Voir [le guide d’essai sur un autre poste](docs/ESSAIS-0.1.6.md), [l’essai réel 0.1.5](docs/ESSAIS-0.1.5.md)
et les preuves dans [VALIDATION.md](docs/VALIDATION.md).

## Essayer

Après installation, sélectionner du texte puis presser `Ctrl+Alt+T`. Une seconde
pression donne le focus à la bulle ; `Échap` la ferme. Copier devient disponible
à la fin du flux. Remplacer est réservé aux contrôles dont l’édition est prise
en charge et la sélection encore valide.

Les connexions locales par défaut sont `http://127.0.0.1:8001/v1` et
`http://127.0.0.1:8002/v1`, modèles `flowtranslate-fast` et `flowtranslate-quality`.
Suivre [la procédure serveur](server/README.md) avant une traduction réelle.

Pour examiner le rendu natif sans GPU :

```powershell
FlowTranslate.exe --demo-selection
FlowTranslate.exe --demo-clipboard
FlowTranslate.exe --demo-long
```

La bulle se déplace en faisant glisser ses marges. Le texte reste sélectionnable,
les boutons cliquables et la molette fait défiler les textes longs sans barre
visible. Les textes longs passent dans le lecteur bas, plus large. Un déplacement manuel
reste valable pour le résultat courant ; la capture suivante retrouve son ancrage.

Sur le poste de développement de Lucas, le lancement utilise un dossier explicite
afin d’éviter la redirection de `%LOCALAPPDATA%` par le paquet Codex :

```powershell
& "C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe"
```

Fermer l’instance précédente depuis son icône avant de changer de mode.
Ces options explicites utilisent des réponses synthétiques et n’enregistrent
pas d’historique. `--simulate-inference` conserve la capture Windows réelle mais
simule la réponse, pour la recette. `--settings` ouvre directement les réglages.

## Développer et construire

```powershell
npm ci
npm run tauri -- dev
```

Le développement natif requiert les outils MSVC/Windows SDK, Rust et WebView2.
Pour la démo navigateur seule : `npm run dev`, puis `http://127.0.0.1:5173`.
Le navigateur ne lit aucun presse-papiers et ne contacte aucun modèle.

```powershell
npm test
npx playwright install chromium --only-shell
npx playwright test
python -m unittest discover -s server -p 'test_*.py' -v
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

L’installateur se trouve dans `src-tauri/target/release/bundle/nsis/` (ou dans
`CARGO_TARGET_DIR` si ce répertoire a été personnalisé). Voir
[installation et retour arrière](docs/DEPLOYMENT.md), [contrat du pont](docs/BRIDGE.md),
[spécification](docs/SPEC.md) et [recette](docs/RECETTE.md).

L’historique est désactivé initialement. S’il est activé, les textes sont
chiffrés par Windows DPAPI, avec rétention de 7 jours et 100 entrées. Les clés
API sont également protégées par DPAPI. Aucun texte traduit, presse-papiers,
secret ou poids de modèle ne doit être ajouté au dépôt ni aux journaux techniques.

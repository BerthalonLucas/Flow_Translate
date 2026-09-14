# FlowTranslate

Traduction instantanée de n’importe quelle sélection sous Windows 11 : sélectionner,
`Ctrl+Alt+T`, lire, laisser partir. Client **Tauri 2 + React + Rust** ; moteur de
traduction **séparé**, au choix : le serveur vLLM livré dans `server/` (Hy-MT2), ou tout
serveur compatible OpenAI, local ou distant.

**État : version d’essai 0.2.1.** Capture directe (le raccourci copie lui-même la
sélection quand UI Automation ne la donne pas), lecture calibrée (verre court près du
texte ou bande de lecture à la moitié de l’écran, décidés sur le vrai texte), fermeture
d’elle-même au temps de lecture, bande qui suit la souris d’un écran à l’autre. Moteurs
réels validés en 0.1.5. Le jugement visuel de Lucas sur chaque version reste la
référence ([docs/UI-ISSUES.md](docs/UI-ISSUES.md)).

## Installer

1. Prendre l’installateur `FlowTranslate_<version>_x64-setup.exe` dans les
   [releases GitHub](https://github.com/BerthalonLucas/Flow_Translate/releases) et
   comparer son SHA-256 au fichier `SHA256SUMS.txt` joint. Installation par utilisateur,
   sans droits administrateur ; Microsoft Edge WebView2 Runtime doit être présent (il
   l’est sur Windows 11).
2. Lancer FlowTranslate : seule une icône apparaît dans la zone de notification.
3. Brancher un moteur (section suivante), puis Réglages → **Connexion avancée** →
   « Vérifier ».
4. Sélectionner du texte dans n’importe quelle application et presser `Ctrl+Alt+T`.

Pas de release publiée pour une version donnée ? La construire soi-même : voir
« Développer et construire ».

## Brancher un moteur de traduction

Le client parle le contrat OpenAI `/v1/chat/completions` en flux. Trois champs par
profil (Rapide, Qualité) dans Réglages → Connexion avancée : **Adresse**, **Modèle**,
**Clé API** (facultative en local, chiffrée par DPAPI). `http://` n’est accepté que sur
le poste (`127.0.0.1`) ; ailleurs, `https://` est obligatoire.

- **Le serveur livré** (`server/`) : vLLM 0.28.0 épinglé, deux profils Docker Compose,
  Rapide `http://127.0.0.1:8001/v1` modèle `flowtranslate-fast` (Hy-MT2-1.8B), Qualité
  `http://127.0.0.1:8002/v1` modèle `flowtranslate-quality` (Hy-MT2-7B-FP8). Procédure,
  précontrôle GPU et évaluation dans [server/README.md](server/README.md) ; les poids
  sont téléchargés au premier lancement, jamais commités.
- **Un autre serveur** (llama.cpp, LM Studio, Ollama, vLLM d’entreprise, service en
  ligne) : adresses, noms de modèle et pièges dans [docs/ENDPOINTS.md](docs/ENDPOINTS.md),
  avec la requête exacte envoyée et ce qui est attendu en retour.

## Utiliser

- `Ctrl+Alt+T` traduit la sélection courante vers la langue cible des Réglages
  (français ou anglais, source détectée). Sans sélection lisible, FlowTranslate copie
  lui-même (Ctrl+Insert synthétique, presse-papiers remis en place) ; une copie faite
  soi-même moins de trois secondes avant est acceptée ; sinon un avis discret, jamais
  de boîte de dialogue.
- Un texte court s’ouvre près de la sélection ; un texte long s’ouvre en bande de
  lecture en bas de l’écran de la souris, large de la moitié de l’écran, et suit la
  souris d’un écran à l’autre. Molette pour défiler, épingle pour garder la bande.
- La bulle s’efface d’elle-même au bout du temps de lecture estimé, vite une fois la
  souris partie ; un clic, la molette ou une touche la retiennent ; `Échap` la ferme.
- Pilule : Copier, Épingler (bande), menu ⋯ (Original, Remplacer quand le contrôle le
  permet, Relancer avec l’autre profil, Réglages, Fermer). L’icône de notification
  propose « Revoir la dernière traduction » pendant dix minutes.
- Réglages : langue cible, profil par défaut, raccourci, taille du texte, fermeture
  automatique, historique chiffré (désactivé au départ : DPAPI, 7 jours, 100 entrées),
  lancement à l’ouverture de session, connexions.

Modes de démonstration, sans moteur ni historique :

```powershell
FlowTranslate.exe --demo-selection
FlowTranslate.exe --demo-clipboard
FlowTranslate.exe --demo-long
```

`--simulate-inference` garde la capture Windows réelle mais simule la réponse.
`--settings` ouvre directement les Réglages. Fermer l’instance précédente depuis son
icône avant de changer de mode.

## Développer et construire

Prérequis : Node.js 24, Rust stable, outils MSVC et Windows SDK, WebView2 Runtime.
Dépendances verrouillées (`package-lock.json`, `src-tauri/Cargo.lock`).

```powershell
npm ci
npm run tauri -- dev
```

Aperçu navigateur seul (composants React, réponses simulées, aucun presse-papiers ni
moteur) : `npm run dev` puis `http://127.0.0.1:5173` ; atelier des défauts signalés sur
`/lab.html`.

```powershell
npm test
npx playwright install chromium --only-shell
npx playwright test
npm run ui:check
python -m unittest discover -s server -p 'test_*.py' -v
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
```

L’installateur sort dans `src-tauri/target/release/bundle/nsis/` (ou sous
`CARGO_TARGET_DIR`). Preuves natives : `scripts/test-native-ui.ps1 -Executable <exe>`
(fenêtre sans cadre, surfaces cliquables, fermeture) et
`scripts/capture-matrix.ps1 -Executable <exe>` (capture réelle par application).

Publier une version : pousser un tag `v<version>` (ou lancer le workflow « Release » à
la main avec ce tag) ; `.github/workflows/release.yml` construit l’installateur, calcule
son SHA-256 et crée la release GitHub avec la note de version de
[docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md).

## Documentation

- [docs/ENDPOINTS.md](docs/ENDPOINTS.md) : brancher un moteur, contrat exact.
- [server/README.md](server/README.md) : serveur vLLM livré, GPU, évaluation.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) : installation, exploitation, retour arrière.
- [docs/BRIDGE.md](docs/BRIDGE.md) : contrat React ↔ Rust ; [docs/SPEC.md](docs/SPEC.md),
  [docs/native.md](docs/native.md) : spécification et couche Windows.
- [docs/RELEASE-NOTES.md](docs/RELEASE-NOTES.md), [docs/UI-ISSUES.md](docs/UI-ISSUES.md),
  [docs/UI-ITERATION.md](docs/UI-ITERATION.md) : versions, défauts, itérations visuelles.

## Confidentialité

Le texte sélectionné n’est envoyé qu’au serveur du profil choisi. Aucun texte, aucune
traduction, aucun contenu du presse-papiers ni aucune clé n’est écrit dans les journaux
ni dans le dépôt. Les clés API et l’historique (s’il est activé) sont chiffrés par
Windows DPAPI et ne sont pas portables vers un autre compte.

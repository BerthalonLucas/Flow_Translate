# Reprendre la 0.5.0

État au 18 septembre 2026. Ce document dit où en est le travail, ce que contient chaque branche et
dans quel ordre reprendre. Tout ce qui suit est poussé sur `origin` : un clone suffit à reprendre
depuis un autre poste.

## Où on en est

- `main` porte la **0.4.0**, publiée (release `v0.4.0`, installateur NSIS + `SHA256SUMS.txt`).
- La **0.5.0** est en cours sur `feat/0.5.0-design-1.0` : portage du design system 1.0 sur le modèle
  de données actuel (deux profils Rapide et Qualité, un raccourci = une action + une sortie), plus
  les correctifs que la spec range en 0.5.0.
- Un workflow multi-agents a produit le plan puis attaqué l'implémentation en cinq unités parallèles,
  chacune dans son worktree. **Il a été coupé par la limite de session** : trois unités ont du travail
  committé mais non vérifié, deux ont rendu leur rapport, la fusion n'a jamais eu lieu.

## Ce qui est dans le dépôt

| Chemin | Contenu |
|---|---|
| `docs/design-system/` | Le design system 1.0 « Graphite & Surligneur » : `README.md` (principes, thèmes, focus), `tokens.json` et `tokens.css` (source unique des variables, déjà copiée en `src/tokens.css`), `guidelines/` (dont `20-de-0-4-0-a-1-0.md`, la marche à suivre du portage), `components/` (README par composant + implémentation de référence `bundle.css` / `bundle.js`), `assets/` (SVG des icônes, logos, glyphes de zone de notification), `previews/` (les 56 rendus des aperçus, thèmes sombre et clair), `tools/` (scripts qui construisent le bundle, génèrent `tokens.css`, rendent les aperçus et contrôlent les contrastes) |
| `docs/ux/SPEC-UX.md` | La spec UX « Une porte, des lettres » : le geste, la bulle d'actions, moteurs, erreurs, § 12 le découpage en versions jusqu'à la 1.0, § 13 les onze décisions de Lucas du 17/09 |
| `docs/ux/visuel/` | Les maquettes de l’étude visuelle de la bulle d’actions (V1 à V5 et les transitions), avec leur source HTML et le script de rendu ; contenu d’exemple neutre |
| `docs/0.5.0/PLAN.md` | Le plan retenu : décisions d'interprétation, contrat entre unités, périmètre de chaque unité, ce qui reste après la fusion, hors périmètre |
| `docs/0.5.0/CARTES.md` | Trois lectures du dépôt à la base `2fbfdac` : le front, le natif, les exigences 0.5.0 |
| `docs/0.5.0/CRITIQUES-DU-PLAN.md` | Ce qu'une relecture adverse a trouvé dans les deux premières versions du plan |
| `docs/0.5.0/UNITES.md` | Les rapports des unités qui ont eu le temps de rendre le leur |

Le design system est aussi publié comme artifact : <https://claude.ai/artifact/3z5DwWqcLThKijtc5MPwYs>.

## Les branches de la 0.5.0

Toutes partent de `2fbfdac` (0.4.0 + design system et spec importés).

| Branche | État | Contenu |
|---|---|---|
| `feat/0.5.0-design-1.0` | base d'intégration | Import du design system, de la spec et des documents de la 0.5.0. Rien du portage n'y est encore fusionné |
| `wt-050-marque` | **terminée, vérifiée par l'unité** | Icône d'application (ICO 16–256) et six glyphes de zone de notification rastérisés depuis les SVG du design system, avec le script de rastérisation |
| `wt-050-atelier` | **terminée, vérifiée par l'unité** | Atelier (`src/lab`) au thème réel des Réglages, matrice de captures complète, `visual-tests` étendus, type-check des tests (`tsconfig.test.json`) |
| `wt-050-reglages` | avancée, non vérifiée | Fenêtre à navigation (Actions, Lecture, Moteurs, Confidentialité), thème Windows clair et sombre, adresse vérifiée à la sortie du champ, contrôles propres aux Réglages, tokens importés ; dernier commit `wip` : les tests e2e des Réglages séparés de ceux du verre, jamais exécutés |
| `wt-050-verre` | **`wip`, interrompue** | `glass.css` sur les tokens, `GlassOverlay` avec l'étiquette d'action et l'erreur sans estompe, `overlay-ipc.ts`, tests e2e de l'overlay repris. Aucune vérification lancée |
| `wt-050-natif` | **`wip`, interrompue** | `settings.rs` avec `schemaVersion`, sauvegarde par montée et chargement tolérant ; `tray.rs` et `autostart.rs` nouveaux ; messages réécrits ; fenêtre 760 × 640. Les icônes de `src-tauri/icons/tray/` sont à prendre sur `wt-050-marque`, pas sur cette branche. Aucun `cargo test` lancé |

Les commits `wip` ne sont ni relus ni testés : ils existent pour que rien ne soit perdu. Les relire
avant de les fusionner fait partie du travail.

## Ordre de reprise

1. Fusionner `wt-050-marque` et `wt-050-atelier` dans `feat/0.5.0-design-1.0` (elles sont finies).
2. Finir `wt-050-verre` et `wt-050-natif` en suivant `docs/0.5.0/PLAN.md` (le contrat dit ce que chaque
   côté attend de l'autre), puis fusionner ; `wt-050-reglages` ensuite, elle croise les deux.
3. Monter la version à 0.5.0 (`package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
   `tauri.conf.json`), mettre à jour `docs/DEPLOYMENT.md`, `docs/ENDPOINTS.md`, `docs/RELEASE-NOTES.md`.
4. Faire passer ce que lance la CI : `npm test`, `npm run build`, `npx playwright test`,
   `npm run ui:check`, `python -m unittest discover -s server`,
   `cargo test --locked --manifest-path src-tauri/Cargo.toml`, puis `npm run tauri -- build --bundles nsis`.
   Régénérer les références visuelles (`npm run ui:reference`) seulement après avoir regardé le rendu.
5. **Renommer l'application en « Verso »** (nom choisi le 17/09 ; « FlowTranslate » ne disait plus ce que
   fait l'outil). Le renommage vient en dernier, dans son propre commit : `productName`, identifiant
   `com.flowtranslate.desktop` → `com.verso.desktop`, titres et libellés, installateur. La migration des
   installations existantes (dossier `%APPDATA%`, clé `Run`, historique chiffré DPAPI) est décrite dans
   `PLAN.md` ; l'unité natif l'avait commencée.
6. Ne fusionner dans `main` qu'une fois la version **complètement** finie et vérifiée : CI verte **et**
   inférence réelle contre les serveurs locaux. Le merge publie la release.

## Ce qui n'est pas dans le dépôt, volontairement

- L'archive `FlowTranslate exploration et prototype.zip`, les clés, les poids de modèles, `release/`.

## Rappels de travail

- Aucune attribution IA dans les commits (`Co-Authored-By`, `Signed-off-by`) ni dans les descriptions
  de PR.
- Fichiers ajoutés un par un ; jamais `git add -A`.
- Le contrat géométrique (`src/layout.ts` et le hit-test Rust) ne bouge pas ; l'overlay ne prend jamais
  le focus ; aucun texte, résultat ou contenu de presse-papiers dans les journaux.

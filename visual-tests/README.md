# Références observées, pas approbation esthétique

Une comparaison réussie signifie seulement que le rendu n’a pas changé depuis
l’image de référence. Ne pas remplacer les images pour faire passer un test sans
examiner attendu / réel / différence (rapport HTML de `npm run ui:check`).

## Deux parcours, deux jeux d’images

`states.spec.ts` ouvre les scénarios de l’atelier (`lab-frame.html`), qui partent
de l’Îlot, le parcours par défaut de l’application. Le parcours 0.4 (réglage caché
`uiVersion` « v4 ») se demande avec `ui=v4`.

- **0.4** (`@v4`) : les 21 PNG à la racine de `references/win32/chromium/`,
  relevés à la 0.4.0, défauts connus compris (docs/UI-ISSUES.md).
- **Îlot** (`@ilot`) : les PNG de `references/win32/chromium/ilot/`.

`npm run ui:check -- --grep @v4` ou `npm run ui:check -- --grep @ilot` vérifie un
jeu seul.

## État des images 0.4 (25/09/2026, lot 14)

Périmées, **ni acceptées ni régénérées** : 20 des 21 images diffèrent du rendu
actuel du parcours 0.4, seule `notice-dark` passe. Causes : la matière claire et
sombre et les icônes Lucide de 14 à 16 px (lot 1), les Réglages en anglais et
réorganisés (lot 13), la version affichée. Avant le lot 14, 26 des 27 tests
échouaient déjà, et sept images n’étaient même pas comparées : le titre
« Traduction » attendu par les Réglages, l’Historique et settings-narrow n’existe
plus, le bouton « Plus d’options » du menu s’appelle « More options ». Les tests
attendent désormais « Settings » et « More options », et l’état court est comparé
sans arrêter le test (`expect.soft`) pour que le menu le soit aussi : chaque image
produit sa différence.

Le lot 14 ne les a pas fait bouger : les 21 états 0.4, rendus avant et après le
passage à l’Îlot par défaut, sont identiques octet pour octet, et les 13 écarts
qui existaient déjà comptent les mêmes pixels qu’avant. À Lucas de décider après
examen : régénérer (`npm run ui:reference -- --grep @v4`) ou attendre le retrait
de la 0.4.

## Régénérer

`npm run ui:reference` est une opération explicite, distincte du test normal.
Sans filtre, elle réécrit **toutes** les images qui diffèrent (`--update-snapshots`
vaut alors `changed`), celles de la 0.4 comprises : filtrer avec
`-- --grep @ilot` ou `-- --grep @v4`. Pour écrire seulement les images absentes :
`npx playwright test --config playwright.visual.config.ts --update-snapshots=missing --grep @ilot`.

Port : `FLOWTRANSLATE_TEST_PORT` (5174 par défaut).

## Conditions du relevé

Windows, Chromium fourni par @playwright/test 1.63.0, viewport 900×600
(480×640 pour settings-narrow, 1920×1080 et 2560×1440 pour les lecteurs),
locale fr-FR, Europe/Paris, mouvements réduits. Fixtures publiques fictives
exclusivement. L’historique est positionné sur son contenu. Les fonds clair/sombre
et color-scheme des contrôles sont forcés par la fixture ; une évolution basée sur
prefers-color-scheme devra aussi émuler le thème du navigateur.

Les scénarios de l’atelier sont uniquement servis par Vite en développement.
Ils ne sont pas inclus dans dist ni dans l’installateur Tauri.

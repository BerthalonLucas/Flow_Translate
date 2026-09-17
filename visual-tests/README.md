# Références observées, pas approbation esthétique

Une comparaison réussie signifie seulement que le rendu n’a pas changé. Ne pas remplacer
les images pour faire passer un test sans examiner attendu / réel / différence.
`npm run ui:check` compare ; `npm run ui:reference` est une opération explicite de mise à
jour, distincte du test normal. Le rapport HTML contient les comparaisons en cas de
différence. Les scénarios de l’atelier ne sont servis par Vite qu’en développement : ils
n’entrent ni dans dist ni dans l’installateur Tauri.

## Ce que la matrice contient

`states.spec.ts` produit **27 images** à partir des onze scénarios de
`src/lab/scenarios.ts`, tous rendus dans `lab-frame.html` :

| Images | Ce qu’elles prouvent |
| --- | --- |
| `short`, `long`, `pending`, `partial`, `error`, `notice` × `-dark` / `-light` | L’overlay dans ses cinq états plus l’avis. Il reste graphite dans les deux : ici, `-dark` et `-light` ne changent que le décor derrière le verre, pour vérifier qu’il se lit sur une page blanche comme sur une page sombre. |
| `actions`, `reading`, `engines`, `privacy` × `-dark` / `-light` | Les quatre pages des Réglages, seule surface qui suit le thème Windows. |
| `history-dark`, `history-light` | Confidentialité avec l’historique activé, défilé sur le groupe « Historique ». Résultats fictifs, jamais de texte source. |
| `menu-dark`, `menu-light` | Le menu ⋯ ouvert sur le verre court. |
| `reader-1920`, `reader-2560` | La bande de lecture à la moitié de deux largeurs d’écran réelles. |
| `actions-narrow` | La navigation repliée en onglets sous 640 px (la fenêtre s’ouvre à 760 × 640, minimum 460 × 420). |

La capsule n’a plus de scénario ni de référence : elle n’est plus affichée depuis le
10 septembre et le design system ne la dessine pas. Elle reste câblée et rendue à la
demande par `lab-frame.html?scenario=capsule`, pour le banc de défauts.

## Le thème vient de `prefers-color-scheme`, plus de `?theme=`

`src/tokens.css` n’a aucun bloc `prefers-color-scheme` : seulement `:root, [data-theme="dark"]`
et `[data-theme="light"]`. La traduction de la préférence système en `data-theme` est faite
par `src/lab/frame.tsx`, qui applique la même règle que `src/main.tsx`. Les références des
Réglages passent donc par `page.emulateMedia({ colorScheme })`, et `?theme=` ne pilote plus
que `data-preview-background`, le décor derrière le verre.

Tant que ce signal n’arrivait pas, `settings-dark.png` et `settings-light.png` étaient le
même fichier au md5 près, comme `history-dark.png` et `history-light.png`.

`frame.tsx` ne pose `color-scheme` que pour les scénarios Réglages. Les fenêtres `overlay`
et `capsule` sont transparentes en natif et rien ne peint leur racine : un `color-scheme`
sombre y remplacerait le canevas transparent par une couleur opaque. `e2e/workbench.pw.ts`
le vérifie dans les deux sens.

## Ces images-ci datent de la 0.4.0

Les 23 PNG présents dans `references/win32/chromium/` ont été relevés avant le portage du
design system, avec les anciens identifiants de scénario (`settings-*`, `capsule-*`,
`settings-narrow`) et sans signal de thème. **Ils ne correspondent plus à la matrice
ci-dessus.** La régénération et la revue image par image sont une opération distincte, faite
après la fusion des unités de la 0.5.0, pas dans une unité : un scénario dont la surface est
encore en 0.4.0 produirait une référence fausse et approuvée.

Premier relevé (0.4.0) : Windows, Chromium fourni par `@playwright/test` 1.63.0,
viewport 900 × 600 (480 × 640 pour la référence étroite), locale `fr-FR`, Europe/Paris,
mouvements réduits, fixtures publiques fictives exclusivement.

Le rendu n’est pas déterministe octet pour octet en travers d’un changement de pilote ou de
fontes : une différence signalée se regarde, elle ne s’écarte pas d’avance par un seuil.

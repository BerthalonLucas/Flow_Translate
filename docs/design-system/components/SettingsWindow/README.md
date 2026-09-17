# SettingsWindow

La fenêtre Réglages : barre de titre maison de 44 px, navigation en quatre pages, contenu qui défile seul.

## Structure
- `TitleBar` : marque 16 px, « FlowTranslate · Réglages », `SaveStatus`, Fermer (survol `close-hover`, Échap). Glisser la barre déplace la fenêtre.
- `SettingsNav` : Actions (`keyboard`), Lecture (`type`), Moteurs (`server`), Confidentialité (`shield-check`) ; en pied Quitter et la version. Page active : `surface-selected` et un trait `signal-ink` de 3 px.
- Page : `PageHeader` (titre `title`, description `body` en `ink-muted`, action principale à droite), puis des `SettingGroup`. Contenu 640 px au plus, marges 24/28/32.

## Largeur
`nav-width` 184 px au-delà de 640 px ; en dessous (container query sur la fenêtre), la navigation devient une rangée d’onglets et les grilles passent sur une colonne. Fenêtre par défaut 760 × 640, minimum 460 × 420.

## Thème
Suit le thème Windows (`prefers-color-scheme`) : thèmes `dark` et `light` des tokens. L’overlay, lui, ne change jamais.

## Remplace
La fenêtre 0.4.0 d’un seul tenant (intertitres en capitales, sections empilées, pied « Enregistré · Quitter »).

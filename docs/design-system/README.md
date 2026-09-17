FlowTranslate transforme une sélection sous Windows 11 par un modèle de langue local : sélectionner, presser le raccourci d’une action (traduire, corriger, professionnaliser, les vôtres), lire le résultat ou le laisser remplacer le texte sur place. L’interface est là pour quelques secondes, puis disparaît. Graphite et surligneur : un matériau sombre qui se lit sur n’importe quelle page, une seule couleur de marque, le jaune d’un marqueur passé sur du texte.

## Principes

- **Le texte d’abord.** Le verre ne contient que le résultat. Pas d’en-tête, pas de pied, pas de barre de défilement visible ; les commandes vivent dans la pilule qui mord son bord.
- **Présent le temps de lire.** Le résultat s’efface au bout du temps de lecture estimé ; survoler, défiler, cliquer ou épingler le retient. Rien n’est modal, rien ne vole le focus.
- **Rien ne saute.** Une fenêtre native ne change pas de taille pendant une interaction : tout mouvement est opacité, transform ou clip-path, avec une durée et une courbe connues.
- **Une couleur qui veut dire quelque chose.** `signal` marque ce que FlowTranslate vient de faire ou ce qui a le focus : l’action, la coche « fait », l’anneau clavier, le bouton principal. Jamais de décoration.
- **Local et explicite.** Les messages disent ce qui se passe et quoi faire ; l’historique est chiffré et désactivé par défaut ; aucun texte de l’utilisateur n’apparaît dans un avis, un journal ou une infobulle.

## Rédaction

- Français, vouvoiement, phrases courtes. Pas de point d’exclamation, pas d’émoji, pas de superlatif.
- Commandes et entrées de menu à l’infinitif, en casse de phrase : « Copier le résultat », « Afficher l’original », « Relancer en Qualité », « Ajouter un raccourci ». Jamais « OK », jamais « Cliquez ici ».
- Statuts au participe ou au nom : « Enregistré », « Connecté · 38 ms », « Échec de connexion », « Non vérifié ». « … » (un seul caractère) pour ce qui est en cours : « Vérification… ».
- Erreurs en deux temps, ce qui s’est passé puis quoi faire : « Le moteur Qualité ne répond pas. Vérifiez qu’il est démarré sur 127.0.0.1:8002. » Jamais le texte brut d’une bibliothèque.
- Typographie française : apostrophe ’, espace insécable avant « : ; ? ! », guillemets « », milliers espacés (12 500 €, 8 000 caractères), unités espacées (42 ms, 16 px), dates absolues « 17 sept. 09:12 ».
- Noms fixes : les actions s’appellent Traduire en français, Traduire en anglais, Corriger, Professionnaliser ; les moteurs Qualité et Rapide ; les pages Actions, Lecture, Moteurs, Confidentialité.

## Couleur

Deux thèmes, `dark` (Sombre, premier) et `light` (Clair), suivent le thème Windows pour les Réglages. L’overlay n’en suit aucun.

- **Overlay, toujours graphite.** Peignez le verre, la pilule, la pilule d’attente, le menu et les avis en `glass` avec un contour `glass-line`. Texte du résultat en `glass-ink`, icônes au repos, étiquette d’action et original en `glass-ink-muted`, étiquette « Original » et indications du menu en `glass-ink-subtle`. Survol `glass-hover`, enfoncé `glass-pressed`. Erreurs et alertes du verre en `glass-danger` et `glass-warning`, jamais en `danger` ou `warning` (qui passent au sombre en thème clair).
- **Surfaces des Réglages.** Fenêtre et navigation `surface`, cartes `surface-raised`, champs `surface-field`, pistes `surface-sunken`. Filets et contours de cartes `line`, contours de champs, de touches et du bouton secondaire `line-strong`, trait bas des champs et contour de l’interrupteur éteint `field-underline`.
- **Texte des Réglages.** `ink` pour les libellés et le contenu, `ink-muted` pour les descriptions, `ink-subtle` pour compteurs et versions, jamais sur `surface-sunken`.
- **Le surligneur.** `signal` en remplissage (bouton principal, piste d’interrupteur activé en sombre, coche « fait », balayage d’attente, tiret de l’étiquette d’action, bande du logo) avec `on-signal` dessus. En texte, icône ou trait sur les surfaces, prenez `signal-ink` : identique en sombre, ambre profond en clair, car le jaune n’a que 1,4:1 sur blanc. Fond teinté : `signal-soft`.
- **Statuts.** `success`, `warning`, `danger` en texte `caption` ou en point de 8 px, toujours avec un mot ou une icône. `danger-soft` derrière un message d’erreur ou au survol d’une suppression. Le bouton Fermer de la barre de titre passe en `close-hover` au survol, comme la légende Windows.
- **Contrastes.** Chaque couple texte/fond cité dans les notes de tokens tient 4,5:1 dans les deux thèmes (le résultat : 13,9:1 sur une page blanche derrière le verre). Contours de champ, anneaux de focus et icônes porteuses de sens tiennent 3:1.

## Typographie

Segoe UI Variable, la police de Windows 11, en trois tailles optiques : `sans` (Text) pour l’interface et le verre court, `display` pour la bande de lecture et les titres de page, `small` pour tout ce qui fait 12 px. `mono` (Cascadia Mono) pour les consignes seulement. Aucun fichier de police n’est livré : ce sont des polices système de Windows ; ailleurs, la pile retombe sur `system-ui`.

- **Lecture.** Verre court `glass-copy` 16/24, `glass-copy-large` 18/27, `glass-copy-xlarge` 20/30 selon « Taille du texte ». Bande `reader-copy` 22/33, 24/36, 26/39. Original `original-copy` deux pixels sous le texte du verre (14/20 en Normale). Ces tailles décident la forme (8 lignes au plus à 380 px) : ne pas les changer sans `src/layout.ts`.
- **Interface.** `title` 20/28 semi-gras pour le titre de page, `heading` 14/20 semi-gras pour un groupe, `label` 14/20 medium pour un libellé de ligne, `body` 13/20, `menu` 13/16 (une entrée de menu fait 32 px), `caption` 12/16 pour descriptions et métadonnées, `tag` 12/16 semi-gras pour touches, badges et étiquette d’action. Rien sous 12 px.
- Pas de capitales ni d’espacement élargi pour les intertitres : casse de phrase et graisse suffisent.

## Espacement, rayons, élévation

- Espacements sur une base 4 : `space-0-5` 2, `space-1` 4, `space-1-5` 6, `space-2` 8, `space-3` 12, `space-4` 16, `space-5` 20, `space-6` 24, `space-7` 28, `space-8` 32, `space-10` 40. Lignes de réglage `space-3` × `space-4`, cartes empilées à `space-2`, groupes à `space-6`, contenu de page 24/28/32.
- Rayons concentriques : un enfant prend le rayon du parent moins sa marge. Menu `radius-xl` 16 et entrées `radius-lg` 12 (marge 4) ; pilule `radius-full` et boutons `radius-lg` ; piste segmentée `radius-md` 8 et segment `radius-sm` 6 ; cartes `radius-lg` ; touches `radius-xs` 4 ; verre `radius-glass` 28.
- Élévation : `shadow-glass` pour le verre (elle remplit exactement le halo natif), `shadow-pill` pour pilules et avis, `shadow-menu` pour le menu, `shadow-card` sous les cartes des Réglages. Pas d’autre ombre, pas de flou d’arrière-plan dans l’application empaquetée (la fenêtre peint seulement le DOM).

## Géométrie contractuelle

La famille `geometry` n’est pas du style : ces valeurs sont partagées avec `src/layout.ts` et le hit-test Rust, qui réservent la fenêtre native une fois par forme. Verre court `glass-width` 380 ; marges du texte `glass-pad-*` 16/22/13 et `reader-pad-*` 18/28/16 ; bande `reader-width` 50 % de la zone de travail ; pilule `pill-height` 28, `pill-inset` 16, `pill-overlap` 14, boutons `pill-button` 24 ; pilule d’attente `wait-pill-width` 60 ; menu `menu-width` 196 (réserve 236 px de haut) ; halo `halo-x` 32, `halo-top` 20, `halo-bottom` 44. Changer l’une d’elles, c’est changer le code natif dans le même lot.

## Mouvement

Une courbe pour tout : `cubic-bezier(.2, 0, 0, 1)`. Sous « réduire les animations » de Windows, tout devient immédiat.

| Moment | Durée | Propriété |
| --- | --- | --- |
| Survol, pression, changement de segment | 120–140 ms | couleur de fond, couleur |
| Entrée d’une surface, pilule qui monte de 4 px | 180 ms, pilule +60 ms | opacité, transform |
| Sortie | 100–120 ms | opacité |
| Ouverture du verre court depuis la pilule | 260 ms, texte 180 ms après 80 ms | clip-path, opacité |
| Bande de lecture | 220 ms, montée de 8 px | opacité, transform |
| Roue d’attente | 1 tour par seconde, linéaire | transform |
| Balayage après 1,5 s | 1 400 ms, en boucle | transform |
| Coche « fait » | éclosion 140 ms, tenue 900 ms (Remplacer), 1,6 s (Copier) | opacité, transform |
| Estompe en fin de lecture | 600 ms vers 55 %, tenue 1,4 s, sortie 300 ms | opacité |
| Indicateur de défilement | visible au survol ou au défilement, s’éteint 800 ms après | opacité |

## États et focus

- Focus clavier : anneau plein de 2 px en `focus` (`signal-ink`) décalé de 2 px dans les Réglages ; en `signal` à l’intérieur du contour sur le verre, décalé de 1 px sur les boutons des pilules (toujours sur du graphite). Jamais d’anneau au clic souris (`:focus-visible`).
- Désactivé : `opacity-disabled` 0,38 sur le contrôle entier, curseur par défaut, pas d’infobulle d’explication sauf si l’action est bloquée par un autre réglage (« Changez d’abord les raccourcis qui l’utilisent »).
- Enfoncé et sélectionné se voient sans couleur de marque : `glass-pressed`, `surface-selected`, `surface-inverse`.

## Iconographie

Lucide (1.43.0, ISC) en trait de 1,75, `currentColor`, aux tailles `icon-sm` 13, `icon-md` 15, `icon-lg` 16 et `icon-spinner` 18 ; le groupe **Icons** contient les 30 icônes du système, copiées depuis `lucide-react` et encrées en `#16171b` pour l’affichage en `<img>`. Chaque action a son pictogramme : `languages` pour traduire, `spell-check` pour corriger, `briefcase-business` pour professionnaliser, `wand` pour une action personnalisée. Pas d’émoji, pas d’icône décorative, pas d’icône sans libellé accessible sur son bouton.

## Marque

Le logo (groupe **Logos**) montre trois lignes de texte dont celle du milieu est passée au surligneur, pointe biseautée comme un marqueur : ce que fait FlowTranslate, en un signe. Tuile `#16171b`, lignes `#eceef1`, bande `#ffd24a`, rayon de tuile 128 sur 512. En zone de notification, jamais la tuile : les glyphes monochromes du groupe **Tray** en 16 px, encre blanche sur barre des tâches sombre et graphite sur barre claire, en trois états (repos, travail, alerte). Nom écrit « FlowTranslate », en un mot, F et T capitales.

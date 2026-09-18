const fs = require('fs');
const dir = __dirname + '/../project/components/';
const R = {
Mark: `# Mark

La marque FlowTranslate : trois lignes de texte, celle du milieu passée au surligneur, avec la pointe biseautée d’un marqueur.

## Usage
- Tuile graphite (\`variant="tile"\`, défaut) : icône d’application, barre de titre des Réglages, installateur.
- Glyphe (\`variant="glyph"\`) : sur une surface claire ou sombre quand une tuile ferait double cadre ; les lignes prennent \`currentColor\`, la bande reste \`signal\`.
- Zone de notification : jamais la tuile en couleur, toujours les SVG monochromes du groupe **Tray** (repos, travail, alerte).

## À fournir
\`size\` en px ; \`title\` seulement quand aucun nom n’est écrit à côté.

## À ne pas faire
- Pas de dégradé, d’ombre ni de reflet sur la tuile.
- Ne pas recolorer la bande : elle est \`signal\` (#ffd24a) partout, sauf en zone de notification où tout est d’une seule encre.
- Sous 16 px, utiliser l’icône de zone de notification, pas la tuile.

Remplace \`src-tauri/icons/mark.svg\` (tuile #1d1f24, trois traits, coche bleue).
`,
Icon: `# Icon

Les icônes de trait Lucide (1.43.0, licence ISC), dessinées en \`currentColor\` avec un trait de 1,75.

## Tailles
- \`icon-sm\` 13 px : croix de la pilule et du menu, chevrons.
- \`icon-md\` 15 px : pilule et menu de l’overlay.
- \`icon-lg\` 16 px : Réglages (navigation, lignes, boutons).
- \`icon-spinner\` 18 px : \`loader-circle\` de la pilule d’attente, trait 2,25, un tour par seconde.

## Règles
- Une icône n’a jamais de nom accessible : le bouton qui la porte en a un.
- Jamais d’émoji, jamais d’icône décorative dans le verre.
- Ajouter une icône : la copier depuis \`lucide-react\` (\`__iconData.node\`), pas la redessiner.
`,
Overlay: `# Overlay

Une session de l’overlay telle que le produit la pose : le verre, la pilule d’actions qui mord son bord haut droit, le menu ⋯ sous la pilule, un retour sous la pilule.

## Quand
Tout résultat d’action affiché : verre court (\`form="short"\`, 8 lignes au plus à 380 px) près de la sélection, bande de lecture (\`form="reader"\`) en bas de l’écran du curseur, pilule seule (\`form="pending"\`) pendant le travail et en mode Remplacer.

## À fournir
- \`children\` : le texte du résultat, ou \`GlassError\` / \`PartialNote\`.
- \`tag\` : le nom court de l’action (\`ExecutionInfo.actionName\`), \`tagTitle\` « Action · moteur ».
- \`menuItems\` quand le menu est ouvert, \`feedback\` pour un \`Notice size="sm"\`.

## Géométrie (contrat natif)
\`glass-width\` 380, \`radius-glass\` 28, \`pill-height\` 28, \`pill-inset\` 16, \`pill-overlap\` 14, \`menu-width\` 196, halo 32/20/44. Ces valeurs vivent aussi dans \`src/layout.ts\` et le hit-test Rust : les changer ici sans y toucher casse le placement.

## Règles
- L’overlay est toujours graphite (\`glass\`), quel que soit le thème Windows.
- Rien ne change de taille pendant une interaction : entrées et sorties sont opacité, transform ou clip-path.
- Le verre ne prend jamais le focus à l’apparition ; Entrée copie quand la lecture a le focus, Échap ferme le menu puis le verre.
`,
Glass: `# Glass

La surface de lecture : du texte seul dans un verre graphite aux coins de 28 px, sans en-tête, sans pied, sans barre de défilement visible.

## Formes
- Court : 380 px, texte \`glass-copy\` (16/24, 18/27, 20/30 selon « Taille du texte »), marges \`glass-pad-*\` 16/22/13, 8 lignes au plus.
- Bande de lecture : moitié de la zone de travail, \`reader-copy\` (22/33 à 26/39) en Segoe UI Variable Display, marges 18/28/16, hauteur au plus 45 % de l’écran, fondus de bord et indicateur 3 px au survol ou au défilement (800 ms).

## Contenu
- Résultat : \`glass-ink\`. Sélection de texte : \`selection\` (le surligneur à 30 %).
- Original : bloc \`glass-raised\` au-dessus, étiquette « Original » en \`glass-ink-subtle\`, texte 14/20 en \`glass-ink-muted\`.
- Erreur : \`GlassError\` — icône \`glass-danger\`, une phrase sur ce qui s’est passé, une phrase sur quoi faire, puis **Réessayer** (puce \`signal\`) et **Réglages**. Plus de « Réglages et Réessayer dans le menu ⋯ ».
- Résultat partiel : \`PartialNote\` sous le texte, icône \`glass-warning\`.

## Mouvement
Ouverture du verre court : clip-path depuis la ligne de la pilule, 260 ms \`cubic-bezier(.2,0,0,1)\`, texte en fondu 180 ms après 80 ms. Bande : montée de 8 px et fondu, 220 ms. Estompe : \`opacity-dimmed\` en 600 ms, tenue 1,4 s, sortie 300 ms.
`,
ActionPill: `# ActionPill

La pilule opaque qui mord le bord haut droit du verre : étiquette d’action, Copier, Épingler (bande de lecture seulement), ⋯, Fermer.

## Nouveau en 1.0
L’étiquette d’action (\`tag\`) dit quelle action a produit le texte, indispensable depuis que plusieurs raccourcis coexistent. Elle commence par un tiret de surligneur (\`signal\`), tronque à 132 px et porte le nom complet et le moteur en \`title\`.

## États
- Copier : coche \`signal\` 1,6 s (« Copié »), sans changer la largeur.
- Épingler : \`aria-pressed\`, fond \`glass-pressed\`, épingle en \`signal\`.
- ⋯ ouvert : \`aria-expanded\`, fond \`glass-pressed\`.
- Copier est désactivé tant que le résultat n’est pas complet.

## Règles
- Boutons de 24 px (\`pill-button\`), icônes 15 px (croix 13), focus \`signal\` 2 px.
- Jamais plus de quatre boutons ; toute autre commande va dans le menu.
- Sans action connue (relecture depuis la zone de notification), ni étiquette ni filet.
`,
WaitPill: `# WaitPill

La pilule seule pendant le travail du moteur, posée là où la pilule d’actions se tiendra (ou en bas au centre pour une source longue).

## États
- En cours : \`loader-circle\` 18 px, un tour par seconde, linéaire (le spinner de shadcn, préfait ; jamais de points qui sautent).
- Lent : après 1,5 s, un balayage \`signal\` de 2 px glisse sous la roue (1 400 ms).
- Fait (mode Remplacer) : coche \`signal\` qui éclot en 140 ms, tenue 900 ms, puis la fenêtre se ferme.

## Règles
60 × 28 px (\`wait-pill-width\`, \`pill-height\`) : la fenêtre native est réservée une fois, la pilule ne change jamais de taille. \`aria-label\` « Traitement en cours » puis « Sélection remplacée ».
`,
OverlayMenu: `# OverlayMenu

Le menu ⋯ du résultat : même graphite que le verre, une icône par entrée, un seul séparateur avant Fermer.

## Entrées, dans cet ordre
1. Afficher / Masquer l’original (\`eye\` / \`eye-off\`)
2. Remplacer (\`clipboard-paste\`), seulement si la sélection est encore valide ; ou Réessayer (\`rotate-ccw\`) après une erreur
3. Relancer en Qualité / Rapide (\`refresh-cw\`)
4. Réglages (\`settings-2\`)
5. Fermer (\`x\`, indication « Échap »), après le séparateur

## Règles
- Six entrées au plus : la réserve native fait 236 px ; une entrée fait 32 px (\`menu\` 13/16 + 8 × 2).
- Sous la pilule pour le verre court, au-dessus pour la bande de lecture ; 196 px de large.
- Libellés à l’infinitif, sans point ni points de suspension. Entrée désactivée à \`opacity-disabled\`.
- Clavier : flèches, Entrée, Échap ; l’entrée active prend la surbrillance \`glass-hover\`.
`,
Notice: `# Notice

Un message dans une pilule graphite : seul en bas de l’écran du curseur quand il n’y a rien à traiter, ou petit sous la pilule comme retour d’une action.

## Tailles
- \`md\` : avis seul, fenêtre native 420 × 64, jamais cliquable, 4 s.
- \`sm\` : retour d’action sous la pilule (copie refusée, collage impossible), 3 s ; caché quand le menu est ouvert.

## Tons
\`info\` (icône \`glass-ink-muted\`), \`success\` (coche \`signal\`), \`warning\` (\`glass-warning\`), \`danger\` (\`glass-danger\`, \`role="alert"\`). Le ton est toujours doublé d’une icône et d’un mot.

## Rédaction
Une phrase sur ce qui se passe, puis quoi faire : « Collage impossible ici. Copiez le résultat. » Jamais le texte de l’utilisateur dans un avis.
`,
SettingsWindow: `# SettingsWindow

La fenêtre Réglages : barre de titre maison de 44 px, navigation en quatre pages, contenu qui défile seul.

## Structure
- \`TitleBar\` : marque 16 px, « FlowTranslate · Réglages », \`SaveStatus\`, Fermer (survol \`close-hover\`, Échap). Glisser la barre déplace la fenêtre.
- \`SettingsNav\` : Actions (\`keyboard\`), Lecture (\`type\`), Moteurs (\`server\`), Confidentialité (\`shield-check\`) ; en pied Quitter et la version. Page active : \`surface-selected\` et un trait \`signal-ink\` de 3 px.
- Page : \`PageHeader\` (titre \`title\`, description \`body\` en \`ink-muted\`, action principale à droite), puis des \`SettingGroup\`. Contenu 640 px au plus, marges 24/28/32.

## Largeur
\`nav-width\` 184 px au-delà de 640 px ; en dessous (container query sur la fenêtre), la navigation devient une rangée d’onglets et les grilles passent sur une colonne. Fenêtre par défaut 760 × 640, minimum 460 × 420.

## Thème
Suit le thème Windows (\`prefers-color-scheme\`) : thèmes \`dark\` et \`light\` des tokens. L’overlay, lui, ne change jamais.

## Remplace
La fenêtre 0.4.0 d’un seul tenant (intertitres en capitales, sections empilées, pied « Enregistré · Quitter »).
`,
SettingRow: `# SettingRow

Une ligne de réglage : libellé \`label\`, description \`caption\` en \`ink-muted\`, contrôle aligné à droite ; groupées dans une carte par \`SettingGroup\`.

## À fournir
\`label\`, \`description\` (une phrase courte), un contrôle en enfant : \`Segmented\`, \`Switch\` ou un \`Button size="sm"\`. \`icon\` seulement quand la ligne ouvre un sujet (Historique).

## Règles
- Hauteur 56 px au moins ; filet \`line\` entre deux lignes, jamais autour.
- Un changement s’enregistre aussitôt (interrupteurs, segments) ou 300 ms après la frappe : pas de bouton Enregistrer.
- Sous 640 px, le contrôle passe sous le texte.
`,
Button: `# Button

Les boutons des Réglages : \`primary\` (un par page au plus, \`signal\` + \`on-signal\`), \`secondary\` (champ + contour), \`ghost\` (texte), \`danger\` (texte \`danger\`, survol \`danger-soft\`) ; \`IconButton\` pour une icône seule.

## Tailles
\`md\` 32 px (\`control-md\`), \`sm\` 28 px (\`control-sm\`) dans les cartes et les lignes.

## Règles
- Libellé à l’infinitif : « Vérifier », « Ajouter un raccourci », « Supprimer l’action ». Jamais « OK ».
- En cours : désactiver et changer le libellé (« Vérification… »), pas de spinner dans un bouton principal.
- \`IconButton\` exige \`label\` (nom accessible et infobulle).
- Focus : anneau \`focus\` 2 px à 2 px du bord.
- Dans le verre, utiliser les puces de \`GlassError\`, pas \`Button\`.
`,
Segmented: `# Segmented

Un choix parmi deux à quatre options courtes, enregistré dès le clic : Taille du texte, Fermeture automatique, Moteur par défaut, Afficher / Remplacer.

## À fournir
\`label\` (nom du groupe radio), \`value\`, \`options\` (libellés d’un ou deux mots), \`onChange\`. \`size="sm"\` dans une ligne de raccourci.

## Règles
- Piste \`surface-sunken\`, segment choisi \`surface-inverse\` / \`on-inverse\` avec \`shadow-thumb\` ; graisse constante (500) pour que rien ne saute.
- Flèches gauche et droite changent la valeur ; un seul arrêt de tabulation.
- Plus de quatre options ou des libellés longs : une liste (\`SelectField\`).
`,
Switch: `# Switch

Un interrupteur 40 × 20 à la manière de Windows 11, pour un réglage qui prend effet aussitôt.

## États
- Désactivé : contour \`field-underline\`, pouce \`ink-muted\` réduit, qui grossit au survol.
- Activé : piste \`switch-on\` (surligneur en sombre, encre en clair), pouce \`switch-on-thumb\`.

## Règles
\`label\` obligatoire (le libellé visible de la ligne). Pas pour une action ponctuelle (un bouton) ni pour plus de deux états (\`Segmented\`).
`,
TextField: `# TextField

Champ de saisie des Réglages, avec \`SelectField\` pour une liste : fond \`surface-field\`, contour \`line-strong\`, trait bas \`field-underline\` qui passe à \`focus\` au focus.

## À fournir
\`label\` visible au-dessus (jamais un simple placeholder), \`value\`, \`onChange(value)\` ; \`hint\` pour une aide d’une ligne, \`error\` pour un refus (icône \`triangle-alert\`, texte \`warning\`).

## Règles
- Adresse de moteur : \`type="url"\`, exemple en placeholder. Clé API : \`type="password"\`, \`autoComplete="new-password"\`, mention « Chiffrée par Windows (DPAPI) ».
- Enregistrement 300 ms après la dernière frappe ; l’erreur apparaît sous le champ, jamais dans une boîte.
- Deux champs côte à côte (\`ft-grid-2\`) passent l’un sous l’autre sous 640 px.
`,
TextArea: `# TextArea

La zone de consigne d’une action : chasse fixe (\`prompt\`, Cascadia Mono 12/18), redimensionnable en hauteur, compteur de caractères sur 8 000.

## À fournir
\`label\`, \`value\`, \`onChange\`, \`hint\` ; \`error\` quand la consigne est vide ou trop longue (le compteur reste visible).

## Règles
Pas de correcteur orthographique (\`spellCheck=false\`) : la consigne est souvent en anglais pour les petits modèles. Le texte sélectionné n’apparaît jamais dans cette zone.
`,
Keycaps: `# Keycaps

Un raccourci clavier en touches : \`Ctrl\` \`Alt\` \`T\`, avec « +1 » quand l’action a d’autres raccourcis actifs.

## États
- \`idle\` : touches \`surface-field\`, contour \`line-strong\`, relief \`shadow-keycap\`, style \`tag\` 12/16.
- \`recording\` : « Pressez la combinaison… » en \`signal-ink\` sur \`signal-soft\`, contour 1 px ; Échap annule.
- \`empty\` : « Sans raccourci » en \`ink-subtle\`.

## Règles de capture (inchangées)
Ctrl ou Alt requis ; Windows, AltGr, F12 et les combinaisons système refusés avec un message \`warning\` sous la ligne. Disposition respectée (AZERTY : lettres virtuelles).
`,
StatusBadge: `# StatusBadge

L’état d’un moteur en point et en mot (Connecté · 38 ms, Vérification…, Échec de connexion, Non vérifié), et \`Badge\` pour une étiquette (Par défaut, Prédéfinie).

## Règles
- Le point n’est jamais seul : le mot porte l’information (daltonisme, lecteurs d’écran).
- \`success\` et \`danger\` en \`caption\` ; \`checking\` remplace le point par \`loader-circle\` 12 px.
- \`Badge tone="signal"\` (\`signal-soft\` / \`signal-ink\`) seulement pour « Par défaut » ; le reste en neutre.
`,
Callout: `# Callout

Une note de page ou un message d’erreur de réglage, dans un bloc \`surface-sunken\` (info) ou \`danger-soft\` (erreur) avec une icône.

## Règles
- Une ou deux phrases ; un nom de page ou de réglage en \`strong\`.
- Jamais de bordure colorée à gauche, jamais de titre.
- Pour une erreur de champ, préférer \`error\` sous le champ ; le Callout sert aux erreurs d’un bloc (connexion d’un moteur).
`,
SaveStatus: `# SaveStatus

L’état de l’enregistrement automatique, à droite de la barre de titre : Enregistré, Enregistrement…, Enregistré à l’instant (3 s), Non enregistré · Réessayer.

## Règles
- \`aria-live="polite"\` ; l’erreur passe en \`role="alert"\` avec le lien Réessayer (\`signal-ink\`, souligné).
- Fermer la fenêtre enregistre d’abord ; en cas d’échec, la fenêtre reste ouverte et l’erreur s’affiche.
`,
ActionRow: `# ActionRow

Une action (Traduire, Corriger, Professionnaliser, les vôtres) en carte : pictogramme, nom, résumé, raccourci ; un clic la déplie sur place en éditeur.

## En-tête
Tuile \`surface-sunken\` 32 px avec l’icône de l’action (\`languages\`, \`spell-check\`, \`briefcase-business\`, \`wand\` pour une action personnalisée), nom en \`label\`, badge « Par défaut », résumé « Prédéfinie · Remplace la sélection » en \`caption\`, \`Keycaps\` du premier raccourci actif, chevron.

## Éditeur (enfants à fournir)
1. \`TextField\` Nom (60 caractères).
2. Raccourcis : un \`ShortcutBinding\` par combinaison (interrupteur, touches + Modifier, \`Segmented\` Afficher / Remplacer, supprimer), puis « Ajouter un raccourci ».
3. \`TextArea\` Consigne.
4. Pied : Rétablir la consigne (prédéfinie), Définir par défaut, Supprimer l’action (\`danger\`, désactivé tant qu’un raccourci ou le défaut l’utilise).

## Pourquoi
En 0.4.0, actions et raccourcis vivaient dans deux sections : on ne voyait pas quel raccourci lançait quoi. Ici, un raccourci appartient à son action ; le modèle de données (\`shortcutBindings[].actionId\`) ne change pas.
`,
EngineCard: `# EngineCard

Un profil de moteur (Qualité, Rapide) : nom, badge Par défaut, état de connexion, Vérifier, puis Adresse, Modèle et Clé API.

## À fournir
\`name\`, \`status\` (\`unknown\`, \`checking\`, \`ok\` avec \`latency\`, \`error\` avec \`message\`), les trois valeurs et leurs \`on*\`, \`onCheck\`.

## Règles
- Toute modification remet l’état à « Non vérifié ».
- \`http://\` seulement sur 127.0.0.1 ; sinon \`https://\` (erreur sous le champ).
- Le message d’échec dit quoi faire : « Aucune réponse de 127.0.0.1:8001. Démarrez le serveur, puis vérifiez. » Jamais le texte brut de reqwest.
- La clé n’est jamais réaffichée en clair après enregistrement.
`,
HistoryList: `# HistoryList

Les derniers résultats enregistrés (historique chiffré, sur activation) : texte sur une ligne, « Action · Moteur · date », suppression unitaire, Tout supprimer, état vide.

## À fournir
\`entries\` déjà formatées (\`text\` = le résultat, \`meta\` avec une date absolue \`fr-FR\` « 17 sept. 09:12 »), \`onRemove(id)\`, \`onClear\`.

## Règles
- Visible seulement quand « Conserver l’historique chiffré » est activé.
- Jamais le texte source ; ni recherche ni export.
- Tout supprimer n’ouvre pas de confirmation modale : l’action est nommée clairement, placée à part, en \`danger\`.
`,
SettingsScreen: `# SettingsScreen

L’écran Réglages complet et navigable : Actions (cartes d’action et raccourcis), Lecture (aperçu vivant du verre), Moteurs (profils et vérification), Confidentialité (historique, démarrage).

Page de démonstration composée avec \`SettingsWindow\`, \`PageHeader\`, \`SettingGroup\`, \`SettingRow\`, \`ActionRow\`, \`ShortcutBinding\`, \`EngineCard\` et \`HistoryList\`. Chaque modification simule l’enregistrement automatique dans la barre de titre.
`,
OverlayScenes: `# OverlayScenes

Les parcours de l’overlay image par image : Afficher (attente, balayage, ouverture, estompe), Remplacer (attente, coche, disparition, repli si le collage échoue), bande de lecture épinglée et avis seul.

Page de démonstration : les proportions sont réduites, les durées sont celles du produit (section Parcours).
`,
};
for (const [name, text] of Object.entries(R)) { fs.mkdirSync(dir + name, { recursive: true }); fs.writeFileSync(dir + name + '/README.md', text); }
console.log(Object.keys(R).length, 'READMEs');

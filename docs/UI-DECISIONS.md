# Décisions UI de Lucas — 9 septembre 2026

Ce document remplace les choix contradictoires des maquettes précédentes.

Depuis le 24 septembre 2026, la direction artistique « Îlot » (docs/DA-PLAN.md, référence visuelle design-lab/) remplace les passages marqués « historique » ci-dessous. Les décisions les plus récentes sont en fin de document.

- Sélection → Ctrl+Alt+T → traduction immédiate vers la langue préconfigurée. Aucune copie manuelle, aucune confirmation supplémentaire. En absence de sélection accessible, la copie est faite par FlowTranslate lui-même (Ctrl+Insert synthétique, presse-papiers restauré) ; une copie faite soi-même moins de 3 s avant reste acceptée ; sinon message discret, jamais modal (décisions du 14 septembre 2026, qui remplacent « aucun envoi automatique du presse-papiers »). (Historique pour Ctrl+Alt+T et la traduction immédiate : remplacés par le menu Îlot sur Ctrl+Alt+Espace de la DA du 24 septembre 2026, docs/DA-PLAN.md. La copie synthétique en repli reste valable.)
- Capsule minuscule au repos. Au survol : langue cible, traduction de la sélection à la souris, menu. Le raccourci reste indépendant de ces commandes. (Historique : la fenêtre capsule est retirée par la DA Îlot du 24 septembre 2026, docs/DA-PLAN.md §4.2.)
- Capsule déplaçable, aimantation aux bords, position mémorisée ; position initiale en bas au centre. (Historique, même raison.)
- Traduction courte près de la sélection : texte seul, petite capsule d’actions satellite légèrement superposée. Depuis le 14 septembre 2026, le résultat s’efface de lui-même au bout du temps de lecture estimé (puis fondu), vite (≈ 3–4 s) une fois la souris partie après une visite ; un clic, la molette ou une touche le retiennent ; réglable (Rapide, Normale, Lente, Jamais). Cette décision remplace « visible jusqu’au clic extérieur ou Échap ». (Historique pour la forme : la bulle graphite est remplacée par la DA Îlot du 24 septembre 2026, docs/DA-PLAN.md. Le comportement est gardé par le mode « Afficher le résultat », restylé, lot 11 du plan.)
- Traduction longue : bande de lecture en bas au centre, décidée d’office sur le vrai texte (plus de « Agrandir »), large de la moitié de la zone de travail de l’écran courant, jamais une valeur d’écran en dur, toujours en bas et fixe ; molette et barre discrète pendant le défilement ; épinglable. La bande se place sur l’écran de la souris et la suit d’un écran à l’autre. Taille du texte à trois présélections dans les Réglages (14 septembre 2026). (Historique comme forme principale : depuis la DA Îlot du 24 septembre 2026, la bande de lecture n’est plus centrale ; elle est gardée et restylée, comportement inchangé, lot 11 de docs/DA-PLAN.md.)
- Fenêtre principale : réglages et anciennes traductions. Suit le thème Windows. Capsule sombre. Historique local chiffré et explicitement activable, sans journalisation du contenu. (Historique pour « Capsule sombre » : capsule retirée, docs/DA-PLAN.md §4.2. Le reste est valable.)
- Visuel : très compact, arrondis et contours fins, transparence discrète. La vidéo Wispr est une référence d’interaction ; ses saccades d’enregistrement ne mesurent pas les animations du produit.
- Travail principal sans sous-agents. Lucas autorise séparément Claude Code avec Fable 5.1 pour une tâche frontend bornée ou une variante dans sa propre branche. Disponibilité du modèle à vérifier avant utilisation ; aucun lancement pour ce jalon. (Ne s’applique pas à la passe autonome du 24 septembre 2026 : dérogation, décision 9 de la dernière section.)
- Poser uniquement les questions nécessaires ; après une question, attendre sa réponse sans poursuivre la conversation.

Les choix ci-dessus sont validés comme direction. Ils ne décrivent pas des fonctions déjà implémentées.

# Décisions de Lucas — 15 septembre 2026 (0.4.0)

- FlowTranslate n’est plus « juste traduire » : un raccourci = une action sur la sélection (Corriger, Traduire en français, Traduire en anglais, Professionnaliser, actions à créer), chacune avec sa consigne modifiable. La priorité absolue : sélectionner un texte déjà écrit (Ctrl+A), presser le raccourci « Corriger », le texte corrigé remplace la sélection sur place, dans n’importe quelle zone de texte (mail, barre de recherche, champ web, éditeur), comme Wispr Flow.
- Base `main` (0.3.0) ; les briques de la PR 6 (garde du presse-papiers, corde Ctrl+V) sont reprises, mais la relecture du document est un bonus, jamais une condition du collage. La PR 6 reste à fermer par Lucas.
- La langue cible vit dans la consigne : plus de réglage « Langue cible », plus de variable `{{targetLanguage}}` ; deux actions de traduction par défaut. (Historique pour les deux actions de traduction : la DA Îlot du 24 septembre 2026 prévoit une seule action Traduire, FR↔EN, docs/DA-PLAN.md §1. La langue reste dans la consigne.)
- Mode « Remplacer la sélection » : la pilule seule pendant le travail, le collage à la fin, la pilule s’efface ; le verre ne s’ouvre qu’en cas d’échec du collage (résultat + Copier). (Historique : remplacé par la pilule Perle, le balayage de lumière, la coche, Annuler et les mots changés de la DA Îlot du 24 septembre 2026, lots 8 et 9 de docs/DA-PLAN.md ; en cas d’échec, pilule d’erreur et résultat à copier, lot 10.)
- Consignes limpides pour de petits modèles sans réflexion (réflexion coupée par `enable_thinking: false`) ; modèle d’essai Gemma 4 12B QAT avec décodage spéculatif (profil `general` du serveur).
- L’UI des menus et des Réglages (« à la zeub ») est un autre chantier.

# Décisions de Lucas — 23 septembre 2026

- Direction produit : un raccourci Ctrl+Alt ouvre un petit menu d’actions juste après la sélection (Corriger, Traduire, Professionnaliser…) ; l’action choisie remplace le texte sélectionné. (Raccourci retenu par défaut : Ctrl+Alt+Espace, décision 1 de la dernière section.)
- Critère premier : la rapidité. Réponses attendues entre 0,4 s et 4 s au plus.
- Langue de l’interface : français et anglais complets, anglais préféré (libellés, menus, états).
- Chargement : un indicateur seul, sans texte, qui n’agrandit pas la pilule à côté de la sélection. Trois points qui sautent de façon fluide suffisent. Le spinner lucide (`WaitSpinner`) et le balayage après 1,5 s (`.wait-pill[data-slow]::after`) sont rejetés. (Historique pour les trois points : remplacés par l’orbe Perle le 24 septembre 2026, lot 8 de docs/DA-PLAN.md. Le rejet du spinner et du balayage de la pilule reste valable.)
- Endpoints : plusieurs modèles avec des paramètres différents (niveaux de réflexion réglables, etc.) devront rester modifiables. Sujet mis de côté pour l’instant.
- UI jugée brute et peu fluide (couleurs, bulles, interactions). Vocabulaire commun proposé dans le « Lexique visuel » (page publiée, codes A/E/D/T/M) avant de choisir.
- Le plan d’UI rédigé au travail (GitLab) sera fourni par Lucas avant la refonte.

## Compléments du 23 septembre 2026 (réponses aux questions du labo)

- Diagnostic : l’option Windows « Effets d’animation » était désactivée sur le PC de Lucas. L’app respecte ce réglage (`useReducedMotion`, `glass.css`), donc aucune animation n’était visible. Réglage réactivé ; une option « Animations : suivre Windows / toujours / réduites » est à prévoir.
- Chargement : préférence pour la « respiration » des trois points, mais chercher plus petit et plus élégant. (Historique pour les trois points : orbe Perle retenu le 24 septembre 2026.) Piste très appréciée : aucune bulle de chargement, le texte sélectionné lui-même scintille ou s’illumine (façon Writing Tools d’Apple), ou un indicateur minuscule.
- Menu Ctrl+Alt : le plus d’options possibles dans le moins d’affichage. Au repos, un ou deux éléments au plus ; on découvre le reste en explorant ; champ de consigne libre rapide (« mail pour un collègue, plus sympa »). Pas de listes classiques. Tester 5 à 10 formes vraiment différentes.
- Déclenchement : raccourci clavier par défaut ; option pour afficher un petit déclencheur à chaque sélection. (Option reportée : décision 5 de la dernière section.)
- Actions de démonstration : Corriger, Traduire (FR↔EN en une seule action), Rendre professionnel, Raccourcir, Rédiger un mail, Consigne libre. Icônes seulement si elles sont fines, jolies et immédiatement lisibles ; sinon pas d’icônes.
- Après remplacement : coche, Annuler et surlignage des mots changés, chacun activable dans les Réglages. Tout doit être personnalisable.
- Erreurs : visibles et claires. Erreur de configuration (endpoint, clé API, droits, nom du modèle) → bouton qui ouvre directement le bon champ des Réglages ; erreur hors de contrôle → message sans renvoi.
- La traduction longue en bande de lecture n’est plus centrale. La bulle actuelle est jugée « pâtée », peu jolie.
- Thème : clair, suit Windows, matière transparente type verre ; référence visuelle Apple Intelligence. Vrai verre (Acrylic Windows) souhaité si fonctionnel et net. (Matière retenue par défaut : décision 3 de la dernière section.)
- Labo : préréglages plus réglages fins (durées, courbes, ralenti, recentrage) ; interface du labo en français ; app par défaut en anglais avec bascule français.

# Choix de Lucas dans le labo — 24 septembre 2026

- Menu Ctrl+Alt : **Îlot** (dernière action + pastille de consigne ; grille de tuiles en dépliant).
- Indicateur : orbe **Perle** ou **Nébuleuse** ; dans les lignes, **Ruban** plutôt que Sinus.
- Icônes : **Lucide** (trait fin).
- Matière : **verre Apple clair** en thème clair, **verre sombre** en thème sombre ; suit le thème de l’appareil.
- Le surlignage bleu pendant le travail est rejeté : l’effet doit porter sur le texte lui-même, sur la sélection exacte (au mot près, pas le paragraphe).
- Contrainte technique relevée : FlowTranslate ne peut pas redessiner les lettres d’une autre application. Seuls les effets dessinés par-dessus les lignes sélectionnées sont faisables (balayage de lumière, lueur, contour, soulignement, voile), et seulement là où l’application expose sa sélection (UI Automation) ; sinon la pilule seule. Même limite pour l’arrivée du texte : collage d’un coup, un voile qui s’efface ou un surlignage des mots changés restent faisables, pas le mot à mot flou.
- Suite du 24 septembre : balayage de lumière retenu pour la sélection pendant le travail ; mouvement Apple « smooth » (ou « bouncy ») ; les mots changés restent surlignés tant que l’annulation est possible (8 s par défaut), puis s’effacent ; la pilule ne recouvre jamais le texte modifié (repositionnée après le remplacement, option « dans la marge »).
- Correctif de centrage : pendant la transformation (menu → pilule), le contenu reste centré dans la forme qui se redimensionne.

# Plan de la nouvelle DA — 24 septembre 2026

- Le plan GitLab du travail est abandonné au profit de `docs/DA-PLAN.md` (plan complet, lots, accrocs, valeurs exactes, ce qui a été écarté).
- Point encore ouvert : le raccourci du menu (recommandation Ctrl+Alt+Espace, à cause du conflit Ctrl+Alt = AltGr sur AZERTY). Autres questions ouvertes : §8 du plan. (Tranchés par défaut le 24 septembre 2026, à confirmer par Lucas : section suivante.)
- Précision : le balayage de lumière s’ajoute à la pilule (réglage « les deux » du labo), il ne la remplace pas.

# Décisions par défaut de la passe autonome du 24 septembre 2026 — à confirmer par Lucas

La passe autonome qui implémente docs/DA-PLAN.md sur la branche `da-ilot` ne doit pas s’arrêter sur les questions ouvertes du §8 du plan ni sur quelques points d’exécution. Ils sont tranchés par défaut ci-dessous ; chacun reste à confirmer par Lucas. Les écarts au plan constatés pendant l’implémentation sont consignés dans docs/DA-RAPPORT.md.

1. Raccourci du menu : Ctrl+Alt+Espace (chaîne `Ctrl+Alt+Space` dans les réglages). Aucune combinaison Ctrl+Alt+lettre n’est proposée par défaut : sur AZERTY, Ctrl+Alt est AltGr.
2. Annuler : option A par défaut. Ctrl+Z est envoyé à l’application source, après revalidation que la source est au premier plan et que le texte collé est en place ; Annuler est retiré dès que l’utilisateur tape dans la source. L’option B (resélectionner le nouveau texte et recoller l’original, avec la même revalidation) est proposée dans les Réglages.
3. Matière : la phase A du lot 12 (verre peint, opacité relevée) est livrée par défaut. La phase B (vrai Acrylic Windows) est un essai derrière un réglage caché, désactivé par défaut, accompagné de captures et d’un constat écrit pour la décision de Lucas. Essai fait le 24 septembre 2026 : constat, coûts mesurés et recommandation (garder le verre peint) dans docs/ACRYLIC-TRIAL.md.
4. Mode « Afficher le résultat » et traduction longue : restylés dans la nouvelle DA, comportement inchangé.
5. Mode « point à chaque sélection » : reporté ; ni implémenté ni affiché dans les Réglages.
6. Grille de l’Îlot : 3 × 2 tuiles, sans seconde page. Les actions du menu remplissent les tuiles dans l’ordre choisi par l’utilisateur (6 au plus) ; tant qu’il y en a moins de 6, la dernière tuile est « Consigne libre », comme dans le labo (Fix, Translate, Pro, Shorten, Email, Ask). La consigne libre reste toujours accessible par la pastille de l’état compact, Espace, « / » ou une lettre non attribuée. Les actions au-delà des 6 premières restent disponibles par un raccourci direct. (Écart au lot 7 du plan, qui prévoyait une sixième tuile « Plus » ouvrant une seconde page.)
7. Mouvement : préréglage Apple « smooth » par défaut, « bouncy » en option dans les Réglages.
8. Langue de l’app : anglais par défaut, français par bascule. Les noms des actions par défaut ne sont traduits qu’à leur création ; une action existante ou personnalisée n’est jamais renommée.
9. Dérogation : pour cette mission, Lucas a explicitement autorisé les workflows et les sous-agents. La ligne d’AGENTS.md qui demande de travailler sans sous-agents ne s’applique pas à cette passe. Le front indépendant (lots 1, 2, 7, 8 et 13) peut avancer en parallèle dans des worktrees séparés ; les lots natifs (3, 4, 5, 6, 9 et 10 côté Rust, 12 phase B) restent séquentiels, avec un seul propriétaire ; l’intégration et la validation se font sur `da-ilot`.
10. Validation par jalon sans attendre Lucas : chaque jalon se termine par ses preuves (tests, vraie fenêtre, captures), la branche `da-ilot` est poussée, puis le jalon suivant démarre. Pas de fusion dans `main`, pas de tag. (Écart au §7 du plan, qui prévoyait de montrer chaque jalon à Lucas avant le suivant.)
11. Isolation des tests : lancé depuis `src-tauri\target\release\`, l’exécutable de test partagerait sinon le dossier de données de l’app installée de Lucas (`%APPDATA%\com.flowtranslate.desktop` : `settings.json` et historique). La variable d’environnement `FLOWTRANSLATE_DATA_DIR` redirige ce dossier ; tous les lancements de test de cette passe l’utilisent.
12. Matière sombre de la phase A : le labo n’a pas de préréglage sombre opaque ; la valeur retenue (fond `rgb(28 30 34 / .86)`) vient du plan (§9) et reste à valider par Lucas sur capture. En clair, la phase A reprend le préréglage « Clair sans transparence » du labo (`opaque-light` de `design-lab/src/data.js`).
13. La nouvelle fenêtre native qui dessine le balayage et le surlignage s’appelle `halo`, comme dans le plan ; la constante de marge d’ombre de `src/layout.ts`, qui s’appelait aussi `halo`, est renommée pour éviter la confusion.

# Retours de Lucas sur la 0.5.0 d’essai — 24 septembre 2026

Essai de l’installateur 0.5.0 d’essai avec le vrai serveur. Verdict : « c’est vraiment bien ». À faire avant la sortie 0.5.0 :

- Survol de la bulle compacte : seule sa zone de droite, la ✦, déplie la grille (après 450 ms). La zone de gauche, la dernière action, ne réagit pas au survol.
- Sens d’ouverture : la grille s’ouvre à droite de là où était la bulle quand il y a la place, à gauche près du bord de l’écran (aujourd’hui toujours à gauche).
- Mise à jour depuis la 0.4 : ne plus mêler l’ancien et le nouveau (actions en français et en anglais, `Ctrl+Alt+T` en « Afficher le résultat », menu sur un raccourci déjà pris). Les actions livrées jamais modifiées sont remplacées ; un bouton « Rétablir les réglages par défaut ».
- Raccourci du menu déjà pris : en proposer un autre au premier lancement.
- Mis en œuvre le 25/09, choix par défaut à confirmer par Lucas :
  - « jamais modifiée » = identique au caractère près à ce que la 0.4 livrait (nom, consigne, aucun ajout). « Corriger » et « Professionnaliser » intacts deviennent Fix grammar et Make professional ; « Traduire en français » et « Traduire en anglais » intacts partent, sauf si un raccourci gardé ou l’action par défaut choisie les lance encore. `Ctrl+Alt+T` tel que livré (traduction en français affichée) part ; un raccourci modifié ou créé reste.
  - « Rétablir les réglages par défaut » (dernière ligne de « Sur cet appareil », confirmée sur place) remet tout comme à l’installation, actions et raccourcis personnels compris, et oublie la dernière action par application. Restent : la connexion (adresses, modèles, clés, profil par défaut), l’historique, le lancement à l’ouverture de session et la langue de l’interface. Si Windows refuse `Ctrl+Alt+Espace` (tenu par une autre application), le menu garde son raccourci et la ligne le dit.
  - Raccourci pris : la ligne du menu propose le premier libre parmi `Ctrl+Alt+Maj+Espace`, `Alt+Maj+Espace` et `Ctrl+Alt+Origine`, à prendre d’un clic. Jamais `Ctrl+Maj+Espace` : Word y met l’espace insécable.
- Mise en valeur du texte, chantier à part entière : la sélection montrée à trois niveaux (zone de texte, lignes, texte exact) ; des effets « à la Apple Intelligence » dessinés par-dessus le texte ; les mots changés surlignés jusqu’à la prochaine action dans le texte (frappe, clic, défilement), 60 s au plus, durée réglable, sans dépendre d’Annuler ; jolis en clair et en sombre sans cacher le texte. Prototypes montrés à Lucas avant de coder.
  - Prototypes prêts le 25/09, **en attente de son choix** : `design-lab/mise-en-valeur.html` (publiée en privé, lien dans `design-lab/README.md`). Une variante par étape : menu ouvert (zone de texte, lignes, texte exact), travail (5 effets sur le texte exact ; rien, liseré ou aurore sur la zone), arrivée (fondu, vague, éclat), mots changés (6 dessins, durée au plus, intensité). Mes propositions au départ : les trois niveaux au menu, balayage + aurore au travail, vague à l’arrivée, soulignement dégradé pour les mots changés.
  - Réponses de Lucas le 25/09 : les effets choisissent leur version claire ou sombre d’après le **fond lu sous le texte** (quelques pixels autour de la sélection à la capture, rien d’enregistré), pas d’après le thème de Windows. Rien n’est codé avant son choix de variantes, pas même la partie sans dessin. Les petits défauts relevés à la preuve (infobulle de la zone de notification en français sous une interface anglaise, actions par défaut toujours en anglais) attendent qu’il ait testé.
  - **Choix de Lucas le 25/09** : menu ouvert = zone de texte (liseré) + lignes (bande pâle) + texte exact (calque) ; travail = **reflet sur les lettres** (voile de la couleur du fond lu) + **aurore** sur la zone de texte + lignes gardées ; arrivée = **vague de lumière** ; mots changés = **lueur irisée**, jusqu’à la prochaine action, 60 s au plus ; intensités ×1. La lueur irisée était trop pâle sur fond clair : en clair elle prend des teintes plus profondes et plus denses (`--ir1…4`, `.30`, lueur `.32`), le sombre garde ses pastels ; prototype mis à jour et republié. Pour ne pas le rouvrir : si le choix de variantes change, mettre à jour les valeurs de départ de `design-lab/mise-en-valeur.html`.
  - Implémenté le 25/09 (branche `da-ilot-mev`) : la capture UI Automation garde la zone de texte, les lignes entières et la couleur du fond (`ground.rs`, quelques pixels, rien d’enregistré) ; le halo s’affiche dès le menu, passe au travail sans délai, puis vague et lueur irisée ; les marques finissent à la prochaine touche, au prochain clic ou à la molette (crochet souris posé seulement pendant qu’elles s’affichent), quand le texte bouge ou défile, ou après « Highlight time » (15 s, 30 s, 1 min par défaut, 2 min), indépendamment d’Annuler et de la pilule ; `clear_highlight` retiré. Détail : docs/BRIDGE.md, « Îlot: the halo window ».

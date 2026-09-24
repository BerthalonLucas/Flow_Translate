# Décisions UI de Lucas — 9 septembre 2026

Ce document remplace les choix contradictoires des maquettes précédentes.

- Sélection → Ctrl+Alt+T → traduction immédiate vers la langue préconfigurée. Aucune copie manuelle, aucune confirmation supplémentaire. En absence de sélection accessible, la copie est faite par FlowTranslate lui-même (Ctrl+Insert synthétique, presse-papiers restauré) ; une copie faite soi-même moins de 3 s avant reste acceptée ; sinon message discret, jamais modal (décisions du 14 septembre 2026, qui remplacent « aucun envoi automatique du presse-papiers »).
- Capsule minuscule au repos. Au survol : langue cible, traduction de la sélection à la souris, menu. Le raccourci reste indépendant de ces commandes.
- Capsule déplaçable, aimantation aux bords, position mémorisée ; position initiale en bas au centre.
- Traduction courte près de la sélection : texte seul, petite capsule d’actions satellite légèrement superposée. Depuis le 14 septembre 2026, le résultat s’efface de lui-même au bout du temps de lecture estimé (puis fondu), vite (≈ 3–4 s) une fois la souris partie après une visite ; un clic, la molette ou une touche le retiennent ; réglable (Rapide, Normale, Lente, Jamais). Cette décision remplace « visible jusqu’au clic extérieur ou Échap ».
- Traduction longue : bande de lecture en bas au centre, décidée d’office sur le vrai texte (plus de « Agrandir »), large de la moitié de la zone de travail de l’écran courant, jamais une valeur d’écran en dur, toujours en bas et fixe ; molette et barre discrète pendant le défilement ; épinglable. La bande se place sur l’écran de la souris et la suit d’un écran à l’autre. Taille du texte à trois présélections dans les Réglages (14 septembre 2026).
- Fenêtre principale : réglages et anciennes traductions. Suit le thème Windows. Capsule sombre. Historique local chiffré et explicitement activable, sans journalisation du contenu.
- Visuel : très compact, arrondis et contours fins, transparence discrète. La vidéo Wispr est une référence d’interaction ; ses saccades d’enregistrement ne mesurent pas les animations du produit.
- Travail principal sans sous-agents. Lucas autorise séparément Claude Code avec Fable 5.1 pour une tâche frontend bornée ou une variante dans sa propre branche. Disponibilité du modèle à vérifier avant utilisation ; aucun lancement pour ce jalon.
- Poser uniquement les questions nécessaires ; après une question, attendre sa réponse sans poursuivre la conversation.

Les choix ci-dessus sont validés comme direction. Ils ne décrivent pas des fonctions déjà implémentées.

# Décisions de Lucas — 15 septembre 2026 (0.4.0)

- FlowTranslate n’est plus « juste traduire » : un raccourci = une action sur la sélection (Corriger, Traduire en français, Traduire en anglais, Professionnaliser, actions à créer), chacune avec sa consigne modifiable. La priorité absolue : sélectionner un texte déjà écrit (Ctrl+A), presser le raccourci « Corriger », le texte corrigé remplace la sélection sur place, dans n’importe quelle zone de texte (mail, barre de recherche, champ web, éditeur), comme Wispr Flow.
- Base `main` (0.3.0) ; les briques de la PR 6 (garde du presse-papiers, corde Ctrl+V) sont reprises, mais la relecture du document est un bonus, jamais une condition du collage. La PR 6 reste à fermer par Lucas.
- La langue cible vit dans la consigne : plus de réglage « Langue cible », plus de variable `{{targetLanguage}}` ; deux actions de traduction par défaut.
- Mode « Remplacer la sélection » : la pilule seule pendant le travail, le collage à la fin, la pilule s’efface ; le verre ne s’ouvre qu’en cas d’échec du collage (résultat + Copier).
- Consignes limpides pour de petits modèles sans réflexion (réflexion coupée par `enable_thinking: false`) ; modèle d’essai Gemma 4 12B QAT avec décodage spéculatif (profil `general` du serveur).
- L’UI des menus et des Réglages (« à la zeub ») est un autre chantier.

# Décisions de Lucas — 23 septembre 2026

- Direction produit : un raccourci Ctrl+Alt ouvre un petit menu d’actions juste après la sélection (Corriger, Traduire, Professionnaliser…) ; l’action choisie remplace le texte sélectionné.
- Critère premier : la rapidité. Réponses attendues entre 0,4 s et 4 s au plus.
- Langue de l’interface : français et anglais complets, anglais préféré (libellés, menus, états).
- Chargement : un indicateur seul, sans texte, qui n’agrandit pas la pilule à côté de la sélection. Trois points qui sautent de façon fluide suffisent. Le spinner lucide (`WaitSpinner`) et le balayage après 1,5 s (`.wait-pill[data-slow]::after`) sont rejetés.
- Endpoints : plusieurs modèles avec des paramètres différents (niveaux de réflexion réglables, etc.) devront rester modifiables. Sujet mis de côté pour l’instant.
- UI jugée brute et peu fluide (couleurs, bulles, interactions). Vocabulaire commun proposé dans le « Lexique visuel » (page publiée, codes A/E/D/T/M) avant de choisir.
- Le plan d’UI rédigé au travail (GitLab) sera fourni par Lucas avant la refonte.

## Compléments du 23 septembre 2026 (réponses aux questions du labo)

- Diagnostic : l’option Windows « Effets d’animation » était désactivée sur le PC de Lucas. L’app respecte ce réglage (`useReducedMotion`, `glass.css`), donc aucune animation n’était visible. Réglage réactivé ; une option « Animations : suivre Windows / toujours / réduites » est à prévoir.
- Chargement : préférence pour la « respiration » des trois points, mais chercher plus petit et plus élégant. Piste très appréciée : aucune bulle de chargement, le texte sélectionné lui-même scintille ou s’illumine (façon Writing Tools d’Apple), ou un indicateur minuscule.
- Menu Ctrl+Alt : le plus d’options possibles dans le moins d’affichage. Au repos, un ou deux éléments au plus ; on découvre le reste en explorant ; champ de consigne libre rapide (« mail pour un collègue, plus sympa »). Pas de listes classiques. Tester 5 à 10 formes vraiment différentes.
- Déclenchement : raccourci clavier par défaut ; option pour afficher un petit déclencheur à chaque sélection.
- Actions de démonstration : Corriger, Traduire (FR↔EN en une seule action), Rendre professionnel, Raccourcir, Rédiger un mail, Consigne libre. Icônes seulement si elles sont fines, jolies et immédiatement lisibles ; sinon pas d’icônes.
- Après remplacement : coche, Annuler et surlignage des mots changés, chacun activable dans les Réglages. Tout doit être personnalisable.
- Erreurs : visibles et claires. Erreur de configuration (endpoint, clé API, droits, nom du modèle) → bouton qui ouvre directement le bon champ des Réglages ; erreur hors de contrôle → message sans renvoi.
- La traduction longue en bande de lecture n’est plus centrale. La bulle actuelle est jugée « pâtée », peu jolie.
- Thème : clair, suit Windows, matière transparente type verre ; référence visuelle Apple Intelligence. Vrai verre (Acrylic Windows) souhaité si fonctionnel et net.
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

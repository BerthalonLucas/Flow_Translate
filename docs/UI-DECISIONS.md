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

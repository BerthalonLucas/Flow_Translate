<!-- Brouillon de l’entrée 0.5.0 (lot 14). Le lot 9 (Annuler, mots changés, pilule sous le
nouveau texte) et la correction de la fermeture spontanée de l’Îlot sont livrés et décrits
ci-dessous. Volontairement absents : l’essai Acrylic (réglage caché `glassMaterial`, désactivé,
en attente de la décision de Lucas, docs/ACRYLIC-TRIAL.md) et le « point à chaque sélection »
(reporté, décision 5). Retours de Lucas du 24/09 déjà intégrés : survol de la seule ✦, grille
ouverte à droite quand il y a la place, mise à jour propre, « Rétablir les réglages par défaut »,
raccourci déjà pris. La mise en valeur du texte (choix de Lucas du 25/09) est livrée. La ligne
« Validation » reste à écrire avec les vérifications réellement faites. -->
# FlowTranslate 0.5.0 — l’Îlot, un menu à côté de la sélection — septembre 2026

- **Un raccourci, un menu.** `Ctrl+Alt+Espace` ouvre l’Îlot juste sous le texte sélectionné, au-dessus s’il manque la place en bas. Au repos, il ne montre que la dernière action utilisée dans cette application et une pastille ✦ ; Tab, ↓ ou la souris posée sur la ✦ déplie une grille de six tuiles, à droite de la bulle quand l’écran en a la place : Fix grammar, Translate (français → anglais, le reste → français), Make professional, Shorten, Write email et Ask. Entrée relance la dernière action, une lettre lance la sienne (F, T, P, S, E), les flèches parcourent la grille, Échap revient d’un cran puis ferme. Deux appuis rapides relancent la dernière action sans passer par le menu.
- **Consigne libre.** Espace, « / », la pastille ✦ ou une lettre sans action ouvrent un champ : on écrit ce qu’on veut (« plus sympa, prêt à envoyer »), le texte est réécrit selon la consigne. La consigne n’est ni enregistrée, ni journalisée.
- **Le texte mis en valeur.** Là où l’application expose sa sélection, l’Îlot la montre dès le menu, à trois niveaux : la zone de texte cernée, les lignes entières en bandes pâles, le texte exact sous un calque. Pendant le travail, le menu se change en une petite pilule avec un orbe (Perle, Nébuleuse ou Ruban), une aurore tourne autour de la zone de texte et un reflet passe sur les lettres, sans jamais intercepter un clic. Le résultat remplace la sélection : une vague de lumière parcourt le nouveau texte, la pilule se pose dessous sans jamais le couvrir, trace une coche et offre Annuler (8 s par défaut, en pause sous la souris), qui rend l’original. Les mots changés gardent une lueur irisée jusqu’à la prochaine action dans le texte (touche, clic, molette), une minute au plus (réglable), qu’Annuler soit offert ou non. Chaque effet prend sa version claire ou sombre d’après la couleur lue sous le texte, sans rien en garder.
- **Des erreurs claires.** Une pilule courte, dans la langue de l’interface, avec un seul bouton utile : ouvrir le bon champ des Réglages (adresse, clé, modèle, mis en évidence), réessayer, ou copier le résultat quand le collage a été refusé. Rien n’est jamais remplacé à moitié ; ni le texte, ni la réponse du serveur ne s’y affichent.
- **Nouvelle matière.** Verre clair ou sombre qui suit le thème de Windows (ou forcé dans les Réglages), icônes Lucide fines, mouvements à ressort « Fluide » ou « Rebondi ». Animations : suivre Windows, toujours, ou réduites (fondus courts seulement).
- **Interface en anglais, bascule en français.** L’Îlot, les pilules, les Réglages et le menu de l’icône de notification changent de langue sans relance. Les erreurs affichées dans le verre des raccourcis directs restent en français. Les noms des actions ne sont jamais traduits ni renommés.
- **Réglages refaits.** Sections Menu (raccourci, action par défaut), Actions (ordre de la grille, lettres), Après remplacement (coche, Annuler et sa durée, méthode d’annulation, mots changés et leur durée, place de la pilule) et Apparence (langue, thème, indicateur, animations). Un raccourci déjà pris par une autre application est signalé sous sa ligne, et le menu en propose un libre à prendre d’un clic ; « Rétablir les réglages par défaut » (Sur cet appareil) remet tout comme à l’installation, sauf la connexion, l’historique, la langue et le lancement à l’ouverture de session ; une combinaison `Ctrl+Alt+lettre` qui empêcherait de taper un caractère AltGr (`€` sur AZERTY) est signalée à l’enregistrement.
- **Mise à jour depuis la 0.4.** Ce que la 0.4 avait livré et que personne n’a modifié laisse la place à la 0.5.0 : « Corriger » et « Professionnaliser » deviennent Fix grammar et Make professional, les deux traductions et `Ctrl+Alt+T` s’en vont, sauf si un raccourci gardé ou l’action par défaut choisie s’en sert encore. Ce que vous avez modifié ou créé est gardé tel quel. Le raccourci du menu est ajouté s’il est libre ; les raccourcis directs gardés continuent de marcher, avec la nouvelle pilule. L’interface passe en anglais : Réglages › Appearance › Language pour revenir au français.

À savoir : `Ctrl+Alt+Espace` peut déjà être tenu par une autre application ; FlowTranslate ouvre alors ses Réglages au démarrage, le dit sous le raccourci du menu et propose un raccourci libre (`Ctrl+Alt+Maj+Espace` d’abord) à prendre d’un clic. Dans VS Code, sans sélection lisible par UI Automation, l’Îlot s’ouvre en bas de l’écran, sans mise en valeur du texte.

# FlowTranslate 0.4.0 — chaque action marche vraiment — 15 septembre 2026

- **Remplacement partout.** « Remplacer la sélection » colle le résultat à la place du texte sélectionné dans n’importe quel champ (navigateurs, mails, Word, VS Code, Bloc-notes…) : le résultat passe par le presse-papiers, une seule corde Ctrl+V est envoyée dans la sélection d’origine, le presse-papiers est remis en place (jamais par-dessus une copie plus récente). La relecture du champ est une preuve en bonus, plus une condition. Refus seulement pour une console, un champ mot de passe, une copie faite soi-même (aucune sélection garantie) ou une fenêtre qui a changé ; le résultat reste alors dans la bulle avec Copier. Plus d’`EM_REPLACESEL`.
- **Pilule seule en mode Remplacer.** Le verre ne s’ouvre plus : la pilule tourne, le résultat est collé, la pilule montre ✓ puis s’efface. Le verre n’apparaît qu’en cas d’échec du collage, avec la raison.
- **Consignes pour petits modèles.** Le prompt est la consigne seule, envoyée en message `system`, le texte sélectionné en message `user` ; plus de `{{text}}` ni de `{{targetLanguage}}` (les anciennes consignes sont migrées). Quatre actions par défaut : Traduire en français, Traduire en anglais, Corriger, Professionnaliser, avec les mêmes règles de sortie. Réflexion coupée (`chat_template_kwargs.enable_thinking = false`, retiré si le serveur le refuse), bloc de pensée et bloc de code englobant retirés de la réponse, échantillonnage prudent (température 0,3, top_p 0,9).
- **La langue vit dans la consigne.** Le réglage « Langue cible » disparaît ; l’historique et la capsule montrent le nom de l’action.
- **Serveur : profil `general`.** Gemma 4 12B QAT (w4a16, Apache-2.0) avec décodage spéculatif MTP sur `http://127.0.0.1:8003/v1`, modèle `flowtranslate-general` : un modèle généraliste qui corrige, reformule et traduit, à mettre dans Rapide ou Qualité.
- Correctif : la fenêtre Réglages cachée pouvait bloquer une capture au démarrage (« Fermez les réglages ») ; seule la fenêtre visible le fait.

Validation : `cargo test` (collage, relecture, garde du presse-papiers, migration, historique), Vitest, Playwright (pilule seule → ✓ → fermeture, repli, garde-fou 3 s, Réglages sans langue), probe natif, matrice réelle consignée dans `docs/UI-ISSUES.md` (UI-026).

# FlowTranslate 0.3.0 — Actions et raccourcis — 15 septembre 2026

- Réglages redimensionnables (minimum 460 × 420), défilement dédié et prompts dans des volets dépliables.
- Actions Traduire, Corriger et Professionnaliser modifiables, avec jusqu’à 24 actions personnelles. Chaque prompt contient une fois `{{text}}` et peut utiliser `{{targetLanguage}}`.
- Jusqu’à 12 raccourcis : action, activation et destination (bulle ou remplacement de la sélection). Enregistrement au clavier, lettres AZERTY prises en compte, erreurs immédiates pour les touches refusées et les conflits détectés par Windows.
- Remplacement automatique après réponse complète seulement : contrôle de la fenêtre, du champ, de la sélection et du document. Une annulation, une fermeture, une nouvelle capture ou une relance invalide l’ancienne livraison. Sans cible compatible, la réponse reste dans la bulle.
- Migration de l’ancien raccourci sans perdre les profils et clés DPAPI. Une ancienne combinaison désormais réservée reste visible mais désactivée pour pouvoir la modifier.
- Correction de la compilation des tests d’inférence Windows après le passage aux prompts personnalisables.

Le remplacement vérifiable reste limité aux contrôles natifs Edit/RichEdit compatibles. Les champs web, Word, Outlook et Teams ne sont pas garantis : la bulle et Copier restent le repli prévu. Les profils Hy-MT existants sont spécialisés en traduction ; la correction et la reformulation demandent un modèle capable de suivre ces instructions, configurable dans Connexion.

Validation : tests unitaires frontend, tests navigateur et tests Rust Windows via GitHub Actions. Aucun nouveau benchmark d’inférence réelle ni recette manuelle exhaustive des applications bureautiques n’est revendiqué pour cette version.

# 0.2.1 — plus de saut avant la bande, release GitHub, tout moteur OpenAI

La pilule d’attente ne se pose plus près de la sélection pour filer en bas une demi-seconde
plus tard : l’emplacement est décidé dès la capture, sur le texte sélectionné. Une sélection
de plus de huit lignes attend directement en bas au centre et la bande y naît sans bouger ;
seule une sélection courte traduite long se déplace encore. Quand la bande prend l’écran de
la souris et que ce n’est pas celui de la sélection, la bulle reçoit aussitôt la zone de
travail du bon écran.

L’installateur Windows est publié dans les releases GitHub avec son SHA-256 (workflow
« Release », sur tag `v<version>` ou à la main). Le README explique l’installation, le
serveur livré et le branchement de n’importe quel moteur compatible OpenAI ; la page
`docs/ENDPOINTS.md` donne la requête exacte, ce qui est attendu en retour et les réglages
pour vLLM, llama.cpp, LM Studio, Ollama et les services en ligne. Un serveur qui refuse
`top_k` ou `repetition_penalty` (API OpenAI stricte) reçoit la requête une seconde fois sans
ces champs, sans rien configurer.

# 0.2.0 — lecture calibrée : deux formes, un temps de lecture, la bande suit la souris

Plus d’anneau ni de grande fenêtre vide pendant l’attente : une pilule de 60 × 28 avec
un spinner net (celui de shadcn), au coin de l’endroit où le verre va s’ouvrir. Le résultat arrivé,
la forme est décidée une fois sur le vrai texte : jusqu’à huit lignes, un verre court
(380 px, 16/24) se déplie depuis la pilule à côté de la sélection ; au-delà, une bande de
lecture se pose en bas au centre de l’écran, large de la moitié de la zone de travail et
haute d’au plus 45 %, en 22/33, avec défilement. Plus de « Agrandir », plus d’onglet, plus
de repli.

La bulle s’efface d’elle-même au bout du temps de lecture estimé (350 ms par mot, entre
5 s et 30 s pour un verre court, 90 s pour la bande), puis s’assombrit et fond ; quand la
souris l’a visitée puis la quitte, elle part en quatre secondes au plus. Un clic, la
molette ou une touche la retiennent ; l’épingle de la bande la garde. Les Réglages
proposent « Taille du texte » (Normale, Grande, Très grande) et « Fermeture automatique »
(Rapide, Normale, Lente, Jamais).

La bande apparaît sur l’écran où est la souris et la suit d’un écran à l’autre ; un verre
court reste près de sa sélection. Typographie plus fine (`#e8eaef`, un seul graphite pour
verre, pilule et menu).

# 0.1.8 — capture directe : plus de Ctrl+C, plus de boîte de dialogue

Le raccourci suffit : sans sélection lisible par UI Automation (Teams, Discord, Word,
VS Code…), FlowTranslate copie lui-même la sélection (Ctrl+Insert synthétique une fois
le raccourci relâché, jamais SIGINT dans un terminal), la traduit et remet le
presse-papiers tel qu’il était, sans alimenter Win+V. Une copie faite soi-même moins de
trois secondes avant reste traduite. Un ancien contenu non texte du presse-papiers
(image, fichiers) n’est pas restauré.

La fenêtre s’ouvre dès que le texte est connu ; le contrôle natif est lu ensuite et
« Remplacer » n’apparaît qu’une fois vérifié. Quand il n’y a rien à traduire, une petite
pilule en bas de l’écran de la souris le dit et s’efface en quatre secondes : plus de
boîte de dialogue à fermer. L’icône de notification propose « Revoir la dernière
traduction » pendant dix minutes.

# 0.1.7 — fluidité : plus de bandeau, fenêtre réservée, délai de grâce

Plus de barre de titre « FlowTranslate » peinte sur la bulle quand une autre fenêtre
prend ou rend le focus : le HWND est sous-classé et `WM_NCACTIVATE` n’a plus le droit
de repeindre (cause établie et reproduite dans `release/ui-evidence/band-repro/`).

La fenêtre native est réservée une fois pour toutes : 484 × 758 px ancrée en bas (menu
au-dessus de la pilule, verre agrandi, onglet), au moins 334 px ancrée au texte (menu
sous la pilule). Le repli en onglet, le dépli, le menu et l’arrivée d’un résultat
compact ne redimensionnent plus rien : seules les surfaces cliquables changent. Le
corps du verre reste monté et se replie en fondu ; l’onglet ne bouge jamais.

Après une action (Agrandir, Original, copie, clic), le verre reste ouvert au moins
deux secondes ; la sortie du pointeur est jugée à 32 px autour du verre et de sa
pilule, mesurée nativement par le sondeur du curseur.

Anneau d’attente à 1,4 s par tour avec un arc qui respire. Les chemins, URL et
identifiants se coupent après leurs séparateurs, jamais au milieu d’un mot ; 22 px
entre le texte et le bord arrondi. Menu dans le graphite du verre, survol fondu ;
original à 14 px sur fond clair.

# 0.1.6 — onglet, bords lissés, attente en anneau

La bulle se replie en un onglet de 44 × 20 px au bord bas de l’écran quand la
souris la quitte (ou après 10 s sans visite) ; le survoler la rouvre, le × ou
**Fermer** la ferme. `Ctrl+Alt+T` traduit aussitôt la sélection courante, presse-
papiers compris, sans confirmation ; la fenêtre capsule n’est plus affichée.

Plus de matériau DWM ni de région Win32 : le verre se peint lui-même, Chromium
dessine les coins et les ombres avec l’alpha par pixel, et le hit-test suit le
curseur (sondage toutes les 8 ms, `WS_EX_TRANSPARENT | WS_EX_LAYERED`). Fini le
cadre gris, les coins en escalier et les ombres coupées ; la fenêtre porte un halo
transparent pour les ombres.

Pendant la traduction, un anneau tourne ; le résultat arrive d’un bloc, la
fenêtre se redimensionne une seule fois et le verre s’ouvre en fondu. Une erreur
de connexion nomme le serveur injoignable et renvoie aux Réglages. Le rendu natif
(coins, ombre, fluidité) reste à confirmer à l’œil : la session de validation
était verrouillée, voir VALIDATION.md. Kit d’essai pour un autre poste :
`scripts/package-test-kit.ps1 -EvaluationVersion 0.1.5`.

## 0.1.5 — moteurs réels et kit de recette

Inférence réelle sous WSL2 (runner alternatif de l’image vLLM 0.28.0 épinglée,
une carte par profil), 600/600 réponses complètes sur les extraits synthétiques,
fenêtre Réglages sans cadre, premier kit de recette Windows.

## 0.1.4 — verre plus présent, interactions affinées

Le verre graphite passe de 78 % à 66 % d'opacité, les accessoires à 68 %.
Un bord asymétrique et des reflets intérieurs discrets donnent du relief sans
modifier la taille de la bulle. Le menu et la pilule partagent le même matériau.

Les retours visuels et le menu utilisent des fondus courts ; les icônes de copie
se croisent dans une zone fixe. Le flou et les ombres restent statiques. Windows
ne recalcule plus le cadre à chaque changement de géométrie lorsque le style
de la fenêtre est déjà correct. Les mouvements réduits restent respectés.

L'aperçu navigateur permet de comparer les fonds clair, sombre et coloré.
Les contrôles de fond appartiennent uniquement à cet aperçu. Le fondu acrylique
du compositeur Windows demeure distinct des animations du WebView ; les preuves
et limites de la recette sont dans VALIDATION.md.

## 0.1.3 — verre, pilule chevauchante et lecteur bas

Référence visuelle : planche C validée par Lucas. La traduction dispose de sa
propre surface de verre graphite ; Copier et Plus sont réunis dans une petite
pilule à cheval sur le bord supérieur droit. Les textes longs utilisent un
lecteur plus large en bas du moniteur, sans barre de défilement visible.

Les transitions utilisent Motion et respectent les mouvements réduits. Le
texte reste net : pas d'étirement ou d'animation du flou. La fermeture annule
immédiatement la traduction, puis coordonne la sortie visuelle avec Rust ; un
délai borné sert de secours. Les régions natives correspondent aux surfaces
réelles pour laisser passer les clics dans les espaces transparents.

Les preuves de compilation, tests, rendu et mesures sont consignées dans
VALIDATION.md. Un profil Chromium synthétique ne prouve pas la fluidité du
compositeur Windows et le dépoli doit être vérifié dans la fenêtre Tauri.

## 0.1.2 — composants éprouvés et boucle de revue visuelle

Le frontend est confié à Astra avec un effort de raisonnement medium ou supérieur.
Motion anime les apparitions et retours visuels, Radix fournit les menus et
interrupteurs accessibles, Lucide fournit les icônes. Versions épinglées et
notices de licence embarquées. La bulle courte conserve ses 280 × 76 px,
ses coins de 26 px et son fond graphite à 82 %.

Fermer reste disponible pendant le chargement et après une erreur. Les
scénarios de démonstration sont rejouables. Les 6 tests unitaires et 19 tests
navigateur passent. La revue combine désormais navigateur contrôlé et captures
de la vraie fenêtre Windows ; voir UI-ITERATION.md pour les résultats natifs.

Les transitions de dimensions et la fermeture native ne sont pas encore
animées : elles demandent une coordination explicite entre React et Rust.

## Correctifs précédents — 0.1.1

Correction du cadre Windows qui recouvrait la traduction. Le texte utilise
désormais toute la largeur et les petites actions suivent sa dernière ligne.
Faire glisser le texte ou le fond pour déplacer la bulle ; les boutons et les
barres de défilement gardent leur interaction. La position choisie reste en
place pendant le streaming et les changements de taille du résultat courant.

Le poste de développement utilise désormais un chemin explicite :
`C:\Users\Lucas\Apps\FlowTranslate\FlowTranslate.exe`, afin d’éviter la
redirection de LocalAppData par l’environnement Codex.

## Fonctionnalités de l’aperçu V1

Premier client Windows installable : interface Tauri contextuelle, bulle 280 px,
capsule presse-papiers avec confirmation, réglages, profils, raccourci global,
streaming, copie explicite, historique DPAPI facultatif et installation NSIS.
Configuration reproductible vLLM 0.28.0 et modèles Hy-MT2 épinglés. Dépôt privé.

Les options `--demo-selection` et `--demo-clipboard` permettent d’essayer le
rendu sans serveur. `--simulate-inference` sert à tester la capture réelle avec
une réponse synthétique ; quitter l’instance avant de changer de mode.

Cet aperçu n’est pas encore une V1 entièrement réceptionnée :

- Les modèles n’ont pas été chargés ni comparés sur GPU : ressources occupées,
  moteur Docker arrêté. Aucun résultat de qualité/latence n’est inventé.
- Remplacer est limité aux contrôles Win32 Edit/RichEdit vérifiables. Les
  autres contrôles conservent Copier. La recette Office/Teams reste à faire.
- Une reprise visuelle sur le bureau Windows est nécessaire pour valider les
  derniers correctifs, les transitions de taille et le DPI multi-écrans.
- Le paquet n’est pas signé par un certificat de distribution d’entreprise.

Voir [les preuves de validation](VALIDATION.md), [la recette](RECETTE.md) et
[la procédure d’installation et de retour arrière](DEPLOYMENT.md).

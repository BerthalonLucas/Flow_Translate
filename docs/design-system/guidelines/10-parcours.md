# Parcours

Ce que la personne vit, du raccourci à la disparition. Les durées sont celles du produit ; la carte **OverlayScenes** les montre image par image.

## Afficher un résultat

1. **Raccourci.** La sélection est capturée (UI Automation, ou copie faite par FlowTranslate avec le presse-papiers restauré ; une copie faite soi-même moins de 3 s avant est acceptée). Aucune confirmation.
2. **Placement décidé une fois, sur la source.** Sélection ancrée et 8 lignes au plus à 380 px : près de la sélection. Sinon, ou sans ancre : en bas au centre de l’écran du curseur, même pour un verre court. Une source longue attend en bas dès le départ, sans saut. Seule une source courte dont le résultat dépasse 8 lignes part en bas : la pilule d’attente s’efface pendant que la fenêtre se déplace, puis la bande naît en bas.
3. **Attente.** `WaitPill` seule, là où la pilule d’actions se tiendra. Après 1,5 s, le balayage `signal`. Les fragments du moteur sont mis en tampon : le texte arrive d’un bloc.
4. **Résultat.** Forme décidée sur le vrai texte : verre court (ouverture en clip-path 260 ms depuis la pilule) ou bande de lecture (montée 220 ms). La pilule d’actions monte avec son étiquette d’action.
5. **Lecture.** Budget = 1 s (court) ou 1,5 s (bande) + 350 ms par mot, entre 5 et 30 s (court) ou 90 s (bande), × 0,7 / 1 / 1,5 selon « Fermeture automatique » (ou jamais). Survol, focus clavier, menu ouvert, glisser ou épingler retiennent ; un clic, la molette ou une touche remettent le budget à zéro.
6. **Départ.** Après une visite d’au moins 1 s, sortir la souris laisse 4 s (jamais moins de 2,5 s). À la fin du budget : estompe à 55 % en 600 ms, tenue 1,4 s, sortie 300 ms. S’approcher pendant l’estompe ramène le verre et accorde 5 s.

## Remplacer la sélection

1. Raccourci réglé sur **Remplacer** : `WaitPill` seule, jamais de verre.
2. Le résultat est collé dans la sélection d’origine (presse-papiers et une seule corde Ctrl+V, presse-papiers restauré).
3. **Réussi :** coche `signal` 900 ms, puis tout disparaît. Le texte réécrit est la seule trace.
4. **Refusé** (console, champ mot de passe, fenêtre changée, sélection non garantie) : le verre s’ouvre avec le résultat, Copier actif, et `Notice size="sm" tone="danger"` avec la raison du refus, puis quoi faire, par exemple « Ce champ n’est pas modifiable. Copiez le résultat. »

## Lire un texte long

- Plus de 8 lignes : la bande naît en bas, centrée sur l’écran du curseur, large de la moitié de sa zone de travail, haute de 45 % au plus.
- Elle suit la souris d’un écran à l’autre. Molette, flèches et Page haut/bas font défiler ; fondus de bord et indicateur 3 px pendant le défilement.
- **Épingler** la garde ouverte sans budget ; le menu s’ouvre au-dessus de la pilule, comme pour tout verre posé en bas.

## Rien à traiter

Raccourci sans sélection lisible ni copie récente : `Notice` seule en bas au centre de l’écran du curseur, « Rien à traiter dans la fenêtre active. », jamais cliquable, 4 s. Si un verre est déjà ouvert, le même message apparaît en retour sous le verre (au-dessus s’il est posé en bas).

## Échec du moteur

Le verre s’ouvre en `GlassError` : « Le moteur Qualité ne répond pas. » puis « Vérifiez qu’il est démarré sur 127.0.0.1:8002. », avec **Réessayer** (relance la même capture : le verre garde sa forme et la roue prend la première ligne) et **Réglages** (ouvre la page Moteurs). Réponse interrompue après du texte : le texte reste, `PartialNote` en dessous.

## Clavier dans l’overlay

- Le verre n’a jamais le focus à l’apparition : la personne continue de taper dans son application.
- Un clic dans le verre lui donne le focus : Entrée copie, Tab parcourt Copier, Épingler, ⋯, Fermer ; flèches dans le menu ; Échap ferme le menu, puis le verre (et annule un travail en cours).

## Réglages

- Ouverts depuis ⋯ → Réglages, ou depuis l’icône de la zone de notification. Ils s’ouvrent sur **Actions**.
- Tout s’enregistre seul : interrupteurs et segments aussitôt, frappe 300 ms après la dernière touche. L’état vit dans la barre de titre ; un échec affiche « Non enregistré · Réessayer » et la raison en encadré `danger` en haut de la page.
- Fermer (bouton, Échap) enregistre d’abord ; un échec garde la fenêtre ouverte.
- Un raccourci s’enregistre dès qu’une combinaison valide est pressée et s’active aussitôt ; une combinaison refusée affiche la raison sous la ligne, sans rien changer.

## Zone de notification

- Icône monochrome : repos ; travail pendant qu’une action tourne (utile en mode Remplacer, quand la pilule est loin de la souris) ; alerte après un échec jusqu’à la prochaine réussite.
- Menu Windows natif : Revoir le dernier résultat, Réglages, Quitter. Infobulle « FlowTranslate » ou « FlowTranslate — » suivi du dernier problème.

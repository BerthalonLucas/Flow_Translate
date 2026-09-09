# Revue UI — registre des défauts

Un défaut par correction. Statuts : à reproduire → reproduit → corrigé → vérifié.
Une compilation ou une référence visuelle inchangée ne valide pas l’esthétique.

| ID | Défaut / état actuel | Reproduction | Critère de correction | État |
|---|---|---|---|---|
| UI-001 | Surface grise résiduelle / fermeture native rapportées par Lucas | Afficher, ouvrir le menu, fermer et recommencer sur fonds clair/sombre | Plus de surface visible ni de zone bloquant la souris après fermeture ; vérifier aussi pendant annulation | À reproduire sur le bureau ; fermeture du DOM vérifiée via CDP |
| UI-002 | Capsule sans repli au survol | Atelier → Capsule actuelle | Trait au repos ; langue/action/menu au survol ; aller vers le menu sans fermeture prématurée ; déplacement et aimantation | Reproduit ; pas encore corrigé |
| UI-003 | États et transitions de la bulle à reprendre | Atelier → court, attente, interruption, erreur | Lecture stable ; actions seulement à la fin ; Échap ferme ; résultat persistant hors survol | Reproductible dans l’atelier ; refonte à faire |
| UI-004 | Lecture longue et barre de défilement | Atelier → long ; molette/clavier | Panneau plus large, tout le texte accessible, barre discrète lors du défilement | Reproductible ; ajustement à faire |
| UI-005 | Réglages : fond incomplet, thème et historique peu lisibles | Atelier → réglages/historique ; 900 puis 480 px | Toute la fenêtre cohérente ; thème Windows ; réglages et anciennes traductions accessibles | Reproduit ; pas encore corrigé |
| UI-006 | Capture Windows automatique indisponible | Computer Use → démo native | Capture du bureau exploitable et interactions natives mesurables | Bloqué côté outil : capture noire puis GetCursorPos 0x80070005 ; CDP fonctionne |

## Fiche d’une correction

- ID et scénario ; commit de départ.
- Observé / attendu ; hypothèse technique séparée.
- Reproduction exacte : fenêtre, taille, thème, gestes.
- Capture avant ; correction limitée ; capture après dans les mêmes conditions.
- Interaction rejouée, état final et régressions vérifiées.
- Animations : observation en mouvement et profil de performance séparés des captures fixes.
- Statut de revue esthétique par Lucas, sans l’assimiler aux tests automatiques.

## Ordre

1. UI-001 et UI-006 : fiabilité/observation native.
2. UI-002 : capsule et transitions au survol.
3. UI-003 / UI-004 : résultat court et long.
4. UI-005 : application et historique.

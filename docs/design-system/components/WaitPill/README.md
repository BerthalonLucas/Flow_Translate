# WaitPill

La pilule seule pendant le travail du moteur, posée là où la pilule d’actions se tiendra, ou centrée en bas de l’écran du curseur en placement bas (source longue, capture sans ancre, « Revoir le dernier résultat ») : `Overlay form="pending" placement="bottom"`.

## États
- En cours : `loader-circle` 18 px, un tour par seconde, linéaire (le spinner de shadcn, préfait ; jamais de points qui sautent).
- Lent : après 1,5 s, un balayage `signal` de 2 px glisse sous la roue (1 400 ms).
- Fait (mode Remplacer) : coche `signal` qui éclot en 140 ms, tenue 900 ms, puis la fenêtre se ferme.

## Règles
60 × 28 px (`wait-pill-width`, `pill-height`) : la fenêtre native est réservée une fois, la pilule ne change jamais de taille. `aria-label` « Traitement en cours » puis « Sélection remplacée ».

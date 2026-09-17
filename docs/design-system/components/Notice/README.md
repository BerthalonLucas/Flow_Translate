# Notice

Un message dans une pilule graphite : seul en bas de l’écran du curseur quand il n’y a rien à traiter, ou petit sous le verre comme retour d’une action (au-dessus du verre quand il est posé en bas de l’écran).

## Tailles
- `md` : avis seul, fenêtre native 420 × 64, jamais cliquable, 4 s ; 388 px et deux lignes au plus. Un message plus long se réécrit : jamais de points de suspension sur une erreur.
- `sm` : retour d’action sous le verre, aligné à droite à 16 px du bord, 8 px d’écart ; au-dessus du verre en placement bas (copie refusée, collage impossible), 3 s ; caché quand le menu est ouvert.

## Tons
`info` (icône `glass-ink-muted`), `success` (coche `signal`), `warning` (`glass-warning`), `danger` (`glass-danger`, `role="alert"`). Le ton est toujours doublé d’une icône et d’un mot.

## Rédaction
Une phrase sur ce qui se passe, puis quoi faire : « Collage impossible ici. Copiez le résultat. » Jamais le texte de l’utilisateur dans un avis.

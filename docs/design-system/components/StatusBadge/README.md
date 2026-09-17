# StatusBadge

L’état d’un moteur en point et en mot (Connecté · 38 ms, Vérification…, Échec de connexion, Non vérifié), et `Badge` pour une étiquette (Par défaut, Prédéfinie).

## Règles
- Le point n’est jamais seul : le mot porte l’information (daltonisme, lecteurs d’écran).
- `success` et `danger` en `caption` ; `checking` remplace le point par `loader-circle` 12 px.
- `Badge tone="signal"` (`signal-soft` / `signal-ink`) seulement pour « Par défaut » ; le reste en neutre.

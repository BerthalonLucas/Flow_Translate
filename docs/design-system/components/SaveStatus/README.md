# SaveStatus

L’état de l’enregistrement automatique, à droite de la barre de titre : Enregistré, Enregistrement…, Enregistré à l’instant (3 s), Non enregistré · Réessayer.

## Règles
- `aria-live="polite"` ; l’erreur passe en `role="alert"` avec le lien Réessayer (`signal-ink`, souligné).
- La raison (message renvoyé par Rust : raccourci déjà pris, combinaison en double, démarrage automatique indisponible…) s’affiche en `Callout` `danger` en haut de la page active tant que l’état reste en erreur (`SettingsWindow` `saveError`) ; le bloc de la barre de titre passe alors en `aria-live="polite"` (`announced`, posé par `SettingsWindow`) pour ne pas annoncer deux fois ; seul, `SaveStatus` garde `role="alert"` et la raison en infobulle. Réessayer relance le dernier enregistrement.
- Fermer la fenêtre enregistre d’abord ; en cas d’échec, la fenêtre reste ouverte et la raison s’affiche.

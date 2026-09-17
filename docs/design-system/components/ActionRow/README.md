# ActionRow

Une action (Traduire, Corriger, Professionnaliser, les vôtres) en carte : pictogramme, nom, résumé, raccourci ; un clic la déplie sur place en éditeur.

## En-tête
Tuile `surface-sunken` 32 px avec l’icône de l’action (`languages`, `spell-check`, `briefcase-business`, `wand` pour une action personnalisée), nom en `label`, badge « Par défaut », résumé « Prédéfinie · Remplace la sélection » en `caption`, `Keycaps` du premier raccourci actif, chevron.

## Éditeur (enfants à fournir)
1. `TextField` Nom (60 caractères).
2. Raccourcis : un `ShortcutBinding` par combinaison (interrupteur, touches + Modifier, `Segmented` Afficher / Remplacer, supprimer), puis « Ajouter un raccourci ».
3. `TextArea` Consigne.
4. Pied : Rétablir la consigne (prédéfinie), Définir par défaut, Supprimer l’action (`danger`, désactivé tant qu’un raccourci ou le défaut l’utilise).

## Pourquoi
En 0.4.0, actions et raccourcis vivaient dans deux sections : depuis une action, on ne voyait pas quels raccourcis la lançaient. Ici, un raccourci appartient à son action ; le modèle de données (`shortcutBindings[].actionId`) ne change pas.

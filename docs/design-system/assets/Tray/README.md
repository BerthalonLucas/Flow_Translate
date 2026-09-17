# Tray

Glyphes de la zone de notification, 16 × 16 sur grille entière, une seule encre (Windows les affiche sans recoloration).

- `tray-idle-dark-taskbar.svg` / `tray-idle-light-taskbar.svg` — repos. Encre `#ffffff` sur barre des tâches sombre, `#16171b` sur barre claire.
- `tray-busy-dark-taskbar.svg` / `tray-busy-light-taskbar.svg` — une action tourne : la moitié droite de la bande à 35 % d’opacité.
- `tray-alert-dark-taskbar.svg` / `tray-alert-light-taskbar.svg` — dernier échec non résolu : ligne haute raccourcie et pastille `#e5534b` de 6 px (seul écart à l’encre unique, lisible sur les deux barres).

Choisir la variante selon le mode Windows, `SystemUsesLightTheme` (HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize), qui colore la barre des tâches : 0 → `*-dark-taskbar`, 1 → `*-light-taskbar`. Ne pas lire `AppsUseLightTheme` (mode des applications), ni le thème de FlowTranslate. Relire la valeur à chaque `WM_SETTINGCHANGE` « ImmersiveColorSet » et remplacer l’icône aussitôt.

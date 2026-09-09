# Références observées, pas approbation esthétique

Ces 19 PNG enregistrent l’état actuel avant refonte, y compris les défauts connus
dans docs/UI-ISSUES.md. Une comparaison réussie signifie seulement que le rendu
n’a pas changé. Ne pas remplacer les images pour faire passer un test sans
examiner attendu / réel / différence.

Premier relevé : Windows, Chromium fourni par @playwright/test 1.63.0,
viewport 900×600 (480×640 pour settings-narrow), locale fr-FR,
Europe/Paris, mouvements réduits. Fixtures publiques fictives exclusivement.
L’historique est positionné sur son contenu. Les fonds clair/sombre et
color-scheme des contrôles sont forcés par la fixture ; une évolution basée sur
prefers-color-scheme devra aussi émuler le thème du navigateur.

Exécuter `npm run ui:check` depuis la racine. Le rapport HTML contient les
comparaisons en cas de différence. `npm run ui:reference` est une opération
explicite de mise à jour, distincte du test normal.

Les scénarios de l’atelier sont uniquement servis par Vite en développement.
Ils ne sont pas inclus dans dist ni dans l’installateur Tauri.

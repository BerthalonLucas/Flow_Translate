# Frontend FlowTranslate

`src/` contient le client React partagé par les trois fenêtres Tauri : `overlay`, `capsule` et `settings`. Il ne contacte jamais un modèle directement : chaque effet passe par `src/bridge.ts`, qui applique les noms et formes de `docs/BRIDGE.md`.

En dehors de Tauri, `npm run dev` affiche un bureau de démonstration clairement identifié. Son adaptateur est en mémoire, déterministe, et ne lit ni n’écrit le presse-papiers, l’historique, les clés ou un serveur. `?window=overlay&demo=1` rend la micro-bulle seule pour les captures Playwright.

Le reducer ignore les événements de flux obsolètes, active les actions seulement après `done`, et invalide le remplacement quand le bridge signale que le `captureId` a changé. Les tests unitaires couvrent ces cas ; les tests UIA/focus et les captures multi-DPI restent des vérifications Windows natives.

Commandes : `npm run dev`, `npm run build`, `npm test`, `npm run tauri`.

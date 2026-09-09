import { useState } from 'react';
import './bugs.css';

const defects = [
  {
    id: 'settings', title: 'Marges blanches des réglages', code: 'UI-005a', scope: 'Web + Windows',
    image: 'settings-reported.png',
    observed: 'Le panneau sombre est entouré de grandes bandes blanches quand la fenêtre est élargie.',
    steps: ['Afficher les réglages en 960 × 450.', 'Observer les bords gauche et droit, puis passer à 620 × 640.', 'Le fond doit couvrir toute la fenêtre, sans modifier la largeur de lecture.'],
    cause: 'Le fond est défini sur .settings-window (620 px maximum). Le document autour reste transparent et laisse apparaître le fond blanc de la WebView.',
    boundary: 'Cette reproduction utilise les réglages réels, sans thème ni fond de démonstration. Elle ne valide pas la barre de titre Windows.',
    scenario: 'settings',
  },
  {
    id: 'residual', title: 'Grand rectangle gris résiduel', code: 'UI-001', scope: 'Windows uniquement',
    image: 'residual-reported.png',
    observed: 'Une grande surface grise reste visible au-dessus de la capsule, même sans texte.',
    steps: ['Lancer la vraie fenêtre Tauri en démo.', 'Afficher une traduction, ouvrir puis fermer le menu, fermer la traduction.', 'Contrôler la visibilité des fenêtres natives et leur composition sur le bureau.'],
    cause: 'Établie pour la fermeture : host::show affiche le HWND via SetWindowPos(SWP_SHOWWINDOW) sans passer par Tao, dont le cache de visibilité rend ensuite window.hide() sans effet. Correctif host::hide (ShowWindow SW_HIDE au niveau HWND, sans repasser par Tao dont le rebuild des styles rétablit WS_CAPTION). La composition du fond gris sur le bureau n’est pas encore mesurée.',
    boundary: 'Le probe natif (npm run ui:native) prouve la fermeture des HWND sur trois cycles ; il ne mesure ni le dépoli ni un éventuel résidu de composition. Dessiner un rectangle gris en CSS ne reproduirait pas ce défaut.',
    scenario: null,
  },
  {
    id: 'hover', title: 'La capsule ne se replie pas', code: 'UI-002a', scope: 'Comportement manquant',
    image: 'overlay-reported.png',
    observed: 'Les commandes restent affichées ; le petit trait au repos et le déploiement au survol ne sont pas implémentés.',
    steps: ['Survoler la capsule actuelle.', 'Éloigner la souris.', 'Constater que les commandes restent affichées : il n’existe pas encore de transition repos/survol.'],
    cause: 'Le composant Capsule ne possède aucun état de survol ou de repli. Il faut implémenter le comportement validé, pas ajuster un délai existant.',
    boundary: 'L’absence de repli est observable ici. Le placement et le glisser-déposer Windows ne sont pas simulés dans ce cadre.',
    scenario: 'capsule',
  },
  {
    id: 'drag', title: 'Déplacement et focus', code: 'UI-002b', scope: 'Windows uniquement',
    image: 'overlay-reported.png',
    observed: 'Déplacement impossible rapporté sur les premières versions. Le comportement de la version installée doit être revérifié.',
    steps: ['Lancer une traduction dans la vraie application.', 'Faire glisser une zone non interactive, puis ouvrir le menu.', 'Mesurer la position avant/après ; vérifier la sélection et le focus de la source.'],
    cause: 'Non établie pour la version actuelle. Dans un navigateur, le pont de déplacement est simulé : cela ne teste pas le déplacement de la fenêtre.',
    boundary: 'À vérifier nativement. Un composant que l’on déplace dans une page web ne validerait pas cette correction.',
    scenario: null,
  },
  {
    id: 'selection', title: 'Sélection → traduction directe', code: 'UI-007', scope: 'Windows uniquement',
    image: 'overlay-reported.png',
    observed: 'Le parcours doit traduire la sélection par Ctrl+Alt+T sans copie manuelle ni confirmation.',
    steps: ['Sélectionner un texte fictif dans Edge, Word ou Teams.', 'Appuyer sur Ctrl+Alt+T.', 'Vérifier une traduction directe dans la langue réglée ; si la sélection est introuvable, ne pas envoyer le presse-papiers à sa place.'],
    cause: 'Le parcours de sélection est automatique côté React. La récupération Windows et le repli actuel vers le presse-papiers doivent être testés dans l’application source.',
    boundary: 'Fournir un texte déjà capturé à la démo contourne précisément la partie à tester. Ce cas ne sera pas déclaré vérifié par un test web.',
    scenario: null,
  },
] as const;

export function BugWorkbench() {
  const params = new URLSearchParams(location.search);
  const [id, setId] = useState(params.get('issue') ?? 'settings');
  const defect = defects.find(item => item.id === id) ?? defects[0];
  const [size, setSize] = useState('960x450');
  const [run, setRun] = useState(0);
  const [width, height] = size.split('x').map(Number);
  const [missing, setMissing] = useState(false);
  return <main className="workbench bug-board">
    <header><div><span className="eyebrow">FlowTranslate / Diagnostic</span><h1>Défauts signalés</h1><p>Reproduire le problème avant de déclarer un correctif.</p></div><a href="/lab.html?view=states">États techniques →</a></header>
    <div className="workspace">
      <nav aria-label="Défauts signalés">{defects.map(item => <button key={item.id} aria-current={defect.id === item.id ? 'page' : undefined} onClick={() => { setId(item.id); setMissing(false); history.replaceState(null, '', `/lab.html?issue=${item.id}`); }}><span>{item.title}</span><small>{item.code}</small></button>)}</nav>
      <section className="review">
        <div className="defect-heading"><span>{defect.code} · {defect.scope}</span><h2>{defect.title}</h2><p>{defect.observed}</p></div>
        <details className="reported" open={defect.scenario === null} key={defect.id}><summary>Capture signalée par Lucas — conservée localement</summary>{missing ? <p>Capture locale indisponible sur cette machine. Voir le signalement original.</p> : <img src={`/release/ui-evidence/${defect.image}`} alt={defect.observed} onError={() => setMissing(true)}/>}</details>
        <div className="repro-steps"><strong>Reproduction à effectuer</strong><ol>{defect.steps.map(step => <li key={step}>{step}</li>)}</ol><p><strong>Diagnostic : </strong>{defect.cause}</p></div>
        {defect.id === 'settings' && <section className="patch-evidence" aria-label="Preuves du correctif des marges"><strong>Correction frontend vérifiée — même fenêtre de 960 × 450</strong><div><figure><figcaption>Avant : défaut reproduit, test en échec</figcaption><img src="/release/ui-evidence/settings-before.png" alt="Avant correction, grandes marges blanches autour du panneau sombre"/></figure><figure><figcaption>Après : fond continu, test réussi</figcaption><img src="/release/ui-evidence/settings-after.png" alt="Après correction, le fond sombre couvre toute la fenêtre"/></figure></div><p>Capture du navigateur avec les composants de production. Installation Windows non mise à jour par cette comparaison.</p></section>}
        {defect.scenario ? <>
          <div className="controls"><label>Taille du cas<select value={size} onChange={e => setSize(e.target.value)}><option value="960x450">960 × 450 — fenêtre élargie</option><option value="620x640">620 × 640</option><option value="480x640">480 × 640</option></select></label><button className="replay" onClick={() => setRun(run + 1)}>Rejouer le cas</button><a href={`/lab-frame.html?scenario=${defect.scenario}&surface=production`} target="_blank" rel="noreferrer">Ouvrir seul ↗</a></div>
          <div className="canvas"><iframe key={`${defect.id}-${size}-${run}`} title="Reproduction du défaut" src={`/lab-frame.html?scenario=${defect.scenario}&surface=production`} width={width} height={height}/></div>
        </> : <div className="native-required"><strong>Pas de reproduction web pour ce défaut.</strong><p>Le test doit piloter la fenêtre Windows réelle. La commande <code>npm run ui:native</code> vérifie le cas de fermeture disponible ; elle ne couvre pas à elle seule tous les gestes ci-dessus.</p></div>}
        <footer>{defect.boundary}</footer>
      </section>
    </div>
  </main>;
}

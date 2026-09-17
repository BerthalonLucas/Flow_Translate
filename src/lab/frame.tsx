import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { Capsule, SettingsWindow } from '../App';
import { GlassOverlay } from '../GlassOverlay';
import { useTranslation } from '../useTranslation';
import { bridge } from '../bridge';
import { scenarioFrom } from './scenarios';
import '../styles.css';
import '../glass.css';

const params = new URLSearchParams(location.search);
const scenario = scenarioFrom(params.get('scenario'));
const settingsSurface = scenario.surface === 'settings';
// ?theme= ne décrit plus que le décor derrière le verre : le thème des Réglages vient de
// prefers-color-scheme, que Playwright émule. Sans cela, sombre et clair rendaient la même image.
const background = params.get('theme') === 'light' ? 'light' : 'dark';

// La même règle que src/main.tsx, appliquée avant le rendu : tokens.css ne connaît que
// :root, [data-theme="dark"] et [data-theme="light"], jamais prefers-color-scheme.
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const theme = settingsSurface ? (prefersDark.matches ? 'dark' : 'light') : 'dark';
  document.documentElement.dataset.theme = theme;
  // color-scheme n'est posé que pour les Réglages : overlay et capsule sont des fenêtres
  // natives transparentes, et un canevas sombre opaque y ferait un rectangle sur le bureau.
  if (settingsSurface) document.documentElement.style.colorScheme = theme;
}
applyTheme();
if (settingsSurface) prefersDark.addEventListener('change', applyTheme);

// Orthographe du contrat : la fenêtre Réglages lit sa page initiale dans l'URL quand aucune
// cible native ne lui est remise. Le banc n'a donc pas de prop à lui passer.
if (settingsSurface && scenario.page) {
  const url = new URL(location.href);
  url.searchParams.set('window', 'settings');
  url.searchParams.set('page', scenario.page);
  url.searchParams.set('demo', '1');
  history.replaceState(null, '', url);
}

function OverlayFixture() {
  const controller = useTranslation();
  const begun = useRef(false);
  useEffect(() => {
    // Start only after the real hook has installed its listeners and loaded settings.
    if (!controller.settings || begun.current) return;
    begun.current = true;
    if (scenario.id === 'notice') {
      // What Rust emits when the shortcut finds nothing: repeated so the reference stays visible.
      const show = () => bridge.demoNotice('Rien à traiter dans la fenêtre active.');
      show();
      const timer = window.setInterval(show, 3000);
      return () => window.clearInterval(timer);
    }
    const capture = {
      id: `lab-${scenario.id}`,
      text: scenario.id === 'long' ? 'Please review the updated proposal. '.repeat(20) : 'Could you send the updated proposal before Thursday?',
      source: 'selection' as const, canReplace: true, anchor: { x: 400, y: 300, width: 20, height: 16 },
      // L'étiquette d'action de la pilule se lit ici : sans exécution, la référence ne
      // montrerait pas ce que la 1.0 ajoute à la pilule.
      execution: { actionId: 'translate-fr', actionName: 'Traduire en français', outputMode: 'display' as const, mode: 'quality' as const },
    };
    if (params.get('screen')) {
      // A screen other than the viewport (e.g. 2560x1400): what Rust would send with the capture.
      const [width, height] = params.get('screen')!.split('x').map(Number);
      Object.assign(capture, { screen: { width, height, scale: 1 } });
    }
    bridge.setDemoCapture(capture, scenario.id === 'long' || scenario.id === 'error' || scenario.id === 'pending' || scenario.id === 'partial' ? scenario.id : 'normal');
    controller.receiveCapture(capture);
  }, [controller]);
  return <div className="standalone-demo" data-preview-background={background} data-lab-phase={controller.state.phase}><GlassOverlay controller={controller}/></div>;
}

// Les Réglages 1.0 posent data-settings-ready une fois réglages et historique chargés. En
// 0.4.0 il n'existe pas : le repli borné garde le banc utilisable avant comme après le portage.
const READY_TIMEOUT_MS = 1500;
function settingsReady(): Promise<boolean> {
  if (document.querySelector('[data-settings-ready="true"]')) return Promise.resolve(true);
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-settings-ready="true"]')) return;
      observer.disconnect(); window.clearTimeout(timer); resolve(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-settings-ready'] });
    const timer = window.setTimeout(() => { observer.disconnect(); resolve(false); }, READY_TIMEOUT_MS);
  });
}

async function settle() {
  const declared = await settingsReady();
  if (scenario.history) {
    // L'historique vit en bas de Confidentialité : la référence doit le montrer.
    const viewport = document.querySelector('.settings-scroll-viewport');
    if (viewport && viewport.scrollHeight > viewport.clientHeight) viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
    else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  }
  // Laisser une peinture passer, sans en dépendre : requestAnimationFrame ne se déclenche
  // pas dans un onglet d'arrière-plan, et le banc s'ouvre souvent derrière une autre fenêtre.
  await new Promise(resolve => { requestAnimationFrame(() => resolve(null)); window.setTimeout(() => resolve(null), 100); });
  document.documentElement.dataset.labReadySource = declared ? 'settings' : 'timeout';
  document.documentElement.dataset.labReady = 'true';
}

async function mount() {
  if (!import.meta.env.DEV || bridge.native) return;
  document.documentElement.dataset.labScenario = scenario.id;
  document.body.className = `app-window app-window-${settingsSurface ? 'settings' : scenario.id === 'capsule' ? 'capsule' : 'overlay'}`;
  if (settingsSurface) {
    const current = await bridge.getSettings();
    if (current.historyEnabled !== Boolean(scenario.history)) await bridge.saveSettings({ ...current, historyEnabled: Boolean(scenario.history) });
    // Ce que la fixture a réellement posé : c'est elle, pas la fenêtre, qui doit être isolée.
    document.documentElement.dataset.labHistory = String((await bridge.getSettings()).historyEnabled);
  }
  createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion={params.get('motion') === 'reduce' ? 'always' : 'never'}>{settingsSurface ? <SettingsWindow/> : scenario.id === 'capsule' ? <div className="standalone-demo" data-preview-background={background}><Capsule/></div> : <OverlayFixture/>}</MotionConfig>);
  if (settingsSurface) void settle();
}
void mount();

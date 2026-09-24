import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Capsule, SettingsWindow } from '../App';
import { GlassOverlay } from '../GlassOverlay';
import { useTranslation } from '../useTranslation';
import { bridge } from '../bridge';
import { scenarioFrom } from './scenarios';
import '../theme.css';
import { MotionPreferences } from '../motion/MotionPreferences';
import { applyMotion } from '../motion/preference';
import { applyMotionPreset } from '../motion/tokens';
import type { MotionPreference, MotionPreset } from '../types';
import '../styles.css';
import '../glass.css';

const params = new URLSearchParams(location.search);
const scenario = scenarioFrom(params.get('scenario')).id;
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
// motion=reduce|full forces the setting « Animations »; without it the frame follows the system.
const motion: MotionPreference = params.get('motion') === 'reduce' ? 'reduced' : params.get('motion') === 'full' ? 'full' : 'system';
const preset: MotionPreset = params.get('preset') === 'bouncy' ? 'bouncy' : 'smooth';

function OverlayFixture() {
  const controller = useTranslation();
  const begun = useRef(false);
  useEffect(() => {
    // Start only after the real hook has installed its listeners and loaded settings.
    if (!controller.settings || begun.current) return;
    begun.current = true;
    if (scenario === 'notice') {
      // What Rust emits when the shortcut finds nothing: repeated so the reference stays visible.
      const show = () => bridge.demoNotice('Rien à traduire dans la fenêtre active.');
      show();
      const timer = window.setInterval(show, 3000);
      return () => window.clearInterval(timer);
    }
    const capture = { id: `lab-${scenario}`, text: scenario === 'long' ? 'Please review the updated proposal. '.repeat(20) : 'Could you send the updated proposal before Thursday?', source: 'selection' as const, canReplace: true, anchor: { x: 400, y: 300, width: 20, height: 16 } };
    if (params.get('screen')) {
      // A screen other than the viewport (e.g. 2560x1400): what Rust would send with the capture.
      const [width, height] = params.get('screen')!.split('x').map(Number);
      Object.assign(capture, { screen: { width, height, scale: 1 } });
    }
    bridge.setDemoCapture(capture, scenario === 'long' || scenario === 'error' || scenario === 'pending' || scenario === 'partial' ? scenario : 'normal');
    controller.receiveCapture(capture);
  }, [controller]);
  return <div className="standalone-demo" data-preview-background={theme} data-lab-phase={controller.state.phase}><GlassOverlay controller={controller}/></div>;
}

async function mount() {
  if (!import.meta.env.DEV || bridge.native) return;
  // The defect reproduction must not hide the production document background.
  if (params.get('surface') !== 'production') document.documentElement.style.colorScheme = theme;
  // The app's tokens follow data-theme (src/theme.css): the scenario's theme is the app's.
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.labScenario = scenario;
  applyMotion(motion);
  applyMotionPreset(preset);
  document.body.className = `flowtranslate-window flowtranslate-${scenario === 'settings' || scenario === 'history' ? 'settings' : 'overlay'}`;
  if (scenario === 'history') {
    await bridge.saveSettings({ ...await bridge.getSettings(), historyEnabled: true });
    const observer = new MutationObserver(() => {
      const history = document.querySelector('.history');
      if (!history) return;
      history.scrollIntoView({ block: 'center', behavior: 'instant' });
      document.documentElement.dataset.labReady = 'true';
      observer.disconnect();
    });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
  }
  createRoot(document.getElementById('root')!).render(<MotionPreferences motion={motion} preset={preset}>{scenario === 'settings' || scenario === 'history' ? <SettingsWindow/> : scenario === 'capsule' ? <div className="standalone-demo" data-preview-background={theme}><Capsule/></div> : <OverlayFixture/>}</MotionPreferences>);
}
void mount();

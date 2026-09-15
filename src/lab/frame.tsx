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
const scenario = scenarioFrom(params.get('scenario')).id;
const theme = params.get('theme') === 'light' ? 'light' : 'dark';

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
    bridge.setDemoCapture(capture, scenario === 'long' || scenario === 'error' || scenario === 'pending' || scenario === 'partial' ? scenario : 'normal');
    controller.receiveCapture(capture);
  }, [controller]);
  return <div className="standalone-demo" data-preview-background={theme} data-lab-phase={controller.state.phase}><GlassOverlay controller={controller}/></div>;
}

async function mount() {
  if (!import.meta.env.DEV || bridge.native) return;
  // The defect reproduction must not hide the production document background.
  if (params.get('surface') !== 'production') document.documentElement.style.colorScheme = theme;
  document.documentElement.dataset.labScenario = scenario;
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
  createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion={params.get('motion') === 'reduce' ? 'always' : 'never'}>{scenario === 'settings' || scenario === 'history' ? <SettingsWindow/> : scenario === 'capsule' ? <div className="standalone-demo" data-preview-background={theme}><Capsule/></div> : <OverlayFixture/>}</MotionConfig>);
}
void mount();

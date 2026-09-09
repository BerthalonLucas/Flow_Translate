import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Icon, SettingSwitch, useFade } from './ui';
import { bridge } from './bridge';
import { GlassOverlay, dragSurface } from './GlassOverlay';
import { useTranslation } from './useTranslation';
import type { Capture, ConnectionStatus, HistoryEntry, Language, Mode, Settings } from './types';

const defaultCapture: Capture = { id: 'demo-selection', text: 'Could you send the updated proposal before Thursday?', source: 'selection', canReplace: true, anchor: { x: 820, y: 410, width: 350, height: 24 } };
const longCapture: Capture = { ...defaultCapture, id: 'demo-long', text: 'Hi Alex,\n\nThank you for your feedback. The updated proposal includes the delivery timeline, responsibilities, and payment terms. Could you confirm these details before Thursday?\n\nWe have kept the total budget unchanged and clarified the review process. Please check the dates and amounts before we share the final version with the team.\n\nBest regards,\nMarie' };
const clipboardCapture: Capture = { id: 'demo-clipboard', text: 'Je vous envoie la proposition mise à jour.', source: 'clipboard', canReplace: false, anchor: null };
const uid = () => crypto.randomUUID?.() ?? `request-${Date.now()}`;

export function Capsule() {
  const fade = useFade();
  const [target, setTarget] = useState<Language>('fr');
  useEffect(() => {
    let off: (() => void) | undefined;
    void bridge.getSettings().then(settings => setTarget(settings.targetLanguage)).catch(() => undefined);
    void bridge.on<Settings>('settings-changed', settings => setTarget(settings.targetLanguage)).then(listener => off = listener);
    return () => off?.();
  }, []);
  return <motion.div {...fade} className="capsule" onPointerDown={event => dragSurface(event)}>
    <button className="capsule-main" onClick={() => void bridge.focusOverlay()} aria-label="Afficher la traduction"><Icon name="clipboard" /><span>{target === 'fr' ? 'Français' : 'English'}</span><Icon name="chevron" /></button>
    <span className="capsule-rule" /><button className="capsule-settings" onClick={() => void bridge.openSettings()} aria-label="Ouvrir les réglages"><Icon name="more" /></button><button className="capsule-close" onClick={() => void bridge.dismiss()} aria-label="Fermer"><Icon name="close" /></button>
  </motion.div>;
}

export function SettingsWindow() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState<Mode | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [connections, setConnections] = useState<Partial<Record<Mode, ConnectionStatus & { signature: string }>>>({});
  const loadSettings = () => { setLoadError(false); void bridge.getSettings().then(setSettings).catch(() => setLoadError(true)); };
  useEffect(() => { loadSettings(); void bridge.getHistory().then(setHistory).catch(() => undefined); }, []);
  if (!settings) return <main className="settings-window"><h1>Réglages</h1><p role={loadError ? 'alert' : 'status'}>{loadError ? 'Les réglages sont indisponibles. Réessayez ou redémarrez FlowTranslate.' : 'Chargement des réglages…'}</p>{loadError && <button className="primary-action" onClick={loadSettings}>Réessayer</button>} <button className="quiet-action" onClick={() => void bridge.closeSettings()}>Fermer</button></main>;
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings({ ...settings, [key]: value });
  const profile = (mode: Mode, key: 'endpoint' | 'model' | 'apiKey', value: string) => setSettings({ ...settings, profiles: { ...settings.profiles, [mode]: { ...settings.profiles[mode], [key]: value } } });
  const save = async () => { try { await bridge.saveSettings(settings); setNotice('Réglages enregistrés sur cet appareil.'); return true; } catch (error) { setNotice(typeof error === 'string' ? error : 'Les réglages n’ont pas été enregistrés. Vérifiez les adresses, modèles et raccourci.'); return false; } };
  const check = async (mode: Mode) => {
    const signature = JSON.stringify(settings.profiles[mode]);
    setChecking(mode);
    setConnections(previous => ({ ...previous, [mode]: undefined }));
    try {
      if (!await save()) return;
      const result = await bridge.checkConnection(mode);
      setConnections(previous => ({ ...previous, [mode]: { ...result, signature } }));
      setNotice(`${mode === 'quality' ? 'Qualité' : 'Rapide'} : ${result.message}`);
    } catch {
      setConnections(previous => ({ ...previous, [mode]: { connected: false, message: 'Vérification impossible. Démarrez le serveur puis vérifiez la connexion avancée.', signature } }));
      setNotice('Réglages enregistrés. La vérification de connexion a échoué.');
    } finally { setChecking(null); }
  };
  const activeConnection = connections[settings.mode];
  const verified = activeConnection?.signature === JSON.stringify(settings.profiles[settings.mode]) ? activeConnection : undefined;
  const removeHistory = async (id: string | null) => { try { await bridge.deleteHistory(id); setHistory(await bridge.getHistory()); } catch { setNotice('La suppression a échoué.'); } };
  return <main className="settings-window">
    <header><div><span className="product-mark">FlowTranslate</span><h1>Réglages</h1></div><button className="close-settings" onClick={() => void bridge.closeSettings()} aria-label="Fermer"><Icon name="close" /></button></header>
    <section><h2>Traduction</h2><div className="setting-grid"><label>Langue cible<select value={settings.targetLanguage} onChange={e => update('targetLanguage', e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option></select></label><label>Mode par défaut<select value={settings.mode} onChange={e => update('mode', e.target.value as Mode)}><option value="quality">Qualité</option><option value="fast">Rapide</option></select></label><label className="wide">Raccourci<input value={settings.shortcut} onChange={e => update('shortcut', e.target.value)} /></label></div></section>
    <section className="engine-readiness" aria-label="Connexion du moteur"><div className="profile-heading"><h2>Moteur {settings.mode === 'quality' ? 'Qualité' : 'Rapide'}</h2><button className="text-button" disabled={checking !== null} onClick={() => void check(settings.mode)}>{checking === settings.mode ? 'Vérification…' : 'Enregistrer et vérifier le moteur'}</button></div><p>{bridge.native ? 'Serveur de traduction' : 'Aperçu navigateur · connexion simulée'} · {settings.profiles[settings.mode].model || 'Modèle à renseigner'}</p><p role="status">{checking === settings.mode ? 'Vérification de la disponibilité du modèle…' : verified ? `${verified.connected ? 'Modèle disponible' : 'Connexion indisponible'} : ${verified.message}` : settings.profiles[settings.mode].endpoint ? 'Connexion non vérifiée. Vérifiez le moteur avant votre premier essai.' : 'Adresse du serveur à renseigner dans Connexion avancée.'}</p>{verified && !verified.connected && <p>Démarrez le serveur et vérifiez l’adresse, le modèle et la clé dans Connexion avancée, puis réessayez.</p>}<small>Cette vérification n’envoie aucun texte à traduire.</small></section>
    <section><h2>Sur cet appareil</h2><SettingSwitch label="Conserver l’historique chiffré" checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} detail={`${history.length} entrée${history.length > 1 ? 's' : ''}`} /><SettingSwitch label="Lancer à l’ouverture de session" checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} />{settings.historyEnabled && <div className="history"><div className="history-heading"><strong>Historique</strong><button className="text-button" onClick={() => void removeHistory(null)} disabled={!history.length}>Tout supprimer</button></div>{history.length ? history.map(item => <article key={item.id}><div><p>{item.translatedText}</p><small>{item.mode === 'quality' ? 'Qualité' : 'Rapide'} · {new Date(item.createdAt).toLocaleDateString('fr-FR')}</small></div><button className="icon-button dark-icon" onClick={() => void removeHistory(item.id)} aria-label="Supprimer cette entrée"><Icon name="close" /></button></article>) : <p className="empty-history">Aucune traduction enregistrée.</p>}</div>}</section>
    <section className="advanced"><button className="advanced-toggle" onClick={() => setAdvanced(value => !value)} aria-expanded={advanced}>Connexion avancée <Icon name="chevron" /></button>{advanced && <div className="advanced-content">{(['quality', 'fast'] as Mode[]).map(mode => <div className="profile" key={mode}><div className="profile-heading"><strong>{mode === 'quality' ? 'Qualité' : 'Rapide'}</strong><button className="text-button" onClick={() => void check(mode)} disabled={checking !== null}>{checking === mode ? 'Vérification…' : 'Enregistrer et vérifier'}</button></div><label>Adresse<input type="url" placeholder="https://serveur.exemple/v1" value={settings.profiles[mode].endpoint} onChange={e => profile(mode, 'endpoint', e.target.value)} /></label><label>Modèle<input value={settings.profiles[mode].model} onChange={e => profile(mode, 'model', e.target.value)} /></label><label>Clé API<input type="password" autoComplete="new-password" placeholder="Conservée uniquement par Windows" value={settings.profiles[mode].apiKey} onChange={e => profile(mode, 'apiKey', e.target.value)} /></label></div>)}</div>}</section>
    <footer><span aria-live="polite">{notice}</span><button className="primary-action" disabled={checking !== null} onClick={() => void save()}>Enregistrer</button></footer>
  </main>;
}

function DemoDesktop({ controller }: { controller: ReturnType<typeof useTranslation> }) {
  const [scenario, setScenario] = useState<'selection' | 'clipboard' | 'long' | 'very-long' | 'error'>('selection');
  const capture = scenario === 'clipboard' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
  const begin = () => { const next = { ...capture, id: uid() }; bridge.setDemoCapture(next, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal'); controller.receiveCapture(next); };
  return <main className="demo-desktop">
    <aside className="demo-sidebar"><span className="demo-logo">FT</span><span>Courrier</span><span>Messages</span><span>Réglages</span></aside>
    <section className="demo-mail"><div className="demo-toolbar"><span>✉ Nouveau message</span><span className="demo-search">Rechercher</span><span>Envoyer</span></div><div className="demo-recipient"><span>À</span><b>alex.martin@exemple.com</b></div><div className="mail-copy"><p>Bonjour Alex,</p><p>Je vous envoie la proposition mise à jour.</p><p>Bonne journée,<br/>Marie</p></div></section>
    <aside className="demo-panel"><span className="demo-badge">Aperçu navigateur</span><h1>FlowTranslate</h1><p>Réponses simulées. Cet aperçu vérifie les composants ; le rendu Windows, le focus et le déplacement se testent dans l’application.</p><fieldset><legend>Scénario</legend><label><input type="radio" checked={scenario === 'selection'} onChange={() => setScenario('selection')} /> Sélection</label><label><input type="radio" checked={scenario === 'clipboard'} onChange={() => setScenario('clipboard')} /> Presse-papiers</label><label><input type="radio" checked={scenario === 'long'} onChange={() => setScenario('long')} /> Texte long</label><label><input type="radio" checked={scenario === 'very-long'} onChange={() => setScenario('very-long')} /> Texte très long</label><label><input type="radio" checked={scenario === 'error'} onChange={() => setScenario('error')} /> Erreur réseau</label></fieldset><button className="primary-action demo-start" onClick={begin}>Simuler Ctrl + Alt + T</button><button className="text-button settings-link" onClick={() => location.assign('?window=settings&demo=1')}>Voir les réglages</button></aside>
    <div className="demo-selection">Could you send the updated proposal before Thursday?</div>
    <GlassOverlay controller={controller} />
  </main>;
}

function OverlayWindow({ standaloneDemo }: { standaloneDemo: boolean }) {
  const controller = useTranslation(true);
  const [background, setBackground] = useState(() => {
    const requested = new URLSearchParams(location.search).get('background');
    return requested === 'light' || requested === 'dark' ? requested : 'color';
  });
  const { receiveCapture, initError } = controller;
  const demoStarted = useRef(false);
  useEffect(() => {
    if (!demoStarted.current && standaloneDemo) {
      demoStarted.current = true;
      const scenario = new URLSearchParams(location.search).get('scenario');
      const capture = scenario === 'confirmation' ? clipboardCapture : scenario === 'long' || scenario === 'very-long' ? longCapture : defaultCapture;
      bridge.setDemoCapture(capture, scenario === 'error' ? 'error' : scenario === 'very-long' ? 'very-long' : scenario === 'long' ? 'long' : 'normal');
      receiveCapture(capture);
    }
  }, [standaloneDemo, receiveCapture]);
  return <div className={standaloneDemo ? 'standalone-demo' : 'native-overlay'} data-preview-background={standaloneDemo ? background : undefined}>{initError && <div className="initialization-error"><p role="alert">{initError} Relancez l’application si le problème persiste.</p><button className="quiet-action" onClick={() => location.reload()}>Réessayer</button> <button className="quiet-action" onClick={() => void bridge.openSettings()}>Réglages</button> <button className="quiet-action" onClick={() => void bridge.dismiss()}>Fermer</button></div>}{standaloneDemo && <>
    <span className="preview-label">Aperçu navigateur · réponse simulée</span>
    <div className="preview-backgrounds" role="group" aria-label="Fond de l’aperçu">
      {([['light', 'Clair'], ['dark', 'Sombre'], ['color', 'Coloré']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={background === value} onClick={() => setBackground(value)}>{label}</button>)}
    </div>
  </>}<GlassOverlay controller={controller} /></div>;
}

function DemoWindow() { return <DemoDesktop controller={useTranslation(false)} />; }

export function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const windowName = params.get('window') ?? (bridge.native ? 'overlay' : 'demo');
  const standaloneDemo = params.get('demo') === '1';
  useEffect(() => { document.body.className = `flowtranslate-window flowtranslate-${windowName}`; return () => { document.body.className = ''; }; }, [windowName]);
  if (windowName === 'settings') return <SettingsWindow />;
  if (windowName === 'capsule') return <Capsule />;
  if (windowName === 'overlay' && (bridge.native || standaloneDemo)) return <OverlayWindow standaloneDemo={standaloneDemo} />;
  return <DemoWindow />;
}

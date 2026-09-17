import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import { Badge, Button, Callout, Field, Segmented, StatusBadge } from './controls';
import { modeLabel, type Connection } from './SettingsWindow';
import type { Mode, Settings, SettingsTarget } from '../types';

type Props = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K], immediate?: boolean) => void;
  persist: (settings: Settings, immediate: boolean) => void;
  persistNow: (settings: Settings) => Promise<boolean>;
  connections: Record<Mode, Connection>;
  check: (mode: Mode) => Promise<void>;
  forget: (mode: Mode) => void;
  target: SettingsTarget | null;
};

const placeholder: Record<Mode, string> = { quality: 'http://127.0.0.1:8002/v1', fast: 'http://127.0.0.1:8001/v1' };
// 0.4.0 relaunches with the other engine without recording it (`useTranslation.ts`): say so plainly.
const defaultEngineHelp = 'Qualité\u00A0: plus lent, meilleures tournures. Le menu ⋯ d’un résultat relance avec l’autre, sans changer ce réglage.';

export function EnginesPage({ settings, update, persist, persistNow, connections, check, forget, target }: Props) {
  return <>
    <header className="page-head">
      <div><h1 className="page-title">Moteurs</h1><p className="page-desc">Tout serveur compatible OpenAI, local de préférence.</p></div>
    </header>
    <section className="setting-group">
      <div className="setting-card">
        <div className="setting-row">
          <div className="setting-copy"><span className="setting-label">Moteur par défaut</span><span className="setting-desc">{defaultEngineHelp}</span></div>
          <div className="setting-control"><Segmented<Mode> label="Moteur par défaut" value={settings.mode}
            options={[{ value: 'quality', label: 'Qualité' }, { value: 'fast', label: 'Rapide' }]}
            onChange={value => update('mode', value)} /></div>
        </div>
      </div>
    </section>
    {/* 0.5.0 keeps exactly two engines: servers, names and places arrive with 0.6.0. */}
    {(['quality', 'fast'] as Mode[]).map(mode => <EngineCard key={mode} mode={mode} settings={settings} persist={persist} persistNow={persistNow}
      connection={connections[mode]} check={check} forget={forget}
      highlighted={target?.engine === mode} reason={target?.engine === mode ? target.reason : undefined} />)}
  </>;
}

function statusText(connection: Connection) {
  if (connection.state === 'checking') return 'Vérification…';
  if (connection.state === 'ok') return `Connecté · ${connection.latencyMs} ms`;
  if (connection.state === 'error') return 'Échec de connexion';
  return 'Non vérifié';
}

function EngineCard({ mode, settings, persist, persistNow, connection, check, forget, highlighted, reason }: {
  mode: Mode; settings: Settings; persist: Props['persist']; persistNow: Props['persistNow'];
  connection: Connection; check: Props['check']; forget: Props['forget']; highlighted: boolean; reason?: string;
}) {
  const profile = settings.profiles[mode];
  // Typing an address never saves and never complains: « http://1 » is a half-typed address, not a
  // refusal. The blur runs `validate_endpoint`, and only an accepted address reaches the disk.
  const [draft, setDraft] = useState(profile.endpoint);
  const [error, setError] = useState('');
  const editing = useRef(false);
  const card = useRef<HTMLElement>(null);
  useEffect(() => { if (!editing.current) setDraft(profile.endpoint); }, [profile.endpoint]);
  useEffect(() => { if (highlighted) card.current?.scrollIntoView({ block: 'nearest' }); }, [highlighted]);

  // Model and key keep the 300 ms typing delay; any change forgets the connection state.
  const write = (key: 'model' | 'apiKey', value: string) => {
    forget(mode);
    persist({ ...settings, profiles: { ...settings.profiles, [mode]: { ...profile, [key]: value } } }, false);
  };
  const commitEndpoint = async () => {
    editing.current = false;
    if (draft === profile.endpoint) return;
    try { await bridge.validateEndpoint(draft); }
    catch (refusal) { setError(typeof refusal === 'string' ? refusal : 'L’adresse du serveur est invalide.'); return; }
    setError('');
    forget(mode);
    // The address is on disk before the check leaves: `check_connection` reads the saved settings.
    if (await persistNow({ ...settings, profiles: { ...settings.profiles, [mode]: { ...profile, endpoint: draft } } })) void check(mode);
  };

  return <section className="setting-group engine-card" ref={card} data-engine={mode} data-highlighted={highlighted || undefined}>
    <div className="setting-card">
      <div className="engine-head">
        <span className="engine-name">{modeLabel(mode)}</span>
        {settings.mode === mode && <Badge tone="signal">Par défaut</Badge>}
        <StatusBadge state={connection.state} text={statusText(connection)} />
        <Button variant="secondary" size="sm" icon="refresh-cw" disabled={connection.state === 'checking'} onClick={() => void check(mode)}>Vérifier</Button>
      </div>
      <div className="engine-body">
        <div className="grid-2">
          <Field label="Adresse" error={error || undefined}>
            <input className="settings-input" type="url" inputMode="url" spellCheck={false} placeholder={placeholder[mode]} value={draft}
              aria-invalid={Boolean(error) || undefined}
              onFocus={() => { editing.current = true; }}
              onChange={event => { setDraft(event.target.value); if (error) setError(''); }}
              onBlur={() => void commitEndpoint()} />
          </Field>
          <Field label="Modèle">
            <input className="settings-input" spellCheck={false} value={profile.model} onChange={event => write('model', event.target.value)} />
          </Field>
        </div>
        <Field label="Clé API" hint="Chiffrée par Windows (DPAPI), jamais écrite en clair.">
          <input className="settings-input" type="password" autoComplete="new-password" placeholder="Facultative pour un serveur local" value={profile.apiKey}
            onChange={event => write('apiKey', event.target.value)} />
        </Field>
        {connection.state === 'error' && connection.message && <Callout tone="danger">{connection.message}</Callout>}
        {reason && <Callout tone="danger">{reason}</Callout>}
        {!bridge.native && <p className="preview-note">Aperçu navigateur · connexion simulée</p>}
      </div>
    </div>
  </section>;
}

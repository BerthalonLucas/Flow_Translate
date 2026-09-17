import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';
import { Button, Icon, IconButton, SettingSwitch } from './controls';
import { modeLabel } from './SettingsWindow';
import type { HistoryEntry, Settings } from '../types';

type Props = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K], immediate?: boolean) => void;
  history: HistoryEntry[];
  onRemove: (id: string | null) => Promise<void>;
};

export function PrivacyPage({ settings, update, history, onRemove }: Props) {
  return <>
    <header className="page-head">
      <div><h1 className="page-title">Confidentialité</h1><p className="page-desc">Rien ne quitte l’appareil, hors le moteur distant que vous auriez choisi.</p></div>
    </header>
    <section className="setting-group">
      <div className="setting-card">
        <div className="setting-row">
          <div className="setting-copy"><span className="setting-label">Conserver l’historique chiffré</span><span className="setting-desc">7 jours, 100 entrées, protégé par Windows (DPAPI).</span></div>
          <div className="setting-control"><SettingSwitch label="Conserver l’historique chiffré" checked={settings.historyEnabled} onCheckedChange={checked => update('historyEnabled', checked)} /></div>
        </div>
        <div className="setting-row">
          <div className="setting-copy"><span className="setting-label">Lancer à l’ouverture de session</span><span className="setting-desc">Seule l’icône de la zone de notification reste visible.</span></div>
          <div className="setting-control"><SettingSwitch label="Lancer à l’ouverture de session" checked={settings.autostart} onCheckedChange={checked => update('autostart', checked)} /></div>
        </div>
      </div>
    </section>
    {settings.historyEnabled && <section className="setting-group">
      <h2 className="setting-group-title">Historique</h2>
      <HistoryList entries={history} onRemove={onRemove} />
    </section>}
  </>;
}

// Absolute, locale-stable dates: the references must not drift day to day.
function historyDate(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Never the source text, here or anywhere else. Copying goes through Rust by id: the frontend holds
// no stored text and never hands one to the clipboard itself.
function HistoryList({ entries, onRemove }: { entries: HistoryEntry[]; onRemove: (id: string | null) => Promise<void> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (id: string) => {
    try {
      await bridge.copyHistory(id);
      setError('');
      setCopied(id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(current => current === id ? null : current), 1600);
    } catch { setError('Copie indisponible. Réessayez.'); }
  };
  if (!entries.length) return <div className="setting-card history-list">
    <p className="history-empty"><Icon name="history" size={16} />Aucun résultat enregistré.</p>
  </div>;
  return <div className="setting-card history-list">
    {entries.map(entry => <article className="history-item" key={entry.id}>
      <div className="history-copy">
        <p className="history-text">{entry.translatedText}</p>
        <span className="history-meta">{entry.actionName} · {modeLabel(entry.mode)} · {historyDate(entry.createdAt)}</span>
      </div>
      <div className="history-actions">
        <IconButton label={copied === entry.id ? 'Copié' : 'Copier le résultat'} data-copied={copied === entry.id || undefined} onClick={() => void copy(entry.id)}>
          <Icon name={copied === entry.id ? 'check' : 'copy'} size={16} />
        </IconButton>
        <IconButton label="Supprimer cette entrée" variant="danger" onClick={() => void onRemove(entry.id)}><Icon name="trash-2" size={16} /></IconButton>
      </div>
    </article>)}
    {error && <p className="history-error" role="alert">{error}</p>}
    <div className="history-foot">
      <span>{entries.length} entrée{entries.length > 1 ? 's' : ''} · 7 jours au plus</span>
      <Button variant="danger" size="sm" onClick={() => void onRemove(null)}>Tout supprimer</Button>
    </div>
  </div>;
}

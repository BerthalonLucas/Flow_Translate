import { Icon, Segmented } from './controls';
import type { AutoClose, Settings, TextSize } from '../types';

const sample = 'Pourriez-vous envoyer la proposition mise à jour avant jeudi ?';

type Props = { settings: Settings; update: <K extends keyof Settings>(key: K, value: Settings[K], immediate?: boolean) => void };

// « 16, 18 ou 20 px » cannot be judged from figures: the page shows the glass at the chosen size.
// The preview carries its own class names: `glass.css` is loaded in this window too, and `publish()`
// requires exactly one element per measured selector, so `.translation-bubble` must not be reused.
export function ReadingPage({ settings, update }: Props) {
  return <>
    <header className="page-head">
      <div><h1 className="page-title">Lecture</h1><p className="page-desc">Comment le résultat s’affiche, et quand il s’efface.</p></div>
    </header>
    <section className="setting-group">
      <h2 className="setting-group-title">Aperçu</h2>
      <div className="reading-stage">
        <div className="reading-preview" data-size={settings.textSize}>
          <span className="reading-preview-pill" aria-hidden="true">
            <span className="reading-preview-tag">Traduire en français</span>
            <Icon name="copy" size={15} /><Icon name="ellipsis" size={15} /><Icon name="x" size={13} />
          </span>
          <p className="reading-preview-copy">{sample}</p>
        </div>
      </div>
    </section>
    <section className="setting-group">
      <h2 className="setting-group-title">Affichage</h2>
      <div className="setting-card">
        <div className="setting-row">
          <div className="setting-copy"><span className="setting-label">Taille du texte</span><span className="setting-desc">Verre court 16 px · bande 22 px. La bande occupe la moitié de l’écran.</span></div>
          <div className="setting-control"><Segmented<TextSize> label="Taille du texte" value={settings.textSize}
            options={[{ value: 'normal', label: 'Normale' }, { value: 'large', label: 'Grande' }, { value: 'xlarge', label: 'Très grande' }]}
            onChange={value => update('textSize', value)} /></div>
        </div>
        <div className="setting-row">
          <div className="setting-copy"><span className="setting-label">Fermeture automatique</span><span className="setting-desc">Le temps de lecture estimé, puis un fondu. Survoler ou épingler la retient.</span></div>
          <div className="setting-control"><Segmented<AutoClose> label="Fermeture automatique" value={settings.autoClose}
            options={[{ value: 'fast', label: 'Rapide' }, { value: 'normal', label: 'Normale' }, { value: 'slow', label: 'Lente' }, { value: 'never', label: 'Jamais' }]}
            onChange={value => update('autoClose', value)} /></div>
        </div>
      </div>
    </section>
  </>;
}

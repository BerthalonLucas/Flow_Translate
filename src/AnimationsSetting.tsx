import { Segmented } from './ui';
import { useSystemReducesMotion } from './motion/MotionPreferences';
import type { MotionPreference } from './types';

// « Animations : suivre Windows / toujours / réduites » (lot 2). Lucas had « Effets
// d'animation » switched off without knowing it: in « suivre Windows », say when Windows is
// the one reducing. The strings move to src/i18n.ts when lot 1 is merged.
export function AnimationsSetting({ value, onChange }: { value: MotionPreference; onChange: (value: MotionPreference) => void }) {
  const systemReduces = useSystemReducesMotion();
  return <div className="setting-row"><div className="setting-copy"><strong>Animations</strong><small>Réduites : fondus courts seulement, sans ressort ni déplacement.</small>
    {value === 'system' && systemReduces && <small className="setting-notice" role="status">Windows demande de réduire les animations.</small>}</div>
    <Segmented<MotionPreference> label="Animations" value={value} options={[{ value: 'system', label: 'Suivre Windows' }, { value: 'full', label: 'Toujours' }, { value: 'reduced', label: 'Réduites' }]} onChange={onChange} /></div>;
}

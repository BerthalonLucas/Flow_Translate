import { Segmented } from './ui';
import { useT } from './i18n';
import { useSystemReducesMotion } from './motion/MotionPreferences';
import type { MotionPreference } from './types';

// « Animations : suivre Windows / toujours / réduites » (lot 2). Lucas had « Effets
// d'animation » switched off without knowing it: in « suivre Windows », say when Windows is
// the one reducing.
export function AnimationsSetting({ value, onChange }: { value: MotionPreference; onChange: (value: MotionPreference) => void }) {
  const t = useT();
  const systemReduces = useSystemReducesMotion();
  return <div className="setting-row"><div className="setting-copy"><strong>{t('settings.animations')}</strong><small>{t('settings.animationsHelp')}</small>
    {value === 'system' && systemReduces && <small className="setting-notice" role="status">{t('settings.animationsSystemReduces')}</small>}</div>
    <Segmented<MotionPreference> label={t('settings.animations')} value={value} options={[{ value: 'system', label: t('settings.animationsSystem') }, { value: 'full', label: t('settings.animationsFull') }, { value: 'reduced', label: t('settings.animationsReduced') }]} onChange={onChange} /></div>;
}

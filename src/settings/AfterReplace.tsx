import { Segmented, SettingSwitch } from '../ui';
import { useT } from '../i18n';
import type { AfterReplace, PillPlacement, Settings, UndoStrategy } from '../types';

export const undoRange = { min: 2, max: 20 } as const;
// The longest the changed words stay without an action in the text (Rust accepts 5 to 120 s).
export const changedWordsChoices = [15, 30, 60, 120] as const;
type Props = { settings: Settings; persist: (settings: Settings, immediate: boolean) => void };
// « After replacing » (lot 9's settings, docs/DA-PLAN.md): the check, Undo with its time and
// its method (decision 2: Ctrl+Z in the app by default, or the original pasted back), the
// changed words with the longest they stay (until the next action in the text, Lucas 25/09),
// and where the pill rests (never over the new text).
export function AfterReplaceSettings({ settings, persist }: Props) {
  const t = useT();
  const after = settings.afterReplace;
  const set = (patch: Partial<AfterReplace>, immediate = true) => persist({ ...settings, afterReplace: { ...after, ...patch } }, immediate);
  const seconds = Math.min(undoRange.max, Math.max(undoRange.min, Math.round(after.undoSeconds)));
  return <section className="after-settings">
    <h2>{t('after.title')}</h2>
    <div className="setting-row"><div className="setting-copy"><strong>{t('after.check')}</strong><small>{t('after.checkHelp')}</small></div>
      <SettingSwitch label={t('after.check')} checked={after.check} onCheckedChange={check => set({ check })} /></div>
    <div className="setting-row"><div className="setting-copy"><strong>{t('after.undo')}</strong><small>{t('after.undoHelp')}</small></div>
      <SettingSwitch label={t('after.undo')} checked={after.undo} onCheckedChange={undo => set({ undo })} /></div>
    {after.undo && <>
      <div className="setting-row setting-sub"><div className="setting-copy"><strong id="undo-seconds-label">{t('after.undoSeconds')}</strong><small>{t('after.undoSecondsHelp')}</small></div>
        <span className="range-control">
          {/* Saved after a pause: a drag or held arrow keys run through many values. */}
          <input type="range" min={undoRange.min} max={undoRange.max} step={1} value={seconds} aria-labelledby="undo-seconds-label" aria-valuetext={t('after.seconds', { count: seconds })} onChange={event => set({ undoSeconds: Number(event.target.value) }, false)} />
          <output aria-hidden="true">{t('after.seconds', { count: seconds })}</output>
        </span></div>
      <div className="setting-row setting-sub"><div className="setting-copy"><strong>{t('after.strategy')}</strong><small>{t('after.strategyHelp')}</small></div>
        <Segmented<UndoStrategy> label={t('after.strategy')} value={settings.undoStrategy} options={[{ value: 'keystroke', label: t('after.strategyKeystroke') }, { value: 'repaste', label: t('after.strategyRepaste') }]} onChange={undoStrategy => persist({ ...settings, undoStrategy }, true)} /></div>
    </>}
    <div className="setting-row"><div className="setting-copy"><strong>{t('after.changedWords')}</strong><small>{t('after.changedWordsHelp')}</small></div>
      <SettingSwitch label={t('after.changedWords')} checked={after.changedWords} onCheckedChange={changedWords => set({ changedWords })} /></div>
    {after.changedWords && <div className="setting-row setting-sub"><div className="setting-copy"><strong>{t('after.changedWordsSeconds')}</strong><small>{t('after.changedWordsSecondsHelp')}</small></div>
      <Segmented<string> label={t('after.changedWordsSeconds')} value={String(after.changedWordsSeconds)} options={changedWordsChoices.map(count => ({ value: String(count), label: count < 60 ? t('after.seconds', { count }) : t('after.minutes', { count: count / 60 }) }))} onChange={value => set({ changedWordsSeconds: Number(value) })} /></div>}
    <div className="setting-row"><div className="setting-copy"><strong>{t('after.placement')}</strong><small>{t('after.placementHelp')}</small></div>
      <Segmented<PillPlacement> label={t('after.placement')} value={settings.pillPlacement} options={[{ value: 'below', label: t('after.placementBelow') }, { value: 'margin', label: t('after.placementMargin') }]} onChange={pillPlacement => persist({ ...settings, pillPlacement }, true)} /></div>
  </section>;
}

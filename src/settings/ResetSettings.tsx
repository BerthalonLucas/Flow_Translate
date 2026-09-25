import { useEffect, useRef, useState } from 'react';
import { menuShortcut } from '../actionDefaults';
import { useT } from '../i18n';
import type { Settings } from '../types';

type State = { step: 'idle' | 'asking' | 'resetting' | 'failed' } | { step: 'done'; kept: string | null };
// « Restore default settings » (Lucas, 24/09), at the end of « On this device »: asked once more
// in its row (Keep my settings first, focused, and Escape keeps them), then `reset` asks Rust
// (settings::reset) and answers what it saved; it rejects when nothing was restored. When Windows
// refused the default menu chord, the menu kept its own (settings::keep_menu_chord): the row says so.
export function ResetSettings({ reset }: { reset: () => Promise<Settings> }) {
  const t = useT();
  const [state, setState] = useState<State>({ step: 'idle' });
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (state.step === 'asking') keep.current?.focus(); }, [state.step]);
  const confirm = async () => {
    setState({ step: 'resetting' });
    try {
      const saved = await reset();
      const chord = saved.shortcutBindings.find(binding => binding.kind === 'menu' && binding.enabled)?.shortcut ?? null;
      setState({ step: 'done', kept: chord && chord !== menuShortcut ? chord : null });
    } catch { setState({ step: 'failed' }); }
  };
  const asking = state.step === 'asking' || state.step === 'resetting';
  const help = asking ? t('settings.resetConfirm')
    : state.step === 'done' ? state.kept ? t('settings.resetDoneKept', { default: menuShortcut, shortcut: state.kept }) : t('settings.resetDone')
    : t('settings.resetHelp');
  return <div className="setting-row reset-row" data-field="reset">
    <div className="setting-copy"><strong>{t('settings.reset')}</strong><small role={state.step === 'done' ? 'status' : undefined}>{help}</small></div>
    {asking
      ? <div className="reset-confirm" onKeyDown={event => { if (event.key === 'Escape' && state.step === 'asking') { event.preventDefault(); setState({ step: 'idle' }); } }}>
          <button ref={keep} type="button" className="quiet-action" disabled={state.step === 'resetting'} onClick={() => setState({ step: 'idle' })}>{t('settings.resetKeep')}</button>
          <button type="button" className="primary-action" disabled={state.step === 'resetting'} onClick={() => void confirm()}>{t('settings.resetConfirmAction')}</button>
        </div>
      : <button type="button" className="text-button" onClick={() => setState({ step: 'asking' })}>{t('settings.resetAction')}</button>}
    {state.step === 'failed' && <p className="row-warning" role="alert">{t('settings.resetFailed')}</p>}
  </div>;
}

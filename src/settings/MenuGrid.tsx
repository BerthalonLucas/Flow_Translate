import { useEffect, useRef, useState } from 'react';
import { Icon, IconButton, type IconName } from '../ui';
import { useT } from '../i18n';
import type { ActionDefinition, Settings } from '../types';
import { addToGrid, gridLimit, letterProblem, moveInGrid, nextLetter, removeFromGrid, withoutKey, type LetterProblem } from './grid';

// The Lucide name an action carries (actions.rs) → the app's thin icon; a custom action
// shows the free-instruction wand, as its tile does.
const glyphs: Record<string, IconName> = { SpellCheck: 'fix', Languages: 'translate', BriefcaseBusiness: 'professional', FoldVertical: 'shorten', Mail: 'email' };
const glyphOf = (action: ActionDefinition): IconName => glyphs[action.icon ?? ''] ?? 'custom';

type Props = { settings: Settings; persist: (settings: Settings, immediate: boolean) => void };
// « In the menu »: the Îlot's tiles in their order (6 at most, decision 6), each with its
// letter. Up/down buttons move a tile (keyboard included); a letter is checked here, in
// line, before anything is saved.
export function MenuGrid({ settings, persist }: Props) {
  const t = useT();
  const grid = settings.menuActionIds.map(id => settings.actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action));
  const others = settings.actions.filter(action => !settings.menuActionIds.includes(action.id));
  // An invalid letter stays in its field with its reason, unsaved.
  const [drafts, setDrafts] = useState<Record<string, { letter: string; problem: LetterProblem }>>({});
  // A moved row is re-inserted in the DOM, which drops the focus: give it back to its button.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [refocus, setRefocus] = useState<string | null>(null);
  useEffect(() => {
    if (!refocus) return;
    const [id, direction] = refocus.split('\n');
    const other = direction === 'up' ? 'down' : 'up';
    const target = buttons.current.get(`${id}\n${direction}`);
    (target && !target.disabled ? target : buttons.current.get(`${id}\n${other}`))?.focus();
    setRefocus(null);
  }, [refocus]);
  const move = (id: string, delta: -1 | 1) => { persist({ ...settings, menuActionIds: moveInGrid(settings.menuActionIds, id, delta) }, true); setRefocus(`${id}\n${delta < 0 ? 'up' : 'down'}`); };
  const setLetter = (action: ActionDefinition, typed: string) => {
    const letter = nextLetter(typed, drafts[action.id]?.letter ?? action.key ?? '');
    const problem = letterProblem(letter, action.id, settings.actions);
    setDrafts(({ [action.id]: _previous, ...rest }) => problem ? { ...rest, [action.id]: { letter, problem } } : rest);
    if (!problem) persist({ ...settings, actions: settings.actions.map(item => item.id !== action.id ? item : letter ? { ...item, key: letter } : withoutKey(item)) }, true);
  };
  const ref = (key: string) => (element: HTMLButtonElement | null) => { if (element) buttons.current.set(key, element); else buttons.current.delete(key); };
  return <div className="menu-grid">
    <div className="subsection-heading"><div><h3>{t('grid.title')}</h3><p>{t('grid.intro')}</p></div></div>
    {grid.length ? <ol className="grid-list" aria-label={t('grid.list')}>{grid.map((action, index) => {
      const draft = drafts[action.id];
      const letterId = `grid-letter-${action.id}`;
      return <li key={action.id} className="grid-item" data-invalid={draft ? true : undefined}>
        <span className="grid-index" aria-hidden="true">{index + 1}</span>
        <span className="grid-glyph"><Icon name={glyphOf(action)} size={15} /></span>
        <span className="grid-name">{action.name || t('actions.untitled')}</span>
        <input id={letterId} className="grid-letter" aria-label={t('grid.letter', { name: action.name })} aria-invalid={draft ? true : undefined} aria-describedby={draft ? `${letterId}-problem` : undefined} value={draft?.letter ?? action.key ?? ''} autoComplete="off" spellCheck={false} onFocus={event => event.currentTarget.select()} onChange={event => setLetter(action, event.target.value)} />
        <span className="grid-moves">
          <IconButton ref={ref(`${action.id}\nup`)} label={t('grid.up', { name: action.name })} disabled={index === 0} onClick={() => move(action.id, -1)}><Icon name="up" size={14} /></IconButton>
          <IconButton ref={ref(`${action.id}\ndown`)} label={t('grid.down', { name: action.name })} disabled={index === grid.length - 1} onClick={() => move(action.id, 1)}><Icon name="chevron" size={14} /></IconButton>
          <IconButton label={t('grid.remove', { name: action.name })} onClick={() => { setDrafts(({ [action.id]: _removed, ...rest }) => rest); persist(removeFromGrid(settings, action.id), true); }}><Icon name="close" size={14} /></IconButton>
        </span>
        {draft && <p id={`${letterId}-problem`} className="row-warning grid-problem" role="alert">{t(draft.problem.key, draft.problem.params)}</p>}
      </li>;
    })}</ol> : <p className="settings-help">{t('grid.empty')}</p>}
    {grid.length < gridLimit
      ? others.length > 0 && <label className="grid-add">{t('grid.add')}<select value="" onChange={event => { if (event.target.value) persist(addToGrid(settings, event.target.value), true); }}>
        <option value="">{t('grid.addPlaceholder')}</option>
        {others.map(action => <option key={action.id} value={action.id}>{action.name || t('actions.untitled')}</option>)}
      </select></label>
      : <p className="settings-help">{t('grid.full')}</p>}
    <p className="settings-help">{t('grid.free')}</p>
  </div>;
}

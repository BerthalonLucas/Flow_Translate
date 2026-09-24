import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { useT } from '../i18n';
import { Icon, iconFromLucide } from '../ui';
import { ilotKeyContext, keyInputOf, resolveIlotKey, tileCommand, type CompactItem, type IlotAction, type IlotCommand, type IlotMode, type IlotTile, type KeyInput } from './keys';
import { ilotMetrics } from './metrics';
import { MorphSurface, type ShapeChange, type SurfaceOrigin, type SurfaceSize } from './MorphSurface';
import './ilot.css';

/*
 * The Îlot (docs/DA-PLAN.md lot 7, UI-DECISIONS default decision 6), after the design lab's
 * `Ilot` (design-lab/src/menus.jsx:57-86). A small glass island by the selection:
 *   compact  the last action (Enter relaunches it) · the ✦ pastille for a free instruction;
 *   grid     Tab, ↓ or a pointer resting 450 ms unfold a 3 × 2 grid of 66 × 50 tiles
 *            (218 × 116, radius 16);
 *   prompt   Space, « / », the pastille, the free tile or any unassigned character open a real
 *            <input> (≈ 283 × 34), already holding that character.
 * Letters (action.key), digits 1-6, arrows, Enter; Escape goes back one step, then closes. The
 * key table is the pure function of ./keys.ts. Driven by its props only, no native bridge.
 *
 * API
 *   actions        the menu's actions, in the user's order. The first six are the tiles (with a
 *                  final « Ask » tile while there are fewer than six); every action's letter
 *                  answers, and the compact state may show the last action even past the six.
 *   knownActions   every saved action, for a last action outside the menu's actions: the compact
 *                  state shows it and Enter relaunches it (no tile, no letter).
 *   lastActionId   the action Enter relaunches and the grid's highlight starts on (else the
 *                  first). Only the highlight follows it: the order never changes by itself.
 *   onChoose(id)   an action was chosen (letter, digit, tile, Enter, click).
 *   onInstruction(text)  a free instruction was sent: trimmed, 1-1000 characters, no NUL.
 *                  User data: never log it.
 *   onClose()      Escape from the compact state.
 *   origin         side of the Îlot facing the selection ('top': it opens below the selection),
 *                  for the entrance's transform origin and glide; originX the horizontal origin.
 *   keyboard       'focused' (default): the window has the keyboard, the Îlot listens to keydown
 *                  and moves the focus (roving focus). 'injected': Rust forwards the menu keys
 *                  (`menu-key`, KeyboardEvent.key) through the handle's press(); the free
 *                  instruction is unavailable then (pastille and tile dimmed, Space ignored).
 *   onRequestKeyboard()  'injected' only: the pastille or the « Ask » tile clicked asks for the
 *                  keyboard; the field opens once the promise answers true (the parent then
 *                  passes keyboard 'focused').
 *   ref            IlotHandle: press(key, { shiftKey }) → whether the menu used the key.
 *   initialMode    'compact' by default (the lab scenarios open on 'grid' or 'prompt').
 *   shape          'menu' (default) or 'pill': the same surface, never unmounted, springs to the
 *                  shape of the `pill` content. Coming back to 'menu' starts again from the
 *                  compact state.
 *   pill           { key, size?, node }: what the pill shape holds, as src/result/ResultPill.tsx
 *                  resultContent gives it (the work pill 44 × 28, the check, the error pill…).
 *                  Each new key fades its content in while the surface springs to the new shape:
 *                  `size` fixes it, else it follows the content's natural size.
 *   onShapeChange  each change of shape, at its start and at its end (hit-test regions, §4.3).
 * Wrap it in <AnimatePresence> for its exit. Measure it on [data-ilot-shape].
 */

export type IlotKeyboard = 'focused' | 'injected';
export type IlotShape = 'menu' | 'pill';
// The content of the pill shape (the same as src/result/ResultPill.tsx ResultContent).
export type PillContent = { key: string; size?: SurfaceSize; node: ReactNode };
export type IlotHandle = { press: (key: string, modifiers?: Pick<KeyInput, 'shiftKey'>) => boolean };
export type IlotProps = {
  actions: readonly IlotAction[];
  knownActions?: readonly IlotAction[];
  lastActionId?: string;
  onChoose: (actionId: string) => void;
  onInstruction: (text: string) => void;
  onClose: () => void;
  origin?: SurfaceOrigin;
  originX?: string;
  keyboard?: IlotKeyboard;
  onRequestKeyboard?: () => Promise<boolean>;
  initialMode?: IlotMode;
  shape?: IlotShape;
  pill?: PillContent | null;
  onShapeChange?: (change: ShapeChange) => void;
  ref?: Ref<IlotHandle>;
};

export type { IlotAction, IlotMode } from './keys';

// The instruction as sent: no NUL, no surrounding blanks, at most 1000 characters (plan lot 7).
export function cleanInstruction(text: string): string {
  return [...text.replace(/\0/g, '').trim()].slice(0, ilotMetrics.instructionMax).join('');
}

const shortLabel = (action: IlotAction) => action.shortName?.trim() || action.name;
// Keys as aria-keyshortcuts writes them (KeyboardEvent.key values, « Space » for the space bar).
const letterOf = (action: IlotAction, letters: Map<string, string>) => {
  const key = action.key?.toLowerCase();
  return key && letters.get(key) === action.id ? action.key!.toUpperCase() : undefined;
};

function ActionIcon({ action, size }: { action: IlotAction; size: 14 | 16 }) {
  const name = iconFromLucide(action.icon);
  return name ? <Icon name={name} size={size} /> : null;
}

export function Ilot({ actions, knownActions, lastActionId, onChoose, onInstruction, onClose, origin = 'top', originX, keyboard = 'focused', onRequestKeyboard, initialMode = 'compact', shape = 'menu', pill, onShapeChange, ref }: IlotProps) {
  const t = useT();
  const promptAvailable = keyboard !== 'injected';
  const context = useMemo(() => ilotKeyContext(actions, lastActionId, promptAvailable, knownActions), [actions, lastActionId, promptAvailable, knownActions]);
  const [storedMode, setMode] = useState<IlotMode>(initialMode);
  const [hot, setHot] = useState(context.lastTile);
  const [compactHot, setCompactHot] = useState<CompactItem>('last');
  // The field and the character it opens with. Each opening is a new layer: reopened while the
  // previous one still fades out, the same key would revive that one (unfocused, stale text).
  const [seed, setSeed] = useState({ text: '', entry: 0 });

  // The highlight follows the last action; back from the pill, the menu starts over, compact.
  const [seen, setSeen] = useState({ lastTile: context.lastTile, shape });
  if (seen.lastTile !== context.lastTile || seen.shape !== shape) {
    setSeen({ lastTile: context.lastTile, shape });
    setHot(context.lastTile);
    if (seen.shape !== shape && shape === 'menu') { setMode('compact'); setCompactHot('last'); }
  }
  // Without the keyboard there is no field to show.
  const mode: IlotMode = storedMode === 'prompt' && !promptAvailable ? 'compact' : storedMode;
  const safeHot = Math.min(hot, context.tiles.length - 1);
  // The state as the keys see it, ahead of the next render: two keys Rust forwards back to back
  // (Tab then →) act on each other's result.
  const live = useRef({ mode, hot: safeHot, compactHot });
  live.current = { mode, hot: safeHot, compactHot };

  const apply = (command: IlotCommand) => {
    const now = live.current;
    switch (command.type) {
      case 'choose': onChoose(command.actionId); break;
      case 'prompt': setSeed(previous => ({ text: command.seed, entry: previous.entry + 1 })); setMode('prompt'); now.mode = 'prompt'; break;
      case 'grid': setMode('grid'); now.mode = 'grid'; break;
      case 'compact': setMode('compact'); setCompactHot('last'); now.mode = 'compact'; now.compactHot = 'last'; break;
      case 'close': onClose(); break;
      case 'hot': setHot(command.index); now.hot = command.index; break;
      case 'compact-hot': setCompactHot(command.item); now.compactHot = command.item; break;
      case 'none': break;
    }
  };
  // The focus ring appears once the keyboard moves the highlight: each state first looks as in
  // the lab (the default item marked by its weight and ↵, the grid's by its tile), not ringed.
  const [ring, setRing] = useState(false);
  const handle = (input: KeyInput): boolean => {
    if (shape !== 'menu') return false;
    const command = resolveIlotKey(input, live.current, context);
    if (!command) return false;
    if (command.type === 'hot' || command.type === 'compact-hot') setRing(true);
    apply(command);
    return true;
  };
  const latest = useRef(handle);
  latest.current = handle;

  useImperativeHandle(ref, () => ({ press: (key, modifiers) => latest.current({ key, ...modifiers }) }), []);

  // menus.jsx:15-27: the window's keys, caught before anything else, while the window has the
  // keyboard. A field outside the Îlot keeps its own keys.
  useEffect(() => {
    if (keyboard !== 'focused') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]') && !target.closest('[data-ilot]')) return;
      if (latest.current(keyInputOf(event))) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [keyboard]);

  // Roving focus: the highlighted item holds the focus while the window has the keyboard.
  const compactItems = useRef<Partial<Record<CompactItem, HTMLButtonElement | null>>>({});
  const tileItems = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    if (keyboard !== 'focused' || shape !== 'menu') return;
    const target = mode === 'grid' ? tileItems.current[safeHot] : mode === 'compact' ? compactItems.current[context.last ? compactHot : 'ask'] : null;
    target?.focus({ preventScroll: true });
  }, [keyboard, shape, mode, safeHot, compactHot, context.last]);

  // menus.jsx:81: a pointer resting on the compact state unfolds the grid after 450 ms.
  const hover = useRef(0);
  const stopHover = () => window.clearTimeout(hover.current);
  useEffect(() => stopHover, []);
  useEffect(() => { if (mode !== 'compact' || shape !== 'menu') stopHover(); }, [mode, shape]);

  // The field from the pointer: at once with the keyboard; without it, once the keyboard is
  // granted, if the menu still shows.
  const shapeNow = useRef(shape);
  shapeNow.current = shape;
  const openField = () => {
    if (promptAvailable) { apply({ type: 'prompt', seed: '' }); return; }
    void onRequestKeyboard?.().then(granted => { if (granted && shapeNow.current === 'menu') apply({ type: 'prompt', seed: '' }); }, () => undefined);
  };
  const pick = (tile: IlotTile) => tile.kind === 'ask' ? openField() : apply(tileCommand(tile, promptAvailable));
  const describe = t('ilot.describe');
  const unavailable = promptAvailable ? undefined : t('ilot.unavailable');

  let content: ReactNode;
  if (shape === 'pill') content = pill?.node;
  else if (mode === 'prompt') content = <PromptField seed={seed.text} label={describe} onSubmit={onInstruction} onCancel={() => apply({ type: 'compact' })} />;
  else if (mode === 'grid') content = <div role="menu" aria-label={t('ilot.menu')} className="ilot-grid" style={{ gridTemplateColumns: `repeat(${context.columns}, ${ilotMetrics.tile.width}px)` }}>
    {context.tiles.map((tile, index) => {
      const isHot = index === safeHot;
      const digit = String(index + 1);
      const common = {
        role: 'menuitem', type: 'button' as const, tabIndex: isHot ? 0 : -1, className: `ilot-tile${isHot ? ' is-hot' : ''}`,
        ref: (element: HTMLButtonElement | null) => { tileItems.current[index] = element; },
        onMouseEnter: () => setHot(index), onClick: () => pick(tile),
      };
      if (tile.kind === 'ask') return <button key="ask" {...common} data-tile="ask" aria-keyshortcuts={`${digit} Space /`} aria-disabled={promptAvailable ? undefined : true} aria-description={unavailable ?? t('ilot.askName')}>
        <Icon name="custom" size={16} /><span className="ilot-tile-label">{t('ilot.ask')}</span>
      </button>;
      const letter = letterOf(tile.action, context.letters);
      return <button key={tile.action.id} {...common} data-tile={tile.action.id} aria-keyshortcuts={letter ? `${letter} ${digit}` : digit} aria-description={tile.action.name}>
        <ActionIcon action={tile.action} size={16} /><span className="ilot-tile-label">{shortLabel(tile.action)}</span>
      </button>;
    })}
  </div>;
  else {
    const last = context.last;
    const focusable = last ? compactHot : 'ask';
    content = <div role="menu" aria-label={t('ilot.menu')} aria-orientation="horizontal" className="ilot-row"
      onMouseEnter={() => { stopHover(); hover.current = window.setTimeout(() => setMode(current => current === 'compact' ? 'grid' : current), ilotMetrics.hoverMs); }}
      onMouseLeave={stopHover}>
      {last && <button role="menuitem" type="button" tabIndex={focusable === 'last' ? 0 : -1} className="ilot-btn is-default" data-item="last"
        ref={element => { compactItems.current.last = element; }} aria-keyshortcuts={['Enter', letterOf(last, context.letters)].filter(Boolean).join(' ')} aria-description={last.name}
        onClick={() => onChoose(last.id)}>
        <ActionIcon action={last} size={14} /><span className="ilot-label">{shortLabel(last)}</span><span className="ilot-hint" aria-hidden="true">↵</span>
      </button>}
      {last && <span className="ilot-sep" aria-hidden="true" />}
      <button role="menuitem" type="button" tabIndex={focusable === 'ask' ? 0 : -1} className="ilot-btn ilot-ask" data-item="ask"
        ref={element => { compactItems.current.ask = element; }} aria-label={describe} aria-keyshortcuts="Space /" aria-disabled={promptAvailable ? undefined : true} aria-description={unavailable}
        onClick={openField}>
        <span className="ilot-dot" />
      </button>
    </div>;
  }

  const contentKey = shape === 'pill' ? `pill-${pill?.key ?? ''}` : mode === 'prompt' ? `prompt-${seed.entry}` : mode;
  return <MorphSurface contentKey={contentKey} size={shape === 'pill' ? pill?.size : undefined} origin={origin} originX={originX} onShapeChange={onShapeChange}
    data-ilot="" data-mode={shape === 'pill' ? undefined : mode} data-shape={shape} data-keyboard={keyboard} data-ring={ring ? '' : undefined}>
    {content}
  </MorphSurface>;
}

// menus.jsx:33-43: the free instruction in a real <input>, so AltGr characters, dead keys and IME
// composition reach it as typed. Enter sends, Escape goes back to the compact state.
function PromptField({ seed, label, onSubmit, onCancel }: { seed: string; label: string; onSubmit: (text: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(seed);
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);
  return <div className="ilot-field">
    <span className="ilot-dot" aria-hidden="true" />
    <input ref={input} className="ilot-input" value={value} placeholder={label} aria-label={label} maxLength={ilotMetrics.instructionMax}
      autoComplete="off" enterKeyHint="send" onChange={event => setValue(event.target.value)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          const text = cleanInstruction(value);
          if (text) onSubmit(text);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        } else if (event.key === 'Tab') event.preventDefault();
      }} />
    <span className="ilot-keycap" aria-hidden="true">↵</span>
  </div>;
}

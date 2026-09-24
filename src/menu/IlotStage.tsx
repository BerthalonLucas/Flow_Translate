import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { bridge } from '../bridge';
import { defaultActionId, instructionActionId } from '../actionDefaults';
import { useT } from '../i18n';
import { ilotFits, ilotPlace, ilotRegion, ilotReserve, ilotRoom, ilotShift, ilotSide, ilotStrip, placeX, type IlotPlace, type IlotRoom, type IlotShapeBox, type IlotSide } from '../layout';
import { indicatorOf } from '../loaders/pill';
import { useMotionPreset, useReducedMotionSetting } from '../motion/MotionPreferences';
import { animateCorner, fadeCorner, type CornerMove, type CornerOffset } from '../motion/surface';
import { Countdown, resultTiming } from '../result/countdown';
import { errorCodeOf, refusalCode, type ErrorAction } from '../result/errors';
import { changedRanges } from '../result/highlight';
import { resultContent, type ActionAnswer, type ResultStage } from '../result/ResultPill';
import type { ActionDefinition, Capture, ErrorCode, HitRegion, PillTarget, Presentation, Settings } from '../types';
import type { TranslationController } from '../useTranslation';
import { Ilot, type IlotHandle, type IlotKeyboard } from './Ilot';
import { browserShortcut, keyInputOf, maxTiles, type KeyInput } from './keys';
import { ilotMetrics } from './metrics';
import { MorphSurface, type ShapeChange, type SurfaceSize } from './MorphSurface';
import { effectiveAfterReplace, ilotOutcome, ownPasteRefusal, type OwnPaste, type UndoProgress } from './outcome';

/*
 * The Îlot in the overlay (lot 7, uiVersion 'ilot'): a menu capture (`capture.menu`, no execution
 * yet) opens the Îlot by its selection; the choice goes through `choose_action` once
 * (useTranslation.choose), then the same surface, never unmounted, carries the whole result
 * (lots 8 to 10, src/result/ResultPill.tsx resultContent): the work pill while the model works and
 * Rust pastes; the check once pasted, then it leaves; or the error pill, its one button after the
 * code's family (src/result/errors.ts). The glass never opens for this journey. docs/BRIDGE.md, Îlot.
 *   keyboard  `focus_overlay` once: true, the WebView has the keys; false, Rust forwards them as
 *             `menu-key` (Îlot 'injected' mode), kept by useTranslation until the Îlot shows. The
 *             window's own focus (a click on the Îlot) also gives the keys to the WebView, and the
 *             ✦ clicked in 'injected' mode asks `focus_overlay` again. The last signal wins, a
 *             forwarded key saying the source is in front. The browser's own shortcuts (F5, Ctrl+R, Ctrl+P,
 *             Ctrl+F, zoom, Alt+←) and Ctrl + wheel do nothing (keys.ts browserShortcut). A key
 *             the window receives before the Îlot shows (activated, the side still being read) is
 *             kept and replayed once it shows, after the forwarded ones: none is lost.
 *   window    reserved once for the largest shape (src/layout.ts, ilotReserve): shapes only change
 *             the hit-test region, published at the start of a change on both shapes and at its
 *             end on the new one; the window never resizes while the surface springs.
 *   side      read back from where Rust put the window (ilotSide), before the Îlot shows.
 *   slide     read at the same time: the room between the strip's corner and the work area's
 *             edges (ilotRoom, the anchor screen's work area). A shape wider than the room on the
 *             left (the error pill, near the screen's left edge) slides right by what it
 *             overhangs, on the shape's own spring (ilotShift); the region follows.
 *   outcome   src/menu/outcome.ts: the stage the surface shows, derived from the translation.
 *   lost      `target-invalidated` before any choice (none on its way either): the Îlot leaves.
 *   buttons   configuration → open_settings on the request's field, then the Îlot leaves;
 *             transient → Try again: the same action on the same capture (useTranslation.start,
 *             the v4 relaunch), whose result the Îlot pastes itself (replace_result, once: Rust
 *             delivers a capture's first request only; a refusal reads as its code, `{message,
 *             code}`, src/result/errors.ts refusalCode); paste → Copy result (copy_result), nothing
 *             replaced; content → ✕ only; cancelled → the Îlot leaves. ✕ and Escape close.
 *   Undo      lot 9: after Rust's own paste (`result-delivery` applied), the check, then Undo and
 *             its ring while Rust offers it (`undoable`; `undo-state` withdraws it: the check alone
 *             takes its place on the same clock, the surface's corner fixed). One click asks
 *             `undo_result` once: `undone` → « Undone », then the Îlot leaves; refused or failed →
 *             the error pill in Undo's words, ✕ only; nothing else is ever pasted. The time stands
 *             still under the pointer, on the focus and while Undo is on its way; at its end the
 *             Îlot leaves. A retried result the Îlot pasted itself has no Undo (Rust's own only).
 *   marks     lot 9: the changed words (src/result/highlight.ts, afterReplace.changedWords) asked
 *             once per replacement with `highlight_changes` while Undo is offered, cleared once
 *             with `clear_highlight` at the countdown's end (Rust clears them itself on Undo, a
 *             withdrawal or a dismissal).
 *   place     lot 9: after Rust's own paste (anchored), the pill goes where Rust puts it, never over
 *             the new text: `result_pill` once, for the size of the check's pill, at the start of
 *             its shape. Inside the window: the corner glides there in the DOM (surfaceMove, the
 *             lab's 420 ms move), the region holding every position on the way. Outside: once the
 *             shape rests, the corner fades out, `move_overlay` moves the window (never while
 *             anything animates), `result_pill` answers again for the moved window, and the pill
 *             fades back in at its place. A refusal leaves it where it is. Later shapes (the check
 *             alone, « Undone », an Undo's error) keep that place's corner (the left edge in the
 *             margin) and stay in the window.
 */

// How long the Îlot waits for Rust's placement before it opens anyway (below the selection); the
// glass's working pill waits as long for its side (GlassOverlay).
export const SIDE_WAIT_MS = 400;
// Keys that only modify another: never kept for the Îlot (a chord's release is not a key).
const modifierKeys: ReadonlySet<string> = new Set(['Control', 'Alt', 'AltGraph', 'Shift', 'Meta', 'OS', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn']);

// The menu's actions, in the user's order (settings.menuActionIds). An empty list is the user's
// choice (the Settings say « only the free instruction »): no action tile, only « Ask ». Only a
// settings object without the field (a preview, a fixture) falls back to the first six. A grid
// action without a letter keeps none: Rust assigns the letters at the migration.
export function menuActions(settings: Settings | null): ActionDefinition[] {
  const actions = settings?.actions ?? [];
  const ids = settings?.menuActionIds ?? actions.slice(0, maxTiles).map(action => action.id);
  return ids.map(id => actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action)).slice(0, maxTiles);
}

export function IlotStage({ controller, capture }: { controller: TranslationController; capture: Capture }) {
  const { state, settings, screen, choose, choosingCaptureId, start, menuKeys, takeMenuKeys, forwardedKeys, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
  const t = useT();
  const captureId = capture.id;
  const presentation: Presentation = capture.anchor ? 'anchored' : 'bottom';
  const reserve = useMemo(() => ilotReserve(presentation), [presentation]);
  const indicator = indicatorOf(settings?.indicator);
  const actions = useMemo(() => menuActions(settings), [settings]);
  const lastActionId = capture.menu?.lastActionId ?? settings?.defaultActionId ?? defaultActionId;
  const closing = closingCaptureId === captureId;
  const closingRef = useRef(closing);
  closingRef.current = closing;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Unknown until Rust placed and showed the window, so the entrance plays where it is seen; the
  // browser preview has no window. Without an anchor the Îlot grows up from the bottom.
  const [side, setSide] = useState<IlotSide | null>(() => bridge.native ? null : presentation === 'bottom' ? 'above' : 'below');
  // Read with the side (anchored, native only): the room around the strip's corner (ilotRoom).
  const [room, setRoom] = useState<IlotRoom | null>(null);
  const roomNow = useRef(room);
  roomNow.current = room;
  // The keyboard: the last answer that the window has it or not (focus_overlay, or the window's
  // own focus), unless Rust forwarded a key since (the source is in front then). Derived in the
  // same render as the key, so the key meets the right mode. `after` is the live count of the keys
  // received when the answer came (useTranslation.forwardedKeys), not the last render's.
  const forwarded = menuKeys.captureId === captureId ? menuKeys.count : 0;
  const [focus, setFocus] = useState<{ keyboard: IlotKeyboard; after: number }>({ keyboard: 'focused', after: 0 });
  const keyboard: IlotKeyboard = forwarded > focus.after ? 'injected' : focus.keyboard;
  const [choosing, setChoosing] = useState(false);
  const [refusal, setRefusal] = useState('');
  const handle = useRef<IlotHandle>(null);

  // One region at a time in a window that never changes (the reserve and its frame). The same
  // geometry published again waits for the same placement.
  const last = useRef<{ signature: string; placed: Promise<void> } | null>(null);
  const publish = useCallback((region: HitRegion): Promise<void> => {
    if (!bridge.native || closingRef.current) return Promise.resolve();
    const geometry = { captureId, presentation, regions: [region], frame: reserve.frame };
    const signature = JSON.stringify(geometry);
    if (last.current?.signature === signature) return last.current.placed;
    const placed = bridge.resize(reserve.width, reserve.height, geometry).catch(() => { if (last.current?.signature === signature) last.current = null; });
    last.current = { signature, placed };
    return placed;
  }, [captureId, presentation, reserve]);

  // The first geometry places and shows the window with the strip as its region; the window's
  // position then tells the side and, with the work area, the room, read once.
  const sideAsked = useRef(false);
  useLayoutEffect(() => {
    if (!bridge.native) return;
    const anchor = capture.anchor;
    const scale = capture.screen?.scale ?? screen?.scale ?? 1;
    const placed = last.current?.placed ?? publish(ilotRegion(presentation, 'below', { width: ilotStrip, height: ilotMetrics.compactHeight }));
    const fallback: IlotSide = anchor ? 'below' : 'above';
    if (!sideAsked.current) {
      sideAsked.current = true;
      // Rust places a capture on the screen of its anchor's centre (host::monitor_at).
      const work = anchor ? bridge.workAreaAt(anchor.x + anchor.width / 2, anchor.y + anchor.height / 2).catch(() => null) : Promise.resolve(null);
      void placed.then(() => anchor ? bridge.windowPosition() : null).catch(() => null).then(async position => {
        const area = await work;
        if (!alive.current) return;
        if (anchor && position && area) setRoom(ilotRoom(position.x, scale, area));
        setSide(known => known ?? (anchor && position ? ilotSide(position.y, scale, anchor) : fallback));
      });
    }
    const timer = window.setTimeout(() => setSide(known => known ?? fallback), SIDE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per capture: GlassOverlay keys it by capture

  // The corner moves with a shape the room on its left cannot hold (ilotShift): on the shape's
  // spring when it changes, at once for the first shape. After Rust's paste it goes to the pill's
  // place (lot 9, `place` above). The region holds every box painted since the surface last
  // rested (its shapes at each of their positions), then the box at rest.
  const tokens = useMotionPreset();
  const reduced = useReducedMotionSetting();
  const motionNow = useRef({ tokens, reduced });
  motionNow.current = { tokens, reduced };
  const cornerRef = useRef<HTMLDivElement>(null);
  const cornerAt = useRef<CornerOffset>({ x: 0, y: 0 });
  const shapeNow = useRef<SurfaceSize | null>(null);
  // The pill's place after the paste (null: the strip's corner), and how far the window moved
  // since the room was read: the room moves with it.
  const placed = useRef<IlotPlace | null>(null);
  const windowShift = useRef(0);
  const boxOf = useCallback((size: SurfaceSize): IlotShapeBox => {
    if (presentation !== 'anchored') return size;
    const room = roomNow.current && { left: roomNow.current.left + windowShift.current, right: roomNow.current.right - windowShift.current };
    return { ...size, shift: ilotShift(size.width, room, placeX(placed.current, size.width)), dy: placed.current?.y ?? 0 };
  }, [presentation]);
  const span = useRef<IlotShapeBox[]>([]);
  const springing = useRef(false);
  const gliding = useRef(false);
  const cornerRun = useRef(0);
  // After the surface rests: the window's move waiting for it (place, below).
  const windowMoveRef = useRef<() => void>(() => undefined);
  const placeRef = useRef<(size: SurfaceSize) => void>(() => undefined);
  // At rest (no spring, no glide): the box in place alone. The window moves only then.
  const settle = useCallback(() => {
    const size = shapeNow.current;
    if (!side || !size || springing.current || gliding.current) return;
    const box = boxOf(size);
    span.current = [box];
    void publish(ilotRegion(presentation, side, box));
    windowMoveRef.current();
  }, [presentation, side, publish, boxOf]);
  const settleRef = useRef(settle);
  settleRef.current = settle;
  const moveCorner = useCallback((to: CornerOffset, how: CornerMove) => {
    if (to.x === cornerAt.current.x && to.y === cornerAt.current.y && how !== 'instant') return;
    cornerAt.current = to;
    const run = ++cornerRun.current;
    gliding.current = false;
    const element = cornerRef.current;
    if (!element) return;
    const controls = animateCorner(element, to, motionNow.current.tokens, motionNow.current.reduced, how);
    if (how !== 'move' || motionNow.current.reduced) return;
    // The glide ends: the surface may rest.
    gliding.current = true;
    void controls.then(() => { if (cornerRun.current !== run) return; gliding.current = false; settleRef.current(); });
  }, []);
  const onShapeChange = useCallback((change: ShapeChange) => {
    if (!side) return;
    shapeNow.current = change.to;
    const to = boxOf(change.to);
    if (change.phase === 'start' && change.from) {
      const from = { ...change.from, shift: cornerAt.current.x, dy: cornerAt.current.y };
      springing.current = true;
      span.current = [...span.current, from, to];
      moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'morph');
      void publish(ilotRegion(presentation, side, ...span.current));
      placeRef.current(change.to);
      return;
    }
    if (!change.from) moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'instant');
    springing.current = false;
    settle();
  }, [presentation, side, publish, boxOf, moveCorner, settle]);
  // The room learnt after the Îlot showed (Rust's placement answered late): the shape in place
  // takes its slide at once.
  useEffect(() => {
    const size = shapeNow.current;
    if (!side || !size) return;
    const to = boxOf(size);
    if ((to.shift ?? 0) === cornerAt.current.x && (to.dy ?? 0) === cornerAt.current.y) return;
    moveCorner({ x: to.shift ?? 0, y: to.dy ?? 0 }, 'instant');
    settle();
  }, [room]); // eslint-disable-line react-hooks/exhaustive-deps -- only when the room arrives

  // The keyboard, asked once; a capture already chosen (double press) never takes it.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || capture.execution || closingRef.current) return;
    asked.current = true;
    const answer = (mode: IlotKeyboard) => { if (alive.current) setFocus({ keyboard: mode, after: forwardedKeys(captureId) }); };
    void bridge.focusOverlay().then(focused => answer(focused ? 'focused' : 'injected'), () => answer('injected'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per capture

  // The browser's own shortcuts (reload, print, find, zoom, history: keys.ts browserShortcut) and
  // Ctrl + wheel do nothing while the overlay has the keyboard, the field included: a reload would
  // empty the overlay while Rust keeps its menu open (review of bc57857, finding 2). Rust turns the
  // WebView's browser accelerators off too; this holds whatever the WebView does.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (browserShortcut(keyInputOf(event))) event.preventDefault(); };
    const onWheel = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('wheel', onWheel, true); };
  }, []);

  // The keys the window receives before the Îlot listens (Sol's measure of lot 9: a key sent in
  // the ~25 ms after `focus_overlay` activated the overlay was lost twice): Rust has given the
  // WebView the foreground, but the Îlot only shows once the window's side is read (two more
  // IPC answers and a render). Installed with the stage's first frame, before `focus_overlay` is
  // even asked; kept in order, never the browser's own shortcuts, nor a composition.
  const early = useRef<KeyInput[]>([]);
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (handle.current || closingRef.current || event.defaultPrevented) return;
      const input = keyInputOf(event);
      if (input.isComposing || browserShortcut(input) || modifierKeys.has(input.key)) return;
      early.current.push(input);
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Forwarded keys, then the early ones, go through the Îlot's table in order once it shows
  // (useTranslation keeps the forwarded ones): at its first frame, where it starts listening too.
  const shown = side !== null && !closing;
  useLayoutEffect(() => {
    const ilot = handle.current;
    if (!ilot) return;
    if (forwarded) for (const key of takeMenuKeys(captureId)) ilot.press(key.key, { shiftKey: key.shiftKey });
    const typed = early.current.splice(0);
    for (const { key, ...modifiers } of typed) ilot.press(key, modifiers);
  }, [forwarded, shown, captureId, takeMenuKeys]);

  // The pill as soon as a choice leaves; a refused choice gives the menu back.
  const run = (actionId: string, instruction?: string) => {
    setChoosing(true);
    setRefusal('');
    choose(actionId, instruction).catch((reason: unknown) => {
      if (!alive.current) return;
      setChoosing(false);
      setRefusal(typeof reason === 'string' ? reason : t('error.startFailed'));
    });
  };

  // What the surface shows (src/menu/outcome.ts), the frontend's own paste of a retry, and the
  // Undo of Rust's replacement.
  const [paste, setPaste] = useState<OwnPaste | null>(null);
  const [undo, setUndo] = useState<UndoProgress | null>(null);
  const outcome = ilotOutcome(state, { chosen: choosing, paste, undo });
  const requestId = state.requestId;
  useEffect(() => {
    if (state.phase !== 'complete' || state.delivery !== null || !requestId || closingRef.current) return;
    if (paste?.requestId === requestId || ownPasteRefusal(state)) return;
    setPaste({ requestId, status: 'pending' });
    bridge.replaceResult(requestId).then(
      () => { if (alive.current) setPaste(current => current?.requestId === requestId ? { requestId, status: 'applied' } : current); },
      // Rust refuses with `{message, code}`: the code says why (its French message is never read).
      reason => { if (alive.current) setPaste(current => current?.requestId === requestId ? { requestId, status: 'refused', code: refusalCode(reason) } : current); });
  }, [state, requestId, paste]);

  // The surface leaves once: at the end of the check, on ✕, Escape, Copied, a link to the Settings,
  // or at once when there is nothing to show (cancelled; the check turned off).
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current || closingRef.current) return;
    leaving.current = true;
    cancelAndDismiss();
  }, [cancelAndDismiss]);
  // The watcher dropped the selection before any choice (a click in the source, another
  // application): the menu could only end in a refused paste, so it leaves. Rust closes a menu
  // that had the keyboard when the foreground leaves it (docs/BRIDGE.md, Îlot); this covers the
  // others. A choice on its way, a double press included, keeps its journey and its error pill.
  const choiceOnItsWay = choosingCaptureId === captureId;
  useEffect(() => {
    if (state.invalidated && outcome.stage === 'menu' && !choiceOnItsWay) leave();
  }, [state.invalidated, outcome.stage, choiceOnItsWay, leave]);

  // The window gets the keyboard after all while the menu waits (a click on the Îlot in the
  // fallback, an activation Windows let through late): the Îlot takes the keys itself, field
  // included, until Rust forwards another one. Only the window's focus says so, never a pointer
  // press alone (review of bc57857, finding 3).
  const menuWaits = outcome.stage === 'menu' && !closing;
  useEffect(() => {
    if (!menuWaits) return;
    const onFocus = () => {
      if (!document.hasFocus() || !alive.current) return;
      const after = forwardedKeys(captureId);
      setFocus(current => current.keyboard === 'focused' && current.after === after ? current : { keyboard: 'focused', after });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [menuWaits, captureId, forwardedKeys]);
  // The ✦ or the « Ask » tile clicked while the keys come from Rust: the keyboard is asked for
  // again, and the field opens only if the window really holds it.
  const takeKeyboard = useCallback(async () => {
    if (closingRef.current) return false;
    const focused = await bridge.focusOverlay().catch(() => false);
    if (!focused || !alive.current || closingRef.current) return false;
    setFocus({ keyboard: 'focused', after: forwardedKeys(captureId) });
    return true;
  }, [captureId, forwardedKeys]);
  // Try again: the same action on the same capture, once per failed request.
  const retried = useRef<string | null>(null);
  const retry = () => {
    const chosen = state.capture;
    if (state.phase !== 'error' || !chosen?.execution || retried.current === requestId || closingRef.current) return;
    retried.current = requestId;
    setPaste(null);
    start(chosen);
  };
  const onAction = (action: ErrorAction): ActionAnswer => {
    if (action.type === 'retry') { retry(); return; }
    if (action.type === 'copy') return requestId ? bridge.copy(requestId).then(() => true, () => false) : false;
    // The Settings take the foreground on the request's field; the pill has said what it had to.
    return bridge.openSettings(action.field).then(() => { leave(); return true; }, () => false);
  };
  // Lot 9: Undo while Rust offers it for its own replacement (the pasted text found and
  // afterReplace.undo on, until `undo-state`), and while one is on its way.
  const rustPasted = state.delivery === 'applied';
  const busy = undo?.status === 'pending';
  const afterReplace = effectiveAfterReplace(settings?.afterReplace, rustPasted && (state.undoable || busy));
  // One countdown per replacement, from the check's first frame: the check alone that takes the
  // place of a withdrawn Undo keeps its time (src/result/countdown.ts).
  const doneClock = useRef<{ requestId: string; clock: Countdown; withUndo: boolean } | null>(null);
  if (outcome.stage === 'done' && requestId && doneClock.current?.requestId !== requestId) {
    const timing = resultTiming(afterReplace);
    doneClock.current = timing.durationMs ? { requestId, clock: new Countdown(timing.durationMs, performance.now()), withUndo: timing.undo } : null;
  }
  const clock = doneClock.current?.requestId === requestId ? doneClock.current : null;

  // The changed words, marked by the halo while Undo is offered: asked once per replacement,
  // never any text in the request (ranges of the result only), cleared once at the countdown's end.
  const marks = useRef<{ requestId: string; live: boolean } | null>(null);
  useEffect(() => {
    const capture = state.capture;
    if (!rustPasted || !state.undoable || !requestId || marks.current?.requestId === requestId || closingRef.current || !capture?.execution) return;
    const { ranges } = changedRanges(capture.text, state.result, { actionId: capture.execution.actionId, enabled: settings?.afterReplace?.changedWords !== false });
    marks.current = { requestId, live: ranges.length > 0 };
    if (ranges.length) void bridge.highlightChanges(requestId, ranges).catch(() => undefined);
  }, [rustPasted, state.undoable, state.capture, state.result, requestId, settings]);
  // Withdrawn or used, Undo takes the marks with it (Rust fades them itself).
  useEffect(() => { if (!state.undoable && !busy && marks.current) marks.current.live = false; }, [state.undoable, busy]);
  const expire = useCallback(() => {
    const current = marks.current;
    if (current?.live) { current.live = false; void bridge.clearHighlight(current.requestId).catch(() => undefined); }
    leave();
  }, [leave]);

  // Undo, once per replacement. A resolved answer may be a refusal: its status decides.
  const undoAsked = useRef<string | null>(null);
  const askUndo = () => {
    if (!requestId || !rustPasted || !state.undoable || undoAsked.current === requestId || closingRef.current) return;
    undoAsked.current = requestId;
    if (marks.current) marks.current.live = false;
    setUndo({ status: 'pending' });
    bridge.undoResult(requestId).then(answer => {
      if (!alive.current) return;
      const status = answer?.status === 'undone' || answer?.status === 'failed' ? answer.status : 'refused';
      setUndo({ status, ...(status === 'undone' ? {} : { code: errorCodeOf(answer?.code) }) });
    }, () => { if (alive.current) setUndo({ status: 'refused', code: 'internal' }); });
  };

  // Lot 9: the pill's place after Rust's own paste (anchored: a bottom form stays docked), asked
  // once per replacement with the size of the check's pill, at the start of its shape (place).
  const placing = useRef<{ requestId: string | null; open: boolean }>({ requestId: null, open: false });
  const askedPlace = useRef<string | null>(null);
  const stillPlacing = (id: string) => alive.current && !closingRef.current && placing.current.open && placing.current.requestId === id;
  const windowMove = useRef<{ requestId: string; place: IlotPlace } | null>(null);
  const usable = (target: PillTarget | null | undefined): target is PillTarget => typeof target === 'object' && target !== null && Number.isFinite(target.x) && Number.isFinite(target.y);
  placeRef.current = size => {
    const id = placing.current.requestId;
    if (!placing.current.open || !id || askedPlace.current === id || closingRef.current || !side) return;
    askedPlace.current = id;
    const growth = side;
    bridge.resultPill(id, size.width, size.height).then(target => {
      if (!stillPlacing(id) || !usable(target)) return;
      const place = ilotPlace(target, size, growth);
      if (target.inside && ilotFits(target, size)) { glideTo(place); return; }
      windowMove.current = { requestId: id, place };
      windowMoveRef.current();
    }, () => undefined);
  };
  // Inside the window: the corner glides to its place; the region holds the boxes painted so far
  // and each of them at the new place.
  const glideTo = (place: IlotPlace) => {
    const size = shapeNow.current;
    if (!side || !size) return;
    placed.current = place;
    const box = boxOf(size);
    const to = { x: box.shift ?? 0, y: box.dy ?? 0 };
    if (to.x === cornerAt.current.x && to.y === cornerAt.current.y) return;
    span.current = [...span.current, ...span.current.map(shape => boxOf(shape)), box];
    void publish(ilotRegion(presentation, side, ...span.current));
    moveCorner(to, 'move');
    if (!gliding.current) settle();
  };
  // Outside: at rest only, faded out, the window moves so the pill lands on its place, then Rust
  // answers again for the moved window; the pill fades back in. A refused move: back in, in place.
  windowMoveRef.current = () => {
    const pending = windowMove.current;
    const element = cornerRef.current;
    if (!pending || springing.current || gliding.current || !side) return;
    windowMove.current = null;
    const size = shapeNow.current;
    if (!element || !size || !stillPlacing(pending.requestId)) return;
    const dx = Math.round(placeX(pending.place, size.width) - cornerAt.current.x);
    const dy = Math.round(pending.place.y - cornerAt.current.y);
    if (!dx && !dy) return;
    const growth = side;
    void (async () => {
      await fadeCorner(element, false, motionNow.current.tokens, motionNow.current.reduced);
      if (!alive.current || closingRef.current) return;
      const moved = await bridge.moveOverlay(captureId, dx, dy).then(() => true, () => false);
      if (moved && alive.current) {
        windowShift.current += dx;
        // The pill now stands where it was meant to; Rust's answer for the moved window refines it.
        placed.current = { x: cornerAt.current.x, y: cornerAt.current.y, width: size.width, keepLeft: pending.place.keepLeft };
        const again = await bridge.resultPill(pending.requestId, size.width, size.height).catch(() => null);
        if (usable(again) && again.inside && ilotFits(again, size) && alive.current) placed.current = ilotPlace(again, size, growth);
        const box = boxOf(shapeNow.current ?? size);
        moveCorner({ x: box.shift ?? 0, y: box.dy ?? 0 }, 'instant');
        settleRef.current();
      }
      if (alive.current && !closingRef.current) void fadeCorner(element, true, motionNow.current.tokens, motionNow.current.reduced);
    })();
  };

  const stage: ResultStage | null = outcome.stage === 'working' ? { stage: 'working', indicator }
    : outcome.stage === 'done' ? { stage: 'done', afterReplace, clock: clock?.clock, busy, drawn: Boolean(clock?.withUndo) && !afterReplace.undo }
    : outcome.stage === 'undone' ? { stage: 'undone' }
    : outcome.stage === 'error' ? { stage: 'error', error: outcome.code, source: outcome.source, mode: state.mode, model: settings?.profiles[state.mode]?.model }
    : null;
  const content = stage && resultContent(stage, {
    onExpire: outcome.stage === 'done' ? expire : leave, onDismiss: leave, onAction, onUndo: askUndo,
  });
  // Nothing to show once chosen (cancelled, or pasted with the check turned off): the surface
  // leaves after the lab's 60 ms (Simulator.jsx:154), keeping its last content while it goes
  // (Simulator.jsx:299-302), as it does when it closes.
  const empty = outcome.stage !== 'menu' && !content;
  placing.current = { requestId, open: outcome.stage === 'done' && !empty && rustPasted && presentation === 'anchored' };
  // The check's pill may keep the work pill's size (the check alone, 44 × 28): no shape change
  // then, so the place is asked here (once: a change of shape asked first).
  useEffect(() => { const size = shapeNow.current; if (placing.current.open && size) placeRef.current(size); }, [outcome.stage, empty, rustPasted, requestId, side]);
  const lastContent = useRef(content);
  if (content && !closing) lastContent.current = content;
  const pill = closing || !content ? lastContent.current : content;
  useEffect(() => {
    if (!empty) return;
    const timer = window.setTimeout(leave, 60);
    return () => window.clearTimeout(timer);
  }, [empty, leave]);
  // Escape once chosen (the menu handles its own): the pill, the check or the error leave.
  useEffect(() => {
    if (outcome.stage === 'menu') return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); leave(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [outcome.stage, leave]);

  // Closed before it ever showed: nothing to animate out.
  useEffect(() => { if (closing && side === null) completeDismiss(captureId); }, [closing, side, captureId, completeDismiss]);

  const shape = outcome.stage === 'menu' ? 'menu' : 'pill';
  const { frame } = reserve;
  const right = reserve.width - frame.x - frame.width;
  const corner: CSSProperties = presentation === 'bottom' ? { left: 0, right: 0, bottom: reserve.height - frame.y - frame.height }
    : side === 'above' ? { right, bottom: reserve.height - frame.y - frame.height } : { right, top: frame.y };
  const status = outcome.stage === 'working' ? t('pill.working') : outcome.stage === 'done' ? t('glass.replaced') : outcome.stage === 'undone' ? t('result.undone') : '';
  return <div className="ilot-stage" style={{ width: reserve.width, height: reserve.height }} data-capture-id={captureId} data-presentation={presentation} data-side={side ?? undefined}
    data-closing={closing} data-stage={outcome.stage} data-error={outcome.stage === 'error' ? outcome.code : undefined}>
    <div ref={cornerRef} className="ilot-corner" style={corner}>
      <AnimatePresence onExitComplete={() => completeDismiss(captureId)}>
        {shown && <Ilot key={captureId} ref={handle} actions={actions} knownActions={settings?.actions} lastActionId={lastActionId}
          origin={presentation === 'bottom' || side === 'above' ? 'bottom' : 'top'} originX={presentation === 'bottom' ? '50%' : '100%'}
          keyboard={keyboard} onRequestKeyboard={takeKeyboard} shape={shape} pill={pill}
          onChoose={actionId => run(actionId)} onInstruction={text => run(instructionActionId, text)} onClose={cancelAndDismiss} onShapeChange={onShapeChange} />}
      </AnimatePresence>
    </div>
    <span className="sr-only" role="status">{status}</span>
    {refusal && <span className="sr-only" role="alert">{refusal}</span>}
  </div>;
}

// A capture Rust refused under the Îlot (`capture-notice` with its code: nothing selected, a
// protected field, too long, the Settings in front, nothing recent to show again…): the error pill
// of the same family of shapes, its text in the interface language, without a button (nothing was
// read, nothing can be retried or copied) and without ✕: Rust shows it alone, never clickable, in
// its 420 × 64 window at the bottom of the cursor's screen, and hides it four seconds later. The
// code alone decides the text; Rust's French message is never read.
export function IlotNotice({ code }: { code: ErrorCode }) {
  const content = resultContent({ stage: 'error', error: code, source: 'capture' });
  if (!content) return null;
  return <div className="notice-root" data-notice={code}>
    <MorphSurface contentKey={content.key} size={content.size} origin="bottom" originX="50%">{content.node}</MorphSurface>
  </div>;
}

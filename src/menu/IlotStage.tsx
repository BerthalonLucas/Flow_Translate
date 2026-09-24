import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { bridge } from '../bridge';
import { defaultActionId, instructionActionId } from '../actionDefaults';
import { useT } from '../i18n';
import { ilotBox, ilotRegion, ilotReserve, ilotSide, type IlotSide } from '../layout';
import { indicatorOf } from '../loaders/pill';
import type { ErrorAction } from '../result/errors';
import { resultContent, type ActionAnswer, type ResultStage } from '../result/ResultPill';
import type { ActionDefinition, Capture, ErrorCode, HitRegion, Presentation, Settings } from '../types';
import type { TranslationController } from '../useTranslation';
import { Ilot, type IlotHandle, type IlotKeyboard } from './Ilot';
import { maxTiles } from './keys';
import { ilotMetrics } from './metrics';
import { MorphSurface, type ShapeChange } from './MorphSurface';
import { effectiveAfterReplace, ilotOutcome, ownPasteRefusal, type OwnPaste } from './outcome';

/*
 * The Îlot in the overlay (lot 7, uiVersion 'ilot'): a menu capture (`capture.menu`, no execution
 * yet) opens the Îlot by its selection; the choice goes through `choose_action` once
 * (useTranslation.choose), then the same surface, never unmounted, carries the whole result
 * (lots 8 to 10, src/result/ResultPill.tsx resultContent): the work pill while the model works and
 * Rust pastes; the check once pasted, then it leaves; or the error pill, its one button after the
 * code's family (src/result/errors.ts). The glass never opens for this journey. docs/BRIDGE.md, Îlot.
 *   keyboard  `focus_overlay` once: true, the WebView has the keys; false, Rust forwards them as
 *             `menu-key` (Îlot 'injected' mode), kept by useTranslation until the Îlot shows. The
 *             last of the two signals wins.
 *   window    reserved once for the largest shape (src/layout.ts, ilotReserve): shapes only change
 *             the hit-test region, published at the start of a change on both shapes and at its
 *             end on the new one; the window never resizes while the surface springs.
 *   side      read back from where Rust put the window (ilotSide), before the Îlot shows.
 *   outcome   src/menu/outcome.ts: the stage the surface shows, derived from the translation.
 *   buttons   configuration → open_settings on the request's field, then the Îlot leaves;
 *             transient → Try again: the same action on the same capture (useTranslation.start,
 *             the v4 relaunch), whose result the Îlot pastes itself (replace_result, once: Rust
 *             delivers a capture's first request only); paste → Copy result (copy_result), nothing
 *             replaced; content → ✕ only; cancelled → the Îlot leaves. ✕ and Escape close.
 *   Undo      bridge.undoResult (lot 9, native side): null today, so the check stays alone 1.1 s;
 *             once it exists, the button, its ring and its pauses are ResultPill's DoneContent.
 */

// How long the Îlot waits for Rust's placement before it opens anyway (below the selection).
const SIDE_WAIT_MS = 400;

// The menu's actions, in the user's order (settings.menuActionIds, else the first six). A grid
// action without a letter keeps none: Rust assigns the letters at the migration.
export function menuActions(settings: Settings | null): ActionDefinition[] {
  const actions = settings?.actions ?? [];
  const ids = settings?.menuActionIds?.length ? settings.menuActionIds : actions.slice(0, maxTiles).map(action => action.id);
  return ids.map(id => actions.find(action => action.id === id)).filter((action): action is ActionDefinition => Boolean(action)).slice(0, maxTiles);
}

export function IlotStage({ controller, capture }: { controller: TranslationController; capture: Capture }) {
  const { state, settings, screen, choose, start, menuKeys, takeMenuKeys, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
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
  // The keyboard: focus_overlay's answer, unless Rust forwarded a key since (the source is in
  // front then). Derived in the same render as the key, so the key meets the right mode.
  const forwarded = menuKeys.captureId === captureId ? menuKeys.count : 0;
  const forwardedNow = useRef(forwarded);
  forwardedNow.current = forwarded;
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
  // position then tells the side, read once.
  const sideAsked = useRef(false);
  useLayoutEffect(() => {
    if (!bridge.native) return;
    const anchor = capture.anchor;
    const scale = capture.screen?.scale ?? screen?.scale ?? 1;
    const placed = last.current?.placed ?? publish(ilotRegion(presentation, 'below', { width: ilotBox.width, height: ilotMetrics.compactHeight }));
    const fallback: IlotSide = anchor ? 'below' : 'above';
    if (!sideAsked.current) {
      sideAsked.current = true;
      void placed.then(() => anchor ? bridge.windowPosition() : null).catch(() => null).then(position => {
        if (alive.current) setSide(known => known ?? (anchor && position ? ilotSide(position.y, scale, anchor) : fallback));
      });
    }
    const timer = window.setTimeout(() => setSide(known => known ?? fallback), SIDE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per capture: GlassOverlay keys it by capture

  const onShapeChange = useCallback((change: ShapeChange) => {
    if (!side) return;
    void publish(change.phase === 'start' && change.from ? ilotRegion(presentation, side, change.from, change.to) : ilotRegion(presentation, side, change.to));
  }, [presentation, side, publish]);

  // The keyboard, asked once; a capture already chosen (double press) never takes it.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || capture.execution || closingRef.current) return;
    asked.current = true;
    const answer = (mode: IlotKeyboard) => { if (alive.current) setFocus({ keyboard: mode, after: forwardedNow.current }); };
    void bridge.focusOverlay().then(focused => answer(focused ? 'focused' : 'injected'), () => answer('injected'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per capture

  // Forwarded keys go through the Îlot's table in order, once it shows (useTranslation keeps them).
  const shown = side !== null && !closing;
  useEffect(() => {
    const ilot = handle.current;
    if (!ilot || !forwarded) return;
    for (const key of takeMenuKeys(captureId)) ilot.press(key.key, { shiftKey: key.shiftKey });
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

  // What the surface shows (src/menu/outcome.ts), and the frontend's own paste of a retry.
  const [paste, setPaste] = useState<OwnPaste | null>(null);
  const [undone, setUndone] = useState(false);
  const outcome = ilotOutcome(state, { chosen: choosing, paste, undone });
  const requestId = state.requestId;
  useEffect(() => {
    if (state.phase !== 'complete' || state.delivery !== null || !requestId || closingRef.current) return;
    if (paste?.requestId === requestId || ownPasteRefusal(state)) return;
    setPaste({ requestId, status: 'pending' });
    bridge.replace(requestId).then(
      () => { if (alive.current) setPaste(current => current?.requestId === requestId ? { requestId, status: 'applied' } : current); },
      () => { if (alive.current) setPaste(current => current?.requestId === requestId ? { requestId, status: 'refused' } : current); });
  }, [state, requestId, paste]);

  // The surface leaves once: at the end of the check, on ✕, Escape, Copied, a link to the Settings,
  // or at once when there is nothing to show (cancelled; the check turned off).
  const leaving = useRef(false);
  const leave = useCallback(() => {
    if (leaving.current || closingRef.current) return;
    leaving.current = true;
    cancelAndDismiss();
  }, [cancelAndDismiss]);
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
  const undo = bridge.undoResult;
  const afterReplace = effectiveAfterReplace(settings?.afterReplace, Boolean(undo));
  const stage: ResultStage | null = outcome.stage === 'working' ? { stage: 'working', indicator }
    : outcome.stage === 'done' ? { stage: 'done', afterReplace }
    : outcome.stage === 'undone' ? { stage: 'undone' }
    : outcome.stage === 'error' ? { stage: 'error', error: outcome.code, mode: state.mode, model: settings?.profiles[state.mode]?.model }
    : null;
  const content = stage && resultContent(stage, {
    onExpire: leave, onDismiss: leave, onAction,
    onUndo: undo && requestId ? () => { void undo(requestId).then(() => { if (alive.current) setUndone(true); }, () => undefined); } : undefined,
  });
  // Nothing to show once chosen (cancelled, or pasted with the check turned off): the surface
  // leaves after the lab's 60 ms (Simulator.jsx:154), keeping its last content while it goes
  // (Simulator.jsx:299-302), as it does when it closes.
  const empty = outcome.stage !== 'menu' && !content;
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
  const status = outcome.stage === 'working' ? t('pill.working') : outcome.stage === 'done' ? t('glass.replaced') : '';
  return <div className="ilot-stage" style={{ width: reserve.width, height: reserve.height }} data-capture-id={captureId} data-presentation={presentation} data-side={side ?? undefined}
    data-closing={closing} data-stage={outcome.stage} data-error={outcome.stage === 'error' ? outcome.code : undefined}>
    <div className="ilot-corner" style={corner}>
      <AnimatePresence onExitComplete={() => completeDismiss(captureId)}>
        {shown && <Ilot key={captureId} ref={handle} actions={actions} knownActions={settings?.actions} lastActionId={lastActionId}
          origin={presentation === 'bottom' || side === 'above' ? 'bottom' : 'top'} originX={presentation === 'bottom' ? '50%' : '100%'}
          keyboard={keyboard} shape={shape} pill={pill}
          onChoose={actionId => run(actionId)} onInstruction={text => run(instructionActionId, text)} onClose={cancelAndDismiss} onShapeChange={onShapeChange} />}
      </AnimatePresence>
    </div>
    <span className="sr-only" role="status">{status}</span>
    {refusal && <span className="sr-only" role="alert">{refusal}</span>}
  </div>;
}

// A capture Rust refused under the Îlot (`capture-notice` with its code: nothing selected, a
// protected field, too long…): the error pill of the same family of shapes, its text in the
// interface language, without a button (nothing was read, nothing can be retried or copied) and
// without ✕: Rust shows it alone, never clickable, in its 420 × 64 window at the bottom of the
// cursor's screen, and hides it four seconds later.
export function IlotNotice({ code }: { code: ErrorCode }) {
  const content = resultContent({ stage: 'error', error: code, source: 'capture' });
  if (!content) return null;
  return <div className="notice-root" data-notice={code}>
    <MorphSurface contentKey={content.key} size={content.size} origin="bottom" originX="50%">{content.node}</MorphSurface>
  </div>;
}

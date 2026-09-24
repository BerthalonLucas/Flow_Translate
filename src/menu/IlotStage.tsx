import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence } from 'motion/react';
import { bridge } from '../bridge';
import { defaultActionId, instructionActionId } from '../actionDefaults';
import { useT } from '../i18n';
import { ilotBox, ilotRegion, ilotReserve, ilotSide, type IlotSide } from '../layout';
import { WorkingContent } from '../loaders/WorkingPill';
import { indicatorOf, workingPillShape } from '../loaders/pill';
import type { ActionDefinition, Capture, HitRegion, Presentation, Settings } from '../types';
import type { TranslationController } from '../useTranslation';
import { Ilot, type IlotHandle, type IlotKeyboard } from './Ilot';
import { maxTiles } from './keys';
import { ilotMetrics } from './metrics';
import type { ShapeChange } from './MorphSurface';

/*
 * The Îlot in the overlay (lot 7, uiVersion 'ilot'): a menu capture (`capture.menu`, no execution
 * yet) opens the Îlot by its selection; the choice goes through `choose_action` once
 * (useTranslation.choose), then the same surface springs to the work pill of lot 8 while the
 * translation runs and Rust pastes it, as a direct « replace » capture does. docs/BRIDGE.md, Îlot.
 *   keyboard  `focus_overlay` once: true, the WebView has the keys; false, Rust forwards them as
 *             `menu-key` (Îlot 'injected' mode), kept by useTranslation until the Îlot shows. The
 *             last of the two signals wins.
 *   window    reserved once for the largest shape (src/layout.ts, ilotReserve): shapes only change
 *             the hit-test region, published at the start of a change on both shapes and at its
 *             end on the new one; the window never resizes while the surface springs.
 *   side      read back from where Rust put the window (ilotSide), before the Îlot shows.
 * GlassSession renders it while the form is pending; a fallback or an error then opens the glass.
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
  const { state, settings, screen, choose, menuKeys, takeMenuKeys, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once per capture: GlassSession is keyed by it

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

  // Closed before it ever showed: nothing to animate out.
  useEffect(() => { if (closing && side === null) completeDismiss(captureId); }, [closing, side, captureId, completeDismiss]);

  const shape = capture.execution || choosing ? 'pill' : 'menu';
  const done = state.delivery === 'applied';
  const { frame } = reserve;
  const right = reserve.width - frame.x - frame.width;
  const corner: CSSProperties = presentation === 'bottom' ? { left: 0, right: 0, bottom: reserve.height - frame.y - frame.height }
    : side === 'above' ? { right, bottom: reserve.height - frame.y - frame.height } : { right, top: frame.y };
  return <div className="ilot-stage" style={{ width: reserve.width, height: reserve.height }} data-capture-id={captureId} data-presentation={presentation} data-side={side ?? undefined} data-closing={closing}>
    <div className="ilot-corner" style={corner}>
      <AnimatePresence onExitComplete={() => completeDismiss(captureId)}>
        {shown && <Ilot key={captureId} ref={handle} actions={actions} knownActions={settings?.actions} lastActionId={lastActionId}
          origin={presentation === 'bottom' || side === 'above' ? 'bottom' : 'top'} originX={presentation === 'bottom' ? '50%' : '100%'}
          keyboard={keyboard} shape={shape} pill={<WorkingContent indicator={indicator} done={done} />} pillSize={workingPillShape(indicator)}
          onChoose={actionId => run(actionId)} onInstruction={text => run(instructionActionId, text)} onClose={cancelAndDismiss} onShapeChange={onShapeChange} />}
      </AnimatePresence>
    </div>
    <span className="sr-only" role="status">{state.phase === 'streaming' ? t('pill.working') : done ? t('glass.replaced') : ''}</span>
    {refusal && <span className="sr-only" role="alert">{refusal}</span>}
  </div>;
}

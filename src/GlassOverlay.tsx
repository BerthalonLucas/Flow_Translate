import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { bridge } from './bridge';
import { anchoredFloor, anchoredReserve, bottomReserve, countWords, decideForm, dimming, glass, halo, readerMetrics, readingBudget, remainingAfterLeave, shortMetrics, type ShortMetrics } from './layout';
import { breakable } from './text';
import { AnimatedIcon, BubbleMenu, BubbleMenuTrigger, Icon, IconButton, motionTokens, useFade, useRise } from './ui';
import type { Form, HitRegion, Presentation, Screen, TextSize } from './types';
import type { TranslationController } from './useTranslation';

const DRAG_THRESHOLD = 4;
// A press on the glass is not a move yet: the native drag starts after 4 px of travel.
// Rust compensates the travel measured since the original press before it starts moving.
export function dragSurface(event: ReactPointerEvent<HTMLElement>, onError?: () => void, onDragChange?: (dragging: boolean) => void) {
  if (!bridge.native || event.button !== 0 || !event.isPrimary) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, input, select, a, [role="menu"], [data-reading-surface]')) return;
  event.preventDefault();
  const surface = event.currentTarget;
  const origin = { x: event.clientX, y: event.clientY };
  const pointerId = event.pointerId;
  let started = false;
  const stop = () => {
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', stop);
    surface.removeEventListener('pointercancel', stop);
    surface.removeEventListener('lostpointercapture', stop);
    if (surface.hasPointerCapture?.(pointerId)) surface.releasePointerCapture(pointerId);
    if (started) onDragChange?.(false);
  };
  const move = (moveEvent: PointerEvent) => {
    if (started) { if (moveEvent.buttons === 0) stop(); return; }
    if (Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y) < DRAG_THRESHOLD) return;
    started = true;
    onDragChange?.(true);
    void bridge.startDrag(origin.x, origin.y).catch(() => { onError?.(); stop(); });
  };
  try { surface.setPointerCapture(pointerId); } catch { /* capture is a convenience, not a requirement */ }
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', stop);
  surface.addEventListener('pointercancel', stop);
  surface.addEventListener('lostpointercapture', stop);
}

type ScrollEdge = 'top' | 'middle' | 'bottom' | 'none';
const SCROLLBAR_LINGER = 800;
const NEAR_MARGIN = 32;
// The waiting pill shows a progress sweep once the engine has taken longer than this.
const SLOW_AFTER = 1500;

// Three dots hopping in turn (900 ms cycle, 120 ms apart): the whole result lands at
// once behind them (deltas are buffered in useTranslation), so the window resizes once.
function WaitDots() {
  return <span className="wait-dots" aria-hidden="true"><i /><i /><i /></span>;
}
function WaitPill({ slow }: { slow: boolean }) {
  return <span className="wait-pill" role="img" aria-label="Traduction en cours" data-slow={slow}><WaitDots /></span>;
}

// Long runs (paths, URLs, identifiers) get a break opportunity after their separators,
// so the glass wraps them there instead of cutting a word at its rounded edge.
function Breakable({ text }: { text: string }) {
  return <>{breakable(text).map((piece, index) => index ? <Fragment key={index}><wbr />{piece}</Fragment> : piece)}</>;
}

// How many lines the result takes in the short glass, measured off screen with the
// glass's own text styles: the form is decided on that, once, when the result lands.
function measureLines(text: string, metrics: ShortMetrics): number {
  const probe = document.createElement('div');
  probe.className = 'measure-probe translation-copy';
  probe.style.setProperty('--copy-size', `${metrics.fontSize}px`);
  probe.style.setProperty('--copy-line', `${metrics.lineHeight}px`);
  probe.style.width = `${metrics.width}px`;
  const inner = document.createElement('span');
  inner.className = 'translation-text';
  inner.textContent = text;
  probe.appendChild(inner);
  document.body.appendChild(probe);
  const height = inner.getBoundingClientRect().height;
  probe.remove();
  return Math.max(1, Math.round(height / metrics.lineHeight));
}

// The text scrolls inside the glass without a native bar. Radix ScrollArea owns the
// 3 px indicator geometry; it shows on hover or while scrolling and fades 800 ms later.
// Edge fades follow the scroll position.
function ReadingSurface({ children, streaming, onEnter }: {
  children: ReactNode; streaming: boolean; onEnter: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<ScrollEdge>('none');
  const [hovered, setHovered] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  useLayoutEffect(() => {
    const element = viewport.current;
    const content = element?.firstElementChild;
    if (!element || !content) return;
    const update = () => {
      const overflow = element.scrollHeight - element.clientHeight > 1;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      setEdge(!overflow ? 'none' : atTop ? 'top' : atBottom ? 'bottom' : 'middle');
    };
    let timer = 0;
    const onScroll = () => {
      update();
      setScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), SCROLLBAR_LINGER);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); observer.observe(content);
    element.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', onScroll); window.clearTimeout(timer); };
  }, []);
  const capped = edge !== 'none';
  return <ScrollArea.Root type="always" className="reading-area" data-indicator={capped && (hovered || scrolling)} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
    <ScrollArea.Viewport ref={viewport} className={`translation-copy ${streaming ? 'is-streaming' : ''}`} data-reading-surface data-scroll-edge={edge} data-capped={capped}
      tabIndex={0} role="document" aria-label="Traduction" aria-busy={streaming}
      onKeyDown={event => { if (event.key === 'Enter' && event.target === event.currentTarget) { event.preventDefault(); onEnter(); } }}>
      {children}
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" forceMount className="scroll-indicator" style={{ top: 22, bottom: 22, right: 8 }} aria-hidden="true">
      <ScrollArea.Thumb className="scroll-thumb" />
    </ScrollArea.Scrollbar>
  </ScrollArea.Root>;
}

export function GlassOverlay({ controller }: { controller: TranslationController }) {
  if (controller.state.capture) return <GlassSession key={controller.state.capture.id} controller={controller} />;
  return controller.notice ? <NoticePill key={controller.notice.id} message={controller.notice.message} /> : null;
}

// Nothing to translate: one pill, never clickable, in place of the old MessageBox. Rust
// shows it alone at the bottom of the cursor's screen (420 × 64) and hides it four
// seconds later; the browser preview lays it near the bottom of the page.
function NoticePill({ message }: { message: string }) {
  const fade = useFade('feedback');
  return <div className="notice-root"><motion.p {...fade} className="notice-pill" role="status">{message}</motion.p></div>;
}

// Entrance travel is paint only: regions use the resting layout.
function travel(node: Element | null) {
  if (!node) return { x: 0, y: 0 };
  const transform = getComputedStyle(node).transform;
  if (!transform || transform === 'none') return { x: 0, y: 0 };
  const matrix = new DOMMatrix(transform);
  return { x: matrix.e, y: matrix.f };
}

// The browser preview has no native screen: the viewport stands in for the work area.
function previewScreen(): Screen {
  return { width: window.innerWidth, height: window.innerHeight, scale: 1 };
}

function GlassSession({ controller }: { controller: TranslationController }) {
  const { state, dispatch, start, cancelAndDismiss, completeDismiss, closingCaptureId, notice, settings, screen: liveScreen } = controller;
  const captureId = state.capture?.id;
  const preset: TextSize = settings?.textSize ?? 'normal';
  const autoClose = settings?.autoClose ?? 'normal';
  const [screen, setScreen] = useState<Screen>(() => liveScreen ?? state.capture?.screen ?? previewScreen());
  useEffect(() => { if (liveScreen) setScreen(liveScreen); }, [liveScreen]);
  const short = shortMetrics(preset);
  const reader = readerMetrics(screen, preset);
  // The form is decided once the result lands; a capture without an anchor lives at the
  // bottom from the start, a reader moves there and never comes back.
  const [form, setForm] = useState<Form>('pending');
  const [placement, setPlacement] = useState<Presentation>(() => state.capture?.anchor ? 'anchored' : 'bottom');
  const [moving, setMoving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAtExit = useRef(false);
  useLayoutEffect(() => { if (!closingCaptureId) menuAtExit.current = menuOpen; }, [menuOpen, closingCaptureId]);
  const menuVisible = closingCaptureId ? menuAtExit.current : menuOpen;
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [near, setNear] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pinned, setPinned] = useState(false);
  // The reading budget (src/layout.ts): when it ends unheld, the glass dims, then leaves.
  const [budgetEnd, setBudgetEnd] = useState<number | null>(null);
  const [exit, setExit] = useState<'reading' | 'dimming'>('reading');
  const exitRef = useRef(exit);
  exitRef.current = exit;
  // What Rust was last told about the dimming (never twice the same).
  const announced = useRef(false);
  const announce = useCallback((dimming: boolean) => {
    if (announced.current === dimming) return;
    announced.current = dimming;
    void bridge.dimming(dimming).catch(() => undefined);
  }, []);
  const root = useRef<HTMLDivElement>(null);
  const previousGeometry = useRef('');
  const fade = useFade('feedback');
  const pillRise = useRise(4, 'surface', 0.06);
  const reduced = useReducedMotion();
  const active = useRef({ requestId: state.requestId, closing: closingCaptureId });
  useLayoutEffect(() => { active.current = { requestId: state.requestId, closing: closingCaptureId }; }, [state.requestId, closingCaptureId]);
  const streaming = state.phase === 'streaming';
  const settled = state.phase === 'complete' || state.phase === 'error' || state.phase === 'cancelled';
  const ready = state.phase === 'complete' && !closingCaptureId && !moving;
  const isReader = form === 'reader';

  // Decide the form on the real text, once per result (a relaunch may change it).
  useLayoutEffect(() => {
    if (!settled) return;
    const text = state.result || state.error || '';
    const next = decideForm(measureLines(text, short));
    setForm(next);
    if (next === 'reader') setPlacement(current => { if (current === 'anchored') setMoving(true); return 'bottom'; });
  }, [settled, state.requestId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!streaming) { setSlow(false); return; }
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER);
    return () => window.clearTimeout(timer);
  }, [streaming, state.requestId]);
  useEffect(() => { setMenuOpen(false); setFeedback(null); setCopied(false); }, [captureId, state.requestId]);
  // A notice while the glass is open (the shortcut found nothing new) reads as feedback.
  useEffect(() => { if (notice) setFeedback(notice.message); }, [notice]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Hover is read from every pointerover the window sees, not from enter/leave pairs: a
  // menu item removed under the pointer would otherwise leave the glass "hovered" for
  // good. Leaving with the pointer means "done reading": a focus the menu or a click
  // left behind must not keep the glass open; keyboard-only use never moves the pointer.
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  useEffect(() => {
    const release = () => {
      const focused = document.activeElement;
      if (!menuOpenRef.current && focused instanceof HTMLElement && root.current?.contains(focused)) focused.blur();
    };
    const over = (event: PointerEvent) => {
      const inside = event.target instanceof Node && Boolean(root.current?.contains(event.target));
      if (!inside) release();
      setHovered(inside);
    };
    const gone = () => { setHovered(false); release(); };
    window.addEventListener('pointerover', over, true);
    document.documentElement.addEventListener('pointerleave', gone);
    return () => { window.removeEventListener('pointerover', over, true); document.documentElement.removeEventListener('pointerleave', gone); };
  }, []);
  // Leaving is judged on the silhouette, not on the tight surfaces: natively the hit
  // tester reports whether the cursor rests within 32 px of a surface (`glass-near`,
  // on change only); the browser preview measures the pointer against the root box.
  useEffect(() => {
    if (bridge.native) {
      let disposed = false;
      const listening = bridge.on<{ near: boolean }>('glass-near', ({ near }) => { if (!disposed) setNear(near); });
      return () => { disposed = true; void listening.then(unlisten => unlisten()); };
    }
    const move = (event: PointerEvent) => {
      const box = root.current?.getBoundingClientRect();
      setNear(Boolean(box) && event.clientX >= box!.left - NEAR_MARGIN && event.clientX <= box!.right + NEAR_MARGIN && event.clientY >= box!.top - NEAR_MARGIN && event.clientY <= box!.bottom + NEAR_MARGIN);
    };
    const gone = () => setNear(false);
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', gone);
    return () => { window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', gone); };
  }, []);

  // Reading budget: estimated on the words, reset by every result; a visit of a second or
  // more then a departure shortens what remains; a click, the wheel or a key restores it.
  const budget = settled && form !== 'pending' ? readingBudget(countWords(state.result || state.error || ''), form, autoClose) : null;
  useEffect(() => { setBudgetEnd(budget === null ? null : performance.now() + budget); setExit('reading'); }, [budget, state.requestId]);
  const present = hovered || near;
  const visitStart = useRef<number | null>(null);
  useEffect(() => {
    if (present) { visitStart.current ??= performance.now(); return; }
    const started = visitStart.current;
    visitStart.current = null;
    if (started === null) return;
    const visit = performance.now() - started;
    setBudgetEnd(end => end === null ? null : performance.now() + remainingAfterLeave(end - performance.now(), visit));
  }, [present]);
  const held = present || focusWithin || menuOpen || dragging || !settled || Boolean(closingCaptureId) || moving || pinned || form === 'pending';
  const restore = useCallback(() => {
    if (exitRef.current !== 'dimming') return;
    exitRef.current = 'reading';
    setExit('reading');
    announce(false);
    setBudgetEnd(performance.now() + dimming.graceMs);
  }, [announce]);
  const refresh = () => {
    if (budget !== null) setBudgetEnd(performance.now() + budget);
    restore();
  };
  useEffect(() => {
    if (held || exit !== 'reading' || budgetEnd === null) return;
    const timer = window.setTimeout(() => setExit('dimming'), Math.max(0, budgetEnd - performance.now()));
    return () => window.clearTimeout(timer);
  }, [held, exit, budgetEnd]);
  useEffect(() => {
    if (exit !== 'dimming') return;
    announce(true);
    const timer = window.setTimeout(cancelAndDismiss, reduced ? dimming.holdMs : dimming.fadeMs + dimming.holdMs);
    return () => window.clearTimeout(timer);
  }, [exit, cancelAndDismiss, reduced, announce]);
  // Any approach while dimming brings the glass back and grants five seconds.
  useEffect(() => { if (exit === 'dimming' && (present || focusWithin || menuOpen)) restore(); }, [exit, present, focusWithin, menuOpen, restore]);

  // The glass never takes focus when it appears. When the native window is focused
  // (a click inside it), the reading surface becomes the keyboard target.
  useEffect(() => {
    if (!bridge.native) return;
    const onFocus = () => {
      if (document.activeElement && document.activeElement !== document.body) return;
      root.current?.querySelector<HTMLElement>('[data-reading-surface]')?.focus({ preventScroll: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element || !captureId) return;
    let frame = 0;
    let disposed = false;
    const placed = () => { if (!disposed) setMoving(false); };
    if (!bridge.native) {
      if (moving) frame = requestAnimationFrame(placed);
      return () => { disposed = true; cancelAnimationFrame(frame); };
    }
    const publish = () => {
        if (active.current.closing) return;
        const bounds = element.getBoundingClientRect();
        // Order is a bridge invariant: the glass comes first; Rust anchors `frame`.
        const selectors = ['.translation-bubble', '.wait-pill', '.action-pill', '.more-menu', '.compact-feedback'];
        const parts = selectors.flatMap(selector => {
          const part = element.querySelector<HTMLElement>(selector);
          if (!part) return [];
          const style = getComputedStyle(part);
          if (style.visibility === 'hidden') return [];
          // Entrance travel (pill, menu, band) is paint only.
          const own = travel(part);
          const box = part.getBoundingClientRect();
          const rect = { x: box.x - own.x, y: box.y - own.y, width: box.width, height: box.height, bottom: box.bottom - own.y };
          return [{ part, rect, radius: parseFloat(style.borderTopLeftRadius) }];
        });
        // The root padding is the halo that holds the shadows (none in the browser preview).
        const rootStyle = getComputedStyle(element);
        const haloBox = { top: parseFloat(rootStyle.paddingTop) || 0, bottom: parseFloat(rootStyle.paddingBottom) || 0, left: parseFloat(rootStyle.paddingLeft) || 0 };
        // The window is reserved (src/layout.ts): anchored, it holds the parts with their
        // halo and never less than the floor that keeps the menu under the pill; bottom, it
        // is the reader reserve, the root projected centred on its bottom edge (the menu
        // lives in the space above the pill). Neither feedback nor a menu resizes it.
        const bottom = placement === 'bottom';
        const reserve = bottomReserve(screen, preset);
        const overshoot = bottom ? 0 : Math.min(0, ...parts.map(({ rect }) => rect.y - bounds.y - haloBox.top));
        const measured = Math.ceil(Math.max(bounds.height, ...parts.map(({ rect }) => rect.bottom - bounds.y + haloBox.bottom)) - overshoot);
        const width = bottom ? reserve.width : anchoredReserve.width;
        const height = bottom ? reserve.height : Math.max(measured, anchoredFloor);
        const offset = bottom ? { x: (reserve.width - bounds.width) / 2, y: reserve.height - bounds.height } : { x: 0, y: -overshoot };
        const regions: HitRegion[] = parts.map(({ rect, radius }) => {
          const x = Math.max(0, Math.round(rect.x - bounds.x + offset.x));
          const y = Math.max(0, Math.round(rect.y - bounds.y + offset.y));
          return { x, y, width: Math.min(width - x, Math.ceil(rect.width)), height: Math.min(height - y, Math.ceil(rect.height)), radius: Math.min(radius, rect.width / 2, rect.height / 2) };
        });
        // What Rust anchors beside the selection: the glass, or its footprint while the
        // pill waits (so the glass opens where the pill stood).
        const footprint: HitRegion = { x: Math.round(haloBox.left + offset.x), y: Math.round(haloBox.top + glass.overlap + offset.y), width: glass.shortWidth, height: short.minHeight, radius: 0 };
        const frameRegion = !bottom && form === 'pending' ? footprint : { ...regions[0], radius: 0 };
        const geometry = { captureId, presentation: placement, regions, frame: frameRegion };
        const signature = JSON.stringify({ width, height, ...geometry });
        if (signature !== previousGeometry.current) {
          previousGeometry.current = signature;
          void bridge.resize(width, height, geometry).then(placed, () => {
            if (previousGeometry.current === signature) previousGeometry.current = '';
            if (!disposed) setFeedback('Affichage indisponible. Réessayez.');
            placed();
          });
        } else placed();
    };
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(publish); };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('.translation-bubble,.wait-pill,.action-pill,.more-menu,.compact-feedback').forEach(part => observer.observe(part));
    // A hidden WebView may suspend rAF; the first geometry must unlock native show.
    publish();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [captureId, form, placement, moving, menuOpen, feedback, screen, preset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !captureId) return;
      if (event.key === 'Escape') { event.preventDefault(); if (menuOpen) setMenuOpen(false); else cancelAndDismiss(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, captureId, menuOpen]);

  if (!captureId) return null;
  const act = (run: () => void) => () => { refresh(); run(); };
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!ready || !state.requestId) return;
    refresh();
    const requestId = state.requestId;
    const stillCurrent = () => active.current.requestId === requestId && !active.current.closing;
    try {
      await (action === 'copy' ? bridge.copy(requestId) : bridge.replace(requestId));
      if (!stillCurrent()) return;
      if (action === 'copy') setCopied(true); else setFeedback('Remplacement effectué.');
    } catch {
      if (stillCurrent()) setFeedback(action === 'copy' ? 'La copie a été refusée.' : 'Remplacement indisponible. Utilisez Copier.');
    }
  };
  const metrics = isReader ? reader : short;
  const rootStyle = { '--copy-size': `${metrics.fontSize}px`, '--copy-line': `${metrics.lineHeight}px`, width: isReader ? reader.width : glass.shortWidth } as CSSProperties;
  const opacity = closingCaptureId ? 0 : exit === 'dimming' ? dimming.opacity : 1;
  const duration = reduced ? 0 : closingCaptureId ? (exit === 'dimming' ? dimming.exitMs : 120) / 1000 : exit === 'dimming' ? dimming.fadeMs / 1000 : motionTokens.enter;
  return <motion.div key={captureId} ref={root} className={`glass-overlay is-${form} is-${placement}`} style={rootStyle}
    data-capture-id={captureId} data-origin={state.capture?.origin} data-form={form} data-placement={placement} data-closing={Boolean(closingCaptureId)} data-moving={moving} data-dimming={exit === 'dimming'} data-pinned={pinned} data-dragging={dragging}
    onClickCapture={refresh} onWheelCapture={refresh} onKeyDownCapture={refresh}
    onFocus={event => { if (event.target.matches(':focus-visible')) setFocusWithin(true); }}
    onBlur={event => { if (!(event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget))) setFocusWithin(false); }}
    initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity }}
    transition={{ duration, ease: motionTokens.ease }}
    onAnimationComplete={() => { if (closingCaptureId) completeDismiss(closingCaptureId); }}>
    <BubbleMenu open={menuVisible} onOpenChange={setMenuOpen} actions={[
      { label: state.comparing ? 'Masquer l’original' : 'Afficher l’original', disabled: !ready, run: act(() => dispatch({ type: 'TOGGLE_COMPARE' })) },
      ...(state.replacementValid ? [{ label: 'Remplacer', disabled: !ready, run: () => void invokeResult('replace') }] : []),
      ...(state.phase === 'error' ? [{ label: 'Réessayer', run: act(() => { if (state.capture) start(state.capture); }) }] : []),
      { label: `Relancer en ${state.mode === 'quality' ? 'Rapide' : 'Qualité'}`, disabled: streaming, run: act(() => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); }) },
      { label: 'Réglages', run: act(() => void bridge.openSettings().catch(() => setFeedback('Ouvrez les réglages depuis l’icône FlowTranslate.'))) },
      { label: 'Fermer', run: cancelAndDismiss, close: true },
    ]}>
      <div className="glass-body">
        {form === 'pending' ? <WaitPill slow={slow} /> : <>
          <div className="translation-bubble" style={{ borderRadius: glass.radius, maxHeight: metrics.maxHeight }} data-reveal={state.phase === 'complete' && Boolean(state.result) && !moving}
            onPointerDown={event => { if (placement === 'anchored') dragSurface(event, () => setFeedback('Déplacement indisponible. Réessayez.'), setDragging); }}>
            <ReadingSurface streaming={streaming} onEnter={() => void invokeResult('copy')}>
              <AnimatePresence>{state.comparing && <motion.div key="original" {...fade} className="original-copy"><span>Original</span><Breakable text={state.capture?.text ?? ''} /></motion.div>}</AnimatePresence>
              <span className={`translation-text ${state.result || state.error ? '' : 'is-placeholder'}`}>
                {state.error && !state.result ? <span className="error-copy">{state.error} Réglages et Réessayer dans le menu&nbsp;⋯.</span>
                  : state.result ? <span key={state.requestId ?? 'result'} className="reveal"><Breakable text={state.result} /></span>
                  : <span className="wait-inline" role="img" aria-label="Traduction en cours"><WaitDots /></span>}
              </span>
              {state.error && state.result && <p className="subtle-warning">{state.error}</p>}
            </ReadingSurface>
          </div>
          <motion.div {...pillRise} className="action-pill" aria-label="Actions de traduction">
            <IconButton label="Copier la traduction" disabled={!ready} data-copied={copied || undefined} onClick={() => void invokeResult('copy')}>
              <AnimatedIcon name={copied ? 'check' : 'copy'} />
            </IconButton>
            {isReader && <IconButton label={pinned ? 'Détacher' : 'Épingler'} data-pressed={pinned || undefined} aria-pressed={pinned} onClick={() => setPinned(value => !value)}><Icon name={pinned ? 'unpin' : 'pin'} size={14} /></IconButton>}
            <BubbleMenuTrigger onClick={() => setMenuOpen(value => !value)} pressed={menuVisible} />
            <IconButton label="Fermer" className="pill-close" onClick={cancelAndDismiss}><Icon name="close" size={13} /></IconButton>
          </motion.div>
        </>}
      </div>
    </BubbleMenu>
    <AnimatePresence>{feedback && !menuVisible && form !== 'pending' && <motion.p key={feedback} {...fade} className="compact-feedback" role="status">{feedback}</motion.p>}</AnimatePresence>
    <span className="sr-only" role="status">{streaming ? 'Traduction en cours' : state.phase === 'complete' ? 'Traduction terminée' : copied ? 'Traduction copiée' : ''}</span>
  </motion.div>;
}

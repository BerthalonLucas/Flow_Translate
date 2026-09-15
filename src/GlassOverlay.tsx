import { Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { bridge } from './bridge';
import { anchoredFloor, compactLayout, dock, enlargedLayout, glass } from './layout';
import { breakable } from './text';
import { AnimatedIcon, BubbleMenu, BubbleMenuTrigger, Icon, IconButton, motionTokens, useFade, useRise } from './ui';
import type { HitRegion, Presentation } from './types';
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
// The glass docks as a tab on the bottom edge once the pointer has left it, or after a
// quiet read when the pointer never came. Streaming, the menu, a drag or a keyboard
// focus (`:focus-visible`, not the focus a click leaves behind) hold it. So does a
// pointer resting within 32 px of a surface (the halo, judged natively by the hit
// tester), and any click holds the glass two seconds: an action that moves the glass
// out from under the pointer must not fold it at once.
const DOCK_AFTER_LEAVE = 500;
const DOCK_AFTER_REST = 10000;
const GRACE_AFTER_ACTION = 2000;
const NEAR_MARGIN = 32;

// The engine works behind a ring; the whole result then lands at once (deltas are
// buffered in useTranslation), so the native window resizes a single time.
function LoadingRing() {
  return <span className="loading-ring" role="img" aria-label="Traduction en cours"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg></span>;
}

// Long runs (paths, URLs, identifiers) get a break opportunity after their separators,
// so the glass wraps them there instead of cutting a word at its rounded edge.
function Breakable({ text }: { text: string }) {
  return <>{breakable(text).map((piece, index) => index ? <Fragment key={index}><wbr />{piece}</Fragment> : piece)}</>;
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
  return controller.state.capture ? <GlassSession key={controller.state.capture.id} controller={controller} /> : null;
}

// What the session shows: the glass size, whether it lives on the bottom edge (docked)
// and, once docked, whether only the tab remains (collapsed).
type ViewLayout = { presentation: Presentation; docked: boolean; collapsed: boolean };
const sameView = (a: ViewLayout, b: ViewLayout) => a.presentation === b.presentation && a.docked === b.docked && a.collapsed === b.collapsed;

// Entrance travel is paint only: regions use the resting layout.
function travel(node: Element | null) {
  if (!node) return { x: 0, y: 0 };
  const transform = getComputedStyle(node).transform;
  if (!transform || transform === 'none') return { x: 0, y: 0 };
  const matrix = new DOMMatrix(transform);
  return { x: matrix.e, y: matrix.f };
}

function GlassSession({ controller }: { controller: TranslationController }) {
  const { state, dispatch, start, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
  const captureId = state.capture?.id;
  // Clipboard captures have no anchor: they open above the tab right away.
  const [dockState, setDock] = useState(() => ({ docked: state.capture?.source === 'clipboard', collapsed: false }));
  const desiredLayout: ViewLayout = { presentation: state.layout.presentation, docked: dockState.docked, collapsed: dockState.collapsed };
  const [displayedLayout, setDisplayedLayout] = useState(desiredLayout);
  const [layoutPhase, setLayoutPhase] = useState<'idle' | 'out' | 'commit' | 'in'>('idle');
  const targetLayout = useRef(desiredLayout);
  targetLayout.current = desiredLayout;
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
  // Folded once the body has faded: hidden from pointer, focus and assistive technology.
  const [folded, setFolded] = useState(false);
  const visited = useRef(false);
  const lastAction = useRef(Number.NEGATIVE_INFINITY);
  const root = useRef<HTMLDivElement>(null);
  const previousGeometry = useRef('');
  const fade = useFade('feedback');
  const pillRise = useRise(4, 'surface', 0.06);
  const reduced = useReducedMotion();
  const active = useRef({ requestId: state.requestId, closing: closingCaptureId });
  useLayoutEffect(() => { active.current = { requestId: state.requestId, closing: closingCaptureId }; }, [state.requestId, closingCaptureId]);
  const enlarged = displayedLayout.presentation === 'reader';
  const docked = displayedLayout.docked;
  const collapsed = docked && displayedLayout.collapsed;
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const ready = state.phase === 'complete' && !closingCaptureId && layoutPhase === 'idle';
  const streaming = state.phase === 'streaming';
  const settled = state.phase === 'complete' || state.phase === 'error' || state.phase === 'cancelled';

  useLayoutEffect(() => {
    if (closingCaptureId || layoutPhase !== 'idle' || sameView(displayedLayout, desiredLayout)) return;
    // Folding in place keeps the tab under the pointer; a move or a size change fades through.
    const foldOnly = displayedLayout.presentation === desiredLayout.presentation && displayedLayout.docked === desiredLayout.docked;
    if (foldOnly || reduced) setDisplayedLayout(desiredLayout);
    else setLayoutPhase('out');
  }, [desiredLayout, displayedLayout, layoutPhase, reduced, closingCaptureId]);
  // The body is always mounted: unfolding shows it before its fade; folding hides it once
  // the fade is over (or at once when nothing animates), see onAnimationComplete below.
  useLayoutEffect(() => {
    if (!collapsed) setFolded(false);
    else if (reduced || layoutPhase !== 'idle') setFolded(true);
  }, [collapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMenuOpen(false); setFeedback(null); setCopied(false); }, [captureId, state.requestId]);
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
  const held = hovered || focusWithin || menuOpen || dragging || !settled || Boolean(closingCaptureId) || layoutPhase !== 'idle';
  const menuOpenRef = useRef(menuOpen);
  menuOpenRef.current = menuOpen;
  // Hover is read from every pointerover the window sees, not from enter/leave pairs: a
  // menu item removed under the pointer would otherwise leave the glass "hovered" for
  // good. Leaving with the pointer means "done reading": a focus the menu or a click
  // left behind must not keep the glass open; keyboard-only use never moves the pointer.
  useEffect(() => {
    const release = () => {
      const focused = document.activeElement;
      if (!menuOpenRef.current && focused instanceof HTMLElement && root.current?.contains(focused)) focused.blur();
    };
    const over = (event: PointerEvent) => {
      const inside = event.target instanceof Node && Boolean(root.current?.contains(event.target));
      if (inside) visited.current = true; else release();
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
  useEffect(() => {
    if (collapsed || held || near) return;
    const grace = GRACE_AFTER_ACTION - (performance.now() - lastAction.current);
    const delay = visited.current ? Math.max(DOCK_AFTER_LEAVE, grace) : DOCK_AFTER_REST;
    const timer = window.setTimeout(() => setDock({ docked: true, collapsed: true }), delay);
    return () => window.clearTimeout(timer);
  }, [collapsed, held, near]);

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
    const releaseLayout = () => { if (!disposed && layoutPhase === 'commit') setLayoutPhase('in'); };
    if (!bridge.native) {
      if (layoutPhase === 'commit') frame = requestAnimationFrame(releaseLayout);
      return () => { disposed = true; cancelAnimationFrame(frame); };
    }
    const publish = () => {
        if (active.current.closing) return;
        const bounds = element.getBoundingClientRect();
        // Order is a bridge invariant: Rust anchors the glass (region zero). Folded, only
        // the tab takes the cursor: the body is still fading, so its state decides, not
        // its visibility.
        const selectors = collapsed ? ['.dock-tab'] : ['.translation-bubble', '.action-pill', '.more-menu', '.compact-feedback', '.dock-tab'];
        const parts = selectors.flatMap(selector => {
          const part = element.querySelector<HTMLElement>(selector);
          if (!part) return [];
          const style = getComputedStyle(part);
          if (style.visibility === 'hidden') return [];
          // Entrance travel (pill, menu) and the body's fade travel are paint only.
          const own = travel(part);
          const body = travel(part.closest('.glass-body'));
          const box = part.getBoundingClientRect();
          const rect = { x: box.x - own.x - body.x, y: box.y - own.y - body.y, width: box.width, height: box.height, bottom: box.bottom - own.y - body.y };
          return [{ part, rect, radius: parseFloat(style.borderTopLeftRadius) }];
        });
        // The root padding is the halo that holds the shadows (none in the browser preview).
        const rootStyle = getComputedStyle(element);
        const haloBox = { top: parseFloat(rootStyle.paddingTop) || 0, bottom: parseFloat(rootStyle.paddingBottom) || 0 };
        // The window is reserved (src/layout.ts): anchored, it holds the parts with their
        // halo and never less than the floor that keeps the menu under the pill; docked, it
        // is the constant reserve, the root projected centred on its bottom edge (the menu
        // lives in the space above the pill). Neither a fold, an unfold nor a menu resizes it.
        const overshoot = docked ? 0 : Math.min(0, ...parts.map(({ rect }) => rect.y - bounds.y - haloBox.top));
        const measured = Math.ceil(Math.max(bounds.height, ...parts.map(({ rect }) => rect.bottom - bounds.y + haloBox.bottom)) - overshoot);
        const width = docked ? dock.width : Math.ceil(bounds.width);
        const height = docked ? dock.height : Math.max(measured, anchoredFloor);
        const offset = docked ? { x: (dock.width - bounds.width) / 2, y: dock.height - bounds.height } : { x: 0, y: -overshoot };
        const regions: HitRegion[] = parts.map(({ rect, radius }) => {
          const x = Math.max(0, Math.round(rect.x - bounds.x + offset.x));
          const y = Math.max(0, Math.round(rect.y - bounds.y + offset.y));
          return { x, y, width: Math.min(width - x, Math.ceil(rect.width)), height: Math.min(height - y, Math.ceil(rect.height)), radius: Math.min(radius, rect.width / 2, rect.height / 2) };
        });
        const geometry = { captureId, presentation: docked ? 'docked' as const : displayedLayout.presentation, regions };
        const signature = JSON.stringify({ width, height, ...geometry });
        if (signature !== previousGeometry.current) {
          previousGeometry.current = signature;
          void bridge.resize(width, height, geometry).then(releaseLayout, () => {
            if (previousGeometry.current === signature) previousGeometry.current = '';
            if (!disposed) setFeedback('Affichage indisponible. Réessayez.');
            releaseLayout();
          });
        } else releaseLayout();
    };
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(publish); };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('.translation-bubble,.action-pill,.more-menu,.compact-feedback,.dock-tab').forEach(part => observer.observe(part));
    // A hidden WebView may suspend rAF; the first geometry must unlock native show.
    publish();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [captureId, displayedLayout, docked, collapsed, layoutPhase, menuOpen, feedback]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !captureId) return;
      if (event.key === 'Escape') { event.preventDefault(); if (menuOpen) setMenuOpen(false); else cancelAndDismiss(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, captureId, menuOpen]);

  if (!captureId) return null;
  const touch = () => { lastAction.current = performance.now(); };
  const act = (run: () => void) => () => { touch(); run(); };
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!ready || !state.requestId) return;
    touch();
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
  const changePresentation = () => { touch(); dispatch({ type: 'LAYOUT', captureId, layout: enlarged ? compactLayout : enlargedLayout }); };
  const expand = () => { if (layoutPhase === 'idle' && !closingCaptureId) setDock({ docked: true, collapsed: false }); };
  const visit = () => { visited.current = true; };
  return <motion.div key={captureId} ref={root} className={`glass-overlay ${enlarged ? 'is-reader' : 'is-contextual'} ${docked ? 'is-docked' : ''}`} data-capture-id={captureId} data-closing={Boolean(closingCaptureId)} data-layout-phase={layoutPhase} data-dragging={dragging} data-docked={docked} data-collapsed={collapsed} data-folded={folded}
    onClickCapture={touch}
    onFocus={event => {
      // A keyboard focus holds the glass, unless it lands after the pointer already left
      // (Radix restoring the trigger once the menu closed): that read is over.
      if (event.target.matches(':focus-visible') && (hovered || !visited.current)) { visit(); setFocusWithin(true); }
    }} onBlur={event => { if (!(event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget))) setFocusWithin(false); }}
    initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: closingCaptureId || layoutPhase === 'out' || layoutPhase === 'commit' ? 0 : 1 }}
    transition={{ duration: reduced ? 0 : closingCaptureId ? .12 : layoutPhase === 'out' ? .08 : layoutPhase === 'commit' ? 0 : layoutPhase === 'in' ? .14 : motionTokens.enter, ease: motionTokens.ease }}
    onAnimationComplete={() => {
      if (closingCaptureId) completeDismiss(closingCaptureId);
      else if (layoutPhase === 'out') { setDisplayedLayout(targetLayout.current); setLayoutPhase('commit'); }
      else if (layoutPhase === 'in') setLayoutPhase('idle');
    }}>
    <BubbleMenu open={menuVisible} onOpenChange={setMenuOpen} actions={[
      { label: enlarged ? 'Réduire' : 'Agrandir', run: changePresentation },
      { label: state.comparing ? 'Masquer l’original' : 'Afficher l’original', disabled: !ready, run: act(() => dispatch({ type: 'TOGGLE_COMPARE' })) },
      ...(state.replacementValid ? [{ label: 'Remplacer', disabled: !ready, run: () => void invokeResult('replace') }] : []),
      ...(state.phase === 'error' ? [{ label: 'Réessayer', run: act(() => { if (state.capture) start(state.capture); }) }] : []),
      { label: `Relancer en ${state.mode === 'quality' ? 'Rapide' : 'Qualité'}`, disabled: streaming, run: act(() => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); }) },
      { label: 'Réglages', run: act(() => void bridge.openSettings().catch(() => setFeedback('Ouvrez les réglages depuis l’icône FlowTranslate.'))) },
      { label: 'Fermer', run: cancelAndDismiss, close: true },
    ]}>
      {/* Folding is a fade in place (paint only): the window keeps its size and the tab its spot. */}
      <motion.div className="glass-body" inert={collapsed} initial={false}
        animate={collapsed ? { opacity: 0, y: 6 } : { opacity: 1, y: 0 }}
        transition={{ duration: reduced || layoutPhase !== 'idle' ? 0 : collapsed ? motionTokens.exit : motionTokens.enter, ease: motionTokens.ease }}
        onAnimationComplete={() => setFolded(collapsedRef.current)}>
        <div className="translation-bubble" style={{ borderRadius: glass.radius }} data-reveal={state.phase === 'complete' && Boolean(state.result)}
          onPointerDown={event => { if (!docked) dragSurface(event, () => setFeedback('Déplacement indisponible. Réessayez.'), setDragging); }}>
          <ReadingSurface streaming={streaming} onEnter={() => void invokeResult('copy')}>
            <AnimatePresence>{state.comparing && <motion.div key="original" {...fade} className="original-copy"><span>Original</span><Breakable text={state.capture?.text ?? ''} /></motion.div>}</AnimatePresence>
            <span className={`translation-text ${state.result || state.error ? '' : 'is-placeholder'}`}>
              {state.error && !state.result ? <span className="error-copy">{state.error} Réglages et Réessayer dans le menu&nbsp;⋯.</span>
                : state.result ? <span key={state.requestId ?? 'result'} className="reveal"><Breakable text={state.result} /></span>
                : <LoadingRing />}
            </span>
            {state.error && state.result && <p className="subtle-warning">{state.error}</p>}
          </ReadingSurface>
        </div>
        <motion.div {...pillRise} className="action-pill" aria-label="Actions de traduction">
          <IconButton label="Copier la traduction" disabled={!ready} data-copied={copied || undefined} onClick={() => void invokeResult('copy')}>
            <AnimatedIcon name={copied ? 'check' : 'copy'} />
          </IconButton>
          {enlarged && <IconButton label="Réduire" onClick={changePresentation}><Icon name="minimize" /></IconButton>}
          <BubbleMenuTrigger onClick={() => setMenuOpen(value => !value)} pressed={menuVisible} />
        </motion.div>
      </motion.div>
    </BubbleMenu>
    <AnimatePresence>{feedback && !menuVisible && !collapsed && <motion.p key={feedback} {...fade} className="compact-feedback" role="status">{feedback}</motion.p>}</AnimatePresence>
    {docked && <div className="dock-tab" data-expanded={!collapsed} onPointerEnter={expand}>
      <button type="button" className="dock-open" aria-label="Afficher la traduction" aria-expanded={!collapsed} onFocus={expand} onClick={expand}><Icon name="languages" size={12} /></button>
      <button type="button" className="dock-close" aria-label="Fermer" onClick={cancelAndDismiss}><Icon name="close" size={11} /></button>
    </div>}
    <span className="sr-only" role="status">{streaming ? 'Traduction en cours' : state.phase === 'complete' ? 'Traduction terminée' : copied ? 'Traduction copiée' : ''}</span>
  </motion.div>;
}

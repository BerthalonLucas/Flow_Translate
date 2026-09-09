import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { bridge } from './bridge';
import { compactLayout, enlargedLayout, glass } from './layout';
import { AnimatedIcon, BubbleMenu, BubbleMenuTrigger, Icon, IconButton, motionTokens, useFade, useRise } from './ui';
import type { HitRegion } from './types';
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

// The text scrolls inside the glass without a native bar. Radix ScrollArea owns the
// 3 px indicator geometry; it shows on hover or while scrolling and fades 800 ms later.
// Edge fades follow the scroll position; a hint chip marks a stream past the ceiling.
function ReadingSurface({ children, streaming, resetKey, onEnter }: {
  children: ReactNode; streaming: boolean; resetKey: string | null; onEnter: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<ScrollEdge>('none');
  const [userScrolled, setUserScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const rise = useRise(4);
  useEffect(() => { setUserScrolled(false); }, [resetKey]);
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
      if (element.scrollTop > 0) setUserScrolled(true);
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
    <AnimatePresence>{streaming && capped && !userScrolled && <motion.span key="hint" {...rise} className="stream-hint" role="status"><i aria-hidden="true" />la suite arrive</motion.span>}</AnimatePresence>
  </ScrollArea.Root>;
}

export function GlassOverlay({ controller }: { controller: TranslationController }) {
  return controller.state.capture ? <GlassSession key={controller.state.capture.id} controller={controller} /> : null;
}

function GlassSession({ controller }: { controller: TranslationController }) {
  const { state, dispatch, start, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
  const desiredLayout = state.layout;
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
  const root = useRef<HTMLDivElement>(null);
  const previousGeometry = useRef('');
  const fade = useFade('feedback');
  const pillRise = useRise(4, 'surface', 0.06);
  const reduced = useReducedMotion();
  const active = useRef({ requestId: state.requestId, closing: closingCaptureId });
  useLayoutEffect(() => { active.current = { requestId: state.requestId, closing: closingCaptureId }; }, [state.requestId, closingCaptureId]);
  const captureId = state.capture?.id;
  const enlarged = displayedLayout.presentation === 'reader';
  const ready = state.phase === 'complete' && !closingCaptureId && layoutPhase === 'idle';
  const streaming = state.phase === 'streaming';

  useLayoutEffect(() => {
    if (closingCaptureId || layoutPhase !== 'idle') return;
    if (displayedLayout.presentation === desiredLayout.presentation) return;
    if (reduced) setDisplayedLayout(desiredLayout);
    else setLayoutPhase('out');
  }, [desiredLayout, displayedLayout, layoutPhase, reduced, closingCaptureId]);
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

  // The glass never takes focus when it appears. A second shortcut press focuses the
  // native window; the reading surface then becomes the keyboard target.
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
        const width = Math.ceil(bounds.width);
        // Order is a bridge invariant: Rust anchors the glass (region zero). The menu
        // overlays the text and may reach below the glass: the window grows to hold it.
        const selectors = ['.translation-bubble', '.action-pill', '.more-menu', '.compact-feedback'];
        const parts = selectors.flatMap(selector => {
          const part = element.querySelector<HTMLElement>(selector);
          if (!part) return [];
          const style = getComputedStyle(part);
          if (style.visibility === 'hidden') return [];
          // Entrance travel (pill, menu) is paint only: regions use the resting layout.
          const travel = style.transform && style.transform !== 'none' ? new DOMMatrix(style.transform) : null;
          const box = part.getBoundingClientRect();
          const rect = travel ? { x: box.x - travel.e, y: box.y - travel.f, width: box.width, height: box.height, bottom: box.bottom - travel.f } : box;
          return [{ part, rect }];
        });
        const height = Math.ceil(Math.max(bounds.height, ...parts.map(({ rect }) => rect.bottom - bounds.y)));
        const regions: HitRegion[] = parts.map(({ part, rect }) => {
          const x = Math.max(0, Math.round(rect.x - bounds.x));
          const y = Math.max(0, Math.round(rect.y - bounds.y));
          return { x, y, width: Math.min(width - x, Math.ceil(rect.width)), height: Math.min(height - y, Math.ceil(rect.height)), radius: Math.min(parseFloat(getComputedStyle(part).borderTopLeftRadius), rect.width / 2, rect.height / 2) };
        });
        const geometry = { captureId, presentation: displayedLayout.presentation, regions };
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
    element.querySelectorAll('.translation-bubble,.action-pill,.more-menu,.compact-feedback').forEach(part => observer.observe(part));
    // A hidden WebView may suspend rAF; the first geometry must unlock native show.
    publish();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [captureId, displayedLayout, layoutPhase, menuOpen, feedback]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !captureId) return;
      if (event.key === 'Escape') { event.preventDefault(); if (menuOpen) setMenuOpen(false); else cancelAndDismiss(); }
      if (event.key === 'Enter' && state.phase === 'confirming' && state.capture && !(event.target instanceof HTMLButtonElement)) start(state.capture);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, start, state.capture, state.phase, captureId, menuOpen]);

  if (!captureId) return null;
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!ready || !state.requestId) return;
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
  const changePresentation = () => dispatch({ type: 'LAYOUT', captureId, layout: enlarged ? compactLayout : enlargedLayout });
  return <motion.div key={captureId} ref={root} className={`glass-overlay ${enlarged ? 'is-reader' : 'is-contextual'}`} data-capture-id={captureId} data-closing={Boolean(closingCaptureId)} data-layout-phase={layoutPhase} data-dragging={dragging}
    initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: closingCaptureId || layoutPhase === 'out' || layoutPhase === 'commit' ? 0 : 1 }}
    transition={{ duration: reduced ? 0 : closingCaptureId ? .12 : layoutPhase === 'out' ? .08 : layoutPhase === 'commit' ? 0 : layoutPhase === 'in' ? .14 : motionTokens.enter, ease: motionTokens.ease }}
    onAnimationComplete={() => {
      if (closingCaptureId) completeDismiss(closingCaptureId);
      else if (layoutPhase === 'out') { setDisplayedLayout(targetLayout.current); setLayoutPhase('commit'); }
      else if (layoutPhase === 'in') setLayoutPhase('idle');
    }}>
    <BubbleMenu open={menuVisible} onOpenChange={setMenuOpen} actions={[
      { label: enlarged ? 'Réduire' : 'Agrandir', run: changePresentation },
      { label: state.comparing ? 'Masquer l’original' : 'Afficher l’original', disabled: !ready, run: () => dispatch({ type: 'TOGGLE_COMPARE' }) },
      ...(state.replacementValid ? [{ label: 'Remplacer', disabled: !ready, run: () => void invokeResult('replace') }] : []),
      ...(state.phase === 'error' ? [{ label: 'Réessayer', run: () => { if (state.capture) start(state.capture); } }] : []),
      { label: `Relancer en ${state.mode === 'quality' ? 'Rapide' : 'Qualité'}`, disabled: streaming || state.phase === 'confirming', run: () => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); } },
      { label: 'Réglages', run: () => void bridge.openSettings().catch(() => setFeedback('Ouvrez les réglages depuis l’icône FlowTranslate.')) },
      { label: 'Fermer', run: cancelAndDismiss, close: true },
    ]}>
      <div className="translation-bubble" style={{ borderRadius: glass.radius }}
        onPointerDown={event => dragSurface(event, () => setFeedback('Déplacement indisponible. Réessayez.'), setDragging)}>
        {state.phase === 'confirming' ? <div className="confirmation" data-reading-surface>
          <p>Traduire le texte du presse-papiers&nbsp;?</p>
          <div className="source-preview" tabIndex={0}>{state.capture?.text}</div>
          <div className="confirmation-actions"><button className="quiet-action" onClick={cancelAndDismiss}>Annuler</button><button className="primary-action" onClick={() => state.capture && start(state.capture)}>Traduire</button></div>
        </div> : <ReadingSurface streaming={streaming} resetKey={state.requestId} onEnter={() => void invokeResult('copy')}>
          <AnimatePresence>{state.comparing && <motion.div key="original" {...fade} className="original-copy"><span>Original</span>{state.capture?.text}</motion.div>}</AnimatePresence>
          <span className={`translation-text ${state.result || state.error ? '' : 'is-placeholder'}`}>{state.error && !state.result ? <span className="error-copy">{state.error} Réglages et Réessayer dans le menu&nbsp;⋯.</span> : state.result || 'Traduction en cours…'}</span>
          {state.error && state.result && <p className="subtle-warning">{state.error}</p>}
        </ReadingSurface>}
      </div>
      <motion.div {...pillRise} className="action-pill" aria-label="Actions de traduction">
        <IconButton label="Copier la traduction" disabled={!ready} data-copied={copied || undefined} onClick={() => void invokeResult('copy')}>
          <AnimatedIcon name={copied ? 'check' : 'copy'} />
        </IconButton>
        {enlarged && <IconButton label="Réduire" onClick={changePresentation}><Icon name="minimize" /></IconButton>}
        <BubbleMenuTrigger onClick={() => setMenuOpen(value => !value)} pressed={menuVisible} />
      </motion.div>
    </BubbleMenu>
    <AnimatePresence>{feedback && !menuVisible && <motion.p key={feedback} {...fade} className="compact-feedback" role="status">{feedback}</motion.p>}</AnimatePresence>
    <span className="sr-only" role="status">{streaming ? 'Traduction en cours' : state.phase === 'complete' ? 'Traduction terminée' : copied ? 'Traduction copiée' : ''}</span>
  </motion.div>;
}

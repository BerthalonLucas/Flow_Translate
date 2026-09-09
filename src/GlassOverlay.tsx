import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { bridge } from './bridge';
import { glass, layoutForText, textHeight } from './layout';
import { AnimatedIcon, BubbleMenu, BubbleMenuTrigger, IconButton, motionTokens, useFade } from './ui';
import type { HitRegion } from './types';
import type { TranslationController } from './useTranslation';

export function dragSurface(event: PointerEvent<HTMLDivElement>, onError?: () => void) {
  if (!bridge.native || event.button !== 0 || !event.isPrimary) return;
  const target = event.target as HTMLElement;
  if (target.closest('button, input, select, a, [role="menu"], [data-reading-surface]')) return;
  event.preventDefault();
  void bridge.startDrag(event.clientX, event.clientY).catch(() => onError?.());
}

function ScrollText({ children, streaming }: { children: ReactNode; streaming: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !content.current) return;
    const update = () => {
      element.dataset.scrollUp = String(element.scrollTop > 2);
      element.dataset.scrollDown = String(element.scrollHeight - element.clientHeight - element.scrollTop > 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); observer.observe(content.current);
    element.addEventListener('scroll', update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, []);
  return <div ref={viewport} className={`translation-copy ${streaming ? 'is-streaming' : ''}`} data-reading-surface tabIndex={0} role="region" aria-label="Traduction" aria-busy={streaming}>
    <div ref={content}>{children}</div>
  </div>;
}

export function GlassOverlay({ controller }: { controller: TranslationController }) {
  return controller.state.capture ? <GlassSession key={controller.state.capture.id} controller={controller} /> : null;
}

function GlassSession({ controller }: { controller: TranslationController }) {
  const { state, dispatch, start, cancelAndDismiss, completeDismiss, closingCaptureId } = controller;
  const desiredLayout = useMemo(() => state.phase === 'confirming' ? { ...state.layout, bodyHeight: 166 } : state.layout, [state.phase, state.layout]);
  const [displayedLayout, setDisplayedLayout] = useState(desiredLayout);
  const [layoutPhase, setLayoutPhase] = useState<'idle' | 'out' | 'commit' | 'in'>('idle');
  const targetLayout = useRef(desiredLayout);
  targetLayout.current = desiredLayout;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAtExit = useRef(false);
  useLayoutEffect(() => { if (!closingCaptureId) menuAtExit.current = menuOpen; }, [menuOpen, closingCaptureId]);
  const menuVisible = closingCaptureId ? menuAtExit.current : menuOpen;
  const [feedback, setFeedback] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const previousGeometry = useRef('');
  const fade = useFade('feedback');
  const reduced = useReducedMotion();
  const active = useRef({ requestId: state.requestId, closing: closingCaptureId });
  useLayoutEffect(() => { active.current = { requestId: state.requestId, closing: closingCaptureId }; }, [state.requestId, closingCaptureId]);
  const captureId = state.capture?.id;
  const reader = displayedLayout.presentation === 'reader';
  const ready = state.phase === 'complete' && !closingCaptureId && layoutPhase === 'idle';
  const streaming = state.phase === 'streaming';
  const completeText = state.phase === 'complete' ? state.result : '';
  const compactResult = useMemo(() => Boolean(completeText) && textHeight(completeText, 'contextual') <= 84, [completeText]);

  useLayoutEffect(() => {
    if (closingCaptureId || layoutPhase !== 'idle') return;
    if (displayedLayout.presentation === desiredLayout.presentation && displayedLayout.bodyHeight === desiredLayout.bodyHeight) return;
    if (reduced) setDisplayedLayout(desiredLayout);
    else setLayoutPhase('out');
  }, [desiredLayout, displayedLayout, layoutPhase, reduced, closingCaptureId]);
  useEffect(() => { setMenuOpen(false); setFeedback(null); }, [captureId, state.requestId]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  // Streaming uses the size chosen from the source. Only a completed response can
  // promote a contextual result to the reader; a reader never auto-shrinks back.
  useLayoutEffect(() => {
    if (state.phase !== 'complete' || !captureId) return;
    const layout = layoutForText(state.result, state.layout.presentation);
    dispatch({ type: 'LAYOUT', captureId, layout });
    // The layout is deliberately not a dependency: explicit user choices persist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.requestId, state.result, captureId, dispatch]);

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
        const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height);
        // Order is a bridge invariant: Rust anchors the glass (region zero).
        const selectors = ['.translation-bubble', '.action-pill', '.more-menu', '.compact-feedback'];
        const regions: HitRegion[] = selectors.flatMap(selector => {
          const part = element.querySelector<HTMLElement>(selector);
          if (!part || getComputedStyle(part).visibility === 'hidden') return [];
          const rect = part.getBoundingClientRect();
          const x = Math.max(0, Math.round(rect.x - bounds.x));
          const y = Math.max(0, Math.round(rect.y - bounds.y));
          return [{ x, y, width: Math.min(width - x, Math.ceil(rect.width)), height: Math.min(height - y, Math.ceil(rect.height)), radius: Math.min(parseFloat(getComputedStyle(part).borderTopLeftRadius), rect.width / 2, rect.height / 2) }];
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
      if (event.key === 'Escape') { event.preventDefault(); cancelAndDismiss(); }
      if (event.key === 'Enter' && state.phase === 'confirming' && state.capture && !(event.target instanceof HTMLButtonElement)) start(state.capture);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelAndDismiss, start, state.capture, state.phase, captureId]);

  if (!captureId) return null;
  const invokeResult = async (action: 'copy' | 'replace') => {
    if (!ready || !state.requestId) return;
    const requestId = state.requestId;
    const stillCurrent = () => active.current.requestId === requestId && !active.current.closing;
    try {
      await (action === 'copy' ? bridge.copy(requestId) : bridge.replace(requestId));
      if (stillCurrent()) setFeedback(action === 'copy' ? 'Copié.' : 'Remplacement effectué.');
    } catch {
      if (stillCurrent()) setFeedback(action === 'copy' ? 'La copie a été refusée.' : 'Remplacement indisponible. Utilisez Copier.');
    }
  };
  const changePresentation = () => {
    const presentation = reader ? 'contextual' : 'reader';
    dispatch({ type: 'LAYOUT', captureId, layout: layoutForText(state.result || state.capture!.text, presentation) });
  };
  const bodyHeight = displayedLayout.bodyHeight;
  return <motion.div key={captureId} ref={root} className={`glass-overlay ${reader ? 'is-reader' : 'is-contextual'}`} data-capture-id={captureId} data-closing={Boolean(closingCaptureId)} data-layout-phase={layoutPhase}
    initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: closingCaptureId || layoutPhase === 'out' || layoutPhase === 'commit' ? 0 : 1 }}
    transition={{ duration: reduced ? 0 : closingCaptureId ? .12 : layoutPhase === 'out' ? .08 : layoutPhase === 'commit' ? 0 : layoutPhase === 'in' ? .14 : motionTokens.enter, ease: motionTokens.ease }}
    onAnimationComplete={() => {
      if (closingCaptureId) completeDismiss(closingCaptureId);
      else if (layoutPhase === 'out') { setDisplayedLayout(targetLayout.current); setLayoutPhase('commit'); }
      else if (layoutPhase === 'in') setLayoutPhase('idle');
    }}>
    <BubbleMenu open={menuVisible} onOpenChange={setMenuOpen} actions={[
      { label: reader ? 'Réduire' : 'Agrandir', disabled: reader && !compactResult, run: changePresentation },
      { label: state.comparing ? 'Masquer l’original' : 'Afficher l’original', disabled: !ready, run: () => dispatch({ type: 'TOGGLE_COMPARE' }) },
      ...(state.replacementValid ? [{ label: 'Remplacer', disabled: !ready, run: () => void invokeResult('replace') }] : []),
      { label: `Relancer en ${state.mode === 'quality' ? 'Rapide' : 'Qualité'}`, disabled: streaming || state.phase === 'confirming', run: () => { if (state.capture) start(state.capture, { mode: state.mode === 'quality' ? 'fast' : 'quality' }); } },
      { label: 'Réglages', run: () => void bridge.openSettings() },
      { label: 'Fermer', run: cancelAndDismiss, close: true },
    ]}>
      <div className="translation-bubble" style={{ height: bodyHeight, borderRadius: glass.radius }} onPointerDown={event => dragSurface(event, () => setFeedback('Déplacement indisponible. Réessayez.'))}>
        {state.phase === 'confirming' ? <div className="confirmation" data-reading-surface>
          <p>Traduire le texte du presse-papiers&nbsp;?</p>
          <div className="source-preview" tabIndex={0}>{state.capture?.text}</div>
          <div className="confirmation-actions"><button className="quiet-action" onClick={cancelAndDismiss}>Annuler</button><button className="primary-action" onClick={() => state.capture && start(state.capture)}>Traduire</button></div>
        </div> : <ScrollText streaming={streaming}>
          <AnimatePresence>{state.comparing && <motion.div key="original" {...fade} className="original-copy"><span>Original</span>{state.capture?.text}</motion.div>}</AnimatePresence>
          <span className="translation-text">{state.error && !state.result ? <span className="error-copy">{state.error}</span> : state.result || 'Traduction en cours…'}</span>
          {state.error && state.result && <p className="subtle-warning">{state.error}</p>}
        </ScrollText>}
      </div>
      <div className="action-pill" aria-label="Actions de traduction">
        <IconButton label="Copier la traduction" disabled={!ready} onClick={() => void invokeResult('copy')}>
          <AnimatedIcon name={feedback === 'Copié.' ? 'check' : 'copy'} />
        </IconButton>
        <BubbleMenuTrigger onClick={() => setMenuOpen(value => !value)} />
      </div>
    </BubbleMenu>
    <AnimatePresence>{feedback && !menuVisible && <motion.p key={feedback} {...fade} className="compact-feedback" role="status">{feedback}</motion.p>}</AnimatePresence>
    <span className="sr-only" role="status">{streaming ? 'Traduction en cours' : state.phase === 'complete' ? 'Traduction terminée' : ''}</span>
  </motion.div>;
}

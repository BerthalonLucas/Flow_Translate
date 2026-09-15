import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { bridge } from './bridge';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture, CaptureNotice, CaptureTarget, Language, Mode, Screen, Settings, StreamEvent } from './types';

// A notice (nothing to translate, protected field…) shows four seconds, like Rust keeps its window.
const NOTICE_MS = 4000;
export type Notice = { id: number; message: string };

export function useTranslation(readyOnMount = false) {
  const [state, dispatch] = useReducer(translationReducer, initialTranslationState);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef(0);
  // The screen the glass is on (the capture's, then `work-area` when the cursor moves a bottom form).
  const [screen, setScreen] = useState<Screen | null>(null);
  const [closingCaptureId, setClosingCaptureId] = useState<string | null>(null);
  const closingRef = useRef<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const settingsReadyRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const handledCaptureRef = useRef<string | null>(null);
  // Deltas are buffered until the stream ends: the glass shows a ring, then the whole
  // result lands at once (one native resize instead of one per line). An error or an
  // interruption still surfaces the partial text through flush().
  const pending = useRef({ requestId: '', text: '' });
  const [initError, setInitError] = useState<string | null>(null);

  const discardPending = useCallback(() => { pending.current = { requestId: '', text: '' }; }, []);
  const flush = useCallback(() => {
    const queued = pending.current;
    if (queued.text && queued.requestId === requestRef.current) dispatch({ type: 'STREAM', event: { requestId: queued.requestId, kind: 'delta', text: queued.text } });
    discardPending();
  }, [discardPending]);

  useEffect(() => {
    settingsReadyRef.current = bridge.getSettings().then(next => { settingsRef.current = next; setSettings(next); return true; }).catch(() => false);
    return () => { discardPending(); window.clearTimeout(noticeTimer.current); };
  }, [discardPending]);
  const showNotice = useCallback((message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ id: Date.now(), message });
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const start = useCallback((capture: Capture, forced?: { mode?: Mode; targetLanguage?: Language }) => {
    const mode = forced?.mode ?? settingsRef.current?.mode ?? 'quality';
    const targetLanguage = forced?.targetLanguage ?? settingsRef.current?.targetLanguage ?? 'fr';
    const id = crypto.randomUUID();
    discardPending();
    requestRef.current = id;
    dispatch({ type: 'START', requestId: id, mode, targetLanguage });
    void bridge.translate({ id, captureId: capture.id, text: capture.text, targetLanguage, mode }).catch(() => {
      if (requestRef.current === id) dispatch({ type: 'STREAM', event: { requestId: id, kind: 'error', message: 'La traduction n’a pas pu démarrer.' } });
    });
  }, [discardPending]);

  const receiveCapture = useCallback((capture: Capture) => {
    if (handledCaptureRef.current === capture.id) return;
    if (requestRef.current) void bridge.cancel(requestRef.current).catch(() => undefined);
    discardPending();
    requestRef.current = null;
    handledCaptureRef.current = capture.id;
    captureRef.current = capture;
    closingRef.current = null;
    setClosingCaptureId(null);
    window.clearTimeout(noticeTimer.current);
    setNotice(null);
    setScreen(capture.screen ?? null);
    dispatch({ type: 'CAPTURE', capture });
    if (capture.replay) {
      // A result shown again from the tray: complete at once, nothing to translate.
      const { requestId, translatedText, mode, targetLanguage } = capture.replay;
      requestRef.current = requestId;
      dispatch({ type: 'START', requestId, mode, targetLanguage });
      dispatch({ type: 'STREAM', event: { requestId, kind: 'delta', text: translatedText } });
      dispatch({ type: 'STREAM', event: { requestId, kind: 'done' } });
      return;
    }
    // The shortcut translates at once, clipboard fallback included: no confirmation step.
    start(capture);
  }, [discardPending, start]);

  useEffect(() => {
    let off: Array<() => void> = [];
    let disposed = false;
    void Promise.all([
      bridge.on<Capture>('capture', receiveCapture),
      bridge.on<StreamEvent>('translation', event => {
        if (event.requestId !== requestRef.current || closingRef.current) return;
        if (event.kind === 'delta') {
          pending.current.requestId = event.requestId;
          pending.current.text += event.text ?? '';
        } else { flush(); dispatch({ type: 'STREAM', event }); }
      }),
      bridge.on<{ captureId: string }>('overlay-dismiss-requested', ({ captureId }) => {
        if (captureId !== captureRef.current?.id) return;
        discardPending();
        requestRef.current = null;
        closingRef.current = captureId;
        setClosingCaptureId(captureId);
        dispatch({ type: 'CANCEL' });
      }),
      bridge.on<Settings>('settings-changed', next => { settingsRef.current = next; setSettings(next); }),
      bridge.on<{ captureId: string; message: string }>('target-invalidated', invalidation => {
        if (invalidation.captureId === captureRef.current?.id) dispatch({ type: 'INVALIDATE', message: invalidation.message });
      }),
      bridge.on<CaptureTarget>('capture-target', target => dispatch({ type: 'TARGET', ...target })),
      bridge.on<CaptureNotice>('capture-notice', ({ message }) => showNotice(message)),
      bridge.on<Screen>('work-area', next => setScreen(next)),
    ]).then(async listeners => {
      if (disposed) listeners.forEach(unlisten => unlisten());
      else {
        off = listeners;
        if (readyOnMount) {
          try {
            if (!await settingsReadyRef.current) throw new Error('settings unavailable');
            const capture = await bridge.frontendReady();
            if (capture && !disposed) receiveCapture(capture);
          } catch { if (!disposed) setInitError('La connexion à FlowTranslate est indisponible.'); }
        }
      }
    }).catch(() => { if (!disposed) setInitError('La connexion à FlowTranslate est indisponible.'); });
    return () => { disposed = true; off.forEach(unlisten => unlisten()); };
  }, [discardPending, flush, readyOnMount, receiveCapture, showNotice]);

  const cancelAndDismiss = useCallback(() => { void bridge.dismiss().catch(() => setInitError('La fermeture a échoué. Réessayez.')); }, []);
  const completeDismiss = useCallback((captureId: string) => {
    if (closingRef.current !== captureId || captureRef.current?.id !== captureId) return;
    closingRef.current = null;
    captureRef.current = null;
    setClosingCaptureId(null);
    dispatch({ type: 'DISMISS' });
    void bridge.completeDismiss(captureId).catch(() => undefined);
  }, []);

  return { state, settings, screen, dispatch, receiveCapture, start, cancelAndDismiss, completeDismiss, closingCaptureId, initError, notice };
}

export type TranslationController = ReturnType<typeof useTranslation>;

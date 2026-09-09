import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { bridge } from './bridge';
import { layoutForText } from './layout';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture, Language, Mode, Settings, StreamEvent } from './types';

export function useTranslation(readyOnMount = false) {
  const [state, dispatch] = useReducer(translationReducer, initialTranslationState);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [closingCaptureId, setClosingCaptureId] = useState<string | null>(null);
  const closingRef = useRef<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const settingsRef = useRef<Settings | null>(null);
  const settingsReadyRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const handledCaptureRef = useRef<string | null>(null);
  const pending = useRef({ requestId: '', text: '', timer: 0 });
  const [initError, setInitError] = useState<string | null>(null);

  const discardPending = useCallback(() => {
    window.clearTimeout(pending.current.timer);
    pending.current = { requestId: '', text: '', timer: 0 };
  }, []);
  const flush = useCallback(() => {
    const queued = pending.current;
    if (queued.text && queued.requestId === requestRef.current) dispatch({ type: 'STREAM', event: { requestId: queued.requestId, kind: 'delta', text: queued.text } });
    discardPending();
  }, [discardPending]);

  useEffect(() => {
    settingsReadyRef.current = bridge.getSettings().then(next => { settingsRef.current = next; setSettings(next); return true; }).catch(() => false);
    return discardPending;
  }, [discardPending]);

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
    dispatch({ type: 'CAPTURE', capture, layout: layoutForText(capture.text) });
    if (capture.source === 'selection') start(capture);
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
          if (!pending.current.timer) pending.current.timer = window.setTimeout(flush, 32);
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
  }, [discardPending, flush, readyOnMount, receiveCapture]);

  const cancelAndDismiss = useCallback(() => { void bridge.dismiss().catch(() => setInitError('La fermeture a échoué. Réessayez.')); }, []);
  const completeDismiss = useCallback((captureId: string) => {
    if (closingRef.current !== captureId || captureRef.current?.id !== captureId) return;
    closingRef.current = null;
    captureRef.current = null;
    setClosingCaptureId(null);
    dispatch({ type: 'DISMISS' });
    void bridge.completeDismiss(captureId).catch(() => undefined);
  }, []);

  return { state, settings, dispatch, receiveCapture, start, cancelAndDismiss, completeDismiss, closingCaptureId, initError };
}

export type TranslationController = ReturnType<typeof useTranslation>;

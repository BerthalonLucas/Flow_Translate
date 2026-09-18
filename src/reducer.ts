import type { Capture, Mode, StreamEvent, ResultDelivery } from './types';

export type TranslationState = {
  capture: Capture | null;
  requestId: string | null;
  mode: Mode;
  result: string;
  phase: 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled';
  error: string | null;
  replacementValid: boolean;
  invalidated: boolean;
  comparing: boolean;
  delivery: null | 'pending' | 'applied' | 'fallback';
};

export const initialTranslationState: TranslationState = {
  capture: null, requestId: null, mode: 'quality', result: '',
  phase: 'idle', delivery: null, error: null, replacementValid: false, invalidated: false, comparing: false,
};

export type Action =
  | { type: 'CAPTURE'; capture: Capture }
  | { type: 'START'; requestId: string; mode: Mode }
  | { type: 'STREAM'; event: StreamEvent }
  | { type: 'TARGET'; captureId: string; canReplace: boolean }
  | { type: 'INVALIDATE'; message: string }
  | { type: 'DELIVERY'; event: ResultDelivery }
  | { type: 'CANCEL' }
  | { type: 'DISMISS' }
  | { type: 'TOGGLE_COMPARE' };

export function translationReducer(state: TranslationState, action: Action): TranslationState {
  switch (action.type) {
    case 'CAPTURE':
      return { ...state, capture: action.capture, requestId: null, result: '', error: null, comparing: false,
        replacementValid: false, invalidated: false, phase: 'idle', delivery: action.capture.execution?.outputMode === 'replace' && !action.capture.replay ? 'pending' : null };
    case 'START':
      return { ...state, requestId: action.requestId, mode: action.mode,
        result: '', error: null, phase: 'streaming', replacementValid: false, delivery: state.requestId ? null : state.delivery };
    case 'STREAM':
      if (action.event.requestId !== state.requestId) return state;
      if (action.event.kind === 'delta') return { ...state, result: state.result + (action.event.text ?? '') };
      // `done` may carry the cleaned final text (no thinking block, no fence): it replaces the deltas.
      if (action.event.kind === 'done') return { ...state, phase: 'complete', result: action.event.text ?? state.result, replacementValid: !state.invalidated && (state.capture?.canReplace ?? false) };
      return { ...state, phase: 'error', delivery: null, error: action.event.message ?? 'L’action n’a pas abouti. Réessayez.', replacementValid: false };
    case 'DELIVERY':
      if (action.event.requestId !== state.requestId) return state;
      return { ...state, delivery: action.event.status, replacementValid: action.event.status === 'applied' ? false : state.replacementValid };
    case 'TARGET':
      // The native target arrives behind the shown window; a stale capture id is ignored.
      if (action.captureId !== state.capture?.id) return state;
      return { ...state, capture: { ...state.capture, canReplace: action.canReplace },
        replacementValid: state.phase === 'complete' && !state.invalidated && state.delivery !== 'applied' && action.canReplace };
    case 'INVALIDATE':
      return { ...state, replacementValid: false, invalidated: true, error: action.message };
    case 'DISMISS': return { ...initialTranslationState };
    case 'CANCEL':
      return state.phase === 'streaming' ? { ...state, requestId: null, phase: 'cancelled', replacementValid: false } : state;
    case 'TOGGLE_COMPARE': return { ...state, comparing: !state.comparing };
    default: return state;
  }
}


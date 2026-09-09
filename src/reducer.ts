import type { Capture, Language, Mode, StreamEvent } from './types';

export type TranslationState = {
  capture: Capture | null;
  requestId: string | null;
  targetLanguage: Language;
  mode: Mode;
  result: string;
  phase: 'idle' | 'confirming' | 'streaming' | 'complete' | 'error' | 'cancelled';
  error: string | null;
  replacementValid: boolean;
  invalidated: boolean;
  enlarged: boolean;
  comparing: boolean;
};

export const initialTranslationState: TranslationState = {
  capture: null, requestId: null, targetLanguage: 'fr', mode: 'quality', result: '',
  phase: 'idle', error: null, replacementValid: false, invalidated: false, enlarged: false, comparing: false
};

export type Action =
  | { type: 'CAPTURE'; capture: Capture }
  | { type: 'START'; requestId: string; mode: Mode; targetLanguage: Language }
  | { type: 'STREAM'; event: StreamEvent }
  | { type: 'INVALIDATE'; message: string }
  | { type: 'CANCEL' }
  | { type: 'DISMISS' }
  | { type: 'TOGGLE_ENLARGE' }
  | { type: 'TOGGLE_COMPARE' };

export function translationReducer(state: TranslationState, action: Action): TranslationState {
  switch (action.type) {
    case 'CAPTURE':
      return { ...state, capture: action.capture, requestId: null, result: '', error: null, enlarged: false, comparing: false,
        replacementValid: false, invalidated: false, phase: action.capture.source === 'clipboard' ? 'confirming' : 'idle' };
    case 'START':
      return { ...state, requestId: action.requestId, mode: action.mode, targetLanguage: action.targetLanguage,
        result: '', error: null, phase: 'streaming', replacementValid: false };
    case 'STREAM':
      if (action.event.requestId !== state.requestId) return state;
      if (action.event.kind === 'delta') return { ...state, result: state.result + (action.event.text ?? '') };
      if (action.event.kind === 'done') return { ...state, phase: 'complete', replacementValid: !state.invalidated && (state.capture?.canReplace ?? false) };
      return { ...state, phase: 'error', error: action.event.message ?? 'La traduction n’a pas abouti.', replacementValid: false };
    case 'INVALIDATE':
      return { ...state, replacementValid: false, invalidated: true, error: action.message };
    case 'DISMISS': return { ...initialTranslationState };
    case 'CANCEL':
      return state.phase === 'streaming' ? { ...state, requestId: null, phase: 'cancelled', replacementValid: false } : state;
    case 'TOGGLE_ENLARGE': return { ...state, enlarged: !state.enlarged };
    case 'TOGGLE_COMPARE': return { ...state, comparing: !state.comparing };
    default: return state;
  }
}

import { describe, expect, it } from 'vitest';
import { initialTranslationState, translationReducer } from './reducer';
import type { Capture } from './types';

const selected: Capture = { id: 'c1', text: 'Hello', source: 'selection', canReplace: true, anchor: null };

describe('translationReducer', () => {
  it('demands confirmation for clipboard input', () => {
    const clipboard = { ...selected, source: 'clipboard' as const, canReplace: false };
    expect(translationReducer(initialTranslationState, { type: 'CAPTURE', capture: clipboard }).phase).toBe('idle');
  });
  it('keeps a menu capture waiting, then gives it the chosen execution once and waits for the paste', () => {
    const menu: Capture = { ...selected, menu: { lastActionId: null } };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: menu });
    expect(state).toMatchObject({ phase: 'idle', delivery: null, requestId: null });
    const execution = { actionId: 'correct', actionName: 'Fix grammar', outputMode: 'replace' as const, mode: 'quality' as const };
    expect(translationReducer(state, { type: 'CHOOSE', captureId: 'stale', execution })).toBe(state);
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: false });
    state = translationReducer(state, { type: 'CHOOSE', captureId: 'c1', execution });
    expect(state).toMatchObject({ delivery: 'pending', capture: { execution, canReplace: false, menu: { lastActionId: null } } });
    expect(translationReducer(state, { type: 'CHOOSE', captureId: 'c1', execution: { ...execution, actionId: 'translate' } })).toBe(state);
  });
  it('ignores events belonging to a stale request', () => {
    const active = translationReducer(translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected }), { type: 'START', requestId: 'new', mode: 'quality' });
    expect(translationReducer(active, { type: 'STREAM', event: { requestId: 'old', kind: 'done' } })).toEqual(active);
  });
  it('enables completed actions only after the done event', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'delta', text: 'Bonjour' } });
    expect(state.phase).toBe('streaming');
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.phase).toBe('complete');
    expect(state.replacementValid).toBe(true);
  });
  it('invalidates replacement without discarding an already rendered result', () => {
    const complete = { ...initialTranslationState, capture: selected, result: 'Bonjour', phase: 'complete' as const, replacementValid: true };
    const next = translationReducer(complete, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    expect(next).toMatchObject({ result: 'Bonjour', replacementValid: false });
  });
  it('ignores done events after cancellation', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'CANCEL' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.phase).toBe('cancelled');
    expect(state.requestId).toBeNull();
  });
  it('does not restore replacement after invalidation arrives during a stream', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state).toMatchObject({ phase: 'complete', replacementValid: false });
  });
  it('offers replacement only once the native target arrives, for the current capture', () => {
    const pending = { ...selected, canReplace: false };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: pending });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.replacementValid).toBe(false);
    expect(translationReducer(state, { type: 'TARGET', captureId: 'other', canReplace: true })).toEqual(state);
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: true });
    expect(state).toMatchObject({ replacementValid: true, capture: { canReplace: true } });
    const invalidated = translationReducer(state, { type: 'INVALIDATE', message: 'La sélection a changé.' });
    expect(translationReducer(invalidated, { type: 'TARGET', captureId: 'c1', canReplace: true }).replacementValid).toBe(false);
  });
  it('shows the final text of the done event in place of the deltas, and keeps them without it', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: selected });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'delta', text: '```\nBonjour\n```' } });
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'Bonjour' } }).result).toBe('Bonjour');
    expect(translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } }).result).toBe('```\nBonjour\n```');
  });
  it('a replace capture waits for its delivery, applied or fallback', () => {
    const replace = { ...selected, execution: { actionId: 'correct', actionName: 'Corriger', outputMode: 'replace' as const, mode: 'quality' as const } };
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: replace });
    expect(state.delivery).toBe('pending');
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done', text: 'Bonjour' } });
    expect(state.delivery).toBe('pending');
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'other', status: 'applied', confirmed: true, message: '' } }).delivery).toBe('pending');
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'applied', confirmed: true, message: '' } })).toMatchObject({ delivery: 'applied', replacementValid: false });
    expect(translationReducer(state, { type: 'DELIVERY', event: { requestId: 'r1', status: 'fallback', confirmed: false, message: 'x' } })).toMatchObject({ delivery: 'fallback', result: 'Bonjour' });
    // A relaunch with the other profile shows its result: no second delivery.
    expect(translationReducer(state, { type: 'START', requestId: 'r2', mode: 'fast' }).delivery).toBeNull();
  });
  it('keeps a target that arrives before the result for the done event', () => {
    let state = translationReducer(initialTranslationState, { type: 'CAPTURE', capture: { ...selected, canReplace: false } });
    state = translationReducer(state, { type: 'START', requestId: 'r1', mode: 'quality' });
    state = translationReducer(state, { type: 'TARGET', captureId: 'c1', canReplace: true });
    expect(state.replacementValid).toBe(false);
    state = translationReducer(state, { type: 'STREAM', event: { requestId: 'r1', kind: 'done' } });
    expect(state.replacementValid).toBe(true);
  });

});

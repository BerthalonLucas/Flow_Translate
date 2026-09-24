import { describe, expect, it } from 'vitest';
import { initialTranslationState, type TranslationState } from '../reducer';
import type { AfterReplace, Capture, ErrorCode, ExecutionInfo } from '../types';
import { effectiveAfterReplace, ilotJourney, ilotOutcome, ownPasteRefusal, pasteCode, type OwnPaste } from './outcome';

const execution: ExecutionInfo = { actionId: 'correct', actionName: 'Fix grammar', outputMode: 'replace', mode: 'fast' };
const capture: Capture = { id: 'c', text: 'x', source: 'selection', canReplace: true, anchor: null, menu: { lastActionId: null }, execution };
const state = (patch: Partial<TranslationState> = {}): TranslationState => ({ ...initialTranslationState, capture, requestId: 'r1', phase: 'streaming', delivery: 'pending', ...patch });
const outcome = (patch: Partial<TranslationState> = {}, paste: OwnPaste | null = null, chosen = false, undone = false) => ilotOutcome(state(patch), { chosen, paste, undone });

describe('the Îlot journey', () => {
  it('is a menu capture under uiVersion ilot, nothing else', () => {
    expect(ilotJourney({ uiVersion: 'ilot' }, { menu: { lastActionId: null } })).toBe(true);
    expect(ilotJourney({ uiVersion: 'v4' }, { menu: { lastActionId: null } })).toBe(false);
    expect(ilotJourney({ uiVersion: 'ilot' }, {})).toBe(false);
    expect(ilotJourney(null, { menu: { lastActionId: null } })).toBe(false);
  });
});

describe('ilotOutcome', () => {
  it('shows the menu until a choice, then works while the model runs and Rust pastes', () => {
    expect(outcome({ capture: { ...capture, execution: undefined }, phase: 'idle', requestId: null, delivery: null })).toEqual({ stage: 'menu' });
    // The choice is on its way: already the pill.
    expect(outcome({ capture: { ...capture, execution: undefined }, phase: 'idle', requestId: null, delivery: null }, null, true)).toEqual({ stage: 'working' });
    expect(outcome()).toEqual({ stage: 'working' });
    expect(outcome({ phase: 'complete', delivery: 'pending' })).toEqual({ stage: 'working' });
  });

  it('checks once Rust pasted, and says Undone after an Undo', () => {
    expect(outcome({ phase: 'complete', delivery: 'applied' })).toEqual({ stage: 'done' });
    expect(outcome({ phase: 'complete', delivery: 'applied' }, null, false, true)).toEqual({ stage: 'undone' });
  });

  it('turns a stream error into its code, an unknown or missing one into internal, a cancel into leaving', () => {
    expect(outcome({ phase: 'error', delivery: null, code: 'unauthorized' })).toEqual({ stage: 'error', code: 'unauthorized' });
    expect(outcome({ phase: 'error', delivery: null, code: null })).toEqual({ stage: 'error', code: 'internal' });
    expect(outcome({ phase: 'error', delivery: null, code: 'cancelled' })).toEqual({ stage: 'leave' });
    expect(outcome({ phase: 'cancelled', delivery: 'pending' })).toEqual({ stage: 'leave' });
  });

  it('reads a delivery fallback as a paste failure whatever its code: the result exists, Copy it', () => {
    for (const [code, expected] of [['target_changed', 'target_changed'], ['not_editable', 'not_editable'], ['keys_held', 'keys_held'], ['paste_blocked', 'paste_blocked'], [null, 'paste_blocked'], ['busy', 'paste_blocked'], ['internal', 'paste_blocked']] as Array<[ErrorCode | null, ErrorCode]>) {
      expect(outcome({ phase: 'complete', delivery: 'fallback', code }), String(code)).toEqual({ stage: 'error', code: expected });
    }
    expect(pasteCode(undefined)).toBe('paste_blocked');
  });

  it('pastes a retried result itself: working until replace_result answers, then the check or Copy result', () => {
    // A retry: Rust delivers a capture's first request only (delivery null for the second).
    const retried = { requestId: 'r2', phase: 'complete', delivery: null } as const;
    expect(outcome(retried)).toEqual({ stage: 'working' });
    // A paste of an older request does not count.
    expect(outcome(retried, { requestId: 'r1', status: 'applied' })).toEqual({ stage: 'working' });
    expect(outcome(retried, { requestId: 'r2', status: 'pending' })).toEqual({ stage: 'working' });
    expect(outcome(retried, { requestId: 'r2', status: 'applied' })).toEqual({ stage: 'done' });
    expect(outcome(retried, { requestId: 'r2', status: 'refused' })).toEqual({ stage: 'error', code: 'paste_blocked' });
    expect(outcome({ ...retried, invalidated: true }, { requestId: 'r2', status: 'refused' })).toEqual({ stage: 'error', code: 'target_changed' });
  });

  it('never tries that paste over a selection the watcher dropped, nor on a capture that cannot be written', () => {
    const retried = { requestId: 'r2', phase: 'complete', delivery: null } as const;
    expect(ownPasteRefusal(state(retried))).toBeNull();
    expect(ownPasteRefusal(state({ ...retried, invalidated: true }))).toBe('target_changed');
    expect(ownPasteRefusal(state({ ...retried, capture: { ...capture, canReplace: false } }))).toBe('not_editable');
    expect(outcome({ ...retried, invalidated: true })).toEqual({ stage: 'error', code: 'target_changed' });
    expect(outcome({ ...retried, capture: { ...capture, canReplace: false } })).toEqual({ stage: 'error', code: 'not_editable' });
  });
});

describe('effectiveAfterReplace', () => {
  const after: AfterReplace = { check: true, undo: true, undoSeconds: 8, changedWords: true };
  it('keeps Undo only once the native side offers it', () => {
    expect(effectiveAfterReplace(after, false)).toEqual({ ...after, undo: false });
    expect(effectiveAfterReplace(after, true)).toEqual(after);
    expect(effectiveAfterReplace({ ...after, check: false }, false)).toEqual({ ...after, check: false, undo: false });
    // Settings without the section: the defaults (check on).
    expect(effectiveAfterReplace(undefined, false)).toMatchObject({ check: true, undo: false });
  });
});

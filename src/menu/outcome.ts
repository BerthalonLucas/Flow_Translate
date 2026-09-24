import type { TranslationState } from '../reducer';
import { errorCodeOf, errorFamily } from '../result/errors';
import type { AfterReplace, Capture, ErrorCode, Settings } from '../types';

/*
 * What the Îlot's surface shows once an action was chosen (lots 9 and 10 wired into lot 7). Pure:
 * src/menu/IlotStage.tsx derives it from the translation state on every render.
 *
 *   menu     no choice yet.
 *   working  the model works, or Rust is pasting (delivery pending), or the frontend's own paste
 *            of a retried result is on its way.
 *   done     pasted: the check (and Undo once the native side offers it).
 *   undone   Undo went through (lot 9, native side still to come).
 *   error    a failure with its code: a stream error, a delivery fallback (always a paste code:
 *            the result exists and was not pasted), or the refusal of the frontend's own paste.
 *   leave    nothing to show: the user cancelled (silent family); the surface just leaves.
 *
 * A retry (Try again) is a second request of the same capture: Rust only delivers a capture's
 * first request (actions.rs Execution::begin), so the Îlot pastes a retried result itself with
 * `replace_result`, which revalidates the target after bringing the source back (BRIDGE, Îlot).
 */

// The Îlot's journey: a menu capture under uiVersion 'ilot'. The whole of it, from the menu to the
// check or the error pill, lives on the Îlot's surface; the glass never opens for it.
export function ilotJourney(settings: Pick<Settings, 'uiVersion'> | null | undefined, capture: Pick<Capture, 'menu'> | null | undefined): boolean {
  return settings?.uiVersion === 'ilot' && Boolean(capture?.menu);
}

// The frontend's own paste of a retried result.
export type OwnPaste = { requestId: string; status: 'pending' | 'applied' | 'refused' };

export type IlotOutcome =
  | { stage: 'menu' }
  | { stage: 'working' }
  | { stage: 'done' }
  | { stage: 'undone' }
  | { stage: 'error'; code: ErrorCode }
  | { stage: 'leave' };

// A result that exists but was not pasted always reads as a paste failure (Copy result): a code
// of another family there (or none) would offer to translate again, which could paste twice.
export const pasteCode = (code: ErrorCode | null | undefined): ErrorCode => code && errorFamily(code) === 'paste' ? code : 'paste_blocked';

type State = Pick<TranslationState, 'phase' | 'delivery' | 'code' | 'requestId' | 'invalidated'> & { capture: Pick<Capture, 'canReplace' | 'execution'> | null };

// Why the frontend's own paste cannot even be tried: the watcher dropped the selection, or the
// capture never had one that could be written. null: try it (Rust revalidates anyway).
export function ownPasteRefusal(state: State): ErrorCode | null {
  if (state.invalidated) return 'target_changed';
  if (!state.capture?.canReplace) return 'not_editable';
  return null;
}

export function ilotOutcome(state: State, { chosen, paste, undone = false }: { chosen: boolean; paste: OwnPaste | null; undone?: boolean }): IlotOutcome {
  if (!chosen && !state.capture?.execution) return { stage: 'menu' };
  const pasted = { stage: undone ? 'undone' : 'done' } as const;
  switch (state.phase) {
    case 'error': {
      const code = errorCodeOf(state.code);
      return errorFamily(code) === 'silent' ? { stage: 'leave' } : { stage: 'error', code };
    }
    case 'cancelled': return { stage: 'leave' };
    case 'complete':
      if (state.delivery === 'applied') return pasted;
      if (state.delivery === 'fallback') return { stage: 'error', code: pasteCode(state.code) };
      if (state.delivery === 'pending') return { stage: 'working' };
      // A retried result: the frontend pastes it itself.
      if (paste?.requestId !== state.requestId) {
        const refusal = ownPasteRefusal(state);
        return refusal ? { stage: 'error', code: refusal } : { stage: 'working' };
      }
      if (paste.status === 'applied') return pasted;
      if (paste.status === 'refused') return { stage: 'error', code: state.invalidated ? 'target_changed' : 'paste_blocked' };
      return { stage: 'working' };
    default: return { stage: 'working' };
  }
}

// Lot 9: Undo exists only once the native side offers it (bridge.undoResult); until then the
// check stays alone, 1.1 s (design-lab/src/Simulator.jsx:155).
export function effectiveAfterReplace(after: AfterReplace | undefined, undoAvailable: boolean): AfterReplace {
  const base = after ?? { check: true, undo: true, undoSeconds: 8, changedWords: true };
  return undoAvailable ? base : { ...base, undo: false };
}

import type { MessageKey } from '../i18n';
import { errorCodes, type ErrorCode, type Mode, type ProfileField, type SettingsField } from '../types';

/*
 * The errors of lot 10 on the front (docs/DA-PLAN.md lot 10, UI-DECISIONS 23/09): for each code
 * Rust sends (`ErrorCode`, the one list in src/types.ts), its family, its one button and the
 * Settings field it opens.
 *
 * Families (the lab's `kind`, design-lab/src/data.js:63-73):
 *   config     the user can fix it: the button opens the exact field of the Settings
 *              (lot 13 identifiers, `quality|fast.endpoint|apiKey|model`, or the bare field for
 *              the default profile: src/settings/fields.ts resolveField).
 *   transient  out of the user's hands: Try again.
 *   paste      the result exists but was not pasted (paste refused, the selection changed, a
 *              read-only field, keys held): nothing was replaced, Copy result.
 *   content    nothing to retry as is (the lab's « Selection too long »): no button, ✕ only.
 *   silent     nothing to show (the user cancelled): the pill just leaves.
 * Short texts (at most six words) are the lab's where it has one (OUTCOMES short and action);
 * they never carry the server's answer, a key or any text of the user.
 *
 * API
 *   errorCodeOf(value)          a code from the bridge; anything unknown is 'internal'.
 *   describeError(code, { mode, model, source, cause })  → { family, message, params, action, actionLabel }:
 *                               the i18n keys to show and the one action of its button.
 *                               source 'capture': a capture Rust refused (`capture-notice`):
 *                               nothing was read, no result exists, so no button at all, and
 *                               the capture's own words where the request's would mislead
 *                               (`cause`, from noticeCause; target_changed: nothing was tried).
 *   noticeCause(code, message)  which of the situations sharing a notice's code Rust meant.
 *   refusedPasteCode(reason)    the paste code of a `replace_result` refusal (a French string).
 *   ErrorAction                 { type: 'settings', field } | { type: 'retry' } | { type: 'copy' }.
 *
 * Rust's words. Two failures still reach the front without a code of their own: a notice's code
 * is shared by several situations (no_selection: nothing selected, the Settings in front, the
 * tray's « Revoir » with nothing recent; docs/BRIDGE.md « Capture »), and `replace_result`
 * rejects with a French string (the 0.4 contract). Until Rust gives each its own code, the front
 * reads the situation from a fragment of those words, only to choose its own text: they are never
 * shown nor logged. errors.test.ts checks each fragment is still in src-tauri, so a rewording on
 * the native side fails the tests instead of silently falling back to the generic text.
 */

export type ErrorFamily = 'config' | 'transient' | 'paste' | 'content' | 'silent';
export type ErrorAction = { type: 'settings'; field: SettingsField } | { type: 'retry' } | { type: 'copy' };
// Where it failed: a request (translation, paste) or the capture itself.
export type ErrorSource = 'request' | 'capture';

type Entry = { family: ErrorFamily; field?: ProfileField };
// Why each code sits in its family:
//   unreachable      nothing answers at the address: config (the lab's « endpoint » outcome).
//   bad_endpoint     an answer, but no API there (404 outside the model): config, the address.
//   unauthorized     401/403: config, the key (the lab's « key »).
//   model_not_found  404 naming the model: config, the model (the lab's « model »).
//   timeout, busy (429/503), server_error (other statuses, 5xx), stream_broken: transient.
//   length           the answer was cut by the token limit: never pasted, transient (Try again,
//                    perhaps on less text); a partial result is never offered for copy.
//   internal         anything unexpected on our side, and any code this front does not know.
//   paste_blocked, target_changed, not_editable, keys_held: the paste did not happen: paste.
//   too_long, no_selection, protected_field: nothing was read or sent: content, ✕ only.
//   cancelled        the user's own Escape: silent.
const table: Record<ErrorCode, Entry> = {
  unreachable: { family: 'config', field: 'endpoint' },
  bad_endpoint: { family: 'config', field: 'endpoint' },
  unauthorized: { family: 'config', field: 'apiKey' },
  model_not_found: { family: 'config', field: 'model' },
  timeout: { family: 'transient' },
  busy: { family: 'transient' },
  server_error: { family: 'transient' },
  stream_broken: { family: 'transient' },
  length: { family: 'transient' },
  internal: { family: 'transient' },
  paste_blocked: { family: 'paste' },
  target_changed: { family: 'paste' },
  not_editable: { family: 'paste' },
  keys_held: { family: 'paste' },
  too_long: { family: 'content' },
  no_selection: { family: 'content' },
  protected_field: { family: 'content' },
  cancelled: { family: 'silent' },
};

export function errorCodeOf(value: unknown): ErrorCode {
  return (errorCodes as readonly unknown[]).includes(value) ? value as ErrorCode : 'internal';
}
export const errorFamily = (code: ErrorCode): ErrorFamily => table[code].family;

// The button's label per action (the lab's OUTCOMES action, data.js:66-71).
const fieldLabel: Record<ProfileField, MessageKey> = { endpoint: 'result.action.endpoint', apiKey: 'result.action.apiKey', model: 'result.action.model' };

export type ErrorDescription = {
  code: ErrorCode;
  family: ErrorFamily;
  message: MessageKey;
  params?: Record<string, string>;
  action: ErrorAction | null;
  actionLabel: MessageKey | null;
};

// The situations a capture's code does not tell apart (Rust's `no_selection` also means these).
export type NoticeCause = 'settings_open' | 'nothing_recent';
// Where Rust says them (src-tauri/src/lib.rs): « Fermez les réglages avant d’utiliser un
// raccourci. » (a shortcut pressed while the Settings window is in front) and « Aucune traduction
// récente. » (the tray's « Revoir la dernière traduction » with nothing within ten minutes).
export const noticeWords: ReadonlyArray<{ code: ErrorCode; words: string; cause: NoticeCause }> = [
  { code: 'no_selection', words: 'Fermez les réglages', cause: 'settings_open' },
  { code: 'no_selection', words: 'Aucune traduction récente', cause: 'nothing_recent' },
];
export function noticeCause(code: ErrorCode, message: string | undefined): NoticeCause | null {
  return noticeWords.find(entry => entry.code === code && message?.includes(entry.words))?.cause ?? null;
}
// What a capture says in its own words (source 'capture'): target_changed there is the source
// window changing during the capture (capture.rs), before anything was pasted.
const captureMessage: Partial<Record<ErrorCode, MessageKey>> = { target_changed: 'result.notice.target_changed' };
const causeMessage: Record<NoticeCause, MessageKey> = { settings_open: 'result.notice.settings_open', nothing_recent: 'result.notice.nothing_recent' };

// `replace_result` rejects with Rust's French string (lib.rs replace_result, capture.rs paste and
// validate_target): the target moved (« La fenêtre source a changé; remplacement refusé. », the
// same for the active field, the target, the selection; « La sélection n’est plus disponible;
// utilisez Copier. »), the shortcut's keys are still held, or the field cannot be written.
// Anything else (the paste blocked, the source not brought back, the clipboard taken meanwhile,
// an interrupted command) is paste_blocked.
export const refusalWords: ReadonlyArray<{ words: string; code: ErrorCode }> = [
  { words: 'a changé; remplacement refusé', code: 'target_changed' },
  { words: 'plus disponible; utilisez Copier', code: 'target_changed' },
  { words: 'Relâchez les touches', code: 'keys_held' },
  { words: 'pas modifiable', code: 'not_editable' },
];
export function refusedPasteCode(reason: unknown): ErrorCode {
  const text = typeof reason === 'string' ? reason : '';
  return refusalWords.find(entry => text.includes(entry.words))?.code ?? 'paste_blocked';
}

// mode: the profile the failed request used (its field then opens, else the default
// profile's). model: the model's name from the settings, for « Model not found: … » (the lab's
// wording); never anything from the server's answer. cause: see noticeCause (capture only).
export function describeError(code: ErrorCode, { mode, model, source = 'request', cause }: { mode?: Mode; model?: string; source?: ErrorSource; cause?: NoticeCause | null } = {}): ErrorDescription {
  const { family, field } = table[code];
  const named = code === 'model_not_found' && model?.trim();
  const message = (named ? 'result.error.model_not_found_named' : `result.error.${code}`) as MessageKey;
  const params = named ? { model: model!.trim() } : undefined;
  const none = { code, family, message, params, action: null, actionLabel: null };
  if (source === 'capture') return { ...none, message: (cause && causeMessage[cause]) ?? captureMessage[code] ?? message };
  if (family === 'config' && field) return { ...none, action: { type: 'settings', field: mode ? `${mode}.${field}` : field }, actionLabel: fieldLabel[field] };
  if (family === 'transient') return { ...none, action: { type: 'retry' }, actionLabel: 'common.retry' };
  if (family === 'paste') return { ...none, action: { type: 'copy' }, actionLabel: 'result.action.copy' };
  return none;
}

import type { MessageKey } from '../i18n';
import type { Mode, ProfileField, SettingsField } from '../types';

/*
 * The errors of lot 10 on the front (docs/DA-PLAN.md lot 10, UI-DECISIONS 23/09): a code, its
 * family, its one button and the Settings field it opens. Rust does not send these codes yet
 * (lot 10, native side); until it does, nothing produces them outside the lab.
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
 *   errorKinds, ErrorKind       the codes Rust will send.
 *   errorKindOf(value)          a code from the bridge; anything unknown is 'internal'.
 *   describeError(kind, { mode, model })  → { family, message, params, action, actionLabel }:
 *                               the i18n keys to show and the one action of its button.
 *   ErrorAction                 { type: 'settings', field } | { type: 'retry' } | { type: 'copy' }.
 */

export const errorKinds = [
  // Server and model (lot 10 list).
  'unreachable', 'timeout', 'unauthorized', 'model_not_found', 'bad_endpoint', 'busy', 'length', 'stream_broken',
  // Paste and capture (lot 10 list).
  'paste_blocked', 'target_changed', 'not_editable', 'too_long', 'cancelled',
  // Found by the audit of the plan: sources no code above covers.
  'server_error', 'no_selection', 'protected_field', 'keys_held', 'internal',
] as const;
export type ErrorKind = typeof errorKinds[number];
export type ErrorFamily = 'config' | 'transient' | 'paste' | 'content' | 'silent';
export type ErrorAction = { type: 'settings'; field: SettingsField } | { type: 'retry' } | { type: 'copy' };

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
const table: Record<ErrorKind, Entry> = {
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

export function errorKindOf(value: unknown): ErrorKind {
  return (errorKinds as readonly unknown[]).includes(value) ? value as ErrorKind : 'internal';
}
export const errorFamily = (kind: ErrorKind): ErrorFamily => table[kind].family;

// The button's label per action (the lab's OUTCOMES action, data.js:66-71).
const fieldLabel: Record<ProfileField, MessageKey> = { endpoint: 'result.action.endpoint', apiKey: 'result.action.apiKey', model: 'result.action.model' };

export type ErrorDescription = {
  kind: ErrorKind;
  family: ErrorFamily;
  message: MessageKey;
  params?: Record<string, string>;
  action: ErrorAction | null;
  actionLabel: MessageKey | null;
};

// mode: the profile the failed request used (its field then opens, else the default
// profile's). model: the model's name from the settings, for « Model not found: … » (the lab's
// wording); never anything from the server's answer.
export function describeError(kind: ErrorKind, { mode, model }: { mode?: Mode; model?: string } = {}): ErrorDescription {
  const { family, field } = table[kind];
  const named = kind === 'model_not_found' && model?.trim();
  const message = (named ? 'result.error.model_not_found_named' : `result.error.${kind}`) as MessageKey;
  const params = named ? { model: model!.trim() } : undefined;
  if (family === 'config' && field) return { kind, family, message, params, action: { type: 'settings', field: mode ? `${mode}.${field}` : field }, actionLabel: fieldLabel[field] };
  if (family === 'transient') return { kind, family, message, params, action: { type: 'retry' }, actionLabel: 'common.retry' };
  if (family === 'paste') return { kind, family, message, params, action: { type: 'copy' }, actionLabel: 'result.action.copy' };
  return { kind, family, message, params, action: null, actionLabel: null };
}

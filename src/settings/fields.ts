import type { Mode, ProfileField, SettingsField } from '../types';

// Direct links to one field of the Settings window (lot 13, for the configuration errors of
// lot 10), after the lab's MockSettings (design-lab/src/Simulator.jsx): scroll to the field,
// focus it, and make it pulse for 2.8 s (two pulses of 1.4 s); in reduced motion the scroll
// jumps and the highlight holds still for the same time. Every field that can be targeted
// carries data-field with one of these stable identifiers.
export type FieldId = 'menuShortcut' | `${Mode}.${ProfileField}`;
export const highlightMs = 2800;
const modes: readonly Mode[] = ['quality', 'fast'];
const profileFields: readonly ProfileField[] = ['endpoint', 'apiKey', 'model'];

// A bare profile field (what lot 10 sends for an error of the running request) means the
// default profile's; anything unknown is ignored.
export function resolveField(field: string | null | undefined, defaultMode: Mode): FieldId | null {
  if (!field) return null;
  if (field === 'menuShortcut') return field;
  if ((profileFields as readonly string[]).includes(field)) return `${defaultMode}.${field as ProfileField}`;
  const [mode, name, extra] = field.split('.');
  if (extra === undefined && (modes as readonly string[]).includes(mode) && (profileFields as readonly string[]).includes(name)) return `${mode as Mode}.${name as ProfileField}`;
  return null;
}
export const isProfileField = (id: FieldId): id is `${Mode}.${ProfileField}` => id !== 'menuShortcut';
// The field asked for when the window opened (`?window=settings&field=…`).
export const fieldFromLocation = (search: string): SettingsField | null => new URLSearchParams(search).get('field') as SettingsField | null;

const focusable = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';
// Scrolls to the field, focuses its control and restarts its highlight; returns a function
// that removes the highlight at once, or null when the field is not rendered.
export function revealField(root: ParentNode, id: FieldId, reduced: boolean): (() => void) | null {
  const element = root.querySelector<HTMLElement>(`[data-field="${id}"]`);
  if (!element) return null;
  element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  const control = element.matches(focusable) ? element : element.querySelector<HTMLElement>(focusable);
  control?.focus({ preventScroll: true });
  // Asked again while it still pulses: start over.
  delete element.dataset.target;
  void element.offsetWidth;
  element.dataset.target = 'true';
  const timer = window.setTimeout(() => { delete element.dataset.target; }, highlightMs);
  return () => { window.clearTimeout(timer); delete element.dataset.target; };
}

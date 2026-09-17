import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import * as Switch from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import {
  BriefcaseBusiness, Check, ChevronDown, CircleAlert, CircleCheck, ClipboardPaste, Copy, Ellipsis,
  Eye, EyeOff, History, Info, Keyboard, Languages, LoaderCircle, Pin, PinOff, Plus, Power,
  RefreshCw, RotateCcw, Server, Settings2, ShieldCheck, SpellCheck, Trash2, TriangleAlert, Type,
  Wand, X,
} from 'lucide-react';

// The settings window owns its primitives: `src/ui.tsx` belongs to the glass and still carries the
// 0.4.0 icon names. Nothing here is imported by the overlay.
export const motionTokens = { enter: 0.18, feedback: 0.14, exit: 0.1, ease: [0.2, 0, 0, 1] as const };
export function useFade(kind: 'surface' | 'feedback' = 'surface') {
  const reduced = useReducedMotion();
  return {
    initial: { opacity: reduced ? 1 : 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: reduced ? 0 : motionTokens.exit } },
    transition: { duration: reduced ? 0 : kind === 'feedback' ? motionTokens.feedback : motionTokens.enter, ease: motionTokens.ease },
  };
}

// The 30 names of the design system, copied from `docs/design-system/components/index.d.ts`.
const icons = {
  'copy': Copy, 'check': Check, 'ellipsis': Ellipsis, 'x': X, 'pin': Pin, 'pin-off': PinOff,
  'loader-circle': LoaderCircle, 'eye': Eye, 'eye-off': EyeOff, 'clipboard-paste': ClipboardPaste,
  'rotate-ccw': RotateCcw, 'refresh-cw': RefreshCw, 'settings-2': Settings2, 'info': Info,
  'triangle-alert': TriangleAlert, 'circle-alert': CircleAlert, 'circle-check': CircleCheck,
  'languages': Languages, 'spell-check': SpellCheck, 'briefcase-business': BriefcaseBusiness,
  'wand': Wand, 'plus': Plus, 'trash-2': Trash2, 'chevron-down': ChevronDown, 'keyboard': Keyboard,
  'server': Server, 'shield-check': ShieldCheck, 'type': Type, 'power': Power, 'history': History,
} as const;
export type IconName = keyof typeof icons;
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" className={className} size={size} strokeWidth={name === 'loader-circle' ? 2.25 : 1.75} />;
}
// An action's pictogram comes from its id: the four presets, `wand` for everything else.
export function actionIcon(id: string): IconName {
  if (id.startsWith('translate-')) return 'languages';
  if (id === 'correct') return 'spell-check';
  if (id === 'professionalize') return 'briefcase-business';
  return 'wand';
}

type ButtonProps = ComponentPropsWithoutRef<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: IconName };
export function Button({ variant = 'ghost', size = 'md', icon, className = '', children, ...props }: ButtonProps) {
  return <button type="button" className={`settings-button ${className}`} data-variant={variant} data-size={size} {...props}>
    {icon && <Icon name={icon} size={size === 'sm' ? 13 : 16} />}{children}
  </button>;
}

type IconButtonProps = ComponentPropsWithoutRef<'button'> & { label: string; children: ReactNode; variant?: 'ghost' | 'danger' };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, variant = 'ghost', className = '', ...props }, ref) {
  return <button ref={ref} type="button" className={`icon-button ${className}`} data-variant={variant} aria-label={label} title={label} {...props}>{children}</button>;
});

// Windows 11 switch: a 40 × 20 track, an outline when off, the signal when on.
export function SettingSwitch({ label, checked, onCheckedChange, disabled }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }) {
  return <Switch.Root className="setting-switch" checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-label={label}>
    <Switch.Thumb className="switch-thumb" />
  </Switch.Root>;
}

// Two to four short options, saved on click. Constant weight so nothing jumps.
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; size?: 'md' | 'sm';
}) {
  return <ToggleGroup.Root type="single" className="segmented" data-size={size} aria-label={label} value={value} onValueChange={next => { if (next) onChange(next as T); }}>
    {options.map(option => <ToggleGroup.Item key={option.value} value={option.value}>{option.label}</ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'danger'; children: ReactNode }) {
  return <div className="callout" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>
    <Icon name={tone === 'danger' ? 'triangle-alert' : 'info'} size={16} />
    <div>{children}</div>
  </div>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'signal'; children: ReactNode }) {
  return <span className="badge" data-tone={tone}>{children}</span>;
}

export type ConnectionState = 'unknown' | 'checking' | 'ok' | 'error';
export function StatusBadge({ state, text }: { state: ConnectionState; text: string }) {
  const tone = state === 'ok' ? 'success' : state === 'error' ? 'danger' : state === 'checking' ? 'checking' : 'neutral';
  return <span className="status-badge" data-tone={tone} role="status">
    {state === 'checking' ? <Icon name="loader-circle" size={12} className="spin" /> : <span className="status-dot" aria-hidden="true" />}
    {text}
  </span>;
}

type FieldProps = { label: string; hint?: string; error?: string; count?: string; children: ReactNode };
export function Field({ label, hint, error, count, children }: FieldProps) {
  return <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {(hint || error || count) && <span className="field-foot">
      {error ? <span className="field-error"><Icon name="triangle-alert" size={13} />{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
      {count && <span className="field-count">{count}</span>}
    </span>}
  </label>;
}

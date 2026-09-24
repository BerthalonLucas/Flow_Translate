import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Switch from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { BriefcaseBusiness, Check, ChevronDown, Clipboard, Copy, Cpu, Ellipsis, FoldVertical, KeyRound, Languages, LoaderCircle, Mail, Pin, PinOff, Server, Settings2, SpellCheck, TriangleAlert, Undo2, WandSparkles, X } from 'lucide-react';
import { useT } from './i18n';

// Animate paint, never the dimensions/scale that the native ResizeObserver measures.
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
// Opacity plus a few pixels of travel. `y` is dropped under reduced motion.
export function useRise(y: number, kind: 'surface' | 'feedback' = 'surface', delay = 0) {
  const reduced = useReducedMotion();
  return {
    initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: reduced ? 0 : motionTokens.exit } },
    transition: { duration: reduced ? 0 : kind === 'feedback' ? motionTokens.feedback : motionTokens.enter, delay: reduced ? 0 : delay, ease: motionTokens.ease },
  };
}

// Lucide, thin stroke (docs/DA-PLAN.md, lot 1): one stroke of 1.5 and a size of 14 to 16 px
// everywhere; no CSS forces a size over the prop. The plan's twelve names come first.
const icons = {
  fix: SpellCheck, translate: Languages, professional: BriefcaseBusiness, shorten: FoldVertical, email: Mail, custom: WandSparkles,
  undo: Undo2, settings: Settings2, error: TriangleAlert, key: KeyRound, server: Server, model: Cpu,
  copy: Copy, more: Ellipsis, close: X, clipboard: Clipboard, check: Check, chevron: ChevronDown, pin: Pin, unpin: PinOff, languages: Languages, spinner: LoaderCircle,
};
export type IconName = keyof typeof icons;
export const iconStroke = 1.5;
export function Icon({ name, size = 15 }: { name: IconName; size?: 14 | 15 | 16 }) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" size={size} strokeWidth={iconStroke} />;
}

export function AnimatedIcon({ name }: { name: IconName }) {
  const fade = useFade('feedback');
  return <span className="action-glyph" aria-hidden="true"><AnimatePresence initial={false}>
    <motion.span key={name} {...fade}><Icon name={name} /></motion.span>
  </AnimatePresence></span>;
}

type IconButtonProps = ComponentPropsWithoutRef<'button'> & { label: string; children: ReactNode };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, className = '', ...props }, ref) {
  return <button ref={ref} type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
});

export type BubbleMenuAction = { label: string; run: () => void; disabled?: boolean; close?: boolean };
export function BubbleMenu({ open, onOpenChange, actions, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; actions: BubbleMenuAction[]; children: ReactNode;
}) {
  const rise = useRise(-4, 'feedback');
  const t = useT();
  return <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
    {children}
    <AnimatePresence>
      {open && <DropdownMenu.Content forceMount asChild loop>
        <motion.div {...rise} className="more-menu" aria-label={t('glass.menu')}>
          {actions.map(action => <span key={action.label} className="menu-slot">
            {action.close && <DropdownMenu.Separator className="menu-separator" />}
            <DropdownMenu.Item className={`menu-item ${action.close ? 'menu-close' : ''}`} disabled={action.disabled} onSelect={action.run}>
              <span>{action.label}</span>{action.close && <Icon name="close" size={14} />}
            </DropdownMenu.Item>
          </span>)}
        </motion.div>
      </DropdownMenu.Content>}
    </AnimatePresence>
  </DropdownMenu.Root>;
}

export function BubbleMenuTrigger({ onClick, pressed }: { onClick: () => void; pressed: boolean }) {
  // Opening on pointerdown resizes/reanchors the native window before pointerup.
  // Keep Radix keyboard semantics, but let a pointer click finish before opening.
  const t = useT();
  return <DropdownMenu.Trigger asChild onPointerDown={event => event.preventDefault()} onClick={onClick}><IconButton label={t('glass.more')} data-pressed={pressed || undefined}><Icon name="more" /></IconButton></DropdownMenu.Trigger>;
}

export function SettingSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const reduced = useReducedMotion();
  return <Switch.Root className="setting-switch" checked={checked} onCheckedChange={onCheckedChange} aria-label={label}>
    <Switch.Thumb asChild><motion.span className="switch-thumb" initial={false} animate={{ x: checked ? 18 : 0 }} transition={{ duration: reduced ? 0 : motionTokens.feedback, ease: motionTokens.ease }} /></Switch.Thumb>
  </Switch.Root>;
}

// Two-way choice rendered as a segmented control on top of Radix ToggleGroup.
export function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void;
}) {
  return <ToggleGroup.Root type="single" className="segmented" aria-label={label} value={value} onValueChange={next => { if (next) onChange(next as T); }}>
    {options.map(option => <ToggleGroup.Item key={option.value} value={option.value}>{option.label}</ToggleGroup.Item>)}
  </ToggleGroup.Root>;
}

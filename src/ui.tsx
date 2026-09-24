import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Switch from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Check, ChevronDown, Clipboard, Copy, Ellipsis, Languages, LoaderCircle, Pin, PinOff, X } from 'lucide-react';
import { useContentPresence, useStateTransition, useSurfacePresence } from './motion/MotionPreferences';
import type { Grow } from './motion/presence';

// Motion follows the « Îlot » tokens (src/motion/tokens.ts, the chosen preset) and the setting
// « Animations » through MotionConfig (src/motion/MotionPreferences.tsx). Paint only: the
// dimensions Rust measures never animate here.

const icons = { copy: Copy, more: Ellipsis, close: X, clipboard: Clipboard, check: Check, chevron: ChevronDown, pin: Pin, unpin: PinOff, languages: Languages, spinner: LoaderCircle };
export type IconName = keyof typeof icons;
export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" size={size} strokeWidth={name === 'check' ? 1.9 : name === 'spinner' ? 2.4 : 1.7} />;
}

export function AnimatedIcon({ name }: { name: IconName }) {
  const fade = useContentPresence();
  return <span className="action-glyph" aria-hidden="true"><AnimatePresence initial={false}>
    <motion.span key={name} {...fade}><Icon name={name} /></motion.span>
  </AnimatePresence></span>;
}

type IconButtonProps = ComponentPropsWithoutRef<'button'> & { label: string; children: ReactNode };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, className = '', ...props }, ref) {
  return <button ref={ref} type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
});

export type BubbleMenuAction = { label: string; run: () => void; disabled?: boolean; close?: boolean };
export function BubbleMenu({ open, onOpenChange, actions, grow = 'down', children }: {
  open: boolean; onOpenChange: (open: boolean) => void; actions: BubbleMenuAction[]; grow?: Grow; children: ReactNode;
}) {
  const rise = useSurfacePresence(grow);
  return <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
    {children}
    <AnimatePresence>
      {open && <DropdownMenu.Content forceMount asChild loop>
        <motion.div {...rise} className="more-menu" aria-label="Options de traduction">
          {actions.map(action => <span key={action.label} className="menu-slot">
            {action.close && <DropdownMenu.Separator className="menu-separator" />}
            <DropdownMenu.Item className={`menu-item ${action.close ? 'menu-close' : ''}`} disabled={action.disabled} onSelect={action.run}>
              <span>{action.label}</span>{action.close && <Icon name="close" size={13} />}
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
  return <DropdownMenu.Trigger asChild onPointerDown={event => event.preventDefault()} onClick={onClick}><IconButton label="Plus d’options" data-pressed={pressed || undefined}><Icon name="more" /></IconButton></DropdownMenu.Trigger>;
}

export function SettingSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  const transition = useStateTransition();
  return <Switch.Root className="setting-switch" checked={checked} onCheckedChange={onCheckedChange} aria-label={label}>
    <Switch.Thumb asChild><motion.span className="switch-thumb" initial={false} animate={{ x: checked ? 18 : 0 }} transition={transition} /></Switch.Thumb>
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

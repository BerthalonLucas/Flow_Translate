import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Switch from '@radix-ui/react-switch';
import { Check, ChevronDown, Clipboard, Copy, Ellipsis, X } from 'lucide-react';

// Animate paint, never the dimensions/scale that the native ResizeObserver measures.
export const motionTokens = { enter: 0.18, feedback: 0.14, exit: 0.1, ease: [0.2, 0, 0, 1] as const };
export function useFade() {
  const reduced = useReducedMotion();
  return {
    initial: { opacity: reduced ? 1 : 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: reduced ? 0 : motionTokens.exit } },
    transition: { duration: reduced ? 0 : motionTokens.enter, ease: motionTokens.ease },
  };
}

const icons = { copy: Copy, more: Ellipsis, close: X, clipboard: Clipboard, check: Check, chevron: ChevronDown };
export function Icon({ name }: { name: keyof typeof icons }) {
  const Glyph = icons[name];
  return <Glyph aria-hidden="true" size={17} strokeWidth={1.65} />;
}

type IconButtonProps = ComponentPropsWithoutRef<'button'> & { label: string; children: ReactNode };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, children, className = '', ...props }, ref) {
  return <button ref={ref} type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
});

export type BubbleMenuAction = { label: string; run: () => void; disabled?: boolean; close?: boolean };
export function BubbleMenu({ open, onOpenChange, actions, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; actions: BubbleMenuAction[]; children: ReactNode;
}) {
  const fade = useFade();
  return <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
    {children}
    <AnimatePresence>
      {open && <DropdownMenu.Content forceMount asChild loop>
        <motion.div {...fade} className="more-menu" aria-label="Options de traduction">
          {actions.map(action => <DropdownMenu.Item key={action.label} className={`menu-item ${action.close ? 'menu-close' : ''}`} disabled={action.disabled} onSelect={action.run}>
            <span>{action.label}</span>{action.close && <Icon name="close" />}
          </DropdownMenu.Item>)}
        </motion.div>
      </DropdownMenu.Content>}
    </AnimatePresence>
  </DropdownMenu.Root>;
}

export function BubbleMenuTrigger({ onClick }: { onClick: () => void }) {
  // Opening on pointerdown resizes/reanchors the native window before pointerup.
  // Keep Radix keyboard semantics, but let a pointer click finish before opening.
  return <DropdownMenu.Trigger asChild onPointerDown={event => event.preventDefault()} onClick={onClick}><IconButton label="Plus d’options"><Icon name="more" /></IconButton></DropdownMenu.Trigger>;
}

export function SettingSwitch({ label, checked, onCheckedChange, detail }: {
  label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; detail?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return <label className="switch-row">
    <Switch.Root className="setting-switch" checked={checked} onCheckedChange={onCheckedChange} aria-label={label}>
      <Switch.Thumb asChild><motion.span className="switch-thumb" initial={false} animate={{ x: checked ? 14 : 0 }} transition={{ duration: reduced ? 0 : motionTokens.feedback, ease: motionTokens.ease }} /></Switch.Thumb>
    </Switch.Root>
    <span>{label}</span>{detail && <small>{detail}</small>}
  </label>;
}

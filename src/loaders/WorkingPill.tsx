import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { useT } from '../i18n';
import { useSurfacePresence } from '../motion/MotionPreferences';
import type { Grow } from '../motion/presence';
import type { Indicator } from '../types';
import { Icon } from '../ui';
import { IndicatorView } from './indicators';
import { indicatorBox, ORB_DELAY_MS, workingPillShape } from './pill';
import './loaders.css';

// Whether the page is hidden (a hidden overlay, a minimised window): the loops then rest.
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}
const pageHidden = () => document.visibilityState === 'hidden';
export function usePageHidden(): boolean {
  return useSyncExternalStore(subscribeVisibility, pageHidden, () => false);
}

// The pill of lot 8 (docs/DA-PLAN.md): a glass pill of 44 × 28 (52 × 28 for the Ruban), radius
// 14, that holds the chosen indicator while the model works. Nothing textual; the pill never
// grows: the slot reserves the indicator's box from the start, and the orb only shows after
// 250 ms, so a faster answer shows the empty pill alone, without a flash. The content sits on a
// layer centred in the pill (plan §4.3, glass.css .shape-layer): the later lots can spring the
// pill's own width, height and radius (src/motion/surface.ts) from the Îlot menu, or swap its
// content for the check, Undo or an error, without moving or scaling the content.
// The loops run only while the pill is mounted; they rest under reduced motion (loaders.css) and
// while the page is hidden.
// `done`: the result was pasted (0.4 replace mode); the check stands in for the orb until lot 9
// draws its own.
export function WorkingPill({ indicator, done = false, grow = 'up', delayMs = ORB_DELAY_MS }: {
  indicator: Indicator; done?: boolean; grow?: Grow; delayMs?: number;
}) {
  const t = useT();
  const enter = useSurfacePresence(grow);
  const hidden = usePageHidden();
  const [orb, setOrb] = useState(delayMs <= 0);
  useEffect(() => {
    if (orb) return;
    const timer = window.setTimeout(() => setOrb(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [orb, delayMs]);
  const shape = workingPillShape(indicator);
  const box = indicatorBox[indicator];
  const style = { width: shape.width, height: shape.height, borderRadius: shape.borderRadius, '--working-pill-width': `${shape.width}px` } as CSSProperties;
  return <motion.span {...enter} className="working-pill" role="img" aria-label={t(done ? 'glass.replaced' : 'pill.working')} style={style}
    data-indicator={indicator} data-orb={orb && !done ? 'shown' : 'waiting'} data-done={done || undefined} data-paused={hidden || undefined}>
    <span className="shape-clip"><span className="shape-layer working-layer">
      {done ? <Icon name="check" size={16} />
        : <span className="working-slot" style={{ width: box.width, height: box.height }}>{orb && <span className="working-orb"><IndicatorView indicator={indicator} /></span>}</span>}
    </span></span>
  </motion.span>;
}

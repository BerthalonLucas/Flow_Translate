import type { Presentation } from './types';

export const glass = { contextualWidth: 280, readerWidth: 560, radius: 26, pillWidth: 60, pillHeight: 28, pillInset: 18, overlap: 14 };
export type TextLayout = { presentation: Presentation; bodyHeight: number };

// Use the actual system font and wrapping before the first streamed response.
// This ephemeral, invisible node contains no network or persistent data.
export function textHeight(text: string, presentation: Presentation) {
  const probe = document.createElement('div');
  const width = presentation === 'reader' ? 510 : 242;
  Object.assign(probe.style, {
    position: 'fixed', visibility: 'hidden', pointerEvents: 'none', left: '-10000px',
    width: `${width}px`, fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    fontSize: '15px', lineHeight: presentation === 'reader' ? '22px' : '21px',
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', letterSpacing: '-.01em',
  });
  probe.textContent = text || '…';
  document.body.append(probe);
  const height = Math.ceil(probe.getBoundingClientRect().height);
  probe.remove();
  return height;
}

export function layoutForText(text: string, previous: Presentation = 'contextual'): TextLayout {
  const presentation = previous === 'reader' || textHeight(text, 'contextual') > 84 ? 'reader' : 'contextual';
  const height = textHeight(text, presentation);
  return { presentation, bodyHeight: presentation === 'reader' ? Math.min(280, Math.max(112, height + 46)) : Math.min(118, Math.max(55, height + 34)) };
}

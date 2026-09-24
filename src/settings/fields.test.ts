import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldFromLocation, highlightMs, resolveField, revealField } from './fields';

describe('direct links to a Settings field', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

  it('resolves the stable identifiers; a bare profile field is the default profile’s', () => {
    expect(resolveField('menuShortcut', 'quality')).toBe('menuShortcut');
    expect(resolveField('endpoint', 'quality')).toBe('quality.endpoint');
    expect(resolveField('apiKey', 'fast')).toBe('fast.apiKey');
    expect(resolveField('fast.model', 'quality')).toBe('fast.model');
    for (const unknown of ['', null, 'model.fast', 'slow.model', 'quality.model.x', 'history', 'quality.']) expect(resolveField(unknown, 'quality')).toBeNull();
    expect(fieldFromLocation('?window=settings&field=quality.apiKey')).toBe('quality.apiKey');
    expect(fieldFromLocation('?window=settings')).toBeNull();
  });

  it('scrolls to the field, focuses its control and highlights it for 2.8 s; smooth only with full motion', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<label data-field="fast.model">Model<input id="model"></label><label data-field="fast.endpoint">Address<input></label>';
    const field = document.querySelector<HTMLElement>('[data-field="fast.model"]')!;
    const scroll = vi.fn();
    field.scrollIntoView = scroll;
    const clear = revealField(document, 'fast.model', false);
    expect(clear).toBeTypeOf('function');
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(document.activeElement?.id).toBe('model');
    expect(field.dataset.target).toBe('true');
    vi.advanceTimersByTime(highlightMs - 1);
    expect(field.dataset.target).toBe('true');
    vi.advanceTimersByTime(1);
    expect(field.dataset.target).toBeUndefined();
    revealField(document, 'fast.model', true);
    expect(scroll).toHaveBeenLastCalledWith({ block: 'center', behavior: 'auto' });
    expect(highlightMs).toBe(2800);
    expect(revealField(document, 'quality.model', false)).toBeNull();
  });
});

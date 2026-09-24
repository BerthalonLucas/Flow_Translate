import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { iconFromLucide } from '../ui';
import { cleanInstruction, Ilot, type IlotHandle, type IlotProps } from './Ilot';
import type { IlotAction } from './keys';

const actions: IlotAction[] = [
  { id: 'fix', name: 'Fix grammar', shortName: 'Fix', key: 'F', icon: 'SpellCheck' },
  { id: 'translate', name: 'Translate', key: 'T', icon: 'Languages' },
  { id: 'pro', name: 'Make professional', shortName: 'Pro', key: 'P', icon: 'NotAnIcon' },
];

let root: Root | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = host = undefined;
});

async function mount(props: Partial<IlotProps> = {}) {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const handle = createRef<IlotHandle>();
  const calls = { onChoose: vi.fn(), onInstruction: vi.fn(), onClose: vi.fn() };
  const render = async (next: Partial<IlotProps> = {}) => act(async () => root!.render(<Ilot ref={handle} actions={actions} lastActionId="translate" {...calls} {...props} {...next} />));
  await render();
  const press = async (key: string) => { let used = false; await act(async () => { used = handle.current!.press(key); }); return used; };
  const keydown = async (key: string, init: KeyboardEventInit = {}) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })); });
  const mode = () => host!.querySelector('[data-ilot]')?.getAttribute('data-mode');
  const present = () => host!.querySelector('.shape-layer:not(.is-leaving)')!;
  return { calls, press, keydown, mode, present, render };
}

describe('iconFromLucide', () => {
  it('finds the registry entry drawn with a Lucide glyph, none for an unknown name', () => {
    expect(['SpellCheck', 'Languages', 'BriefcaseBusiness', 'FoldVertical', 'Mail', 'WandSparkles', 'Undo2', 'Settings2', 'TriangleAlert', 'KeyRound', 'Server', 'Cpu'].map(iconFromLucide))
      .toEqual(['fix', 'translate', 'professional', 'shorten', 'email', 'custom', 'undo', 'settings', 'error', 'key', 'server', 'model']);
    expect(iconFromLucide('NotAnIcon')).toBeUndefined();
    expect(iconFromLucide(undefined)).toBeUndefined();
  });
});

describe('cleanInstruction', () => {
  it('sends no NUL, no surrounding blanks and at most 1000 characters', () => {
    expect(cleanInstruction('  plus\0 court \n')).toBe('plus court');
    expect([...cleanInstruction('é'.repeat(1200))]).toHaveLength(1000);
    expect(cleanInstruction(' \0 ')).toBe('');
  });
});

describe('Ilot', () => {
  it('shows the last action and the pastille, then the tiles in the given order', async () => {
    const { press, mode, present } = await mount();
    expect(mode()).toBe('compact');
    expect(present().querySelector('[data-item="last"]')!.textContent).toBe('Translate↵');
    expect(present().querySelector('[data-item="last"]')).toBe(document.activeElement);
    expect(await press('Tab')).toBe(true);
    expect(mode()).toBe('grid');
    const tiles = [...present().querySelectorAll('[role="menuitem"]')];
    expect(tiles.map(tile => tile.getAttribute('data-tile'))).toEqual(['fix', 'translate', 'pro', 'ask']);
    expect(tiles.map(tile => tile.textContent)).toEqual(['Fix', 'Translate', 'Pro', 'Ask']);
    // An icon outside the registry is left out, the tile keeps its label.
    expect(tiles.map(tile => tile.querySelectorAll('svg').length)).toEqual([1, 1, 0, 1]);
    expect(tiles[1]).toBe(document.activeElement);
  });

  it('answers the window keys while it has the keyboard, and leaves Ctrl combinations', async () => {
    const { calls, keydown, mode } = await mount();
    await keydown('p', { ctrlKey: true });
    expect(calls.onChoose).not.toHaveBeenCalled();
    await keydown('p');
    expect(calls.onChoose).toHaveBeenCalledWith('pro');
    await keydown('x');
    expect(mode()).toBe('prompt');
    const input = document.activeElement as HTMLInputElement;
    expect(input.value).toBe('x');
    await keydown('Escape');
    expect(mode()).toBe('prompt');
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    expect(mode()).toBe('compact');
    await keydown('Escape');
    expect(calls.onClose).toHaveBeenCalledTimes(1);
  });

  it('takes only the keys it is given when Rust forwards them, without a field', async () => {
    const { calls, press, keydown, mode, present } = await mount({ keyboard: 'injected' });
    expect(document.activeElement).toBe(document.body);
    await keydown('t');
    expect(calls.onChoose).not.toHaveBeenCalled();
    expect(present().querySelector('[data-item="ask"]')!.getAttribute('aria-disabled')).toBe('true');
    expect(await press(' ')).toBe(true);
    expect(await press('x')).toBe(false);
    expect(mode()).toBe('compact');
    expect(await press('ArrowDown')).toBe(true);
    expect(await press('Enter')).toBe(true);
    expect(calls.onChoose).toHaveBeenCalledWith('translate');
  });

  it('becomes the pill on the same surface, ignores the menu keys there, and starts over compact', async () => {
    const { press, mode, render } = await mount({ initialMode: 'grid' });
    const surface = host!.querySelector('[data-ilot-shape]');
    await render({ shape: 'pill', pill: <span data-testid="orb" /> });
    expect(host!.querySelector('[data-ilot]')!.getAttribute('data-shape')).toBe('pill');
    expect(host!.querySelector('.shape-layer:not(.is-leaving) [data-testid="orb"]')).not.toBeNull();
    expect(host!.querySelector('[data-ilot-shape]')).toBe(surface);
    expect(await press('f')).toBe(false);
    await render({ shape: 'menu' });
    expect(mode()).toBe('compact');
    expect(host!.querySelector('[data-ilot-shape]')).toBe(surface);
  });
});

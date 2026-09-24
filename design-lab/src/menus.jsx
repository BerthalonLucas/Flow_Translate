import React, { useEffect, useRef, useState } from 'react';
import { ACTIONS, ACTION_BY_ID, label, UI } from './data.js';
import { Icon } from './Surface.jsx';

// Shared contract. Every menu receives:
//   lang, iconSet, showIcons, showKeys, defaultId, onRun(actionId, { prompt, mods }), onClose, preview
// and handles its own keys while mounted (window capture), unless `preview` (gallery).

const LETTERS = Object.fromEntries(ACTIONS.filter(a => a.key.length === 1 && /[A-Z]/.test(a.key)).map(a => [a.key.toLowerCase(), a.id]));

function fromFieldOutsideSurface(e) {
  const t = e.target;
  return t instanceof HTMLElement && t.matches('input, textarea, select') && !t.closest('[data-surface]');
}
function useMenuKeys(preview, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (preview) return;
    const on = e => {
      if (fromFieldOutsideSurface(e) || e.ctrlKey || e.metaKey || (e.altKey && e.key !== 'AltGraph')) return;
      if (ref.current(e) === true) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [preview]);
}
const printable = e => e.key.length === 1 && !e.ctrlKey && !e.metaKey;

function AIcon({ a, p, size = 14 }) { return p.showIcons ? <Icon name={a.icon} set={p.iconSet} size={size} /> : null; }
function Key({ k, p }) { return p.showKeys ? <span className="k">{k}</span> : null; }

function PromptField({ p, initial = '', onSubmit, onCancel, width = 230 }) {
  const [v, setV] = useState(initial);
  const input = useRef(null);
  useEffect(() => { if (!p.preview) { input.current?.focus(); const n = input.current?.value.length ?? 0; input.current?.setSelectionRange(n, n); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="m-ghost" style={{ height: 34 }}>
    <span className="ai-dot" />
    <input ref={input} className="m-input" style={{ width }} value={v} placeholder={UI[p.lang].describe} onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { e.preventDefault(); onSubmit(v.trim()); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); } }} readOnly={p.preview} tabIndex={p.preview ? -1 : 0} />
    <span className="keycap">↵</span>
  </div>;
}

// Common key map: letters (F/T/P/S/E), digits 1–6, Space or / for the prompt, Enter = default.
function commonKey(e, p, { onPrompt, enter }) {
  if (e.key === 'Escape') { p.onClose(); return true; }
  if (e.key === 'Enter') { enter ? enter() : p.onRun(p.defaultId); return true; }
  if (e.key === ' ' || e.key === '/') { onPrompt(''); return true; }
  const k = e.key.toLowerCase();
  if (LETTERS[k]) { p.onRun(LETTERS[k]); return true; }
  if (/^[1-6]$/.test(e.key)) { const a = ACTIONS[+e.key - 1]; a.id === 'custom' ? onPrompt('') : p.onRun(a.id); return true; }
  if (printable(e)) { onPrompt(e.key); return true; }
  return false;
}

// 1 ——— Îlot: last action + ✦ ; grows into a 3×2 grid; typing turns it into a prompt.
export function Ilot(p) {
  const [mode, setMode] = useState(p.initialMode || 'compact');
  const [hot, setHot] = useState(Math.max(0, ACTIONS.findIndex(a => a.id === p.defaultId)));
  const [seed, setSeed] = useState('');
  const hover = useRef(0);
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  const prompt = s => { setSeed(s); setMode('prompt'); };
  useMenuKeys(p.preview, e => {
    if (mode === 'prompt') return false;
    if (mode === 'compact' && (e.key === 'Tab' || e.key === 'ArrowDown')) { setMode('grid'); return true; }
    if (mode === 'grid') {
      if (e.key === 'Escape') { setMode('compact'); return true; }
      const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3, Tab: 1 }[e.key];
      if (move) { setHot(h => (h + move + 6) % 6); return true; }
      if (e.key === 'Enter') { const a = ACTIONS[hot]; a.id === 'custom' ? prompt('') : p.onRun(a.id); return true; }
    }
    return commonKey(e, p, { onPrompt: prompt });
  });
  if (mode === 'prompt') return <PromptField p={p} initial={seed} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setMode('compact')} />;
  if (mode === 'grid') return <div className="m-grid" onMouseLeave={() => !p.preview && null}>
    {ACTIONS.map((a, i) => <button key={a.id} className={`m-tile ${i === hot ? 'is-hot' : ''}`} onMouseEnter={() => setHot(i)} onClick={() => a.id === 'custom' ? prompt('') : p.onRun(a.id)}>
      <AIcon a={a} p={p} size={16} /><span>{label(a, p.lang, true)}</span></button>)}
  </div>;
  return <div className="m-row" onMouseEnter={() => { clearTimeout(hover.current); hover.current = setTimeout(() => !p.preview && setMode('grid'), 450); }} onMouseLeave={() => clearTimeout(hover.current)}>
    <button className="m-btn is-default" onClick={() => p.onRun(d.id)}><AIcon a={d} p={p} />{label(d, p.lang, true)}<Key k="↵" p={p} /></button>
    <span className="m-sep" />
    <button className="m-btn" aria-label={UI[p.lang].describe} onClick={() => prompt('')}><span className="ai-dot" /></button>
  </div>;
}

// 2 ——— Éventail: one pill that opens sideways into a strip.
export function Eventail(p) {
  const [open, setOpen] = useState(!!p.initialMode);
  const [hot, setHot] = useState(Math.max(0, ACTIONS.findIndex(a => a.id === p.defaultId)));
  const [prompting, setPrompting] = useState(null);
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  const timer = useRef(0);
  useMenuKeys(p.preview, e => {
    if (prompting !== null) return false;
    if (!open && (e.key === 'ArrowRight' || e.key === 'Tab')) { setOpen(true); return true; }
    if (open) {
      if (e.key === 'Escape') { setOpen(false); return true; }
      if (e.key === 'ArrowRight' || e.key === 'Tab') { setHot(h => (h + 1) % 6); return true; }
      if (e.key === 'ArrowLeft') { setHot(h => (h + 5) % 6); return true; }
      if (e.key === 'Enter') { const a = ACTIONS[hot]; a.id === 'custom' ? setPrompting('') : p.onRun(a.id); return true; }
    }
    return commonKey(e, p, { onPrompt: s => setPrompting(s) });
  });
  if (prompting !== null) return <PromptField p={p} initial={prompting} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setPrompting(null)} />;
  if (!open) return <div className="m-row">
    <button className="m-btn is-default" onClick={() => p.onRun(d.id)}><AIcon a={d} p={p} />{label(d, p.lang, true)}<Key k="↵" p={p} /></button>
    <button className="m-btn" style={{ padding: '0 6px' }} aria-label={UI[p.lang].more} onMouseEnter={() => { timer.current = setTimeout(() => setOpen(true), 280); }} onMouseLeave={() => clearTimeout(timer.current)} onClick={() => setOpen(true)}>›</button>
  </div>;
  return <div className="m-row">
    {ACTIONS.map((a, i) => <React.Fragment key={a.id}>
      {i > 0 && <span className="m-sep" style={{ margin: 0, opacity: .6 }} />}
      <button className={`m-btn ${i === hot ? 'is-hot' : ''} ${a.id === d.id ? 'is-default' : ''}`} onMouseEnter={() => setHot(i)} onClick={() => a.id === 'custom' ? setPrompting('') : p.onRun(a.id)}>
        {a.id === 'custom' ? <span className="ai-dot" /> : <AIcon a={a} p={p} size={13} />}{a.id === 'custom' ? '' : label(a, p.lang, true)}
      </button>
    </React.Fragment>)}
  </div>;
}

// 3 ——— Invite: the menu is a field; typing filters actions or becomes a free prompt.
const SYN = { fix: ['fix', 'correct', 'corriger', 'grammar', 'ortho'], translate: ['tr', 'translate', 'traduire', 'english', 'français', 'anglais'], pro: ['pro', 'formal', 'formel', 'professional', 'professionnel'], shorten: ['short', 'court', 'raccourcir', 'shorten', 'concise'], email: ['mail', 'email', 'courriel', 'rédiger'] };
export function Invite(p) {
  const [v, setV] = useState('');
  const [hot, setHot] = useState(0);
  const input = useRef(null);
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  useEffect(() => { if (!p.preview) input.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const q = v.trim().toLowerCase();
  const matches = q ? ACTIONS.filter(a => a.id !== 'custom' && (label(a, p.lang).toLowerCase().includes(q) || (SYN[a.id] || []).some(s => s.startsWith(q) || q.startsWith(s)))) : [];
  const first = matches[0];
  const suggestion = first && label(first, p.lang).toLowerCase().startsWith(q) ? label(first, p.lang).slice(q.length) : '';
  const submit = () => {
    if (!q) return p.onRun(d.id);
    const pick = matches[hot] || null;
    if (pick && (label(pick, p.lang).toLowerCase().startsWith(q) || (SYN[pick.id] || []).includes(q))) return p.onRun(pick.id);
    p.onRun('custom', { prompt: v.trim() });
  };
  return <div>
    <div className="m-ghost">
      <span className="ai-dot" />
      <input ref={input} className="m-input" style={{ width: 262 }} value={v} readOnly={p.preview} tabIndex={p.preview ? -1 : 0} placeholder={`${label(d, p.lang)} ↵  ·  ${UI[p.lang].orType}`} onChange={e => { setV(e.target.value); setHot(0); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); v ? setV('') : p.onClose(); }
          else if (e.key === 'Tab' && suggestion) { e.preventDefault(); setV(v + suggestion); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setHot(h => Math.min(h + 1, Math.max(0, matches.length - 1))); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHot(h => Math.max(0, h - 1)); }
          else if (!v && /^[1-6]$/.test(e.key)) { e.preventDefault(); const a = ACTIONS[+e.key - 1]; if (a.id !== 'custom') p.onRun(a.id); }
        }} />
      {suggestion && <span className="sugg"><span style={{ visibility: 'hidden' }}>{v}</span>{suggestion}</span>}
    </div>
    {matches.length > 0 && <div className="m-chipline">
      {matches.slice(0, 3).map((a, i) => <button key={a.id} className={`m-chip ${i === hot ? 'is-hot' : ''}`} onClick={() => p.onRun(a.id)}><AIcon a={a} p={p} size={12} />{label(a, p.lang, true)}</button>)}
      <span className="m-chip" style={{ opacity: .6, cursor: 'default' }}>↵ {q && !matches.some(a => label(a, p.lang).toLowerCase().startsWith(q)) ? UI[p.lang].describe.replace('…', '') : ''}</span>
    </div>}
  </div>;
}

// 4 ——— Boussole: a disc; four directions are fixed actions, the centre is the default.
const DIRS = [{ k: 'ArrowUp', id: 'translate', x: 50, y: 14 }, { k: 'ArrowRight', id: 'pro', x: 86, y: 50 }, { k: 'ArrowDown', id: 'shorten', x: 50, y: 86 }, { k: 'ArrowLeft', id: 'email', x: 14, y: 50 }];
export function Boussole(p) {
  const [open, setOpen] = useState(!!p.initialMode);
  const [hot, setHot] = useState(null);
  const [prompting, setPrompting] = useState(null);
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  useMenuKeys(p.preview, e => {
    if (prompting !== null) return false;
    const dir = DIRS.find(x => x.k === e.key);
    if (dir) { if (open && hot === dir.id) p.onRun(dir.id); else { setOpen(true); setHot(dir.id); } return true; }
    if (e.key === 'Enter') { p.onRun(hot || d.id); return true; }
    return commonKey(e, p, { onPrompt: s => setPrompting(s) });
  });
  if (prompting !== null) return <PromptField p={p} initial={prompting} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setPrompting(null)} />;
  if (!open) return <div className="compass-mini" onMouseEnter={() => !p.preview && setOpen(true)}>
    {DIRS.map((x, i) => <span key={x.k} className="tick" style={{ transform: `rotate(${i * 90}deg) translateY(-17px)` }} />)}
    <button className="m-btn is-default" style={{ padding: '0 6px', height: 22, fontSize: 11.5 }} onClick={() => p.onRun(d.id)}>{label(d, p.lang, true)}</button>
  </div>;
  return <div className="compass">
    {DIRS.map(x => { const a = ACTION_BY_ID[x.id]; return <button key={x.k} className={`petal ${hot === x.id ? 'is-hot' : ''}`} style={{ left: `${x.x}%`, top: `${x.y}%` }} onMouseEnter={() => setHot(x.id)} onClick={() => p.onRun(x.id)}>
      <AIcon a={a} p={p} size={14} /><span>{label(a, p.lang, true)}</span></button>; })}
    <button className="core" onClick={() => p.onRun(d.id)}>{label(d, p.lang, true)}</button>
  </div>;
}

// 5 ——— Molette: one action at a time; ←/→ or the wheel turns it.
export function Molette(p) {
  const start = Math.max(0, ACTIONS.findIndex(a => a.id === p.defaultId));
  const [i, setI] = useState(start);
  const [prompting, setPrompting] = useState(null);
  const turn = n => setI(v => (v + n + ACTIONS.length) % ACTIONS.length);
  const runAt = idx => ACTIONS[idx].id === 'custom' ? setPrompting('') : p.onRun(ACTIONS[idx].id);
  useMenuKeys(p.preview, e => {
    if (prompting !== null) return false;
    if (e.key === 'ArrowRight' || e.key === 'Tab') { turn(1); return true; }
    if (e.key === 'ArrowLeft') { turn(-1); return true; }
    if (e.key === 'Enter') { runAt(i); return true; }
    return commonKey(e, p, { onPrompt: s => setPrompting(s) });
  });
  if (prompting !== null) return <PromptField p={p} initial={prompting} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setPrompting(null)} />;
  return <div className="dial" onWheel={e => { if (!p.preview) turn(e.deltaY > 0 ? 1 : -1); }}>
    <button className="m-btn" style={{ padding: '0 5px' }} onClick={() => turn(-1)} aria-label="previous">‹</button>
    <div className="dial-track">
      {ACTIONS.map((a, k) => { let off = k - i; if (off > 3) off -= 6; if (off < -3) off += 6; return <button key={a.id} className="it m-btn" style={{ transform: `translateX(${off * 84}px)`, opacity: off === 0 ? 1 : Math.abs(off) === 1 ? .35 : 0, fontWeight: off === 0 ? 560 : 400 }} onClick={() => off === 0 ? runAt(k) : setI(k)}>
        {off === 0 && <AIcon a={a} p={p} size={13} />}{a.id === 'custom' ? label(a, p.lang, true) : label(a, p.lang, true)}</button>; })}
    </div>
    <button className="m-btn" style={{ padding: '0 5px' }} onClick={() => turn(1)} aria-label="next">›</button>
  </div>;
}

// 6 ——— Touches: nothing but a dot; letters act at once; hints show only if you hesitate.
export function Touches(p) {
  const [hint, setHint] = useState(!!p.initialMode);
  const [prompting, setPrompting] = useState(null);
  useEffect(() => { if (p.preview) return; const t = setTimeout(() => setHint(true), p.hintDelay ?? 300); return () => clearTimeout(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useMenuKeys(p.preview, e => prompting === null && commonKey(e, p, { onPrompt: s => setPrompting(s) }));
  if (prompting !== null) return <PromptField p={p} initial={prompting} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setPrompting(null)} />;
  if (!hint) return <div style={{ width: 22, height: 22, display: 'grid', placeItems: 'center' }}><span className="ai-dot" /></div>;
  return <div className="m-row" style={{ gap: 4, padding: '3px 6px' }}>
    {ACTIONS.map(a => <button key={a.id} className={`m-btn ${a.id === p.defaultId ? 'is-default' : ''}`} style={{ padding: '0 6px', gap: 5 }} onClick={() => a.id === 'custom' ? setPrompting('') : p.onRun(a.id)}>
      <span className="keycap">{a.key}</span>{label(a, p.lang, true)}</button>)}
  </div>;
}

// 7 ——— Tonalité: a 3×3 pad (casual ↔ formal, shorter ↔ longer) plus Translate and a prompt.
const PAD = { '0,0': 'custom', '1,0': 'shorten', '2,0': 'shorten', '0,1': 'custom', '1,1': 'fix', '2,1': 'pro', '0,2': 'email', '1,2': 'email', '2,2': 'pro' };
const PAD_LABEL = { en: { '0,0': 'Casual & short', '1,0': 'Shorter', '2,0': 'Crisp', '0,1': 'Friendly', '1,1': 'Just fix', '2,1': 'Professional', '0,2': 'Warm email', '1,2': 'Longer', '2,2': 'Formal email' }, fr: { '0,0': 'Familier et court', '1,0': 'Plus court', '2,0': 'Net', '0,1': 'Amical', '1,1': 'Corriger', '2,1': 'Professionnel', '0,2': 'Mail chaleureux', '1,2': 'Plus long', '2,2': 'Mail formel' } };
export function Tonalite(p) {
  const [open, setOpen] = useState(!!p.initialMode);
  const [c, setC] = useState([1, 1]);
  const [prompting, setPrompting] = useState(null);
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  const apply = cell => { const id = PAD[cell.join(',')]; p.onRun(id, { mods: [id === 'custom' ? 'casual' : id] }); };
  useMenuKeys(p.preview, e => {
    if (prompting !== null) return false;
    if (!open && (e.key === 'Tab' || e.key.startsWith('Arrow'))) { setOpen(true); return true; }
    if (open) {
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (mv) { setC(([x, y]) => [Math.max(0, Math.min(2, x + mv[0])), Math.max(0, Math.min(2, y + mv[1]))]); return true; }
      if (e.key === 'Enter') { apply(c); return true; }
      if (e.key === 'Escape') { setOpen(false); return true; }
    }
    return commonKey(e, p, { onPrompt: s => setPrompting(s) });
  });
  if (prompting !== null) return <PromptField p={p} initial={prompting} onSubmit={v => p.onRun('custom', { prompt: v })} onCancel={() => setPrompting(null)} />;
  if (!open) return <div className="m-row">
    <button className="m-btn is-default" onClick={() => p.onRun(d.id)}><AIcon a={d} p={p} />{label(d, p.lang, true)}<Key k="↵" p={p} /></button>
    <span className="m-sep" />
    <button className="m-btn" onClick={() => setOpen(true)}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" /><circle cx="6" cy="6" r="1.6" fill="currentColor" /></svg>{p.lang === 'fr' ? 'Ton' : 'Tone'}</button>
  </div>;
  const cellLabel = PAD_LABEL[p.lang][c.join(',')];
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
    <div className="pad" onPointerDown={e => {
      if (p.preview) return;
      const r = e.currentTarget.getBoundingClientRect();
      const cell = [Math.max(0, Math.min(2, Math.floor((e.clientX - r.left) / r.width * 3))), Math.max(0, Math.min(2, Math.floor((e.clientY - r.top) / r.height * 3)))];
      setC(cell);
    }} onDoubleClick={() => apply(c)}>
      <span className="axis" style={{ left: 6, top: '50%', transform: 'translateY(-50%)' }}>{UI[p.lang].casual}</span>
      <span className="axis" style={{ right: 6, top: '50%', transform: 'translateY(-50%)' }}>{UI[p.lang].formal}</span>
      <span className="axis" style={{ top: 4, left: '50%', transform: 'translateX(-50%)' }}>{UI[p.lang].short}</span>
      <span className="axis" style={{ bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>{UI[p.lang].long}</span>
      <span className="puck" style={{ left: `${(c[0] + .5) / 3 * 100}%`, top: `${(c[1] + .5) / 3 * 100}%` }} />
    </div>
    <div className="m-row" style={{ justifyContent: 'space-between', padding: '0 6px 6px' }}>
      <button className="m-btn is-default" onClick={() => apply(c)}>{cellLabel}<Key k="↵" p={p} /></button>
      <span style={{ display: 'flex', gap: 2 }}>
        <button className="m-chip" onClick={() => p.onRun('translate')}>FR⇄EN</button>
        <button className="m-chip" onClick={() => setPrompting('')}><span className="ai-dot" style={{ width: 6, height: 6 }} /></button>
      </span>
    </div>
  </div>;
}

// 9 ——— Recette: a verb plus modifier chips, run together.
const MODS = [{ id: 'pro', key: 'P', en: 'pro', fr: 'pro' }, { id: 'short', key: 'S', en: 'short', fr: 'court' }, { id: 'casual', key: 'C', en: 'friendly', fr: 'amical' }, { id: 'translate', key: 'T', en: '→ EN/FR', fr: '→ EN/FR' }, { id: 'email', key: 'E', en: 'as email', fr: 'en mail' }];
export function Recette(p) {
  const [mods, setMods] = useState([]);
  const [more, setMore] = useState(!!p.initialMode);
  const [free, setFree] = useState(null);
  const toggle = id => setMods(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]);
  const run = () => p.onRun('fix', { mods });
  useMenuKeys(p.preview, e => {
    if (free !== null) return false;
    if (e.key === 'Escape') { if (mods.length) setMods([]); else p.onClose(); return true; }
    if (e.key === 'Enter') { run(); return true; }
    if (e.key === 'Backspace') { setMods(m => m.slice(0, -1)); return true; }
    if (e.key === ' ' || e.key === '/') { setFree(''); return true; }
    if (e.key === '+' || e.key === 'Tab') { setMore(v => !v); return true; }
    const m = MODS.find(x => x.key.toLowerCase() === e.key.toLowerCase());
    if (m) { toggle(m.id); setMore(true); return true; }
    return false;
  });
  if (free !== null) return <PromptField p={p} initial={free} onSubmit={v => p.onRun('custom', { prompt: v, mods })} onCancel={() => setFree(null)} />;
  return <div>
    <div className="m-row" style={{ gap: 4 }}>
      <button className="m-btn is-default" onClick={run}>{UI[p.lang].fixIt}</button>
      {mods.map(id => { const m = MODS.find(x => x.id === id); return <button key={id} className="m-chip is-on" onClick={() => toggle(id)}>{m[p.lang]}</button>; })}
      <button className="m-btn" style={{ padding: '0 7px' }} onClick={() => setMore(v => !v)} aria-label={UI[p.lang].modifiers}>+</button>
      <Key k="↵" p={p} />
    </div>
    {more && <div className="m-chipline">
      {MODS.filter(m => !mods.includes(m.id)).map(m => <button key={m.id} className="m-chip" onClick={() => toggle(m.id)}>{p.showKeys && <span className="keycap" style={{ minWidth: 14, height: 14, fontSize: 9.5 }}>{m.key}</span>}{m[p.lang]}</button>)}
      <button className="m-chip" onClick={() => setFree('')}><span className="ai-dot" style={{ width: 6, height: 6 }} /></button>
    </div>}
  </div>;
}

// 10 ——— Writing Tools: the Apple panel, for reference (a field, two tiles, a short list).
export function WritingTools(p) {
  const items = ['fix', 'pro', 'custom', 'shorten', 'email', 'translate'];
  const [hot, setHot] = useState(-1);
  const input = useRef(null);
  const [v, setV] = useState('');
  useEffect(() => { if (!p.preview) input.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const names = p.lang === 'fr'
    ? { fix: 'Relire', pro: 'Réécrire', custom: 'Amical', pro2: 'Professionnel', shorten: 'Concis', email: 'Rédiger un mail', translate: 'Traduire' }
    : { fix: 'Proofread', pro: 'Rewrite', custom: 'Friendly', pro2: 'Professional', shorten: 'Concise', email: 'Write email', translate: 'Translate' };
  const list = [['custom', names.custom], ['pro', names.pro2], ['shorten', names.shorten], ['email', names.email], ['translate', names.translate]];
  return <div className="apple-panel">
    <div className="apple-field"><Icon name="sparkle" set={p.iconSet} size={13} />
      <input ref={input} className="m-input" style={{ width: '100%' }} value={v} readOnly={p.preview} tabIndex={p.preview ? -1 : 0} placeholder={UI[p.lang].describe} onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); v.trim() ? p.onRun('custom', { prompt: v.trim() }) : p.onRun(hot >= 0 ? list[hot][0] : p.defaultId); }
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); p.onClose(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setHot(h => Math.min(list.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHot(h => Math.max(-1, h - 1)); }
        }} />
    </div>
    <div className="apple-tiles">
      <button className="m-tile" onClick={() => p.onRun('fix')}><Icon name="fix" set={p.iconSet} size={16} />{names.fix}</button>
      <button className="m-tile" onClick={() => p.onRun('pro')}><Icon name="undo" set={p.iconSet} size={16} />{names.pro}</button>
    </div>
    <div className="apple-list">
      {list.map(([id, n], i) => <button key={id + i} className={`m-btn ${i === hot ? 'is-hot' : ''}`} onMouseEnter={() => setHot(i)} onClick={() => p.onRun(id, id === 'custom' ? { mods: ['casual'] } : undefined)}>
        {p.showIcons && <Icon name={ACTION_BY_ID[id]?.icon || 'sparkle'} set={p.iconSet} size={13} />}{n}</button>)}
    </div>
  </div>;
}

// 8 ——— Aperçu direct is driven by the simulator (it runs at once); this is its idle face.
export function ApercuIdle(p) {
  const d = ACTION_BY_ID[p.defaultId] || ACTIONS[0];
  return <div className="preview-bar"><AIcon a={d} p={p} />{label(d, p.lang, true)}<span className="keycap">↵</span><span className="keycap">⇥</span></div>;
}

export const MENUS = [
  { id: 'ilot', name: 'Îlot', C: Ilot, idea: 'Au repos : la dernière action et une pastille pour écrire. Tab, ↓ ou un survol ouvre une grille de 6 tuiles. Taper une lettre inconnue ouvre la consigne.', keys: 'Entrée = dernière action · F T P S E · Tab = grille · Espace = consigne', pros: 'Un seul objet qui grandit ; grille ≠ liste ; consigne à un clic.', cons: 'La grille plafonne vers 6 à 8 actions.', from: 'Dynamic Island (Apple)' },
  { id: 'eventail', name: 'Éventail', C: Eventail, idea: 'Une pilule « Corriger ↵ › ». La flèche ou › la déplie en bandeau horizontal de toutes les actions.', keys: 'Entrée · → / Tab déplie et avance · ← recule · lettres', pros: 'Le chemin quotidien est une touche ; très compact.', cons: 'Reste une rangée, donc un peu une liste.', from: 'PopClip, menu d’édition iOS' },
  { id: 'invite', name: 'Invite', C: Invite, idea: 'Le menu est un simple champ. Vide + Entrée = dernière action ; taper filtre les actions (« tr » → Traduire) ou devient une consigne libre.', keys: 'Entrée · taper · Tab complète · ↑↓ · chiffres 1–5', pros: 'Le plus petit objet qui va le plus loin ; idéal pour les consignes libres.', cons: 'Peu découvrable à la souris ; pas de raccourcis-lettres.', from: 'Raycast, champ « Describe your change » d’Apple' },
  { id: 'boussole', name: 'Boussole', C: Boussole, idea: 'Un petit disque. Chaque flèche = une action fixe (↑ Traduire, → Pro, ↓ Raccourcir, ← Mail), le centre = la dernière.', keys: 'Flèche = choisir, même flèche = lancer · Entrée = centre', pros: 'Mémoire musculaire : toujours au même endroit ; le plus rapide pour un habitué.', cons: '4 à 8 emplacements seulement.', from: 'Menus radiaux (Blender, Maya)' },
  { id: 'molette', name: 'Molette', C: Molette, idea: 'Une seule action visible, les voisines estompées. ←/→ ou la molette tourne, Entrée lance.', keys: '← → · molette · Entrée', pros: 'Empreinte minimale absolue.', cons: 'Aller à la 5e action coûte 4 appuis.', from: 'Alt+Tab, sélecteurs iOS' },
  { id: 'touches', name: 'Touches', C: Touches, idea: 'Presque rien : un point. Une lettre lance tout de suite ; si tu hésites 0,3 s, les touches s’affichent.', keys: 'F T P S E · Entrée · Espace', pros: 'Zéro affichage pour un habitué ; on apprend tout seul.', cons: 'Un débutant croit que rien ne s’est passé.', from: 'which-key (Vim), menus « marking »' },
  { id: 'tonalite', name: 'Tonalité', C: Tonalite, idea: 'Un pavé 3×3 : familier ↔ soutenu, plus court ↔ plus long. Une position couvre Pro, Raccourcir, Amical et leurs mélanges.', keys: 'Tab ouvre · flèches déplacent · Entrée applique', pros: 'Très « Apple Intelligence » ; couvre beaucoup avec un seul geste.', cons: 'Mail et consigne libre ne rentrent pas dans les axes.', from: 'Figma « Adjust tone », Copilot' },
  { id: 'apercu', name: 'Aperçu direct', C: ApercuIdle, idea: 'Le raccourci lance tout de suite la dernière action ; tu vois le résultat surligné. Entrée garde, Tab essaie l’action suivante, Échap annule.', keys: 'Entrée garde · Tab suivante · Échap annule', pros: 'Aucune décision à prendre pour le cas courant.', cons: 'Calcule parfois pour rien ; 2 touches (raccourci + Entrée).', from: 'Copilot dans Word, Proofread d’Apple' },
  { id: 'recette', name: 'Recette', C: Recette, idea: 'Une phrase à composer : « Corriger » + puces (pro, court, amical, en mail…). Toutes les combinaisons sans nouvel écran.', keys: 'Lettres ajoutent des puces · Retour arrière · Entrée', pros: 'Le plus de combinaisons dans le moins de place.', cons: 'Il faut penser « je combine ».', from: 'Raycast AI Commands, PowerToys Advanced Paste' },
  { id: 'writing', name: 'Writing Tools', C: WritingTools, idea: 'La référence Apple : un champ « Décrivez la modification », deux tuiles, une courte liste.', keys: 'Taper · ↑↓ · Entrée', pros: 'Découvrable, très clair.', cons: 'C’est une liste : plus grand que les autres.', from: 'Apple Writing Tools (macOS 15+)' },
];
export const MENU_BY_ID = Object.fromEntries(MENUS.map(m => [m.id, m]));

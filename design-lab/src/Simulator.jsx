import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Surface, Icon } from './Surface.jsx';
import { MENU_BY_ID } from './menus.jsx';
import { LoaderInner, LoaderFx } from './loaders.jsx';
import { ACTIONS, ACTION_BY_ID, PARAGRAPHS, OUTCOME_BY_ID, UI, label, resolveAction, mockRewrite } from './data.js';
import { wordDiff, tokenize } from './diff.js';
import { wait, clock } from './motion.js';

const initialTexts = () => Object.fromEntries(PARAGRAPHS.map(p => [p.id, p.text]));
const SHORTCUT_LABEL = { 'ctrl-alt-space': ['Ctrl', 'Alt', 'Espace'], 'ctrl-alt': ['Ctrl', 'Alt'], 'double-shift': ['Maj', 'Maj'] };

export function Simulator({ cfg, set, onStatus, onPhase, api }) {
  const desk = useRef(null);
  const body = useRef(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const [texts, setTexts] = useState(initialTexts);
  const [display, setDisplay] = useState({}); // pid → { start, end, ops, whole, fx, key, diff }
  const [sel, setSel] = useState([]); // [{ pid, start, end }] in document order
  const [phase, setPhase] = useState('idle');
  const [pos, setPos] = useState({ left: 40, top: 120 });
  const [grow, setGrow] = useState('down');
  const [showLoader, setShowLoader] = useState(false);
  const [slow, setSlow] = useState(false);
  const [run, setRun] = useState(null);
  const [lastAction, setLastAction] = useState('fix');
  const [keycast, setKeycast] = useState(null);
  const [settings, setSettings] = useState(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const abort = useRef(null);
  const holdRelease = useRef(null);
  const hovered = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const runRef = useRef(run);
  runRef.current = run;
  const selRef = useRef(sel);
  selRef.current = sel;
  const textsRef = useRef(texts);
  textsRef.current = texts;
  const t0 = useRef(0);

  const status = useCallback(msg => onStatus?.(msg), [onStatus]);
  useEffect(() => { onPhase?.(phase); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const flashKeys = keys => { setKeycast(keys); clearTimeout(flashKeys.t); flashKeys.t = setTimeout(() => setKeycast(null), 900); };

  // ——— Anchor next to the selection (kept fixed during a run) ———
  const place = useCallback(() => {
    const d = desk.current;
    if (!d) return;
    const els = [...d.querySelectorAll('[data-range]')];
    if (!els.length) return;
    const dr = d.getBoundingClientRect();
    const lastRects = els[els.length - 1].getClientRects();
    const last = lastRects[lastRects.length - 1] || els[els.length - 1].getBoundingClientRect();
    const firstRect = els[0].getClientRects()[0] || els[0].getBoundingClientRect();
    const left = Math.max(10, Math.min(last.right - dr.left - 30, dr.width - 330));
    if (cfgRef.current.anchor === 'above') {
      setGrow('up');
      setPos({ left: Math.max(10, Math.min(firstRect.left - dr.left, dr.width - 330)), bottom: dr.bottom - firstRect.top + 8, top: 'auto' });
    } else {
      setGrow('down');
      setPos({ left, top: Math.min(last.bottom - dr.top + 8, dr.height - 60), bottom: 'auto' });
    }
  }, []);

  const clearRun = () => { abort.current?.abort(); abort.current = null; holdRelease.current = null; };
  const close = useCallback(() => { clearRun(); setPhase('idle'); setShowLoader(false); setSlow(false); }, []);

  // ——— Opening ———
  const openMenu = useCallback(() => {
    if (!selRef.current.length) { setPhase('notice'); place(); setTimeout(() => { if (phaseRef.current === 'notice') setPhase('idle'); }, 1600); return; }
    if (['working', 'menu', 'preview'].includes(phaseRef.current)) return;
    clearRun();
    place();
    if (cfgRef.current.menu === 'apercu') { startRun(cfgRef.current.rememberLast ? lastAction : 'fix', { preview: true }); return; }
    setPhase('menu');
    status('Menu ouvert');
  }, [lastAction, place]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— A run: wait for the mock model, then replace, preview or fail ———
  const startRun = useCallback(async (actionId, opts = {}) => {
    const c = cfgRef.current;
    clearRun();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const outId = resolveAction(actionId, opts.mods || []);
    const ranges = selRef.current.map(x => {
      const full = textsRef.current[x.pid];
      return { ...x, full, orig: full.slice(x.start, x.end), res: mockRewrite(x.pid, full, x.start, x.end, outId) };
    });
    const ids = ranges.map(x => x.pid);
    const r = { actionId, outId, prompt: opts.prompt, mods: opts.mods, ids, ranges, preview: !!opts.preview };
    setRun(r);
    if (c.rememberLast && actionId !== 'custom') setLastAction(actionId);
    setPhase('working');
    setShowLoader(false);
    setSlow(false);
    t0.current = performance.now();
    status(`${label(ACTION_BY_ID[actionId], 'fr')} : le modèle travaille…`);
    const loaderTimer = setTimeout(() => { if (!ctrl.signal.aborted) setShowLoader(true); }, c.loaderDelay / clock.rate);
    const slowTimer = setTimeout(() => { if (!ctrl.signal.aborted) setSlow(true); }, 2500 / clock.rate);
    ctrl.signal.addEventListener('abort', () => { clearTimeout(loaderTimer); clearTimeout(slowTimer); });
    let ok;
    if (c.hold) ok = await new Promise(res => { holdRelease.current = () => res(true); ctrl.signal.addEventListener('abort', () => res(false), { once: true }); });
    else ok = await wait(c.latency, ctrl.signal);
    if (!ok || ctrl.signal.aborted) return;
    clearTimeout(loaderTimer); clearTimeout(slowTimer);
    holdRelease.current = null;
    setShowLoader(false);
    const ms = Math.round(performance.now() - t0.current);
    const outcome = OUTCOME_BY_ID[c.outcome] || OUTCOME_BY_ID.success;
    if (outcome.id !== 'success') { setPhase('error'); status(`Erreur simulée : ${outcome.label} (après ${ms} ms)`); return; }
    showResult(r, r.preview ? 'preview' : 'commit');
    setPhase(r.preview ? 'preview' : 'done');
    status(r.preview ? `Aperçu prêt en ${ms} ms : Entrée garde, Tab essaie la suivante, Échap annule` : `Remplacé en ${ms} ms`);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const showResult = (r, mode) => {
    const c = cfgRef.current;
    const whole = ['translate', 'email', 'custom'].includes(r.outId);
    const next = {};
    const nextTexts = {};
    for (const x of r.ranges) {
      const ops = whole ? [{ type: 'ins', text: x.res }] : wordDiff(x.orig, x.res).filter(o => o.type !== 'del');
      next[x.pid] = { start: x.start, end: x.start + x.res.length, ops, whole, fx: mode === 'preview' ? 'fade' : c.replaceFx, diff: mode === 'preview' ? 'underline' : c.diff, key: `${performance.now()}` };
      nextTexts[x.pid] = x.full.slice(0, x.start) + x.res + x.full.slice(x.end);
    }
    setTexts(t => ({ ...t, ...nextTexts }));
    setDisplay(d => ({ ...d, ...next }));
    // The new text stays selected, as after a paste that keeps the selection.
    setSel(r.ranges.map(x => ({ pid: x.pid, start: x.start, end: x.start + x.res.length })));
  };

  const revert = (r, fx = 'fade') => {
    if (!r) return;
    setTexts(t => ({ ...t, ...Object.fromEntries(r.ranges.map(x => [x.pid, x.full])) }));
    setDisplay(d => { const n = { ...d }; for (const x of r.ranges) n[x.pid] = { start: x.start, end: x.end, ops: [{ type: 'eq', text: x.orig }], whole: false, fx, diff: 'off', key: `${performance.now()}` }; return n; });
    setSel(r.ranges.map(x => ({ pid: x.pid, start: x.start, end: x.end })));
  };

  // ——— Done: check / undo countdown, then leave ———
  useEffect(() => {
    if (phase !== 'done') return;
    const c = cfgRef.current;
    if (!c.check && !c.undo) { const t = setTimeout(() => setPhase('idle'), 60); return () => clearTimeout(t); }
    const total = c.undo ? c.undoSeconds * 1000 : 1100;
    let left = total, last = performance.now(), raf = 0;
    const tick = () => {
      const now = performance.now();
      if (!hovered.current) left -= (now - last) * clock.rate;
      last = now;
      setUndoLeft(Math.max(0, left / total));
      if (left <= 0) { setPhase(p => p === 'done' ? 'idle' : p); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const undo = () => { const r = runRef.current; if (!r) return; revert(r, 'fade'); setPhase('undone'); status('Annulé : texte d’origine rétabli'); setTimeout(() => setPhase(p => p === 'undone' ? 'idle' : p), 900 / clock.rate); };

  // ——— Keyboard: shortcut, Esc, Ctrl+Z, preview keys ———
  useEffect(() => {
    let mods = { ctrl: false, alt: false, other: false }, lastShift = 0, shiftClean = true;
    const inField = e => e.target instanceof HTMLElement && e.target.matches('input, textarea, select') && !e.target.closest('[data-surface]');
    const down = e => {
      if (inField(e)) return;
      const c = cfgRef.current;
      if (e.key === 'Control') mods.ctrl = true;
      else if (e.key === 'Alt') mods.alt = true;
      else if (e.key === 'AltGraph') mods.other = true;
      else mods.other = true;
      if (e.key !== 'Shift') shiftClean = false;
      if (c.shortcut === 'ctrl-alt-space' && e.ctrlKey && e.altKey && e.code === 'Space') { e.preventDefault(); flashKeys(SHORTCUT_LABEL[c.shortcut]); openMenu(); return; }
      if (phaseRef.current === 'trigger') setPhase('idle');
      if (e.key === 'Escape' && ['working', 'done', 'error', 'notice', 'trigger'].includes(phaseRef.current)) { e.preventDefault(); if (phaseRef.current === 'working') status('Annulé pendant le travail'); close(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && phaseRef.current === 'done' && cfgRef.current.undo) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && desk.current?.contains(document.activeElement)) { e.preventDefault(); setSel(wholeParas(PARAGRAPHS.map(p => p.id), textsRef.current)); return; }
      if (phaseRef.current === 'preview') {
        const r = runRef.current;
        if (e.key === 'Enter') { e.preventDefault(); setPhase('done'); status('Aperçu gardé'); return; }
        if (e.key === 'Escape') { e.preventDefault(); revert(r); close(); status('Aperçu annulé'); return; }
        if (e.key === 'Tab') { e.preventDefault(); const order = ACTIONS.filter(a => a.id !== 'custom'); const i = order.findIndex(a => a.id === r.actionId); revert(r, 'instant'); startRun(order[(i + 1) % order.length].id, { preview: true }); return; }
      }
    };
    const up = e => {
      const c = cfgRef.current;
      if (c.shortcut === 'ctrl-alt' && (e.key === 'Control' || e.key === 'Alt')) {
        if (mods.ctrl && mods.alt && !mods.other) { flashKeys(SHORTCUT_LABEL['ctrl-alt']); openMenu(); }
        mods = { ctrl: false, alt: false, other: false };
      } else if (!e.ctrlKey && !e.altKey) mods = { ctrl: false, alt: false, other: false };
      if (c.shortcut === 'double-shift' && e.key === 'Shift') {
        const now = performance.now();
        if (shiftClean && now - lastShift < 380) { flashKeys(SHORTCUT_LABEL['double-shift']); openMenu(); lastShift = 0; }
        else lastShift = now;
        shiftClean = true;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [openMenu, startRun, close, status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Mouse selection in the mail, to the character (click, drag, double/triple click) ———
  const onMouseUp = e => {
    if (e.target.closest('[data-surface]')) return;
    if (['menu', 'working', 'preview'].includes(phaseRef.current)) return;
    const s = window.getSelection();
    let ranges = [];
    if (s && !s.isCollapsed && s.rangeCount) {
      const range = s.getRangeAt(0);
      for (const p of PARAGRAPHS) {
        const el = body.current.querySelector(`[data-pid="${p.id}"]`);
        if (!el || !range.intersectsNode(el)) continue;
        const len = textsRef.current[p.id].length;
        const start = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
        const end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : len;
        const t = textsRef.current[p.id];
        let a = Math.max(0, Math.min(start, len)), b = Math.max(a, Math.min(end, len));
        while (a < b && /\s/.test(t[a])) a++;
        while (b > a && /\s/.test(t[b - 1])) b--;
        if (b > a) ranges.push({ pid: p.id, start: a, end: b });
      }
      s.removeAllRanges();
    }
    setSel(ranges);
    setDisplay({}); // a new click or selection settles the last result
    if (phaseRef.current === 'done' || phaseRef.current === 'error' || phaseRef.current === 'trigger') setPhase('idle');
    if (ranges.length && cfgRef.current.trigger === 'selection') { selRef.current = ranges; setTimeout(() => { place(); if (phaseRef.current === 'idle') setPhase('trigger'); }, 180 / clock.rate); }
  };
  const onDeskDown = e => { if (phaseRef.current === 'menu' && !e.target.closest('[data-surface]') && !e.target.closest('.settings-win')) close(); };

  // Expose controls to the stage bar.
  useLayoutEffect(() => {
    api.current = {
      open: openMenu,
      finish: () => holdRelease.current?.(),
      select: ids => { if (!['menu', 'working', 'preview'].includes(phaseRef.current)) { setSel(wholeParas(ids, textsRef.current)); setDisplay({}); setPhase('idle'); } },
      resetText: () => { close(); setTexts(initialTexts()); setDisplay({}); setSel([]); setRun(null); },
      phase,
      holding: phase === 'working' && cfg.hold,
    };
  });
  useEffect(() => { if (phase === 'menu' || phase === 'working') place(); }, [cfg.anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ——— Surface content per phase ———
  const lang = cfg.lang;
  const Menu = MENU_BY_ID[cfg.menu]?.C;
  const menuProps = { lang, iconSet: cfg.iconSet, showIcons: cfg.showIcons && cfg.iconSet !== 'none', showKeys: cfg.showKeys, defaultId: cfg.rememberLast ? lastAction : 'fix', onRun: (id, o) => startRun(id, o), onClose: close, preview: false };
  const outcome = OUTCOME_BY_ID[cfg.outcome];
  const placementPill = cfg.placement === 'pill' || cfg.placement === 'both';
  const placementText = cfg.placement === 'text' || cfg.placement === 'both';
  let content = null, key = phase, fx = null;
  if (phase === 'trigger') content = <button className="trigger-dot" aria-label="FlowTranslate" onClick={openMenu}><span className="ai-dot" style={{ width: 10, height: 10 }} /></button>;
  else if (phase === 'notice') content = <div className="pill-row"><span className="pill-label">{lang === 'fr' ? 'Sélectionnez d’abord du texte' : 'Select some text first'}</span></div>;
  else if (phase === 'menu' && Menu) { content = <Menu key={cfg.menu} {...menuProps} />; key = `menu-${cfg.menu}`; }
  else if (phase === 'working') {
    const withLabel = run?.preview || (slow && cfg.slowLabel === 'label');
    content = <div className="pill-row">
      {showLoader ? <LoaderInner id={cfg.loader} params={cfg.loaderParams[cfg.loader]} /> : <span style={{ width: 14, height: 14 }} />}
      {withLabel && <span className={`pill-label ${slow ? 'shimmer' : ''}`}>{run?.preview ? label(ACTION_BY_ID[run.actionId], lang, true) : `${UI[lang].working}…`}</span>}
    </div>;
    if (showLoader) fx = <LoaderFx id={cfg.loader} params={cfg.loaderParams[cfg.loader]} />;
  } else if (phase === 'preview') content = <div className="preview-bar">
    <span style={{ fontWeight: 560 }}>{label(ACTION_BY_ID[run?.actionId] || ACTIONS[0], lang, true)}</span>
    <button className="pill-btn accent" onClick={() => setPhase('done')}>{UI[lang].apply} ↵</button>
    <button className="pill-btn" onClick={() => { const order = ACTIONS.filter(a => a.id !== 'custom'); const i = order.findIndex(a => a.id === run.actionId); revert(run, 'instant'); startRun(order[(i + 1) % order.length].id, { preview: true }); }}>{UI[lang].next} ⇥</button>
    <button className="pill-btn" onClick={() => { revert(run); close(); }} aria-label="Esc">✕</button>
  </div>;
  else if (phase === 'done') content = <div className="pill-row" style={{ gap: 6, padding: '0 6px 0 10px' }} onMouseEnter={() => { hovered.current = true; }} onMouseLeave={() => { hovered.current = false; }}>
    {cfg.check && <svg className="check-draw" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path pathLength="1" d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    {cfg.undo && <button className="pill-btn" onClick={undo}>{cfg.showIcons && cfg.iconSet !== 'none' && <Icon name="undo" set={cfg.iconSet} size={12} />}{UI[lang].undo}
      <svg className="undo-ring" viewBox="0 0 14 14"><circle className="track" cx="7" cy="7" r="5" /><circle cx="7" cy="7" r="5" strokeDasharray={`${(2 * Math.PI * 5 * undoLeft).toFixed(2)} 99`} /></svg></button>}
    {!cfg.undo && !cfg.check && null}
  </div>;
  else if (phase === 'undone') content = <div className="pill-row"><Icon name="undo" set={cfg.iconSet === 'none' ? 'iconoir' : cfg.iconSet} size={13} /><span className="pill-label">{lang === 'fr' ? 'Annulé' : 'Undone'}</span></div>;
  else if (phase === 'error' && outcome) {
    const act = () => {
      if (outcome.kind === 'config') { setSettings(outcome.field); status(`Réglages ouverts sur le champ fautif (${outcome.field})`); }
      else if (outcome.kind === 'transient') startRun(run.actionId, { prompt: run.prompt, mods: run.mods });
      else if (outcome.kind === 'paste') { setCopied(true); setTimeout(() => { setCopied(false); close(); }, 900 / clock.rate); }
    };
    const btn = outcome.action && <button className={`pill-btn ${cfg.errorStyle === 'card' ? 'accent' : ''}`} onClick={act}>{copied ? (lang === 'fr' ? 'Copié' : 'Copied') : outcome.action[lang]}</button>;
    content = cfg.errorStyle === 'card'
      ? <div className="err-card"><h4><Icon name="warning" set={cfg.iconSet === 'none' ? 'iconoir' : cfg.iconSet} size={14} />{outcome.short[lang]}</h4><p>{outcome.detail[lang]}</p><div className="row"><button className="pill-btn" onClick={close}>{lang === 'fr' ? 'Fermer' : 'Dismiss'}</button>{btn}</div></div>
      : <div className="err-row"><Icon name="warning" set={cfg.iconSet === 'none' ? 'iconoir' : cfg.iconSet} size={14} /><span>{outcome.short[lang]}</span>{btn}<button className="pill-btn" aria-label="close" onClick={close} style={{ padding: '0 6px' }}>✕</button></div>;
    key = `error-${cfg.errorStyle}-${copied}`;
  }
  const surfaceOpen = !!content && !(phase === 'working' && !placementPill && !run?.preview) && !(phase === 'done' && !cfg.check && !cfg.undo);
  // Keep the last content during the exit animation.
  const lastContent = useRef({ content, key, fx });
  if (surfaceOpen) lastContent.current = { content, key, fx };
  const shown = surfaceOpen ? { content, key, fx } : lastContent.current;

  const workingIds = phase === 'working' && showLoader && placementText ? run?.ids || [] : [];
  return <div className="desk" ref={desk} data-wall={cfg.wall} data-dark={cfg.material.dark} onMouseDown={onDeskDown} tabIndex={-1}>
    <div className="window">
      <div className="win-title"><span>✉︎</span><span>{lang === 'fr' ? 'Nouveau message' : 'New message'}</span><span className="ctl">— ▢ ✕</span></div>
      <div className="mail-fields"><div>{lang === 'fr' ? 'À' : 'To'} : Claire Martin</div><div>{lang === 'fr' ? 'Objet' : 'Subject'} : Q3 report</div></div>
      <div className="mail-body" ref={body} onMouseUp={onMouseUp}>
        {PARAGRAPHS.map(p => <p key={p.id}><Para id={p.id} text={texts[p.id]} disp={display[p.id]} range={sel.find(x => x.pid === p.id)}
          showSel={!['done', 'undone'].includes(phase)} working={workingIds.includes(p.id)} cfg={cfg} /></p>)}
      </div>
    </div>
    <div className="task"><span>⌂</span><span>{lang === 'fr' ? 'Mail' : 'Mail'}</span><span>·</span><span>FlowTranslate</span></div>
    {keycast && <div className="keycast">{keycast.map((k, i) => <kbd key={i}>{k}</kbd>)}</div>}
    <Surface open={surfaceOpen} pos={pos} grow={grow} contentKey={shown.key} material={cfg.material} motion={cfg.motion} fx={shown.fx}>{shown.content}</Surface>
    {settings && <MockSettings field={settings} outcome={outcome} onClose={() => { setSettings(null); close(); }} />}
  </div>;
}

const wholeParas = (ids, texts) => PARAGRAPHS.filter(p => ids.includes(p.id)).map(p => ({ pid: p.id, start: 0, end: texts[p.id].length }));
// Character offset of a DOM position inside a paragraph element.
function offsetIn(el, node, offset) { const r = document.createRange(); r.setStart(el, 0); r.setEnd(node, offset); return r.toString().length; }

// One paragraph: text before, the selected or rewritten range, text after.
function Para({ id, text, disp, range, showSel, working, cfg }) {
  // While the model works, the range carries the effect (no selection tint unless asked).
  if (working && range) {
    const fxStyle = cfg.textFxParams[cfg.textFx];
    const piece = text.slice(range.start, range.end);
    const cls = `work-range ${cfg.keepSelection ? 'sel-range' : ''}`;
    return <span className="para" data-pid={id}>{text.slice(0, range.start)}
      {cfg.textFx === 'words'
        ? <span className={`${cls} tfx-words`} data-range>{words(piece)}</span>
        : <span className={`${cls} tfx-${cfg.textFx}`} style={fxStyle} data-range>{piece}</span>}
      {text.slice(range.end)}</span>;
  }
  if (disp) {
    const { start, end, ops, whole, fx, diff, key } = disp;
    const perWord = ['blur', 'rise', 'type'].includes(fx);
    const vars = { '--stagger': `${cfg.replaceParams.stagger}ms`, '--blur': `${cfg.replaceParams.blur}px`, '--wdur': `${cfg.replaceParams.dur}ms`, '--diff-hold': `${cfg.diffHold}ms`, '--diff-fade': `${cfg.diffFade}ms` };
    const chg = diff === 'fade' ? 'chg-fade' : diff === 'persist' ? 'chg-persist' : diff === 'underline' ? 'chg-underline' : '';
    let i = 0;
    const parts = ops.map((op, k) => {
      const nodes = tokenize(op.text).map((t, j) => /^\s+$/.test(t) ? t : <span key={j} className="w" style={perWord ? { '--i': i++ } : undefined}>{t}</span>);
      return op.type === 'ins' && !whole && chg ? <span key={k} className={chg}>{nodes}</span> : <React.Fragment key={k}>{nodes}</React.Fragment>;
    });
    const wholeCls = whole && chg ? chg : '';
    const fxCls = { blur: 'rx-blur', rise: 'rx-rise', type: 'rx-type', fade: 'rx-fade', crossblur: 'rx-crossblur' }[fx] || '';
    const selected = showSel && range && range.start === start && range.end === end;
    return <span className="para" data-pid={id}>{text.slice(0, start)}
      <span key={key} className={`${fxCls} ${wholeCls} ${selected ? 'sel-range' : ''}`} style={vars} data-range={selected ? '' : undefined}>{parts}</span>
      {text.slice(end)}</span>;
  }
  if (range && showSel) return <span className="para" data-pid={id}>{text.slice(0, range.start)}<span className="sel-range" data-range>{text.slice(range.start, range.end)}</span>{text.slice(range.end)}</span>;
  return <span className="para" data-pid={id}>{text}</span>;
}
function words(text) { let i = 0; return tokenize(text).map((t, j) => /^\s+$/.test(t) ? t : <span key={j} className="w" style={{ '--i': i++ }}>{t}</span>); }

function MockSettings({ field, outcome, onClose }) {
  const refs = { endpoint: useRef(null), key: useRef(null), model: useRef(null) };
  useEffect(() => { refs[field]?.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); refs[field]?.current?.querySelector('input,select')?.focus(); }, [field]); // eslint-disable-line react-hooks/exhaustive-deps
  const F = ({ id, label: l, children }) => <div ref={refs[id]} className={`s-field ${field === id ? 'is-target' : ''}`}><span>{l}</span>{children}{field === id && outcome?.fieldError && <span className="err">{outcome.fieldError}</span>}</div>;
  return <div className="settings-win" data-settings>
    <header><span>FlowTranslate · Réglages</span><button className="pill-btn" onClick={onClose}>✕</button></header>
    <div className="body">
      <h5>Connexion</h5>
      <F id="endpoint" label="Adresse du serveur (endpoint)"><input defaultValue="http://localhost:8003/v1" /></F>
      <F id="key" label="Clé API"><input defaultValue="sk-••••••••••••" type="password" /></F>
      <F id="model" label="Modèle"><select defaultValue="gemma-4-12b"><option>gemma-4-12b</option><option>gemma-4-12b-qat</option><option>qwen3-8b</option></select></F>
      <div className="s-field"><span>Niveau de réflexion</span><select defaultValue="off"><option value="off">Désactivée (le plus rapide)</option><option>Faible</option><option>Moyen</option><option>Élevé</option></select></div>
      <h5>Actions</h5>
      <div className="s-field"><span>Corriger · consigne</span><input defaultValue="Corrige l’orthographe et la grammaire sans changer le style." /></div>
    </div>
  </div>;
}

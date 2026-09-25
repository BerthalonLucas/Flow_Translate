import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bridge } from '../bridge';
import type { HaloEvent, Rect } from '../types';
import { inset, pad, sweepPositions, sweepStrip } from './geometry';
import './halo.css';

// The work's halo appears with the orb's delay (DA-PLAN lot 6), in JS so it holds under
// reduced animations too, where every CSS delay is cancelled (styles.css). After the menu's
// halo it follows at once: the selection was already shown.
export const HALO_APPEAR_DELAY_MS = 250;

export type HaloState = 'waiting' | 'shown' | 'leaving';

const box = (rect: Rect): CSSProperties => ({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });

// The rectangles laid end to end as one strip (src/halo/geometry.ts): a gradient runs on
// from one line to the next instead of restarting on each.
function stripped(rects: readonly Rect[]) {
  const strip = sweepStrip(rects);
  return strip.lines.map(line => {
    const { from, to } = sweepPositions(strip.total, line.offset);
    return { rect: line, style: { ...box(line), '--total': `${strip.total}px`, '--off': `${line.offset}px`, '--from': `${from}px`, '--to': `${to}px`, '--start': `${-line.offset}px` } as CSSProperties };
  });
}

// The selection (« mise en valeur », Lucas 25/09, design-lab/mise-en-valeur.html). The menu
// shows it at three levels, still: a line around the text box, a faint band per whole line,
// a tint on the exact text. The work keeps the bands, turns the box's line into an aurora and
// passes a reflection over the letters: a veil of the ground's own colour.
function HaloSelection({ run }: { run: HaloEvent }) {
  const work = run.phase === 'work';
  const exact = useMemo(() => stripped(run.lines.map(line => pad(line, 1))), [run.lines]);
  const textBox = run.textBox ? inset(run.textBox, 3) : null;
  return <>
    {textBox && (work
      ? <div className="halo-aurora" style={box(textBox)}><i className="ring" /><i className="glow"><i className="ring" /></i></div>
      : <div className="halo-box" style={box(textBox)} />)}
    {(run.full ?? []).map((line, index) => <div key={`band-${index}`} className="halo-band" style={box(pad(line, 3, 1))} />)}
    {exact.map(({ style }, index) => <div key={index} className={work ? 'halo-veil' : 'halo-tint'} style={style} />)}
  </>;
}

// The result pasted: a wave of light over the new text (1 s, once), then the changed words,
// an iridescent glow per line of each changed range (deeper hues on a light ground), held
// until Rust's `leave` (the user's next action in the text, 60 s at most), then 900 ms out.
function HaloMarks({ run }: { run: HaloEvent }) {
  const whole = useMemo(() => stripped((run.whole ?? []).map(line => pad(line, 1))), [run.whole]);
  const words = useMemo(() => stripped(run.lines.map(line => pad(line, 2))), [run.lines]);
  return <>
    {whole.map(({ style }, index) => <div key={`wave-${index}`} className="halo-wave" style={style} />)}
    <div className="halo-marks" data-arrival={whole.length ? 'wave' : 'fade'}>
      {words.map(({ style }, index) => <div key={index} className="halo-mark" style={style} />)}
    </div>
  </>;
}

// One run of the halo, as Rust sent it. Its tone comes from the ground read under the text;
// without one, from the app's theme (halo.css).
export function HaloScene({ run, state }: { run: HaloEvent; state: HaloState }) {
  const style = run.ground ? { '--ground': run.ground.join(' ') } as CSSProperties : undefined;
  return <div className="halo" data-phase={run.phase} data-state={state} data-tone={run.tone ?? undefined} style={style} aria-hidden="true">
    {run.phase === 'marks' ? <HaloMarks run={run} /> : <HaloSelection run={run} />}
  </div>;
}

// The `halo` window: Rust places it over the selection (or the new text) and sends its
// rectangles in logical pixels relative to the window (`halo` events, src-tauri/src/halo.rs).
// `menu` and `marks` draw at once, `work` after 250 ms unless the menu's halo was shown,
// `leave` fades out (150 ms, the marks 900 ms), `clear` removes. An event older than the last
// run is ignored.
export function HaloWindow() {
  const [run, setRun] = useState<HaloEvent | null>(null);
  const [state, setState] = useState<HaloState>('waiting');
  const latest = useRef(-1);
  // The menu's halo is shown: the work's follows it without the delay.
  const menuShown = useRef(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    let timer = 0;
    void bridge.on<HaloEvent>('halo', event => {
      if (event.generation < latest.current) return;
      latest.current = event.generation;
      window.clearTimeout(timer);
      const afterMenu = menuShown.current;
      menuShown.current = event.phase === 'menu';
      if (event.phase === 'work' && !afterMenu) {
        setRun(event);
        setState('waiting');
        timer = window.setTimeout(() => setState('shown'), HALO_APPEAR_DELAY_MS);
      } else if (event.phase === 'menu' || event.phase === 'work' || event.phase === 'marks') {
        setRun(event);
        setState('shown');
      } else if (event.phase === 'leave') setState('leaving');
      else { setRun(null); setState('waiting'); }
    }).then(listener => {
      if (!alive) return listener();
      off = listener;
      // Listening: the tests (and the real-window checks) wait for this before any event.
      document.documentElement.dataset.haloReady = 'true';
    });
    return () => { alive = false; window.clearTimeout(timer); off?.(); delete document.documentElement.dataset.haloReady; };
  }, []);
  if (!run) return null;
  return <HaloScene key={run.generation} run={run} state={state} />;
}

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { bridge } from '../bridge';
import type { HaloEvent, Rect } from '../types';
import { sweepPositions, sweepStrip } from './geometry';
import './halo.css';

// The sweep appears with the orb's delay (DA-PLAN lot 6), in JS so it holds under reduced
// animations too, where every CSS delay is cancelled (styles.css).
export const HALO_APPEAR_DELAY_MS = 250;

export type HaloState = 'waiting' | 'shown' | 'leaving';

// One div per line, radius 3 px, the band continuous from one line to the next.
export function HaloLines({ lines, state }: { lines: readonly Rect[]; state: HaloState }) {
  const strip = useMemo(() => sweepStrip(lines), [lines]);
  return <div className="halo" data-state={state} aria-hidden="true">
    {strip.lines.map((line, index) => {
      const { from, to } = sweepPositions(strip.total, line.offset);
      const style = { left: line.x, top: line.y, width: line.width, height: line.height, '--total': `${strip.total}px`, '--from': `${from}px`, '--to': `${to}px`, '--start': `${-line.offset}px` } as CSSProperties;
      return <div key={index} className="halo-line" style={style} />;
    })}
  </div>;
}

// The `halo` window: Rust places it over the lines of the selection and sends them in
// logical pixels relative to the window (`halo` events, src-tauri/src/halo.rs). `work`
// draws them after 250 ms, `leave` fades them in 150 ms, `clear` removes them. An event
// older than the last run is ignored.
export function HaloWindow() {
  const [run, setRun] = useState<HaloEvent | null>(null);
  const [state, setState] = useState<HaloState>('waiting');
  const latest = useRef(-1);
  useEffect(() => {
    let off: (() => void) | undefined;
    let alive = true;
    let timer = 0;
    void bridge.on<HaloEvent>('halo', event => {
      if (event.generation < latest.current) return;
      latest.current = event.generation;
      window.clearTimeout(timer);
      if (event.phase === 'work') {
        setRun(event);
        setState('waiting');
        timer = window.setTimeout(() => setState('shown'), HALO_APPEAR_DELAY_MS);
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
  return run ? <HaloLines key={run.generation} lines={run.lines} state={state} /> : null;
}

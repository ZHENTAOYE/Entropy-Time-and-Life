// Font gate for text drawn into the canvas: blocks the frame (delayRender) until the font slices needed AT THIS FRAME
// are loaded — re-arms whenever the set changes (e.g. a new caption appears while a render tab is reused), and only
// releases after the commit whose canvas draw used the loaded fonts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { loadFont } from '../../lib/fonts';

export function useFontGate(specs: Array<[string, string]>): string | null {
  const key = specs.map((s) => s.join('|')).join('||');
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const handles = useRef(new Map<string, number>());
  const ready = readyKey === key || specs.length === 0;
  if (!ready && !handles.current.has(key)) handles.current.set(key, delayRender('S06 fonts ' + key.slice(0, 40)));
  useEffect(() => {
    if (ready) return;
    let alive = true;
    Promise.all(specs.map(([s, t]) => loadFont(s, t)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (alive) setReadyKey(key);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useLayoutEffect(() => {
    for (const [k, h] of [...handles.current]) {
      if (k === readyKey || k !== key) {
        continueRender(h);
        handles.current.delete(k);
      }
    }
  });
  return ready ? key : null;
}

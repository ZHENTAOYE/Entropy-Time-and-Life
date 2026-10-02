// Windowed font loading for S02. lib/fonts' useFontsReady is meant for a fixed set of specs; here every frame asks
// only for the font slices it actually shows (CJK slices are many small files, and each tab otherwise loads all of
// them for every caption of the scene). Unlike the lib hook, a *change* of the requested set opens a new
// delayRender, and `ready` is true only for the exact set requested by the current render.
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { loadFont } from '../../lib/fonts';

export function useFontsWindowed(specs: Array<[string, string]>): boolean {
  const key = specs.map((s) => s.join('|')).join('||');
  const [readyKey, setReadyKey] = useState<string | null>(key === '' ? '' : null);
  const ready = key === '' || readyKey === key;
  const pending = useRef<{ key: string; handle: number } | null>(null);
  if (!ready && (!pending.current || pending.current.key !== key)) {
    if (pending.current) continueRender(pending.current.handle);
    pending.current = { key, handle: delayRender('S02 fonts ' + key.slice(0, 50)) };
  }
  useEffect(() => {
    if (key === '') return;
    let alive = true;
    Promise.all(specs.map(([s, t]) => loadFont(s, t)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (!alive) return;
        setReadyKey(key);
        if (pending.current && pending.current.key === key) {
          continueRender(pending.current.handle);
          pending.current = null;
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      if (pending.current) continueRender(pending.current.handle);
      pending.current = null;
    },
    [],
  );
  return ready;
}

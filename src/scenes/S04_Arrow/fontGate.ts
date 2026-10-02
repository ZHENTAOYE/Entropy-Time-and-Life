// Lazy font gate: like lib/fonts useFontsReady, but a component only asks for (and waits on) its font slices while
// it is `active` (on screen or about to be). The scene has 8 narration lines in three weights of Noto Serif SC plus
// monumental Latin numerals; loading all of them up front costs every cold still (stills.mjs opens a fresh tab per
// frame) ~0.3–0.5 s. A delayRender is taken synchronously in the render where `active` first needs fonts that are
// not loaded yet, so the frame is never captured with missing glyphs (renderMedia: once per tab per caption).
// The module-level set only records which slices this tab has already loaded: it changes when we wait, never what
// is drawn.
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { loadFont } from '../../lib/fonts';

const loaded = new Set<string>();

export function useLazyFonts(specs: Array<[string, string]>, active: boolean): boolean {
  const key = specs.map((s) => s.join('|')).join('||');
  const need = active && !loaded.has(key);
  const [, bump] = useState(0);
  const handle = useRef<{ key: string; h: number } | null>(null);
  if (need && handle.current === null) handle.current = { key, h: delayRender('s04 fonts ' + key.slice(0, 60)) };
  useEffect(() => {
    if (!need) return;
    let alive = true;
    Promise.all(specs.map(([s, t]) => loadFont(s, t)))
      .then(() => document.fonts.ready)
      .then(() => {
        loaded.add(key);
        if (handle.current && handle.current.key === key) {
          continueRender(handle.current.h);
          handle.current = null;
        }
        if (alive) bump((x) => x + 1);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need, key]);
  // never leave a handle behind on unmount
  useEffect(
    () => () => {
      if (handle.current) {
        continueRender(handle.current.h);
        handle.current = null;
      }
    },
    [],
  );
  return active && loaded.has(key);
}

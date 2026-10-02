import './fonts.css';
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

export const FONT = {
  /** Chinese display & narration (weights 200/400/600/900) */
  serif: '"Noto Serif SC", "Noto Serif CJK SC", serif',
  /** Chinese UI / labels (weights 300/400/700) */
  sans: '"Noto Sans SC", "Noto Sans CJK SC", sans-serif',
  /** Technical HUD labels, numbers, equations-as-code (300/400/700) */
  mono: '"JetBrains Mono", ui-monospace, monospace',
  /** Latin display, italic math letters (400/600, italic available) */
  latin: '"Cormorant Garamond", "Noto Serif SC", serif',
} as const;

const loaded = new Map<string, Promise<unknown>>();

/** Load the font slices needed to render `text` with CSS font shorthand `spec` (e.g. '600 64px "Noto Serif SC"'). */
export function loadFont(spec: string, text: string): Promise<unknown> {
  const key = spec + '|' + text;
  let p = loaded.get(key);
  if (!p) {
    p = document.fonts.load(spec, text || 'A').catch(() => undefined);
    loaded.set(key, p);
  }
  return p;
}

/**
 * Blocks rendering (delayRender) until the given fonts are loaded for the given text.
 * Returns true once ready. Use before drawing text into a canvas or sampling glyph points.
 * `specs` is a list of [cssFontShorthand, text] pairs, e.g. [['900 300px "Noto Serif SC"', '熵']].
 */
export function useFontsReady(specs: Array<[string, string]>): boolean {
  const key = specs.map((s) => s.join('|')).join('||');
  const [ready, setReady] = useState(false);
  const handleRef = useRef<number | null>(null);
  if (handleRef.current === null && !ready) handleRef.current = delayRender('fonts ' + key.slice(0, 60));
  useEffect(() => {
    let alive = true;
    const release = () => {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
    };
    Promise.all(specs.map(([s, t]) => loadFont(s, t)))
      .then(() => document.fonts.ready)
      .then(() => {
        if (alive) setReady(true);
        release();
      });
    return () => {
      alive = false;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ready;
}

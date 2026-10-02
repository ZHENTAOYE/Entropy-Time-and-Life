// S09 — the font slices the scene draws into its canvases (loaded, per frame, before the frame is drawn).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { FONT, loadFont } from '../../lib/fonts';

export const F = {
  /** narration voice (= lib Caption default, = S05's F.voice) */
  voice: `600 56px ${FONT.serif}`,
  /** punch-in assertions 星系。细胞。你。 */
  punch: `900 140px ${FONT.serif}`,
  /** title 熵 · 时间 · 生命 */
  title: `600 86px ${FONT.serif}`,
  pinyin: `italic 500 38px ${FONT.latin}`,
  /** HUD */
  odo: `700 44px ${FONT.mono}`,
  odoSup: `700 26px ${FONT.mono}`,
  hudZh: `400 24px ${FONT.sans}`,
  hudZhBig: `400 30px ${FONT.sans}`,
  tc: `400 30px ${FONT.mono}`,
} as const;

/**
 * The font slices each frame actually draws (loaded before the frame is drawn): only the lines and HUD fonts that are on
 * screen at frame f — every slice costs a fetch + parse on a cold tab, and a black frame needs none.
 */
const W = (f: number, a: number, len: number) => f >= a - 1 && f < a + len + 1;
export function fontSpecsAt(f: number): Array<[string, string]> {
  const s: Array<[string, string]> = [];
  if (f < 210) {
    if (W(f, 24, 80)) s.push([F.voice, '宇宙，一路滚向平衡。']);
    if (W(f, 104, 106)) s.push([F.voice, '途中，它在一些角落，暂时织出了结构：']);
    s.push([F.odo, '0123456789 m'], [F.odoSup, '0123456789−'], [F.hudZh, '视野宽度你街区城市地球地月系太阳系奥尔特云恒星银河系本星系群宇宙网'], [F.hudZhBig, '你街区城市地球地月系太阳系奥尔特云恒星银河系本星系群宇宙网']);
  } else if (f < 428) {
    if (f < 318) s.push([F.punch, '星系。细胞。你']);
    if (f >= 311) s.push([F.voice, '然后，其中最小的一块，抬起头问：时间是什么？']);
  } else if (f < 834) {
    if (W(f, 488, 60)) s.push([F.voice, '墨，终将散开。']);
    if (W(f, 548, 66)) s.push([F.voice, '但在散开的路上——']);
    if (W(f, 614, 106)) s.push([F.voice, '它画出了。']);
    if (f >= 719) s.push([F.tc, '◀▶0123456789:× ']); // also the ◀◀'s ink mask while it melts
    if (f >= 741) s.push([F.title, '熵 · 时间 · 生命'], [F.pinyin, 'shāng']);
  }
  return s;
}

/**
 * Font gate for text drawn into canvases: blocks the frame (delayRender) until the font slices are loaded, and only
 * releases after the commit whose canvas draw used them.
 */
export function useFontGate(specs: Array<[string, string]>): boolean {
  const key = specs.map((s) => s.join('|')).join('||');
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const handles = useRef(new Map<string, number>());
  const ready = readyKey === key || specs.length === 0;
  if (!ready && !handles.current.has(key)) handles.current.set(key, delayRender('S09 fonts'));
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
  return ready;
}

// S09 — every font slice the scene draws into its canvases (loaded before the first frame is drawn).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { FONT, loadFont } from '../../lib/fonts';

export const F = {
  /** narration voice (= lib Caption default, = S05's F.voice) */
  voice: `600 56px ${FONT.serif}`,
  /** punch-in assertions 星系。细胞。你。 */
  punch: `900 140px ${FONT.serif}`,
  /** the brush-painted 你 (mask source) */
  brush: `900 124px ${FONT.serif}`,
  /** title 熵 · 时间 · 生命 */
  title: `600 86px ${FONT.serif}`,
  pinyin: `italic 500 38px ${FONT.latin}`,
  /** HUD */
  odo: `700 44px ${FONT.mono}`,
  odoSup: `700 26px ${FONT.mono}`,
  hudZh: `400 24px ${FONT.sans}`,
  hudZhBig: `400 30px ${FONT.sans}`,
  tc: `400 30px ${FONT.mono}`,
  tcBig: `700 46px ${FONT.mono}`,
} as const;

export const VOICE_TEXT =
  '宇宙，一路滚向平衡。途中，它在一些角落，暂时织出了结构：然后，其中最小的一块，抬起头问：时间是什么？墨，终将散开。但在散开的路上——它画出了你。';

export const FONT_SPECS: Array<[string, string]> = [
  [F.voice, VOICE_TEXT],
  [F.punch, '星系。细胞。你'],
  [F.brush, '你'],
  [F.title, '熵 · 时间 · 生命'],
  [F.pinyin, 'shāng'],
  [F.odo, '0123456789 m'],
  [F.odoSup, '0123456789−'],
  [F.hudZh, '视野宽度你街区城市地球地月系太阳系奥尔特云恒星银河系本星系群宇宙网'],
  [F.hudZhBig, '你街区城市地球地月系太阳系奥尔特云恒星银河系本星系群宇宙网'],
  [F.tc, '◀▶0123456789:× '],
  [F.tcBig, '◀'],
];

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

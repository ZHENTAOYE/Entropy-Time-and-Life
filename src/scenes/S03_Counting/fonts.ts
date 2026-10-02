// Windowed font loading for S03 (same contract as S02's local hook). lib/fonts' useFontsReady loads one fixed set of
// specs; S03 draws text in ~12 faces over 36 s, and the CJK faces are split into many small unicode-range slices, so
// asking for everything on every frame costs ~1 s per freshly opened tab (every still, every render worker). Here each
// frame asks only for the faces/characters that are actually on screen around it (±3 f), and `ready` is true only for
// the exact set requested by the current render (a new set opens a new delayRender).
import { useEffect, useRef, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { FONT, loadFont } from '../../lib/fonts';
import { T } from './constants';

type Spec = [string, string];

export function useFontsWindowed(specs: Spec[]): boolean {
  const key = specs.map((s) => s.join('|')).join('||');
  const [readyKey, setReadyKey] = useState<string | null>(key === '' ? '' : null);
  const ready = key === '' || readyKey === key;
  const pending = useRef<{ key: string; handle: number } | null>(null);
  if (!ready && (!pending.current || pending.current.key !== key)) {
    if (pending.current) continueRender(pending.current.handle);
    pending.current = { key, handle: delayRender('S03 fonts ' + key.slice(0, 50)) };
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

// ------------------------------------------------------------------ faces (size is irrelevant for loading)
const mono = (w: number) => `${w} 24px ${FONT.mono}`;
const sans = (w: number) => `${w} 24px ${FONT.sans}`;
const serif = (w: number) => `${w} 56px ${FONT.serif}`;
const latin = (w: number, italic = false) => `${italic ? 'italic ' : ''}${w} 56px ${FONT.latin}`;
const DIG = '0123456789';
/** symbols JetBrains Mono lacks fall back to Noto Sans SC: load them there too */
const SYM = '≈×·−±–%:/=()';

/** [from, to] (inclusive, scene frames) → specs. Each row mirrors the draw window of one producer. */
const WINDOWS: Array<[number, number, Spec[]]> = [
  // HUD: FIG.03 / N = 4 / 2×2×2×2 = 2⁴ = 16 种排列 (Scene.drawHud)
  [T.c1, T.rain + 2, [[mono(400), 'FIG.03 COUNTING MICROSTATES'], [mono(700), 'N=4 2×' + DIG], [sans(700), '种排列×']]],
  // particle labels, tape strip chart, ledger (count.ts)
  [T.labels, T.deal + 8, [[mono(400), 'ABCD MICROSTATE()=' + DIG], [mono(700), 'ABCD' + DIG], [sans(400), '左右亮在边的个数（）=']]],
  // histogram chrome of the 16 worlds (count.ts drawColumnsChrome)
  [T.sort + 8, T.rain + 14, [[mono(400), DIG + ':/'], [mono(700), DIG], [sans(400), '左右 :']]],
  // N = 10 / 100 / 10⁴ (histo.ts)
  [T.rain - 4, T.lottery + 20, [[mono(400), DIG + ' .%±≈×N=种排列'], [mono(700), 'N =' + DIG], [sans(400), '全在左各半右宽度种排列' + SYM]]],
  // lottery (lottery.ts)
  [T.lottery, T.glass + 22, [[mono(400), DIG + 'TRIALSHBEST /·'], [sans(400), '目标：个全在左边' + DIG]]],
  // glass (glass.ts)
  [T.glass, T.row + 2, [[mono(400), DIG + 'mLN ≈×'], [sans(400), '一杯水个分子假如：全在左边≈×'], [sans(300), '空']]],
  // row of zeros, ruler, zoom labels, odometer, dimension lines, ly ruler (zoom.ts)
  [T.row - 2, T.galaxyOut + 12, [[mono(400), DIG + SYM + '.cm ZEROSNEDAUk第位万'], [mono(700), DIG + '.m −'], [sans(400), '书桌城市地球太阳系视野宽度银河光年这一行第位万' + SYM + DIG]]],
  // needle label + 熵 (also needed while 熵's particles regroup into the S: the morph is sampled from the glyph)
  [T.needle - 2, T.formula + 28, [[serif(900), '熵'], [mono(400), 'N≈·' + DIG], [sans(400), '一杯水≈·']]],
  // the stele: formula sprite (S k W italic, = and log upright), inscription, note
  [T.formula - 6, T.c13 + 16, [[latin(600, true), 'SkW'], [latin(600), '= log'], [mono(400), 'L.BOLTZMANN·–WIEN,ZENTRALFRIEDHOF ' + DIG], [sans(400), '那串零有多长，熵就差少']]],
  // six worlds: 左 : 右 = 2 : 2, W = 6 (glyph.ts drawSix)
  [T.boxes6, T.collapse + 8, [[mono(400), ':=2 '], [sans(400), '左右'], [latin(600, true), 'W=6 ']]],
  // ---- DOM cards (cards.tsx); lib Captions load their own faces when mounted
  [T.c3a, T.c3End, [[serif(600), '全在左边：种右各半'], [mono(700), '16']]],
  [T.c5, T.c5End, [[serif(600), '100个粒子全在左边：'], [serif(900), '约'], [latin(600), '1030'], [mono(400), DIG + '−.×= ']]],
  [T.c6, T.c6End, [[serif(600), '一杯水，约个分子——全挤到边的概率：'], [latin(600), '1025']]],
  [T.c10, T.c10End, [[serif(600), '聚回来，不是可能——只太。']]],
  [T.glyph + 6, T.formula + 8, [[latin(600, true), 'shāng']]],
  [T.c13, T.c13End, [[serif(600), '熵不是“乱”。它数的：多少种微观排列，看起来一模样']]],
];

/** the font specs needed around frame f (±3 frames), merged per face */
export function fontsAt(f: number): Spec[] {
  const byFace = new Map<string, Set<string>>();
  for (const [a, b, specs] of WINDOWS) {
    if (f < a - 3 || f > b + 3) continue;
    for (const [face, text] of specs) {
      let set = byFace.get(face);
      if (!set) byFace.set(face, (set = new Set()));
      for (const ch of Array.from(text)) set.add(ch);
    }
  }
  const out: Spec[] = [];
  for (const [face, set] of byFace) out.push([face, Array.from(set).sort().join('')]);
  out.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return out;
}

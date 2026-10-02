// S04 HUD: the S-gauge (film motif; red + jitter while falling = rewind), the ◀◀ rewind readout with its
// compression factor, the monumental year counter (1天 → 1亿年 → 138亿年), small labels.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT } from '../../lib/fonts';
import { COLOR } from '../../lib/handoff';
import { clamp, ease, hexToRgb, lerp, mixHex, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { T } from './timing';
import { useLazyFonts } from './fontGate';

// ───────────────────────── S-gauge (local: per-tick CJK subscripts, any colour) ─────────────────────────
export interface Tick {
  value: number;
  sub?: string;
  color?: string;
  falling?: boolean;
  opacity?: number;
}
export const Gauge: React.FC<{ ticks: Tick[]; color: string; opacity: number; x?: number; y0?: number; y1?: number }> = ({ ticks, color, opacity, x = 64, y0 = 560, y1 = 1360 }) => {
  const frame = useCurrentFrame();
  useLazyFonts(
    [
      [`italic 600 30px ${FONT.latin}`, 'S'],
      [`400 20px ${FONT.sans}`, '宇宙墨↓'],
    ],
    opacity > 0.003,
  );
  if (opacity <= 0.003) return null;
  const [r, g, b] = hexToRgb(color);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: x, top: y0, width: 1, height: y1 - y0, background: `linear-gradient(to top, rgba(${r},${g},${b},0.18), rgba(${r},${g},${b},0.6))` }} />
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x - 3, top: y0 + ((y1 - y0) * i) / 8, width: 7, height: 1, background: `rgba(${r},${g},${b},0.4)` }} />
      ))}
      {ticks.map((t, i) => {
        if ((t.opacity ?? 1) <= 0.003) return null;
        const jit = t.falling ? (hash01(frame * 3 + i, 91) - 0.5) * 10 : 0;
        const yy = y1 - (y1 - y0) * clamp(t.value) + jit;
        const c = t.falling ? COLOR.alarmRed : t.color ?? color;
        return (
          <div key={i} style={{ opacity: t.opacity ?? 1 }}>
            <div style={{ position: 'absolute', left: x - 9, top: yy - 1, width: 19, height: 2, background: c, boxShadow: `0 0 8px ${c}` }} />
            <div style={{ position: 'absolute', left: x + 16, top: yy - 21, fontFamily: FONT.latin, fontStyle: 'italic', fontWeight: 600, fontSize: 30, color: c, whiteSpace: 'nowrap' }}>
              S
              {t.sub ? <span style={{ fontFamily: FONT.sans, fontStyle: 'normal', fontWeight: 400, fontSize: 19, marginLeft: 2, position: 'relative', top: 6 }}>{t.sub}</span> : null}
              {t.falling ? <span style={{ fontFamily: FONT.mono, fontStyle: 'normal', fontSize: 20, marginLeft: 6 }}>↓</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── the cosmic clock: look-back time, LOCKED to what the cosmos shows ─────────────────────────
// 1天 → 1亿年 (log, f170–196): nothing changes on cosmic scales, only the time-compression streaks · 1亿 → 100亿年:
// space contracts, galaxies converge, the merger un-merges · 100 → 136亿年: stars un-light, galaxies dissolve ·
// 136 → 137亿年: the dark ages · 137 → 138亿年: the heat surge into plasma (recombination is 137.996亿年 ago).
const L_DAY = 1 / 365.25;
/** monotone cubic (Fritsch–Carlson) through [frame, 亿年] knots — no overshoot, so the counter never runs back */
const KNOTS: ReadonlyArray<readonly [number, number]> = [
  [T.counterLog[1], 1],
  [210, 20],
  [220, 50],
  [230, 95], // ≈ cosmic noon: the stars start to un-light (T.unIgnite from f228)
  [242, 124],
  [T.unIgnite[1], 136], // the last stars are out
  [264, 137], // the dark ages
  [T.slam, 138], // the heat surge → the floor of time (recombination is 137.996亿年 ago)
];
const knotSlopes: number[] = (() => {
  const n = KNOTS.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((KNOTS[i + 1][1] - KNOTS[i][1]) / (KNOTS[i + 1][0] - KNOTS[i][0]));
  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) continue;
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return m;
})();
function knotYi(f: number): number {
  const n = KNOTS.length;
  if (f <= KNOTS[0][0]) return KNOTS[0][1];
  if (f >= KNOTS[n - 1][0]) return KNOTS[n - 1][1];
  let i = 0;
  while (f > KNOTS[i + 1][0]) i++;
  const [x0, y0] = KNOTS[i],
    [x1, y1] = KNOTS[i + 1];
  const h = x1 - x0,
    t = (f - x0) / h,
    t2 = t * t,
    t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * knotSlopes[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * knotSlopes[i + 1];
}
/** look-back time in years shown by the monumental counter */
export function lookback(f: number): number {
  const [a, b] = T.counterLog;
  if (f <= a) return L_DAY;
  if (f < b) return Math.pow(10, lerp(Math.log10(L_DAY), 8, ease.inOutSine(seg(f, a, b))));
  return 1e8 * knotYi(f);
}
const UNITS: Array<[number, number, string]> = [
  // [from years, divisor, unit]
  [1e8, 1e8, '亿年'],
  [1e4, 1e4, '万年'],
  [1, 1, '年'],
  [0, L_DAY, '天'],
];
export function counterReadout(f: number): { v: number; unit: string; div: number } {
  if (f >= T.slam) return { v: 138, unit: '亿年', div: 1e8 };
  const y = lookback(f);
  for (const [from, div, unit] of UNITS) if (y >= from * 0.99999) return { v: Math.max(1, y / div), unit, div };
  return { v: 1, unit: '天', div: L_DAY };
}
/** time-compression factor (look-back seconds per screen second) as log10 — monotonic during the run */
export function compressionLog(f: number): number {
  const s = Math.max(0.2, (f - T.counterOn) / 30);
  return Math.log10(lookback(f) * 3.156e7) - Math.log10(s);
}

const Sup: React.FC<{ e: string }> = ({ e }) => <span style={{ fontSize: '0.6em', position: 'relative', top: '-0.75em', marginLeft: '0.04em' }}>{e}</span>;

/** ◀◀ readout at the HUD lane: rewind glyph + compression factor (chromatic aberration while tampering). */
export const RewindHud: React.FC<{ opacity: number; text?: string; speedExp?: number | null; tamper: boolean; color?: string }> = ({ opacity, text, speedExp, tamper, color = COLOR.voice }) => {
  const frame = useCurrentFrame();
  useLazyFonts(
    [
      [`400 30px ${FONT.mono}`, '◀×0123456789亿年'],
      [`400 30px ${FONT.sans}`, '◀亿年'],
    ],
    opacity > 0.003,
  );
  if (opacity <= 0.003) return null;
  const split = tamper ? 2 + 2.5 * hash01(frame, 77) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        top: 238,
        fontFamily: FONT.mono,
        fontSize: 30,
        letterSpacing: '0.12em',
        color,
        opacity,
        whiteSpace: 'pre',
        fontVariantNumeric: 'tabular-nums',
        textShadow: split > 0 ? `${split.toFixed(1)}px 0 rgba(255,40,80,0.75), ${(-split).toFixed(1)}px 0 rgba(40,220,255,0.75)` : '0 0 14px rgba(0,0,0,0.6)',
      }}
    >
      ◀◀
      {speedExp != null ? (
        <span>
          {'  ×10'}
          <Sup e={String(speedExp)} />
        </span>
      ) : null}
      {text ? <span>{'  ' + text}</span> : null}
    </div>
  );
};

// ───────────────────────── the monumental odometer ─────────────────────────
// No CSS blur and no clipping window at all (a blurred or half-clipped digit reads as a broken glyph in a still):
// every glyph on screen is whole. A column that changes faster than ~0.45 digits/frame is a spinning wheel: its
// current digit + a short vertical smear (ghost copies along the roll direction) + faint neighbours. A slow column
// FLIPS: the old digit lifts 0.3 em and fades while the new one rises into place from 0.3 em below (2–4 frames,
// snapped in the last 38 % of the units wheel's cycle, carrying the higher wheels with it).
const LH = 1.05; // line box (em)
const Column: React.FC<{ d: number; r: number; speed: number; size: number; shadow: string }> = ({ d, r, speed, size, shadow }) => {
  const h = size * LH;
  const kids: React.ReactNode[] = [];
  // only the main glyphs carry the (blurred) shadow — ghost copies are plain: text-shadow is the costly part here
  const put = (txt: number, y: number, a: number, k: string, main = false) => {
    if (a < 0.01) return;
    kids.push(
      <div key={k} style={{ position: 'absolute', left: 0, right: 0, top: y, height: h, lineHeight: `${h}px`, textAlign: 'center', opacity: a, textShadow: main ? shadow : 'none' }}>
        {txt}
      </div>,
    );
  };
  if (speed > 0.45) {
    // spinning: the current digit, a vertical smear of itself, faint neighbours entering / leaving
    const s = clamp((speed - 0.45) / 1.2);
    put(d, 0, 1, 'c', true);
    put(d, -0.06 * h, 0.26 + 0.16 * s, 'u');
    put(d, 0.06 * h, 0.26 + 0.16 * s, 'v');
    put((d + 9) % 10, -0.5 * h, 0.06 + 0.1 * s, 'p');
    put((d + 1) % 10, 0.5 * h, 0.06 + 0.1 * s, 'n');
  } else if (r <= 0.001) {
    put(d, 0, 1, 'a', true);
  } else {
    const lift = 0.3 * h;
    put(d, -r * lift, Math.pow(1 - r, 1.6), 'a', true);
    put((d + 1) % 10, (1 - r) * lift, Math.pow(r, 0.8), 'b', true);
  }
  return <span style={{ display: 'inline-block', position: 'relative', width: '0.56em', height: h, verticalAlign: 'top' }}>{kids}</span>;
};

/** Counter top lane: digit centre line (px) */
const CY = 470;
/** The monumental look-back counter (top lane): rolling Cormorant numerals + a serif unit; right edge of the number
 *  fixed at x = 600. Lands on 138亿年 with the slam, then flies into the ◀◀ HUD. */
export const Counter: React.FC<{ f: number; dark?: number }> = ({ f, dark = 0 }) => {
  useLazyFonts(
    [
      [`600 200px ${FONT.latin}`, '0123456789'],
      [`600 84px ${FONT.serif}`, '天年万亿'],
    ],
    f >= T.counterOn - 10 && f < T.counterFly[1],
  );
  const on = seg(f, T.counterOn, T.counterOn + 8);
  const fly = ease.inOutCubic(seg(f, T.counterFly[0], T.counterFly[1]));
  if (on <= 0 || fly >= 1) return null;
  const { v, unit, div } = counterReadout(f);
  const vPrev = f > T.counterOn ? lookback(f - 1) / div : v;
  const dv = f < T.slam ? Math.abs(v - vPrev) : 0;
  const size = 200;
  const N = Math.floor(v + 1e-9);
  const n = Math.max(1, String(N).length);
  const fr = v - N;
  const click = f >= T.slam ? 0 : clamp((fr - 0.62) / 0.38);
  const slow0 = dv <= 0.45;
  const tamper = f < T.slam;
  const split = tamper ? 2.5 + 2.5 * hash01(f, 71) : 0;
  const col = mixHex('#FFF3DC', '#24120A', dark);
  const sh = dark > 0.5 ? `rgba(255,236,205,${(0.5 * dark).toFixed(3)})` : `rgba(2,3,10,${(0.6 * (1 - dark)).toFixed(3)})`;
  const shadow = `${split.toFixed(1)}px 0 rgba(255,40,80,0.5), ${(-split).toFixed(1)}px 0 rgba(40,220,255,0.5), 0 0 36px ${sh}`;
  const cols: React.ReactNode[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    const d = Math.floor(N / p) % 10;
    const speed = dv / p;
    let r = 0;
    if (speed <= 0.45) {
      if (i === 0) r = click;
      else if (slow0) r = N % p === p - 1 ? click : 0;
      else r = clamp(((v / p) % 1) * 10 - 9);
    }
    cols.push(<Column key={i} d={d} r={ease.inOutQuad(r)} speed={speed} size={size} shadow={shadow} />);
  }
  // slam on the floor of time
  const ks = seg(f, T.slam, T.slam + 10);
  const slam = f >= T.slam ? 1 + 0.12 * Math.exp(-ks * 4) * Math.cos(ks * 9) : 1;
  const ox = lerp(0, 90 + 120 - 600, fly);
  const oy = lerp(0, 262 - CY, fly);
  const sc = lerp(1, 0.16, fly) * slam;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: CY,
        width: 600,
        height: 0,
        opacity: on * (1 - seg(f, T.counterFly[0] + 10, T.counterFly[1])),
        transform: `translate(${ox}px, ${oy}px) scale(${sc.toFixed(4)})`,
        transformOrigin: '600px 0px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: -size * LH * 0.5 - 18,
          fontFamily: FONT.latin,
          fontWeight: 600,
          fontSize: size,
          lineHeight: LH,
          color: col,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums lining-nums',
          display: 'flex',
        }}
      >
        {cols}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 620,
          top: -52,
          fontFamily: FONT.serif,
          fontWeight: 600,
          fontSize: 84,
          letterSpacing: '0.06em',
          color: col,
          whiteSpace: 'nowrap',
          textShadow: `0 0 26px ${sh}`,
        }}
      >
        {unit}
      </div>
    </div>
  );
};

/** small HUD label (Sans for Chinese, mono for Latin) */
export const Label: React.FC<{ text: React.ReactNode; x: number; y: number; opacity: number; color?: string; size?: number; font?: keyof typeof FONT; align?: 'left' | 'right' | 'center'; spacing?: number; raw?: string }> = ({
  text,
  x,
  y,
  opacity,
  color = COLOR.voice,
  size = 28,
  font = 'sans',
  align = 'left',
  spacing = 0.18,
  raw = '',
}) => {
  useLazyFonts([[`400 ${size}px ${FONT[font]}`, raw || (typeof text === 'string' ? text : '0')]], opacity > 0.003);
  if (opacity <= 0.003) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'left' ? x : align === 'center' ? x - 400 : undefined,
        right: align === 'right' ? 1080 - x : undefined,
        width: align === 'center' ? 800 : undefined,
        textAlign: align,
        top: y,
        fontFamily: FONT[font],
        fontSize: size,
        letterSpacing: `${spacing}em`,
        color,
        opacity,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};
export { Sup };

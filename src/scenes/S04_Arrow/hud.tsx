// S04 HUD: the S-gauge (film motif; red + jitter while falling = rewind), the ◀◀ rewind readout with its
// compression factor, the monumental year counter (1天 → 1亿年 → 138亿年), small labels.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { COLOR } from '../../lib/handoff';
import { clamp, ease, hexToRgb, lerp, mixHex, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { T } from './timing';

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
  useFontsReady([
    [`italic 600 30px ${FONT.latin}`, 'S'],
    [`400 20px ${FONT.sans}`, '宇宙墨↓'],
  ]);
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

// ───────────────────────── the cosmic clock (log of the look-back time) ─────────────────────────
const L0 = Math.log10(1 / 365.25);
const L1 = Math.log10(1.38e10);
/** log10(look-back years) of the monumental counter */
export function lookbackLog(f: number): number {
  return lerp(L0, L1, ease.inOutQuad(seg(f, T.counterRamp[0], T.counterRamp[1])));
}
export function counterReadout(f: number): { v: number; unit: string } {
  const y = Math.pow(10, lookbackLog(f));
  if (f >= T.counterRamp[1]) return { v: 138, unit: '亿年' };
  if (y < 1) return { v: Math.max(1, y * 365.25), unit: '天' };
  if (y < 1e4) return { v: y, unit: '年' };
  if (y < 1e8) return { v: y / 1e4, unit: '万年' };
  return { v: y / 1e8, unit: '亿年' };
}
/** time-compression factor (screen second → years) as log10, monotonic during the ramp */
export function compressionLog(f: number): number {
  const s = Math.max(0.2, (f - T.counterOn) / 30);
  return lookbackLog(f) + Math.log10(3.156e7) - Math.log10(s);
}

const Sup: React.FC<{ e: string }> = ({ e }) => <span style={{ fontSize: '0.6em', position: 'relative', top: '-0.75em', marginLeft: '0.04em' }}>{e}</span>;

/** ◀◀ readout at the HUD lane: rewind glyph + compression factor (chromatic aberration while tampering). */
export const RewindHud: React.FC<{ opacity: number; text?: string; speedExp?: number | null; tamper: boolean; color?: string }> = ({ opacity, text, speedExp, tamper, color = COLOR.voice }) => {
  const frame = useCurrentFrame();
  useFontsReady([
    [`400 30px ${FONT.mono}`, '◀×0123456789亿年'],
    [`400 30px ${FONT.sans}`, '◀亿年'],
  ]);
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

/** One rolling digit column (the odometer grammar). `r` = roll progress 0..1 to the next digit. */
const Digit: React.FC<{ d: number; r: number; size: number }> = ({ d, r, size }) => {
  const blur = Math.sin(r * Math.PI) * size * 0.06;
  return (
    <span style={{ display: 'inline-block', position: 'relative', height: size * 1.05, overflow: 'hidden', width: '0.56em', verticalAlign: 'top' }}>
      <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', top: -r * size * 1.05, filter: blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
        <div style={{ height: size * 1.05 }}>{d}</div>
        <div style={{ height: size * 1.05 }}>{(d + 1) % 10}</div>
      </span>
    </span>
  );
};

/** The monumental look-back counter: rolling Cormorant numerals + a serif unit. Right edge of the number fixed. */
export const Counter: React.FC<{ f: number; dark?: number }> = ({ f, dark = 0 }) => {
  useFontsReady([
    [`600 200px ${FONT.latin}`, '0123456789'],
    [`600 84px ${FONT.serif}`, '天年万亿'],
  ]);
  const on = seg(f, T.counterOn, T.counterOn + 10);
  const fly = ease.inOutCubic(seg(f, T.counterFly[0], T.counterFly[1]));
  if (on <= 0 || fly >= 1) return null;
  const { v, unit } = counterReadout(f);
  const size = 200;
  const n = Math.max(1, Math.floor(Math.log10(Math.max(1, v + 1e-9))) + 1);
  const cols: React.ReactNode[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    const d = Math.floor(v / p) % 10;
    const lower = v % p;
    const fr = v % 1;
    const click = clamp((fr - 0.62) / 0.38); // the last digit clicks over (odometer), it does not drift
    const roll = i === 0 ? (f >= T.counterRamp[1] ? 0 : click) : clamp(lower - (p - 1) + (click - fr));
    cols.push(<Digit key={i} d={d} r={ease.inOutQuad(roll)} size={size} />);
  }
  // slam on the floor of time
  const ks = seg(f, T.slam, T.slam + 10);
  const slam = f >= T.slam ? 1 + 0.12 * Math.exp(-ks * 4) * Math.cos(ks * 9) : 1;
  const tamper = f < T.slam;
  const split = tamper ? 3 + 3 * hash01(f, 71) : 0;
  const ox = lerp(0, 90 + 120 - 600, fly);
  const oy = lerp(0, 262 - 1450, fly);
  const sc = lerp(1, 0.16, fly) * slam;
  const col = mixHex('#FFF3DC', '#24120A', dark);
  const sh = dark > 0.5 ? 'rgba(255,240,215,0.55)' : 'rgba(0,0,0,0.55)';
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 1450,
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
          top: -size * 0.62,
          fontFamily: FONT.latin,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1.05,
          color: col,
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums lining-nums',
          textShadow: `${split.toFixed(1)}px 0 rgba(255,40,80,0.55), ${(-split).toFixed(1)}px 0 rgba(40,220,255,0.55), 0 0 40px ${sh}`,
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
          textShadow: `0 0 30px ${sh}`,
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
  useFontsReady([[`400 ${size}px ${FONT[font]}`, raw || (typeof text === 'string' ? text : '0')]]);
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

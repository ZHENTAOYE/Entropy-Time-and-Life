// Film-wide HUD vocabulary: timecode (◀◀ / ▶▶ / ✕), odometer, S-gauge (entropy meter), scientific numbers.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from './fonts';
import { COLOR } from './handoff';
import { clamp, ease, hexToRgb, seg } from './math';
import { hash01 } from './random';

/** Scientific number with a properly raised exponent (no reliance on superscript glyphs). */
export const Sci: React.FC<{
  mant?: string; // e.g. '7.9×' or '' ; base is appended
  base?: string; // default '10'
  exp: string; // e.g. '-30' (ASCII minus is converted to U+2212)
  size: number;
  font?: keyof typeof FONT;
  weight?: number;
  color?: string;
  italic?: boolean;
  style?: React.CSSProperties;
}> = ({ mant = '', base = '10', exp, size, font = 'latin', weight = 600, color = COLOR.voice, italic = false, style }) => {
  const e = exp.replace(/-/g, '−');
  useFontsReady([[`${weight} ${size}px ${FONT[font]}`, mant + base + e]]);
  return (
    <span style={{ fontFamily: FONT[font], fontSize: size, fontWeight: weight, color, fontStyle: italic ? 'italic' : 'normal', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums lining-nums', ...style }}>
      {mant}
      {base}
      <span style={{ fontSize: '0.55em', position: 'relative', top: '-0.85em', marginLeft: '0.04em' }}>{e}</span>
    </span>
  );
};

export type TimecodeMode = 'rewind' | 'ff' | 'play' | 'pause' | 'fail';

/**
 * Mono timecode at the HUD lane (default x=90, y=250): `◀◀ ×12  00:00:09:28`.
 * Chromatic aberration is applied automatically for rewind / ff (time is being tampered with).
 */
export const Timecode: React.FC<{
  mode: TimecodeMode;
  /** seconds shown in the timecode (can be anything, e.g. scene-local time remapped) */
  seconds?: number;
  /** free-form speed label, e.g. '×12', '×10¹⁰⁰' */
  speed?: string;
  /** replaces the clock (e.g. '−138亿年') */
  text?: string;
  x?: number;
  y?: number;
  size?: number;
  opacity?: number;
  color?: string;
}> = ({ mode, seconds = 0, speed = '', text, x = 90, y = 250, size = 28, opacity = 1, color = COLOR.voice }) => {
  const frame = useCurrentFrame();
  const glyph = mode === 'rewind' ? '◀◀' : mode === 'ff' ? '▶▶' : mode === 'play' ? '▶' : mode === 'pause' ? '❚❚' : '✕';
  const s = Math.max(0, seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ff = Math.floor((s % 1) * 30);
  const clock = text ?? [hh, mm, ss, ff].map((v) => String(v).padStart(2, '0')).join(':');
  const tamper = mode === 'rewind' || mode === 'ff';
  const split = tamper ? 2 + 2 * hash01(frame, 77) : 0;
  const blinkOn = mode === 'pause' || mode === 'fail' ? Math.floor(frame / 15) % 2 === 0 : true;
  const c = mode === 'fail' ? COLOR.alarmRed : color;
  const label = `${glyph}${speed ? ' ' + speed : ''}  ${clock}`;
  useFontsReady([[`400 ${size}px ${FONT.mono}`, label + '❚✕']]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        fontFamily: FONT.mono,
        fontSize: size,
        letterSpacing: '0.12em',
        color: c,
        opacity: opacity * (blinkOn ? 1 : 0.25),
        whiteSpace: 'pre',
        fontVariantNumeric: 'tabular-nums',
        textShadow: split > 0 ? `${split}px 0 rgba(255,40,80,0.75), ${-split}px 0 rgba(40,220,255,0.75)` : undefined,
      }}
    >
      {label}
    </div>
  );
};

/**
 * Rolling odometer for numbers (digits roll vertically with motion blur when they change).
 * `value` may be fractional: the last digit rolls continuously.
 */
export const Odometer: React.FC<{
  value: number;
  digits?: number;
  x: number;
  y: number;
  size?: number;
  color?: string;
  font?: keyof typeof FONT;
  prefix?: string;
  suffix?: string;
  align?: 'left' | 'right';
}> = ({ value, digits, x, y, size = 64, color = COLOR.voice, font = 'mono', prefix = '', suffix = '', align = 'left' }) => {
  useFontsReady([[`400 ${size}px ${FONT[font]}`, '0123456789' + prefix + suffix]]);
  const v = Math.max(0, value);
  const n = digits ?? Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1);
  const cols: React.ReactNode[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    const d = Math.floor(v / p) % 10;
    // odometer carry: digit i rolls only while all lower digits are passing 9 → 0
    const lower = v % p;
    const roll = i === 0 ? v % 1 : clamp((lower - (p - 1)) / 1);
    const r = ease.inOutQuad(roll);
    const blur = Math.sin(r * Math.PI) * size * 0.08;
    cols.push(
      <span key={i} style={{ display: 'inline-block', position: 'relative', height: size * 1.1, overflow: 'hidden', width: '0.62em' }}>
        <span style={{ position: 'absolute', left: 0, top: -r * size * 1.1, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
          <div style={{ height: size * 1.1 }}>{d}</div>
          <div style={{ height: size * 1.1 }}>{(d + 1) % 10}</div>
        </span>
      </span>,
    );
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'left' ? x : undefined,
        right: align === 'right' ? 1080 - x : undefined,
        top: y,
        fontFamily: FONT[font],
        fontSize: size,
        lineHeight: 1.1,
        color,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        display: 'flex',
        alignItems: 'flex-start',
      }}
    >
      {prefix ? <span>{prefix}</span> : null}
      {cols}
      {suffix ? <span>{suffix}</span> : null}
    </div>
  );
};

/**
 * The S-gauge: a hairline entropy meter at the left edge (x≈64, y 560→1360; bottom = low S, top = high S).
 * Rising is normal. Pass `falling` (fakes / rewinds) to render it alarm-red with jitter.
 * Extra `ticks` let a scene show several entropies (e.g. S身体 flat vs S宇宙 rising).
 */
export const SGauge: React.FC<{
  value: number; // 0..1
  falling?: boolean;
  opacity?: number;
  x?: number;
  y0?: number;
  y1?: number;
  color?: string;
  label?: string;
  ticks?: Array<{ value: number; label: string; color?: string; falling?: boolean }>;
}> = ({ value, falling = false, opacity = 1, x = 64, y0 = 560, y1 = 1360, color = COLOR.voice, label = 'S', ticks }) => {
  const frame = useCurrentFrame();
  useFontsReady([[`italic 600 30px ${FONT.latin}`, 'S' + (ticks?.map((t) => t.label).join('') ?? '')]]);
  if (opacity <= 0.001) return null;
  const all = ticks ?? [{ value, label, color, falling }];
  const [r, g, b] = hexToRgb(color);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: x, top: y0, width: 1, height: y1 - y0, background: `linear-gradient(to top, rgba(${r},${g},${b},0.15), rgba(${r},${g},${b},0.55))` }} />
      {/* scale ticks */}
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: x - 3, top: y0 + ((y1 - y0) * i) / 8, width: 7, height: 1, background: `rgba(${r},${g},${b},0.35)` }} />
      ))}
      {all.map((t, i) => {
        const jit = t.falling ? (hash01(frame * 3 + i, 91) - 0.5) * 10 : 0;
        const yy = y1 - (y1 - y0) * clamp(t.value) + jit;
        const c = t.falling ? COLOR.alarmRed : t.color ?? color;
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: x - 9, top: yy - 1, width: 19, height: 2, background: c, boxShadow: `0 0 8px ${c}` }} />
            <div style={{ position: 'absolute', left: x + 16, top: yy - 19, fontFamily: FONT.latin, fontStyle: 'italic', fontWeight: 600, fontSize: 30, color: c, whiteSpace: 'nowrap' }}>
              {t.label}
              {t.falling ? <span style={{ fontFamily: FONT.mono, fontStyle: 'normal', fontSize: 20, marginLeft: 6 }}>↓</span> : null}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Convenience: 0..1 progress mapped through a window, for HUD fades. */
export const hudFade = (frame: number, a: number, b: number, len = 8) => Math.min(seg(frame, a, a + len), 1 - seg(frame, b - len, b));

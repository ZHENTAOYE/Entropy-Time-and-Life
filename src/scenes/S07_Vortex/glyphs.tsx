// Glyph-level typography for S07's special cards. Each glyph is an absolutely positioned span whose x position
// comes from canvas measureText (so canvas-drawn glyphs — e.g. the particle word 过程 — line up exactly).
// Enter/exit follow the film's narration grammar: CONDENSE out of blur, DIFFUSE apart in random order.
import React from 'react';
import { FONT } from '../../lib/fonts';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';

export interface GlyphPos {
  ch: string;
  x: number; // left edge
  w: number; // advance
}

let mctx: CanvasRenderingContext2D | null = null;
/** Measure a line (call only once fonts are loaded). Centred on cx, letter-spacing in em. */
export function layoutLine(text: string, css: string, size: number, ls: number, cx: number): GlyphPos[] {
  return memo(`s07:lay:${css}:${ls}:${cx}:${text}`, () => {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d')!;
    mctx.font = css;
    const chars = Array.from(text);
    const ws = chars.map((ch) => mctx!.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0) + ls * size * (chars.length - 1);
    let x = cx - total / 2;
    return chars.map((ch, i) => {
      const g = { ch, x, w: ws[i] };
      x += ws[i] + ls * size;
      return g;
    });
  });
}

export interface GlyphAnim {
  /** local frame within the card */
  local: number;
  /** enter start (local) */
  t0: number;
  enterLen?: number;
  /** exit start (local); Infinity = no exit */
  exitStart: number;
  exitLen?: number;
  seed: number;
  idx: number;
  enter?: 'condense' | 'fade' | 'type' | 'none';
  exit?: 'diffuse' | 'fade' | 'none';
}

export interface GlyphXform {
  dx: number;
  dy: number;
  op: number;
  blur: number;
  sc: number;
  rot: number;
}

/** The film's condense / diffuse per-glyph transform (same constants as lib/Caption). */
export function glyphXform(a: GlyphAnim): GlyphXform {
  const { local, t0, enterLen = 18, exitStart, exitLen = 26, seed, idx, enter = 'condense', exit = 'diffuse' } = a;
  const r1 = hash01(idx, seed);
  const r2 = hash01(idx + 1000, seed);
  const r3 = hash01(idx + 2000, seed);
  const r4 = hash01(idx + 3000, seed);
  const x: GlyphXform = { dx: 0, dy: 0, op: 1, blur: 0, sc: 1, rot: 0 };
  const pe = seg(local, t0, t0 + enterLen);
  if (enter === 'condense') {
    const e = ease.outCubic(pe);
    const ang = r2 * Math.PI * 2;
    const R = 26 + r3 * 34;
    x.dx += Math.cos(ang) * R * (1 - e);
    x.dy += Math.sin(ang) * R * (1 - e);
    x.blur += (1 - e) * 14;
    x.sc *= 1 + (1 - e) * 0.35;
    x.op *= ease.outQuad(pe);
  } else if (enter === 'fade') {
    x.op *= ease.inOutQuad(pe);
  } else if (enter === 'type') {
    x.op *= local >= t0 ? 1 : 0;
  }
  if (local >= exitStart && exit !== 'none') {
    if (exit === 'diffuse') {
      const d0 = exitStart + r4 * exitLen * 0.45;
      const q = seg(local, d0, d0 + exitLen * 0.55);
      const e = ease.inQuad(q);
      const ang = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
      const R = 50 + r1 * 110;
      x.dx += Math.cos(ang) * R * e + Math.sin(local * 0.6 + r1 * 20) * 6 * e;
      x.dy += Math.sin(ang) * R * e + Math.cos(local * 0.5 + r2 * 20) * 6 * e - 20 * e;
      x.blur += e * 16;
      x.rot += (r3 - 0.5) * 70 * e;
      x.sc *= 1 + e * 0.25;
      x.op *= 1 - ease.inCubic(q);
    } else {
      x.op *= 1 - ease.inOutQuad(seg(local, exitStart, exitStart + exitLen));
    }
  }
  return x;
}

export const Glyph: React.FC<{
  ch: string;
  x: number;
  y: number;
  size: number;
  family?: keyof typeof FONT;
  weight: number;
  color: string;
  xf: GlyphXform;
  style?: React.CSSProperties;
  shadow?: boolean;
  glow?: number;
}> = ({ ch, x, y, size, family = 'serif', weight, color, xf, style, shadow, glow = 0 }) => {
  if (xf.op <= 0.003) return null;
  const shadows: string[] = [];
  if (glow > 0) shadows.push(`0 0 ${Math.round(size * 0.35 * glow)}px ${color}`);
  if (shadow) shadows.push(`0 2px ${Math.round(size * 0.5)}px rgba(0,0,0,0.85)`, `0 0 ${Math.round(size * 0.2)}px rgba(0,0,0,0.7)`);
  return (
    <span
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height: size,
        lineHeight: `${size}px`,
        marginTop: -size / 2,
        fontFamily: FONT[family],
        fontSize: size,
        fontWeight: weight,
        color,
        whiteSpace: 'pre',
        opacity: clamp(xf.op),
        transform: `translate(${xf.dx.toFixed(2)}px, ${xf.dy.toFixed(2)}px) rotate(${xf.rot.toFixed(2)}deg) scale(${xf.sc.toFixed(3)})`,
        filter: xf.blur > 0.15 ? `blur(${xf.blur.toFixed(2)}px)` : undefined,
        textShadow: shadows.length ? shadows.join(',') : undefined,
        ...style,
      }}
    >
      {ch}
    </span>
  );
};

/**
 * A soft dark scrim behind a caption block (one gradient instead of per-glyph blurred text-shadows, which are
 * re-rasterised every frame and cost as much as the whole particle layer in the headless renderer).
 */
export const Scrim: React.FC<{ frame: number; from: number; dur: number; y: number; w?: number; h?: number; strength?: number; color?: string }> = ({
  frame,
  from,
  dur,
  y,
  w = 1000,
  h = 300,
  strength = 0.5,
  color = '3,2,10',
}) => {
  const local = frame - from;
  if (local < 0 || local >= dur) return null;
  const a = Math.min(seg(local, 0, 12), 1 - seg(local, dur - 16, dur)) * strength;
  if (a <= 0.002) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(${color},${a.toFixed(3)}) 0%, rgba(${color},${(a * 0.7).toFixed(3)}) 45%, rgba(${color},0) 100%)`,
        pointerEvents: 'none',
      }}
    />
  );
};

// Glyph-level typography for S03's special cards (colon-aligned numerals, the monumental exponent, the mirror-aligned
// golden line, the strike-through). Same grammar as lib/Caption: glyphs CONDENSE out of blur and leave by DIFFUSING.
// Layout is measured with canvas metrics so baselines and columns align exactly.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT } from '../../lib/fonts';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';

export interface GItem {
  ch: string;
  x: number; // left edge
  y: number; // alphabetic baseline
  family: keyof typeof FONT;
  size: number;
  weight: number;
  color: string;
  italic?: boolean;
  /** extra enter delay (frames) */
  delay?: number;
  glow?: number;
  /** per-frame override hook */
  fx?: (local: number) => { color?: string; opacity?: number; dx?: number; dy?: number; scale?: number; blur?: number } | undefined;
}

const fontStr = (g: { family: keyof typeof FONT; size: number; weight: number; italic?: boolean }) => `${g.italic ? 'italic ' : ''}${g.weight} ${g.size}px ${FONT[g.family]}`;

function mctx(): CanvasRenderingContext2D {
  return memo('S03:measureCtx', () => document.createElement('canvas').getContext('2d')!);
}
/** advance width of `ch` (cached per font, only valid once fonts are loaded — callers gate on `ready`) */
export function adv(family: keyof typeof FONT, size: number, weight: number, ch: string, italic = false): number {
  const c = mctx();
  c.font = fontStr({ family, size, weight, italic });
  return c.measureText(ch).width;
}
function asc(family: keyof typeof FONT, size: number, weight: number, italic = false): [number, number] {
  const c = mctx();
  c.font = fontStr({ family, size, weight, italic });
  const m = c.measureText('国Hg');
  return [m.fontBoundingBoxAscent, m.fontBoundingBoxDescent];
}

export interface RunSpec {
  t: string;
  family?: keyof typeof FONT;
  size?: number;
  weight?: number;
  color?: string;
  italic?: boolean;
  /** raise (px, positive = up) */
  rise?: number;
  /** tracking in em */
  tracking?: number;
  delay?: number;
  glow?: number;
  fx?: GItem['fx'];
}

/** Lay out runs on one baseline. Returns items and the total width; x is the left edge. */
export function layout(runs: RunSpec[], x: number, y: number, base: Required<Pick<RunSpec, 'family' | 'size' | 'weight' | 'color'>> & { tracking?: number }): { items: GItem[]; width: number } {
  const items: GItem[] = [];
  let cx = x;
  for (const r of runs) {
    const family = r.family ?? base.family;
    const size = r.size ?? base.size;
    const weight = r.weight ?? base.weight;
    const tr = (r.tracking ?? base.tracking ?? 0) * size;
    for (const ch of Array.from(r.t)) {
      const w = adv(family, size, weight, ch, r.italic);
      items.push({ ch, x: cx, y: y - (r.rise ?? 0), family, size, weight, color: r.color ?? base.color, italic: r.italic, delay: r.delay, glow: r.glow, fx: r.fx });
      cx += w + tr;
    }
  }
  return { items, width: cx - x };
}
export function width(runs: RunSpec[], base: Required<Pick<RunSpec, 'family' | 'size' | 'weight' | 'color'>> & { tracking?: number }): number {
  return layout(runs, 0, 0, base).width;
}
/** trailing tracking that `layout` adds after the last glyph (to centre visually) */
export const trail = (base: { size: number; tracking?: number }) => (base.tracking ?? 0) * base.size;

export interface GlyphsProps {
  items: GItem[];
  from: number;
  dur: number;
  enter?: 'condense' | 'slam' | 'fade' | 'type';
  exit?: 'diffuse' | 'fade' | 'none';
  enterLen?: number;
  exitLen?: number;
  stagger?: number;
  seed?: number;
  shadow?: boolean;
}

export const Glyphs: React.FC<GlyphsProps> = ({ items, from, dur, enter = 'condense', exit = 'diffuse', enterLen = 18, exitLen = 24, stagger = 2, seed = 7, shadow = false }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0 || local >= dur) return null;
  const exitStart = dur - exitLen;
  return (
    <>
      {items.map((g, idx) => {
        const r1 = hash01(idx, seed);
        const r2 = hash01(idx + 1000, seed);
        const r3 = hash01(idx + 2000, seed);
        const r4 = hash01(idx + 3000, seed);
        let op = 1;
        let dx = 0;
        let dy = 0;
        let blur = 0;
        let sc = 1;
        let rot = 0;
        const t0 = (g.delay ?? 0) + idx * stagger + r1 * stagger * 0.6;
        const pe = seg(local, t0, t0 + enterLen);
        if (enter === 'condense') {
          const e = ease.outCubic(pe);
          const a = r2 * Math.PI * 2;
          const R = (26 + r3 * 34) * Math.max(1, g.size / 90);
          dx += Math.cos(a) * R * (1 - e);
          dy += Math.sin(a) * R * (1 - e);
          blur += (1 - e) * 14 * Math.max(1, g.size / 120);
          sc *= 1 + (1 - e) * 0.35;
          op *= ease.outQuad(pe);
        } else if (enter === 'slam') {
          const e = ease.outCubic(pe);
          sc *= 1 + (1 - e) * 0.6;
          blur += (1 - e) * 22;
          op *= ease.outQuad(seg(local, t0, t0 + enterLen * 0.5));
        } else if (enter === 'fade') {
          op *= ease.inOutQuad(pe);
        } else if (enter === 'type') {
          op *= local >= t0 ? 1 : 0;
        }
        if (local >= exitStart && exit !== 'none') {
          if (exit === 'diffuse') {
            const d0 = exitStart + r4 * exitLen * 0.45;
            const q = seg(local, d0, d0 + exitLen * 0.55);
            const e = ease.inQuad(q);
            const a = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
            const R = (50 + r1 * 110) * Math.max(1, g.size / 110);
            dx += Math.cos(a) * R * e + Math.sin(local * 0.6 + r1 * 20) * 6 * e;
            dy += Math.sin(a) * R * e + Math.cos(local * 0.5 + r2 * 20) * 6 * e - 20 * e;
            blur += e * 16;
            rot += (r3 - 0.5) * 70 * e;
            sc *= 1 + e * 0.25;
            op *= 1 - ease.inCubic(q);
          } else {
            op *= 1 - ease.inOutQuad(seg(local, exitStart, dur));
          }
        }
        let color = g.color;
        const o = g.fx?.(local);
        if (o) {
          if (o.color) color = o.color;
          if (o.opacity !== undefined) op *= o.opacity;
          dx += o.dx ?? 0;
          dy += o.dy ?? 0;
          sc *= o.scale ?? 1;
          blur += o.blur ?? 0;
        }
        if (op <= 0.003) return null;
        const [A, D] = asc(g.family, g.size, g.weight, g.italic);
        const top = g.y - A;
        const shadows: string[] = [];
        if (g.glow) shadows.push(`0 0 ${Math.round(g.size * 0.3 * g.glow)}px ${color}`, `0 0 ${Math.round(g.size * 0.8 * g.glow)}px ${color}`);
        if (shadow) shadows.push(`0 2px ${Math.round(g.size * 0.45)}px rgba(0,0,0,0.85)`);
        return (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: g.x,
              top,
              height: A + D,
              lineHeight: `${A + D}px`,
              fontFamily: FONT[g.family],
              fontSize: g.size,
              fontWeight: g.weight,
              fontStyle: g.italic ? 'italic' : 'normal',
              color,
              whiteSpace: 'pre',
              opacity: clamp(op),
              transformOrigin: '50% 60%',
              transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`,
              filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
              textShadow: shadows.length ? shadows.join(',') : undefined,
              fontVariantNumeric: 'lining-nums tabular-nums',
            }}
          >
            {g.ch}
          </span>
        );
      })}
    </>
  );
};

// The narration voice, drawn into the scene canvas. Same grammar as lib/Caption: glyphs CONDENSE out of blur and
// leave by DIFFUSING (drifting apart in random order). S05 additions: the colour can change over the caption's life
// (the voice drains to grey as the universe does), two emphasis styles ({…} = holds its warmth, […] = drains first),
// per-line stagger, and a mask export so a caption can die by NOISE-DEATH instead (scatter.ts).
import { clamp, ease, seg } from '../../lib/math';
import { hash01, seedOf } from '../../lib/random';
import { rgbStr } from './gfx';

export type RGB = readonly [number, number, number];

export interface Cap {
  lines: string[];
  from: number;
  dur: number;
  font: string;
  size: number;
  x?: number;
  y?: number;
  /** base colour over local frame */
  color: (local: number) => RGB;
  /** colour of {…} runs */
  em?: (local: number) => RGB;
  /** colour of […] runs */
  em2?: (local: number) => RGB;
  stagger?: number;
  enterLen?: number;
  exitLen?: number;
  exit?: 'diffuse' | 'none';
  lineDelay?: number[];
  letterSpacing?: number;
  lineHeight?: number;
  /** soft dark backdrop strength (0 = none) */
  backdrop?: number;
  /** trailing punctuation that hangs outside the centring */
  hang?: string;
  /** soft luminous glow 0..1 */
  glow?: number;
}

interface Glyph {
  ch: string;
  style: 0 | 1 | 2;
  line: number;
  ci: number;
  gi: number;
  x: number;
  cy: number;
}

const layoutCache = new Map<string, { glyphs: Glyph[]; top: number; bottom: number; left: number; right: number }>();

export function layoutCap(ctx: CanvasRenderingContext2D, c: Cap) {
  const key = c.font + '|' + c.lines.join('\n') + '|' + (c.x ?? 540) + '|' + (c.y ?? 1440) + '|' + (c.letterSpacing ?? 0.08) + '|' + (c.hang ?? '');
  const hit = layoutCache.get(key);
  if (hit) return hit;
  ctx.save();
  ctx.font = c.font;
  const ls = (c.letterSpacing ?? 0.08) * c.size;
  const pitch = c.size * (c.lineHeight ?? 1.55);
  const n = c.lines.length;
  const y0 = (c.y ?? 1440) - ((n - 1) * pitch) / 2;
  const glyphs: Glyph[] = [];
  let gi = 0;
  let left = 1e9;
  let right = -1e9;
  c.lines.forEach((raw, li) => {
    const items: Array<{ ch: string; style: 0 | 1 | 2; w: number }> = [];
    let style: 0 | 1 | 2 = 0;
    for (const ch of Array.from(raw)) {
      if (ch === '{') style = 1;
      else if (ch === '[') style = 2;
      else if (ch === '}' || ch === ']') style = 0;
      else items.push({ ch, style, w: ctx.measureText(ch).width });
    }
    let total = 0;
    items.forEach((it, i) => (total += it.w + (i < items.length - 1 ? ls : 0)));
    // hanging trailing punctuation does not count for the centring
    let hangW = 0;
    if (c.hang) for (let i = items.length - 1; i >= 0 && c.hang.includes(items[i].ch); i--) hangW += items[i].w + ls;
    let x = (c.x ?? 540) - (total - hangW) / 2;
    left = Math.min(left, x);
    items.forEach((it, ci) => {
      glyphs.push({ ch: it.ch, style: it.style, line: li, ci, gi: gi++, x: x + it.w / 2, cy: y0 + li * pitch });
      x += it.w + ls;
    });
    right = Math.max(right, x);
  });
  ctx.restore();
  const out = { glyphs, top: y0 - c.size * 0.7, bottom: y0 + (n - 1) * pitch + c.size * 0.7, left, right };
  layoutCache.set(key, out);
  return out;
}

/** frame (local) at which every glyph has condensed */
export function capFormedAt(c: Cap): number {
  const st = c.stagger ?? 2;
  let m = 0;
  c.lines.forEach((l, li) => {
    const n = Array.from(l.replace(/[{}[\]]/g, '')).length;
    m = Math.max(m, (c.lineDelay?.[li] ?? 0) + (n - 1) * st + st * 0.6 + (c.enterLen ?? 18));
  });
  return m;
}

/** Draw a caption at scene frame f. `opacity` multiplies everything. */
export function drawCap(ctx: CanvasRenderingContext2D, c: Cap, f: number, opacity = 1) {
  const local = f - c.from;
  if (local < 0 || local >= c.dur) return;
  const L = layoutCap(ctx, c);
  const seed = seedOf(c.lines.join(''));
  const stagger = c.stagger ?? 2;
  const enterLen = c.enterLen ?? 18;
  const exitLen = c.exitLen ?? 26;
  const exitStart = c.dur - exitLen;
  const exit = c.exit ?? 'diffuse';
  ctx.save();
  // backdrop (a soft dark halo behind the block)
  if (c.backdrop) {
    const k = Math.min(seg(local, 0, enterLen + 8), exit === 'none' ? 1 : 1 - seg(local, exitStart + 6, c.dur)) * c.backdrop * opacity;
    if (k > 0.01) {
      const cx = (L.left + L.right) / 2;
      const cy = (L.top + L.bottom) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(260, (L.right - L.left) * 0.62), Math.max(70, (L.bottom - L.top) * 0.95));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, 'rgba(2,3,8,0.6)');
      g.addColorStop(0.5, 'rgba(2,3,8,0.36)');
      g.addColorStop(1, 'rgba(2,3,8,0)');
      ctx.globalAlpha = clamp(k);
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }
  ctx.font = c.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const base = c.color(local);
  const em = c.em ? c.em(local) : base;
  const em2 = c.em2 ? c.em2(local) : base;
  const dy0 = c.size * 0.38;
  for (const g of L.glyphs) {
    const r1 = hash01(g.gi, seed);
    const r2 = hash01(g.gi + 1000, seed);
    const r3 = hash01(g.gi + 2000, seed);
    const r4 = hash01(g.gi + 3000, seed);
    let op = 1;
    let dx = 0;
    let dy = 0;
    let blur = 0;
    let sc = 1;
    let rot = 0;
    const t0 = (c.lineDelay?.[g.line] ?? 0) + g.ci * stagger + r1 * stagger * 0.6;
    const pe = seg(local, t0, t0 + enterLen);
    if (pe <= 0) continue;
    const e = ease.outCubic(pe);
    const a = r2 * Math.PI * 2;
    const R = 26 + r3 * 34;
    dx += Math.cos(a) * R * (1 - e);
    dy += Math.sin(a) * R * (1 - e);
    blur += (1 - e) * 14;
    sc *= 1 + (1 - e) * 0.35;
    op *= ease.outQuad(pe);
    if (exit === 'diffuse' && local >= exitStart) {
      const d0 = exitStart + r4 * exitLen * 0.45;
      const q = seg(local, d0, d0 + exitLen * 0.55);
      const ee = ease.inQuad(q);
      const aa = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
      const RR = 50 + r1 * 110;
      dx += Math.cos(aa) * RR * ee + Math.sin(local * 0.6 + r1 * 20) * 6 * ee;
      dy += Math.sin(aa) * RR * ee + Math.cos(local * 0.5 + r2 * 20) * 6 * ee - 20 * ee;
      blur += ee * 16;
      rot += (r3 - 0.5) * 70 * ee;
      sc *= 1 + ee * 0.25;
      op *= 1 - ease.inCubic(q);
    }
    op *= opacity;
    if (op <= 0.003) continue;
    const col = g.style === 1 ? em : g.style === 2 ? em2 : base;
    ctx.save();
    ctx.translate(g.x + dx, g.cy + dy);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    if (sc !== 1) ctx.scale(sc, sc);
    if (c.glow && blur < 4) {
      ctx.globalAlpha = clamp(op * c.glow * 0.5);
      ctx.filter = `blur(${(c.size * 0.16).toFixed(1)}px)`;
      ctx.fillStyle = rgbStr(col);
      ctx.fillText(g.ch, 0, dy0);
    }
    ctx.globalAlpha = clamp(op);
    ctx.fillStyle = rgbStr(col);
    ctx.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : 'none';
    ctx.fillText(g.ch, 0, dy0);
    ctx.restore();
  }
  ctx.restore();
}

/** draw a caption fully formed in white (for a NOISE-DEATH mask) */
export function drawCapMask(ctx: CanvasRenderingContext2D, c: Cap) {
  const L = layoutCap(ctx, c);
  ctx.save();
  ctx.font = c.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  for (const g of L.glyphs) ctx.fillText(g.ch, g.x, g.cy + c.size * 0.38);
  ctx.restore();
}

export const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const VOICE: RGB = [243, 239, 230];
export const GREY: RGB = [92, 92, 92];

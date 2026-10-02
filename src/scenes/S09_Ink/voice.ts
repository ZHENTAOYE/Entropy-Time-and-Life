// S09 — the narration voice, drawn into the scene canvas. Same grammar as lib/Caption (glyphs CONDENSE out of blur,
// leave by DIFFUSING in random order) and the SAME layout code as S05's text.ts, so that S09's 「但在散开的路上——」
// sits exactly where S05's 「但在滚落的路上——」 sat (centred, y 1440, Serif 600 56 px, tracking .08 em) and is drawn the
// same way: the Chinese dash 「——」 is ONE unbroken rule (S05 text.ts: each "—" of a run is a bar at the font's own dash
// height/thickness reaching the middle of the tracking gap; the advances — every other glyph's position — are unchanged).
// Extensions: colour as a function of time (warm white over the cosmos → ink #17151C over the cream tank),
// {…} emphasis colour, a per-line entry delay, and a <…> SLOT: a glyph laid out at its own size whose drawing is
// delegated to a callback (the brush-painted 你).
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01, seedOf } from '../../lib/random';
import { RGB, fresh, rgbStr, scratch } from './canvas';

export interface Cap {
  lines: string[];
  from: number;
  dur: number;
  font: string;
  size: number;
  x?: number;
  y?: number;
  color: (local: number) => RGB;
  em?: (local: number) => RGB;
  stagger?: number;
  enterLen?: number;
  exitLen?: number;
  exit?: 'diffuse' | 'none';
  lineDelay?: number[];
  letterSpacing?: number;
  lineHeight?: number;
  /** soft dark (or light) backdrop strength (0 = none) */
  backdrop?: number;
  backdropRgb?: RGB;
  /** soft luminous glow 0..1 */
  glow?: number;
  /** font of the <…> slot glyph (laid out at its own size, drawn by the caller) */
  slotFont?: string;
  /** ink on the cream tank: a blurred glyph is diluted ink (paler as it spreads — never a grey block) */
  inkFade?: boolean;
  /** extra entry delay (frames) per glyph */
  delayOf?: (g: Glyph) => number;
  /** layout advance of the <…> slot glyph (px; default: measured with slotFont) */
  slotW?: number;
}

export interface Glyph {
  ch: string;
  style: 0 | 1 | 3; // 0 base · 1 {em} · 3 <slot>
  line: number;
  ci: number;
  gi: number;
  x: number;
  cy: number;
  w: number;
  /** a "—" drawn as a bar: its x extent relative to the glyph centre (reaches the neighbouring dash of a run) */
  bar?: readonly [number, number];
}
export interface CapLayout {
  glyphs: Glyph[];
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const layoutCache = new Map<string, CapLayout>();

/** ink box of the font's "—" relative to (advance centre, alphabetic baseline): x0, x1, top, bottom (y down) — S05 text.ts */
export function dashInk(ctx: CanvasRenderingContext2D, font: string, size: number) {
  return memo(`s09:dash:${font}`, () => {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText('—');
    ctx.restore();
    let x0 = -m.actualBoundingBoxLeft - m.width / 2;
    let x1 = m.actualBoundingBoxRight - m.width / 2;
    let top = -m.actualBoundingBoxAscent;
    let bottom = m.actualBoundingBoxDescent;
    const th = bottom - top;
    // sanity (fallback = a CJK dash: centre 0.36 em above the baseline, 0.055 em thick, 0.9 em long)
    if (!(th > 0.5 && th < size * 0.2 && x1 - x0 > size * 0.3)) {
      top = -size * 0.36 - size * 0.0275;
      bottom = -size * 0.36 + size * 0.0275;
      x0 = -size * 0.45;
      x1 = size * 0.45;
    }
    return { x0, x1, top, bottom, w: m.width };
  });
}

export function layoutCap(ctx: CanvasRenderingContext2D, c: Cap): CapLayout {
  const key = c.font + '|' + c.lines.join('\n') + '|' + (c.x ?? 540) + '|' + (c.y ?? 1440) + '|' + (c.letterSpacing ?? 0.08) + '|' + (c.slotFont ?? '') + '|' + (c.slotW ?? '');
  const hit = layoutCache.get(key);
  if (hit) return hit;
  ctx.save();
  const ls = (c.letterSpacing ?? 0.08) * c.size;
  const pitch = c.size * (c.lineHeight ?? 1.55);
  const n = c.lines.length;
  const y0 = (c.y ?? 1440) - ((n - 1) * pitch) / 2;
  const glyphs: Glyph[] = [];
  let gi = 0;
  let left = 1e9;
  let right = -1e9;
  c.lines.forEach((raw, li) => {
    const items: Array<{ ch: string; style: 0 | 1 | 3; w: number; bar?: [number, number] }> = [];
    let style: 0 | 1 | 3 = 0;
    for (const ch of Array.from(raw)) {
      if (ch === '{') style = 1;
      else if (ch === '<') style = 3;
      else if (ch === '}' || ch === '>') style = 0;
      else if (style === 3 && c.slotW) items.push({ ch, style, w: c.slotW });
      else {
        ctx.font = style === 3 && c.slotFont ? c.slotFont : c.font;
        items.push({ ch, style, w: ctx.measureText(ch).width });
      }
    }
    // dash runs: every "—" becomes a bar; inside a run the bars meet in the middle of the tracking gap
    if (items.some((it) => it.ch === '—')) {
      const ink = dashInk(ctx, c.font, c.size);
      items.forEach((it, i) => {
        if (it.ch !== '—') return;
        const l = i > 0 && items[i - 1].ch === '—' ? -(it.w / 2 + ls / 2) - 0.5 : ink.x0;
        const r = i < items.length - 1 && items[i + 1].ch === '—' ? it.w / 2 + ls / 2 + 0.5 : ink.x1;
        it.bar = [l, r];
      });
    }
    let total = 0;
    items.forEach((it, i) => (total += it.w + (i < items.length - 1 ? ls : 0)));
    let x = (c.x ?? 540) - total / 2;
    left = Math.min(left, x);
    items.forEach((it, ci) => {
      glyphs.push({ ch: it.ch, style: it.style, line: li, ci, gi: gi++, x: x + it.w / 2, cy: y0 + li * pitch, w: it.w, bar: it.bar });
      x += it.w + ls;
    });
    right = Math.max(right, x);
  });
  ctx.restore();
  const out = { glyphs, top: y0 - c.size * 0.7, bottom: y0 + (n - 1) * pitch + c.size * 0.7, left, right };
  layoutCache.set(key, out);
  return out;
}

/** per-glyph animation state at caption-local frame `local` (CONDENSE in / DIFFUSE out — lib Caption's maths) */
export function glyphState(c: Cap, g: Glyph, local: number, seed: number) {
  const stagger = c.stagger ?? 2;
  const enterLen = c.enterLen ?? 18;
  const exitLen = c.exitLen ?? 26;
  const exitStart = c.dur - exitLen;
  const exit = c.exit ?? 'diffuse';
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
  let diffuse = 0;
  const t0 = (c.lineDelay?.[g.line] ?? 0) + (c.delayOf ? c.delayOf(g) : 0) + g.ci * stagger + r1 * stagger * 0.6;
  const pe = seg(local, t0, t0 + enterLen);
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
    diffuse = q;
  }
  return { pe, op, dx, dy, blur, sc, rot, diffuse };
}

export type SlotDraw = (ctx: CanvasRenderingContext2D, g: Glyph, st: ReturnType<typeof glyphState>, local: number) => void;

/** Draw a caption at scene frame f. `opacity` multiplies everything. Slot glyphs are handed to `slot`. */
export function drawCap(ctx: CanvasRenderingContext2D, c: Cap, f: number, opacity = 1, slot?: SlotDraw) {
  const local = f - c.from;
  if (local < 0 || local >= c.dur) return;
  const L = layoutCap(ctx, c);
  const seed = seedOf(c.lines.join(''));
  const enterLen = c.enterLen ?? 18;
  const exitLen = c.exitLen ?? 26;
  const exitStart = c.dur - exitLen;
  const exit = c.exit ?? 'diffuse';
  ctx.save();
  if (c.backdrop) {
    const k = Math.min(seg(local, 0, enterLen + 8), exit === 'none' ? 1 : 1 - seg(local, exitStart + 6, c.dur)) * c.backdrop * opacity;
    if (k > 0.01) {
      const cx = (L.left + L.right) / 2;
      const cy = (L.top + L.bottom) / 2;
      const [br, bg, bb] = c.backdropRgb ?? [2, 3, 8];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(260, (L.right - L.left) * 0.62), Math.max(70, (L.bottom - L.top) * 0.95));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(${br},${bg},${bb},0.6)`);
      g.addColorStop(0.5, `rgba(${br},${bg},${bb},0.36)`);
      g.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
      ctx.globalAlpha = clamp(k);
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }
  }
  const base = c.color(local);
  const em = c.em ? c.em(local) : base;
  for (const g of L.glyphs) {
    const st = glyphState(c, g, local, seed);
    if (st.pe <= 0) continue;
    if (g.style === 3) {
      if (slot) slot(ctx, g, st, local);
      continue;
    }
    const op = st.op * opacity * (c.inkFade ? 1 / (1 + (st.blur / 6) * (st.blur / 6)) : 1);
    if (op <= 0.003) continue;
    const col = g.style === 1 ? em : base;
    drawGlyph(ctx, g.ch, c.font, c.size, col, g.x + st.dx, g.cy + st.dy, st.sc, st.rot, st.blur, op, c.glow && st.blur < 4 ? c.glow : 0, g.bar);
  }
  ctx.restore();
}

/**
 * One glyph, centred at (x, y) (the glyph's visual centre: baseline at y + 0.38·size). A blurred glyph is rendered
 * into a small glyph-sized scratch canvas and blitted: a canvas `filter` on the full-frame canvas would blur a
 * full-size layer per glyph (seconds per frame in this renderer).
 */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  ch: string,
  font: string,
  size: number,
  col: RGB,
  x: number,
  y: number,
  sc: number,
  rot: number,
  blur: number,
  alpha: number,
  glow = 0,
  bar?: readonly [number, number],
) {
  if (alpha <= 0.003) return;
  const dy0 = size * 0.38;
  /** one glyph at (x0, baseline) in the current fillStyle — a dash-run bar is a rule, never the font's two dashes */
  const shape = (g: CanvasRenderingContext2D, x0: number, base: number) => {
    if (bar) {
      const ink = dashInk(g, font, size);
      g.fillRect(x0 + bar[0], base + ink.top, bar[1] - bar[0], ink.bottom - ink.top);
    } else g.fillText(ch, x0, base);
  };
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate((rot * Math.PI) / 180);
  if (sc !== 1) ctx.scale(sc, sc);
  if (blur <= 0.15 && glow <= 0) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = clamp(alpha);
    ctx.fillStyle = rgbStr(col);
    shape(ctx, 0, dy0);
    ctx.restore();
    return;
  }
  const gb = glow > 0 ? size * 0.16 : 0;
  const pad = Math.ceil(Math.max(blur, gb) * 3 + 4);
  const S = Math.ceil(size * 1.5) + pad * 2;
  // a settled glowing glyph never changes: render it once (the blur filter is the expensive part)
  const still = blur <= 0.15;
  const c = still ? memo(`s09:glyphGlow:${ch}|${font}|${col.join(',')}|${glow.toFixed(3)}|${bar ? bar.join(',') : ''}`, () => document.createElement('canvas')) : scratch('glyph', S, S);
  if (still && c.width === S && c.height === S) {
    ctx.globalAlpha = clamp(alpha);
    ctx.drawImage(c, -S / 2, -S / 2);
    ctx.restore();
    return;
  }
  if (still) {
    c.width = S;
    c.height = S;
  }
  const g = fresh(c);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = rgbStr(col);
  if (glow > 0) {
    // the glow: the glyph itself, softened (no canvas filter: it costs ~25 ms per glyph here)
    const t = scratch('glyphGlowSrc', S, S);
    const tg = fresh(t);
    tg.font = font;
    tg.textAlign = 'center';
    tg.textBaseline = 'alphabetic';
    tg.fillStyle = rgbStr(col);
    shape(tg, S / 2, S / 2 + dy0);
    g.globalAlpha = clamp(glow * 0.5);
    g.imageSmoothingEnabled = true;
    g.drawImage(softGlyph(t, gb), 0, 0, S, S);
    g.globalAlpha = 1;
  }
  shape(g, S / 2, S / 2 + dy0);
  ctx.globalAlpha = clamp(alpha);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(blur > 0.15 ? softGlyph(c, blur) : c, -S / 2, -S / 2, S, S);
  ctx.restore();
}

/**
 * Blur a square glyph canvas by ≈ σ px without a canvas filter: progressive halving (2×2 box averages) down to 1/(2.2σ)
 * of its size; the caller draws the result upscaled back (bilinear) — a smooth blur for a fraction of a filter's cost.
 */
function softGlyph(src: HTMLCanvasElement, sigma: number): HTMLCanvasElement {
  const S = src.width;
  const target = Math.max(1, Math.round(S / Math.max(1, sigma * 2.2)));
  if (target >= S - 1) return src;
  let cur = src,
    size = S,
    i = 0;
  while (Math.round(size / 2) > target) {
    size = Math.round(size / 2);
    const c = scratch(`glyphDown${i++}`, size, size);
    fresh(c).drawImage(cur, 0, 0, size, size);
    cur = c;
  }
  if (target < size) {
    const c = scratch(`glyphDown${i++}`, target, target);
    fresh(c).drawImage(cur, 0, 0, target, target);
    cur = c;
  }
  return cur;
}

export const VOICE: RGB = [243, 239, 230];
export const INK_TEXT: RGB = [23, 21, 28];
export const GOLD: RGB = [255, 201, 74];

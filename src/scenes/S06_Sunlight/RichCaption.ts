// Narration captions drawn into the scene's single canvas (DOM text with per-glyph CSS blur cost ~1 s/frame in
// the software compositor). Same voice as lib/Caption: enter = CONDENSE out of blur, exit = DIFFUSE (glyphs drift
// apart in random order). Per-run styling (two accent colours, mixed sizes on a shared baseline) and two effects:
//   fx 'ink'    — the glyphs bleed outward like ink in water while displayed (散开)
//   fx 'bright' — the glyph alone brightens to a warm white glow while the rest of the line steps back (你)
// STAGGER IS PER LINE: a glyph's condense start = lineDelay[line] + (index within its line)·stagger (+ jitter), so a
// second line is not pushed back by the length of the first (the global glyph index only seeds the hashes).
import { FONT } from '../../lib/fonts';
import { clamp, ease, seg } from '../../lib/math';
import { hash01, seedOf } from '../../lib/random';

export interface Run {
  text: string;
  color?: string;
  size?: number;
  weight?: number;
  font?: keyof typeof FONT;
  glow?: number;
  fx?: 'ink' | 'bright';
  /** local frame (relative to `from`) at which the fx starts */
  fxAt?: number;
  letterSpacing?: number;
  /** extra baseline shift in px */
  dy?: number;
}

export interface CaptionSpec {
  lines: Run[][];
  from: number;
  dur: number;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  weight?: number;
  stagger?: number;
  enterLen?: number;
  exitLen?: number;
  /** delay (frames) before each line starts condensing */
  lineDelay?: number[];
  lineGap?: number;
  shadow?: boolean;
  /** backdrop darkness multiplier */
  backdrop?: number;
  seed?: number;
}

const D = {
  x: 540,
  y: 1440,
  size: 56,
  color: '#F3EFE6',
  weight: 600,
  stagger: 1.1,
  enterLen: 15,
  exitLen: 20,
  lineGap: 0.55,
  backdrop: 1,
};

export const runFont = (c: CaptionSpec, r: Run) => `${r.weight ?? c.weight ?? D.weight} ${r.size ?? c.size ?? D.size}px ${FONT[r.font ?? 'serif']}`;

/** font slices this caption needs (for the scene's font gate) */
export function captionFonts(c: CaptionSpec): Array<[string, string]> {
  const m = new Map<string, string>();
  for (const r of c.lines.flat()) {
    const k = runFont(c, r);
    m.set(k, (m.get(k) ?? '') + r.text);
  }
  return [...m.entries()];
}

/** frame window in which the caption is visible */
export const capOn = (c: CaptionSpec, f: number) => f >= c.from && f < c.from + c.dur;

/** local frame by which every glyph of line `li` has fully condensed (for timing checks) */
export function lineFormedAt(c: CaptionSpec, li: number): number {
  const n = Array.from(c.lines[li].map((r) => r.text).join('')).length;
  const st = c.stagger ?? D.stagger;
  return (c.lineDelay?.[li] ?? 0) + (n - 1) * st + st * 0.6 + (c.enterLen ?? D.enterLen);
}

interface G {
  ch: string;
  run: Run;
  li: number;
  ci: number; // index within the line
  ri: number; // index within the run
  gi: number; // global index (hash seed only)
  x: number; // glyph centre
  base: number; // baseline y
  w: number;
  sz: number;
}

function layout(ctx: CanvasRenderingContext2D, c: CaptionSpec): { glyphs: G[]; top: number; H: number } {
  const size = c.size ?? D.size;
  const lineGap = c.lineGap ?? D.lineGap;
  const glyphs: G[] = [];
  const lines: Array<{ items: G[]; width: number; asc: number; desc: number }> = [];
  let gi = 0;
  c.lines.forEach((ln, li) => {
    const items: G[] = [];
    let x = 0;
    let asc = 0;
    let desc = 0;
    let ci = 0;
    for (const run of ln) {
      ctx.font = runFont(c, run);
      const sz = run.size ?? size;
      const ls = (run.letterSpacing ?? 0.08) * sz;
      asc = Math.max(asc, sz * 0.86);
      desc = Math.max(desc, sz * 0.16);
      Array.from(run.text).forEach((ch, ri) => {
        const w = ctx.measureText(ch).width;
        items.push({ ch, run, li, ci: ci++, ri, gi: gi++, x: x + (w + ls) / 2, base: 0, w, sz });
        x += w + ls;
      });
    }
    lines.push({ items, width: x, asc, desc });
  });
  let H = 0;
  lines.forEach((l, i) => (H += l.asc + l.desc + (i ? size * lineGap : 0)));
  const top = (c.y ?? D.y) - H / 2;
  let yy = top;
  lines.forEach((l, i) => {
    if (i) yy += size * lineGap;
    const base = yy + l.asc;
    const x0 = (c.x ?? D.x) - l.width / 2;
    for (const g of l.items) {
      g.x += x0;
      g.base = base;
      glyphs.push(g);
    }
    yy += l.asc + l.desc;
  });
  return { glyphs, top, H };
}

/** Draw the caption at frame f (no-op outside its window). Fonts must be loaded. */
export function drawCaption(ctx: CanvasRenderingContext2D, c: CaptionSpec, f: number) {
  const local = f - c.from;
  if (local < 0 || local >= c.dur) return;
  const size = c.size ?? D.size;
  const stagger = c.stagger ?? D.stagger;
  const enterLen = c.enterLen ?? D.enterLen;
  const exitLen = c.exitLen ?? D.exitLen;
  const exitStart = c.dur - exitLen;
  const all = c.lines.flat();
  const sd = c.seed ?? seedOf(all.map((r) => r.text).join(''));
  const br = all.find((r) => r.fx === 'bright');
  const dimK = br ? ease.inOutSine(seg(local, br.fxAt ?? 30, (br.fxAt ?? 30) + 16)) : 0;
  ctx.save();
  const { glyphs, top, H } = layout(ctx, c);

  // one soft dark backdrop behind the whole block
  const bdA = c.shadow === false ? 0 : Math.min(seg(local, 0, enterLen + 6), 1 - seg(local, exitStart + 4, c.dur));
  if (bdA > 0.01) {
    const bk = Math.max(1, c.backdrop ?? D.backdrop);
    const cx = c.x ?? D.x;
    const cy = top + H / 2;
    const rx = 480;
    const ry = H * 0.95;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(3,4,9,${0.62 * bk})`);
    g.addColorStop(0.45, `rgba(3,4,9,${0.38 * bk})`);
    g.addColorStop(1, 'rgba(3,4,9,0)');
    ctx.globalAlpha = Math.min(1, bdA * (c.backdrop ?? 1));
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const g of glyphs) {
    const run = g.run;
    const r1 = hash01(g.gi, sd);
    const r2 = hash01(g.gi + 1000, sd);
    const r3 = hash01(g.gi + 2000, sd);
    const r4 = hash01(g.gi + 3000, sd);
    const sz = g.sz;
    const big = sz / size;
    let op = 1;
    let dx = 0;
    let dy = run.dy ?? 0;
    let blur = 0;
    let sc = 1;
    let rot = 0;
    // ---- enter: condense (per-line stagger)
    const t0 = (c.lineDelay?.[g.li] ?? 0) + g.ci * stagger + r1 * stagger * 0.6;
    const pe = seg(local, t0, t0 + enterLen);
    if (pe <= 0) continue;
    const e = ease.outCubic(pe);
    const a = r2 * Math.PI * 2;
    const R = (26 + r3 * 34) * Math.sqrt(big);
    dx += Math.cos(a) * R * (1 - e);
    dy += Math.sin(a) * R * (1 - e);
    blur += (1 - e) * 14 * Math.sqrt(big);
    sc *= 1 + (1 - e) * 0.35;
    op *= ease.outQuad(pe);
    // ---- exit: diffuse
    if (local >= exitStart) {
      const d0 = exitStart + r4 * exitLen * 0.45;
      const q = seg(local, d0, d0 + exitLen * 0.55);
      const ee = ease.inQuad(q);
      const aa = r2 * Math.PI * 2 + (r3 - 0.5) * 2;
      const RR = (50 + r1 * 110) * Math.sqrt(big);
      dx += Math.cos(aa) * RR * ee + Math.sin(local * 0.6 + r1 * 20) * 6 * ee;
      dy += Math.sin(aa) * RR * ee + Math.cos(local * 0.5 + r2 * 20) * 6 * ee - 20 * ee;
      blur += ee * 16 * Math.sqrt(big);
      rot += (r3 - 0.5) * 70 * ee;
      sc *= 1 + ee * 0.25;
      op *= 1 - ease.inCubic(q);
    }
    let col = run.color ?? c.color ?? D.color;
    if (run.fx !== 'bright') op *= 1 - 0.28 * dimK;
    if (op <= 0.003) continue;
    const glow = run.glow ?? 0;
    ctx.font = runFont(c, run);
    // glyph-centred transform (the glyph's optical centre ~0.36 em above the baseline)
    const cy = g.base - sz * 0.36;
    const drawAt = (ox: number, oy: number) => ctx.fillText(g.ch, ox, oy + sz * 0.36);
    ctx.save();
    ctx.translate(g.x + dx, cy + dy);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    if (sc !== 1) ctx.scale(sc, sc);
    // ---- in-place effects (under the glyph)
    if (run.fx === 'ink') {
      const k = ease.outCubic(seg(local, run.fxAt ?? 20, (run.fxAt ?? 20) + 60));
      if (k > 0) {
        const spread = k * 64;
        // own light bleeding out, S01's dilute blue-grey at the fringe, tendrils creeping out of the strokes
        ctx.globalAlpha = op * 0.55 * (1 - k * 0.3);
        ctx.filter = `blur(${(3 + spread * 0.18).toFixed(1)}px)`;
        ctx.fillStyle = 'rgb(255,236,228)';
        drawAt(0, 0);
        ctx.globalAlpha = op * 0.5 * (1 - k * 0.2);
        ctx.filter = `blur(${(8 + spread * 0.5).toFixed(1)}px)`;
        ctx.fillStyle = 'rgb(120,140,190)';
        drawAt(0, 0);
        for (let t = 0; t < 6; t++) {
          const an = hash01(g.gi * 7 + t, sd + 5) * Math.PI * 2;
          const L = spread * (0.45 + hash01(g.gi * 7 + t, sd + 6) * 0.9);
          ctx.globalAlpha = op * 0.42 * (1 - k * 0.5);
          ctx.filter = `blur(${(2 + L * 0.3).toFixed(1)}px)`;
          ctx.fillStyle = t % 2 ? 'rgb(255,222,212)' : 'rgb(130,150,200)';
          drawAt(Math.cos(an) * L, Math.sin(an) * L + 4 * k);
        }
        ctx.filter = 'none';
        blur += k * 0.6;
        ctx.translate((r1 - 0.5) * 10 * k + (g.ri - (Array.from(run.text).length - 1) / 2) * 16 * k, (r2 - 0.5) * 8 * k + 2 * k);
        ctx.rotate(((r3 - 0.5) * 6 * k * Math.PI) / 180);
        ctx.scale(1 + 0.06 * k, 1 + 0.06 * k);
      }
    }
    if (run.fx === 'bright') {
      const k = ease.inOutSine(seg(local, run.fxAt ?? 30, (run.fxAt ?? 30) + 16));
      if (k > 0) {
        col = mixRgb(col, '#FFF1C8', k);
        ctx.translate(0, -3 * k);
        ctx.scale(1 + 0.14 * k, 1 + 0.14 * k);
        const halo: Array<[number, string]> = [
          [80 + 40 * k, `rgba(255,180,60,${0.45 * k})`],
          [30 + 40 * k, `rgba(255,201,74,${0.85 * k})`],
          [8 + 14 * k, `rgba(255,240,200,${k})`],
        ];
        for (const [b, cc] of halo) {
          ctx.globalAlpha = op;
          ctx.filter = `blur(${(b / 2).toFixed(1)}px)`;
          ctx.fillStyle = cc;
          drawAt(0, 0);
        }
        ctx.filter = 'none';
      }
    }
    // ---- the glyph
    ctx.globalAlpha = clamp(op);
    ctx.fillStyle = col;
    if (glow > 0) {
      ctx.shadowColor = col;
      ctx.shadowBlur = Math.min(26, sz * 0.3 * glow);
    }
    if (blur > 0.15) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    drawAt(0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function mixRgb(a: string, b: string, t: number): string {
  const pa = toRgb(a);
  const pb = toRgb(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}
function toRgb(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/\d+/g) || ['0', '0', '0'];
  return [+m[0], +m[1], +m[2]];
}

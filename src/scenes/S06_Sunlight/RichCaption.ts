// Narration captions drawn into the scene's single canvas (DOM text with per-glyph CSS blur cost ~1 s/frame in
// the software compositor). Same voice as lib/Caption: enter = CONDENSE out of blur, exit = DIFFUSE (glyphs drift
// apart in random order). Per-run styling (two accent colours, mixed sizes on a shared baseline) and two effects:
//   fx 'ink'    — the glyphs bleed outward like ink in water while displayed (散开)
//   fx 'bright' — the glyph alone brightens to a warm white glow while the rest of the line steps back (你)
// STAGGER IS PER LINE: a glyph's condense start = lineDelay[line] + (index within its line)·stagger (+ jitter), so a
// second line is not pushed back by the length of the first (the global glyph index only seeds the hashes).
// PERFORMANCE: every blurred draw is clipped to its own bounds first (blurred) — an unclipped ctx.filter blur makes
// Chrome blur a layer the size of the whole 1080×1920 canvas (~25 ms per glyph).
// A run of em dashes (——) is laid out and drawn as ONE continuous rule (no tracking gap between the two dashes).
import { FONT } from '../../lib/fonts';
import { clamp, ease, memo, seg } from '../../lib/math';
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
  /** extra 0..1 factor on the backdrop at scene frame f (e.g. none while the heat-death grey is still there) */
  backdropGate?: (f: number) => number;
  seed?: number;
}

const D = {
  x: 540,
  y: 1440,
  size: 56,
  color: '#F3EFE6',
  weight: 600,
  stagger: 0.8,
  enterLen: 13,
  exitLen: 18,
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
  /** a run of n ≥ 2 em dashes drawn as one rule: ink extent relative to the glyph centre / baseline */
  rule?: { x0: number; x1: number; y0: number; y1: number };
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
      const chars = Array.from(run.text);
      for (let ri = 0; ri < chars.length; ri++) {
        let ch = chars[ri];
        if (ch === '—' && chars[ri + 1] === '—') {
          // ——: one continuous 2-em rule (Chinese typography), measured from the dash glyph's own ink
          let n = 1;
          while (chars[ri + 1] === '—') {
            n++;
            ri++;
          }
          ch = '—'.repeat(n);
          const m = ctx.measureText('—');
          const adv = m.width;
          const w = adv * n;
          const ink0 = -m.actualBoundingBoxLeft;
          const ink1 = m.actualBoundingBoxRight;
          const rule = { x0: -w / 2 + Math.min(ink0, adv * 0.04), x1: -w / 2 + (n - 1) * adv + Math.max(ink1, adv * 0.96), y0: -m.actualBoundingBoxAscent, y1: m.actualBoundingBoxDescent };
          if (!(rule.y1 - rule.y0 > 0.5)) {
            rule.y0 = -sz * 0.4;
            rule.y1 = -sz * 0.34;
          }
          items.push({ ch, run, li, ci: ci++, ri, gi: gi++, x: x + (w + ls) / 2, base: 0, w, sz, rule });
          x += w + ls;
          continue;
        }
        const w = ctx.measureText(ch).width;
        items.push({ ch, run, li, ci: ci++, ri, gi: gi++, x: x + (w + ls) / 2, base: 0, w, sz });
        x += w + ls;
      }
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
  const bdA = c.shadow === false ? 0 : Math.min(seg(local, 0, enterLen + 6), 1 - seg(local, exitStart + 4, c.dur)) * (c.backdropGate ? c.backdropGate(f) : 1);
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
    const half = Math.max(g.w, sz) * 0.62;
    const drawGlyph = (ox: number, oy: number) => {
      const rl = g.rule;
      if (rl) ctx.fillRect(ox + rl.x0, oy + sz * 0.36 + rl.y0, rl.x1 - rl.x0, rl.y1 - rl.y0);
      else ctx.fillText(g.ch, ox, oy + sz * 0.36);
    };
    /** the glyph (or a copy of it) at (ox, oy), blurred by b px — clipped to its own bounds first */
    const blurred = (ox: number, oy: number, b: number, extra = 2) => {
      if (b <= 0.15) {
        drawGlyph(ox, oy);
        return;
      }
      const m = half + b * 3 + extra;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox - m, oy - m, 2 * m, 2 * m);
      ctx.clip();
      ctx.filter = `blur(${b.toFixed(2)}px)`;
      drawGlyph(ox, oy);
      ctx.restore();
    };
    ctx.save();
    ctx.translate(g.x + dx, cy + dy);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    if (sc !== 1) ctx.scale(sc, sc);
    // ---- in-place effects (under the glyph)
    if (run.fx === 'ink') {
      const k = ease.outCubic(seg(local, run.fxAt ?? 20, (run.fxAt ?? 20) + 60));
      if (k > 0) {
        inkBleed(ctx, g.gi, sd, k, local, op, sz, blurred);
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
          ctx.fillStyle = cc;
          blurred(0, 0, b / 2);
        }
      }
    }
    // ---- the glyph
    ctx.globalAlpha = clamp(op);
    ctx.fillStyle = col;
    if (glow > 0) {
      ctx.shadowColor = col;
      ctx.shadowBlur = Math.min(26, sz * 0.3 * glow);
    }
    blurred(0, 0, blur, glow > 0 ? 34 : 2);
    ctx.restore();
  }
  ctx.restore();
}

/** 散开: the glyph's light diffuses into the dark like S01's ink in water — a dark core under the stroke, the glyph's
 *  own light bleeding out, a dilute blue-grey cloud (S01 #3C4A6A, lifted for a dark ground), and soft, tapered,
 *  curling tendrils with branching wisps that creep 60–110 px out of the strokes (k = 0 → 1). The tendrils are drawn
 *  into a small offscreen canvas and composited twice (sharp + soft): ink, not cracks. Glyph-centred frame. */
const INK_S = 380;
const inkScratch = () =>
  memo('s06:inkScratch', () => {
    const c = document.createElement('canvas');
    c.width = INK_S;
    c.height = INK_S;
    return c;
  });
const INK_NEAR: [number, number, number] = [255, 236, 226];
const INK_FAR: [number, number, number] = [116, 134, 184];

function inkBleed(
  ctx: CanvasRenderingContext2D,
  gi: number,
  sd: number,
  k: number,
  local: number,
  op: number,
  sz: number,
  blurred: (ox: number, oy: number, b: number, extra?: number) => void,
) {
  ctx.save();
  // dark ink core under the glyph (gives the bleed its density)
  ctx.globalAlpha = op * 0.55 * Math.min(1, k * 2);
  ctx.fillStyle = 'rgb(2,3,8)';
  blurred(0, 2, 5 + 6 * k);
  // the dilute cloud
  ctx.globalAlpha = op * 0.75 * k * (1 - 0.2 * k);
  ctx.fillStyle = 'rgb(104,122,170)';
  blurred(0, 3 * k, 10 + 26 * k);
  // tendrils → offscreen
  const S = inkScratch();
  const g = S.getContext('2d', { willReadFrequently: true })!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.clearRect(0, 0, INK_S, INK_S);
  g.translate(INK_S / 2, INK_S / 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const NT = 9;
  const N = 14;
  const px = new Float32Array(N + 1);
  const py = new Float32Array(N + 1);
  for (let t = 0; t < NT; t++) {
    const h = (q: number) => hash01(gi * 31 + t * 7 + q, sd + 11);
    const grow = clamp((k - h(9) * 0.25) / 0.75);
    if (grow <= 0.02) continue;
    const an = ((t + h(1) * 0.8) / NT) * Math.PI * 2;
    const L = (60 + 50 * h(2)) * ease.outCubic(grow);
    const curl = (h(3) - 0.5) * 3.2;
    const ph = h(4) * 6.28;
    const wob = 0.25 * Math.sin(local * 0.045 + h(5) * 6.28);
    px[0] = (h(6) - 0.5) * sz * 0.5;
    py[0] = (h(7) - 0.5) * sz * 0.5;
    for (let i = 1; i <= N; i++) {
      const u = i / N;
      const th = an + curl * Math.sin(Math.PI * u * 1.3 + ph) * u + wob * u;
      px[i] = px[i - 1] + (Math.cos(th) * L) / N;
      py[i] = py[i - 1] + (Math.sin(th) * L) / N + (2 * k) / N;
    }
    // the soft cloud along the tendril
    g.strokeStyle = 'rgba(104,122,170,0.2)';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(px[0], py[0]);
    for (let i = 1; i <= N; i++) g.lineTo(px[i], py[i]);
    g.stroke();
    // the tendril body: tapered, dense & lit near the stroke → dilute blue-grey at the tip
    for (let i = 1; i <= N; i++) {
      const u = (i - 0.5) / N;
      const m = clamp((u - 0.15) / 0.6);
      const r = INK_NEAR[0] + (INK_FAR[0] - INK_NEAR[0]) * m;
      const gg = INK_NEAR[1] + (INK_FAR[1] - INK_NEAR[1]) * m;
      const b = INK_NEAR[2] + (INK_FAR[2] - INK_NEAR[2]) * m;
      g.strokeStyle = `rgba(${r | 0},${gg | 0},${b | 0},${(0.85 - 0.45 * u).toFixed(3)})`;
      g.lineWidth = 5.5 - 4.6 * u;
      g.beginPath();
      g.moveTo(px[i - 1], py[i - 1]);
      g.lineTo(px[i], py[i]);
      g.stroke();
    }
    // a branching wisp from the middle
    const bi = Math.round(N * 0.5);
    const ba = an + (h(8) < 0.5 ? -0.8 : 0.8) + curl * 0.3;
    const BL = L * 0.45;
    g.strokeStyle = 'rgba(130,148,196,0.6)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(px[bi], py[bi]);
    g.quadraticCurveTo(px[bi] + Math.cos(ba) * BL * 0.6, py[bi] + Math.sin(ba) * BL * 0.6, px[bi] + Math.cos(ba + curl * 0.4) * BL, py[bi] + Math.sin(ba + curl * 0.4) * BL);
    g.stroke();
  }
  // composite: sharp-ish + soft (bounded: the scratch is only INK_S px)
  const fade = 1 - 0.3 * k;
  ctx.beginPath();
  ctx.rect(-INK_S / 2 - 24, -INK_S / 2 - 24, INK_S + 48, INK_S + 48);
  ctx.clip();
  ctx.globalAlpha = op * 0.8 * fade;
  ctx.filter = 'blur(1.4px)';
  ctx.drawImage(S, -INK_S / 2, -INK_S / 2);
  ctx.globalAlpha = op * 0.75 * fade;
  ctx.filter = 'blur(6px)';
  ctx.drawImage(S, -INK_S / 2, -INK_S / 2);
  ctx.filter = 'none';
  // the glyph's own light bleeding out
  ctx.globalAlpha = op * 0.5 * (1 - 0.35 * k);
  ctx.fillStyle = 'rgb(255,234,224)';
  blurred(0, 0, 3 + 7 * k);
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

// S09 B5–B7: everything that is INK after the inversion (drawn into the shared ink stage with multiply).
// One colour law for all of it (the inverted web's: COSMOS paper / COSMOS_INK_K / COSMOS_INK_FLOOR), so the web,
// the figure, the brush 你, the ◀◀ and the title are visibly the same ink at different dilutions.
//
// * (the web's own ink is a density field advected by the tank's water: inkfield.ts / flow.ts)
// * haze — the ink's fate: an almost uniform blue-grey haze that keeps growing (the S-gauge keeps rising).
// * figure — a brush travels along HUMAN_PATH from the crown down both sides; ink streams in along the contour and
//   keeps FLOWING along it while it holds (a shape kept by flow, like S07's vortex), then lets go and diffuses.
import { COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../lib/cosmos';
import { drawInkParticles, inkStroke } from '../../lib/ink';
import { HUMAN_PATH } from '../../lib/human';
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { sampleShape } from '../../lib/points';
import { ctxOf, scratch } from './canvas';
import { Captured, captureInk, captureMask, drawSpread } from './inklocal';
import { F } from './fonts';
import { END, INK_T, INV, RW, SURFACE_Y } from './timing';
import { DEV } from './dev';

export const K = COSMOS_INK_K;
export const FLOOR = COSMOS_INK_FLOOR;

/** smooth divergence-free displacement field (sum of 4 stream-function modes), ~unit amplitude */
export function flowField(x: number, y: number, t: number): [number, number] {
  const M: Array<[number, number, number, number]> = [
    [0.0061, 0.0042, 0.31, 0.4],
    [-0.0035, 0.0078, 0.23, 2.1],
    [0.0093, -0.0051, 0.41, 4.4],
    [0.0022, 0.0105, 0.37, 5.3],
  ];
  let vx = 0,
    vy = 0;
  for (const [kx, ky, w, ph] of M) {
    const c = Math.cos(kx * x + ky * y + w * t + ph);
    const kk = Math.hypot(kx, ky);
    vx += (c * ky) / kk;
    vy -= (c * kx) / kk;
  }
  return [vx * 0.5, vy * 0.5];
}

// ───────────────────────────── haze ─────────────────────────────
const HW = 135,
  HH = 240;
function hazeField(): Float32Array {
  return memo('s09:haze', () => {
    const nz = makeNoise(4242);
    const out = new Float32Array(HW * (HH + 120));
    for (let j = 0; j < HH + 120; j++)
      for (let i = 0; i < HW; i++) {
        const x = i * 8,
          y = j * 8 - 960;
        const v = 0.6 + 0.28 * nz.fbm2(x * 0.0014, y * 0.0011, 3) + 0.08 * nz.fbm2(x * 0.004 + 3, y * 0.0035, 2);
        out[j * HW + i] = clamp(v);
      }
    return out;
  });
}
/** the uniform blue-grey haze of spent ink (density `amount`, slowly sinking), multiplied onto the frame */
export function drawHaze(ctx: CanvasRenderingContext2D, f: number, amount: number) {
  if (amount <= 0.002) return;
  const H = hazeField();
  const c = scratch('haze', HW, HH);
  const g = ctxOf(c);
  const img = g.createImageData(HW, HH);
  const d = img.data;
  const off = Math.round(((f - INV.handover) / 30) * 1.2) % 120;
  for (let j = 0; j < HH; j++) {
    // spent ink settles: denser towards the bottom of the tank, none above the surface
    const y = j * 8;
    const vert = y < SURFACE_Y ? 0 : smoothstep(SURFACE_Y, SURFACE_Y + 260, y) * (0.75 + 0.35 * (y / 1920));
    for (let i = 0; i < HW; i++) {
      const rho = amount * vert * H[(119 - off + j) * HW + i] * 1.25;
      const o = (j * HW + i) * 4;
      for (let ch = 0; ch < 3; ch++) d[o + ch] = 255 * (FLOOR[ch] + (1 - FLOOR[ch]) * Math.exp(-rho * K[ch]));
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, 1080, 1920);
  ctx.restore();
}

// ───────────────────────────── the figure ─────────────────────────────
export const FIG = { h: 940, feet: 1325, cx: 540 } as const;
const FK = FIG.h / 1344;
export function figStroke() {
  return inkStroke('s09-figure', HUMAN_PATH, { x: FIG.cx - 300 * FK, y: FIG.feet - 1402 * FK, scale: FK, width: 19, spacing: 2.4, rows: 6, pressure: 1.0, seed: 3 });
}
/** points filling the body (sampled in a figure-sized box, not the whole frame), frame px */
const BOX = { x: 300, y: 320, w: 480, h: 1030 } as const;
function bodyPoints(): Float32Array {
  return memo('s09:bodyPts', () => {
    const p = sampleShape('s09-body', BOX.w, BOX.h, (ctx) => {
      ctx.save();
      ctx.translate(FIG.cx - 300 * FK - BOX.x, FIG.feet - 1402 * FK - BOX.y);
      ctx.scale(FK, FK);
      ctx.fill(new Path2D(HUMAN_PATH));
      ctx.restore();
    }, { step: 15, jitter: 0.9, seed: 5 });
    const o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 2) {
      o[i] = p[i] + BOX.x;
      o[i + 1] = p[i + 1] + BOX.y;
    }
    return o;
  });
}
/** painting front: arc length (from the crown, both sides) reached at frame f */
const paintFront = (f: number, L: number) => (L / 2) * ease.inOutSine(seg(f, INK_T.paint[0], INK_T.paint[1])) * 1.04;
/** let-go: 0 → 1 (per particle: the head lets go last) */
const releaseAt = (f: number, lag: number) => ease.inOutSine(seg(f, INK_T.release[0] + lag, INK_T.release[1] + lag * 0.4));

/** the figure's ink, captured at the moment it is let go (then it spreads like the rest of the ink) */
export function figureCapture(): Captured {
  return captureInk('figure', 280, 330, 520, 1060, 0.5, (g) => drawFigureParticles(g, INK_T.release[0], 1));
}
export function drawFigure(ctx: CanvasRenderingContext2D, f: number, light: number) {
  if (f < INK_T.paint[0] - 2) return;
  if (f < INK_T.release[0]) {
    drawFigureParticles(ctx, f, light);
    return;
  }
  const tau = (f - INK_T.release[0]) / 30;
  const gain = light * (1 - 0.5 * smoothstep(0.3, 3, tau));
  drawSpread(ctx, figureCapture(), tau, { sinkV: 24, sinkA: 0, flowA: 0, curlA: 0, s0: 0.2, sK: 6, margin: 150, gain, t0: (INK_T.release[0] - INV.handover) / 30 });
}

function drawFigureParticles(ctx: CanvasRenderingContext2D, f: number, light: number) {
  DEV.tick?.('fig:start');
  const st = figStroke();
  DEV.tick?.('fig:stroke');
  const t = f / 30;
  const L = st.length;
  const front = paintFront(f, L);
  const n = st.n;
  const pos = new Float32Array(n * 2);
  const dir = new Float32Array(n * 2);
  const al = new Float32Array(n);
  const sz = new Float32Array(n);
  let any = false;
  for (let i = 0; i < n; i++) {
    const s0 = st.sv[i * 2];
    const dFront = Math.min(s0, L - s0); // distance from the crown along the nearer side
    const since = (front - dFront) / 90; // seconds-ish since the brush passed
    if (since <= 0) {
      al[i] = 0;
      continue;
    }
    any = true;
    const h = hash01(i, 71);
    const track = Math.floor(i / st.perRow);
    const gIn = smoothstep(0, 0.55, since);
    // the head (small dFront) lets go last
    const rel = releaseAt(f, 26 * (1 - dFront / (L / 2)) + 8 * h);
    const g = gIn * (1 - rel);
    // the ink keeps flowing along the contour (each bristle track at its own pace) — never a frozen outline
    const [x, y, tx, ty] = st.flow(i, (14 + 22 * hash01(track, 5) + 3 * h) * t);
    const [fx, fy] = flowField(x + 37 * h, y, t * 0.55 + h * 0.4);
    const A = 6 + 150 * (1 - g) * (1 - g);
    // freshly painted ink arrives streaming along the stroke (from behind the front), wet and dark
    const stream = 42 * Math.exp(-since / 0.18);
    const side = s0 < L / 2 ? 1 : -1;
    const sink = (24 * Math.max(0, t - INK_T.release[0] / 30) + 0.4 * A) * rel;
    pos[i * 2] = x + fx * A - tx * stream * side;
    pos[i * 2 + 1] = Math.max(SURFACE_Y + 8, y + fy * A + sink - ty * stream * side);
    const grow = 1 + 1.7 * (1 - gIn) * (1 - gIn) + 4.5 * rel * rel;
    sz[i] = grow;
    const Ld = 6 + 13 * g;
    const dx = tx * g + fx * (1 - g),
      dy = ty * g + fy * (1 - g);
    const dl = Math.hypot(dx, dy) || 1;
    dir[i * 2] = (dx / dl) * Ld;
    dir[i * 2 + 1] = (dy / dl) * Ld;
    // 焦墨 where the brush was reloaded … 淡墨 where it ran thin; the wet front is darkest
    const tone = 0.5 + 0.5 * Math.sin(s0 * 0.0041 + 1.3) * Math.sin(s0 * 0.0017 + 0.4);
    const wetFront = 1 + 0.9 * Math.exp(-since / 0.22);
    al[i] = ((0.25 + 0.75 * g) / grow) * (0.45 + 0.55 * tone) * wetFront * gIn * (0.88 + 0.12 * Math.sin(s0 * 0.01 - t * 1.3));
  }
  if (!any) return;
  DEV.tick?.('fig:loop');
  const g0 = 1 - ease.inOutSine(seg(f, INK_T.release[0], INK_T.release[1]));
  drawInkParticles(ctx, pos, {
    dir,
    alpha: al,
    sizes: sz,
    sv: st.sv,
    size: 3.3,
    density: 0.36 * light,
    halo: 0.6,
    haloRadius: 12,
    dry: 0.55,
    grain: 0.1 + 0.25 * g0,
    k: K,
    floor: FLOOR,
    seed: 9,
  });
  DEV.tick?.('fig:dabs');
  // 淡墨 body wash, painted from the head down with the strokes, and a darker head
  const B = bodyPoints();
  DEV.tick?.('fig:bodyPts');
  const nb = B.length / 2;
  const bp = new Float32Array(nb * 2);
  const ba = new Float32Array(nb);
  const bs = new Float32Array(nb);
  const top = FIG.feet - FIG.h;
  const reach = top + (FIG.h + 40) * ease.inOutSine(seg(f, INK_T.paint[0] + 8, INK_T.paint[1] + 10));
  for (let i = 0; i < nb; i++) {
    const x = B[i * 2],
      y = B[i * 2 + 1];
    const h = hash01(i, 33);
    const vis = smoothstep(reach, reach - 80, y);
    const rel = releaseAt(f, 30 * (1 - (y - top) / FIG.h) + 6 * h);
    const g = vis * (1 - rel);
    const [fx, fy] = flowField(x * 0.7 + 11, y * 0.7, t * 0.5 + h);
    const A = 4 + 120 * (1 - g) * (1 - g);
    bp[i * 2] = x + fx * A;
    bp[i * 2 + 1] = Math.max(SURFACE_Y + 8, y + fy * A + 30 * rel * (t - INK_T.release[0] / 30));
    const head = smoothstep(top + 160, top + 60, y);
    bs[i] = (1 + 1.4 * (1 - g)) * (head > 0.5 ? 1.25 : 1);
    ba[i] = (vis * (0.32 + 0.9 * head) * (0.6 + 0.4 * h)) / bs[i] * (1 - rel * 0.85);
  }
  drawInkParticles(ctx, bp, { alpha: ba, sizes: bs, size: 19, sizeJitter: 0.25, density: 0.04 * light, halo: 0.5, haloRadius: 22, wet: 0.6, grain: 0.08, k: K, floor: FLOOR, seed: 13 });
  DEV.tick?.('fig:wash');
}

// ───────────────────────────── ◀◀ → ink, title → ink ─────────────────────────────
export const TC = { x: 90, y: 340 } as const;
export const TITLE = { y: 950, pinyinY: 846 } as const;

export const TC_FONT = F.tc;
/** the ◀◀ timecode, captured as ink exactly as drawn when it melts, then spreading (sinks into the water) */
export function drawRewindInk(ctx: CanvasRenderingContext2D, f: number, light: number, text: string) {
  const tau = (f - RW.melt[0]) / 30;
  if (tau < 0 || light <= 0.01) return;
  const cap = captureMask(`tc:${text}`, TC.x - 10, TC.y - 30, 560, 60, 1, 2.6, (g) => {
    g.font = TC_FONT;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(text, TC.x, TC.y);
  });
  const gain = light * smoothstep(0, 0.2, tau) * (1 - 0.55 * smoothstep(0, 1.6, tau));
  drawSpread(ctx, cap, tau, { sinkV: 60, sinkA: 14, flowA: 0, curlA: 0, s0: 0.2, sK: 6, margin: 140, gain, t0: (RW.melt[0] - INV.handover) / 30 });
}

export const TITLE_TEXT = '熵 · 时间 · 生命';
/** draw the title glyphs (+ pinyin) exactly where the title caption lays them out */
export function drawTitleMask(c: CanvasRenderingContext2D) {
  c.font = F.title;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const ls = 0.26 * 86;
  const chars = Array.from(TITLE_TEXT);
  const ws = chars.map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = 540 - total / 2;
  chars.forEach((ch, i) => {
    c.fillText(ch, x + ws[i] / 2, TITLE.y + 86 * 0.38);
    if (i === 0) {
      c.save();
      c.font = F.pinyin;
      c.fillText('shāng', x + ws[i] / 2, TITLE.y - 62);
      c.restore();
    }
    x += ws[i] + ls;
  });
}
export function drawTitleInk(ctx: CanvasRenderingContext2D, f: number, light: number) {
  const tau = (f - END.titleMelt[0]) / 30;
  if (tau < 0 || light <= 0.01) return;
  const cap = captureMask('title', 40, TITLE.y - 130, 1000, 200, 0.75, 2.5, drawTitleMask);
  const gain = light * smoothstep(0, 0.33, tau) * (1 - 0.4 * smoothstep(0, 1.2, tau));
  drawSpread(ctx, cap, tau, { sinkV: 40, sinkA: 8, flowA: 0, curlA: 0, s0: 0.2, sK: 7, margin: 120, gain, t0: (END.titleMelt[0] - INV.handover) / 30 });
}

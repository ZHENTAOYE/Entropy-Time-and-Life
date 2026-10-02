// S09 B5–B7: everything that is INK after the inversion (drawn into the shared ink stage with multiply).
// One colour law for all of it (the inverted web's: COSMOS paper / COSMOS_INK_K / COSMOS_INK_FLOOR), so the web,
// the tendrils, the figure, the brush 你, the ◀◀ and the title are visibly the same ink at different dilutions.
//
// * tendrils — particles seeded on the inverted web's filaments and clusters (its exact geometry at the hand-over
//   frame). They sink (ink is denser than water), curl in a slow divergence-free flow, spread (dab size ∝ 1 + τ) and
//   thin at constant mass (Beer–Lambert: wider, paler, bluer). Nothing ever re-concentrates.
// * haze — the ink's fate: an almost uniform blue-grey haze that keeps growing (the S-gauge keeps rising).
// * figure — a brush travels along HUMAN_PATH from the crown down both sides; ink streams in along the contour and
//   keeps FLOWING along it while it holds (a shape kept by flow, like S07's vortex), then lets go and diffuses.
import { COSMOS_INK_FLOOR, COSMOS_INK_K, webGeometry } from '../../lib/cosmos';
import { drawInkParticles, inkStroke } from '../../lib/ink';
import { HUMAN_PATH } from '../../lib/human';
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { sampleShape } from '../../lib/points';
import { ctxOf, scratch } from './canvas';
import { Captured, captureInk, captureMask, drawSpread } from './inklocal';
import { F } from './fonts';
import { skyWeb } from './middle';
import { END, INK_T, INV, RW, SURFACE_Y } from './timing';

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

// ───────────────────────────── tendrils (the web, dispersing) ─────────────────────────────
interface Seeds {
  n: number;
  x: Float32Array;
  y: Float32Array;
  a: Float32Array; // ink mass 0..1
  h: Float32Array; // 4 randoms per particle
}
export function tendrilSeeds(): Seeds {
  return memo('s09:tendrils', () => {
    const geo = webGeometry(skyWeb(INV.handover), 40, 1080, 1920, 3);
    const r = mulberry32(1357);
    const xs: number[] = [],
      ys: number[] = [],
      as: number[] = [];
    for (const e of geo.edges) {
      const p = e.sx;
      const w = Math.min(1, e.w) * (e.layer === 0 ? 1 : 0.55);
      const step = e.layer === 0 ? 3.0 : 6.5;
      for (let k = 2; k < p.length; k += 2) {
        const ax = p[k - 2],
          ay = p[k - 1],
          bx = p[k],
          by = p[k + 1];
        const L = Math.hypot(bx - ax, by - ay);
        const n = Math.max(1, Math.round(L / step));
        const nx = -(by - ay) / (L || 1),
          ny = (bx - ax) / (L || 1);
        for (let q = 0; q < n; q++) {
          const u = (q + r()) / n;
          const off = (r() + r() - 1) * (1.5 + 3.5 * w);
          const x = ax + (bx - ax) * u + nx * off,
            y = ay + (by - ay) * u + ny * off;
          if (x < -40 || x > 1120 || y < SURFACE_Y - 20 || y > 1960) continue;
          xs.push(x);
          ys.push(y);
          as.push((0.35 + 0.65 * w) * (0.7 + 0.3 * r()));
        }
      }
    }
    // clusters: dense knots of ink
    for (const nd of geo.nodes) {
      if (nd.y < SURFACE_Y || nd.x < -40 || nd.x > 1120) continue;
      const cnt = Math.round((nd.tier === 0 ? 26 : 5) * (0.4 + nd.mass));
      for (let q = 0; q < cnt; q++) {
        const a = r() * Math.PI * 2,
          rr = (nd.tier === 0 ? 12 : 6) * Math.sqrt(r());
        xs.push(nd.x + Math.cos(a) * rr);
        ys.push(nd.y + Math.sin(a) * rr);
        as.push(0.9);
      }
    }
    const n = xs.length;
    const h = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) h[i] = r();
    return { n, x: new Float32Array(xs), y: new Float32Array(ys), a: new Float32Array(as), h };
  });
}

const nzT = makeNoise(909);
/**
 * tendril particle position at τ seconds after the hand-over. Every term is a SMOOTH field of the seed position, so
 * a filament stays one continuous thread while it bends, sinks and stretches: regions sink at different speeds
 * (veils hang down), a slow large-scale flow bends them, a finer one curls them. Spreading is shown by the dabs
 * (wider, paler), never by scattering.
 */
function tendrilPos(S: Seeds, i: number, tau: number): [number, number] {
  const x0 = S.x[i],
    y0 = S.y[i];
  const v = 8 + 13 * (0.5 + 0.5 * nzT.n2(x0 * 0.0032 + 3.1, y0 * 0.0026));
  const sink = v * tau + 1.3 * tau * tau;
  const A = 60 * (1 - Math.exp(-tau / 2.6));
  const [fx, fy] = flowField(x0 * 0.85, y0 * 0.85, tau * 0.42);
  const a2 = 16 * (1 - Math.exp(-tau / 1.6));
  const [gx, gy] = flowField(x0 * 2.6 + 170, y0 * 2.6 - 90, tau * 0.8 + 1.3);
  return [x0 + fx * A + gx * a2, y0 + fy * A + gy * a2 + sink];
}

/** draw the dispersing web; `alpha` = hand-over fade */
export function drawTendrils(ctx: CanvasRenderingContext2D, f: number, alpha: number, light: number) {
  if (alpha <= 0.003) return;
  const S = tendrilSeeds();
  const tau = Math.max(0, (f - INV.handover) / 30);
  const n = S.n;
  const pos = new Float32Array(n * 2);
  const dir = new Float32Array(n * 2);
  const al = new Float32Array(n);
  const sz = new Float32Array(n);
  const grow = 1 + 0.42 * tau;
  // the ink dilutes as it spreads (its mass goes into the haze)
  const dilute = Math.exp(-tau / 7.5) / Math.pow(grow, 0.9);
  for (let i = 0; i < n; i++) {
    const [x, y] = tendrilPos(S, i, tau);
    const [x2, y2] = tendrilPos(S, i, tau + 0.3);
    pos[i * 2] = x;
    pos[i * 2 + 1] = y;
    // dabs lie along the motion: streak-lines of sinking ink
    dir[i * 2] = (x2 - x) * 1.6;
    dir[i * 2 + 1] = (y2 - y) * 1.6;
    sz[i] = grow * (0.8 + 0.4 * S.h[i * 4 + 2]);
    al[i] = S.a[i] * alpha * dilute;
  }
  drawInkParticles(ctx, pos, {
    dir,
    alpha: al,
    sizes: sz,
    size: 2.8,
    density: 0.36 * light,
    halo: 0.7,
    haloRadius: 12,
    wet: 0.7,
    grain: 0.15,
    k: K,
    floor: FLOOR,
    seed: 5,
  });
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
function bodyPoints(): Float32Array {
  return sampleShape('s09-body', 1080, 1920, (ctx) => {
    ctx.save();
    ctx.translate(FIG.cx - 300 * FK, FIG.feet - 1402 * FK);
    ctx.scale(FK, FK);
    ctx.fill(new Path2D(HUMAN_PATH));
    ctx.restore();
  }, { step: 15, jitter: 0.9, seed: 5 });
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
  const gain = light * (1 - 0.62 * smoothstep(0, 2.6, tau));
  drawSpread(ctx, figureCapture(), tau, { sinkV: 18, sinkA: 6, flowA: 50, curlA: 14, s0: 0.2, sK: 11, margin: 170, gain });
}

function drawFigureParticles(ctx: CanvasRenderingContext2D, f: number, light: number) {
  const st = figStroke();
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
  // 淡墨 body wash, painted from the head down with the strokes, and a darker head
  const B = bodyPoints();
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
  drawSpread(ctx, cap, tau, { sinkV: 26, sinkA: 16, flowA: 26, curlA: 12, s0: 0.2, sK: 6, margin: 140, gain });
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
  drawSpread(ctx, cap, tau, { sinkV: 30, sinkA: 10, flowA: 40, curlA: 14, s0: 0.2, sK: 7, margin: 120, gain });
}

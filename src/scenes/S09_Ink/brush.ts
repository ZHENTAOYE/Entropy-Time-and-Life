// S09 — 你, the only glyph in the film with an ink-brush texture (screenplay motif 7).
// Not a font with a texture: the character is WRITTEN, stroke by stroke in its stroke order, by a round brush
// (毛笔) whose path and pressure are authored per stroke (on the skeleton of Noto Serif SC's 你, so it reads at a glance
// as the same character as the line it sits in):
//   亻 丿 · 丨 (起笔 press, 垂露 rounded end) · 尔 丿 · 乛 (横 then a pressed corner and a short hook) · 亅 (竖钩: a press
//   at the bottom, then the hook flicked up-left) · 撇点 · 点 (thin entry, heavy rounded landing).
// Each stroke is a chain of round dabs whose radius follows the pressure: round 起笔 blobs, tapered 撇 / hook exits.
// Ink: the same Beer–Lambert law as the web's ink; heavy right after the brush is loaded, thinner along each stroke; edge
// pooling (pigment collects at the edges as it dries), 飞白 (dry-brush streaks along the bristles where the brush runs
// dry: the tails of the 撇 and the hook), a ragged edge where it is dry, granulation into the paper tooth, and a wet
// 墨晕 halo bleeding into the paper's fibres (≈ 8 px, wetter right behind the brush). Everything frame-invariant is
// baked once; a frame only reveals (stroke order) and dries.
import { COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../lib/cosmos';
import { clamp, memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { ctxOf, scratch } from './canvas';

const N = 232; // working region (px): the glyph + room for its exit diffusion
const EM = 124; // the glyph's em box (px), centred in the region
const X0 = N / 2 - EM / 2,
  Y0 = N / 2 - EM / 2;

/** strokes in writing order: nodes [u, v, radius] in em units, the time window (0..1 of the painting), ink */
interface Stroke {
  nodes: Array<[number, number, number]>;
  t: [number, number];
  /** ink load at the start (1 = just dipped), dryness at the start and how fast the brush runs dry along it */
  load: number;
  dry0: number;
  dryK: number;
  /** brush speed profile: >1 = slow start (press) then fast (a flicked exit) */
  flick: number;
}
const STROKES: Stroke[] = [
  // 亻 丿
  { nodes: [[0.352, 0.042, 0.018], [0.33, 0.07, 0.05], [0.3, 0.15, 0.05], [0.25, 0.26, 0.045], [0.18, 0.37, 0.036], [0.1, 0.47, 0.022], [0.04, 0.535, 0.005]], t: [0, 0.11], load: 1.15, dry0: 0.05, dryK: 0.9, flick: 1.6 },
  // 亻 丨
  { nodes: [[0.245, 0.29, 0.02], [0.222, 0.325, 0.058], [0.212, 0.42, 0.049], [0.21, 0.62, 0.046], [0.21, 0.82, 0.046], [0.212, 0.93, 0.048], [0.214, 0.962, 0.034]], t: [0.13, 0.27], load: 1.0, dry0: 0.08, dryK: 0.45, flick: 1.0 },
  // 尔 丿
  { nodes: [[0.572, 0.035, 0.018], [0.548, 0.065, 0.05], [0.515, 0.15, 0.046], [0.47, 0.25, 0.04], [0.41, 0.34, 0.032], [0.35, 0.415, 0.02], [0.29, 0.468, 0.004]], t: [0.3, 0.4], load: 1.2, dry0: 0.04, dryK: 0.95, flick: 1.6 },
  // 尔 乛 (横 → pressed corner → short hook down-left)
  { nodes: [[0.455, 0.262, 0.022], [0.49, 0.252, 0.036], [0.6, 0.244, 0.032], [0.72, 0.236, 0.032], [0.815, 0.226, 0.038], [0.858, 0.226, 0.054], [0.852, 0.28, 0.04], [0.83, 0.345, 0.026], [0.808, 0.405, 0.005]], t: [0.42, 0.58], load: 0.95, dry0: 0.12, dryK: 0.7, flick: 1.2 },
  // 尔 亅 (竖钩)
  { nodes: [[0.648, 0.262, 0.02], [0.636, 0.3, 0.056], [0.634, 0.42, 0.05], [0.634, 0.62, 0.049], [0.634, 0.8, 0.05], [0.628, 0.895, 0.054], [0.605, 0.948, 0.06], [0.56, 0.93, 0.042], [0.505, 0.9, 0.022], [0.455, 0.874, 0.004]], t: [0.6, 0.78], load: 1.15, dry0: 0.05, dryK: 0.6, flick: 1.3 },
  // 尔 撇点
  { nodes: [[0.508, 0.425, 0.016], [0.488, 0.458, 0.046], [0.455, 0.56, 0.042], [0.4, 0.67, 0.033], [0.35, 0.745, 0.02], [0.31, 0.79, 0.005]], t: [0.8, 0.88], load: 0.95, dry0: 0.1, dryK: 0.8, flick: 1.5 },
  // 尔 点 (thin entry, heavy rounded landing)
  { nodes: [[0.74, 0.44, 0.01], [0.765, 0.5, 0.026], [0.81, 0.6, 0.044], [0.85, 0.7, 0.06], [0.866, 0.755, 0.058], [0.852, 0.78, 0.034]], t: [0.9, 1.0], load: 1.05, dry0: 0.04, dryK: 0.15, flick: 0.75 },
];

interface BrushGeo {
  /** the inked rectangle (+ room for the bleed) */
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
  T: Float32Array; // reveal time 0..1 (Infinity outside)
  rhoS: Float32Array; // dried ink density
  wetA: Float32Array; // extra density while wet
  wetM: Float32Array; // wet coverage (feeds the 墨晕)
  cov: Float32Array; // final coverage 0..1
  fib: Float32Array; // paper-fibre factor for the bleed
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t,
    t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function brushGeo(): BrushGeo {
  return memo('s09:brush:v2', () => {
    const n = N * N;
    const T = new Float32Array(n).fill(Infinity);
    const cov = new Float32Array(n);
    const depth = new Float32Array(n).fill(-1);
    const own = new Int8Array(n).fill(-1);
    const oa = new Float32Array(n); // arc fraction of the owning dab
    const ov = new Float32Array(n); // across (−1..1) of the owning dab
    const os = new Float32Array(n); // arc length (px) of the owning dab
    STROKES.forEach((S, k) => {
      // dense samples along the Catmull-Rom spline through the nodes
      const P = S.nodes.map(([u, v, r]) => [X0 + u * EM, Y0 + v * EM, r * EM] as const);
      const pts: Array<[number, number, number]> = [];
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[Math.max(0, i - 1)],
          b = P[i],
          c = P[i + 1],
          d = P[Math.min(P.length - 1, i + 2)];
        const len = Math.hypot(c[0] - b[0], c[1] - b[1]);
        const m = Math.max(2, Math.ceil(len / 0.7));
        for (let j = 0; j < m; j++) {
          const t = j / m;
          pts.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t), Math.max(0.3, catmull(a[2], b[2], c[2], d[2], t))]);
        }
      }
      const last = P[P.length - 1];
      pts.push([last[0], last[1], last[2]]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const L = cum[cum.length - 1] || 1;
      for (let i = 0; i < pts.length; i++) {
        const [cx, cy, R] = pts[i];
        const a = cum[i] / L;
        const j0 = pts[Math.max(0, i - 3)],
          j1 = pts[Math.min(pts.length - 1, i + 3)];
        let tx = j1[0] - j0[0],
          ty = j1[1] - j0[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // brush timing along the stroke: a pressed (slow) start, then faster — a flick leaves fast
        const tt = S.t[0] + (S.t[1] - S.t[0]) * Math.pow(a, 1 / S.flick);
        const xa = Math.max(0, Math.floor(cx - R - 2)),
          xb = Math.min(N - 1, Math.ceil(cx + R + 2));
        const ya = Math.max(0, Math.floor(cy - R - 2)),
          yb = Math.min(N - 1, Math.ceil(cy + R + 2));
        for (let y = ya; y <= yb; y++)
          for (let x = xa; x <= xb; x++) {
            const dx = x + 0.5 - cx,
              dy = y + 0.5 - cy;
            const dist = Math.hypot(dx, dy);
            const c = clamp(R - dist + 0.5);
            if (c <= 0) continue;
            const o = y * N + x;
            if (c > cov[o]) cov[o] = c;
            const dp = R - dist;
            if (dp > depth[o]) depth[o] = dp;
            if (c > 0.3 && tt < T[o]) {
              T[o] = tt;
              own[o] = k;
              oa[o] = a;
              ov[o] = (dx * -ty + dy * tx) / Math.max(0.5, R);
              os[o] = cum[i];
            }
          }
      }
    });
    // bake everything frame-invariant (only where the dabs reached)
    const nz = makeNoise(515);
    const rhoS = new Float32Array(n),
      wetA = new Float32Array(n),
      wetM = new Float32Array(n),
      fib = new Float32Array(n);
    let sx0 = N,
      sy0 = N,
      sx1 = 0,
      sy1 = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (cov[y * N + x] > 0) {
          if (x < sx0) sx0 = x;
          if (x > sx1) sx1 = x;
          if (y < sy0) sy0 = y;
          if (y > sy1) sy1 = y;
        }
    for (let y = sy0; y <= sy1; y++)
      for (let x = sx0; x <= sx1; x++) {
        const o = y * N + x;
        const k = own[o];
        if (k < 0) {
          // pixels only grazed by a dab's soft rim: inherit the time of the nearest owned neighbour (below)
          continue;
        }
        const S = STROKES[k];
        const a = oa[o];
        const dp = Math.max(0, depth[o]);
        const dryness = clamp(S.dry0 + S.dryK * Math.pow(a, 1.6));
        // 飞白: streaks run along the bristles (a function of the across-coordinate, slowly varying along the stroke)
        const streak = nz.n2(os[o] * 0.028 + 13 * k, ov[o] * 2.9 + 5.3 * k) * 0.62 + nz.n2(os[o] * 0.085 + 3 * k, ov[o] * 6.1 - 2 * k) * 0.38;
        const fly = smoothstep(-0.04, 0.36, streak) * smoothstep(0.12, 0.55, dryness) * smoothstep(0.5, 2.2, dp);
        // ragged edge where the brush is dry, clean where it is wet
        const edgeN = nz.n2(x * 0.33, y * 0.31) * 0.6 + nz.n2(x * 0.9, y * 0.85) * 0.4;
        const c = smoothstep(0.18, 0.78, cov[o] + 0.45 * edgeN * (1 - smoothstep(0, 2.5, dp)) * (0.35 + dryness));
        const load = S.load * (1.2 - 0.5 * a);
        const pool = Math.exp(-dp / 1.7);
        const gran = 0.84 + 0.16 * (0.5 + 0.5 * nz.n2(x * 0.75 + 31, y * 0.75 - 7));
        rhoS[o] = c * (1.9 * load + 1.1 * pool) * (1 - 0.88 * fly) * gran;
        wetA[o] = c * 0.9 * load * (1 - 0.6 * fly);
        wetM[o] = c * load;
        cov[o] = c;
      }
    // soft-rim pixels without an owner take the earliest time of their 8 neighbours (so the rim appears with the stroke)
    for (let pass = 0; pass < 2; pass++)
      for (let y = Math.max(1, sy0); y <= Math.min(N - 2, sy1); y++)
        for (let x = Math.max(1, sx0); x <= Math.min(N - 2, sx1); x++) {
          const o = y * N + x;
          if (own[o] >= 0 || cov[o] <= 0) continue;
          let best = Infinity;
          for (const d of [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1]) if (T[o + d] < best) best = T[o + d];
          if (best < Infinity && best < T[o]) T[o] = best;
        }
    for (let o = 0; o < n; o++)
      if (own[o] < 0 && cov[o] > 0 && T[o] < Infinity) {
        const c = smoothstep(0.18, 0.78, cov[o]);
        rhoS[o] = c * 1.6;
        wetA[o] = c * 0.5;
        wetM[o] = c * 0.8;
        cov[o] = c;
      }
    let bx0 = N,
      by0 = N,
      bx1 = 0,
      by1 = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (T[y * N + x] < Infinity) {
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
          if (y < by0) by0 = y;
          if (y > by1) by1 = y;
        }
    const m = 14;
    // paper fibres (for the bleed), only where it can reach: a fine felted mottle (no direction)
    for (let y = Math.max(0, by0 - m); y <= Math.min(N - 1, by1 + m); y++)
      for (let x = Math.max(0, bx0 - m); x <= Math.min(N - 1, bx1 + m); x++) {
        const fu = nz.n2(x * 0.16 + 7, y * 0.15) * 0.6 + nz.n2(x * 0.43 - 3, y * 0.4 + 11) * 0.4;
        fib[y * N + x] = clamp(0.5 + 0.85 * fu);
      }
    return { bx0: Math.max(0, bx0 - m), by0: Math.max(0, by0 - m), bx1: Math.min(N - 1, bx1 + m), by1: Math.min(N - 1, by1 + m), T, rhoS, wetA, wetM, cov, fib };
  });
}

function scratchF(key: string, n: number): Float32Array {
  const box = memo(`s09:f32:${key}`, () => ({ a: new Float32Array(1) }));
  if (box.a.length < n) box.a = new Float32Array(n);
  return box.a;
}
/** box blur of the sub-rectangle [x0, x1] × [y0, y1] of an N×N buffer (zero outside it) */
function boxBlur(a: Float32Array, r: number, passes: number, x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1) {
  if (r < 0.6) return;
  const R = Math.max(1, Math.round(r));
  const tmp = scratchF('bb', N);
  const inv = 1 / (2 * R + 1);
  const at = (o: number, i: number, lo: number, hi: number, stride: number) => (i < lo || i > hi ? 0 : a[o + i * stride]);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = y0; y <= y1; y++) {
      const o = y * N;
      let acc = 0;
      for (let x = x0 - R; x <= x0 + R; x++) acc += at(o, x, x0, x1, 1);
      for (let x = x0; x <= x1; x++) {
        tmp[x] = acc * inv;
        acc += at(o, x + R + 1, x0, x1, 1) - at(o, x - R, x0, x1, 1);
      }
      for (let x = x0; x <= x1; x++) a[o + x] = tmp[x];
    }
    for (let x = x0; x <= x1; x++) {
      let acc = 0;
      for (let y = y0 - R; y <= y0 + R; y++) acc += at(x, y, y0, y1, N);
      for (let y = y0; y <= y1; y++) {
        tmp[y] = acc * inv;
        acc += at(x, y + R + 1, y0, y1, N) - at(x, y - R, y0, y1, N);
      }
      for (let y = y0; y <= y1; y++) a[y * N + x] = tmp[y];
    }
  }
}
/** Beer–Lambert transmittance LUT (density 0 … 8) */
const BLUT_N = 1024,
  BLUT_MAX = 8;
const brushLut = () =>
  memo('s09:brush:lut', () => {
    const o = new Uint8ClampedArray(BLUT_N * 3);
    for (let i = 0; i < BLUT_N; i++) {
      const r = (i / (BLUT_N - 1)) * BLUT_MAX;
      for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.round(255 * (COSMOS_INK_FLOOR[c] + (1 - COSMOS_INK_FLOOR[c]) * Math.exp(-r * COSMOS_INK_K[c])));
    }
    return o;
  });

/** seconds the whole painting takes (to turn "u since painted" into seconds for the drying) */
export const BRUSH_SECONDS = 1.6;

/**
 * Paint 你 with its em box centred at (cx, cy). `u` = painting progress 0..1 (the brush), `dif` = exit diffusion 0..1,
 * `light` = light-table power (ink is absorption: no light, nothing to see).
 */
export function drawBrushNi(ctx: CanvasRenderingContext2D, cx: number, cy: number, u: number, dif: number, light: number) {
  if (u <= 0 || light <= 0.01) return;
  const G = brushGeo();
  const n = N * N;
  // while it is painted and held, only the glyph's rectangle is worked on; the exit spreads over the whole region
  const full = dif > 0;
  const x0 = full ? 0 : G.bx0,
    y0 = full ? 0 : G.by0,
    x1 = full ? N - 1 : G.bx1,
    y1 = full ? N - 1 : G.by1;
  const rho = scratchF('rho', n);
  const wet = scratchF('wet', n);
  if (full) {
    rho.fill(0, 0, n);
    wet.fill(0, 0, n);
  }
  for (let y = G.by0; y <= G.by1; y++)
    for (let x = G.bx0; x <= G.bx1; x++) {
      const i = y * N + x;
      const T = G.T[i];
      if (!(T <= u)) {
        rho[i] = 0;
        wet[i] = 0;
        continue;
      }
      const w = Math.exp(-((u - T) * BRUSH_SECONDS) / 0.35);
      rho[i] = G.rhoS[i] + G.wetA[i] * w;
      wet[i] = G.wetM[i] * (0.45 + 1.1 * w);
    }
  // 墨晕: the wet ink bleeds into the paper fibres around the strokes (outside them, uneven, feathery)
  boxBlur(wet, 5, 2, G.bx0, G.by0, G.bx1, G.by1);
  const out = scratchF('out', n);
  if (full) out.fill(0, 0, n);
  for (let y = G.by0; y <= G.by1; y++)
    for (let x = G.bx0; x <= G.bx1; x++) {
      const i = y * N + x;
      out[i] = rho[i] + wet[i] * 1.1 * (0.3 + 0.95 * G.fib[i] * G.fib[i]) * (1 - G.cov[i] * 0.7);
    }
  // exit: the painted ink diffuses at constant mass (wider, paler, bluer)
  if (full) boxBlur(out, 1 + 30 * dif, 3);
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1;
  const c = scratch('brushOut', w, h);
  const g = ctxOf(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  const L = brushLut();
  const lk = ((BLUT_N - 1) / BLUT_MAX) * light * (1 - 0.45 * dif);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const li = Math.min(BLUT_N - 1, (out[(y + y0) * N + x + x0] * lk) | 0) * 3;
      const o = (y * w + x) * 4;
      d[o] = L[li];
      d[o + 1] = L[li + 1];
      d[o + 2] = L[li + 2];
      d[o + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, cx - N / 2 + x0, cy - N / 2 + y0 + 34 * dif);
  ctx.restore();
}
/** the brush glyph's layout advance (one em) */
export const BRUSH_EM = EM;

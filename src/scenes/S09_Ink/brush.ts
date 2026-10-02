// S09 — 你, the only glyph in the film with an ink-brush texture (screenplay motif 7).
// The glyph is PAINTED, stroke by stroke, with the same ink (Beer–Lambert, the inverted web's absorption law):
//   * reveal: geodesic distance inside the glyph from the start of each stroke of 你 (丿 丨 / 丿 乛 亅 丿 丶, in
//     writing order, each starting a little after the previous) → a wet front runs down every stroke;
//   * body: dense ink with edge pooling (pigment collects at the stroke's edges as it dries) and 飞白 — dry-brush
//     streaks that run ALONG the strokes (direction from the structure tensor of the glyph);
//   * 墨晕: capillary bleed into the paper fibres around the strokes, wetter where the brush has just passed;
//   * exit: the painted ink diffuses at constant mass — wider, paler, bluer — and sinks a little.
import { COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../lib/cosmos';
import { clamp, memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { ctxOf, scratch } from './canvas';

const N = 260; // working region (px)
const PAD = 68;

interface BrushGeo {
  m: Float32Array; // glyph coverage 0..1
  dist: Float32Array; // inside distance to the edge (px)
  dirx: Float32Array; // unit stroke direction
  diry: Float32Array;
  T: Float32Array; // reveal time 0..1 (Infinity outside)
  fib: Float32Array; // paper-fibre noise for the bleed
}

/** normalised stroke starts of 你 (glyph em box, writing order) and their start times */
const SEEDS: Array<[number, number, number]> = [
  [0.33, 0.06, 0.0], // 亻 丿
  [0.25, 0.4, 0.13], // 亻 丨
  [0.57, 0.05, 0.27], // 尔 丿
  [0.5, 0.3, 0.36], // 尔 乛
  [0.68, 0.42, 0.5], // 尔 亅
  [0.5, 0.64, 0.66], // 尔 left dot
  [0.82, 0.62, 0.76], // 尔 right dot
];

function brushGeo(font: string, size: number): BrushGeo {
  return memo(`s09:brush:${font}`, () => {
    const c = scratch('brushMask', N, N);
    const g = ctxOf(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, N, N);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText('你', N / 2, N / 2);
    const data = g.getImageData(0, 0, N, N).data;
    const m = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) m[i] = data[i * 4 + 3] / 255;
    // inside distance (chamfer 3-4, two passes)
    const INF = 1e6;
    const dist = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) dist[i] = m[i] > 0.5 ? INF : 0;
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const k = y * N + x;
        if (dist[k] === 0) continue;
        dist[k] = Math.min(dist[k], dist[k - 1] + 3, dist[k - N] + 3, dist[k - N - 1] + 4, dist[k - N + 1] + 4);
      }
    for (let y = N - 2; y > 0; y--)
      for (let x = N - 2; x > 0; x--) {
        const k = y * N + x;
        if (dist[k] === 0) continue;
        dist[k] = Math.min(dist[k], dist[k + 1] + 3, dist[k + N] + 3, dist[k + N + 1] + 4, dist[k + N - 1] + 4);
      }
    for (let i = 0; i < N * N; i++) dist[i] = dist[i] >= INF ? 0 : dist[i] / 3;
    // stroke direction from the structure tensor of the coverage (smoothed)
    const gx = new Float32Array(N * N),
      gy = new Float32Array(N * N);
    for (let y = 1; y < N - 1; y++)
      for (let x = 1; x < N - 1; x++) {
        const k = y * N + x;
        gx[k] = (m[k + 1] - m[k - 1]) * 0.5;
        gy[k] = (m[k + N] - m[k - N]) * 0.5;
      }
    const jxx = new Float32Array(N * N),
      jxy = new Float32Array(N * N),
      jyy = new Float32Array(N * N);
    const R = 5;
    // box-smooth the tensor (separable) — enough to orient the inside of the strokes
    const tmp = new Float32Array(N * N);
    const smooth = (src: Float32Array, dst: Float32Array) => {
      for (let y = 0; y < N; y++) {
        let acc = 0;
        for (let x = -R; x <= R; x++) acc += src[y * N + Math.min(N - 1, Math.max(0, x))];
        for (let x = 0; x < N; x++) {
          tmp[y * N + x] = acc;
          acc += src[y * N + Math.min(N - 1, x + R + 1)] - src[y * N + Math.max(0, x - R)];
        }
      }
      for (let x = 0; x < N; x++) {
        let acc = 0;
        for (let y = -R; y <= R; y++) acc += tmp[Math.min(N - 1, Math.max(0, y)) * N + x];
        for (let y = 0; y < N; y++) {
          dst[y * N + x] = acc;
          acc += tmp[Math.min(N - 1, y + R + 1) * N + x] - tmp[Math.max(0, y - R) * N + x];
        }
      }
    };
    const a = new Float32Array(N * N),
      b = new Float32Array(N * N),
      cc = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      a[i] = gx[i] * gx[i];
      b[i] = gx[i] * gy[i];
      cc[i] = gy[i] * gy[i];
    }
    smooth(a, jxx);
    smooth(b, jxy);
    smooth(cc, jyy);
    const dirx = new Float32Array(N * N),
      diry = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) {
      const th = 0.5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2; // along the stroke
      dirx[i] = Math.cos(th);
      diry[i] = Math.sin(th);
    }
    // reveal time: multi-source geodesic distance inside the glyph (Dijkstra-ish with a bucket queue)
    const T = new Float32Array(N * N).fill(Infinity);
    const box = size; // em box ≈ font size
    const x0 = N / 2 - box / 2,
      y0 = N / 2 - box / 2;
    const V = box * 1.15; // px per unit time
    let frontier: number[] = [];
    for (const [sx, sy, st] of SEEDS) {
      // snap the seed to the nearest inked pixel
      let best = -1,
        bd = 1e9;
      const px = x0 + sx * box,
        py = y0 + sy * box;
      for (let y = Math.max(0, Math.floor(py - 24)); y < Math.min(N, py + 24); y++)
        for (let x = Math.max(0, Math.floor(px - 24)); x < Math.min(N, px + 24); x++) {
          const k = y * N + x;
          if (m[k] < 0.5) continue;
          const d = (x - px) ** 2 + (y - py) ** 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
      if (best >= 0 && st < T[best]) {
        T[best] = st;
        frontier.push(best);
      }
    }
    // relax repeatedly (simple label-correcting sweep; N is small)
    const nb = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1];
    const nbd = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
    let iter = 0;
    while (frontier.length && iter < 4000) {
      iter++;
      const next: number[] = [];
      for (const k of frontier) {
        const tk = T[k];
        for (let q = 0; q < 8; q++) {
          const j = k + nb[q];
          if (j < 0 || j >= N * N || m[j] < 0.35) continue;
          const tj = tk + nbd[q] / V;
          if (tj < T[j] - 1e-6) {
            T[j] = tj;
            next.push(j);
          }
        }
      }
      frontier = next;
    }
    let tmax = 0;
    for (let i = 0; i < N * N; i++) if (Number.isFinite(T[i])) tmax = Math.max(tmax, T[i]);
    for (let i = 0; i < N * N; i++) if (Number.isFinite(T[i])) T[i] /= tmax || 1;
    // paper fibres: anisotropic noise at random orientations (for the bleed)
    const nz = makeNoise(77);
    const fib = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = nz.n2(x * 0.09, y * 0.02) * 0.5 + nz.n2(x * 0.025 + 7, y * 0.11) * 0.5;
        fib[y * N + x] = clamp(0.5 + 0.9 * u);
      }
    return { m, dist, dirx, diry, T, fib };
  });
}

const nzB = makeNoise(515);
function boxBlur(a: Float32Array, r: number) {
  if (r < 0.6) return;
  const R = Math.max(1, Math.round(r));
  const tmp = scratchF('bb', N);
  const inv = 1 / (2 * R + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < N; y++) {
      const o = y * N;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[o + Math.min(N - 1, Math.max(0, x))];
      for (let x = 0; x < N; x++) {
        tmp[x] = acc * inv;
        acc += a[o + Math.min(N - 1, x + R + 1)] - a[o + Math.max(0, x - R)];
      }
      for (let x = 0; x < N; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < N; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += a[Math.min(N - 1, Math.max(0, y)) * N + x];
      for (let y = 0; y < N; y++) {
        tmp[y] = acc * inv;
        acc += a[Math.min(N - 1, y + R + 1) * N + x] - a[Math.max(0, y - R) * N + x];
      }
      for (let y = 0; y < N; y++) a[y * N + x] = tmp[y];
    }
  }
}
function scratchF(key: string, n: number): Float32Array {
  const box = memo(`s09:f32:${key}`, () => ({ a: new Float32Array(1) }));
  if (box.a.length < n) box.a = new Float32Array(n);
  return box.a;
}

/**
 * Paint 你 centred at (cx, cy). `u` = painting progress 0..1 (the brush), `dif` = exit diffusion 0..1,
 * `light` = light-table power (ink is absorption: no light, nothing to see).
 */
export function drawBrushNi(ctx: CanvasRenderingContext2D, font: string, size: number, cx: number, cy: number, u: number, dif: number, light: number) {
  if (u <= 0 || light <= 0.01) return;
  const G = brushGeo(font, size);
  const rho = scratchF('rho', N * N);
  const wetM = scratchF('wet', N * N);
  const U = u * 1.08;
  for (let i = 0; i < N * N; i++) {
    const T = G.T[i];
    const x = i % N,
      y = (i / N) | 0;
    // ragged, fibrous stroke edge: the coverage threshold wobbles with the paper's fibres
    const edgeN = nzB.n2(x * 0.21, y * 0.05) * 0.5 + nzB.n2(x * 0.06 + 9, y * 0.23) * 0.5;
    const m = smoothstep(0.22, 0.62, G.m[i] + 0.3 * edgeN * (1 - Math.min(1, G.dist[i] / 4)));
    if (m <= 0.01 || !(T < U)) {
      rho[i] = 0;
      wetM[i] = 0;
      continue;
    }
    const since = U - T;
    const painted = smoothstep(0, 0.04, since) * m;
    const wet = Math.exp(-since / 0.16);
    // 飞白: dry-brush streaks along the stroke direction — strongest where the brush runs out (late in a stroke)
    const dx = G.dirx[i],
      dy = G.diry[i];
    const along = x * dx + y * dy,
      across = -x * dy + y * dx;
    const streak = nzB.n2(along * 0.03, across * 0.55) * 0.6 + nzB.n2(along * 0.09 + 5, across * 1.1) * 0.4;
    const dryness = 0.12 + 0.88 * smoothstep(0.25, 0.9, T);
    const fly = smoothstep(-0.05, 0.35, streak) * dryness * (1 - 0.8 * wet) * smoothstep(1.2, 3.5, G.dist[i] + 1.5);
    // edge pooling (pigment collects at the edges as the stroke dries), 焦墨 at the start of the brush, drier tails
    const pool = Math.exp(-G.dist[i] / 2.0);
    const load = 1.25 - 0.55 * T;
    // granulation into the paper tooth
    const gran = 0.82 + 0.18 * (0.5 + 0.5 * nzB.n2(x * 0.7, y * 0.7));
    rho[i] = painted * (2.0 * load + 1.5 * pool + 1.6 * wet) * (1 - 0.92 * fly) * gran;
    wetM[i] = painted * (0.5 + 1.2 * wet) * load;
  }
  // 墨晕: the wet ink bleeds into the paper fibres around the strokes
  const halo = scratchF('halo', N * N);
  halo.set(wetM.subarray(0, N * N));
  boxBlur(halo, 4.5 + 4 * dif);
  const out = scratchF('out', N * N);
  // the bleed creeps out along the paper fibres (uneven, feathery)
  for (let i = 0; i < N * N; i++) out[i] = rho[i] + halo[i] * 0.85 * (0.35 + 0.9 * G.fib[i] * G.fib[i]) * (1 - G.m[i] * 0.5);
  // exit: the painted ink diffuses at constant mass (wider, paler, bluer)
  if (dif > 0) boxBlur(out, 1 + 30 * dif);
  const c = scratch('brushOut', N, N);
  const g = ctxOf(c);
  const img = g.createImageData(N, N);
  const d = img.data;
  const K = COSMOS_INK_K,
    F0 = COSMOS_INK_FLOOR;
  const dens = light * (1 - 0.45 * dif);
  for (let i = 0; i < N * N; i++) {
    const r = out[i] * dens;
    const o = i * 4;
    for (let ch = 0; ch < 3; ch++) d[o + ch] = 255 * (F0[ch] + (1 - F0[ch]) * Math.exp(-r * K[ch]));
    d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, cx - N / 2, cy - N / 2 + 34 * dif);
  ctx.restore();
}
export const BRUSH_PAD = PAD;

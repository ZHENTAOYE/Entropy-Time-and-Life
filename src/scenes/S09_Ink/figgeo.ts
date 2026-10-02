// S09 B5 — the ink-wash human's GEOMETRY (pure JS, no DOM; memoised once per tab).
//   * the contour: HUMAN_PATH (lib/human.ts) flattened exactly (its cubic Béziers) and resampled every 1 px in frame
//     coordinates, with unit tangents and OUTWARD normals;
//   * its DOWNHILL RUNS: the ink flows down the outline, so the contour splits into runs from a source (a local top:
//     the crown, the armpits, the crotch) to a sink (a local bottom: the hands, the feet). Within a run a time-like
//     coordinate θ = ∫ ds / max(ε, |t_y|) makes "flowing down the outline" a shift in θ: ink slows (and piles up) where
//     the outline is nearly horizontal (shoulders, hand and foot bottoms) and races down where it is steep;
//   * the BAND: for every frame pixel within BAND px of the outline (in the figure's box), its nearest contour sample and
//     its signed distance (+ outside) — the per-pixel coordinates of the procedural brush stroke (figure.ts);
//   * a fast lattice value noise.
import { HUMAN_PATH } from '../../lib/human';
import { memo } from '../../lib/math';
import { mulberry32 } from '../../lib/random';

/** the figure: 940 px tall, feet at y 1295 (head top 355: 55 px under the water line; clear of the captions) */
export const FIG = { h: 940, feet: 1295, cx: 540 } as const;
export const FK = FIG.h / 1344;
export const FIG_TOP = FIG.feet - FIG.h;
export const OX = FIG.cx - 300 * FK,
  OY = FIG.feet - 1402 * FK;

/** the stroke's box (frame px; multiples of 4 so the quarter-res release capture is frame-aligned) */
export const BX = 340,
  BY = 300,
  BW = 400,
  BH = 1060;
/** half-width of the band around the outline in which the stroke, its bleed and its drips can live */
export const BAND = 46;

export interface Run {
  /** sample indices, upstream (source) → downstream (sink) */
  order: Int32Array;
  /** θ at each (θ-px, increasing) */
  theta: Float32Array;
  thMax: number;
  /** arc length along the run (px) at each */
  arc: Float32Array;
  srcX: number;
  srcY: number;
  sinkX: number;
  sinkY: number;
}
export interface Contour {
  N: number;
  X: Float32Array;
  Y: Float32Array;
  TX: Float32Array;
  TY: Float32Array;
  /** outward unit normal */
  NX: Float32Array;
  NY: Float32Array;
  /** smoothed t_y (±20 px): the local slope of the outline */
  PHI: Float32Array;
  run: Int16Array;
  kIn: Int32Array;
  /** θ, θ/θmax and the arc length along the run, per sample */
  TH: Float32Array;
  U: Float32Array;
  ARC: Float32Array;
  runs: Run[];
}

/** HUMAN_PATH (M · C · Z only) flattened into frame coordinates */
function flatten(): Float64Array {
  const toks = HUMAN_PATH.match(/[MCZ]|-?\d*\.?\d+/g) ?? [];
  const out: number[] = [];
  let i = 0,
    cx = 0,
    cy = 0;
  const P = (x: number, y: number) => out.push(OX + x * FK, OY + y * FK);
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'M') {
      cx = +toks[i++];
      cy = +toks[i++];
      P(cx, cy);
    } else if (c === 'C') {
      const x1 = +toks[i++],
        y1 = +toks[i++],
        x2 = +toks[i++],
        y2 = +toks[i++],
        x3 = +toks[i++],
        y3 = +toks[i++];
      for (let k = 1; k <= 40; k++) {
        const t = k / 40,
          u = 1 - t;
        P(u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
      }
      cx = x3;
      cy = y3;
    }
  }
  const n = out.length / 2;
  if (n > 1 && Math.hypot(out[0] - out[(n - 1) * 2], out[1] - out[(n - 1) * 2 + 1]) < 1e-6) out.length -= 2;
  return Float64Array.from(out);
}

export function contour(): Contour {
  return memo('s09:figgeo:contour', () => {
    const pts = flatten();
    const P = pts.length / 2;
    const cum = new Float64Array(P + 1);
    for (let k = 1; k <= P; k++) {
      const a = (k - 1) % P,
        b = k % P;
      cum[k] = cum[k - 1] + Math.hypot(pts[b * 2] - pts[a * 2], pts[b * 2 + 1] - pts[a * 2 + 1]);
    }
    const L = cum[P];
    const N = Math.round(L);
    const X = new Float32Array(N),
      Y = new Float32Array(N);
    let sg = 0;
    for (let j = 0; j < N; j++) {
      const s = (j * L) / N;
      while (cum[sg + 1] < s) sg++;
      const a = (s - cum[sg]) / Math.max(1e-9, cum[sg + 1] - cum[sg]);
      const p0 = sg % P,
        p1 = (sg + 1) % P;
      X[j] = pts[p0 * 2] + (pts[p1 * 2] - pts[p0 * 2]) * a;
      Y[j] = pts[p0 * 2 + 1] + (pts[p1 * 2 + 1] - pts[p0 * 2 + 1]) * a;
    }
    const TX = new Float32Array(N),
      TY = new Float32Array(N),
      NX = new Float32Array(N),
      NY = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const a = (j - 3 + N) % N,
        b = (j + 3) % N;
      const dx = X[b] - X[a],
        dy = Y[b] - Y[a];
      const l = Math.hypot(dx, dy) || 1;
      TX[j] = dx / l;
      TY[j] = dy / l;
      // the path runs clockwise on screen (y down) from the crown: the outside is on the left of the direction of travel
      NX[j] = TY[j];
      NY[j] = -TX[j];
    }
    // smoothed t_y (±20 px, circular)
    const R = 20;
    const PHI = new Float32Array(N);
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += TY[(k + N) % N];
    for (let j = 0; j < N; j++) {
      PHI[j] = acc / (2 * R + 1);
      acc += TY[(j + R + 1) % N] - TY[(j - R + N) % N];
    }
    const sgn = new Int8Array(N);
    for (let j = 0; j < N; j++) sgn[j] = PHI[j] >= 0 ? 1 : -1;
    // merge runs shorter than 28 px into their neighbours
    for (let pass = 0; pass < 4; pass++) {
      let b0 = -1;
      for (let j = 0; j < N; j++)
        if (sgn[j] !== sgn[(j - 1 + N) % N]) {
          b0 = j;
          break;
        }
      if (b0 < 0) break;
      let start = b0;
      let changed = false;
      for (let q = 1; q <= N; q++) {
        const j = (b0 + q) % N;
        if (q === N || sgn[j] !== sgn[(j - 1 + N) % N]) {
          const len = (j - start + N) % N || N;
          if (len < 28) {
            for (let m = 0; m < len; m++) sgn[(start + m) % N] *= -1;
            changed = true;
          }
          start = j;
        }
      }
      if (!changed) break;
    }
    let b0 = 0;
    for (let j = 0; j < N; j++)
      if (sgn[j] !== sgn[(j - 1 + N) % N]) {
        b0 = j;
        break;
      }
    const run = new Int16Array(N),
      kIn = new Int32Array(N),
      TH = new Float32Array(N),
      U = new Float32Array(N),
      ARC = new Float32Array(N);
    const runs: Run[] = [];
    let cur: number[] = [b0];
    const close = () => {
      const dir = sgn[cur[0]];
      const order = Int32Array.from(dir > 0 ? cur : cur.slice().reverse());
      const theta = new Float32Array(order.length),
        arc = new Float32Array(order.length);
      for (let k = 1; k < order.length; k++) {
        theta[k] = theta[k - 1] + 1 / Math.max(0.22, Math.abs(PHI[order[k]]));
        arc[k] = arc[k - 1] + 1;
      }
      const r = runs.length;
      const a = order[0],
        z = order[order.length - 1];
      const thMax = theta[order.length - 1];
      runs.push({ order, theta, thMax, arc, srcX: X[a], srcY: Y[a], sinkX: X[z], sinkY: Y[z] });
      for (let k = 0; k < order.length; k++) {
        const j = order[k];
        run[j] = r;
        kIn[j] = k;
        TH[j] = theta[k];
        U[j] = theta[k] / Math.max(1, thMax);
        ARC[j] = arc[k];
      }
    };
    for (let q = 1; q < N; q++) {
      const j = (b0 + q) % N;
      if (sgn[j] !== sgn[(j - 1 + N) % N]) {
        close();
        cur = [];
      }
      cur.push(j);
    }
    close();
    return { N, X, Y, TX, TY, NX, NY, PHI, run, kIn, TH, U, ARC, runs };
  });
}

/** arc position (fractional sample index along the run) at θ on run r */
export function runIndexAt(r: Run, th: number): number {
  const n = r.order.length;
  if (th <= 0) return 0;
  if (th >= r.thMax) return n - 1;
  let a = 0,
    b = n - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (r.theta[m] <= th) a = m;
    else b = m;
  }
  return a + (th - r.theta[a]) / Math.max(1e-6, r.theta[b] - r.theta[a]);
}

export interface Band {
  /** box pixel index (y·BW + x) of every band pixel, row-major */
  idx: Int32Array;
  /** its nearest contour sample */
  J: Int16Array;
  /** its signed distance to the outline (px, + outside) */
  D: Float32Array;
  n: number;
}
/**
 * Every box pixel within BAND px of the outline: its nearest contour sample and signed distance. The nearest sample is
 * found exactly at half resolution (every 2nd sample against every 2-px cell within reach: no "ray" artefacts at the
 * concave corners), then each full-res pixel is refined against the samples around its cell's (exact point-to-segment
 * distance, signed by the segment's outward normal).
 */
export function band(): Band {
  return memo('s09:figgeo:band', () => {
    const C = contour();
    const { N, X, Y, NX, NY } = C;
    const HW = BW / 2,
      HH = BH / 2;
    const HJ = new Int32Array(HW * HH).fill(-1);
    const HD = new Float32Array(HW * HH).fill(1e18);
    const R = Math.ceil(BAND / 2) + 2;
    for (let j = 0; j < N; j += 2) {
      const cx = (X[j] - BX) / 2 - 0.5,
        cy = (Y[j] - BY) / 2 - 0.5;
      const xa = Math.max(0, Math.floor(cx - R)),
        xb = Math.min(HW - 1, Math.ceil(cx + R)),
        ya = Math.max(0, Math.floor(cy - R)),
        yb = Math.min(HH - 1, Math.ceil(cy + R));
      for (let y = ya; y <= yb; y++) {
        const dy = y - cy;
        const dy2 = dy * dy;
        const row = y * HW;
        for (let x = xa; x <= xb; x++) {
          const dx = x - cx;
          const d2 = dx * dx + dy2;
          if (d2 < HD[row + x]) {
            HD[row + x] = d2;
            HJ[row + x] = j;
          }
        }
      }
    }
    const lim = (BAND / 2 + 1.5) * (BAND / 2 + 1.5);
    // refine at full res: exact distance to the polyline around the cell's sample
    const idx = new Int32Array(BW * BH),
      JJ = new Int16Array(BW * BH),
      DD = new Float32Array(BW * BH);
    let cnt = 0;
    for (let y = 0; y < BH; y++)
      for (let x = 0; x < BW; x++) {
        const o = y * BW + x;
        const h = (y >> 1) * HW + (x >> 1);
        if (HD[h] > lim) continue;
        const j0 = HJ[h];
        if (j0 < 0) continue;
        const px = BX + x + 0.5,
          py = BY + y + 0.5;
        let best = 1e18,
          bj = j0,
          bs = 0;
        for (let k = -3; k <= 2; k++) {
          const a = (j0 + k + N) % N,
            b = (a + 1) % N;
          const ex = X[b] - X[a],
            ey = Y[b] - Y[a];
          const l2 = ex * ex + ey * ey || 1;
          let u = ((px - X[a]) * ex + (py - Y[a]) * ey) / l2;
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          const qx = X[a] + ex * u - px,
            qy = Y[a] + ey * u - py;
          const d2 = qx * qx + qy * qy;
          if (d2 < best) {
            best = d2;
            bj = u < 0.5 ? a : b;
            bs = (px - (X[a] + ex * u)) * NX[a] + (py - (Y[a] + ey * u)) * NY[a];
          }
        }
        const dist = Math.sqrt(best);
        if (dist > BAND) continue;
        idx[cnt] = o;
        JJ[cnt] = bj;
        DD[cnt] = bs >= 0 ? dist : -dist;
        cnt++;
      }
    return { idx: idx.slice(0, cnt), J: JJ.slice(0, cnt), D: DD.slice(0, cnt), n: cnt };
  });
}

// ───────────────────────────── fast lattice value noise (0..1) ─────────────────────────────
const VN = memo('s09:figgeo:vn', () => {
  const r = mulberry32(90917);
  const t = new Float32Array(256 * 256);
  for (let i = 0; i < t.length; i++) t[i] = r();
  return t;
});
/** smooth value noise, lattice spacing 1, period 256, 0..1 */
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255,
    y0 = yi & 255,
    x1 = (x0 + 1) & 255,
    y1 = (y0 + 1) & 255;
  const a = VN[(y0 << 8) | x0],
    b = VN[(y0 << 8) | x1],
    c = VN[(y1 << 8) | x0],
    d = VN[(y1 << 8) | x1];
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

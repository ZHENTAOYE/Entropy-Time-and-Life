// S09 B5 — THE INK-WASH HUMAN, painted by the web's OWN ink, by flow (never by concentration).
//
// The screenplay: "the spreading ink briefly gathers into the human figure" — and the film's whole argument is that ink
// never gathers by itself (S01 「没人见过它自己聚回来」). So nothing here un-mixes ink:
//   1. THE LENS (from f505, crown first). Near an invisible form the water converges onto its outline (a convergence
//      line, like the foam lines a current draws on a river) and runs down along it: the web's threads near the form are
//      drawn onto the outline — a thread lying over the crown is pulled down onto it — and dragged downhill along it,
//      before any line is drawn (inkfield.ts applies this warp to the web's own density, which is only ever moved).
//   2. THE POUR (f538–604). From the crown, both sides together (then from the armpits and the crotch as the front passes
//      them), the ink runs DOWN the outline: every stretch of the contour flows downhill, from a source (crown, armpits,
//      crotch) to a sink (hands, feet), where it drips off and sinks. The line is one brush stroke per run (figgeo.ts):
//        · 提按 thick–thin by physics: the ink accumulates downstream and slows (piles up) where the outline is nearly
//          horizontal (shoulders, hand and foot bottoms), and races thin down the steep stretches;
//        · 飞白: just below a source the stroke is dry — it breaks into bristle streaks with ragged edges — and gets wetter
//          and heavier toward the sink;
//        · 墨晕: an uneven wet bleed, wider downstream, pooling in places;
//        · the wet tip of each run is a heavier bead; beads of ink keep running down every run during the hold, the
//          bristle texture streams downhill, drips fall from the hands and feet, and the line sways with the water —
//          a shape KEPT BY FLOW, like S07's vortex.
//      Its optical density is soft-capped at the field's own current maximum near the figure (inkfield.fieldPeak):
//      slate blue, never the #0A0B10 of fresh ink.
//   3. THE CLEARING. Inside the body the web's threads are thinned (~72 %, dense knots more) — the ink that drew the
//      outline came from there — a pale band runs outside the outline, and a wet, uneven 淡墨 wash (the head a little
//      darker) slowly streams down inside the body (inkfield.ts: in the same density field, blurred with it).
//   4. THE RELEASE (f688–784). The form stops being maintained: the stroke widens and pales (constant mass) while its
//      ink is handed to the tank's water (inkfield.ts: the late flow carries it, the warp, the clearing and the wash off
//      together). The S-gauge rises the whole time.
import { COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../lib/cosmos';
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { ctxOf, scratch } from './canvas';
import { V, velAt } from './flow';
import { BH, BW, BX, BY, FIG, FIG_TOP, band, contour, runIndexAt, vnoise } from './figgeo';
import { INK_T, INV } from './timing';

export { FIG, FIG_TOP } from './figgeo';
const K = COSMOS_INK_K,
  FLOOR = COSMOS_INK_FLOOR;

// ───────────────────────────── time ─────────────────────────────
/** the lens: 0 → 1, the crown first (y in frame px) */
export function lensAmt(f: number, y: number): number {
  const yn = clamp((y - FIG_TOP) / FIG.h);
  return ease.inOutSine(seg(f - INK_T.lensLag * yn, INK_T.lens[0], INK_T.lens[1]));
}
/** the pour front (frame y): from above the crown to below the feet (the clearing and the wash follow it) */
export const yFront = (f: number) => FIG_TOP - 40 + (FIG.h + 150) * ease.inOutSine(seg(f, INK_T.paint[0], INK_T.paint[1]));
/** 0 → 1 once the pour front has passed y */
export const paintK = (f: number, y: number) => smoothstep(-10, 70, yFront(f) - y);
/** tank time (s since the hand-over) at which the figure is let go: the fields freeze their figure terms here */
export const TAU_REL = (INK_T.hold - INV.handover) / 30;
/** the hand-over from the live stroke to the released ink (in density), over a second */
const RELEASE_FRAMES = 30;
const releaseK = (f: number) => smoothstep(INK_T.hold, INK_T.hold + RELEASE_FRAMES, f);
/** how much of the released stroke's ink is still in its own threads (the rest has joined the haze), × the hand-over */
export const releaseGain = (f: number) => releaseK(f) * (1 - 0.8 * smoothstep(0.1, 2.2, (f - INK_T.hold) / 30));

/** the speed of the pour front along a run (θ-px/s), of the beads running down it, of the streaming bristle texture */
const U_POUR = 560,
  U_BEAD = 170,
  U_TEX = 46;
/** the frame each run's pour starts: when the pour front (yFront) reaches its source */
function runStarts(): Float32Array {
  return memo('s09:fig:runStarts', () => {
    const C = contour();
    const out = new Float32Array(C.runs.length);
    C.runs.forEach((r, i) => {
      let f = INK_T.paint[0];
      while (f < INK_T.paint[1] && yFront(f) < r.srcY + 6) f += 0.25;
      out[i] = f;
    });
    return out;
  });
}
/** θ reached by the pour front on run r at frame f (a slow start, then U_POUR) */
function frontTheta(r: number, f: number): number {
  const tau = (f - runStarts()[r]) / 30;
  if (tau <= 0) return -1;
  return (U_POUR * tau * tau) / (tau + 0.22);
}

// ───────────────────────────── the lens grid (for inkfield) ─────────────────────────────
/** the figure's grid (frame px): every LG px over [LX0, LX0 + LG·LW) × [LY0, LY0 + LG·LH) */
export const LG = 4;
export const LX0 = 320,
  LY0 = 296,
  LW = 112,
  LH = 266;
export interface FigGrid {
  /** signed distance to the outline (px, + outside) */
  D: Float32Array;
  /** static depletion profile 0..1, and how much "inside the body" a node is (dense knots are thinned harder there) */
  dep: Float32Array;
  inn: Float32Array;
  /** the warp's static parts: convergence onto the outline (WX, WY: profile × smoothed outward normal) and the slide
   *  down along it (SX, SY: profile × smoothed downhill tangent) */
  WX: Float32Array;
  WY: Float32Array;
  SX: Float32Array;
  SY: Float32Array;
  /** wash: inside weight, head weight */
  inW: Float32Array;
  head: Float32Array;
}
/** separable box blur on the grid (clamped edges) */
function gridBlur(a: Float32Array, R: number, passes: number) {
  const tmp = new Float32Array(Math.max(LW, LH));
  const inv = 1 / (2 * R + 1);
  for (let p = 0; p < passes; p++) {
    for (let k = 0; k < LH; k++) {
      const o = k * LW;
      let acc = 0;
      for (let i = -R; i <= R; i++) acc += a[o + Math.min(LW - 1, Math.max(0, i))];
      for (let i = 0; i < LW; i++) {
        tmp[i] = acc * inv;
        acc += a[o + Math.min(LW - 1, i + R + 1)] - a[o + Math.max(0, i - R)];
      }
      for (let i = 0; i < LW; i++) a[o + i] = tmp[i];
    }
    for (let i = 0; i < LW; i++) {
      let acc = 0;
      for (let k = -R; k <= R; k++) acc += a[Math.min(LH - 1, Math.max(0, k)) * LW + i];
      for (let k = 0; k < LH; k++) {
        tmp[k] = acc * inv;
        acc += a[Math.min(LH - 1, k + R + 1) * LW + i] - a[Math.max(0, k - R) * LW + i];
      }
      for (let k = 0; k < LH; k++) a[k * LW + i] = tmp[k];
    }
  }
}
export function figGrid(): FigGrid {
  return memo('s09:fig:grid', () => {
    const C = contour();
    const { N, X, Y, TX, TY, NX, NY, PHI } = C;
    const n = LW * LH;
    // exact nearest contour sample per node (every 2nd sample against the nodes within reach), then the signed distance
    const best = new Float32Array(n).fill(1e18),
      bj = new Int32Array(n).fill(-1);
    const R = 92;
    for (let j = 0; j < N; j += 2) {
      const gx = (X[j] - LX0) / LG,
        gy = (Y[j] - LY0) / LG;
      const r = R / LG;
      const ia = Math.max(0, Math.floor(gx - r)),
        ib = Math.min(LW - 1, Math.ceil(gx + r)),
        ka = Math.max(0, Math.floor(gy - r)),
        kb = Math.min(LH - 1, Math.ceil(gy + r));
      for (let k = ka; k <= kb; k++) {
        const dy = (k - gy) * LG;
        for (let i = ia; i <= ib; i++) {
          const dx = (i - gx) * LG;
          const d2 = dx * dx + dy * dy;
          const o = k * LW + i;
          if (d2 < best[o]) {
            best[o] = d2;
            bj[o] = j;
          }
        }
      }
    }
    const D = new Float32Array(n),
      TDX = new Float32Array(n),
      TDY = new Float32Array(n);
    for (let k = 0; k < LH; k++)
      for (let i = 0; i < LW; i++) {
        const o = k * LW + i;
        const j = bj[o];
        if (j < 0) {
          D[o] = R; // far outside (the grid's corners)
          continue;
        }
        const px = LX0 + i * LG,
          py = LY0 + k * LG;
        const s = (px - X[j]) * NX[j] + (py - Y[j]) * NY[j];
        D[o] = (s >= 0 ? 1 : -1) * Math.sqrt(best[o]);
        // the downhill direction of the nearest stretch of outline (zero where it is level: the crown, the sinks)
        const dn = TY[j] >= 0 ? 1 : -1;
        const w = smoothstep(0.04, 0.3, Math.abs(PHI[j]));
        TDX[o] = TX[j] * dn * w;
        TDY[o] = TY[j] * dn * w;
      }
    // smoothed distance → its gradient (≈ the outward normal near the outline, → 0 on the medial axes: no tearing)
    const DS = D.slice();
    gridBlur(DS, 2, 3);
    gridBlur(TDX, 2, 2);
    gridBlur(TDY, 2, 2);
    const dep = new Float32Array(n),
      inn = new Float32Array(n),
      WX = new Float32Array(n),
      WY = new Float32Array(n),
      SX = new Float32Array(n),
      SY = new Float32Array(n),
      inW = new Float32Array(n),
      head = new Float32Array(n);
    for (let k = 0; k < LH; k++)
      for (let i = 0; i < LW; i++) {
        const o = k * LW + i;
        const d = D[o];
        const y = LY0 + k * LG;
        const gx = (DS[k * LW + Math.min(LW - 1, i + 1)] - DS[k * LW + Math.max(0, i - 1)]) / (2 * LG),
          gy = (DS[Math.min(LH - 1, k + 1) * LW + i] - DS[Math.max(0, k - 1) * LW + i]) / (2 * LG);
        // convergence profile (backward map: the source lies further from the outline): a reach of ~55 px outside,
        // ~22 px inside, zero on the outline itself (where the threads collect)
        const hN = d >= 0 ? Math.tanh(d / 6) * Math.exp(-(d / 55) * (d / 55)) : 0.55 * Math.tanh(d / 6) * Math.exp(-(d / 22) * (d / 22));
        WX[o] = hN * gx;
        WY[o] = hN * gy;
        const hT = Math.exp(-(d / 14) * (d / 14));
        SX[o] = hT * TDX[o];
        SY[o] = hT * TDY[o];
        // the clearing: the body's threads thinned, a pale band outside the outline; the outline itself kept
        dep[o] = d < 0 ? 0.72 * smoothstep(-4, -14, d) : 0.5 * smoothstep(9, 20, d) * (1 - smoothstep(48, 80, d));
        inn[o] = smoothstep(-2, -12, d);
        inW[o] = smoothstep(2, -9, d);
        head[o] = 1 - smoothstep(FIG_TOP + 105, FIG_TOP + 140, y);
      }
    return { D, dep, inn, WX, WY, SX, SY, inW, head };
  });
}

// ───────────────────────────── the lens (per frame, on the grid) ─────────────────────────────
/** px: how far the threads are drawn onto the outline (by the end of the lens; by the hold) and slid down along it */
const K_N1 = 24,
  K_N2 = 36,
  K_T = 18;
const lensCache = { f: -1, dx: new Float32Array(LW * LH), dy: new Float32Array(LW * LH), any: false };
/**
 * Displacement (frame px) from an output point to the point of the (already advected) field it shows, at frame f: a
 * smooth warp (never folds) whose strength grows crown first — the threads near the form are drawn onto its outline
 * and slid down along it. Frozen at the hold (then the late flow carries it off).
 */
export function lensDelta(f: number) {
  const fr = Math.min(f, INK_T.hold);
  if (lensCache.f === fr) return lensCache;
  lensCache.f = fr;
  const G = figGrid();
  const { dx, dy } = lensCache;
  let any = false;
  const a2 = ease.inOutSine(seg(fr, INK_T.lens[1], INK_T.hold));
  for (let k = 0; k < LH; k++) {
    const y = LY0 + k * LG;
    const A = lensAmt(fr, y);
    const kn = K_N1 * A + (K_N2 - K_N1) * a2 * A,
      kt = K_T * A;
    if (A > 0.0005) any = true;
    for (let i = 0; i < LW; i++) {
      const o = k * LW + i;
      dx[o] = kn * G.WX[o] - kt * G.SX[o];
      dy[o] = kn * G.WY[o] - kt * G.SY[o];
    }
  }
  lensCache.any = any;
  return lensCache;
}

/** the 淡墨 wash at frame f (density per grid node): wet and uneven, the head darker, slowly streaming down the body */
const WASH_EXTRA = 16;
function washNoise(): Float32Array {
  return memo('s09:fig:washNoise', () => {
    const rows = LH + WASH_EXTRA;
    const o = new Float32Array(LW * rows);
    for (let k = 0; k < rows; k++)
      for (let i = 0; i < LW; i++) {
        const x = LX0 + i * LG,
          y = LY0 + (k - WASH_EXTRA) * LG;
        // 3 octaves of value noise (wet blooms ~120 px, with a finer mottle)
        const v = 0.55 * vnoise(x * 0.0085 + 3.1, y * 0.0062 - 1.7) + 0.3 * vnoise(x * 0.019 + 7.7, y * 0.016 + 2.2) + 0.15 * vnoise(x * 0.041 - 5, y * 0.038 + 9);
        o[k * LW + i] = clamp((v - 0.5) * 1.9 + 0.5);
      }
    return o;
  });
}
const washCache = { f: -1, a: new Float32Array(LW * LH) };
export function washGrid(f: number): Float32Array {
  const fr = Math.min(f, INK_T.hold);
  if (washCache.f === fr) return washCache.a;
  washCache.f = fr;
  const G = figGrid();
  const NZ = washNoise();
  // the wash streams down ~7 px/s while the form is maintained
  const drift = Math.min(WASH_EXTRA - 1.001, (7 * Math.max(0, fr - INK_T.paint[0])) / 30 / LG);
  const r0 = WASH_EXTRA - drift;
  const ri = Math.floor(r0),
    rf = r0 - ri;
  const out = washCache.a;
  for (let k = 0; k < LH; k++) {
    const a = (k + ri) * LW,
      b = a + LW;
    for (let i = 0; i < LW; i++) {
      const o = k * LW + i;
      const w = G.inW[o];
      if (w <= 0) {
        out[o] = 0;
        continue;
      }
      const wet = NZ[a + i] * (1 - rf) + NZ[b + i] * rf;
      const hd = G.head[o];
      out[o] = w * ((0.05 + 0.21 * wet * wet) * (1 - hd) + 0.24 * hd * (0.7 + 0.5 * wet));
    }
  }
  return out;
}

// ───────────────────────────── the stroke: per contour sample, per frame ─────────────────────────────
interface Statics {
  press: Float32Array; // brush pressure along the outline (slow swells)
  pool: Float32Array; // piling up where the outline is level
  bleedN: Float32Array; // uneven bleed (length factor), uneven bleed (strength factor)
  bleedS: Float32Array;
  dryN: Float32Array; // dryness noise
}
function statics(): Statics {
  return memo('s09:fig:statics', () => {
    const C = contour();
    const N = C.N;
    const press = new Float32Array(N),
      pool = new Float32Array(N),
      bleedN = new Float32Array(N),
      bleedS = new Float32Array(N),
      dryN = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const r = C.run[j],
        a = C.ARC[j];
      press[j] = 1 + 0.42 * (vnoise(a * 0.011 + 37 * r, 3.3) - 0.5) + 0.16 * (vnoise(a * 0.047 + 11 * r, 7.7) - 0.5);
      pool[j] = 1 + 0.55 * (1 - smoothstep(0.12, 0.55, Math.abs(C.PHI[j])));
      bleedN[j] = 0.5 + 0.95 * vnoise(a * 0.017 + 3 * r, 9.1);
      bleedS[j] = 0.55 + 0.9 * vnoise(a * 0.026 + 13 * r, 2.2);
      dryN[j] = vnoise(a * 0.021 + 5 * r, 1.7) - 0.5;
    }
    return { press, pool, bleedN, bleedS, dryN };
  });
}
interface Params {
  gate: Float32Array;
  W: Float32Array;
  rho: Float32Array;
  dry: Float32Array;
  BL: Float32Array;
  BK: Float32Array;
  off: Float32Array;
  /** the streaming texture coordinate (material coordinate down the run) */
  m: Float32Array;
}
const parBox = { p: null as Params | null };
/** half-width of the stroke at its thinnest/heaviest, px; density at the core */
const W0 = 3.5,
  RHO0 = 1.06;
/** beads of ink running down each run (born at its source every T_BEAD s) */
const T_BEAD = 1.15;
function strokeParams(f: number, rel: number): Params {
  const C = contour();
  const S = statics();
  const N = C.N;
  if (!parBox.p) parBox.p = { gate: new Float32Array(N), W: new Float32Array(N), rho: new Float32Array(N), dry: new Float32Array(N), BL: new Float32Array(N), BK: new Float32Array(N), off: new Float32Array(N), m: new Float32Array(N) };
  const P = parBox.p;
  const tg = f / 30;
  const fh = Math.min(f, INK_T.hold);
  // the line sways a little with the water (the tank's own flow at the figure, minus its steady sinking)
  velAt(540, 820, Math.max(0, (fh - INV.handover) / 30));
  const gdx = 0.09 * V[0],
    gdy = 0.09 * (V[1] - 12);
  const starts = runStarts();
  // per run: the front, the beads (their arc positions and amplitudes)
  const fronts = new Float32Array(C.runs.length);
  const beads: Array<Array<[number, number]>> = [];
  C.runs.forEach((r, ri) => {
    fronts[ri] = frontTheta(ri, f);
    const list: Array<[number, number]> = [];
    const tau = (fh - starts[ri]) / 30;
    const ph = hash01(ri, 917) * T_BEAD;
    for (let q = 0; q < 12; q++) {
      const age = tau - ph - q * T_BEAD;
      if (age <= 0) continue;
      const th = U_BEAD * age;
      if (th > r.thMax + 30) continue;
      // a bead swells as it collects ink on its way down
      list.push([runIndexAt(r, th), 0.45 + 0.55 * smoothstep(0, 260, th)]);
    }
    beads.push(list);
  });
  const relW = 1 + 1.6 * rel;
  for (let j = 0; j < N; j++) {
    const ri = C.run[j];
    const r = C.runs[ri];
    const th = C.TH[j],
      u = C.U[j],
      arc = C.ARC[j];
    const fr = fronts[ri];
    // the pour gate (behind the front) and the wet tip just behind it
    const g = fr < 0 ? 0 : smoothstep(-4, 22, fr - th);
    P.gate[j] = g * (1 - 0.65 * Math.exp(-Math.max(0, fr) / 60)); // the first ink comes in pale (from the thread)
    if (g <= 0) continue;
    const tip = fr < r.thMax + 40 ? Math.exp(-((fr - th - 16) / 38) * ((fr - th - 16) / 38)) : 0;
    let bead = 0;
    for (const [ia, amp] of beads[ri]) {
      const da = (arc - ia) / 13;
      if (da > -3 && da < 3) bead += amp * Math.exp(-da * da);
    }
    bead = Math.min(1.3, bead);
    const src = Math.exp(-(arc / 9) * (arc / 9));
    const acc = 0.55 + 0.75 * Math.pow(u, 0.85);
    P.W[j] = W0 * acc * S.pool[j] * S.press[j] * (1 + 0.5 * bead + 0.55 * tip + 0.45 * src) * relW;
    P.rho[j] = (RHO0 * (0.62 + 0.55 * u) * (1 + 0.32 * bead + 0.38 * tip + 0.2 * src)) / relW;
    P.dry[j] = clamp(1.08 * Math.pow(1 - u, 1.5) - 0.1 + 0.42 * S.dryN[j] - 0.7 * tip - 0.45 * bead - 0.6 * src, 0, 0.93) * (1 - rel);
    P.BL[j] = ((3.5 + 15 * Math.pow(u, 1.2)) * S.bleedN[j] + 7 * tip + 4 * bead) * (1 + 1.2 * rel);
    P.BK[j] = (0.2 + 0.2 * u) * S.bleedS[j] * (1 + 0.5 * tip);
    // the line breathes (a slow undulation travelling along it) and drifts with the water
    P.off[j] = 1.1 * (vnoise(j * 0.0062 + 0.23 * tg, 4.4) - 0.5) * 2 + gdx * C.NX[j] + gdy * C.NY[j];
    P.m[j] = (th - U_TEX * tg) / 36;
  }
  return P;
}

// ───────────────────────────── drips (from the hands and the feet) ─────────────────────────────
interface Sink {
  x: number;
  y: number;
  /** frame of the first arrival of ink */
  f0: number;
  foot: boolean;
  seed: number;
}
function sinks(): Sink[] {
  return memo('s09:fig:sinks', () => {
    const C = contour();
    const starts = runStarts();
    const out: Sink[] = [];
    C.runs.forEach((r, ri) => {
      // when the front reaches the sink: θ_f(τ) = U·τ²/(τ + 0.22) = θmax
      const T = r.thMax / U_POUR;
      const tau = (T + Math.sqrt(T * T + 4 * T * 0.22)) / 2;
      const fa = starts[ri] + tau * 30;
      const hit = out.find((s) => Math.hypot(s.x - r.sinkX, s.y - r.sinkY) < 24);
      if (hit) hit.f0 = Math.min(hit.f0, fa);
      else out.push({ x: r.sinkX, y: r.sinkY, f0: fa, foot: r.sinkY > FIG.feet - 30, seed: out.length });
    });
    return out;
  });
}
/** add the drips at frame f into the stroke's box density (box px) */
function drawDrips(Dn: Float32Array, f: number, gain: number) {
  if (gain <= 0.003) return;
  const t = f / 30;
  for (const s of sinks()) {
    const T = (s.foot ? 1.7 : 1.25) + 0.35 * hash01(s.seed, 41);
    for (let q = 0; q < 8; q++) {
      const t0 = s.f0 / 30 + q * T + (q > 0 ? 0.25 * (hash01(q, 43 + s.seed) - 0.5) : 0);
      if (t0 * 30 > INK_T.hold - 6) break;
      const a = t - t0;
      if (a <= 0 || a > 2.6) continue;
      // forming (0–0.4 s) → falling and sinking, stretching, fading (diffusing into the water)
      const form = Math.min(1, a / 0.4);
      const af = Math.max(0, a - 0.4);
      const rb = (1.3 + 2.1 * form) * (1 + 0.3 * af);
      const fall = af * (14 + 28 * af) * (s.foot ? 0.55 : 1);
      const cy = s.y + 1 + rb * 0.9 + fall;
      const cx = s.x + 2.5 * Math.sin(1.4 * af + q * 1.7);
      const fade = Math.exp(-af / (s.foot ? 0.42 : 1.0)) * gain;
      if (fade < 0.01) continue;
      const stemW = 0.9 * (1 - smoothstep(0.15, 0.8, af));
      const rho = 1.05 * fade;
      const x0 = Math.max(0, Math.floor(cx - rb - 6 - BX)),
        x1 = Math.min(BW - 1, Math.ceil(cx + rb + 6 - BX));
      const y0 = Math.max(0, Math.floor(s.y - 2 - BY)),
        y1 = Math.min(BH - 1, Math.ceil(cy + rb + 6 - BY));
      for (let y = y0; y <= y1; y++) {
        const py = BY + y + 0.5;
        for (let x = x0; x <= x1; x++) {
          const px = BX + x + 0.5;
          const dd = Math.hypot(px - cx, (py - cy) * 1.15);
          let v = smoothstep(rb + 0.9, rb - 0.9, dd) * (0.85 + 0.3 * (1 - dd / Math.max(1, rb)));
          v += 0.22 * Math.exp(-Math.max(0, dd - rb) / (2 + 3 * af)); // its bleed
          if (stemW > 0.02 && py > s.y - 1 && py < cy) {
            // the thread that still ties it to the sink
            const sx = s.x + (cx - s.x) * ((py - s.y) / Math.max(1, cy - s.y));
            v += 0.7 * smoothstep(stemW + 0.7, stemW - 0.7, Math.abs(px - sx));
          }
          if (v > 0.002) Dn[y * BW + x] += rho * v;
        }
      }
    }
  }
}

// ───────────────────────────── the stroke: per pixel ─────────────────────────────
function f32(key: string, n: number): Float32Array {
  const b = memo(`s09:fig:f32:${key}`, () => ({ a: new Float32Array(1) }));
  if (b.a.length < n) b.a = new Float32Array(n);
  return b.a;
}
/** paper-fibre mottle for the bleed (a feathery edge rather than a smooth gradient) */
function fibre(): Float32Array {
  return memo('s09:fig:fibre', () => {
    const S = 256;
    const out = new Float32Array(S * S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        // tileable: lattice coordinates wrap at 256/k
        const v = 0.55 * vnoise(x * 0.125, y * 0.125) + 0.3 * vnoise(x * 0.25 + 64, y * 0.25 + 64) + 0.15 * vnoise(x * 0.5 + 128, y * 0.5 + 128);
        out[y * S + x] = clamp((v - 0.5) * 2.2 + 0.5);
      }
    return out;
  });
}
/** the inked rectangle of the last render (box px) */
const BB = { x0: 0, y0: 0, x1: 0, y1: 0 };
/** the stroke's optical density over the box at frame f (live: gated by the pour, released by `rel`) */
function strokeDensity(f: number, rel: number): Float32Array {
  const B = band();
  const C = contour();
  const P = strokeParams(f, rel);
  const FB = fibre();
  const Dn = f32('dens', BW * BH);
  Dn.fill(0);
  let bx0 = BW,
    by0 = BH,
    bx1 = 0,
    by1 = 0;
  const { idx, J, D } = B;
  for (let i = 0; i < B.n; i++) {
    const j = J[i];
    const g = P.gate[j];
    if (g <= 0.002) continue;
    const w = P.W[j];
    const dd = D[i] - P.off[j];
    const a = dd < 0 ? -dd : dd;
    const bl = P.BL[j];
    if (a > w + 3.3 * bl + 2) continue;
    const dry = P.dry[j];
    const m = P.m[j];
    const ri = C.run[j];
    const v = dd / w;
    // ragged where the brush runs dry, clean where it is wet
    const rag = dry > 0.02 ? vnoise(m * 2.6 + (dd > 0 ? 91 : 0), 0.5 + ri * 7) - 0.5 : 0;
    const we = w * (1 + 0.9 * dry * rag);
    let core = a < we - 0.8 ? 1 : a > we + 0.8 ? 0 : (we + 0.8 - a) / 1.6;
    if (core > 0) {
      core *= 0.84 + 0.3 * Math.max(0, 1 - v * v);
      if (dry > 0.02) {
        // 飞白: the bristles run dry in streaks along the stroke (the streaks stream down with the ink)
        const st = vnoise(v * 3.4 + 17.3 * ri + 0.5, m);
        const keep = st <= dry - 0.2 ? 0 : st >= dry + 0.08 ? 1 : (st - dry + 0.2) / 0.28;
        core *= 0.05 + 0.95 * keep;
      }
    }
    // 墨晕: the wet bleed (not where the brush is dry), uneven along the stroke, feathered by the fibres
    const o = idx[i];
    const by = (o / BW) | 0,
      bx = o - by * BW;
    let bleed = 0;
    const ex = a - we * 0.85;
    if (ex > -2) {
      const fb = FB[((by + BY) & 255) * 256 + ((bx + BX) & 255)];
      bleed = P.BK[j] * Math.exp(-Math.max(0, ex) / bl) * (1 - 0.8 * dry) * (0.55 + 0.6 * fb);
    }
    const rho = P.rho[j] * g * (core + bleed * (1 - core));
    if (rho <= 0.002) continue;
    Dn[o] = rho;
    if (bx < bx0) bx0 = bx;
    if (bx > bx1) bx1 = bx;
    if (by < by0) by0 = by;
    if (by > by1) by1 = by;
  }
  drawDrips(Dn, f, 1 - rel);
  // the drips extend the box downward
  BB.x0 = Math.max(0, bx0 - 8);
  BB.y0 = Math.max(0, by0);
  BB.x1 = Math.min(BW - 1, bx1 + 8);
  BB.y1 = Math.min(BH - 1, by1 + 130);
  return Dn;
}

/** Beer–Lambert LUT with a soft density cap: ρ → cap·(1 − e^(−ρ/cap)) (thin ink linear, never denser than cap) */
const LUT_N = 1024,
  LUT_MAX = 6;
const lutCache = { cap: -1, lut: new Uint8ClampedArray(LUT_N * 3) };
function capLut(cap: number): Uint8ClampedArray {
  if (lutCache.cap === cap) return lutCache.lut;
  lutCache.cap = cap;
  for (let i = 0; i < LUT_N; i++) {
    const r0 = (i / (LUT_N - 1)) * LUT_MAX;
    const r = cap * (1 - Math.exp(-r0 / cap));
    for (let c = 0; c < 3; c++) lutCache.lut[i * 3 + c] = Math.round(255 * (FLOOR[c] + (1 - FLOOR[c]) * Math.exp(-r * K[c])));
  }
  return lutCache.lut;
}
function multiplyDensity(ctx: CanvasRenderingContext2D, Dn: Float32Array, gain: number, cap: number) {
  if (BB.x1 <= BB.x0 || BB.y1 <= BB.y0) return;
  const lut = capLut(cap);
  const w = BB.x1 - BB.x0 + 1,
    h = BB.y1 - BB.y0 + 1;
  const c = scratch('figOut', w, h);
  const g = ctxOf(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  const lk = ((LUT_N - 1) / LUT_MAX) * gain;
  for (let y = 0; y < h; y++) {
    const row = (y + BB.y0) * BW + BB.x0;
    for (let x = 0; x < w; x++) {
      const li = Math.min(LUT_N - 1, (Dn[row + x] * lk) | 0) * 3;
      const o = (y * w + x) * 4;
      d[o] = lut[li];
      d[o + 1] = lut[li + 1];
      d[o + 2] = lut[li + 2];
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, BX + BB.x0, BY + BB.y0);
  ctx.restore();
}

/**
 * The stroke's ink at the moment it is let go, as density at the field's quarter resolution (frame-aligned 4-px samples
 * over the stroke's box: sample (i, j) ↔ frame ((RQ.x0 + i + 0.5)·4, (RQ.y0 + j + 0.5)·4)). From then on it is part of
 * the web's own density field (inkfield.ts): carried by the same water, diffused by the same blur.
 */
export const RQ = { x0: BX / 4, y0: BY / 4, w: BW / 4, h: BH / 4 } as const;
export function releaseDensityQ(): Float32Array {
  return memo('s09:fig:releaseQ', () => {
    const Dn = strokeDensity(INK_T.hold, 0);
    const q = new Float32Array(RQ.w * RQ.h);
    for (let j = 0; j < RQ.h; j++)
      for (let i = 0; i < RQ.w; i++) {
        let s = 0;
        for (let y = 0; y < 4; y++) {
          const row = (j * 4 + y) * BW + i * 4;
          s += Dn[row] + Dn[row + 1] + Dn[row + 2] + Dn[row + 3];
        }
        // (the soft cap: the stroke never shows denser than ~1.3)
        const v = s / 16;
        q[j * RQ.w + i] = 1.3 * (1 - Math.exp(-v / 1.3));
      }
    return q;
  });
}

/**
 * Draw the stroke at frame f (multiply). `cap` = the field's current peak optical density near the figure
 * (inkfield.fieldPeak): the outline is never denser than the ink it is made of. From the let-go on, the stroke widens
 * and pales as it cross-fades (in density) into the same ink handed to the water (inkfield adds releaseDensityQ).
 */
export function drawFigureInk(ctx: CanvasRenderingContext2D, f: number, light: number, cap: number) {
  if (f < INK_T.paint[0] || light <= 0.01) return;
  const k = releaseK(f);
  if (k >= 1) return;
  const Dn = strokeDensity(f, k);
  multiplyDensity(ctx, Dn, light * (1 - k), cap);
}


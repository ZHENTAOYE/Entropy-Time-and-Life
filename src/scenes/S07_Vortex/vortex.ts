// The whirlpool: a closed-form spiral-sink flow (free vortex + point sink, Rankine core).
//   radial:  r(τ)² = R² − q·τ            (uniform areal inflow → uniform density)
//   angle:   θ(τ)  = θ_inj + wind(R, r)   wind = k·ln(R/r) outside the core, solid-body rotation inside (r < rc):
//                                          k·(ln(R/rc) + ½(1 − r²/rc²))  — a feeder arm is a STATIONARY curve even
//                                          though every particle on it keeps moving (the scene's thesis).
// At the very start (the S06 match cut) the flow is still S06's loosely twisted 7-leaf rosette: the arms sit on S06's
// leaf midribs (twisted by S06's own law, still turning at S06's rate) and the winding is blended into the whirlpool's
// log spirals over f0–46 (wOpen). Every particle recycles: cycle c re-enters at the rim. All closed form in t.
import { clamp, lerp, memo, smootherstep, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { blade06, g06, K06, midrib06, NLEAF, pull06, rosette06, spin06 } from './s06';
import { T } from './timing';

export const V = {
  R0: 440,
  rEye: 30,
  rc: 78,
  /** final winding (negative → clockwise on screen, continuing S06's twist) */
  k: -5,
  /** depth of the free-surface funnel at the eye (world px) */
  Hf: 280,
  NA: NLEAF,
  /** pattern speed of the feeder arms (rad/frame) */
  Om: -0.0035,
  rOutEnd: 430,
  /** residence time of rim water (frames): every drop inside the rim leaves within ≤ 1.05·Lin ≈ 69 f */
  Lin: 66,
  /** rim radius of the feeder arms (they start off-screen) */
  Rarm: 980,
} as const;

/** inner water (enters at the rim R0) */
export const N_WATER = 7200;
/** feeder arms: long streams that start off-screen (R ≈ 980) and spiral all the way into the eye */
export const N_ARM = 5600;
/** outer water (slow drift from far away, vanishes into the rim) */
export const N_OUT = 2200;
export const N_IN = N_WATER + N_ARM;
export const NV = N_IN + N_OUT;
const GOLDEN = 2.399963229728653;
const Q_REF = (V.R0 * V.R0 - V.rEye * V.rEye) / V.Lin;

// ------------------------------------------------------------------ the opening blend (S06 rosette → whirlpool)
export const OPEN_END = 46;
/** 0 = S06's rosette geometry … 1 = the whirlpool (zero velocity at both ends) */
export const wOpen = (t: number) => smootherstep(0, OPEN_END, t);
/** effective winding of the water during the blend (S06's twist ≈ a log spiral with k ≈ −0.7; its inflow ≈ −1.5) */
export const kAt = (t: number, outer = false) => lerp(outer ? -1.5 : -0.7, V.k, wOpen(t));

/** angle wound up by the flow from the rim R to radius r (Rankine core inside rc) */
export function wind(R: number, r: number, k: number): number {
  if (r >= V.rc) return k * Math.log(R / r);
  return k * (Math.log(R / V.rc) + 0.5 * (1 - (r * r) / (V.rc * V.rc)));
}

// the blend pivots about the arms' outer end: every part of S06's rosette keeps turning the way it already turned
// (clockwise, the centre fastest) while it winds up — nothing swings backwards
const R_PIVOT = 900;
const tauRef = (r: number) => (V.Rarm * V.Rarm - r * r) / Q_REF;
/** arm base angles: arm a's centre line coincides with S06 leaf a's twisted midrib at R_PIVOT at f0 */
let ARMB: Float64Array | null = null;
export const armBase = (): Float64Array => {
  if (ARMB) return ARMB;
  const B = new Float64Array(V.NA);
  for (let a = 0; a < V.NA; a++) B[a] = -midrib06(a, R_PIVOT, 0) + V.Om * tauRef(R_PIVOT) - wind(V.Rarm, R_PIVOT, V.k);
  return (ARMB = B);
};
/** world angle of arm a's centre line at radius r, time t (pure whirlpool) */
export const armCentre = (a: number, r: number, t: number) => armBase()[a] + V.Om * (t - tauRef(r)) + wind(V.Rarm, r, V.k);
/** world-angle offset that carries S06's leaf a (at radius r) into the whirlpool, × wOpen(t) */
export const leafDelta = (a: number, r: number, t: number) => armCentre(a, r, t) + midrib06(a, r, t);

/** S06 leaf point (pre-twist polar ρ, α) of leaf a at S07 frame t → world [X, H, Z, r] */
export function leafPoint(a: number, rho: number, alpha: number, t: number, out: Float32Array | number[]) {
  const K = K06(t);
  const w = wOpen(t);
  const th = alpha + K * g06(rho) + spin06(t);
  const phi = -th + w * leafDelta(a, rho, t);
  const r = rho * lerp(pull06(rho, K), 1, w);
  out[0] = r * Math.cos(phi);
  out[1] = funnel(r) * w;
  out[2] = r * Math.sin(phi);
  out[3] = r;
}

export interface VParts {
  R: Float32Array;
  L: Float32Array;
  q: Float32Array;
  ph: Float32Array;
  th: Float32Array;
  arm: Int8Array;
  sp: Float32Array;
  /** lateral position across the arm / leaf blade, −1..1 */
  lt: Float32Array;
  br: Float32Array;
  outer: Uint8Array;
}

export const vparts = (): VParts =>
  memo('s07:vparts', () => {
    const rnd = mulberry32(7071);
    const R = new Float32Array(NV);
    const L = new Float32Array(NV);
    const q = new Float32Array(NV);
    const ph = new Float32Array(NV);
    const th = new Float32Array(NV);
    const arm = new Int8Array(NV);
    const sp = new Float32Array(NV);
    const lt = new Float32Array(NV);
    const br = new Float32Array(NV);
    const outer = new Uint8Array(NV);
    // interleave water and arm particles so any index prefix (e.g. the body's first 10k) holds both
    const armSlots = new Uint8Array(N_IN);
    for (let j = 0; j < N_IN; j++) armSlots[j] = (j * N_ARM) % N_IN < N_ARM ? 1 : 0;
    for (let i = 0; i < NV; i++) {
      const o = i >= N_IN;
      outer[i] = o ? 1 : 0;
      if (!o && armSlots[i]) {
        R[i] = V.Rarm * (0.97 + 0.06 * rnd());
        q[i] = Q_REF * (0.95 + 0.1 * rnd());
        L[i] = (R[i] * R[i] - V.rEye * V.rEye) / q[i];
        arm[i] = Math.floor(rnd() * V.NA);
        const g = (rnd() + rnd() + rnd() - 1.5) / 1.5;
        lt[i] = g;
        sp[i] = g * 0.05;
      } else if (!o) {
        R[i] = V.R0 * (0.93 + 0.12 * rnd());
        L[i] = V.Lin * (0.95 + 0.1 * rnd());
        q[i] = (R[i] * R[i] - V.rEye * V.rEye) / L[i];
        arm[i] = -1;
      } else {
        R[i] = 620 + 260 * rnd();
        q[i] = Q_REF * (0.9 + 0.2 * rnd());
        L[i] = (R[i] * R[i] - V.rOutEnd * V.rOutEnd) / q[i];
        arm[i] = -1;
      }
      ph[i] = rnd();
      th[i] = rnd() * Math.PI * 2;
      br[i] = rnd();
    }
    return { R, L, q, ph, th, arm, sp, lt, br, outer };
  });

/** cycle index and τ (age within the cycle) of particle i at time t */
export function vCycle(P: VParts, i: number, t: number): [number, number] {
  const L = P.L[i];
  const tt = t + P.ph[i] * L;
  const c = Math.floor(tt / L);
  return [c, tt - c * L];
}

/** birth time of particle i's cycle c */
export const vBirth = (P: VParts, i: number, c: number) => (c - P.ph[i]) * P.L[i];

/** radius at age τ */
export function vRadius(P: VParts, i: number, tau: number): number {
  const R = P.R[i];
  const rEnd = P.outer[i] ? V.rOutEnd : V.rEye;
  return Math.sqrt(Math.max(rEnd * rEnd, R * R - P.q[i] * tau));
}

/** world angle of particle i (cycle c, age τ, radius r) */
function vAngle(P: VParts, i: number, c: number, tau: number, r: number): number {
  const birth = vBirth(P, i, c);
  const t = birth + tau;
  const a = P.arm[i];
  if (a < 0) return P.th[i] + c * GOLDEN + wind(P.R[i], r, kAt(t, P.outer[i] === 1));
  const thv = armBase()[a] + V.Om * birth + P.sp[i] + wind(P.R[i], r, V.k);
  const w = wOpen(t);
  if (w >= 1) return thv;
  // S06 leaf geometry: on the twisted midrib, spread across the blade
  const th06 = -(midrib06(a, r, t) + Math.atan2(P.lt[i] * 0.85 * blade06(a, r), Math.max(1, r)));
  return th06 + (thv - th06) * w;
}

export const funnel = (r: number) => -V.Hf / (1 + (r / V.rc) * (r / V.rc));

/** World position of particle i at age τ of cycle c. out = [X, H, Z, r, θ] (θ unwrapped) */
export function vPos(P: VParts, i: number, c: number, tau: number, out: Float32Array): void {
  const r = vRadius(P, i, tau);
  const th = vAngle(P, i, c, tau, r);
  const t = vBirth(P, i, c) + tau;
  out[0] = r * Math.cos(th);
  out[1] = funnel(r) * wOpen(t);
  out[2] = r * Math.sin(th);
  out[3] = r;
  if (out.length > 4) out[4] = th;
}

/** 0..1 visibility from birth at the rim and drain at the eye */
export function vFade(P: VParts, i: number, tau: number, r: number): number {
  if (P.outer[i]) {
    return 0.5 * smoothstep(P.R[i], P.R[i] - 70, r) * smoothstep(V.rOutEnd, V.rOutEnd + 60, r);
  }
  const eye = Math.sqrt(smoothstep(V.rEye, V.rc * 1.05, r));
  if (P.arm[i] >= 0) return smoothstep(P.R[i], P.R[i] - 120, r) * eye;
  return smoothstep(0, 0.07, tau / P.L[i]) * eye;
}

/** the feeder arms grow out of S06's leaf tips to the edge of the frame (f4–40) */
export function armExtent(a: number, t: number): number {
  const tip = rosette06().leaves[a].tip + 20;
  return lerp(tip, 1150, smoothstep(10, 42, t));
}

/** Census: was (i, c) inside the vortex (r ≤ R0) at the tag instant? */
export function vOriginal(P: VParts, i: number, c: number): boolean {
  if (P.outer[i]) return false;
  const b = vBirth(P, i, c);
  if (!(b <= T.tag && b + P.L[i] > T.tag)) return false;
  return P.R[i] * P.R[i] - P.q[i] * (T.tag - b) <= V.R0 * V.R0;
}

/** fraction of tagged ("original") water still inside the vortex at time t (exact, counted) */
export function censusFraction(t: number): number {
  return memo('s07:census:' + Math.round(t * 2), () => {
    const P = vparts();
    let n0 = 0;
    let n = 0;
    for (let i = 0; i < N_IN; i++) {
      const [c0] = vCycle(P, i, T.tag);
      if (!vOriginal(P, i, c0)) continue;
      n0++;
      if (vBirth(P, i, c0) + P.L[i] > t) n++;
    }
    return n0 ? n / n0 : 0;
  });
}

/** first frame at which the census reads 0 % (the last tagged drop has left through the eye) */
export const censusZero = (): number =>
  memo('s07:censuszero', () => {
    for (let f = T.tag; f < T.tag + 140; f++) if (censusFraction(f) <= 0) return f;
    return T.tag + 140;
  });

// ---------------------------------------------------------------- the tracer (one gold particle)
export const TRACER = {
  R: 452,
  L: T.tracerLife,
  th0: 1.05, // world angle of entry (≈ 1 o'clock on screen)
};
export const tracerQ = (TRACER.R * TRACER.R - V.rEye * V.rEye) / TRACER.L;

/** tracer world position at age τ → out [X,H,Z,r] */
export function tracerPos(tau: number, out: Float32Array) {
  const r = Math.sqrt(Math.max(V.rEye * V.rEye, TRACER.R * TRACER.R - tracerQ * tau));
  const th = TRACER.th0 + wind(TRACER.R, r, V.k);
  out[0] = r * Math.cos(th);
  out[1] = funnel(r);
  out[2] = r * Math.sin(th);
  out[3] = r;
}

export { clamp };

// The whirlpool: a closed-form spiral-sink flow (free vortex + point sink, Rankine core).
//   radial:  r(τ)² = R² − q·τ            (uniform areal inflow → uniform density)
//   angle:   θ(τ)  = θ_inj + k·ln(R / r)   (streamlines are log spirals: a feeder arm is a STATIONARY curve
//                                          even though every particle on it keeps moving — the scene's thesis)
//   core:    r < rc → solid-body rotation; at r = rEye the water drains (dives) out of the picture.
// Every particle recycles: cycle c re-enters at the rim at a new angle. All closed form in t.
import { memo, smoothstep } from '../../../../lib/math';
import { mulberry32 } from '../../../../lib/random';
import { T } from './timing';

export const V = {
  R0: 440,
  rEye: 30,
  rc: 78,
  /** winding (negative → clockwise on screen, matching S06's spiral) */
  k: -6,
  /** depth of the free-surface funnel at the eye (world px) */
  Hf: 280,
  NA: 5,
  /** pattern speed of the feeder arms (rad/frame) */
  Om: -0.0035,
  rOutEnd: 430,
  Lin: 86,
} as const;

/** inner water (enters at the rim R0) */
export const N_WATER = 7600;
/** gold feeder arms: long streams that start off-screen (R ≈ 980) and spiral all the way into the eye */
export const N_ARM = 4800;
/** outer water (slow drift from far away, vanishes into the rim) */
export const N_OUT = 2200;
export const N_IN = N_WATER + N_ARM;
export const NV = N_IN + N_OUT;
const GOLDEN = 2.399963229728653;
const ARM_BASE = Array.from({ length: V.NA }, (_, k) => (k / V.NA) * Math.PI * 2 + 0.35);

export interface VParts {
  R: Float32Array;
  L: Float32Array;
  q: Float32Array;
  ph: Float32Array;
  th: Float32Array;
  arm: Int8Array;
  sp: Float32Array;
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
    const br = new Float32Array(NV);
    const outer = new Uint8Array(NV);
    const qRef = (V.R0 * V.R0 - V.rEye * V.rEye) / V.Lin;
    // interleave water and arm particles so any index prefix (e.g. the body's first 10k) holds both
    const armSlots = new Uint8Array(N_IN);
    for (let j = 0; j < N_IN; j++) armSlots[j] = (j * N_ARM) % N_IN < N_ARM ? 1 : 0;
    for (let i = 0; i < NV; i++) {
      const o = i >= N_IN;
      outer[i] = o ? 1 : 0;
      if (!o && armSlots[i]) {
        R[i] = 980 * (0.97 + 0.06 * rnd());
        q[i] = qRef * (0.9 + 0.2 * rnd());
        L[i] = (R[i] * R[i] - V.rEye * V.rEye) / q[i];
        arm[i] = Math.floor(rnd() * V.NA);
        const g = (rnd() + rnd() + rnd() - 1.5) / 1.5;
        sp[i] = g * 0.05;
      } else if (!o) {
        R[i] = V.R0 * (0.93 + 0.12 * rnd());
        L[i] = V.Lin * (0.86 + 0.28 * rnd());
        q[i] = (R[i] * R[i] - V.rEye * V.rEye) / L[i];
        arm[i] = -1;
      } else {
        R[i] = 620 + 260 * rnd();
        q[i] = qRef * (0.9 + 0.2 * rnd());
        L[i] = (R[i] * R[i] - V.rOutEnd * V.rOutEnd) / q[i];
        arm[i] = -1;
      }
      ph[i] = rnd();
      th[i] = rnd() * Math.PI * 2;
      br[i] = rnd();
    }
    return { R, L, q, ph, th, arm, sp, br, outer };
  });

/** cycle index and τ (age within the cycle) of particle i at time t */
export function vCycle(P: VParts, i: number, t: number): [number, number] {
  const L = P.L[i];
  const tt = t + P.ph[i] * L;
  const c = Math.floor(tt / L);
  return [c, tt - c * L];
}

/** injection angle of particle i in cycle c (birth time b) */
export function vInj(P: VParts, i: number, c: number, birth: number): number {
  const a = P.arm[i];
  return a >= 0 ? ARM_BASE[a] + V.Om * birth + P.sp[i] : P.th[i] + c * GOLDEN;
}

/** radius at age τ */
export function vRadius(P: VParts, i: number, tau: number): number {
  const R = P.R[i];
  const rEnd = P.outer[i] ? V.rOutEnd : V.rEye;
  return Math.sqrt(Math.max(rEnd * rEnd, R * R - P.q[i] * tau));
}

/** angle at age τ for a particle injected at angle th0 with rim radius R and flux q */
export function spiralAngle(R: number, q: number, th0: number, tau: number, r: number): number {
  if (r >= V.rc) return th0 + V.k * Math.log(R / r);
  const tc = (R * R - V.rc * V.rc) / q;
  const wc = (V.k * q) / (2 * V.rc * V.rc);
  return th0 + V.k * Math.log(R / V.rc) + wc * (tau - tc);
}

export const funnel = (r: number) => -V.Hf / (1 + (r / V.rc) * (r / V.rc));

/** World position of particle i at age τ of cycle c. out = [X, H, Z, r] */
export function vPos(P: VParts, i: number, c: number, tau: number, out: Float32Array): void {
  const L = P.L[i];
  const birth = c * L - P.ph[i] * L;
  const r = vRadius(P, i, tau);
  const th = spiralAngle(P.R[i], P.q[i], vInj(P, i, c, birth), tau, r);
  out[0] = r * Math.cos(th);
  out[1] = funnel(r);
  out[2] = r * Math.sin(th);
  out[3] = r;
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

/** birth time of particle i's cycle c */
export const vBirth = (P: VParts, i: number, c: number) => (c - P.ph[i]) * P.L[i];

/** Census: was (i, c) inside the vortex at the tag instant? */
export function vOriginal(P: VParts, i: number, c: number): boolean {
  if (P.outer[i]) return false;
  const b = vBirth(P, i, c);
  if (!(b <= T.tag && b + P.L[i] > T.tag)) return false;
  return P.R[i] * P.R[i] - P.q[i] * (T.tag - b) <= V.R0 * V.R0 * 1.06;
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
  const th = spiralAngle(TRACER.R, tracerQ, TRACER.th0, tau, r);
  out[0] = r * Math.cos(th);
  out[1] = funnel(r);
  out[2] = r * Math.sin(th);
  out[3] = r;
}

// Flow time and body-particle states.
// The body's metabolism runs on its own clock s(t) = ∫F(t)dt: off before the figure has formed, a time-lapse
// (F > 1) while the day counter runs, 1 in "real time", and 0 during the freeze (a "thing" = a paused snapshot).
import { memo, smoothstep } from '../../../../lib/math';
import { hash01 } from '../../../../lib/random';
import { BodyData, bodyData, MOUTH, N_BODY } from './body';
import { T } from './timing';

function rate(t: number): number {
  let F = smoothstep(T.flowOn0, T.flowOn1, t);
  F += 1.5 * smoothstep(T.days0 + 6, T.days0 + 26, t) * (1 - smoothstep(T.days1 - 12, T.days1 + 10, t));
  F *= 1 - smoothstep(T.freeze0, T.freeze1, t) * (1 - smoothstep(T.restart, T.restart + T.restartLen, t));
  return F;
}

const DT = 0.25;
const flowTable = () =>
  memo('s07:flowtable', () => {
    const n = Math.ceil(920 / DT);
    const tab = new Float32Array(n + 1);
    let prev = rate(0);
    for (let k = 1; k <= n; k++) {
      const cur = rate(k * DT);
      tab[k] = tab[k - 1] + 0.5 * (prev + cur) * DT;
      prev = cur;
    }
    return tab;
  });

/** flow time at scene frame t */
export function flowTime(t: number): number {
  const tab = flowTable();
  const x = Math.max(0, t) / DT;
  const k = Math.min(tab.length - 2, Math.floor(x));
  const u = x - k;
  return tab[k] + (tab[k + 1] - tab[k]) * u;
}
export const flowRate = rate;

/** 第0天 → 第90天 */
export const dayAt = (t: number) => {
  const a = flowTime(T.days0);
  const b = flowTime(T.days1);
  return (90 * Math.max(0, Math.min(1, (flowTime(t) - a) / (b - a)))) | 0;
};

// ------------------------------------------------------------- intake: one ordered thread from above
// Food, water and air all enter through the mouth: a narrow, ordered gold thread descending into the face —
// low entropy in — while the warm, disordered plume rises out of the head.
const INTAKE: [[number, number], [number, number], [number, number]] = [[330, 1960], [150, 1250], MOUTH];
export const INTAKE_PTS = INTAKE;
export const V_EXT = 62;
const intakeLut = () =>
  memo('s07:intakelut', () => {
    const n = 64;
    const len = new Float32Array(n + 1);
    let prev = bez(INTAKE, 0);
    for (let k = 1; k <= n; k++) {
      const p = bez(INTAKE, k / n);
      len[k] = len[k - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    return len;
  });
function bez(P: [number, number][], u: number): [number, number] {
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return [a * P[0][0] + b * P[1][0] + c * P[2][0], a * P[0][1] + b * P[1][1] + c * P[2][1]];
}
export const intakeLen = () => {
  const l = intakeLut();
  return l[l.length - 1];
};
export const T_EXT = 0; // (placeholder kept for clarity; the intake time is intakeLen() / V_EXT)
/** intake position at u ∈ [0,1] (arc-length parametrised) for particle seed (i, c) → [X, H, Z] */
export function intakePoint(i: number, c: number, u: number): [number, number, number] {
  const l = intakeLut();
  const n = l.length - 1;
  const d = u * l[n];
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (l[m] <= d) lo = m;
    else hi = m;
  }
  const t = (lo + Math.min(1, Math.max(0, (d - l[lo]) / Math.max(1e-6, l[hi] - l[lo])))) / n;
  const p = bez(INTAKE, t);
  const w = 1 - u * 0.8;
  const g1 = hash01(i * 3 + c * 17, 81) + hash01(i * 11 + c * 7, 84) - 1;
  const g2 = hash01(i * 7 + c * 31, 83) - 0.5;
  return [p[0] + g1 * 18 * w, p[1], g2 * 14 * w];
}

// ------------------------------------------------------------- body particles
export const V_INT = 46;
export const T_OUT = 22;

export interface BodyParts {
  P: Float32Array;
  off: Float32Array;
  slot0: Int32Array;
  perm: Uint8Array;
  side: Uint8Array;
}

const tIn = (B: BodyData, side: number, slot: number) => (void side, intakeLen() / V_EXT + B.plen[slot] / V_INT);

export const bodyParts = (): BodyParts =>
  memo('s07:bodyparts', () => {
    const B = bodyData();
    const P = new Float32Array(N_BODY);
    const off = new Float32Array(N_BODY);
    const slot0 = new Int32Array(N_BODY);
    const perm = new Uint8Array(N_BODY);
    const side = new Uint8Array(N_BODY);
    for (let i = 0; i < N_BODY; i++) {
      P[i] = 142 * (0.85 + 0.3 * hash01(i, 201));
      side[i] = hash01(i, 202) < 0.55 ? 0 : 1;
      // a few atoms never leave (long-lived proteins of the brain and the eye lens)
      if (hash01(i, 203) < 0.03 && B.headSlots.length) {
        perm[i] = 1;
        slot0[i] = B.headSlots[Math.floor(hash01(i, 204) * B.headSlots.length)];
      } else slot0[i] = i % B.ns;
      // at flow time 0 every particle is lingering in its first slot
      const ti = tIn(B, side[i], slot0[i]);
      const span = Math.max(1, P[i] - T_OUT - ti - 4);
      off[i] = ti + hash01(i, 205) * span;
    }
    return { P, off, slot0, perm, side };
  });

export const ST_EXT = 0;
export const ST_TREE = 1;
export const ST_LINGER = 2;
export const ST_OUT = 3;

/**
 * State of body particle i at flow time s. out = [X, H, Z, state, age-in-state(0..1 or frames), orig(0/1), slot, cycle]
 */
export function bodyState(i: number, s: number, out: Float32Array) {
  const B = bodyData();
  const BP = bodyParts();
  if (BP.perm[i]) {
    const sl = BP.slot0[i];
    out[0] = B.sx[sl] + 1.2 * Math.sin(s * 0.19 + i);
    out[1] = B.sh[sl] + 1.2 * Math.cos(s * 0.23 + i * 1.7);
    out[2] = B.sz[sl];
    out[3] = ST_LINGER;
    out[4] = 999;
    out[5] = 1;
    out[6] = sl;
    out[7] = 0;
    return;
  }
  const Pi = BP.P[i];
  // (out[7] = cycle index — callers use it to avoid drawing trails across a recycle)
  const tt = s + BP.off[i];
  const c = Math.floor(tt / Pi);
  const tau = tt - c * Pi;
  const sl = c === 0 ? BP.slot0[i] : Math.floor(hash01(i * 7 + c * 1013, 77) * B.ns);
  const side = c === 0 ? BP.side[i] : hash01(i * 13 + c * 71, 78) < 0.55 ? 0 : 1;
  void side;
  const tE = intakeLen() / V_EXT;
  const tI = tE + B.plen[sl] / V_INT;
  const tO = Pi - T_OUT;
  out[5] = c === 0 ? 1 : 0;
  out[6] = sl;
  out[7] = c;
  if (tau < tE) {
    const p = intakePoint(i, c, tau / tE);
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    out[3] = ST_EXT;
    out[4] = tau / tE;
    return;
  }
  if (tau < tI) {
    const dInt = (tau - tE) * V_INT;
    const nd = B.node[sl];
    if (dInt >= B.tdist[nd]) {
      const seglen = Math.max(1e-3, B.plen[sl] - B.tdist[nd]);
      const u = Math.min(1, (dInt - B.tdist[nd]) / seglen);
      out[0] = B.tx[nd] + (B.sx[sl] - B.tx[nd]) * u;
      out[1] = B.th[nd] + (B.sh[sl] - B.th[nd]) * u;
      out[2] = B.sz[sl] * u;
    } else {
      let n = nd;
      let prev = nd;
      while (n >= 0 && B.tdist[n] > dInt) {
        prev = n;
        n = B.tpar[n];
      }
      if (n < 0) n = 0;
      const span = Math.max(1e-3, B.tdist[prev] - B.tdist[n]);
      const u = Math.min(1, Math.max(0, (dInt - B.tdist[n]) / span));
      out[0] = B.tx[n] + (B.tx[prev] - B.tx[n]) * u;
      out[1] = B.th[n] + (B.th[prev] - B.th[n]) * u;
      out[2] = 0;
    }
    out[3] = ST_TREE;
    out[4] = (tau - tE) / Math.max(1e-3, tI - tE);
    return;
  }
  if (tau < tO) {
    out[0] = B.sx[sl] + 1.3 * Math.sin(s * 0.21 + i * 0.37);
    out[1] = B.sh[sl] + 1.3 * Math.cos(s * 0.17 + i * 0.91);
    out[2] = B.sz[sl];
    out[3] = ST_LINGER;
    out[4] = tau - tI; // frames since arrival
    return;
  }
  // leaving through the skin: to the nearest skin point, then outward with buoyancy (warm → rises)
  const u = (tau - tO) / T_OUT;
  const nx = B.nx[sl];
  const nh = B.nh[sl];
  const dep = B.depth[sl];
  let X: number;
  let H: number;
  if (u < 0.3) {
    const k = (u / 0.3) * dep;
    X = B.sx[sl] + nx * k;
    H = B.sh[sl] + nh * k;
  } else {
    const v = (u - 0.3) / 0.7;
    const d = v * 70 + v * v * 70;
    const w = Math.sin(c * 2.1 + i * 0.7 + v * 5) * 12 * v;
    X = B.sx[sl] + nx * (dep + d) - nh * w;
    H = B.sh[sl] + nh * (dep + d) + nx * w + v * v * 60;
  }
  out[0] = X;
  out[1] = H;
  out[2] = B.sz[sl];
  out[3] = ST_OUT;
  out[4] = u;
}

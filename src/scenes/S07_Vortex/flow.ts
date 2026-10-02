// Flow time and the body's turnover.
// The body's metabolism runs on its own clock s(t) = ∫F(t)dt: off before the figure has formed, a time-lapse
// (F > 1) while the day counter runs, 1 in "real time", and 0 during the freeze (a "thing" = a paused snapshot).
//
// TURNOVER (the slot model): every seat of the body (one per body particle) is ALWAYS occupied — the shape persists.
// Its occupant is exchanged at Poisson-distributed instants (precomputed once, looked up by binary search, so every
// state is still a pure function of s). Two pools:
//   · water ≈ 60 % of the atoms: residence half-life 10 days (the 7–14 d of the footnote) → mean 14.4 d;
//   · a slow pool ≈ 40 %: the skeleton (skull shell, eye lenses, spine, ribs, pelvis, long bones; τ ≈ 2 years) plus
//     scattered fat / collagen (τ ≈ 250 d).
// → originals left: ≈ 77 % on day 7, ≈ 42 % on day 34, ≈ 33 % on day 90 (steepest at the start, then a plateau):
//   by 第90天 the flesh is new (gold) around a persisting original (cyan) skeleton.
// At an exchange the newcomer arrives at the seat (intake thread → mouth → throat/lungs → heart → vessel tree → seat)
// exactly when the old atom leaves (heat through the whole skin; CO₂ · H₂O are breathed out, breath.ts). A sampled
// quarter of these journeys is drawn as the in/out streams.
import { memo, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { BodyData, bodyData, GUT, MOUTH, N_BODY } from './body';
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

/** flow frames per day of the time-lapse (90 days = T.days0 … T.days1) */
export const dayFlow = () => memo('s07:dayflow', () => (flowTime(T.days1) - flowTime(T.days0)) / 90);

/** 第0天 → 第90天 */
export const dayAt = (t: number) => {
  const a = flowTime(T.days0);
  return Math.max(0, Math.min(90, (flowTime(t) - a) / dayFlow())) | 0;
};

// ------------------------------------------------------------- intake: one ordered thread into the mouth
// Food, water and air all enter through the mouth: a narrow, ordered gold thread arriving from the side at mouth
// height — low entropy in — while heat leaves through the whole skin and CO₂ · H₂O leave with the breath.
const INTAKE: [[number, number], [number, number], [number, number]] = [[-760, MOUTH[1] + 40], [-280, MOUTH[1] + 12], MOUTH];
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
/** point of the intake thread at bezier parameter u (no jitter) — for labels */
export const intakeAt = (u: number) => bez(INTAKE, u);
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
  // a braided stream that narrows into the mouth (spread across the thread: in H and in depth)
  const w = 1 - u * 0.85;
  const g1 = hash01(i * 3 + c * 17, 81) + hash01(i * 11 + c * 7, 84) - 1;
  const g2 = hash01(i * 7 + c * 31, 83) - 0.5;
  return [p[0], p[1] + g1 * 22 * w, g2 * 18 * w];
}

// ------------------------------------------------------------- turnover
export const V_INT = 46;
export const T_OUT = 30;
/** fraction of exchange journeys drawn as in/out stream particles */
export const KEEP = 0.26;
export const POOL_WATER = 0;
export const POOL_BONE = 1;
export const POOL_SLOW = 2;
/** mean residence per pool (days) */
export const TAU_DAYS = [10 / Math.LN2, 730, 250];

export interface Turnover {
  slot: Int32Array;
  pool: Uint8Array;
  /** exchanges of seat i: exT[exOff[i] .. exOff[i+1]) (flow time, ascending, all after day 0) */
  exOff: Int32Array;
  exT: Float32Array;
  /** first exchange of every seat, sorted (→ fraction of original atoms by binary search) */
  firstSorted: Float32Array;
  /** day-0 flow time */
  s0: number;
}

export const tEnter = () => intakeLen() / V_EXT;
/** length of the mouth → throat → heart segment (GUT) */
export const gutLen = () =>
  memo('s07:gutlen', () => {
    let L = 0;
    for (let k = 1; k < GUT.length; k++) L += Math.hypot(GUT[k][0] - GUT[k - 1][0], GUT[k][1] - GUT[k - 1][1]);
    return L;
  });
/** flow time from the start of the intake thread to the seat */
export const tIn = (B: BodyData, slot: number) => tEnter() + (gutLen() + B.plen[slot]) / V_INT;

export const turnover = (): Turnover =>
  memo('s07:turnover', () => {
    const B = bodyData();
    const slot = new Int32Array(N_BODY);
    const pool = new Uint8Array(N_BODY);
    let nb = 0;
    for (let i = 0; i < N_BODY; i++) {
      slot[i] = i % B.ns;
      if (B.bone[slot[i]]) nb++;
    }
    // slow pool = 40 %: every skeleton seat + a random share of the soft tissue (fat, collagen)
    const pSlow = Math.max(0, (0.4 * N_BODY - nb) / Math.max(1, N_BODY - nb));
    for (let i = 0; i < N_BODY; i++) pool[i] = B.bone[slot[i]] ? POOL_BONE : hash01(i, 207) < pSlow ? POOL_SLOW : POOL_WATER;
    const s0 = flowTime(T.days0);
    const sMax = flowTime(905) + T_OUT + 2;
    const D = dayFlow();
    const rnd = mulberry32(2024);
    const off = new Int32Array(N_BODY + 1);
    const ex: number[] = [];
    const first = new Float32Array(N_BODY);
    for (let i = 0; i < N_BODY; i++) {
      off[i] = ex.length;
      const tau = TAU_DAYS[pool[i]] * D;
      let s = s0;
      first[i] = 1e9;
      for (;;) {
        s += -tau * Math.log(1 - rnd());
        if (s > sMax) break;
        if (first[i] > 1e8) first[i] = s;
        ex.push(s);
      }
    }
    off[N_BODY] = ex.length;
    const firstSorted = Float32Array.from(first).sort();
    return { slot, pool, exOff: off, exT: new Float32Array(ex), firstSorted, s0 };
  });

/** fraction of the body's day-0 atoms still in the body at flow time s */
export function originalFraction(s: number): number {
  const TO = turnover();
  const a = TO.firstSorted;
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (a[m] <= s) lo = m + 1;
    else hi = m;
  }
  return 1 - lo / a.length;
}

/** index (into exT) of the last exchange of seat i at or before s, or −1 */
export function lastExchange(i: number, s: number): number {
  const TO = turnover();
  let lo = TO.exOff[i];
  let hi = TO.exOff[i + 1];
  const start = lo;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (TO.exT[m] <= s) lo = m + 1;
    else hi = m;
  }
  return lo - 1 >= start ? lo - 1 : -1;
}

export const ST_EXT = 0;
export const ST_TREE = 1;
export const ST_LINGER = 2;
export const ST_OUT = 3;

/** position of an INCOMING atom of seat slot, τ flow-frames after it entered the intake (seed i, m). out [X,H,Z,state,age] */
export function incomingPos(i: number, m: number, slot: number, tau: number, out: Float32Array) {
  const B = bodyData();
  const tE = tEnter();
  if (tau < tE) {
    const p = intakePoint(i, m, tau / tE);
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    out[3] = ST_EXT;
    out[4] = tau / tE;
    return;
  }
  const dAll = (tau - tE) * V_INT;
  const LG = gutLen();
  out[3] = ST_TREE;
  out[4] = dAll / Math.max(1e-3, LG + B.plen[slot]);
  if (dAll < LG) {
    // mouth → throat → heart (gut and lungs: where food, water and O₂ enter the blood)
    let d = dAll;
    for (let k = 1; k < GUT.length; k++) {
      const L = Math.hypot(GUT[k][0] - GUT[k - 1][0], GUT[k][1] - GUT[k - 1][1]);
      if (d <= L || k === GUT.length - 1) {
        const u = Math.min(1, d / L);
        out[0] = GUT[k - 1][0] + (GUT[k][0] - GUT[k - 1][0]) * u;
        out[1] = GUT[k - 1][1] + (GUT[k][1] - GUT[k - 1][1]) * u;
        out[2] = 0;
        return;
      }
      d -= L;
    }
  }
  const dInt = dAll - LG;
  const nd = B.node[slot];
  if (dInt >= B.tdist[nd]) {
    const seglen = Math.max(1e-3, B.plen[slot] - B.tdist[nd]);
    const u = Math.min(1, (dInt - B.tdist[nd]) / seglen);
    out[0] = B.tx[nd] + (B.sx[slot] - B.tx[nd]) * u;
    out[1] = B.th[nd] + (B.sh[slot] - B.th[nd]) * u;
    out[2] = B.sz[slot] * u;
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
}

/** position of an OUTGOING atom leaving seat slot through the skin as heat, u = 0..1 of its exit (seed i, m) */
export function outgoingPos(i: number, m: number, slot: number, u: number, out: Float32Array) {
  const B = bodyData();
  const nx = B.nx[slot];
  const nh = B.nh[slot];
  const dep = B.depth[slot];
  let X: number;
  let H: number;
  if (u < 0.3) {
    const k = (u / 0.3) * dep;
    X = B.sx[slot] + nx * k;
    H = B.sh[slot] + nh * k;
  } else {
    // out through the skin, then carried up by the warm air around the body (convection), wavering
    const v = (u - 0.3) / 0.7;
    const d = v * 70 + v * v * 40;
    const w = Math.sin(m * 2.1 + i * 0.7 + v * 6) * 11 * v;
    X = B.sx[slot] + nx * (dep + d) - nh * w;
    H = B.sh[slot] + nh * (dep + d) + nx * w + v * 30 + v * v * 190;
  }
  out[0] = X;
  out[1] = H;
  out[2] = B.sz[slot];
  out[3] = ST_OUT;
  out[4] = u;
}

/** is exchange m of seat i one of the drawn journeys? */
export const drawn = (i: number, m: number) => hash01(i * 977 + m * 13, 611) < KEEP;

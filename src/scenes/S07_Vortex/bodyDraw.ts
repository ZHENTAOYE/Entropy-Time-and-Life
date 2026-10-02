// The body: morph from the whirlpool (a rising, turning column that settles bottom-up into the figure), the vessel
// tree, and the turnover: seats always occupied (cyan = still a day-0 atom, gold = a newcomer), newcomers streaming in
// (intake thread → vessel tree → seat), the atoms they replace leaving through the skin (heat · CO₂ · H₂O).
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { bodyData, GUT, N_BODY } from './body';
import { Cam, project } from './camera';
import { drawn, flowTime, incomingPos, outgoingPos, ST_EXT, ST_LINGER, ST_OUT, ST_TREE, T_OUT, tIn, turnover } from './flow';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { T } from './timing';
import { funnel, NV, V, vCycle, vparts, vPos, vRadius } from './vortex';
import { memo } from '../../lib/math';

/** seat of body particle i */
export const slotOf = (i: number) => turnover().slot[i];

// ---------------------------------------------------------------- the waterspout (morph)
// The whirlpool stands up: from T.morph0 the innermost 10 000 drops stop draining and spiral (along their own log-spiral
// streamlines, ever faster) into a tight vertical vortex column over the eye — the eye water first, the rim last — rise
// up it as a constant-pitch helix (all trails parallel) and peel off into their seats, the feet first: the column
// grows upward like a waterspout and leaves the person behind it. Rank pairing: the innermost drop takes the lowest
// seat, so the figure fills from the floor up, strictly in time.
const COL_R = 56; // column radius (world px, ≈ the figure's half-width at the hips)
const VH = 46; // rise speed (world px / frame)
const OMEGA = -0.5; // column spin (rad / frame): the whirlpool's sense
const RAMP = 4; // frames for the rise to reach full speed
const DC = 9; // peel-off into the seat (frames)
const HB = funnel(COL_R); // the column starts down in the drain

interface Spout {
  /** body index → vortex particle index, and back (−1 = not a body particle) */
  VI: Int32Array;
  BI: Int32Array;
  tA: Float32Array;
  r0: Float32Array;
  th0: Float32Array;
  h0: Float32Array;
  dA: Float32Array;
  phiArr: Float32Array;
  tArr: Float32Array;
  tSeat: Float32Array;
  tDone: Float32Array;
}
const vt = new Float32Array(5);
export const spout = (): Spout =>
  memo('s07:spout', () => {
    const P = vparts();
    const B = bodyData();
    const TO = turnover();
    const rad = new Float32Array(NV);
    for (let j = 0; j < NV; j++) {
      const [, tau] = vCycle(P, j, T.morph0);
      rad[j] = vRadius(P, j, tau);
    }
    const near = Array.from({ length: NV }, (_, j) => j).sort((x, y) => rad[x] - rad[y]);
    const bodies = Array.from({ length: N_BODY }, (_, b) => b);
    const key = new Float32Array(N_BODY);
    for (let b = 0; b < N_BODY; b++) key[b] = B.sh[TO.slot[b]] + (hash01(b, 311) - 0.5) * 140;
    bodies.sort((x, y) => key[x] - key[y]);
    const VI = new Int32Array(N_BODY);
    const BI = new Int32Array(NV).fill(-1);
    for (let k = 0; k < N_BODY; k++) {
      VI[bodies[k]] = near[k];
      BI[near[k]] = bodies[k];
    }
    const rmax = rad[near[N_BODY - 1]];
    const tA = new Float32Array(N_BODY);
    const r0 = new Float32Array(N_BODY);
    const th0 = new Float32Array(N_BODY);
    const h0 = new Float32Array(N_BODY);
    const dA = new Float32Array(N_BODY);
    const phiArr = new Float32Array(N_BODY);
    const tArr = new Float32Array(N_BODY);
    const tSeat = new Float32Array(N_BODY);
    const tDone = new Float32Array(N_BODY);
    for (let b = 0; b < N_BODY; b++) {
      const j = VI[b];
      tA[b] = T.morph0 + 2 * hash01(b, 312);
      const [c, tau] = vCycle(P, j, tA[b]);
      vPos(P, j, c, tau, vt);
      r0[b] = vt[3];
      th0[b] = Math.atan2(vt[2], vt[0]);
      h0[b] = vt[1];
      dA[b] = 3 + 19 * Math.min(1, r0[b] / rmax);
      phiArr[b] = r0[b] > COL_R ? th0[b] + V.k * Math.log(r0[b] / COL_R) : th0[b] + OMEGA * dA[b];
      tArr[b] = tA[b] + dA[b];
      const rise = B.sh[TO.slot[b]] - HB;
      const sRise = rise >= (VH * RAMP) / 2 ? rise / VH + RAMP / 2 : Math.sqrt((2 * RAMP * rise) / VH);
      tSeat[b] = tArr[b] + sRise;
      tDone[b] = tSeat[b] + DC;
    }
    return { VI, BI, tA, r0, th0, h0, dA, phiArr, tArr, tSeat, tDone };
  });

/** start of body particle i's journey into the spout */
export const morphStart = (i: number) => spout().tA[i];
/** body particle i is seated from this frame on */
export const morphDone = (i: number) => spout().tDone[i];
/** body index of vortex particle j, or −1 */
export const bodyOf = (j: number) => spout().BI[j];

/** column point of body particle i, s frames after it reached the column */
function columnAt(S: Spout, i: number, s: number, out: Float32Array) {
  const phi = S.phiArr[i] + OMEGA * s;
  out[0] = COL_R * Math.cos(phi);
  out[1] = HB + (s < RAMP ? (VH * s * s) / (2 * RAMP) : VH * (s - RAMP / 2));
  out[2] = COL_R * Math.sin(phi);
}

/** Morph of body particle i at (fractional) frame f → out[0..2] = [X, H, Z]; returns the phase (0 drain, 1 column,
 *  2 peel-off) and writes the phase progress into out[3]. */
function morphPos(i: number, f: number, out: Float32Array): number {
  const S = spout();
  if (f < S.tArr[i]) {
    // A: along its own streamline into the column, accelerating (like the drain)
    const u = clamp((f - S.tA[i]) / S.dA[i]);
    const e = u * (0.55 + 0.45 * u);
    const r0 = S.r0[i];
    let r: number;
    let th: number;
    if (r0 > COL_R) {
      r = r0 * Math.pow(COL_R / r0, e);
      th = S.th0[i] + V.k * e * Math.log(r0 / COL_R);
    } else {
      r = r0 + (COL_R - r0) * e;
      th = S.th0[i] + OMEGA * (f - S.tA[i]);
    }
    out[0] = r * Math.cos(th);
    out[1] = funnel(r);
    out[2] = r * Math.sin(th);
    out[3] = u;
    return 0;
  }
  columnAt(S, i, f - S.tArr[i], out);
  if (f < S.tSeat[i]) {
    out[3] = (f - S.tArr[i]) / Math.max(1, S.tSeat[i] - S.tArr[i]);
    return 1;
  }
  // C: peel off the column into the seat
  const B = bodyData();
  const sl = slotOf(i);
  const u = clamp((f - S.tSeat[i]) / DC);
  const e = ease.outCubic(u);
  out[0] += (B.sx[sl] - out[0]) * e;
  out[1] += (B.sh[sl] - out[1]) * e;
  out[2] += (B.sz[sl] - out[2]) * e;
  out[3] = u;
  return 2;
}

const st5 = new Float32Array(5);

/** The end: the figure rises away as heat, head first. Shifts out[0..2] and writes the fade into out[10]. */
export function dissolve(seed: number, f: number, out: Float32Array) {
  const H0 = out[1];
  const d0 = T.dissolve0 + 20 * clamp(1 - H0 / 1000) + 6 * hash01(seed, 305);
  const a = f - d0;
  if (a <= 0) return;
  out[1] = H0 + 3 * a + 0.7 * a * a;
  out[0] += Math.sin(seed * 0.37 + a * 0.08) * a * 1.6;
  out[2] += Math.cos(seed * 0.53 + a * 0.07) * a * 1.6;
  out[10] = Math.max(0, 1 - a / 22);
}

// ---------------------------------------------------------------- per-frame cache (shared with the thermal splat)
/** in-flight journeys drawn at most */
const MAXF = 9000;
const NE = N_BODY + MAXF;
const MPTS = 8; // max morph polyline points

export interface BodyFrame {
  f: number;
  /** number of valid entries: [0, N_BODY) seats, [N_BODY, n) in-flight atoms */
  n: number;
  sx: Float32Array; // screen x
  sy: Float32Array;
  px: Float32Array; // screen x a moment earlier (trail)
  py: Float32Array;
  k: Float32Array; // perspective scale
  wx: Float32Array; // world
  wh: Float32Array;
  wz: Float32Array;
  state: Int8Array; // -1 morphing, -2 not started, 0..3 flow states
  age: Float32Array;
  orig: Uint8Array;
  m: Float32Array;
  arm: Uint8Array;
  vis: Uint8Array;
  slot: Int32Array;
  fade: Float32Array;
  seed: Int32Array;
  /** morph polylines: mp[e*MPTS*2 …], mn[e] points */
  mp: Float32Array;
  mn: Uint8Array;
  mlen: Float32Array;
}
let cache: BodyFrame | null = null;
const pr = new Float32Array(3);
const bw = new Float32Array(11);

const alloc = (): BodyFrame => ({
  f: -1,
  n: 0,
  sx: new Float32Array(NE),
  sy: new Float32Array(NE),
  px: new Float32Array(NE),
  py: new Float32Array(NE),
  k: new Float32Array(NE),
  wx: new Float32Array(NE),
  wh: new Float32Array(NE),
  wz: new Float32Array(NE),
  state: new Int8Array(NE),
  age: new Float32Array(NE),
  orig: new Uint8Array(NE),
  m: new Float32Array(NE),
  arm: new Uint8Array(NE),
  vis: new Uint8Array(NE),
  slot: new Int32Array(NE),
  fade: new Float32Array(NE),
  seed: new Int32Array(NE),
  mp: new Float32Array(N_BODY * MPTS * 2),
  mn: new Uint8Array(N_BODY),
  mlen: new Float32Array(N_BODY),
});

/** project world bw[0..2] (after the dissolve) into entry e; returns false when invisible */
function put(c: BodyFrame, e: number, f: number, seed: number): boolean {
  bw[10] = 1;
  if (f > T.dissolve0) dissolve(seed, f, bw);
  c.wx[e] = bw[0];
  c.wh[e] = bw[1];
  c.wz[e] = bw[2];
  c.fade[e] = bw[10];
  c.seed[e] = seed;
  if (bw[10] <= 0.002 || !project(camRef!, bw[0], bw[1], bw[2], pr, 0)) {
    c.vis[e] = 0;
    return false;
  }
  c.vis[e] = 1;
  c.sx[e] = pr[0];
  c.sy[e] = pr[1];
  c.k[e] = pr[2];
  return true;
}
let camRef: Cam | null = null;

/** trail end of entry e from world point bw (at the earlier time), dissolved with the same seed */
function trailFrom(c: BodyFrame, e: number, f: number, k = 1) {
  bw[10] = 1;
  if (f > T.dissolve0) dissolve(c.seed[e], f, bw);
  if (!project(camRef!, bw[0], bw[1], bw[2], pr, 0)) {
    c.px[e] = c.sx[e];
    c.py[e] = c.sy[e];
    return;
  }
  c.px[e] = c.sx[e] + (pr[0] - c.sx[e]) * k;
  c.py[e] = c.sy[e] + (pr[1] - c.sy[e]) * k;
}

/** Body states for frame f (computed once per frame). */
export function bodyFrame(f: number, cam: Cam, trailDt = 2): BodyFrame {
  if (cache && cache.f === f) return cache;
  const c = cache ?? alloc();
  camRef = cam;
  c.f = f;
  const B = bodyData();
  const TO = turnover();
  const s = flowTime(f);
  const sP = flowTime(f - trailDt);
  // the heat leaving the skin gets longer trails (it must read as a stream, as strong as the intake)
  const sPo = flowTime(f - 3.5);
  const flowOn = smoothstep(T.flowOn0, T.flowOn1, f);
  const treeReveal = ease.inOutSine(seg(f, T.treeGrow0, T.treeGrow1)) * B.tmax;
  // ---- seats
  const SP = spout();
  for (let i = 0; i < N_BODY; i++) {
    c.mn[i] = 0;
    if (f < SP.tA[i]) {
      c.state[i] = -2;
      c.vis[i] = 0;
      continue;
    }
    const sl = TO.slot[i];
    c.slot[i] = sl;
    c.arm[i] = vparts().arm[SP.VI[i]] >= 0 ? 1 : 0;
    if (f < SP.tDone[i]) {
      // on its way: drain → spout → seat. Trails ≤ 1 frame, sampled as a short arc
      const ph = morphPos(i, f, bw);
      c.state[i] = ph === 2 ? -3 : -1;
      c.m[i] = ph === 2 ? bw[3] : ph === 0 ? 0.3 * bw[3] : 0.3 + 0.7 * bw[3];
      c.orig[i] = 1;
      c.age[i] = 0;
      if (!put(c, i, f, i)) continue;
      const tr = Math.min(1, f - SP.tA[i]);
      const n = ph === 0 ? 4 : 3;
      const o = i * MPTS * 2;
      c.mp[o] = c.sx[i];
      c.mp[o + 1] = c.sy[i];
      let len = 0;
      for (let j = 1; j < n; j++) {
        morphPos(i, f - (tr * j) / (n - 1), bw);
        project(cam, bw[0], bw[1], bw[2], pr, 0);
        c.mp[o + j * 2] = pr[0];
        c.mp[o + j * 2 + 1] = pr[1];
        len += Math.hypot(pr[0] - c.mp[o + j * 2 - 2], pr[1] - c.mp[o + j * 2 - 1]);
      }
      c.mn[i] = n;
      c.mlen[i] = len;
      c.px[i] = c.mp[o + (n - 1) * 2];
      c.py[i] = c.mp[o + (n - 1) * 2 + 1];
      continue;
    }
    // seated: the occupant is a day-0 atom until the seat's first exchange
    const m = flowOn > 0 ? lastExchangeIdx(TO, i, s) : -1;
    bw[0] = B.sx[sl] + 1.3 * Math.sin(s * 0.21 + i * 0.37);
    bw[1] = B.sh[sl] + 1.3 * Math.cos(s * 0.17 + i * 0.91);
    bw[2] = B.sz[sl];
    c.state[i] = ST_LINGER;
    c.orig[i] = m < 0 ? 1 : 0;
    c.age[i] = m < 0 ? 999 : s - TO.exT[m];
    c.m[i] = 1;
    if (!put(c, i, f, i)) continue;
    c.px[i] = c.sx[i];
    c.py[i] = c.sy[i];
  }
  // ---- in-flight atoms (a sampled share of the exchanges): newcomers on their way in, replaced atoms leaving
  let e = N_BODY;
  if (flowOn > 0.001) {
    for (let i = 0; i < N_BODY && e < NE; i++) {
      if (f < SP.tDone[i]) continue;
      const sl = TO.slot[i];
      const tin = tIn(B, sl);
      const a = TO.exOff[i];
      const b = TO.exOff[i + 1];
      if (a === b) continue;
      // exchanges with E in (s − T_OUT, s + tin]
      let lo = a;
      let hi = b;
      const sLow = s - T_OUT;
      while (lo < hi) {
        const md = (lo + hi) >> 1;
        if (TO.exT[md] <= sLow) lo = md + 1;
        else hi = md;
      }
      for (let m = lo; m < b && e < NE; m++) {
        const E = TO.exT[m];
        if (E > s + tin) break;
        if (!drawn(i, m)) continue;
        const seed = 20000 + m;
        if (E > s) {
          // incoming: entered the intake at E − tin
          const tau = s - (E - tin);
          incomingPos(i, m, sl, tau, st5);
          if (st5[3] === ST_TREE && B.tstep[B.node[sl]] > treeReveal) continue; // not before its branch has grown
          bw[0] = st5[0];
          bw[1] = st5[1];
          bw[2] = st5[2];
          c.state[e] = st5[3];
          c.age[e] = st5[4];
          c.orig[e] = 0;
          c.slot[e] = sl;
          c.m[e] = 1;
          c.arm[e] = 0;
          if (!put(c, e, f, seed)) continue;
          c.fade[e] *= flowOn;
          const tauP = sP - (E - tin);
          if (tauP >= 0) {
            incomingPos(i, m, sl, tauP, st5);
            bw[0] = st5[0];
            bw[1] = st5[1];
            bw[2] = st5[2];
            trailFrom(c, e, f - trailDt, st5[3] === ST_EXT ? 0.35 : 1);
          } else {
            c.px[e] = c.sx[e];
            c.py[e] = c.sy[e];
          }
          e++;
        } else {
          // outgoing: left the seat at E
          const u = (s - E) / T_OUT;
          if (u >= 1) continue;
          outgoingPos(i, m, sl, u, st5);
          bw[0] = st5[0];
          bw[1] = st5[1];
          bw[2] = st5[2];
          c.state[e] = ST_OUT;
          c.age[e] = u;
          c.orig[e] = m === a ? 1 : 0;
          c.slot[e] = sl;
          c.m[e] = 1;
          c.arm[e] = 0;
          if (!put(c, e, f, seed)) continue;
          c.fade[e] *= flowOn;
          const uP = (sPo - E) / T_OUT;
          if (uP >= 0) {
            outgoingPos(i, m, sl, uP, st5);
            bw[0] = st5[0];
            bw[1] = st5[1];
            bw[2] = st5[2];
            trailFrom(c, e, f - trailDt);
          } else {
            c.px[e] = c.sx[e];
            c.py[e] = c.sy[e];
          }
          e++;
        }
      }
    }
  }
  c.n = e;
  cache = c;
  return c;
}

function lastExchangeIdx(TO: ReturnType<typeof turnover>, i: number, s: number): number {
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

// ---------------------------------------------------------------- drawing
const LV = 4;
const K_MORPH_W = 0;
const K_MORPH_A = 1;
const K_ORIG = 2;
const K_FRESH = 3;
const K_OLD = 4;
const K_TREE = 5;
const K_EXT = 6;
const K_OUT = 7;
const NK = 8;
const COL = [
  hex('#7FE3F0'), // morph water
  hex('#FFC94A'), // morph arm
  hex('#C8F7FF'), // original (day-0) atoms
  hex('#FFC94A'), // newcomers, fresh
  hex('#D8913C'), // newcomers, settled
  hex('#FFE7AE'), // in the vessels
  hex('#FFC94A'), // incoming streams
  hex('#FF3B2F'), // leaving (heat, CO₂, H₂O)
];
// the turning column is dense: each morphing atom stays faint so the column reads as water, not as a white blob
const BASE_A = [0.2, 0.22, 0.85, 0.72, 0.46, 0.28, 0.3, 0.5];

export interface BodyDrawOpts {
  alpha: number;
  /** per-kind multipliers */
  dot?: number;
  ext?: number;
  tree?: number;
  out?: number;
  /** 0 = metabolic colours, 1 = frozen / cold violet */
  cold?: number;
  /** draw every particle as a still dot (the freeze) */
  stillDots?: number;
}

export function drawBody(ctx: CanvasRenderingContext2D, f: number, cam: Cam, o: BodyDrawOpts) {
  if (o.alpha <= 0.003) return;
  const bf = bodyFrame(f, cam);
  const S = new Strokes(NK * LV);
  const D = new Strokes(NK * LV);
  const dotA = o.dot ?? 1;
  const extA = o.ext ?? 1;
  const treeA = o.tree ?? 1;
  const outA = o.out ?? 1;
  const still = o.stillDots ?? 0;
  const mpBuf = new Float32Array(MPTS * 2);
  for (let i = 0; i < bf.n; i++) {
    if (!bf.vis[i]) continue;
    const s = bf.state[i];
    let kind: number;
    let inten = 0.75 + 0.5 * hash01(bf.seed[i], 303);
    let dot = false;
    if (s === -1) {
      // in the drain / up the spout: a dim streak of water (the column is dense)
      kind = bf.arm[i] ? K_MORPH_A : K_MORPH_W;
      inten *= 0.8 + 0.3 * Math.sin(bf.m[i] * Math.PI);
    } else if (s === -3) {
      // peeling off into its seat: lights up as it lands
      dot = true;
      kind = K_ORIG;
      inten *= (0.2 + 0.8 * bf.m[i]) * dotA;
    } else if (s === ST_LINGER) {
      dot = true;
      if (bf.orig[i]) kind = K_ORIG;
      else kind = bf.age[i] < 45 ? K_FRESH : K_OLD;
      inten *= dotA;
    } else if (s === ST_TREE) {
      kind = K_TREE;
      inten *= treeA;
    } else if (s === ST_EXT) {
      kind = K_EXT;
      inten *= extA * (0.55 + 0.45 * smoothstep(0.5, 1, bf.age[i]));
    } else {
      kind = K_OUT;
      inten *= outA * (1 - ease.inQuad(bf.age[i])) * smoothstep(0, 0.12, bf.age[i]);
    }
    if (still > 0 && s >= 0) {
      dot = true;
      inten = Math.max(inten, still * (0.6 + 0.6 * hash01(bf.seed[i], 304)));
    }
    inten *= o.alpha * bf.fade[i];
    if (s === -1) {
      // energy-conserving: a fast arc spreads the same light over its length
      inten *= Math.min(1, Math.max(0.3, 30 / (bf.mlen[i] + 1)));
    } else if (!dot && kind !== K_EXT) {
      const len = Math.abs(bf.sx[i] - bf.px[i]) + Math.abs(bf.sy[i] - bf.py[i]);
      inten *= Math.min(1, Math.max(0.15, 16 / (len + 1)));
    }
    if (inten < 0.04) continue;
    const lvl = Math.min(LV - 1, Math.floor(clamp(inten) * LV));
    const b = kind * LV + lvl;
    // original atoms are drawn a little larger: by day 90 they are the skeleton that persists inside the new flesh
    if (dot) D.dot(b, bf.sx[i], bf.sy[i], (kind === K_ORIG ? 2.9 : 2.4) * Math.max(0.7, bf.k[i]));
    else if (s === -1 && bf.mn[i] >= 2) {
      const n = bf.mn[i];
      mpBuf.set(bf.mp.subarray(i * MPTS * 2, i * MPTS * 2 + n * 2));
      S.poly(b, mpBuf, n);
    } else S.seg(b, bf.px[i], bf.py[i], bf.sx[i], bf.sy[i]);
  }
  const cold = o.cold ?? 0;
  const COLD = hex('#8E7BFF');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  for (let b = 0; b < NK * LV; b++) {
    const kind = Math.floor(b / LV);
    const a = ((b % LV) + 0.5) / LV;
    const col = cold > 0 ? mixArr(COL[kind], COLD, cold) : COL[kind];
    const al = BASE_A[kind] * (0.35 + 0.65 * a);
    S.stroke(ctx, b, rgbaArr(col, al), kind === K_TREE ? 1.3 : kind === K_OUT ? 1.6 : kind === K_EXT ? 1.6 : kind <= K_MORPH_A ? 1.3 : 1.5);
    D.fill(ctx, b, rgbaArr(col, al));
  }
  // a diffuse red halo around the heat leaving the skin
  for (let l = 0; l < LV; l++) {
    const b = K_OUT * LV + l;
    const col = cold > 0 ? mixArr(COL[K_OUT], COLD, cold) : COL[K_OUT];
    S.stroke(ctx, b, rgbaArr(col, BASE_A[K_OUT] * 0.13 * (0.35 + (0.65 * (l + 0.5)) / LV)), 7);
  }
  ctx.restore();
}

/** The vessel tree (Murray's-law radii), revealed as it grows from the mouth. */
export function drawVessels(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.003) return;
  const B = bodyData();
  const reveal = ease.inOutSine(seg(f, T.treeGrow0, T.treeGrow1)) * B.tmax;
  if (reveal <= 0) return;
  const buckets = 4;
  const S = new Strokes(buckets);
  const a = new Float32Array(3);
  const b = new Float32Array(3);
  for (let i = 0; i < B.tn; i++) {
    const p = B.tpar[i];
    if (p < 0 || B.tstep[i] > reveal) continue;
    if (!project(cam, B.tx[p], B.th[p], 0, a, 0)) continue;
    if (!project(cam, B.tx[i], B.th[i], 0, b, 0)) continue;
    const g = Math.min(buckets - 1, Math.floor(Math.log2(B.trad[i] + 1) * 0.9));
    const u = Math.min(1, reveal - B.tstep[i] + 1);
    S.seg(g, a[0], a[1], a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
  }
  // mouth → throat → heart (gut / lungs): drawn first, from the mouth down; the tree then grows out of the heart
  const ug = clamp(reveal / (0.18 * B.tmax));
  let len = 0;
  for (let k = 1; k < GUT.length; k++) len += Math.hypot(GUT[k][0] - GUT[k - 1][0], GUT[k][1] - GUT[k - 1][1]);
  let rem = ug * len;
  for (let k = 1; k < GUT.length && rem > 0; k++) {
    const L = Math.hypot(GUT[k][0] - GUT[k - 1][0], GUT[k][1] - GUT[k - 1][1]);
    const u = Math.min(1, rem / L);
    rem -= L;
    if (!project(cam, GUT[k - 1][0], GUT[k - 1][1], 0, a, 0) || !project(cam, GUT[k][0], GUT[k][1], 0, b, 0)) continue;
    S.seg(buckets - 1, a[0], a[1], a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let g = 0; g < buckets; g++) {
    S.stroke(ctx, g, `rgba(255,${190 + g * 12},${90 + g * 30},${(0.1 + g * 0.08) * alpha})`, (0.8 + g * 0.9) * cam.zoom);
  }
  ctx.restore();
}

/** The waterspout's glowing core: a soft column of water light between the drain and the top of the rising spout. */
export function drawSpoutGlow(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const t = f - T.morph0;
  if (t < 2 || t > 62) return;
  const top = Math.min(1000, HB + VH * Math.max(0, t - 4));
  const bot = HB + VH * Math.max(0, t - 26);
  if (top - bot < 20) return;
  const a = smoothstep(2, 10, t) * (1 - smoothstep(44, 62, t));
  const p0 = new Float32Array(3);
  const p1 = new Float32Array(3);
  if (!project(cam, 0, bot, 0, p0, 0) || !project(cam, 0, top, 0, p1, 0)) return;
  const k = 0.5 * (p0[2] + p1[2]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  // tapered: a gradient along the axis (bright where it is fed, fading at the leading tip)
  for (const [w, al] of [
    [COL_R * 3.2, 0.045],
    [COL_R * 1.7, 0.07],
    [COL_R * 0.55, 0.09],
  ] as const) {
    const gg = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    gg.addColorStop(0, `rgba(127,227,240,${al * a})`);
    gg.addColorStop(0.75, `rgba(150,236,248,${al * a})`);
    gg.addColorStop(1, 'rgba(190,246,255,0)');
    ctx.strokeStyle = gg;
    ctx.lineWidth = w * k;
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  }
  ctx.restore();
}

/** The leftover pool on the floor beneath the figure: spins down and fades. */
export const poolAlpha = (f: number) => 1 - smoothstep(T.morph0 + 10, T.morph0 + 70, f);
export { V };

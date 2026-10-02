// The body: morph from the whirlpool (a rising, turning column that settles bottom-up into the figure), the vessel
// tree, and the turnover: seats always occupied (cyan = still a day-0 atom, gold = a newcomer), newcomers streaming in
// (intake thread → vessel tree → seat), the atoms they replace leaving through the skin (heat · CO₂ · H₂O).
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { bodyData, N_BODY } from './body';
import { Cam, project } from './camera';
import { drawn, flowTime, incomingPos, outgoingPos, ST_EXT, ST_LINGER, ST_OUT, ST_TREE, T_OUT, tIn, turnover } from './flow';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { T } from './timing';
import { V, vCycle, vparts, vPos } from './vortex';

/** seat of body particle i */
export const slotOf = (i: number) => turnover().slot[i];

let MT: Float32Array | null = null;
/** morph start of body particle i (bottom of the figure first) */
export function morphStart(i: number): number {
  if (!MT) {
    const B = bodyData();
    const TO = turnover();
    MT = new Float32Array(N_BODY);
    for (let j = 0; j < N_BODY; j++) MT[j] = T.morph0 + T.morphSpan * clamp(B.sh[TO.slot[j]] / 1000) + 4 * hash01(j, 301);
  }
  return MT[i];
}

export const morphStarted = (i: number, f: number) => i < N_BODY && f >= morphStart(i);

const vt = new Float32Array(5);
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

/** Morph of particle i at (fractional) frame f: from its whirlpool position into its seat — a waterspout.
 *  All atoms share one coherent turn (¾ of a turn, the whirlpool's way) while the water lifts into a spinning column;
 *  each atom's own correction to its seat angle is applied late, when it is already close to the axis — so the streaks
 *  stay parallel (a spinning column of water) instead of crossing like straw. → [X,H,Z]; returns the turning angle;
 *  m in out[3] (0..1). */
const TURN = -1.5 * Math.PI;
function morphPos(i: number, f: number, out: Float32Array): number {
  const B = bodyData();
  const t0 = morphStart(i);
  const m = clamp((f - t0) / T.morphLen);
  const P = vparts();
  const [c, tau] = vCycle(P, i, t0);
  vPos(P, i, c, tau, vt);
  const r0 = vt[3];
  const th0 = Math.atan2(vt[2], vt[0]);
  const h0 = vt[1];
  const s0 = slotOf(i);
  const bx = B.sx[s0];
  const bh = B.sh[s0];
  const bz = B.sz[s0];
  const rb = Math.hypot(bx, bz);
  const ab = Math.atan2(bz, bx);
  const TAU = Math.PI * 2;
  let d = ab - (th0 + TURN);
  d -= Math.round(d / TAU) * TAU; // shortest correction, −π … π
  const a = th0 + TURN * ease.inOutSine(m) + d * smoothstep(0.4, 1, m);
  // the column first gathers to ~half the whirlpool's radius while it rises, then closes onto the seat
  const rCol = Math.max(rb, 0.45 * r0);
  const rho = m < 0.5 ? r0 + (rCol - r0) * ease.inOutSine(m / 0.5) : rCol + (rb - rCol) * ease.inOutCubic((m - 0.5) / 0.5);
  out[0] = rho * Math.cos(a);
  out[1] = h0 + (bh - h0) * ease.inOutSine(clamp(m / 0.8)) + Math.sin(m * Math.PI) * 40;
  out[2] = rho * Math.sin(a);
  out[3] = m;
  return a;
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
  const flowOn = smoothstep(T.flowOn0, T.flowOn1, f);
  const treeReveal = ease.inOutSine(seg(f, T.treeGrow0, T.treeGrow1)) * B.tmax;
  // ---- seats
  for (let i = 0; i < N_BODY; i++) {
    c.mn[i] = 0;
    if (!morphStarted(i, f)) {
      c.state[i] = -2;
      c.vis[i] = 0;
      continue;
    }
    const sl = TO.slot[i];
    c.slot[i] = sl;
    c.arm[i] = vparts().arm[i] >= 0 ? 1 : 0;
    const t0 = morphStart(i);
    if (f < t0 + T.morphLen) {
      // morphing: a finely sampled arc of its turning path (no straight chords across the column)
      const a1 = morphPos(i, f, bw);
      c.state[i] = -1;
      c.m[i] = bw[3];
      c.orig[i] = 1;
      c.age[i] = 0;
      if (!put(c, i, f, i)) continue;
      let tr = Math.min(1.5, f - t0);
      const a0 = morphPos(i, f - tr, st5);
      let sweep = Math.abs(a1 - a0);
      if (sweep > 0.3) {
        tr *= 0.3 / sweep;
        sweep = 0.3;
      }
      const n = Math.min(MPTS, Math.max(2, Math.ceil(sweep / 0.08) + 1));
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
      if (f < morphStart(i)) continue;
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
          const uP = (sP - E) / T_OUT;
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
const BASE_A = [0.13, 0.15, 0.85, 0.72, 0.46, 0.28, 0.34, 0.2];

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
      kind = bf.arm[i] ? K_MORPH_A : K_MORPH_W;
      // bright while it flies, settling softly into its seat (the arrival front must not pile up into a white blob)
      inten *= (0.85 + 0.35 * Math.sin(bf.m[i] * Math.PI)) * (1 - 0.6 * smoothstep(0.45, 1, bf.m[i]));
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
      inten *= outA * (1 - ease.inQuad(bf.age[i]));
    }
    if (still > 0 && s >= 0) {
      dot = true;
      inten = Math.max(inten, still * (0.6 + 0.6 * hash01(bf.seed[i], 304)));
    }
    inten *= o.alpha * bf.fade[i];
    if (s === -1) {
      // energy-conserving: a fast arc spreads the same light over its length
      inten *= Math.min(1, Math.max(0.12, 18 / (bf.mlen[i] + 1)));
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
    S.stroke(ctx, b, rgbaArr(col, al), kind === K_TREE ? 1.3 : kind === K_OUT ? 1.2 : kind === K_EXT ? 1.8 : kind <= K_MORPH_A ? 1.3 : 1.5);
    D.fill(ctx, b, rgbaArr(col, al));
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
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let g = 0; g < buckets; g++) {
    S.stroke(ctx, g, `rgba(255,${190 + g * 12},${90 + g * 30},${(0.1 + g * 0.08) * alpha})`, (0.8 + g * 0.9) * cam.zoom);
  }
  ctx.restore();
}

/** The leftover pool on the floor beneath the figure: spins down and fades. */
export const poolAlpha = (f: number) => 1 - smoothstep(T.morph0 + 10, T.morph0 + 70, f);
export { V };

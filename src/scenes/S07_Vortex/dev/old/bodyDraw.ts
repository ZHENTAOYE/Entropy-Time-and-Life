// The body: morph from the whirlpool (a rising helix that settles bottom-up into the figure), the vessel tree,
// and the metabolic flow (in at the mouth → tree → linger → out through the skin).
import { clamp, ease, seg, smoothstep } from '../../../../lib/math';
import { hash01 } from '../../../../lib/random';
import { bodyData, N_BODY } from './body';
import { Cam, project } from './camera';
import { bodyParts, bodyState, flowTime, ST_EXT, ST_LINGER, ST_TREE } from './flow';
import { hex, mixArr, rgbaArr, Strokes } from './gfx';
import { T } from './timing';
import { V, vCycle, vparts, vPos } from './vortex';

/** morph start of body particle i (bottom of the figure first) */
export function morphStart(i: number): number {
  const B = bodyData();
  const s0 = slot0Of(i);
  return T.morph0 + T.morphSpan * clamp(B.sh[s0] / 1000) + 4 * hash01(i, 301);
}
const slot0Of = (i: number) => bodyParts().slot0[i];

export const morphStarted = (i: number, f: number) => i < N_BODY && f >= morphStart(i);

const vt = new Float32Array(4);
const st = new Float32Array(8);
const bw2 = new Float32Array(11);

/** World position of body particle i at frame f (morph, flow, dissolve).
 * out: [X,H,Z, state, age, orig, m, isArm, cycle, slot, fade] */
export function bodyWorld(i: number, f: number, out: Float32Array) {
  bodyWorldRaw(i, f, out);
  out[10] = 1;
  if (f > T.dissolve0) dissolve(i, f, out);
}

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

function bodyWorldRaw(i: number, f: number, out: Float32Array) {
  const B = bodyData();
  const t0 = morphStart(i);
  const m = clamp((f - t0) / T.morphLen);
  if (m < 1) {
    const P = vparts();
    const tf = Math.min(f, t0);
    const [c, tau] = vCycle(P, i, tf);
    vPos(P, i, c, tau, vt);
    const r0 = vt[3];
    const th0 = Math.atan2(vt[2], vt[0]);
    const h0 = vt[1];
    const s0 = slot0Of(i);
    const bx = B.sx[s0];
    const bh = B.sh[s0];
    const bz = B.sz[s0];
    const rb = Math.hypot(bx, bz);
    const ab = Math.atan2(bz, bx);
    const TAU = Math.PI * 2;
    let dA = (((th0 - ab) % TAU) + TAU) % TAU;
    dA = -(dA + TAU); // keep turning the vortex's way (clockwise on screen), one extra turn
    const e = ease.inOutCubic(m);
    const rho = r0 + (rb - r0) * e;
    const a = th0 + dA * (1 - (1 - m) * (1 - m));
    out[0] = rho * Math.cos(a);
    out[1] = h0 + (bh - h0) * ease.inOutSine(m) + Math.sin(m * Math.PI) * 60;
    out[2] = rho * Math.sin(a);
    out[3] = -1;
    out[4] = 0;
    out[5] = 1;
    out[6] = m;
    out[7] = P.arm[i] >= 0 ? 1 : 0;
    out[8] = -1;
    out[9] = s0;
    return;
  }
  bodyState(i, flowTime(f), st);
  out[0] = st[0];
  out[1] = st[1];
  out[2] = st[2];
  out[3] = st[3];
  out[4] = st[4];
  out[5] = st[5];
  out[6] = 1;
  out[7] = 0;
  out[8] = st[7];
  out[9] = st[6];
}

// ---------------------------------------------------------------- per-frame cache (shared with the thermal splat)
export interface BodyFrame {
  f: number;
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
}
let cache: BodyFrame | null = null;
const pr = new Float32Array(3);
const bw = new Float32Array(11);

/** Body particle states for frame f (computed once per frame). `trailDt` frames of trail. */
export function bodyFrame(f: number, cam: Cam, trailDt = 2): BodyFrame {
  if (cache && cache.f === f) return cache;
  const n = N_BODY;
  const c: BodyFrame = cache ?? {
    f,
    sx: new Float32Array(n),
    sy: new Float32Array(n),
    px: new Float32Array(n),
    py: new Float32Array(n),
    k: new Float32Array(n),
    wx: new Float32Array(n),
    wh: new Float32Array(n),
    wz: new Float32Array(n),
    state: new Int8Array(n),
    age: new Float32Array(n),
    orig: new Uint8Array(n),
    m: new Float32Array(n),
    arm: new Uint8Array(n),
    vis: new Uint8Array(n),
    slot: new Int32Array(n),
    fade: new Float32Array(n),
  };
  c.f = f;
  for (let i = 0; i < n; i++) {
    if (!morphStarted(i, f)) {
      c.state[i] = -2;
      c.vis[i] = 0;
      continue;
    }
    bodyWorld(i, f, bw);
    c.wx[i] = bw[0];
    c.wh[i] = bw[1];
    c.wz[i] = bw[2];
    c.state[i] = bw[3];
    c.age[i] = bw[4];
    c.orig[i] = bw[5];
    c.m[i] = bw[6];
    c.arm[i] = bw[7];
    c.slot[i] = bw[9];
    c.fade[i] = bw[10];
    const shortTrail = bw[3] === ST_EXT;
    if (bw[10] <= 0.002 || !project(cam, bw[0], bw[1], bw[2], pr, 0)) {
      c.vis[i] = 0;
      continue;
    }
    c.vis[i] = 1;
    c.sx[i] = pr[0];
    c.sy[i] = pr[1];
    c.k[i] = pr[2];
    const cyc = bw[8];
    bodyWorld(i, f - trailDt, bw2);
    if (bw2[8] !== cyc || !project(cam, bw2[0], bw2[1], bw2[2], pr, 0)) {
      c.px[i] = c.sx[i];
      c.py[i] = c.sy[i];
    } else {
      c.px[i] = shortTrail ? c.sx[i] + (pr[0] - c.sx[i]) * 0.35 : pr[0];
      c.py[i] = shortTrail ? c.sy[i] + (pr[1] - c.sy[i]) * 0.35 : pr[1];
    }
  }
  cache = c;
  return c;
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
  hex('#BDF4FF'), // original atoms
  hex('#FFC94A'), // new atoms, fresh
  hex('#E7A24A'), // new atoms, settled
  hex('#FFE7AE'), // in the vessels
  hex('#FFC94A'), // incoming streams
  hex('#FF3B2F'), // leaving (heat, CO₂, H₂O)
];
const BASE_A = [0.2, 0.24, 0.72, 0.8, 0.6, 0.3, 0.3, 0.15];

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
  for (let i = 0; i < N_BODY; i++) {
    if (!bf.vis[i]) continue;
    const s = bf.state[i];
    let kind: number;
    let inten = 0.75 + 0.5 * hash01(i, 303);
    let dot = false;
    if (s === -1) {
      kind = bf.arm[i] ? K_MORPH_A : K_MORPH_W;
      inten *= 0.8 + 0.4 * Math.sin(bf.m[i] * Math.PI);
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
      inten = Math.max(inten, still * (0.6 + 0.6 * hash01(i, 304)));
    }
    inten *= o.alpha * bf.fade[i];
    if (!dot && kind !== K_EXT) {
      const len = Math.abs(bf.sx[i] - bf.px[i]) + Math.abs(bf.sy[i] - bf.py[i]);
      inten *= Math.min(1, Math.max(0.15, 16 / (len + 1)));
    }
    if (inten < 0.04) continue;
    const lvl = Math.min(LV - 1, Math.floor(clamp(inten) * LV));
    const b = kind * LV + lvl;
    if (dot) D.dot(b, bf.sx[i], bf.sy[i], (kind === K_FRESH || kind === K_OLD ? 2.7 : 2.3) * Math.max(0.7, bf.k[i]));
    else S.seg(b, bf.px[i], bf.py[i], bf.sx[i], bf.sy[i]);
  }
  const cold = o.cold ?? 0;
  const COLD = hex('#8E7BFF');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt';
  for (let b = 0; b < NK * LV; b++) {
    const kind = Math.floor(b / LV);
    const a = ((b % LV) + 0.5) / LV;
    const col = cold > 0 ? mixArr(COL[kind], COLD, cold) : COL[kind];
    const al = BASE_A[kind] * (0.35 + 0.65 * a);
    S.stroke(ctx, b, rgbaArr(col, al), kind === K_TREE ? 1.3 : kind === K_OUT ? 1.2 : kind === K_EXT ? 1.8 : 1.5);
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

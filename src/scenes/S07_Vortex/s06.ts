// S06's LAST IMAGE, rebuilt for the S06 → S07 match cut (S06 revision 1: network.ts / netGL.ts / timing.ts).
// At its last frame (f581) S06 shows a fully wound clockwise log-spiral whirlpool: θ = K·ln(720/(r+20)) + spin,
// K = K_END = 5 (still settling: S06's kShape runs to f596), ~1500 gold → olive → teal inflow streaks from beyond the
// frame, the 13-leaf vein rosette (blades gone, pulses of light running to the sink), sunlight still landing on the
// vein tips, red IR sparks shed at every junction, and the white-green sink (core R ≈ 76, glow 160).
// Everything here continues S06's own clock (S06 frame = 581 + S07 frame) with S06's own formulas and seeds; the vein
// trees are S06's pre-grown data (s06net.blob.ts, a copy of S06's netData.blob.ts). Drawn in S06's ground space
// (= screen space at the cut, centred on SPIRAL) through S07's top-view camera; vortexDraw.ts fades it out over f0–40
// while S07's whirlpool (same pitch, same sense of rotation) takes over.
import type { GrowthNode } from '../../lib/growth';
import { SPIRAL } from '../../lib/handoff';
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { Cam } from './camera';
import { LEAF_B64 } from './s06net.blob';

const C = SPIRAL;
export const S06_LAST = 581;
const NLEAF = 13;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
// S06 timing.ts
const NET_GROW_START = 428;
const SWIRL_START = 500;
const S06_END = 581;
// S06 network.ts
const K_END = 5;
const kShape = (fr: number) => ease.inOutSine(seg(fr, SWIRL_START - 6, S06_END + 15));
/** S06's winding coefficient at S06 frame fr (keeps settling until fr 596, exactly as S06 defines it) */
export const twist06 = (fr: number) => (K_END * kShape(fr)) / kShape(S06_END);
const gfun = (r: number) => Math.log(720 / (r + 20));
const SPIN0 = 0.0035;
export const spin06 = (fr: number) => SPIN0 * (fr - NET_GROW_START);
const pullAt = (r: number, K: number) => 1 - 0.12 * ease.inQuad(clamp(K / K_END)) * (1 - clamp(r / 520));
const flowK = (K: number) => K + 1.4 * (1 - K / K_END);
export const LIFE = ['#FFC94A', '#FFD86A', '#D9E46A', '#9EE06A', '#6FD88A', '#45CF9C', '#2CC5A6', '#2AB8B0'];

/** S06's twist of a ground point (offset dx, dy from the sink) → twisted ground point, written into o[0..1] */
function twistInto(dx: number, dy: number, K: number, fr: number, o: Float32Array | number[]) {
  const r = Math.hypot(dx, dy);
  if (r < 1e-3) {
    o[0] = C.x + dx;
    o[1] = C.y + dy;
    return;
  }
  const th = K * gfun(r) + spin06(fr);
  const pull = pullAt(r, K);
  const c = Math.cos(th);
  const s = Math.sin(th);
  o[0] = C.x + (dx * c - dy * s) * pull;
  o[1] = C.y + (dx * s + dy * c) * pull;
}

// ------------------------------------------------------------------ the rosette (S06 buildLeaves, same RNG stream)
const leafHalfWidth = (u: number, W: number) => W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u), 0.78)), 0.72) * (1 - 0.12 * u);

function decode(b64: string): GrowthNode[] {
  const bin = atob(b64);
  const n = bin.length / 8;
  const dv = new DataView(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  const nodes: GrowthNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = dv.getInt16(i * 8, true) / 10;
    const y = dv.getInt16(i * 8 + 2, true) / 10;
    const parent = dv.getInt16(i * 8 + 4, true);
    const step = dv.getInt16(i * 8 + 6, true);
    const p = parent >= 0 ? nodes[parent] : null;
    nodes.push({ x, y, parent, step, depth: p ? p.depth + 1 : 0, radius: 1, load: 1, root: p ? p.root : 0 });
  }
  const childR3 = new Float64Array(n);
  const loads = new Float64Array(n);
  const hasChild = new Uint8Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const nd = nodes[i];
    if (hasChild[i]) {
      nd.radius = Math.cbrt(childR3[i]);
      nd.load = loads[i];
    }
    if (nd.parent >= 0) {
      hasChild[nd.parent] = 1;
      childR3[nd.parent] += nd.radius ** 3;
      loads[nd.parent] += nd.load;
    }
  }
  return nodes;
}

export interface Rosette06 {
  /** leaf axis angles (S06 screen angle, y down) */
  ang: number[];
  wid: number[];
  /** vein segments (child node → parent), ground coordinates relative to the sink */
  sx0: Float32Array;
  sy0: Float32Array;
  sx1: Float32Array;
  sy1: Float32Array;
  /** width bucket (S06 veinTex: floor(log2(radius)·1.35), 0..5), distance from the root 0..1 */
  sw: Uint8Array;
  sd: Float32Array;
  nseg: number;
  /** junctions and tips in S06's paths() order (their index seeds S06's sparks / sunlight) */
  junctions: Array<{ x: number; y: number; load: number }>;
  tips: Array<{ x: number; y: number }>;
  dmaxPx: number;
}

export const rosette06 = (): Rosette06 =>
  memo('s07:s06rosette13', () => {
    const r = mulberry32(1307);
    const ang: number[] = [];
    const wid: number[] = [];
    const outlines: Array<Array<[number, number]>> = [];
    const all: GrowthNode[][] = [];
    for (let k = 0; k < NLEAF; k++) {
      const youth = k / (NLEAF - 1);
      const a = -Math.PI / 2 + 0.35 + k * GOLDEN_ANGLE + (r() - 0.5) * 0.08;
      const len = 400 * (0.36 + 0.64 * Math.pow(1 - youth, 0.85)) * (0.94 + 0.12 * r());
      const w = len * (0.4 + 0.06 * r());
      const base = 16 + 26 * (1 - youth) * (0.8 + 0.4 * r());
      const bendS = (r() - 0.5) * 0.12;
      // consume the attractor samples exactly like S06 (keeps the stream — and the next leaf's jitter — identical)
      const nAtt = Math.round(360 * Math.pow(len / 400, 1.6));
      let got = 0;
      let tries = 0;
      while (got < nAtt && tries < 30000) {
        tries++;
        const u = r();
        const v = (r() * 2 - 1) * w;
        if (Math.abs(v) > leafHalfWidth(u, w) * 0.93) continue;
        got++;
      }
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const toG = (u: number, v: number): [number, number] => {
        const aa = base + u * len;
        const bend = Math.sin(u * Math.PI) * len * bendS;
        return [C.x + ca * aa - sa * (v + bend), C.y + sa * aa + ca * (v + bend)];
      };
      const ol: Array<[number, number]> = [];
      for (let i = 0; i <= 48; i++) ol.push(toG(i / 48, leafHalfWidth(i / 48, w)));
      for (let i = 48; i >= 0; i--) ol.push(toG(i / 48, -leafHalfWidth(i / 48, w)));
      ang.push(a);
      wid.push(w);
      outlines.push(ol);
      all.push(decode(LEAF_B64[k]));
    }
    // occlusion: younger leaves (drawn later in S06's vein texture) cover the veins of older ones → leaf-ID map
    const S = 1040;
    const idc = document.createElement('canvas');
    idc.width = S;
    idc.height = S;
    const ix = idc.getContext('2d', { willReadFrequently: true })!;
    ix.imageSmoothingEnabled = false;
    outlines.forEach((ol, k) => {
      ix.beginPath();
      ol.forEach(([x, y], i) => (i ? ix.lineTo(x - C.x + S / 2, y - C.y + S / 2) : ix.moveTo(x - C.x + S / 2, y - C.y + S / 2)));
      ix.closePath();
      ix.fillStyle = `rgb(${(k + 1) * 16},0,0)`;
      ix.fill();
    });
    const idd = ix.getImageData(0, 0, S, S).data;
    const topLeaf = (x: number, y: number) => {
      const px = Math.round(x - C.x + S / 2);
      const py = Math.round(y - C.y + S / 2);
      if (px < 0 || py < 0 || px >= S || py >= S) return -1;
      return Math.round(idd[(py * S + px) * 4] / 16) - 1;
    };
    let maxDepth = 0;
    for (const nodes of all) for (const n of nodes) maxDepth = Math.max(maxDepth, n.depth);
    const sx0: number[] = [];
    const sy0: number[] = [];
    const sx1: number[] = [];
    const sy1: number[] = [];
    const sw: number[] = [];
    const sd: number[] = [];
    const junctions: Rosette06['junctions'] = [];
    const tips: Rosette06['tips'] = [];
    all.forEach((nodes, k) => {
      const kids = new Uint16Array(nodes.length);
      for (const n of nodes) if (n.parent >= 0) kids[n.parent]++;
      nodes.forEach((n, i) => {
        if (kids[i] >= 2 && n.load >= 3) junctions.push({ x: n.x, y: n.y, load: n.load });
        if (kids[i] === 0) tips.push({ x: n.x, y: n.y });
        if (n.parent < 0) return;
        const p = nodes[n.parent];
        if (topLeaf((n.x + p.x) / 2, (n.y + p.y) / 2) > k) return; // hidden under a younger leaf
        sx0.push(p.x - C.x);
        sy0.push(p.y - C.y);
        sx1.push(n.x - C.x);
        sy1.push(n.y - C.y);
        sw.push(Math.max(0, Math.min(5, Math.floor(Math.log2(n.radius) * 1.35))));
        sd.push(n.depth / maxDepth);
      });
    });
    return {
      ang,
      wid,
      sx0: new Float32Array(sx0),
      sy0: new Float32Array(sy0),
      sx1: new Float32Array(sx1),
      sy1: new Float32Array(sy1),
      sw: new Uint8Array(sw),
      sd: new Float32Array(sd),
      nseg: sx0.length,
      junctions,
      tips,
      dmaxPx: maxDepth * 6,
    };
  });

/** S06 ground space → S07 screen (S07's top view is a similarity transform of the floor) */
export function applyGround(ctx: CanvasRenderingContext2D, cam: Cam) {
  ctx.translate(cam.ax, cam.ay);
  ctx.rotate(cam.roll);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-C.x, -C.y);
}

const GOLD = [255, 201, 74];
const LIME = [158, 224, 107];
const TEAL = [44, 197, 166];
const mix3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const life = (d: number) => (d > 0.5 ? mix3(LIME, GOLD, (d - 0.5) * 2) : mix3(TEAL, LIME, d * 2));
const css = (c: number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
const pulse = (x: number) => {
  const p = x - Math.floor(x);
  return p < 0.62 ? 0 : Math.pow(1 - (p - 0.62) / 0.38, 1.6);
};

export interface S06Fade {
  veins: number;
  inflow: number;
  land: number;
  stream: number;
}

/** S06's last image at S07 frame f (alpha per element; 1 = exactly S06's look). */
export function drawS06(ctx: CanvasRenderingContext2D, f: number, cam: Cam, a: S06Fade) {
  const fr = S06_LAST + f;
  const K = twist06(fr);
  const R = rosette06();
  const o = new Float32Array(2);
  const o2 = new Float32Array(2);
  ctx.save();
  applyGround(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // ---- faint whirlpool streamlines (S06 drawStreamlines)
  if (a.stream > 0.01) {
    const Kf = flowK(K);
    const spin = spin06(fr);
    const P = new Path2D();
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * Math.PI * 2 + hash01(i, 5) * 0.2;
      const r0 = 520 + hash01(i, 6) * 300;
      const ph = ((fr * (0.9 + hash01(i, 7) * 0.6)) / 60 + hash01(i, 8)) % 1;
      for (let k = 0; k <= 14; k++) {
        const u = ph * 0.8 + (k / 14) * 0.2;
        const r = r0 * Math.pow(1 - u, 1.3) + 20;
        const th = a0 + Kf * gfun(r) + spin;
        const x = C.x + Math.cos(th) * r;
        const y = C.y + Math.sin(th) * r;
        if (k === 0) P.moveTo(x, y);
        else P.lineTo(x, y);
      }
    }
    ctx.strokeStyle = `rgba(150,230,200,${0.1 * a.stream})`;
    ctx.lineWidth = 1.2;
    ctx.stroke(P);
  }

  // ---- the twisted vein rosette (S06 veins.ts: base vein colour + light pulses running to the sink)
  if (a.veins > 0.01) {
    const WB = 6;
    const DB = 6;
    const PL = 3;
    const base = Array.from({ length: WB * DB }, () => new Path2D());
    const used = new Uint8Array(WB * DB);
    const PU = Array.from({ length: 2 * DB * PL }, () => new Path2D());
    const pused = new Uint8Array(2 * DB * PL);
    // S06's integrated pulse travel (px along the veins), pinned at its last frame and continued at the speed it had
    const acc = 2.3;
    const phase = 3.4 * (S06_END * acc + acc * (fr - S06_END));
    for (let s = 0; s < R.nseg; s++) {
      twistInto(R.sx0[s], R.sy0[s], K, fr, o);
      twistInto(R.sx1[s], R.sy1[s], K, fr, o2);
      const d = R.sd[s];
      const db = Math.min(DB - 1, Math.floor(d * DB));
      const b = R.sw[s] * DB + db;
      base[b].moveTo(o[0], o[1]);
      base[b].lineTo(o2[0], o2[1]);
      used[b] = 1;
      const dpx = d * R.dmaxPx;
      const fl = Math.max(pulse((dpx + phase) / 46), 0.55 * pulse((dpx + phase * (4.6 / 3.4)) / 71 + 0.37));
      if (fl > 0.06) {
        const lv = Math.min(PL - 1, Math.floor(fl * PL));
        const pb = ((R.sw[s] >= 3 ? 1 : 0) * DB + db) * PL + lv;
        PU[pb].moveTo(o[0], o[1]);
        PU[pb].lineTo(o2[0], o2[1]);
        pused[pb] = 1;
      }
    }
    for (let w = 0; w < WB; w++)
      for (let db = 0; db < DB; db++) {
        const b = w * DB + db;
        if (!used[b]) continue;
        const d = (db + 0.5) / DB;
        ctx.strokeStyle = css(mix3(GOLD, LIME, 0.55 + 0.45 * (1 - d)), 0.6 * a.veins);
        ctx.lineWidth = 0.76 + w * 0.63;
        ctx.stroke(base[b]);
      }
    for (let w = 0; w < 2; w++)
      for (let db = 0; db < DB; db++)
        for (let lv = 0; lv < PL; lv++) {
          const pb = (w * DB + db) * PL + lv;
          if (!pused[pb]) continue;
          ctx.strokeStyle = css(life((db + 0.5) / DB), Math.min(1, ((lv + 0.5) / PL) * 1.9) * a.veins);
          ctx.lineWidth = w ? 2.6 : 1.3;
          ctx.stroke(PU[pb]);
        }
  }

  // ---- the inflow: ~1500 streaks from beyond the frame, gold → olive → teal by radius (S06 drawInflow)
  if (a.inflow > 0.01) {
    const Kf = flowK(K);
    const spin = spin06(fr);
    const NB = LIFE.length;
    const FP: Path2D[] = Array.from({ length: NB }, () => new Path2D());
    const acc = 2.2;
    // S06's phase ∫acc dt up to its last frame, continued at the speed it had there
    const span = S06_END - (SWIRL_START - 26);
    const travelled = 0.6 * span + (1.6 * span) / 3 + acc * (fr - S06_END);
    const pos = (a0: number, r0: number, uu: number, out: Float32Array): number => {
      const r = r0 * Math.pow(1 - uu, 1.25) + 16;
      const th = a0 + Kf * gfun(r) + spin;
      const pull = pullAt(r, Kf);
      out[0] = C.x + Math.cos(th) * r * pull;
      out[1] = C.y + Math.sin(th) * r * pull;
      return r;
    };
    for (let i = 0; i < 1500; i++) {
      const arm = hash01(i, 800) < 0.72;
      const lk = i % NLEAF;
      const a0 = arm ? R.ang[lk] + (hash01(i, 801) - 0.5) * 0.3 * (0.5 + R.wid[lk] / 300) : hash01(i, 801) * Math.PI * 2;
      const r0 = 720 + hash01(i, 802) * 260;
      const sp = 0.0024 + hash01(i, 803) * 0.0018;
      const u = (hash01(i, 804) + travelled * sp) % 1;
      const du = 0.04 + 0.035 * acc;
      if (u / 0.12 <= 0.05) continue;
      const r1 = pos(a0, r0, u, o);
      const b = Math.max(0, Math.min(NB - 1, Math.floor((1 - (r1 - 40) / 560) * NB)));
      const path = FP[b];
      path.moveTo(o[0], o[1]);
      for (let k = 1; k <= 3; k++) {
        pos(a0, r0, Math.max(0, u - (du * k) / 3), o);
        path.lineTo(o[0], o[1]);
      }
    }
    ctx.lineCap = 'butt';
    for (let b = 0; b < NB; b++) {
      ctx.strokeStyle = LIFE[b];
      ctx.globalAlpha = a.inflow * 0.6 * (0.55 + 0.45 * (b / NB));
      ctx.lineWidth = 1.4;
      ctx.stroke(FP[b]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- sunlight still landing on the vein tips (perspective streaks, then a pale flash)
  if (a.land > 0.01) {
    const streaks = new Path2D();
    const flashes = new Path2D();
    for (let i = 0; i < R.tips.length; i++) {
      const per = 40 + Math.floor(hash01(i, 61) * 36);
      const ph = Math.floor(hash01(i, 62) * per);
      const tt = (fr + ph) % per;
      if (tt >= 18) continue;
      const tip = R.tips[i];
      if (Math.hypot(tip.x - C.x, tip.y - C.y) > 520) continue;
      twistInto(tip.x - C.x, tip.y - C.y, K, fr, o);
      const x = o[0];
      const y = o[1];
      if (tt < 9) {
        const k0 = 0.42 * (1 - tt / 9);
        const k1 = 0.42 * (1 - (tt - 2.5) / 9);
        const ox = x - C.x + 40;
        const oy = y - C.y + 40;
        streaks.moveTo(x + ox * k1, y + oy * k1);
        streaks.lineTo(x + ox * k0, y + oy * k0);
      } else {
        const k = 1 - (tt - 9) / 9;
        const rr = 1.2 + 2.2 * k;
        flashes.rect(x - rr, y - rr, 2 * rr, 2 * rr);
      }
    }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = `rgba(255,214,120,${0.6 * a.land})`;
    ctx.lineWidth = 1.3;
    ctx.stroke(streaks);
    ctx.fillStyle = `rgba(255,236,170,${0.7 * a.land})`;
    ctx.fill(flashes);
  }
  ctx.restore();
}

/** S06's red IR sparks (same emitters, periods, seeds and clock). None are born after S06 frame 597; the last die by
 *  ~f46. Returns nothing; draws additively in ground space. */
export function drawS06Sparks(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  if (f > 50) return;
  const fr = S06_LAST + f;
  const K = twist06(fr);
  const R = rosette06();
  const boost = 2.2;
  const life = 30;
  const o = new Float32Array(2);
  const hot = new Path2D();
  const dim = new Path2D();
  for (let j = 0; j < R.junctions.length; j++) {
    const J = R.junctions[j];
    if (Math.hypot(J.x - C.x, J.y - C.y) > 500) continue;
    const per = Math.max(8, Math.round((44 - Math.min(30, J.load * 0.8)) / boost));
    const ph = Math.floor(hash01(j, 71) * per);
    let mapped = false;
    for (let gen = 0; gen < 2; gen++) {
      const born = Math.floor((fr + ph) / per) * per - ph - gen * per;
      if (born > S06_LAST + 16) continue;
      const age = fr - born;
      if (age < 0 || age > life) continue;
      if (!mapped) {
        twistInto(J.x - C.x, J.y - C.y, K, fr, o);
        mapped = true;
      }
      const jx = o[0];
      const jy = o[1];
      const sd = j * 131 + born;
      const ra = Math.atan2(jy - C.y, jx - C.x) + (hash01(sd, 72) - 0.5) * 1.6;
      const sp = 1.8 + hash01(sd, 73) * 2.6;
      const d = sp * age * (1 - age / (life * 2.6));
      const tail = Math.max(0, d - 12);
      const k = 1 - age / life;
      const target = k > 0.5 ? hot : dim;
      target.moveTo(jx + Math.cos(ra) * tail, jy + Math.sin(ra) * tail);
      target.lineTo(jx + Math.cos(ra) * d, jy + Math.sin(ra) * d);
    }
  }
  ctx.save();
  applyGround(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  // S06's glow pass: thick red strokes, blurred → a red haze around the hot sparks
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,59,47,0.14)';
  ctx.lineWidth = 7;
  ctx.stroke(hot);
  ctx.strokeStyle = 'rgba(255,90,66,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke(hot);
  ctx.strokeStyle = 'rgba(210,40,40,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke(dim);
  ctx.restore();
}

/** S06's sink (core R = 42·1.8 ≈ 76, wide eye glow 160; the same gradient stops and pulse), × alpha. */
export function drawS06Sink(ctx: CanvasRenderingContext2D, f: number, cam: Cam, alpha: number) {
  if (alpha <= 0.004) return;
  const fr = S06_LAST + f;
  // S06 youPulse (你 lit at S06 f456) — spent by the cut
  const t = fr - 456;
  const you = (1 - Math.exp(-t / 3)) * Math.exp(-t / 22);
  const pulseK = 0.85 + 0.15 * Math.sin(fr * 0.3) + 0.5 * you;
  const R = 42 * (1 + 0.8 + 0.7 * you);
  ctx.save();
  applyGround(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  let g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R);
  g.addColorStop(0, `rgba(255,252,232,${Math.min(1, 0.92 * pulseK) * alpha})`);
  g.addColorStop(0.2, `rgba(240,255,210,${0.62 * alpha})`);
  g.addColorStop(0.42, `rgba(158,224,106,${0.4 * alpha})`);
  g.addColorStop(0.65, `rgba(44,197,166,${0.22 * alpha})`);
  g.addColorStop(1, 'rgba(44,197,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(C.x - R, C.y - R, 2 * R, 2 * R);
  // S06's glow pass of the sink (R ≈ 126, blurred ~40 px): a wide warm-white halo
  const R3 = 230;
  g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R3);
  g.addColorStop(0, `rgba(255,252,240,${0.16 * alpha})`);
  g.addColorStop(0.25, `rgba(240,250,236,${0.1 * alpha})`);
  g.addColorStop(0.55, `rgba(158,224,106,${0.07 * alpha})`);
  g.addColorStop(1, 'rgba(44,197,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(C.x - R3, C.y - R3, 2 * R3, 2 * R3);
  const R2 = 160;
  g = ctx.createRadialGradient(C.x, C.y, 0, C.x, C.y, R2);
  g.addColorStop(0, `rgba(190,250,200,${0.3 * alpha})`);
  g.addColorStop(0.45, `rgba(60,200,160,${0.14 * alpha})`);
  g.addColorStop(1, 'rgba(44,197,166,0)');
  ctx.fillStyle = g;
  ctx.fillRect(C.x - R2, C.y - R2, 2 * R2, 2 * R2);
  ctx.restore();
}

/** S06's foreground photon motes in their ground phase (green), fading out — S07's droplets replace them. */
export function drawS06Motes(ctx: CanvasRenderingContext2D, f: number, alpha: number) {
  if (alpha <= 0.01) return;
  const spr = memo('s07:s06mote', () => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(158,224,106,1)');
    g.addColorStop(0.22, 'rgba(158,224,106,0.5)');
    g.addColorStop(0.55, 'rgba(158,224,106,0.12)');
    g.addColorStop(1, 'rgba(158,224,106,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    return c;
  });
  const M = memo('s07:s06motes', () => {
    const r = mulberry32(8080);
    const out: number[][] = [];
    for (let i = 0; i < 34; i++) out.push([r() * 1080, r() * 1920, 6 + Math.pow(r(), 2) * 26, 0.05 + r() * 0.1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.4, r() * 6.28]);
    return out;
  });
  const fr = S06_LAST + f;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [mx, my, mr, ma, vx, vy, ph] of M) {
    const x = mx + vx * fr + Math.sin(fr * 0.02 + ph) * 12;
    const y = my + vy * fr + Math.cos(fr * 0.017 + ph) * 10;
    const s = mr * 2;
    if (x < -s || x > 1080 + s || y < -s || y > 1920 + s) continue;
    ctx.globalAlpha = ma * alpha;
    ctx.drawImage(spr, x - s, y - s, 2 * s, 2 * s);
  }
  ctx.restore();
}

/** S06's vignette (0.45, ellipse 810 × 1190 about the frame centre), × alpha — drawn last over the raster layer. */
export function drawS06Vignette(ctx: CanvasRenderingContext2D, alpha: number) {
  const s = 0.45 * alpha;
  if (s <= 0.003) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(540, 960);
  ctx.scale(810, 1190);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${s})`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/** S06 leaf axis angles of the 7 leaves the whirlpool's 7 feeder arms continue (every other leaf, sorted by angle) */
export const armLeaves = (): number[] =>
  memo('s07:armleaves', () => {
    const R = rosette06();
    const idx = R.ang.map((a, k) => [((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), k]).sort((p, q) => p[0] - q[0]);
    const out: number[] = [];
    for (let j = 0; j < idx.length && out.length < 7; j += 2) out.push(idx[j][1]);
    return out;
  });

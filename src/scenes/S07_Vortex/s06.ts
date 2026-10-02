// S06's last image, rebuilt for the S06 → S07 match cut.
// The 7-leaf vein rosette is regrown with S06's exact recipe (network.ts: same mulberry32(777) stream, same attractors,
// same lib/growth parameters), and twisted by S06's own twist law, continued past S06's last frame (f581) at the rate
// it had there. Everything here is in S06's screen space at f581 (= ground space, centred on SPIRAL); the mapping into
// S07's world (and the blend into the whirlpool's log spirals) lives in vortex.ts.
import { GrowthNode, grow } from '../../lib/growth';
import { SPIRAL } from '../../lib/handoff';
import { clamp, ease, memo, seg } from '../../lib/math';
import { mulberry32 } from '../../lib/random';

const C = SPIRAL;
export const NLEAF = 7;
/** S06's last frame (its frame numbers continue as 581 + f) */
export const S06_LAST = 581;
const NET_GROW_START = 404;
const SPIN0 = 0.0025;

/** S06's twistAmount(frame) */
const twistS06 = (fr: number) => 3.1 * ease.inCubic(seg(fr, 490, 587)) + 0.9 * ease.inOutSine(seg(fr, 460, 581));
const K_END = twistS06(S06_LAST);
// d/dframe of 3.1·inCubic((fr−490)/97) at fr = 581 (the inOutSine term is flat there)
const K_RATE = (9.3 * Math.pow((S06_LAST - 490) / 97, 2)) / 97;

/** S06's differential twist, continued linearly into S07 (t = S07 frame, may be negative for trails) */
export const K06 = (t: number) => K_END + K_RATE * t;
/** S06's rigid spin */
export const spin06 = (t: number) => SPIN0 * (S06_LAST + t - NET_GROW_START);
/** S06's radial twist profile g(r) */
export const g06 = (r: number) => Math.log(1 + 480 / (r + 30)) / Math.log(17);
/** S06's inward pull of the twist (radius factor) */
export const pull06 = (r: number, K: number) => 1 - 0.1 * ease.inQuad(clamp(K / 4)) * (1 - clamp(r / 500));

const leafHalfWidth = (u: number, W: number) => W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(u), 0.72)), 0.85);

export interface Leaf06 {
  ang: number;
  len: number;
  wid: number;
  base: number;
  /** midrib bend direction */
  sign: number;
  /** pre-twist polar coordinates of the vein nodes around SPIRAL (screen angle, y down) */
  rho: Float32Array;
  alpha: Float32Array;
  parent: Int32Array;
  /** Murray radius, distance from the root (0..1 of the rosette's max), leaf load */
  rad: Float32Array;
  dist: Float32Array;
  load: Float32Array;
  /** blade outline, pre-twist polar */
  oRho: Float32Array;
  oAlpha: Float32Array;
  tip: number;
}

export interface Junction06 {
  leaf: number;
  rho: number;
  alpha: number;
  load: number;
}

export interface Rosette06 {
  leaves: Leaf06[];
  junctions: Junction06[];
  /** vein tips (S06's paths().tips order): where the sunlight lands */
  tips: Junction06[];
  /** max vein depth (nodes) over the rosette — S06 normalises distance along the veins by dmax × step (6 px) */
  dmax: number;
}

let ROS: Rosette06 | null = null;
/** the 7 leaves of S06 (≈100 ms of growth, once per tab) */
export const rosette06 = (): Rosette06 => (ROS ??= buildRosette());
const buildRosette = (): Rosette06 =>
  memo('s07:s06rosette', () => {
    // S06's RNG stream (network.ts buildLeaves): mulberry32(777)
    const r = mulberry32(777);
    const raw: Array<{ ang: number; len: number; wid: number; base: number; sign: number; nodes: GrowthNode[] }> = [];
    for (let k = 0; k < NLEAF; k++) {
      const ang = -Math.PI / 2 + (k / NLEAF) * Math.PI * 2 + (r() - 0.5) * 0.25;
      const len = 330 + r() * 80;
      const wid = len * (0.2 + r() * 0.05);
      const base = 34;
      const sign = k % 2 ? 1 : -1;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const toG = (u: number, v: number): [number, number] => {
        const aa = base + u * len;
        const bend = Math.sin(u * Math.PI) * len * 0.05 * sign;
        return [C.x + ca * aa - sa * (v + bend), C.y + sa * aa + ca * (v + bend)];
      };
      const att: number[] = [];
      let tries = 0;
      while (att.length < 2 * 340 && tries < 20000) {
        tries++;
        const u = r();
        const v = (r() * 2 - 1) * wid;
        if (Math.abs(v) > leafHalfWidth(u, wid) * 0.94) continue;
        const [x, y] = toG(u, v);
        att.push(x, y);
      }
      for (let q = 8; q < base + 12; q += 5) att.push(C.x + ca * q, C.y + sa * q);
      const nodes = grow(`s07-s06leaf-${k}`, { attractors: att, roots: [[C.x + ca * 4, C.y + sa * 4]], step: 6, influence: 58, kill: 9, maxSteps: 220 });
      raw.push({ ang, len, wid, base, sign, nodes });
    }
    let dmax = 1;
    for (const L of raw) for (const n of L.nodes) dmax = Math.max(dmax, n.depth);
    const leaves: Leaf06[] = [];
    const junctions: Junction06[] = [];
    const tips: Junction06[] = [];
    raw.forEach((L, li) => {
      const n = L.nodes.length;
      const rho = new Float32Array(n);
      const alpha = new Float32Array(n);
      const parent = new Int32Array(n);
      const rad = new Float32Array(n);
      const dist = new Float32Array(n);
      const load = new Float32Array(n);
      const kids = new Uint16Array(n);
      for (const nd of L.nodes) if (nd.parent >= 0) kids[nd.parent]++;
      L.nodes.forEach((nd, i) => {
        rho[i] = Math.hypot(nd.x - C.x, nd.y - C.y);
        alpha[i] = Math.atan2(nd.y - C.y, nd.x - C.x);
        parent[i] = nd.parent;
        rad[i] = nd.radius;
        dist[i] = nd.depth / dmax;
        load[i] = nd.load;
        if (kids[i] >= 2 && nd.load >= 3) junctions.push({ leaf: li, rho: rho[i], alpha: alpha[i], load: nd.load });
        if (kids[i] === 0) tips.push({ leaf: li, rho: rho[i], alpha: alpha[i], load: 1 });
      });
      // unwrap node angles around the leaf axis (no ±π jumps inside one leaf)
      for (let i = 0; i < n; i++) {
        let d = alpha[i] - L.ang;
        d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
        alpha[i] = L.ang + d;
      }
      const oR: number[] = [];
      const oA: number[] = [];
      const ca = Math.cos(L.ang);
      const sa = Math.sin(L.ang);
      const push = (u: number, v: number) => {
        const aa = L.base + u * L.len;
        const bend = Math.sin(u * Math.PI) * L.len * 0.05 * L.sign;
        const x = ca * aa - sa * (v + bend);
        const y = sa * aa + ca * (v + bend);
        oR.push(Math.hypot(x, y));
        let d = Math.atan2(y, x) - L.ang;
        d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
        oA.push(L.ang + d);
      };
      for (let i = 0; i <= 40; i++) push(i / 40, leafHalfWidth(i / 40, L.wid));
      for (let i = 40; i >= 0; i--) push(i / 40, -leafHalfWidth(i / 40, L.wid));
      leaves.push({ ang: L.ang, len: L.len, wid: L.wid, base: L.base, sign: L.sign, rho, alpha, parent, rad, dist, load, oRho: new Float32Array(oR), oAlpha: new Float32Array(oA), tip: L.base + L.len });
    });
    return { leaves, junctions, tips, dmax };
  });

/** S06 screen angle of leaf a's midrib at pre-twist radius r, at S07 frame t (twist included) */
export function midrib06(a: number, r: number, t: number): number {
  const L = rosette06().leaves[a];
  const u = clamp((r - L.base) / L.len);
  const bend = Math.sin(u * Math.PI) * L.len * 0.05 * L.sign;
  return L.ang + Math.atan2(bend, Math.max(1, r)) + K06(t) * g06(r) + spin06(t);
}

/** half-width (px) of leaf a's blade at radius r */
export function blade06(a: number, r: number): number {
  const L = rosette06().leaves[a];
  const u = (r - L.base) / L.len;
  if (u <= 0 || u >= 1) return 0;
  return leafHalfWidth(u, L.wid);
}

// The human as a FLOW (the shared HUMAN_PATH figure, height 1000, standing at the world origin, facing +Z).
// Atoms enter at the mouth (food, water, O₂), travel down a Murray's-law vessel tree (space colonisation, lib/growth),
// linger at a slot of the body, then leave through the skin (heat, CO₂, H₂O). The figure's outline is a STATISTIC
// of this flow — exactly like the whirlpool's shape. Every particle state is a closed-form function of flow time s.
import { drawHuman, HUMAN_ANCHORS } from '../../lib/human';
import { grow } from '../../lib/growth';
import { clamp, memo, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';

export const BODY_H = 1000;
const MW = 640;
const MH = 1100;
const GROUND = 1050; // mask y of the soles
const S = BODY_H / 1344;
export const N_BODY = 10000;

/** box (600×1420) → world (X, H) */
export const boxToWorld = (bx: number, by: number): [number, number] => [(bx - 300) * S, (1402 - by) * S];
export const MOUTH = boxToWorld(HUMAN_ANCHORS.mouth[0], HUMAN_ANCHORS.mouth[1] + 6);
export const HEART = boxToWorld(HUMAN_ANCHORS.heart[0], HUMAN_ANCHORS.heart[1]);
export const HEAD = boxToWorld(300, 150);

export interface BodyData {
  ns: number;
  sx: Float32Array; // slot X
  sh: Float32Array; // slot H
  sz: Float32Array; // slot Z (thickness)
  depth: Float32Array; // distance to skin (px)
  warm: Float32Array; // 0..1 core warmth
  nx: Float32Array; // outward normal (X)
  nh: Float32Array; // outward normal (H)
  node: Int32Array; // nearest vessel node
  plen: Float32Array; // path length mouth → slot along the tree
  headSlots: Int32Array;
  /** 1 = the slot lies in the skeleton (skull shell, eye lenses, spine, ribs, pelvis, long bones) */
  bone: Uint8Array;
  // vessel tree
  tn: number;
  tx: Float32Array;
  th: Float32Array;
  tpar: Int32Array;
  tdist: Float32Array;
  trad: Float32Array;
  tstep: Int32Array;
  tmax: number;
  // edge points (silhouette outline) for drawing the skin
  edge: Float32Array;
}

// ---- the skeleton (box coordinates of HUMAN_PATH, 600×1420; right half, mirrored): capsules [x0,y0,x1,y1,r]
const BONES: number[][] = [
  [300, 236, 300, 800, 9], // spine
  [300, 300, 300, 468, 5], // sternum
  [308, 284, 398, 298, 6], // clavicle
  [432, 318, 460, 580, 9], // humerus
  [460, 584, 492, 792, 7], // radius / ulna
  [494, 800, 504, 846, 6], // hand
  [304, 792, 344, 760, 8], // ilium
  [344, 760, 378, 792, 8],
  [378, 792, 360, 852, 8],
  [300, 862, 342, 850, 7], // pubis
  [362, 862, 364, 1118, 12], // femur
  [364, 1124, 354, 1352, 9], // tibia
  [354, 1360, 382, 1396, 6], // foot
  [270, 198, 300, 216, 7], // jaw
  [300, 216, 330, 198, 7],
  [282, 138, 282, 138, 6], // eye lens
];
for (let k = 0; k < 6; k++) {
  const y0 = 318 + k * 34;
  BONES.push([306, y0, 362 - k * 2, y0 + 10, 4.5], [362 - k * 2, y0 + 10, 384 - k * 4, y0 + 38, 4.5]); // ribs
}
function boneAt(bx: number, by: number): boolean {
  const x = 300 + Math.abs(bx - 300); // mirror into the right half
  // skull: a shell of the head ellipse
  const ex = (x - 300) / 58;
  const ey = (by - 138) / 76;
  const er = Math.sqrt(ex * ex + ey * ey);
  if (er > 0.66 && er < 1.08 && by < 205) return true;
  for (const [x0, y0, x1, y1, r] of BONES) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? clamp(((x - x0) * dx + (by - y0) * dy) / L2) : 0;
    const ddx = x - (x0 + dx * t);
    const ddy = by - (y0 + dy * t);
    if (ddx * ddx + ddy * ddy < r * r) return true;
  }
  return false;
}

export const bodyData = (): BodyData =>
  memo('s07:body', () => {
    // ---- mask
    const c = document.createElement('canvas');
    c.width = MW;
    c.height = MH;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    drawHuman(ctx, MW / 2, GROUND, BODY_H);
    const img = ctx.getImageData(0, 0, MW, MH).data;
    const N = MW * MH;
    const inside = new Uint8Array(N);
    for (let i = 0; i < N; i++) inside[i] = img[i * 4 + 3] >= 128 ? 1 : 0;
    // ---- chamfer distance to the outside (3-4 metric / 3)
    const INF = 1e9;
    const d = new Float32Array(N);
    for (let i = 0; i < N; i++) d[i] = inside[i] ? INF : 0;
    for (let y = 0; y < MH; y++)
      for (let x = 0; x < MW; x++) {
        const i = y * MW + x;
        if (!d[i]) continue;
        let v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + 3);
        if (y > 0) {
          v = Math.min(v, d[i - MW] + 3);
          if (x > 0) v = Math.min(v, d[i - MW - 1] + 4);
          if (x < MW - 1) v = Math.min(v, d[i - MW + 1] + 4);
        }
        d[i] = v;
      }
    for (let y = MH - 1; y >= 0; y--)
      for (let x = MW - 1; x >= 0; x--) {
        const i = y * MW + x;
        if (!d[i]) continue;
        let v = d[i];
        if (x < MW - 1) v = Math.min(v, d[i + 1] + 3);
        if (y < MH - 1) {
          v = Math.min(v, d[i + MW] + 3);
          if (x < MW - 1) v = Math.min(v, d[i + MW + 1] + 4);
          if (x > 0) v = Math.min(v, d[i + MW - 1] + 4);
        }
        d[i] = v;
      }
    for (let i = 0; i < N; i++) d[i] /= 3;
    const D = (x: number, y: number) => d[Math.min(MH - 1, Math.max(0, y)) * MW + Math.min(MW - 1, Math.max(0, x))];

    // ---- slots (jittered grid inside the figure), shuffled
    const rnd = mulberry32(4242);
    const pts: number[] = [];
    const step = 4.1;
    for (let y = 2; y < MH; y += step)
      for (let x = 2; x < MW; x += step) {
        const px = Math.floor(x + (rnd() - 0.5) * step * 0.9);
        const py = Math.floor(y + (rnd() - 0.5) * step * 0.9);
        if (px < 0 || py < 0 || px >= MW || py >= MH) continue;
        if (D(px, py) >= 1.2) pts.push(px, py);
      }
    const ns = pts.length / 2;
    for (let i = ns - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      for (let k = 0; k < 2; k++) {
        const t = pts[i * 2 + k];
        pts[i * 2 + k] = pts[j * 2 + k];
        pts[j * 2 + k] = t;
      }
    }
    const sx = new Float32Array(ns);
    const sh = new Float32Array(ns);
    const sz = new Float32Array(ns);
    const depth = new Float32Array(ns);
    const warm = new Float32Array(ns);
    const nx = new Float32Array(ns);
    const nh = new Float32Array(ns);
    const head: number[] = [];
    const bone = new Uint8Array(ns);
    for (let s = 0; s < ns; s++) {
      const px = pts[s * 2];
      const py = pts[s * 2 + 1];
      sx[s] = px - MW / 2;
      sh[s] = GROUND - py;
      const dd = D(px, py);
      depth[s] = dd;
      sz[s] = (rnd() * 2 - 1) * Math.min(60, dd * 0.7);
      // gradient of the distance field points inward → outward normal = −∇d
      const gx = D(px + 3, py) - D(px - 3, py);
      const gy = D(px, py + 3) - D(px, py - 3);
      const gl = Math.hypot(gx, gy) || 1;
      nx[s] = -gx / gl;
      nh[s] = gy / gl; // mask y is down, world H is up
      // skin temperature as a thermal camera sees it, as an index on the 20–37 °C bar ((T − 20)/17):
      // forehead/face ≈ 0.9 (35.4 °C), neck/trunk ≈ 0.8, upper arms/thighs ≈ 0.75, hands ≈ 0.62, feet ≈ 0.55.
      // Smooth ramps only (no hard seams at the neck or hips); thin parts run cooler than thick ones.
      const core = Math.min(1, dd / 34);
      const X = sx[s];
      const Hh = sh[s];
      const ax = Math.abs(X);
      const trunk = smoothstep(380, 470, Hh) * (1 - smoothstep(850, 905, Hh)) * (1 - smoothstep(100, 125, ax));
      const isHead = smoothstep(800, 860, Hh) * (1 - smoothstep(66, 92, ax));
      const arm = smoothstep(100, 125, ax) * smoothstep(360, 420, Hh);
      const armCool = arm * smoothstep(800, 430, Hh);
      const legCool = smoothstep(470, 30, Hh);
      warm[s] = clamp(0.6 + 0.08 * Math.sqrt(core) + 0.07 * trunk + 0.18 * isHead - 0.12 * armCool - 0.15 * legCool, 0.45, 0.92);
      const bx = X / S + 300;
      const by = 1402 - Hh / S;
      bone[s] = boneAt(bx, by) ? 1 : 0;
      if (sh[s] > 860 && dd > 8) head.push(s);
    }

    // ---- vessel tree from the mouth (attractors: a subset of the slots)
    const attr: number[] = [];
    for (let s = 0; s < ns; s++) if (hash01(s, 91) < 0.34) attr.push(sx[s], sh[s]);
    const nodes = grow('s07-vessels', {
      attractors: new Float32Array(attr),
      roots: [[MOUTH[0], MOUTH[1]]],
      step: 9,
      influence: 58,
      kill: 13,
      maxSteps: 420,
    });
    const tn = nodes.length;
    const tx = new Float32Array(tn);
    const th = new Float32Array(tn);
    const tpar = new Int32Array(tn);
    const tdist = new Float32Array(tn);
    const trad = new Float32Array(tn);
    const tstep = new Int32Array(tn);
    let tmax = 0;
    for (let i = 0; i < tn; i++) {
      const n = nodes[i];
      tx[i] = n.x;
      th[i] = n.y;
      tpar[i] = n.parent;
      trad[i] = n.radius;
      tstep[i] = n.step;
      tmax = Math.max(tmax, n.step);
      tdist[i] = n.parent >= 0 ? tdist[n.parent] + Math.hypot(n.x - nodes[n.parent].x, n.y - nodes[n.parent].y) : 0;
    }
    // ---- nearest tree node per slot (grid)
    const cell = 24;
    const grid = new Map<number, number[]>();
    const key = (x: number, y: number) => (Math.floor(x / cell) + 1000) * 4096 + (Math.floor(y / cell) + 1000);
    for (let i = 0; i < tn; i++) {
      const k = key(tx[i], th[i]);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(i);
    }
    const node = new Int32Array(ns);
    const plen = new Float32Array(ns);
    for (let s = 0; s < ns; s++) {
      let best = 0;
      let bd = Infinity;
      for (let ring = 0; ring < 12 && bd === Infinity; ring++) {
        const cx = Math.floor(sx[s] / cell);
        const cy = Math.floor(sh[s] / cell);
        for (let gx = cx - ring - 1; gx <= cx + ring + 1; gx++)
          for (let gy = cy - ring - 1; gy <= cy + ring + 1; gy++) {
            const b = grid.get((gx + 1000) * 4096 + (gy + 1000));
            if (!b) continue;
            for (const i of b) {
              const dd = (tx[i] - sx[s]) ** 2 + (th[i] - sh[s]) ** 2;
              if (dd < bd) {
                bd = dd;
                best = i;
              }
            }
          }
      }
      node[s] = best;
      plen[s] = tdist[best] + Math.sqrt(bd === Infinity ? 0 : bd);
    }
    // ---- silhouette edge points (for a faint skin line)
    const edge: number[] = [];
    for (let y = 1; y < MH - 1; y += 2)
      for (let x = 1; x < MW - 1; x += 2) {
        const i = y * MW + x;
        if (inside[i] && (!inside[i - 1] || !inside[i + 1] || !inside[i - MW] || !inside[i + MW])) edge.push(x - MW / 2, GROUND - y);
      }
    return {
      ns,
      sx,
      sh,
      sz,
      depth,
      warm,
      nx,
      nh,
      node,
      plen,
      headSlots: new Int32Array(head),
      bone,
      tn,
      tx,
      th,
      tpar,
      tdist,
      trad,
      tstep,
      tmax,
      edge: new Float32Array(edge),
    };
  });

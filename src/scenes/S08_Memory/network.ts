// S08 — the memory network: the footprint trail becomes an axon (beads = boutons) and dendrites grow from every
// bead like branching lightning (space colonisation, lib/growth.ts). Everything is stored in FINAL figure space
// (the frame of FIGURE_S08: gold-line human, feet at y 1610, height 1300) so S09 can redraw it at any zoom.
import { FIGURE_S08 } from '../../lib/handoff';
import { growFast } from './growFast';
import { HUMAN_PATH } from '../../lib/human';
import { memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hash01, mulberry32 } from '../../lib/random';
import { FIN_C, K_N, MACRO_K, M_WORLD, PRINTS, Z_NET } from './trail';
import { cpuCanvas } from './CpuCanvas';

const SF = FIGURE_S08.height / 1344;
export const boxToFinal = (bx: number, by: number): [number, number] => [
  FIGURE_S08.cx - 300 * SF + bx * SF,
  FIGURE_S08.groundY - 1402 * SF + by * SF,
];
export const finalToBox = (x: number, y: number): [number, number] => [
  (x - (FIGURE_S08.cx - 300 * SF)) / SF,
  (y - (FIGURE_S08.groundY - 1402 * SF)) / SF,
];
export const nToFinal = (x: number, y: number): [number, number] => [FIN_C[0] + (x - 540) * K_N, FIN_C[1] + (y - 900) * K_N];
export const worldToN = (x: number, y: number): [number, number] => [540 + (x - M_WORLD[0]) * Z_NET, 900 + (y - M_WORLD[1]) * Z_NET];

/** echo pulses (soma fires) — period 30 f from f418, continues forever (S09 keeps calling with t > 569) */
export const PULSE_T0 = 418;
export const PULSE_PERIOD = 30;
/** each pulse is followed by two delayed, decaying echoes (the "回声") */
export const ECHOES: Array<[number, number]> = [
  [0, 1],
  [7, 0.5],
  [14, 0.26],
];
/** pulse speed through the network, N-space px per frame */
export const NET_SPEED = 78;

export interface Soma {
  x: number;
  y: number;
  /** ignition frame */
  T: number;
  /** graph distance (N px) from the soma of the present */
  d: number;
  kind: 'present' | 'bead' | 'cell';
  k: number;
}

export interface Net {
  n: number;
  x: Float32Array;
  y: Float32Array;
  parent: Int32Array;
  r: Float32Array;
  tA: Float32Array;
  dist: Float32Array;
  seedH: Float32Array;
  somas: Soma[];
  /** axon polyline in final space from the present (top) through every bead down to the neck */
  axon: Float32Array;
  /** birth frame of a node's first child (Infinity for leaves): the growth tip is where a branch currently ends */
  firstKid: Float32Array;
  /** cumulative N-space distance along the axon */
  axonD: Float32Array;
  /** N-distance at which the axon reaches the oldest bead */
  axonBeadEnd: number;
}

function headPath(): Path2D {
  return memo('S08:humanPath2D', () => new Path2D(HUMAN_PATH));
}

export function getNet(): Net {
  return memo('S08:net', () => buildNet());
}

/** HUMAN_PATH rasterised (box px 0..600 × 0..300: the head and shoulders) — a fast inside test */
function headMask(): Uint8Array {
  return memo('S08:headMask', () => {
    const c = cpuCanvas(600, 300);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fill(headPath());
    const d = ctx.getImageData(0, 0, 600, 300).data;
    const m = new Uint8Array(600 * 300);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
    return m;
  });
}

function buildNet(): Net {
  const mask = headMask();
  const noise = makeNoise(808);
  const inHead = (nx: number, ny: number, inset: number) => {
    const [fx, fy] = nToFinal(nx, ny);
    const [bx, by] = finalToBox(fx, fy);
    if (by > 224 || by < 40) return false;
    const ix = Math.floor(300 + (bx - 300) * inset);
    const iy = Math.floor(150 + (by - 150) * inset);
    if (ix < 0 || ix >= 600 || iy < 0 || iy >= 300) return false;
    return mask[iy * 600 + ix] === 1;
  };

  // --- beads: the footprints in N-space
  const beads = PRINTS.slice(0, MACRO_K + 1).map((p) => worldToN(p.x, p.y));
  // cumulative distance along the trail from the present (k = MACRO_K) downward
  const beadD: number[] = new Array(beads.length).fill(0);
  for (let k = MACRO_K - 1; k >= 0; k--) beadD[k] = beadD[k + 1] + Math.hypot(beads[k][0] - beads[k + 1][0], beads[k][1] - beads[k + 1][1]);

  // --- attractors: jittered grid inside the head, clustered by noise
  const rnd = mulberry32(4242);
  const att: number[] = [];
  const G = 15;
  // distance to the trail (beads) for a density boost around the "memory" axon
  const trailDist = (x: number, y: number) => {
    let d = 1e9;
    for (const b of beads) d = Math.min(d, Math.hypot(b[0] - x, b[1] - y));
    return d;
  };
  for (let y = 120; y < 1700; y += G)
    for (let x = -120; x < 1200; x += G) {
      const ax = x + (rnd() - 0.5) * G * 0.95;
      const ay = y + (rnd() - 0.5) * G * 0.95;
      if (!inHead(ax, ay, 1.08)) continue;
      const nz = noise.fbm2(ax * 0.004, ay * 0.004, 3);
      const near = Math.exp(-trailDist(ax, ay) / 260);
      const keep = 0.22 + 0.5 * smoothstep(-0.35, 0.35, nz) + 0.35 * near;
      if (rnd() > keep) continue;
      att.push(ax, ay);
    }

  // --- other cells (memories not on this trail)
  const cells: Array<[number, number]> = [];
  const r2 = mulberry32(99);
  for (let tries = 0; tries < 900 && cells.length < 17; tries++) {
    const cx = -60 + r2() * 1200;
    const cy = 200 + r2() * 1400;
    if (!inHead(cx, cy, 1.3)) continue;
    let ok = true;
    for (const b of beads) if (Math.hypot(b[0] - cx, b[1] - cy) < 170) ok = false;
    for (const q of cells) if (Math.hypot(q[0] - cx, q[1] - cy) < 190) ok = false;
    if (ok) cells.push([cx, cy]);
  }

  const roots: Array<[number, number]> = [...beads, ...cells];
  const nodes = growFast('S08:dendrites2', { attractors: att, roots, step: 9, influence: 100, kill: 15, maxSteps: 170 });

  // somas
  const T_PRESENT = 352;
  const somas: Soma[] = [];
  beads.forEach((b, k) => {
    somas.push({ x: 0, y: 0, T: T_PRESENT + (MACRO_K - k) * 3.2, d: beadD[k], kind: k === MACRO_K ? 'present' : 'bead', k });
  });
  cells.forEach((q, j) => {
    let best = 0;
    let bd = 1e9;
    beads.forEach((b, k) => {
      const d = Math.hypot(b[0] - q[0], b[1] - q[1]);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    somas.push({ x: 0, y: 0, T: somas[best].T + 10 + bd / 38 + hash01(j, 5) * 8, d: beadD[best] + bd, kind: 'cell', k: j });
  });
  roots.forEach((rt, i) => {
    const [fx, fy] = nToFinal(rt[0], rt[1]);
    somas[i].x = fx;
    somas[i].y = fy;
  });

  // ---- clean the tree: space colonisation can make a node sprout the *same* child on several steps (attractors
  // pulling in opposite directions), i.e. stacks of coincident siblings whose jittered copies fan out into solid
  // wedges. Merge any node that lands within half a step of an already kept sibling (or of its parent) and re-parent
  // its children; parents always precede children, so one pass suffices.
  const STEP = 9;
  const map = new Int32Array(nodes.length).fill(-1);
  const keep: number[] = [];
  const kids = new Map<number, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    if (nd.parent < 0) {
      map[i] = keep.length;
      keep.push(i);
      continue;
    }
    const P = map[nd.parent];
    const pn = nodes[keep[P]];
    let into = -1;
    if (Math.hypot(nd.x - pn.x, nd.y - pn.y) < STEP * 0.5) into = P;
    else
      for (const c of kids.get(P) ?? []) {
        const cn = nodes[keep[c]];
        if (Math.hypot(nd.x - cn.x, nd.y - cn.y) < STEP * 0.5) {
          into = c;
          break;
        }
      }
    if (into >= 0) {
      map[i] = into;
      continue;
    }
    map[i] = keep.length;
    if (!kids.has(P)) kids.set(P, []);
    kids.get(P)!.push(keep.length);
    keep.push(i);
  }

  // kept nodes → typed arrays with lightning jitter (perpendicular, deterministic, ∝ segment length)
  const n = keep.length;
  const X = new Float32Array(n);
  const Y = new Float32Array(n);
  const P = new Int32Array(n);
  const R = new Float32Array(n);
  const TA = new Float32Array(n);
  const D = new Float32Array(n);
  const H = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const i = keep[k];
    const nd = nodes[i];
    let x = nd.x;
    let y = nd.y;
    const pk = nd.parent >= 0 ? map[nd.parent] : -1;
    if (pk >= 0) {
      const p = nodes[keep[pk]];
      const dx = nd.x - p.x;
      const dy = nd.y - p.y;
      const l = Math.hypot(dx, dy) || 1;
      const j = (hash01(i, 77) - 0.5) * 6.5 * Math.min(1, l / STEP);
      x += (-dy / l) * j;
      y += (dx / l) * j;
    }
    const [fx, fy] = nToFinal(x, y);
    X[k] = fx;
    Y[k] = fy;
    P[k] = pk;
    R[k] = nd.radius;
    const s = somas[nd.root];
    TA[k] = s.T + 2 + nd.depth * 0.42;
    D[k] = s.d + nd.depth * 9;
    H[k] = hash01(i, 31);
  }
  // Murray's-law radii on the cleaned tree (children always follow their parent)
  const r3 = new Float64Array(n);
  const hasKid = new Uint8Array(n);
  for (let k = n - 1; k >= 0; k--) {
    R[k] = hasKid[k] ? Math.cbrt(r3[k]) : 1;
    if (P[k] >= 0) {
      hasKid[P[k]] = 1;
      r3[P[k]] += R[k] ** 3;
    }
  }

  const firstKid = new Float32Array(n).fill(Infinity);
  for (let k = 0; k < n; k++) if (P[k] >= 0) firstKid[P[k]] = Math.min(firstKid[P[k]], TA[k]);

  const axg = axonGeom();

  return {
    firstKid,
    n,
    x: X,
    y: Y,
    parent: P,
    r: R,
    tA: TA,
    dist: D,
    seedH: H,
    somas,
    axon: axg.axon,
    axonD: axg.axonD,
    axonBeadEnd: axg.beadEnd,
  };
}

/** strength of the echo-pulse wave at graph distance d (N px) and frame t */
export function pulseAt(d: number, t: number, width = 130): number {
  if (t < PULSE_T0) return 0;
  let s = 0;
  const jMax = Math.floor((t - PULSE_T0) / PULSE_PERIOD);
  for (let j = Math.max(0, jMax - 2); j <= jMax; j++) {
    const f0 = PULSE_T0 + j * PULSE_PERIOD;
    for (const [dl, amp] of ECHOES) {
      const age = t - f0 - dl;
      if (age < 0) continue;
      const front = age * NET_SPEED;
      const q = (d - front) / width;
      if (q > 3 || q < -3) continue;
      s += amp * Math.exp(-q * q) * Math.exp(-age / 40);
    }
  }
  return s;
}

/** the full-grown arbor, blurred, in final space (FIN_C ± 107 final px at 1.5 px per unit) */
const GH_SIZE = 320;
const GH_K = 1.5;
function ghostImage(): HTMLCanvasElement {
  return memo('S08:netGhostImg', () => {
    const net = getNet();
    const a = cpuCanvas(GH_SIZE, GH_SIZE);
    const ctx = a.getContext('2d', { willReadFrequently: true })!;
    ctx.translate(GH_SIZE / 2, GH_SIZE / 2);
    ctx.scale(GH_K, GH_K);
    ctx.translate(-FIN_C[0], -FIN_C[1] - 8);
    const path = new Path2D();
    for (let i = 0; i < net.n; i++) {
      const p = net.parent[i];
      if (p < 0) continue;
      path.moveTo(net.x[p], net.y[p]);
      path.lineTo(net.x[i], net.y[i]);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,186,80,1)';
    ctx.lineWidth = 1.1 / GH_K;
    ctx.stroke(path);
    const b = cpuCanvas(GH_SIZE, GH_SIZE);
    const bx = b.getContext('2d', { willReadFrequently: true })!;
    bx.filter = 'blur(1.5px)';
    bx.drawImage(a, 0, 0);
    bx.filter = 'none';
    return b;
  });
}

/**
 * Out-of-focus "other memories" behind the network (depth layer): the same arbor, rotated and magnified, drawn as
 * one dim blurred image. `s` = final→screen scale of the main network (parallax: the ghost scales slower).
 */
export function drawNetGhost(ctx: CanvasRenderingContext2D, t: number, s: number, alpha: number) {
  if (alpha <= 0.002) return;
  const img = ghostImage();
  const sg = Math.pow(s, 0.82) * 1.5;
  ctx.save();
  ctx.translate(540, 940);
  ctx.rotate(2.55);
  ctx.scale(sg / GH_K, sg / GH_K);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha * 1.6);
  ctx.drawImage(img, -GH_SIZE / 2, -GH_SIZE / 2);
  ctx.restore();
}

/** Axon polyline (final space) from the present through every bead down to the neck — pure, no DOM. */
export function axonGeom(): { axon: Float32Array; axonD: Float32Array; beadEnd: number } {
  return memo('S08:axonGeom', () => {
    const beadsN = PRINTS.slice(0, MACRO_K + 1).map((p) => worldToN(p.x, p.y));
    let beadEnd = 0;
    for (let k = MACRO_K - 1; k >= 0; k--) beadEnd += Math.hypot(beadsN[k][0] - beadsN[k + 1][0], beadsN[k][1] - beadsN[k + 1][1]);
    const pts: Array<[number, number]> = [];
    for (let k = MACRO_K; k >= 0; k--) pts.push(nToFinal(beadsN[k][0], beadsN[k][1]));
    const neck = boxToFinal(300, 236);
    pts.push([(pts[pts.length - 1][0] + neck[0]) / 2, (pts[pts.length - 1][1] + neck[1]) / 2 - 4]);
    pts.push(neck);
    const ax: number[] = [];
    const axD: number[] = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < 8; s++) {
        const t = s / 8;
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        if (ax.length) acc += Math.hypot(x - ax[ax.length - 2], y - ax[ax.length - 1]) / K_N;
        ax.push(x, y);
        axD.push(acc);
      }
    }
    const last = pts[pts.length - 1];
    acc += Math.hypot(last[0] - ax[ax.length - 2], last[1] - ax[ax.length - 1]) / K_N;
    ax.push(last[0], last[1]);
    axD.push(acc);
    return { axon: new Float32Array(ax), axonD: new Float32Array(axD), beadEnd };
  });
}

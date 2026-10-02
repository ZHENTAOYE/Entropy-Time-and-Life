// Cosmic web — parameters, camera and the exact geometry of the web (see the API header in ./cosmos.tsx).
// Everything here is a pure function of its inputs; heavy parts are cached per lattice cell (per tab).
//
// Model (the "Voronoi foam" model of large-scale structure, van de Weygaert 1989):
//   * voids are the cells of a Voronoi tessellation, walls/filaments are its edges, clusters sit on its vertices
//     (a vertex = point equidistant to three void centres = where three filaments meet);
//   * two layers: large layer (cell = 1 world unit, CELL_PX px at zoom 1) = main filaments + clusters (tier 0);
//     small layer (L2_SCALE× finer, rotated) = tributary filaments + groups (tier 1), brightest near main filaments;
//   * a static domain warp bends the straight Voronoi edges into organic filaments;
//   * a low-frequency field modulates mass so the frame has superclusters and big empty regions.
// The geometry is computed exactly here and rasterised per frame (cosmosDraw.ts) into a structure texture that the
// fragment shader (cosmosShader.ts) shades — so canvas flares / sparks / black holes sit EXACTLY on the nodes the
// shader lights up (same data, no float replica needed).
//
// Performance: stills.mjs opens a fresh page per frame, so the COLD cost matters. Geometry is cached per lattice
// cell (each Voronoi vertex / edge is emitted once, by its lowest-id site), the warp is inverted by Newton's method
// with an analytic Jacobian (3–4 steps), and only cells that can reach the screen are visited.

import { clamp, memo, smoothstep } from './math';
import { hash01, seedOf } from './random';

/** Large-cell size in logical px at zoom = 1 (a void is ~1 cell across). */
export const CELL_PX = 300;
export const L2_SCALE = 2.4;
export const L2_ROT = 0.5;
export const L2_OFF: readonly [number, number] = [31.7, 12.9];
/** Domain-warp amplitude (cells). Static in time (the web's geometry is fixed in comoving coordinates). */
export const WARP_A = 0.3;
/** Slow camera drift in cells / second (part of `t`). */
export const DRIFT: readonly [number, number] = [0.0045, -0.003];

export interface WebParams {
  /** clumpiness 0..1: 0 = near-uniform plasma with faint (×10⁵-amplified) mottling, 1 = sharp filaments + empty voids */
  c: number;
  /** 0..1 fraction of nodes ignited (stars switch on in hash order; clusters first, then groups) */
  ignite: number;
  /** 0..1 plasma temperature (see the colour table in cosmos.tsx); 0 = cold (web palette) */
  heat: number;
  /** camera zoom: 1 = default framing (3.6 voids across), < 1 pull back, > 1 push in */
  zoom: number;
  /** camera roll in radians (positive = clockwise on screen) */
  roll: number;
  /** seconds — slow camera drift + boiling of the plasma + sparks / twinkle animation */
  t: number;
  /** 0..1 heat death: every pixel random-walks (stochastic blur, σ ≈ 650·eq² px), desaturates → #5C5C5C ± 6 % noise */
  eq?: number;
  /** 0..1 negative into Beer–Lambert ink on cream paper #F1EADB — spreads as a soft wicking front from (ix, iy) */
  invert?: number;
  /** origin of the inversion front in logical px (default 540, 300 = S09's water line) */
  ix?: number;
  iy?: number;
  /** 0..1 stars burn out in hash order (redden, dim, gone) — S05 */
  die?: number;
  /** 0..1 black holes on the most massive clusters (shadow + lensing + photon ring), evaporating lightest-first */
  bh?: number;
  /** 0..1 photon sparks radiating from lit / collapsing nodes */
  sparks?: number;
  /**
   * how fast the scene ramps `ignite`, in ignite-units per second (default 0.2 = 0→1 over 5 s). The ignition ramp
   * (~0.12 s) and the flash / shock-ring decay (~0.6 s) are defined in SECONDS through this, so they read the same
   * whatever the ramp speed. Pass the average slope of your ignite curve.
   */
  igniteRate?: number;
  /** camera centre in world cells (default 0, 0); see centerOn() */
  cx?: number;
  cy?: number;
  /** screen pivot of zoom / roll in logical px (default 540, 960) */
  px?: number;
  py?: number;
  /** overall exposure multiplier (default 1) */
  exposure?: number;
}

/**
 * S04's last frame == S05's first frame. Convention: S04 drives t = frame / 30, so its last frame (953) is at
 * t = 953 / 30; S05 continues with t = WEB_FINAL.t + frame / 30.
 */
export const WEB_FINAL: Readonly<Required<WebParams>> = Object.freeze({
  c: 1,
  ignite: 1,
  heat: 0,
  zoom: 0.8,
  roll: (6 * Math.PI) / 180,
  t: 953 / 30,
  eq: 0,
  invert: 0,
  die: 0,
  bh: 0,
  sparks: 1,
  igniteRate: 0.2,
  cx: 0,
  cy: 0,
  px: 540,
  py: 960,
  ix: 540,
  iy: 300,
  exposure: 1,
});

export function fullParams(p: WebParams): Required<WebParams> {
  return {
    eq: 0,
    invert: 0,
    die: 0,
    bh: 0,
    sparks: 0,
    igniteRate: 0.2,
    cx: 0,
    cy: 0,
    px: 540,
    py: 960,
    ix: 540,
    iy: 300,
    exposure: 1,
    ...p,
  } as Required<WebParams>;
}

// ───────────────────────── hashing / noise (JS only) ─────────────────────────
const hh = (i: number, j: number, salt: number) => hash01(Math.imul(i | 0, 92821) ^ Math.imul(j | 0, 68917) ^ Math.imul(salt | 0, 1013), 4099 + salt);
const hstr = (s: string, salt = 0) => hash01(seedOf(s), 777 + salt);

/** value noise 0..1 */
export function vn(x: number, y: number, salt = 0): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hh(ix, iy, salt),
    b = hh(ix + 1, iy, salt),
    c = hh(ix, iy + 1, salt),
    e = hh(ix + 1, iy + 1, salt);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
}
/** value noise with its gradient: writes [v, dv/dx, dv/dy] into out at offset o */
function vnG(x: number, y: number, salt: number, out: Float64Array, o: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const dux = 6 * fx * (1 - fx),
    duy = 6 * fy * (1 - fy);
  const a = hh(ix, iy, salt),
    b = hh(ix + 1, iy, salt),
    c = hh(ix, iy + 1, salt),
    e = hh(ix + 1, iy + 1, salt);
  const k = a - b - c + e;
  out[o] = a + (b - a) * ux + (c - a) * uy + k * ux * uy;
  out[o + 1] = dux * (b - a + k * uy);
  out[o + 2] = duy * (c - a + k * ux);
}
/** static domain warp (cells): bends the straight Voronoi walls into organic filaments */
export function warp(x: number, y: number): [number, number] {
  const ax = vn(x * 0.55, y * 0.55, 1),
    ay = vn(x * 0.55, y * 0.55, 2);
  const bx = vn(x * 1.21 + 5.2, y * 1.21 + 1.3, 3),
    by = vn(x * 1.21 + 5.2, y * 1.21 + 1.3, 4);
  return [WARP_A * ((ax - 0.5) * 1.5 + (bx - 0.5) * 0.6), WARP_A * ((ay - 0.5) * 1.5 + (by - 0.5) * 0.6)];
}
/** large-scale matter density 0..1 (supervoids → superclusters), in warped large-layer coords */
export function largeScale(x: number, y: number): number {
  const v = vn(x * 0.3 + 11.1, y * 0.3 + 4.7, 5) * 0.7 + vn(x * 0.68 + 2.2, y * 0.68 + 9.9, 6) * 0.3;
  return smoothstep(0.2, 0.8, v);
}

const WG = new Float64Array(12);
/** invert the warp: w with w + warp(w) = v (Newton, analytic Jacobian; damped fixed-point fallback) */
function unwarpRaw(vx: number, vy: number, gx = vx, gy = vy): [number, number] {
  let x = gx,
    y = gy;
  for (let it = 0; it < 12; it++) {
    vnG(x * 0.55, y * 0.55, 1, WG, 0);
    vnG(x * 0.55, y * 0.55, 2, WG, 3);
    vnG(x * 1.21 + 5.2, y * 1.21 + 1.3, 3, WG, 6);
    vnG(x * 1.21 + 5.2, y * 1.21 + 1.3, 4, WG, 9);
    const ox = WARP_A * ((WG[0] - 0.5) * 1.5 + (WG[6] - 0.5) * 0.6),
      oy = WARP_A * ((WG[3] - 0.5) * 1.5 + (WG[9] - 0.5) * 0.6);
    const ex = x + ox - vx,
      ey = y + oy - vy;
    if (ex * ex + ey * ey < 1e-14) break;
    // J = I + ∂warp/∂(x,y)
    const j11 = 1 + WARP_A * (1.5 * 0.55 * WG[1] + 0.6 * 1.21 * WG[7]),
      j12 = WARP_A * (1.5 * 0.55 * WG[2] + 0.6 * 1.21 * WG[8]),
      j21 = WARP_A * (1.5 * 0.55 * WG[4] + 0.6 * 1.21 * WG[10]),
      j22 = 1 + WARP_A * (1.5 * 0.55 * WG[5] + 0.6 * 1.21 * WG[11]);
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 0.05) {
      x -= ex * 0.6;
      y -= ey * 0.6;
      continue;
    }
    let dx = (j22 * ex - j12 * ey) / det,
      dy = (-j21 * ex + j11 * ey) / det;
    const dl = Math.hypot(dx, dy);
    if (dl > 0.2) {
      dx *= 0.2 / dl;
      dy *= 0.2 / dl;
    }
    x -= dx;
    y -= dy;
  }
  return [x, y];
}

// layer-local ↔ large warped coords
const L2c = Math.cos(L2_ROT),
  L2s = Math.sin(L2_ROT);
function toLayer(layer: 0 | 1, x: number, y: number): [number, number] {
  if (layer === 0) return [x, y];
  return [(L2c * x - L2s * y) * L2_SCALE + L2_OFF[0], (L2s * x + L2c * y) * L2_SCALE + L2_OFF[1]];
}
function fromLayer(layer: 0 | 1, x: number, y: number): [number, number] {
  if (layer === 0) return [x, y];
  const ux = (x - L2_OFF[0]) / L2_SCALE,
    uy = (y - L2_OFF[1]) / L2_SCALE;
  return [L2c * ux + L2s * uy, -L2s * ux + L2c * uy];
}

// ───────────────────────── camera ─────────────────────────
export interface Camera {
  cx: number;
  cy: number;
  px: number;
  py: number;
  /** px per cell */
  k: number;
  cr: number;
  sr: number;
}
export function webCamera(p: WebParams): Camera {
  const q = fullParams(p);
  return {
    cx: q.cx + DRIFT[0] * q.t,
    cy: q.cy + DRIFT[1] * q.t,
    px: q.px,
    py: q.py,
    k: CELL_PX * q.zoom,
    cr: Math.cos(q.roll),
    sr: Math.sin(q.roll),
  };
}
/** world (unwarped cells) → screen px */
export function webToScreen(p: WebParams | Camera, wx: number, wy: number): [number, number] {
  const cam = 'k' in p ? p : webCamera(p);
  const dx = (wx - cam.cx) * cam.k,
    dy = (wy - cam.cy) * cam.k;
  return [cam.px + cam.cr * dx - cam.sr * dy, cam.py + cam.sr * dx + cam.cr * dy];
}
/** screen px → world (unwarped cells) */
export function screenToWeb(p: WebParams | Camera, sx: number, sy: number): [number, number] {
  const cam = 'k' in p ? p : webCamera(p);
  const ux = (sx - cam.px) / cam.k,
    uy = (sy - cam.py) / cam.k;
  return [cam.cx + cam.cr * ux + cam.sr * uy, cam.cy - cam.sr * ux + cam.cr * uy];
}
/**
 * Camera centre (cx, cy) that puts world point (wx, wy) exactly on the pivot at time t — e.g. to pull back out of a
 * galaxy sitting on a cluster: `const n = nearestNode(P, 540, 960)!; P = { ...P, ...centerOn(n.wx, n.wy, P.t) }`.
 */
export function centerOn(wx: number, wy: number, t: number): { cx: number; cy: number } {
  return { cx: wx - DRIFT[0] * t, cy: wy - DRIFT[1] * t };
}

// ───────────────────────── Voronoi geometry (exact, cached per lattice cell) ─────────────────────────
interface Site {
  x: number; // layer-local coords
  y: number;
  id: string;
}
const cellKey = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);
const siteCache: [Map<number, Site[]>, Map<number, Site[]>] = [new Map(), new Map()];
/**
 * Void centres of one lattice cell: 0, 1 or 2 — denser where the large-scale density is high (small voids packed
 * in superclusters), sparser in supervoids (voids merge into huge empty regions).
 */
function cellSites(layer: 0 | 1, i: number, j: number): Site[] {
  const m = siteCache[layer];
  const key = cellKey(i, j);
  const hit = m.get(key);
  if (hit) return hit;
  const [lx, ly] = fromLayer(layer, i + 0.5, j + 0.5);
  const d = largeScale(lx, ly);
  const r = hh(i, j, 10 + layer);
  const pEmpty = layer === 0 ? 0.3 * (1 - d) : 0.45 * (1 - d) + 0.05;
  const pDouble = layer === 0 ? 0.42 * d : 0.3 * d;
  const n = r < pEmpty ? 0 : r > 1 - pDouble ? 2 : 1;
  const out: Site[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ x: i + 0.05 + 0.9 * hh(i, j, 20 + layer * 7 + k * 2), y: j + 0.05 + 0.9 * hh(i, j, 21 + layer * 7 + k * 2), id: `${i},${j},${k}` });
  }
  m.set(key, out);
  return out;
}

interface PolyV {
  x: number;
  y: number;
  /** label (neighbour site id) of the outgoing edge; '' = window boundary */
  lab: string;
}
/** Voronoi cell of a site by half-plane clipping against all sites within ±R cells (exact for this density). */
function sitePoly(layer: 0 | 1, i: number, j: number, k: number): { poly: PolyV[]; nb: Map<string, Site> } {
  const s = cellSites(layer, i, j)[k];
  const R = 3;
  const cand: Array<[number, Site]> = [];
  const nb = new Map<string, Site>();
  for (let dj = -R; dj <= R; dj++)
    for (let di = -R; di <= R; di++)
      for (const q of cellSites(layer, i + di, j + dj)) {
        if (q.id === s.id) continue;
        cand.push([(q.x - s.x) ** 2 + (q.y - s.y) ** 2, q]);
        nb.set(q.id, q);
      }
  cand.sort((a, b) => a[0] - b[0]);
  const B = R + 0.5;
  let poly: PolyV[] = [
    { x: s.x - B, y: s.y - B, lab: '' },
    { x: s.x + B, y: s.y - B, lab: '' },
    { x: s.x + B, y: s.y + B, lab: '' },
    { x: s.x - B, y: s.y + B, lab: '' },
  ];
  let maxR2 = 2 * B * B;
  for (const [d2, q] of cand) {
    if (d2 / 4 > maxR2) break;
    const mx = (s.x + q.x) / 2,
      my = (s.y + q.y) / 2,
      nx = q.x - s.x,
      ny = q.y - s.y;
    const out: PolyV[] = [];
    const n = poly.length;
    let changed = false;
    for (let a = 0; a < n; a++) {
      const A = poly[a],
        Bp = poly[(a + 1) % n];
      const dA = (A.x - mx) * nx + (A.y - my) * ny;
      const dB = (Bp.x - mx) * nx + (Bp.y - my) * ny;
      if (dA <= 0) {
        if (dB <= 0) out.push(A);
        else {
          const t = dA / (dA - dB);
          out.push(A);
          out.push({ x: A.x + (Bp.x - A.x) * t, y: A.y + (Bp.y - A.y) * t, lab: q.id });
          changed = true;
        }
      } else {
        changed = true;
        if (dB <= 0) {
          const t = dA / (dA - dB);
          out.push({ x: A.x + (Bp.x - A.x) * t, y: A.y + (Bp.y - A.y) * t, lab: A.lab });
        }
      }
    }
    if (changed) {
      poly = out;
      maxR2 = 0;
      for (const v of poly) maxR2 = Math.max(maxR2, (v.x - s.x) ** 2 + (v.y - s.y) ** 2);
    }
  }
  return { poly, nb };
}

interface Vtx {
  key: string;
  layer: 0 | 1;
  /** world (unwarped) position */
  wx: number;
  wy: number;
  /** warped large-layer position */
  vx: number;
  vy: number;
  /** 0..1 mass (power law × large-scale density) */
  mass: number;
  r: number;
  dr: number;
}

export interface WebEdge {
  key: string;
  layer: 0 | 1;
  a: Vtx;
  b: Vtx;
  /** polyline in world (unwarped) coords: x0,y0,x1,y1,… */
  pts: Float64Array;
  /** 0..1 filament mass (brightness / thickness) */
  w: number;
}

const vtxCache = new Map<string, Vtx>();
function makeVtx(layer: 0 | 1, key: string, A: Site, B: Site, C: Site): Vtx {
  const hit = vtxCache.get(key);
  if (hit) return hit;
  const bx = B.x - A.x,
    by = B.y - A.y,
    qx = C.x - A.x,
    qy = C.y - A.y;
  const d = 2 * (bx * qy - by * qx) || 1e-12;
  const b2 = bx * bx + by * by,
    c2 = qx * qx + qy * qy;
  const ox = A.x + (qy * b2 - by * c2) / d,
    oy = A.y + (bx * c2 - qx * b2) / d;
  const [vx, vy] = fromLayer(layer, ox, oy);
  const [wx, wy] = unwarpRaw(vx, vy);
  const dens = largeScale(vx, vy);
  const u = hstr(key, 1);
  const mass = clamp(Math.pow(u, layer === 0 ? 1.7 : 2.2) * (0.3 + 0.95 * dens) * 1.15 + (layer === 0 ? 0.04 : 0));
  const v: Vtx = { key, layer, wx, wy, vx, vy, mass, r: hstr(key, 2), dr: hstr(key, 3) };
  vtxCache.set(key, v);
  return v;
}

/** distance-like measure (F2 − F1) to the nearest large-layer wall at warped point (x, y) */
function wallDist(x: number, y: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  let d1 = 1e9,
    d2 = 1e9;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++)
      for (const s of cellSites(0, ix + i, iy + j)) {
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
  return d2 - d1;
}

function edgeData(layer: 0 | 1, a: Vtx, b: Vtx, pairA: string, pairB: string): { pts: Float64Array; w: number } {
  const N = layer === 0 ? 10 : 5;
  const pts = new Float64Array((N + 1) * 2);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let x: number, y: number;
    if (i === 0) [x, y] = [a.wx, a.wy];
    else if (i === N) [x, y] = [b.wx, b.wy];
    else [x, y] = unwarpRaw(a.vx + (b.vx - a.vx) * t, a.vy + (b.vy - a.vy) * t, a.wx + (b.wx - a.wx) * t, a.wy + (b.wy - a.wy) * t);
    pts[i * 2] = x;
    pts[i * 2 + 1] = y;
  }
  const re = hstr(pairA + '|' + pairB, 4);
  const mx = (a.vx + b.vx) / 2,
    my = (a.vy + b.vy) / 2;
  const dens = largeScale(mx, my);
  let w: number;
  if (layer === 0) {
    // "highways" between massive clusters; some walls barely there
    w = Math.pow(Math.sqrt(a.mass * b.mass), 0.55) * (0.3 + 0.95 * re * re) * (0.45 + 0.75 * dens) * 1.25;
    if (re < 0.14) w *= 0.15;
  } else {
    const e1 = wallDist(mx, my);
    const prox = Math.exp(-(e1 * e1) / 0.03);
    w = (0.15 + 0.85 * re) * (0.12 + 0.88 * prox) * (0.3 + 0.7 * dens);
  }
  return { pts, w: clamp(w) };
}

/**
 * Geometry owned by one lattice cell: every Voronoi vertex is emitted by the lowest-id of its three sites and every
 * edge by the lower-id of its two sites, so concatenating cells needs no de-duplication.
 */
interface CellGeo {
  verts: Vtx[];
  edges: WebEdge[];
}
const cellGeoCache: [Map<number, CellGeo>, Map<number, CellGeo>] = [new Map(), new Map()];
function cellGeo(layer: 0 | 1, ci: number, cj: number): CellGeo {
  const m = cellGeoCache[layer];
  const ck = cellKey(ci, cj);
  const hit = m.get(ck);
  if (hit) return hit;
  const verts: Vtx[] = [];
  const edges: WebEdge[] = [];
  const sites = cellSites(layer, ci, cj);
  for (let k = 0; k < sites.length; k++) {
    const s = sites[k];
    const { poly, nb } = sitePoly(layer, ci, cj, k);
    const n = poly.length;
    const vk: Array<Vtx | null> = [];
    for (let a = 0; a < n; a++) {
      const inL = poly[(a + n - 1) % n].lab,
        outL = poly[a].lab;
      if (!inL || !outL || inL === outL) {
        vk.push(null);
        continue;
      }
      const ids = [s.id, inL, outL].sort();
      const key = `${layer}:${ids.join('|')}`;
      const site = (id: string) => (id === s.id ? s : nb.get(id)!);
      const v = makeVtx(layer, key, site(ids[0]), site(ids[1]), site(ids[2]));
      if (ids[0] === s.id) verts.push(v);
      vk.push(v);
    }
    for (let a = 0; a < n; a++) {
      const lab = poly[a].lab;
      if (!lab || !(s.id < lab)) continue;
      let va = vk[a],
        vb = vk[(a + 1) % n];
      if (!va || !vb) continue;
      // canonical orientation (memoised polylines / dust must not depend on which site emitted the edge)
      if (va.key > vb.key) [va, vb] = [vb, va];
      const key = `${layer}:${s.id}|${lab}`;
      const ed = edgeData(layer, va, vb, s.id, lab);
      edges.push({ key, layer, a: va, b: vb, pts: ed.pts, w: ed.w });
    }
  }
  const g = { verts, edges };
  m.set(ck, g);
  return g;
}

/** all vertices + edges of a layer that can reach the screen rectangle (inflated by `margin` px) */
function layerGeometry(layer: 0 | 1, cam: Camera, margin: number, width: number, height: number): CellGeo {
  // world-space bbox of the inflated screen, + warp + one Voronoi cell of slack
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [sx, sy] of [
    [-margin, -margin],
    [width + margin, -margin],
    [-margin, height + margin],
    [width + margin, height + margin],
  ]) {
    const [wx, wy] = screenToWeb(cam, sx, sy);
    x0 = Math.min(x0, wx);
    y0 = Math.min(y0, wy);
    x1 = Math.max(x1, wx);
    y1 = Math.max(y1, wy);
  }
  const pad = WARP_A * 1.3 + 0.3;
  let a0 = Infinity,
    b0 = Infinity,
    a1 = -Infinity,
    b1 = -Infinity;
  for (const [x, y] of [
    [x0 - pad, y0 - pad],
    [x1 + pad, y0 - pad],
    [x0 - pad, y1 + pad],
    [x1 + pad, y1 + pad],
  ]) {
    const [u, v] = toLayer(layer, x, y);
    a0 = Math.min(a0, u);
    b0 = Math.min(b0, v);
    a1 = Math.max(a1, u);
    b1 = Math.max(b1, v);
  }
  const ci0 = Math.floor(a0) - 2,
    cj0 = Math.floor(b0) - 2,
    ci1 = Math.floor(a1) + 2,
    cj1 = Math.floor(b1) + 2;
  const verts: Vtx[] = [];
  const edges: WebEdge[] = [];
  // a lattice cell can only contribute if its centre is within reach of the (rotated) screen rectangle
  const sc = layer === 0 ? 1 : 1 / L2_SCALE;
  const reachPx = (2.6 * sc + pad + 0.4) * cam.k + margin;
  for (let cj = cj0; cj <= cj1; cj++)
    for (let ci = ci0; ci <= ci1; ci++) {
      const [lx, ly] = fromLayer(layer, ci + 0.5, cj + 0.5);
      const [sx, sy] = webToScreen(cam, lx, ly);
      if (sx < -reachPx || sy < -reachPx || sx > width + reachPx || sy > height + reachPx) continue;
      const g = cellGeo(layer, ci, cj);
      for (const v of g.verts) verts.push(v);
      for (const e of g.edges) edges.push(e);
    }
  return { verts, edges };
}

// ───────────────────────── nodes (public) ─────────────────────────
export interface WebNode {
  key: string;
  /** 0 = cluster (large-layer vertex: biggest, gets diffraction spikes), 1 = group (small-layer vertex) */
  tier: 0 | 1;
  /** world position (unwarped cells; constant in time) */
  wx: number;
  wy: number;
  /** screen position, logical px */
  x: number;
  y: number;
  /** 0..1 mass (brightness, spike length, halo size) */
  mass: number;
  /** ignition threshold: the node lights when ignite > rank */
  rank: number;
  /** burn-out threshold for `die` */
  dieRank: number;
  /** 0..1 random (animation phases) */
  r: number;
  lit: number;
  flash: number;
  alive: number;
  redden: number;
  /** 0..1 visibility of the node's tier at this zoom (groups fade out when pulled far back) */
  vis: number;
  /** 0..1 how much of the star is left after its black hole formed (1 = no hole) */
  host: number;
  /** mass-weighted lit · alive · vis · host (0..~1.2) — how bright the star / cluster light is right now */
  bright: number;
}

/**
 * Ignition / death envelopes. Ignition ramp ≈ 0.12 s and flash decay ≈ 0.6 s in REAL time (via igniteRate, ignite
 * units per second); all flashes are faded out over the last 10 % of `ignite`, so ignite = 1 is calm (WEB_FINAL).
 */
export const IGNITE_S = 0.12;
export const FLASH_S = 0.6;
export const DIE_W = 0.05;
export function nodeState(rank: number, dieRank: number, ignite: number, die: number, igniteRate = 0.2) {
  const rate = Math.max(0.01, Math.abs(igniteRate));
  const wI = Math.max(0.002, rate * IGNITE_S),
    wF = Math.max(0.004, rate * FLASH_S);
  const lit = smoothstep(rank, rank + wI, ignite);
  const flash = lit * Math.exp(-Math.max(0, ignite - rank - wI * 0.5) / wF) * (1 - smoothstep(0.9, 1, ignite));
  const alive = 1 - smoothstep(dieRank, dieRank + DIE_W, die);
  const redden = smoothstep(dieRank - 0.22, dieRank + 0.01, die);
  return { lit, flash, alive, redden };
}
function rankOf(v: Vtx) {
  return v.layer === 0 ? 0.03 + 0.42 * v.r * (1.2 - 0.45 * v.mass) : 0.2 + 0.7 * v.r;
}
function dieRankOf(v: Vtx) {
  return v.layer === 0 ? 0.08 + 0.85 * v.dr : 0.02 + 0.9 * v.dr;
}
/** visibility of each tier vs zoom: groups/tributaries fade out between zoom 0.32 and 0.22 (and are not computed) */
export function tierVis(zoom: number): [number, number] {
  return [smoothstep(0.05, 0.09, zoom), smoothstep(0.22, 0.32, zoom)];
}

export interface WebGeometry {
  cam: Camera;
  nodes: WebNode[];
  edges: Array<WebEdge & { sx: Float32Array }>;
  /** visibility of tier 0 / tier 1 at this zoom (multiply their light by it) */
  vis: [number, number];
}

/**
 * Everything on screen for the given params: nodes (both tiers) with state, and edges with screen polylines.
 * Cached geometry; per-call cost is the camera transform only. `margin` px around the frame (default 160).
 * `layers`: 1 = clusters + main filaments only, 3 = both tiers (default).
 */
export function webGeometry(params: WebParams, margin = 160, width = 1080, height = 1920, layers = 3): WebGeometry {
  const p = fullParams(params);
  const cam = webCamera(p);
  const vis = tierVis(p.zoom);
  const nodes: WebNode[] = [];
  const edges: WebGeometry['edges'] = [];
  const holes = p.bh > 0 ? bhSchedule(p.bh) : null;
  const inside = (x: number, y: number) => x > -margin && y > -margin && x < width + margin && y < height + margin;
  const k = cam.k,
    cr = cam.cr * k,
    sr = cam.sr * k;
  for (const layer of [0, 1] as const) {
    if (!(layers & (1 << layer)) || vis[layer] <= 0) continue;
    const g = layerGeometry(layer, cam, margin, width, height);
    for (const v of g.verts) {
      const dx = v.wx - cam.cx,
        dy = v.wy - cam.cy;
      const sx = cam.px + cr * dx - sr * dy,
        sy = cam.py + sr * dx + cr * dy;
      if (!inside(sx, sy)) continue;
      const rank = rankOf(v),
        dieRank = dieRankOf(v);
      const st = nodeState(rank, dieRank, p.ignite, p.die, p.igniteRate);
      const host = holes?.get(v.key)?.host ?? 1;
      nodes.push({
        key: v.key,
        tier: layer,
        wx: v.wx,
        wy: v.wy,
        x: sx,
        y: sy,
        mass: v.mass,
        rank,
        dieRank,
        r: v.r,
        ...st,
        vis: vis[layer],
        host,
        bright: (layer === 0 ? 0.35 + 0.85 * v.mass : 0.15 + 0.45 * v.mass) * st.lit * st.alive * vis[layer] * host,
      });
    }
    for (const e of g.edges) {
      const n = e.pts.length / 2;
      const s = new Float32Array(n * 2);
      let any = false;
      for (let i = 0; i < n; i++) {
        const dx = e.pts[i * 2] - cam.cx,
          dy = e.pts[i * 2 + 1] - cam.cy;
        const a = cam.px + cr * dx - sr * dy,
          b = cam.py + sr * dx + cr * dy;
        s[i * 2] = a;
        s[i * 2 + 1] = b;
        if (!any && inside(a, b)) any = true;
      }
      if (any) edges.push({ ...e, sx: s });
    }
  }
  return { cam, nodes, edges, vis };
}

/** JS view of the shader's nodes: on-screen clusters (tier 0) and groups (tier 1) with exact positions and state. */
export function webNodes(params: WebParams, o: { margin?: number; groups?: boolean } = {}): WebNode[] {
  const ns = webGeometry(params, o.margin ?? 160, 1080, 1920, o.groups === false ? 1 : 3).nodes;
  return o.groups === false ? ns.filter((n) => n.tier === 0) : ns;
}

/** The node nearest to a screen point (e.g. to put a galaxy on it, or to zoom into it). */
export function nearestNode(params: WebParams, sx: number, sy: number, tier: 0 | 1 = 0): WebNode | null {
  let best: WebNode | null = null;
  let bd = Infinity;
  for (const n of webGeometry(params, 700, 1080, 1920, tier === 0 ? 1 : 3).nodes) {
    if (n.tier !== tier) continue;
    const d = (n.x - sx) ** 2 + (n.y - sy) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

// ───────────────────────── black holes (S05) ─────────────────────────
export interface BlackHole {
  key: string;
  x: number;
  y: number;
  /** current shadow radius in px (0 when gone) */
  r: number;
  /** 0..1 presence */
  k: number;
  /** 0..1 evaporation flash envelope (Hawking's final burst) */
  pop: number;
  mass: number;
}
export const MAX_BH = 6;
interface BhCand {
  key: string;
  wx: number;
  wy: number;
  mass: number;
  appear: number;
  evap: number;
}
/**
 * The holes are chosen ONCE, t-independently: the MAX_BH most massive clusters inside the safe area of the WEB_FINAL
 * framing (S05 starts there). Their schedule depends only on the node (hash of its key + its mass), never on the
 * current camera, so drift / roll can't reshuffle them.
 */
export function bhCandidates(): BhCand[] {
  return memo('cosmos:bhcand', () => {
    const g = webGeometry({ ...WEB_FINAL, bh: 0 }, 0, 1080, 1920, 1);
    return g.nodes
      .filter((n) => n.tier === 0 && n.x > 110 && n.x < 970 && n.y > 260 && n.y < 1660)
      .sort((a, b) => b.mass - a.mass)
      .slice(0, MAX_BH)
      .map((n) => {
        const h = hstr(n.key, 9);
        // lightest evaporate first (Hawking: lifetime ∝ M³)
        const evap = 0.42 + 0.46 * Math.pow(clamp((n.mass - 0.3) / 0.7), 1.2) + 0.06 * h;
        return { key: n.key, wx: n.wx, wy: n.wy, mass: n.mass, appear: 0.02 + 0.14 * hstr(n.key, 8), evap };
      });
  });
}
/** per-key schedule at a given bh: presence k, evaporation flash pop, size factor, and what is left of the host star */
function bhSchedule(bh: number): Map<string, { k: number; pop: number; left: number; host: number; c: BhCand }> {
  const out = new Map<string, { k: number; pop: number; left: number; host: number; c: BhCand }>();
  for (const c of bhCandidates()) {
    const form = smoothstep(c.appear, c.appear + 0.1, bh);
    const gone = bh >= c.evap;
    const left = clamp((c.evap - bh) / 0.1);
    const pop = gone ? Math.exp(-(bh - c.evap) / 0.015) : 0;
    // the hole swallows its host: the star fades as the hole forms and never comes back
    out.set(c.key, { k: gone ? 0 : form, pop, left, host: 1 - form, c });
  }
  return out;
}
export function blackHoles(params: WebParams): BlackHole[] {
  const p = fullParams(params);
  if (p.bh <= 0) return [];
  const cam = webCamera(p);
  const zk = Math.sqrt(p.zoom);
  const out: BlackHole[] = [];
  for (const [key, s] of bhSchedule(p.bh)) {
    const [x, y] = webToScreen(cam, s.c.wx, s.c.wy);
    const r0 = (9 + 15 * s.c.mass) * zk;
    const r = s.k > 0 ? r0 * Math.cbrt(s.left) * s.k : 0;
    out.push({ key, x, y, r, k: s.k, pop: s.pop, mass: s.c.mass });
  }
  return out;
}

// ───────────────────────── inversion front (S09) ─────────────────────────
/**
 * Signed front field in px at screen point (x, y): > 0 inside the inverted (ink) region, < 0 outside. Large-scale
 * multi-octave lobes make the front wick outward irregularly; the shader adds the fine scale + the filament bias.
 * The same function drives the shader's front texture and the fading of the crisp light, so they agree.
 */
export function invertFront(p: Required<WebParams>, x: number, y: number): number {
  const ox = p.ix,
    oy = p.iy;
  const dmax = Math.max(Math.hypot(ox, oy), Math.hypot(1080 - ox, oy), Math.hypot(1080 - ox, 1920 - oy), Math.hypot(ox, 1920 - oy));
  // invert 0 → the whole front (incl. its noise, fine scale and filament lead) is still off the frame; 1 → covered
  const R = p.invert * (dmax + 1250) - 650;
  const n =
    (vn(x * 0.0011 + 6.3, y * 0.0011 + 0.7, 30) - 0.5) * 300 +
    (vn(x * 0.0024 + 3.1, y * 0.0024 + 7.7, 31) - 0.5) * 220 +
    (vn(x * 0.0055 + 1.3, y * 0.0055 + 5.1, 32) - 0.5) * 110 +
    (vn(x * 0.013 + 9.1, y * 0.013 + 2.9, 33) - 0.5) * 45;
  return R - Math.hypot(x - ox, y - oy) + n;
}

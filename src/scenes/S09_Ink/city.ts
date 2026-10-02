// S09 pull-back, level 2: a coastal city at night, seen from straight above (world units = metres, the person at the
// origin, y down). One implicit street network shared by every level of detail:
//   * a domain-warped street grid (blocks 118 × 92 m) whose segments exist with the local urban density (dense
//     downtown, thinning suburbs, a dark sea to the east, a river with bridges only on the arterials),
//   * arterials (every 7th / 9th grid line, white LED), radial highways and two ring roads (sodium-white, car lights),
//   * close up: street lamps as discrete points, cars streaming on the arterials and highways.
// Vector LOD for Z < 4.5 (frame < 30 km), then a pre-rendered metro raster (64 km at 31 m/px) for Z 4.2 … 6.6.
import { clamp, memo, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { ctxOf, glow } from './canvas';

export const BX = 118;
export const BY = 92;
const ROT = 0.21;
const CR = Math.cos(ROT),
  SR = Math.sin(ROT);
const WA = 260;
/** downtown centre (world m) */
export const DOWNTOWN: readonly [number, number] = [-950, -640];

// gentle, large-scale bends (streets are straight across a few blocks, the grid swings over kilometres)
function warp(ux: number, uy: number): [number, number] {
  return [
    WA * Math.sin(uy / 1900 + 1.3) + 0.3 * WA * Math.sin((ux + uy) / 1100 + 0.4),
    WA * Math.sin(ux / 2100 + 2.1) + 0.3 * WA * Math.sin((ux - uy) / 1250 + 2.9),
  ];
}
function gmapRaw(ux: number, uy: number): [number, number] {
  const [wx, wy] = warp(ux, uy);
  return [CR * ux - SR * uy + wx, SR * ux + CR * uy + wy];
}
/** the person stands mid-block on a horizontal street */
const UP: readonly [number, number] = [0.5 * BX, 0];
const G0 = gmapRaw(UP[0], UP[1]);
/** grid space → world metres (person at the origin) */
export function gmap(ux: number, uy: number): [number, number] {
  const [x, y] = gmapRaw(ux, uy);
  return [x - G0[0], y - G0[1]];
}

/** sea to the east of this x (world m) */
export const coastX = (y: number) => 3900 + 700 * Math.sin(y / 2400 + 0.7) + 260 * Math.sin(y / 870 + 2.0);
/** river centreline y(x) */
export const riverY = (x: number) => -2350 + 420 * Math.sin(x / 1700 + 0.4) + 150 * Math.sin(x / 610 + 1.1);
export const RIVER_W = 115;

export function isSea(x: number, y: number) {
  return x > coastX(y);
}
export function isRiver(x: number, y: number) {
  return Math.abs(y - riverY(x)) < RIVER_W && x < coastX(y) + 400;
}
/** urban density 0..1 */
export function density(x: number, y: number): number {
  const dx = x - DOWNTOWN[0],
    dy = y - DOWNTOWN[1];
  const r = Math.hypot(dx, dy);
  // irregular city edge: lobes along the coast and the river valley
  const ang = Math.atan2(dy, dx);
  const lobe = 1 + 0.28 * Math.sin(ang * 3 + 0.7) + 0.16 * Math.sin(ang * 5 + 2.2);
  const core = Math.exp(-r / (3300 * lobe));
  const sub = 0.55 * (1 - smoothstep(6500 * lobe, 10500 * lobe, r));
  return clamp(core * 0.85 + sub * (0.55 + 0.45 * Math.sin(x / 1300 + Math.cos(y / 1700) * 2)));
}

export type SegKind = 0 | 1; // 0 residential, 1 arterial
export interface Seg {
  ax: number;
  ay: number;
  mx: number;
  my: number;
  bx: number;
  by: number;
  kind: SegKind;
  b: number; // brightness 0..1
  dt: number; // downtown-ness 0..1 (whiter light)
  id: number;
}

const isArtV = (i: number) => ((i % 7) + 7) % 7 === 0;
const isArtH = (j: number) => ((j % 9) + 9) % 9 === 0;

/** the street segment (i, j, dir) if it exists (dir 0: along u_y from j to j+1 at u_x = i·BX; 1: along u_x) */
export function segAt(i: number, j: number, dir: 0 | 1): Seg | null {
  const ua = dir === 0 ? [i * BX, j * BY] : [i * BX, j * BY];
  const ub = dir === 0 ? [i * BX, (j + 1) * BY] : [(i + 1) * BX, j * BY];
  const [ax, ay] = gmap(ua[0], ua[1]);
  const [bx, by] = gmap(ub[0], ub[1]);
  const [mx, my] = gmap((ua[0] + ub[0]) / 2, (ua[1] + ub[1]) / 2);
  if (isSea(mx, my)) return null;
  const art = dir === 0 ? isArtV(i) : isArtH(j);
  if (isRiver(mx, my) && !art) return null;
  const rho = density(mx, my);
  const h = hash01(i * 7919 + j * 104729 + dir * 15485863, 91);
  const id = (i * 73856093) ^ (j * 19349663) ^ (dir * 83492791);
  // the person's own street always exists
  const mine = dir === 1 && j === 0 && (i === 0 || i === -1);
  if (art) {
    if (rho < 0.05 || (rho < 0.12 && h > 0.6)) return null;
    return { ax, ay, mx, my, bx, by, kind: 1, b: 0.55 + 0.45 * rho, dt: smoothstep(0.55, 0.95, rho), id };
  }
  // parks: a few blocks are dark
  const park = hash01(Math.floor(i / 2) * 31 + Math.floor(j / 2) * 977, 17) < 0.05;
  if (!mine && (h > 1.05 * rho || (park && h > 0.25))) return null;
  return { ax, ay, mx, my, bx, by, kind: 0, b: 0.32 + 0.68 * rho, dt: smoothstep(0.6, 0.97, rho), id };
}

// ───────────────────────────── highways (world polylines) ─────────────────────────────
export interface Road {
  pts: Float32Array;
  ring: boolean;
}
export function highways(): Road[] {
  return memo('s09:highways', () => {
    const out: Road[] = [];
    // radials from downtown (the sea is east: they fan west, north and south), out to 60 km
    const angs = [Math.PI * 0.98, Math.PI * 1.22, Math.PI * 1.47, Math.PI * 1.72, Math.PI * 0.74, Math.PI * 0.52, Math.PI * 0.3];
    angs.forEach((a0, k) => {
      const p: number[] = [];
      let x = DOWNTOWN[0],
        y = DOWNTOWN[1];
      for (let r = 0; r <= 60000; r += 250) {
        const a = a0 + 0.12 * Math.sin(r / 3100 + k * 1.7) + 0.05 * Math.sin(r / 900 + k);
        if (r > 0) {
          x += Math.cos(a) * 250;
          y += Math.sin(a) * 250;
        }
        if (isSea(x, y)) break;
        p.push(x, y);
      }
      out.push({ pts: new Float32Array(p), ring: false });
    });
    // two ring roads (broken by the sea)
    for (const [R, ph] of [
      [3500, 0.3],
      [8700, 1.1],
    ] as const) {
      let p: number[] = [];
      for (let a = 0; a <= Math.PI * 2 + 0.001; a += 0.02) {
        const rr = R * (1 + 0.06 * Math.sin(a * 3 + ph) + 0.03 * Math.sin(a * 7));
        const x = DOWNTOWN[0] + Math.cos(a) * rr;
        const y = DOWNTOWN[1] + Math.sin(a) * rr * 0.92;
        if (isSea(x, y)) {
          if (p.length > 4) out.push({ pts: new Float32Array(p), ring: true });
          p = [];
          continue;
        }
        p.push(x, y);
      }
      if (p.length > 4) out.push({ pts: new Float32Array(p), ring: true });
    }
    return out;
  });
}

// ───────────────────────────── precomputed street table ─────────────────────────────
export interface CityData {
  n: number;
  /** a, mid, b points (world m) */
  ax: Float32Array;
  ay: Float32Array;
  mx: Float32Array;
  my: Float32Array;
  bx: Float32Array;
  by: Float32Array;
  kind: Uint8Array;
  b: Float32Array;
  dt: Float32Array;
  gi: Int16Array;
  gj: Int16Array;
  dir: Uint8Array;
  /** spatial index: cells of CELL m → segment ids */
  cells: Map<number, number[]>;
}
const CELL = 600;
const cellKey = (cx: number, cy: number) => (cx + 512) * 2048 + (cy + 512);
export function cityData(): CityData {
  return memo('s09:city', () => {
    const tmp: Seg[] = [];
    const ij: number[] = [];
    for (let i = -140; i <= 140; i++)
      for (let j = -180; j <= 180; j++)
        for (const dir of [0, 1] as const) {
          const sgm = segAt(i, j, dir);
          if (!sgm) continue;
          tmp.push(sgm);
          ij.push(i, j, dir);
        }
    const n = tmp.length;
    const D: CityData = {
      n,
      ax: new Float32Array(n),
      ay: new Float32Array(n),
      mx: new Float32Array(n),
      my: new Float32Array(n),
      bx: new Float32Array(n),
      by: new Float32Array(n),
      kind: new Uint8Array(n),
      b: new Float32Array(n),
      dt: new Float32Array(n),
      gi: new Int16Array(n),
      gj: new Int16Array(n),
      dir: new Uint8Array(n),
      cells: new Map(),
    };
    tmp.forEach((s, k) => {
      D.ax[k] = s.ax;
      D.ay[k] = s.ay;
      D.mx[k] = s.mx;
      D.my[k] = s.my;
      D.bx[k] = s.bx;
      D.by[k] = s.by;
      D.kind[k] = s.kind;
      D.b[k] = s.b;
      D.dt[k] = s.dt;
      D.gi[k] = ij[k * 3];
      D.gj[k] = ij[k * 3 + 1];
      D.dir[k] = ij[k * 3 + 2];
      const key = cellKey(Math.floor(s.mx / CELL), Math.floor(s.my / CELL));
      let L = D.cells.get(key);
      if (!L) D.cells.set(key, (L = []));
      L.push(k);
    });
    return D;
  });
}

// ───────────────────────────── drawing ─────────────────────────────
export interface View {
  /** px per metre */
  s: number;
  /** screen = (ax, ay) + (world − (wx, wy))·s */
  ax: number;
  ay: number;
  wx: number;
  wy: number;
}
export const sx = (v: View, x: number) => v.ax + (x - v.wx) * v.s;
export const sy = (v: View, y: number) => v.ay + (y - v.wy) * v.s;

const SODIUM = '255,146,52';
const LED = '255,226,186';
const WHITE = '236,244,255';

/**
 * Vector streets (Z < ~4.5). `res` fades the residential mesh out (the raster takes over), `alpha` everything.
 * Draws additively ('lighter').
 */
export function drawStreets(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number, res: number) {
  if (alpha <= 0.003) return;
  const D = cityData();
  const pad = 40 / v.s + 2 * WA;
  // segments shorter than ~1.2 px are left to the metro raster
  if (Math.min(BX, BY) * v.s < 1.2) res = 0;
  const x0 = v.wx + (0 - v.ax) / v.s - pad,
    x1 = v.wx + (1080 - v.ax) / v.s + pad;
  const y0 = v.wy + (0 - v.ay) / v.s - pad,
    y1 = v.wy + (1920 - v.ay) / v.s + pad;
  const segPx = Math.min(BX, BY) * v.s;
  const sub = segPx > 40 ? 4 : segPx > 12 ? 2 : 1;
  const paths: Path2D[] = [];
  for (let k = 0; k < 8; k++) paths.push(new Path2D());
  const lamps: number[] = [];
  const wantLamps = v.s > 0.85;
  const lampStep = 30;
  const visit = (k: number) => {
    const kind = D.kind[k];
    if (kind === 0 && res <= 0.003) return;
    const mx = D.mx[k],
      my = D.my[k];
    if (mx < x0 || mx > x1 || my < y0 || my > y1) return;
    const b = D.b[k];
    const bi = Math.min(3, Math.floor(b * 4));
    const P = paths[kind * 4 + bi];
    if (sub === 1) {
      P.moveTo(sx(v, D.ax[k]), sy(v, D.ay[k]));
      P.lineTo(sx(v, D.bx[k]), sy(v, D.by[k]));
    } else {
      const i = D.gi[k],
        j = D.gj[k],
        dir = D.dir[k];
      for (let q = 0; q <= sub; q++) {
        const u = q / sub;
        const ux = dir === 0 ? i * BX : (i + u) * BX;
        const uy = dir === 0 ? (j + u) * BY : j * BY;
        const [px, py] = gmap(ux, uy);
        if (q === 0) P.moveTo(sx(v, px), sy(v, py));
        else P.lineTo(sx(v, px), sy(v, py));
      }
    }
    if (wantLamps) {
      const ax = D.ax[k],
        ay = D.ay[k],
        bx = D.bx[k],
        by = D.by[k];
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.round(L / lampStep));
      const nx = -(by - ay) / L,
        ny = (bx - ax) / L;
      const off = kind === 1 ? 9 : 5.5;
      for (let q = 0; q < n; q++) {
        const u = (q + 0.5) / n;
        const side = q % 2 === 0 ? 1 : -1;
        lamps.push(ax + (bx - ax) * u + nx * off * side, ay + (by - ay) * u + ny * off * side, kind, b, D.dt[k]);
      }
    }
  };
  // close: visit the spatial cells in view; far: everything
  const cellsX = (x1 - x0) / CELL,
    cellsY = (y1 - y0) / CELL;
  if (cellsX * cellsY < D.cells.size) {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++)
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
        const L = D.cells.get(cellKey(cx, cy));
        if (L) for (const k of L) visit(k);
      }
  } else for (let k = 0; k < D.n; k++) visit(k);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // butt caps & hairlines when dense: round caps on tens of thousands of tiny segments rasterise for seconds
  ctx.lineCap = segPx > 30 ? 'round' : 'butt';
  ctx.lineJoin = 'round';
  // streets read as LINES OF LIGHT (lamps), never as physical asphalt bands
  const wRes = clamp(2.6 * v.s, 0.6, 2.2),
    wArt = clamp(4.5 * v.s, 0.9, 3.4);
  // close up the light is in the lamp pools; the street reads as a line once the pools shrink to points
  const lineK = 0.25 + 0.75 * smoothstep(1.9, 2.9, Math.log10(1080 / v.s));
  for (let k = 0; k < 8; k++) {
    const kind = k < 4 ? 0 : 1;
    const b = ((k % 4) + 0.5) / 4;
    const a = alpha * (kind === 0 ? res : 1);
    if (a <= 0.003) continue;
    const col = kind === 0 ? SODIUM : LED;
    // dense meshes (sub-pixel blocks) must not saturate: alpha falls with the block size on screen
    const meshK = kind === 0 ? clamp(0.35 + segPx / 18) : clamp(0.55 + segPx / 30);
    if (segPx > 6) {
      ctx.strokeStyle = `rgba(${col},${(a * b * 0.12 * meshK * (0.4 + 0.6 * lineK)).toFixed(4)})`;
      ctx.lineWidth = clamp(16 * v.s, 2, 26);
      ctx.stroke(paths[k]);
    }
    ctx.strokeStyle = `rgba(${col},${(a * b * 0.7 * meshK * lineK).toFixed(4)})`;
    ctx.lineWidth = kind === 0 ? wRes : wArt;
    ctx.stroke(paths[k]);
  }
  // the person's own lamp (they stand in its pool of light)
  if (wantLamps) lamps.push(4.5, -5.5, 0, 1, 0);
  // lamps: pools of sodium light on the ground when close, then discrete points along the lines
  if (lamps.length) {
    const lk = (1 - smoothstep(1.7, 3.1, Math.log10(1080 / v.s))) * alpha;
    const pool = 13 * v.s;
    const core = Math.max(0.9, Math.min(5, 0.5 * v.s));
    for (let q = 0; q < lamps.length; q += 5) {
      const x = sx(v, lamps[q]),
        y = sy(v, lamps[q + 1]);
      const rr = Math.max(core * 3, pool);
      if (x < -rr || x > 1080 + rr || y < -rr || y > 1920 + rr) continue;
      const kind = lamps[q + 2],
        b = lamps[q + 3];
      const hex = kind === 1 ? (lamps[q + 4] > 0.5 ? '#FFF1DC' : '#FFE2BA') : '#FF9638';
      glow(ctx, hex, x, y, rr, lk * (0.38 + 0.5 * b), 0.15);
      ctx.fillStyle = `rgba(255,248,232,${(lk * (0.55 + 0.45 * b)).toFixed(4)})`;
      ctx.beginPath();
      ctx.arc(x, y, core, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // lit windows / rooftop lights inside the blocks (texture of a living city)
  const bk = alpha * res * smoothstep(0.08, 0.3, v.s) * (1 - smoothstep(2.5, 6, v.s));
  if (bk > 0.01) {
    const ux0 = Math.floor((x0 - 600) / BX), ux1 = Math.ceil((x1 + 600) / BX);
    const uy0 = Math.floor((y0 - 600) / BY), uy1 = Math.ceil((y1 + 600) / BY);
    const R = Math.max(0.55, Math.min(2.2, 0.32 * v.s));
    for (let i = Math.max(-140, ux0 - 6); i <= Math.min(140, ux1 + 6); i++)
      for (let j = Math.max(-180, uy0 - 6); j <= Math.min(180, uy1 + 6); j++) {
        const [px, py] = gmap((i + 0.5) * BX, (j + 0.5) * BY);
        if (px < x0 || px > x1 || py < y0 || py > y1) continue;
        const rho = density(px, py);
        if (rho < 0.05 || isSea(px, py) || isRiver(px, py)) continue;
        const nL = Math.floor(1 + 7 * rho * hash01(i * 31 + j * 7, 5));
        for (let q = 0; q < nL; q++) {
          const u = 0.12 + 0.76 * hash01(i * 131 + j * 17 + q, 41),
            w = 0.12 + 0.76 * hash01(i * 71 + j * 113 + q, 43);
          const [lx, ly] = gmap((i + u) * BX, (j + w) * BY);
          const h = hash01(i * 7 + j * 3 + q * 11, 47);
          const X = sx(v, lx),
            Y = sy(v, ly);
          if (R > 1.2) glow(ctx, h < 0.7 ? '#FFC98A' : '#CFE2FF', X, Y, R * 5, bk * 0.35, 0.4);
          ctx.fillStyle = h < 0.7 ? `rgba(255,226,170,${(bk * (0.55 + 0.45 * rho)).toFixed(3)})` : `rgba(215,232,255,${(bk * 0.7).toFixed(3)})`;
          ctx.fillRect(X - R, Y - R * 0.7, R * 2, R * 1.4);
        }
      }
  }
  ctx.restore();
  drawHighways(ctx, v, t, alpha);
}

/** highways + ring roads with streaming car lights (white heads one way, red tails the other) */
export function drawHighways(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const roads = highways();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const w = Math.max(1.1, 30 * v.s);
  const P = new Path2D();
  for (const r of roads) {
    const p = r.pts;
    for (let k = 0; k < p.length; k += 2) {
      const x = sx(v, p[k]),
        y = sy(v, p[k + 1]);
      if (k === 0) P.moveTo(x, y);
      else P.lineTo(x, y);
    }
  }
  ctx.strokeStyle = `rgba(255,170,80,${(0.1 * alpha).toFixed(4)})`;
  ctx.lineWidth = w * 4;
  ctx.stroke(P);
  ctx.strokeStyle = `rgba(255,196,120,${(0.62 * alpha).toFixed(4)})`;
  ctx.lineWidth = w;
  ctx.stroke(P);
  // cars: only when they are separable
  const carK = smoothstep(0.035, 0.12, v.s) * alpha;
  if (carK > 0.01) {
    const spacing = 70;
    for (const r of roads) {
      const p = r.pts;
      let acc = 0;
      for (let k = 2; k < p.length; k += 2) {
        const ax = p[k - 2],
          ay = p[k - 1],
          bx = p[k],
          by = p[k + 1];
        const L = Math.hypot(bx - ax, by - ay);
        const mx = sx(v, (ax + bx) / 2),
          my = sy(v, (ay + by) / 2);
        if (mx < -200 || mx > 1280 || my < -200 || my > 2120) {
          acc += L;
          continue;
        }
        const nx = -(by - ay) / L,
          ny = (bx - ax) / L;
        for (const lane of [1, -1]) {
          const speed = 24 * lane;
          const n = Math.ceil(L / spacing);
          for (let q = 0; q < n; q++) {
            const h = hash01(k * 131 + q * 7 + (lane > 0 ? 0 : 5000), 33);
            if (h > 0.62) continue;
            let u = (q * spacing + h * spacing * 0.8 + speed * t + acc * 0.37) % L;
            if (u < 0) u += L;
            const x = ax + ((bx - ax) * u) / L + nx * lane * 7,
              y = ay + ((by - ay) * u) / L + ny * lane * 7;
            const X = sx(v, x),
              Y = sy(v, y);
            ctx.fillStyle = lane > 0 ? `rgba(255,252,240,${(carK * 0.9).toFixed(3)})` : `rgba(255,60,40,${(carK * 0.8).toFixed(3)})`;
            const rr = Math.max(0.8, 2.2 * v.s);
            ctx.fillRect(X - rr, Y - rr, rr * 2, rr * 2);
          }
        }
        acc += L;
      }
    }
  }
  ctx.restore();
}

// ───────────────────────────── metro raster (Z 4.2 … 6.6) ─────────────────────────────
export const METRO_M = 64000; // metres across
export const METRO_PX = 2048;
/** pre-rendered metro: residential mesh + arterials + highways + downtown glow, centred on the person */
export function metroRaster(): HTMLCanvasElement {
  return memo('s09:metro', () => {
    const c = document.createElement('canvas');
    c.width = c.height = METRO_PX;
    const ctx = ctxOf(c);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, METRO_PX, METRO_PX);
    const v: View = { s: METRO_PX / METRO_M, ax: METRO_PX / 2, ay: METRO_PX / 2, wx: 0, wy: 0 };
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const D = cityData();
    for (let k = 0; k < D.n; k++) {
      const bi = D.kind[k] === 1 ? 3 : Math.min(2, Math.floor(D.b[k] * 3));
      paths[bi].moveTo(sx(v, D.ax[k]), sy(v, D.ay[k]));
      paths[bi].lineTo(sx(v, D.bx[k]), sy(v, D.by[k]));
    }
    const cols = [`rgba(${SODIUM},0.16)`, `rgba(${SODIUM},0.3)`, `rgba(${SODIUM},0.48)`, `rgba(${LED},0.6)`];
    paths.forEach((P, k) => {
      ctx.strokeStyle = cols[k];
      ctx.lineWidth = k === 3 ? 1.1 : 0.8;
      ctx.stroke(P);
    });
    drawHighways(ctx, v, 0, 1);
    // downtown: a white-hot core of towers and plazas
    const [dx, dy] = [sx(v, DOWNTOWN[0]), sy(v, DOWNTOWN[1])];
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, 90);
    g.addColorStop(0, 'rgba(255,240,215,0.55)');
    g.addColorStop(0.4, 'rgba(255,190,120,0.18)');
    g.addColorStop(1, 'rgba(255,160,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(dx - 90, dy - 90, 180, 180);
    // the sodium sky-glow of the whole metro (light pollution)
    const g2 = ctx.createRadialGradient(dx, dy, 0, dx, dy, 420);
    g2.addColorStop(0, 'rgba(255,150,60,0.12)');
    g2.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(dx - 420, dy - 420, 840, 840);
    return c;
  });
}

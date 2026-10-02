// S09 B5: the inverted cosmic web IS the ink — and it keeps spreading.
// A snapshot of the fully inverted web (lib CosmicWeb, invert = 1) is converted once to OPTICAL DENSITY with the
// web's own absorption law. Every frame that density is
//   1. advected (semi-Lagrangian) by a smooth, closed-form flow: regions sink at different speeds (veils hang down),
//      a slow large-scale flow bends the filaments, a finer one curls them — no particle ever moves on its own;
//   2. diffused: a blur whose radius grows like √τ (Fick: the spread ∝ √(D·t)); the blur conserves mass, so the
//      ink gets wider, paler and bluer (Beer–Lambert) and the web turns, by itself, into the uniform haze;
//   3. converted back to transmittance and multiplied onto the tank.
// It is the same image that was the universe a second ago: the inversion shows the cosmos and the ink drop are the
// same process (structure on the way to equilibrium).
import { WEB_FINAL, WebParams, webGeometry } from '../../lib/cosmos';
import { ease, memo, seg, smoothstep } from '../../lib/math';
import { HUMAN_PATH } from '../../lib/human';
import { makeNoise } from '../../lib/noise';
import { hash01 } from '../../lib/random';
import { ctxOf, scratch } from './canvas';
import { FIG, FLOOR, K } from './inkfx';
import { skyWeb } from './middle';
import { INK_T, INV, SURFACE_Y } from './timing';

/** the frame whose inverted web becomes the ink (τ = 0) */
export const SNAP_F = INV.handover;
/** the web at the hand-over (geometry is exact: the same data the shader draws) */
export const SNAP_PARAMS: WebParams = { ...WEB_FINAL, ...skyWeb(474), invert: 1 };

const W = 540,
  H = 960; // half resolution

/**
 * The ink's initial optical density, built from the web's exact geometry (filaments with Murray-ish widths by mass,
 * a soft body around each, clusters as dense knots, tributaries fainter) — it matches the inverted shader image it
 * cross-fades from, without rendering the web again.
 */
function initialDensity(): Float32Array {
  return memo('s09:inkRho0', () => {
    const geo = webGeometry(SNAP_PARAMS, 60, 1080, 1920, 3);
    const top = Math.ceil(SURFACE_Y / 2) + 2;
    /** render one additive layer (R channel = density / scale) and read it back */
    const layer = (name: string, scale: number, draw: (g: CanvasRenderingContext2D) => void): Float32Array => {
      const c = scratch(name, W, H);
      const g = ctxOf(c);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      g.scale(0.5, 0.5);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      draw(g);
      const d = g.getImageData(0, 0, W, H).data;
      const out = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) out[i] = (d[i * 4] / 255) * scale;
      return out;
    };
    const path = (g: CanvasRenderingContext2D, e: { sx: Float32Array }) => {
      g.beginPath();
      for (let k = 0; k < e.sx.length; k += 2) {
        if (k === 0) g.moveTo(e.sx[k], e.sx[k + 1]);
        else g.lineTo(e.sx[k], e.sx[k + 1]);
      }
    };
    // A: filament cores and bodies, cluster knots (sharp)
    const A = layer('rho0A', 4, (g) => {
      for (const e of geo.edges) {
        const w = Math.min(1, e.w);
        if (e.layer === 1) {
          g.strokeStyle = `rgb(${Math.round(10 + 22 * w)},0,0)`;
          g.lineWidth = 1.1;
          path(g, e);
          g.stroke();
          continue;
        }
        g.strokeStyle = `rgb(${Math.round(12 + 20 * w)},0,0)`;
        g.lineWidth = 5 + 7 * w;
        path(g, e);
        g.stroke();
        g.strokeStyle = `rgb(${Math.round(32 + 70 * w)},0,0)`;
        g.lineWidth = 1.6 + 2.0 * w;
        path(g, e);
        g.stroke();
      }
      for (const n of geo.nodes) {
        const R = n.tier === 0 ? 7 + 12 * n.mass : 2.5 + 2.5 * n.mass;
        const gr = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
        const v = n.tier === 0 ? 200 : 70;
        gr.addColorStop(0, `rgb(${v},0,0)`);
        gr.addColorStop(0.45, `rgb(${Math.round(v * 0.4)},0,0)`);
        gr.addColorStop(1, 'rgb(0,0,0)');
        g.fillStyle = gr;
        g.fillRect(n.x - R, n.y - R, 2 * R, 2 * R);
      }
    });
    // B: the soft gas around the main filaments (blurred wide)
    const B = layer('rho0B', 1.6, (g) => {
      for (const e of geo.edges) {
        if (e.layer === 1) continue;
        const w = Math.min(1, e.w);
        g.strokeStyle = `rgb(${Math.round(30 + 90 * w)},0,0)`;
        g.lineWidth = 18 + 26 * w;
        path(g, e);
        g.stroke();
      }
      for (const n of geo.nodes) {
        if (n.tier !== 0) continue;
        const R = 40 + 50 * n.mass;
        const gr = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, R);
        gr.addColorStop(0, 'rgb(90,0,0)');
        gr.addColorStop(1, 'rgb(0,0,0)');
        g.fillStyle = gr;
        g.fillRect(n.x - R, n.y - R, 2 * R, 2 * R);
      }
    });
    const tmp = new Float32Array(Math.max(W, H));
    blur3(B, tmp, 9);
    blur3(A, tmp, 0.8);
    // the far slab / intergalactic gas: a faint mottling in the voids
    const nz = makeNoise(3131);
    const rho = new Float32Array(W * H);
    for (let y = top; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const mott = 0.09 * Math.max(0, nz.fbm2(x * 0.012, y * 0.012, 3) + 0.25);
        rho[i] = Math.min(7, A[i] + B[i] + mott);
      }
    for (let y = top; y < top + 10; y++) for (let x = 0; x < W; x++) rho[y * W + x] *= (y - top) / 10;
    return rho;
  });
}

// ───────────────────────────── the flow ─────────────────────────────
// A closed-form, divergence-free velocity field (full-res px/s):
//   * sinking whose speed varies ACROSS the tank (vy = S(x): ∂vy/∂y = 0, divergence-free by itself) — where it sinks
//     faster the filaments are drawn down into hanging veils and fingers;
//   * stream-function modes from large (the whole pattern bends and drifts) to small (curls) — the small ones switch
//     on later: the stirring cascades down to finer eddies as the tank's motion develops.
// The ink at τ is the initial density pulled back through the FLOW MAP of this field (RK2, back-traced from τ to 0 on
// a coarse grid): filaments stretch thin and fold like real advection and never tear. A pure function of τ.
type Mode = readonly [number, number, number, number, number, number]; // kx, ky, U (px/s), ω, φ, onset (s)
const MODES: ReadonlyArray<Mode> = [
  [0.0066, 0.0043, 12, 0.19, 0.4, 0],
  [-0.0047, 0.0074, 10, 0.15, 2.1, 0],
  [0.0205, 0.0128, 9, 0.31, 4.4, 0.6],
  [-0.0158, 0.0236, 8, 0.27, 5.3, 1.2],
  [0.0262, -0.0187, 7, 0.38, 1.1, 1.8],
  [0.046, 0.0305, 4.6, 0.5, 3.3, 3.0],
  [-0.0385, 0.0515, 4.2, 0.45, 0.9, 3.6],
];
const MU = MODES.map(([kx, ky, U]) => {
  const k = Math.hypot(kx, ky);
  return [(U * ky) / k, (-U * kx) / k] as const;
});
let VX = 0,
  VY = 0;
function velAt(x: number, y: number, t: number) {
  let vx = 0,
    vy = 0;
  for (let m = 0; m < MODES.length; m++) {
    const md = MODES[m];
    const on = t <= md[5] ? 0 : t >= md[5] + 2.5 ? 1 : smoothstep(md[5], md[5] + 2.5, t);
    if (on === 0) continue;
    const c = Math.cos(md[0] * x + md[1] * y + md[3] * t + md[4]) * on;
    vx += MU[m][0] * c;
    vy += MU[m][1] * c;
  }
  const s = 9 + 6 * Math.sin(0.0093 * x + 0.8) + 4 * Math.sin(0.0217 * x + 2.3) + 2.5 * Math.sin(0.047 * x + 1.1);
  vy += Math.max(1.5, s) * (0.5 + 0.5 * smoothstep(0, 3, t));
  VX = vx;
  VY = vy;
}

// ───────────────────────────── plumes ─────────────────────────────
// The web's clusters are the densest ink: each one sinks as a FINGER. A narrow column under it falls faster than the
// tank around it (a vertical shear vy(x) — divergence-free, so nothing is created or lost): the cluster is drawn
// down into a hanging drop with its trail, and every thread that crosses the column is pulled into a veil.
interface Plume {
  x0: number;
  y0: number;
  V: number; // px/s once developed
  w: number; // column half-width, px
  t0: number; // onset, s
}
function plumes(): Plume[] {
  return memo('s09:plumes', () => {
    const geo = webGeometry(SNAP_PARAMS, 60, 1080, 1920, 3);
    const out: Plume[] = [];
    let q = 0;
    for (const n of geo.nodes) {
      if (n.x < 8 || n.x > 1072 || n.y < SURFACE_Y + 24 || n.y > 1880) continue;
      const h = hash01(q++, 611);
      if (n.tier === 0) out.push({ x0: n.x, y0: n.y, V: 14 + 26 * n.mass * (0.6 + 0.4 * h), w: 7 + 9 * n.mass, t0: 0.3 + 2.6 * h });
      else if (h < 0.3) out.push({ x0: n.x, y0: n.y, V: 7 + 8 * n.r, w: 4.5, t0: 1.5 + 4 * hash01(q, 612) });
    }
    return out;
  });
}
/** ∫ of a 2-s linear ramp to V: the plume accelerates, then falls steadily */
const fallA = (V: number, t: number) => (t <= 0 ? 0 : t < 2 ? (V * t * t) / 4 : V * (t - 1));
/** vertical shear per column (half-res px) at τ: the columns follow their clusters as the large flow carries them */
const pCache = { tau: -1, P: new Float32Array(W) };
function plumeShear(tau: number): Float32Array {
  if (pCache.tau === tau) return pCache.P;
  pCache.tau = tau;
  const P = pCache.P;
  P.fill(0);
  for (const pl of plumes()) {
    const A = fallA(pl.V, tau - pl.t0);
    if (A < 0.5) continue;
    // forward-track the cluster's x through the smooth flow (RK2)
    let x = pl.x0,
      y = pl.y0,
      t = 0;
    const n = Math.max(1, Math.ceil(tau / DT));
    const dt = tau / n;
    for (let k = 0; k < n; k++) {
      velAt(x, y, t);
      const hx = x + VX * dt * 0.5,
        hy = y + VY * dt * 0.5;
      velAt(hx, hy, t + dt * 0.5);
      x += VX * dt;
      y += VY * dt;
      t += dt;
    }
    const cx = x / 2,
      w = pl.w / 2,
      a = A / 2;
    const i0 = Math.max(0, Math.floor(cx - 3 * w)),
      i1 = Math.min(W - 1, Math.ceil(cx + 3 * w));
    for (let i = i0; i <= i1; i++) {
      const u = (i - cx) / w;
      P[i] += a * Math.exp(-u * u);
    }
  }
  return P;
}

// coarse back-traced flow map (in half-res px): D = destination − source
const GS = 12;
const GW = Math.ceil(W / GS) + 1,
  GH = Math.ceil(H / GS) + 1;
const DT = 0.4;
const dCache = { tau: -1, D: new Float32Array(GW * GH * 2) };
function displacement(tau: number): Float32Array {
  if (dCache.tau === tau) return dCache.D;
  dCache.tau = tau;
  return (() => {
    const D = dCache.D;
    const n = Math.max(1, Math.ceil(tau / DT));
    const dt = tau / n;
    for (let j = 0; j < GH; j++)
      for (let i = 0; i < GW; i++) {
        const X = i * GS * 2,
          Y = j * GS * 2;
        let x = X,
          y = Y,
          t = tau;
        if (tau > 0)
          for (let s = 0; s < n; s++) {
            velAt(x, y, t);
            const hx = x - VX * dt * 0.5,
              hy = y - VY * dt * 0.5;
            velAt(hx, hy, t - dt * 0.5);
            x -= VX * dt;
            y -= VY * dt;
            t -= dt;
          }
        const k = (j * GW + i) * 2;
        D[k] = (X - x) / 2;
        D[k + 1] = (Y - y) / 2;
      }
    return D;
  })();
}

function blur3(a: Float32Array, tmp: Float32Array, r: number) {
  const R = Math.max(1, Math.round(r));
  const inv = 1 / (2 * R + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[o + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        tmp[x] = acc * inv;
        acc += a[o + Math.min(W - 1, x + R + 1)] - a[o + Math.max(0, x - R)];
      }
      for (let x = 0; x < W; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += a[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        tmp[y] = acc * inv;
        acc += a[Math.min(H - 1, y + R + 1) * W + x] - a[Math.max(0, y - R) * W + x];
      }
      for (let y = 0; y < H; y++) a[y * W + x] = tmp[y];
    }
  }
}

// ───────────────────────────── the figure's clearing ─────────────────────────────
const FIG_X0 = 130,
  FIG_X1 = 410,
  FIG_Y0 = 170,
  FIG_Y1 = 700; // half-res box around the figure
/** a soft band (≈ 30 px) around the figure's contour, half resolution */
function figureMask(): Float32Array {
  return memo('s09:figMask', () => {
    const c = scratch('figMask', W, H);
    const g = ctxOf(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const k = FIG.h / 1344;
    g.setTransform(0.5 * k, 0, 0, 0.5 * k, 0.5 * (FIG.cx - 300 * k), 0.5 * (FIG.feet - 1402 * k));
    g.strokeStyle = '#fff';
    g.lineJoin = 'round';
    g.lineWidth = 46 / k;
    g.stroke(new Path2D(HUMAN_PATH));
    const d = g.getImageData(0, 0, W, H).data;
    const m = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = d[i * 4 + 3] / 255;
    blur3(m, new Float32Array(Math.max(W, H)), 6);
    return m;
  });
}
/** [mask, strength, y of the painting front (full-res px)] or null */
function figureDepletion(f: number): [Float32Array, number, number] | null {
  const a = smoothstep(INK_T.paint[0], INK_T.paint[0] + 10, f) * (1 - smoothstep(INK_T.release[0], INK_T.release[0] + 50, f));
  if (a <= 0.003) return null;
  const top = FIG.feet - FIG.h;
  const yFront = top - 30 + (FIG.h + 80) * ease.inOutSine(seg(f, INK_T.paint[0], INK_T.paint[1]));
  return [figureMask(), a, yFront];
}

const LUT_N = 2048,
  LUT_MAX = 8;
function lut(): Uint8ClampedArray {
  return memo('s09:fieldLut', () => {
    const o = new Uint8ClampedArray(LUT_N * 3);
    for (let i = 0; i < LUT_N; i++) {
      const r = (i / (LUT_N - 1)) * LUT_MAX;
      for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.round(255 * (FLOOR[c] + (1 - FLOOR[c]) * Math.exp(-r * K[c])));
    }
    return o;
  });
}

/** the share of the ink still in the web's threads (the rest has become the uniform haze) */
export const fieldShare = (tau: number) => 0.42 + 0.58 * Math.exp(-tau / 5.5);

/**
 * Draw the spreading ink at frame f (multiply). `gain` scales the optical density (light-table power, fades).
 * Returns false when no snapshot is available yet (the caller keeps drawing the live web).
 */
export function drawInkField(ctx: CanvasRenderingContext2D, f: number, gain: number): boolean {
  if (gain <= 0.003) return true;
  const tau = Math.max(0, (f - SNAP_F) / 30);
  const rho = initialDensity();
  const D = displacement(tau);
  const out = memo('s09:fieldOut', () => ({ a: new Float32Array(W * H), t: new Float32Array(Math.max(W, H)) }));
  const R = out.a;
  // 1. advect (bilinear displacement from the coarse grid, bilinear density sample)
  const PS = plumeShear(tau);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // undo the plumes' fall (the latest motion), then trace back through the smooth flow
      const yp = Math.max(0, y - PS[x]);
      const gy = yp / GS;
      const j0 = Math.min(GH - 2, Math.floor(gy));
      const fy = gy - j0;
      const gx = x / GS;
      const i0 = Math.min(GW - 2, Math.floor(gx));
      const fx = gx - i0;
      const k00 = (j0 * GW + i0) * 2,
        k10 = k00 + 2,
        k01 = k00 + GW * 2,
        k11 = k01 + 2;
      const dx = (D[k00] * (1 - fx) + D[k10] * fx) * (1 - fy) + (D[k01] * (1 - fx) + D[k11] * fx) * fy;
      const dy = (D[k00 + 1] * (1 - fx) + D[k10 + 1] * fx) * (1 - fy) + (D[k01 + 1] * (1 - fx) + D[k11 + 1] * fx) * fy;
      let sx = x - dx,
        sy = yp - dy;
      // the tank's walls are far outside the frame: mirror at the sides and the bottom (no paper flows in)
      if (sx < 0) sx = -sx;
      else if (sx > W - 1.001) sx = 2 * (W - 1.001) - sx;
      if (sy > H - 1.001) sy = 2 * (H - 1.001) - sy;
      const xi = Math.floor(sx),
        yi = Math.floor(sy);
      if (xi < 0 || yi < 0 || xi >= W - 1 || yi >= H - 1) {
        R[y * W + x] = 0;
        continue;
      }
      const ax = sx - xi,
        ay = sy - yi;
      const b = yi * W + xi;
      R[y * W + x] = (rho[b] * (1 - ax) + rho[b + 1] * ax) * (1 - ay) + (rho[b + W] * (1 - ax) + rho[b + W + 1] * ax) * ay;
    }
  }
  // 2. diffuse: σ ∝ √τ (molecular) + ∝ τ (the slow turbulent mixing of the tank) — half-res px
  const sigma = 0.3 + 0.9 * Math.sqrt(tau) + 0.4 * tau;
  if (sigma > 0.6) blur3(R, out.t, sigma);
  // the painted contour draws ink in from its neighbourhood (flow into the lines, never creation): a paper-light
  // margin follows the brush down the figure and flows back once the figure is let go
  const dep = figureDepletion(f);
  if (dep) {
    const [mask, k, yFront] = dep;
    const yRow = Math.floor(yFront / 2);
    for (let y = Math.max(0, FIG_Y0); y < Math.min(H, FIG_Y1); y++) {
      const vy = smoothstep(yRow + 40, yRow - 20, y) * k;
      if (vy <= 0.003) continue;
      for (let x = FIG_X0; x < FIG_X1; x++) {
        const i = y * W + x;
        R[i] *= 1 - 0.62 * vy * mask[i];
      }
    }
  }
  // 3. Beer–Lambert → multiply
  const L = lut();
  const c = scratch('fieldOut', W, H);
  const g = ctxOf(c);
  const img = g.createImageData(W, H);
  const px = img.data;
  const lk = (LUT_N - 1) / LUT_MAX;
  const top = Math.ceil(SURFACE_Y / 2);
  // mass is conserved, but it leaves the threads for the uniform haze (drawHaze grows by the same amount)
  const g2 = gain * fieldShare(tau);
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    const r = y < top ? 0 : R[i] * g2;
    const li = Math.min(LUT_N - 1, (r * lk) | 0) * 3;
    const o = i * 4;
    px[o] = L[li];
    px[o + 1] = L[li + 1];
    px[o + 2] = L[li + 2];
    px[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, W, H, 0, 0, 1080, 1920);
  ctx.restore();
  return true;
}

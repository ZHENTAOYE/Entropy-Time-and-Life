// S09 B5: the inverted cosmic web IS the ink — and it keeps spreading.
// The web's exact geometry at the hand-over is rasterised once into OPTICAL DENSITY (calibrated to the inverted
// shader image it cross-fades from). Every frame that density is
//   1. advected, semi-Lagrangian, through the FLOW MAP of the tank's water (flow.ts: sinking that varies across the
//      tank, large → small stream-function modes switching on as the stirring cascades), back-traced from τ to 0, then
//      through a dozen EDDIES spun up beside the web's densest clusters (spirals: the curl of ink in water, 墨流し) —
//      the ink is only ever moved, stretched and folded, never created;
//   2. drawn onto the FIGURE's outline by the tank's currents (figure.ts: the lens — filaments near the contour are
//      drawn toward it and dragged downhill along it), thinned around and inside the outline where its ink came from,
//      plus the body's pale wash; once the figure is let go (τ_rel), all of that is carried off by the water (the late
//      flow segment τ_rel → τ is traced first);
//   3. diffused: a blur whose radius grows like √τ (Fick) plus ∝ τ (the tank's slow mixing); the blur conserves mass,
//      so the ink gets wider, paler and bluer (Beer–Lambert), while a growing share of it is handed to the uniform
//      haze (drawHaze) — the web turns, by itself, into the equilibrium;
//   4. converted back to transmittance and multiplied onto the tank.
// Resolution follows the physics: half resolution while the threads are sharp (the hand-over from the live web), quarter
// resolution once the diffusion radius is ≥ 2 half-res px (σ ≥ 4 px, f498) and 1/8 once it is ≥ 4.2 (σ ≥ 8.4 px,
// f595): nothing finer is left to resolve (a Gaussian of σ ≥ 2·spacing has < 1 % of its spectrum above Nyquist), and
// the total blur is the same on both sides of each switch, so they are invisible.
import { WEB_FINAL, WebParams, webGeometry } from '../../lib/cosmos';
import { memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hash01 } from '../../lib/random';
import { V, velAt } from './flow';
import { DEV } from './dev';
import { ctxOf, scratch } from './canvas';
import { FLOOR, K, hazeAt } from './inkfx';
import { LG, LH, LW, LX0, LY0, RQ, TAU_REL, figGrid, lensDelta, paintK, releaseDensityQ, releaseGain, washGrid } from './figure';
import { FIG, FIG_TOP } from './figgeo';
import { skyWeb } from './middle';
import { INK_T, INV, SURFACE_Y } from './timing';

/** the frame whose inverted web becomes the ink (τ = 0) */
export const SNAP_F = INV.handover;
/** the web at the hand-over (geometry is exact: the same data the shader draws) — lazy: only ink frames pay for it */
export const snapParams = (): WebParams => memo('s09:snapParams', () => ({ ...WEB_FINAL, ...skyWeb(474), invert: 1 }));
/**
 * The web's geometry at the hand-over. `layers` 3 = clusters + filaments AND the tributaries / groups (needed only while
 * the threads are sharp: the hand-over, half resolution); 1 = clusters + filaments only — after ~1 s of diffusion
 * (σ ≥ 4 px) a 1-px tributary of density ≲ 0.5 has spread to ≲ 0.03: nothing left to draw (and a third of the cost).
 */
const snapGeo = (layers: 1 | 3) =>
  memo(`s09:snapGeo:${layers}`, () => {
    const p = snapParams();
    DEV.tick?.('geo:params');
    return webGeometry(p, 60, 1080, 1920, layers);
  });

/** diffusion radius, half-res px */
export const fieldSigma = (tau: number) => 0.3 + 0.9 * Math.sqrt(tau) + 0.4 * tau;
type Res = 2 | 4 | 8;
const QUARTER_SIGMA = 2.0;
const EIGHTH_SIGMA = 4.2;
/** sample spacing (full px) for a diffusion radius σ (half-res px) */
const resFor = (sigma: number): Res => (sigma >= EIGHTH_SIGMA ? 8 : sigma >= QUARTER_SIGMA ? 4 : 2);
/** the quarter-res density carries this much more blur (half-res px) than the half-res one: it is taken off the
 *  diffusion blur, so the total blur is the same on both sides of the switch */
const PRE_Q = 1.0;
/** …and the 1/8-res density (raster only, no extra pass) carries about as much */
const PRE_E = 1.0;

/** separable box blur, `passes` passes of radius R (σ² ≈ passes·R(R+1)/3) */
function boxBlur(a: Float32Array, W: number, H: number, R: number, passes: number) {
  if (R < 1 || passes < 1) return;
  const tmp = memo('s09:field:tmp', () => ({ a: new Float32Array(1) }));
  if (tmp.a.length < Math.max(W, H)) tmp.a = new Float32Array(Math.max(W, H));
  const t = tmp.a;
  const inv = 1 / (2 * R + 1);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < H; y++) {
      const o = y * W;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[o + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        t[x] = acc * inv;
        acc += a[o + Math.min(W - 1, x + R + 1)] - a[o + Math.max(0, x - R)];
      }
      for (let x = 0; x < W; x++) a[o + x] = t[x];
    }
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += a[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        t[y] = acc * inv;
        acc += a[Math.min(H - 1, y + R + 1) * W + x] - a[Math.max(0, y - R) * W + x];
      }
      for (let y = 0; y < H; y++) a[y * W + x] = t[y];
    }
  }
}
/** a blur of (close to) σ samples, continuous in σ: three box passes mixing radii R and R + 1 */
function blurSigma(a: Float32Array, W: number, H: number, sigma: number) {
  const s2 = sigma * sigma * 3; // = Σ R_i (R_i + 1) over 3 passes
  let R = 0;
  while ((R + 1) * (R + 2) * 3 <= s2) R++;
  const lo = R * (R + 1),
    hi = (R + 1) * (R + 2);
  const m = Math.max(0, Math.min(3, Math.round((s2 - 3 * lo) / (hi - lo))));
  boxBlur(a, W, H, R, 3 - m);
  boxBlur(a, W, H, R + 1, m);
}

/**
 * The ink's initial optical density at sample spacing r (2 or 4 full px), built from the web's exact geometry
 * (filaments with Murray-ish widths by mass, a soft body around each, clusters as dense knots, tributaries fainter) — it
 * matches the inverted shader image it cross-fades from, without rendering the web again.
 */
function initialDensity(r: Res): { rho: Float32Array; rho1: Float32Array | null } {
  return memo(`s09:inkRho0:${r}`, () => {
    const W = 1080 / r,
      H = 1920 / r;
    const geo = snapGeo(r === 2 ? 3 : 1);
    DEV.tick?.('rho0:geo');
    const top = Math.ceil(SURFACE_Y / r) + 2;
    /** render one additive layer (R channel = density / scale) and read it back */
    const layer = (name: string, scale: number, draw: (g: CanvasRenderingContext2D) => void, rr: number = r): Float32Array => {
      const W = 1080 / rr,
        H = 1920 / rr;
      const c = scratch(`${name}:${rr}`, W, H);
      const g = ctxOf(c);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      g.scale(1 / rr, 1 / rr);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      draw(g);
      const d = g.getImageData(0, 0, W, H).data;
      const out = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) out[i] = (d[i * 4] / 255) * scale;
      return out;
    };
    const paths = new Map<object, Path2D>();
    const edgePath = (e: { sx: Float32Array }) => {
      let p = paths.get(e);
      if (!p) {
        p = new Path2D();
        for (let k = 0; k < e.sx.length; k += 2) {
          if (k === 0) p.moveTo(e.sx[k], e.sx[k + 1]);
          else p.lineTo(e.sx[k], e.sx[k + 1]);
        }
        paths.set(e, p);
      }
      return p;
    };
    // A1 (half resolution only): the tributaries and groups — the thinnest threads, the first to diffuse away (they
    // fade out over the hand-over: the quarter-res field has none)
    const A1 =
      r !== 2
        ? null
        : layer('rho0A1', 4, (g) => {
            for (const e of geo.edges) {
              if (e.layer !== 1) continue;
              const w = Math.min(1, e.w);
              g.strokeStyle = `rgb(${Math.round(10 + 22 * w)},0,0)`;
              g.lineWidth = 1.1;
              g.stroke(edgePath(e));
            }
            const spr = knotSprite();
            g.globalAlpha = 70 / 255;
            for (const n of geo.nodes) {
              if (n.tier === 0) continue;
              const R = 2.5 + 2.5 * n.mass;
              g.drawImage(spr, n.x - R, n.y - R, 2 * R, 2 * R);
            }
            g.globalAlpha = 1;
          });
    // A: filament cores and bodies, cluster knots (sharp)
    const A = layer('rho0A', 4, (g) => {
      for (const e of geo.edges) {
        const w = Math.min(1, e.w);
        const p = edgePath(e);
        if (e.layer === 1) continue;
        g.strokeStyle = `rgb(${Math.round(12 + 20 * w)},0,0)`;
        g.lineWidth = 5 + 7 * w;
        g.stroke(p);
        g.strokeStyle = `rgb(${Math.round(32 + 70 * w)},0,0)`;
        g.lineWidth = 1.6 + 2.0 * w;
        g.stroke(p);
      }
      // cluster knots: one cached radial sprite (stops 1 · 0.4 at 0.45 · 0), scaled; additive
      const spr = knotSprite();
      g.globalAlpha = 200 / 255;
      for (const n of geo.nodes) {
        if (n.tier !== 0) continue;
        const R = 7 + 12 * n.mass;
        g.drawImage(spr, n.x - R, n.y - R, 2 * R, 2 * R);
      }
      g.globalAlpha = 1;
    });
    // B: the soft gas around the main filaments (blurred wide: rasterised at 1/8 resolution, shared by both rates)
    const B = memo('s09:inkRho0B8', () => {
      const b = layer('rho0B', 1.6, drawB, 8);
      boxBlur(b, 135, 240, 2, 3); // σ ≈ 2.45 × 8 = 20 px
      return b;
    });
    function drawB(g: CanvasRenderingContext2D) {
      for (const e of geo.edges) {
        if (e.layer === 1) continue;
        const w = Math.min(1, e.w);
        g.strokeStyle = `rgb(${Math.round(30 + 90 * w)},0,0)`;
        g.lineWidth = 18 + 26 * w;
        g.stroke(edgePath(e));
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
    }
    DEV.tick?.('rho0:layers');
    if (r === 2) {
      boxBlur(A, W, H, 1, 3); // σ ≈ 1.4 half px (the calibrated hand-over look)
      boxBlur(A1!, W, H, 1, 3);
    }
    else if (r === 4) boxBlur(A, W, H, 1, 1); // σ ≈ 0.8 quarter px (+ the coarser raster) ≈ √(1.4² + PRE_Q²) half px
    // (r = 8: the 8-px raster alone)
    DEV.tick?.('rho0:blur');
    // the far slab / intergalactic gas: a faint mottling in the voids (noise on a coarse 12-px lattice, bilinear)
    const nz = makeNoise(3131);
    const MS = 12 / r,
      MW = Math.ceil(W / MS) + 2,
      MH = Math.ceil(H / MS) + 2;
    const M = new Float32Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) M[j * MW + i] = 0.09 * Math.max(0, nz.fbm2(i * 12 * 0.006, j * 12 * 0.006, 3) + 0.25);
    const rho = new Float32Array(W * H);
    for (let y = top; y < H; y++) {
      const gy = y / MS,
        j0 = Math.floor(gy),
        fy = gy - j0;
      for (let x = 0; x < W; x++) {
        const gx = x / MS,
          i0 = Math.floor(gx),
          fx = gx - i0;
        const o = j0 * MW + i0;
        const mott = (M[o] * (1 - fx) + M[o + 1] * fx) * (1 - fy) + (M[o + MW] * (1 - fx) + M[o + MW + 1] * fx) * fy;
        // B (1/8 res), bilinear
        const bx = Math.min(133.999, Math.max(0, ((x + 0.5) * r) / 8 - 0.5)),
          by = Math.min(238.999, Math.max(0, ((y + 0.5) * r) / 8 - 0.5));
        const bi = bx | 0,
          bj = by | 0,
          bu = bx - bi,
          bv = by - bj,
          bo = bj * 135 + bi;
        const bb = (B[bo] * (1 - bu) + B[bo + 1] * bu) * (1 - bv) + (B[bo + 135] * (1 - bu) + B[bo + 136] * bu) * bv;
        const i = y * W + x;
        rho[i] = Math.min(7, A[i] + bb + mott);
      }
    }
    const ramp = Math.ceil(20 / r);
    for (let y = 0; y < top + ramp; y++)
      for (let x = 0; x < W; x++) {
        const k = y < top ? 0 : (y - top) / ramp;
        rho[y * W + x] *= k;
        if (A1) A1[y * W + x] *= k;
      }
    return { rho, rho1: A1 };
  });
}

/** a radial knot sprite in the red channel: 1 at the centre, 0.4 at 0.45 R, 0 at R (the old per-node gradient) */
function knotSprite(): HTMLCanvasElement {
  return memo('s09:knotSprite', () => {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = ctxOf(c);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgb(255,0,0)');
    gr.addColorStop(0.45, 'rgb(102,0,0)');
    gr.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return c;
  });
}

// ───────────────────────────── swirls ─────────────────────────────
// Where the web's biggest clusters sit, the dense ink stirs the water into an EDDY (a Gaussian vortex: ψ = Γ·e^(−r²/2s²),
// divergence-free; it turns fastest at its centre, so whatever it holds winds into a spiral — the curl of ink in water,
// the rings and swirls of 墨流し). Each eddy sits a little off its cluster, spins up, turns one to two times and dies
// away. Operator splitting: the eddies act on the picture the smooth flow has made (Φ = Φ_eddy ∘ Φ_smooth); each one's
// map is back-traced on a fine local grid (frozen once the eddy has stopped).
interface Plume {
  x0: number; // eddy centre at τ = 0 (full-res px)
  y0: number;
  w: number; // peak angular velocity at the centre, rad/s (signed: the turning sense)
  s: number; // radius, px
  t0: number; // onset, s
  life: number; // s, then it slows and stops
}
const plumeAmp = (p: { w: number; t0: number; life: number }, t: number) =>
  t <= p.t0 ? 0 : p.w * smoothstep(p.t0, p.t0 + 1.0, t) * (1 - smoothstep(p.t0 + p.life, p.t0 + p.life + 2.0, t));
/** (tier-0 clusters are the same in both geometries: use whichever this frame already built) */
function plumes(layers: 1 | 3): Plume[] {
  return memo('s09:plumes', () => {
    const geo = snapGeo(layers);
    const cand = geo.nodes
      .filter((n) => n.tier === 0 && n.x > 70 && n.x < 1010 && n.y > SURFACE_Y + 60 && n.y < 1640)
      .sort((a, b) => b.mass - a.mass);
    const out: Plume[] = [];
    for (const n of cand) {
      if (out.length >= 9) break;
      if (out.some((p) => Math.hypot(p.x0 - n.x, p.y0 - n.y) < 230)) continue;
      const q = out.length;
      const h = hash01(q, 611),
        h2 = hash01(q, 613),
        h3 = hash01(q, 617);
      const s = 28 + 20 * n.mass * (0.6 + 0.4 * h);
      const off = 0.55 * s,
        ang = h3 * Math.PI * 2;
      out.push({
        x0: n.x + Math.cos(ang) * off,
        y0: n.y + Math.sin(ang) * off,
        w: (q % 2 ? -1 : 1) * (1.5 + 0.7 * h),
        s,
        t0: 0.3 + 0.42 * q + 0.6 * h2,
        life: 2.4 + 1.6 * h3,
      });
    }
    return out;
  });
}
const DT = 0.6;
/** where the smooth flow has carried a point by τ (RK2, forward) */
function forwardSmooth(x0: number, y0: number, tau: number): [number, number] {
  let x = x0,
    y = y0,
    t = 0;
  const n = Math.max(1, Math.ceil(tau / DT));
  const dt = tau / n;
  for (let k = 0; k < n; k++) {
    velAt(x, y, t);
    const hx = x + V[0] * dt * 0.5,
      hy = y + V[1] * dt * 0.5;
    velAt(hx, hy, t + dt * 0.5);
    x += V[0] * dt;
    y += V[1] * dt;
    t += dt;
  }
  return [x, y];
}
let PVX = 0,
  PVY = 0;
function plumeVel(p: Plume, x: number, y: number, t: number, cx: number, cy: number) {
  PVX = 0;
  PVY = 0;
  const w = plumeAmp(p, t);
  if (w === 0) return;
  const dx = x - cx,
    dy = y - cy;
  const s2 = p.s * p.s;
  const r2 = dx * dx + dy * dy;
  if (r2 > 11 * s2) return;
  const e = w * Math.exp(-r2 / (2 * s2));
  PVX = -e * dy;
  PVY = e * dx;
}
const PG = 8; // the eddies' fine grid, full px
const PDTS = 0.33; // back-trace step, s
/** the eddies' inverse map at τ, rasterised at sample spacing r (full px; zero outside their windows) */
const pdCache = { key: '', PD: new Float32Array(1), any: false };
function plumeField(tau: number, r: Res) {
  const W = 1080 / r,
    H = 1920 / r;
  const key = `${tau}|${r}`;
  if (pdCache.key === key) return pdCache;
  pdCache.key = key;
  if (pdCache.PD.length < W * H * 2) pdCache.PD = new Float32Array(W * H * 2);
  const PD = pdCache.PD;
  PD.fill(0, 0, W * H * 2);
  pdCache.any = false;
  for (const p of plumes(r === 2 ? 3 : 1)) {
    if (tau <= p.t0 + 0.05) continue;
    const [Xs, Ys] = forwardSmooth(p.x0, p.y0, tau);
    const m = 3.0 * p.s;
    const gx0 = Math.floor((Xs - m) / PG),
      gx1 = Math.ceil((Xs + m) / PG),
      gy0 = Math.floor((Ys - m) / PG),
      gy1 = Math.ceil((Ys + m) / PG);
    const gw = gx1 - gx0 + 1,
      gh = gy1 - gy0 + 1;
    if (gw < 2 || gh < 2) continue;
    const G = new Float32Array(gw * gh * 2);
    // once an eddy has stopped (t0 + life + 2 s) nothing moves: the trace starts there
    const t1 = Math.min(tau, p.t0 + p.life + 2.0);
    const n = Math.max(1, Math.ceil((t1 - p.t0) / PDTS));
    const dt = (t1 - p.t0) / n;
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const X = (gx0 + i) * PG,
          Y = (gy0 + j) * PG;
        let x = X,
          y = Y,
          t = t1;
        for (let k = 0; k < n; k++) {
          plumeVel(p, x, y, t, Xs, Ys);
          const hx = x - PVX * dt * 0.5,
            hy = y - PVY * dt * 0.5;
          plumeVel(p, hx, hy, t - dt * 0.5, Xs, Ys);
          x -= PVX * dt;
          y -= PVY * dt;
          t -= dt;
        }
        const o = (j * gw + i) * 2;
        G[o] = X - x;
        G[o + 1] = Y - y;
      }
    // rasterise (bilinear) at the field's samples
    const xa = Math.max(0, Math.ceil((gx0 * PG) / r - 0.5)),
      xb = Math.min(W - 1, Math.floor((gx1 * PG) / r - 0.5)),
      ya = Math.max(0, Math.ceil((gy0 * PG) / r - 0.5)),
      yb = Math.min(H - 1, Math.floor((gy1 * PG) / r - 0.5));
    for (let y = ya; y <= yb; y++) {
      const gy = ((y + 0.5) * r) / PG - gy0;
      const jj = Math.max(0, Math.min(gh - 2, Math.floor(gy)));
      const fy = gy - jj;
      for (let x = xa; x <= xb; x++) {
        const gx = ((x + 0.5) * r) / PG - gx0;
        const ii = Math.max(0, Math.min(gw - 2, Math.floor(gx)));
        const fx = gx - ii;
        const a = (jj * gw + ii) * 2,
          b2 = a + 2,
          c = a + gw * 2,
          d2 = c + 2;
        const o = (y * W + x) * 2;
        PD[o] += (G[a] * (1 - fx) + G[b2] * fx) * (1 - fy) + (G[c] * (1 - fx) + G[d2] * fx) * fy;
        PD[o + 1] += (G[a + 1] * (1 - fx) + G[b2 + 1] * fx) * (1 - fy) + (G[c + 1] * (1 - fx) + G[d2 + 1] * fx) * fy;
      }
    }
    pdCache.any = true;
  }
  return pdCache;
}

// coarse back-traced flow maps of the smooth flow (full px): D = destination − source, every GS px
const GS = 32;
const GW = Math.ceil(1080 / GS) + 2,
  GH = Math.ceil(1920 / GS) + 2;
/** the flow map from t0 to t1 (back-traced from t1), on the coarse grid */
function flowMap(t0: number, t1: number, D: Float32Array): Float32Array {
  const span = t1 - t0;
  const n = Math.max(1, Math.ceil(span / DT));
  const dt = span / n;
  for (let j = 0; j < GH; j++)
    for (let i = 0; i < GW; i++) {
      const X = i * GS,
        Y = j * GS;
      let x = X,
        y = Y,
        t = t1;
      if (span > 0)
        for (let s = 0; s < n; s++) {
          velAt(x, y, t);
          const hx = x - V[0] * dt * 0.5,
            hy = y - V[1] * dt * 0.5;
          velAt(hx, hy, t - dt * 0.5);
          x -= V[0] * dt;
          y -= V[1] * dt;
          t -= dt;
        }
      const k = (j * GW + i) * 2;
      D[k] = X - x;
      D[k + 1] = Y - y;
    }
  return D;
}
const earlyCache = { tau: -1, D: new Float32Array(GW * GH * 2) };
const earlyMap = (tau: number) => {
  if (tau >= TAU_REL) return memo('s09:field:mapRel', () => flowMap(0, TAU_REL, new Float32Array(GW * GH * 2)));
  if (earlyCache.tau !== tau) {
    earlyCache.tau = tau;
    flowMap(0, tau, earlyCache.D);
  }
  return earlyCache.D;
};
const lateCache = { tau: -1, D: new Float32Array(GW * GH * 2) };
const lateMap = (tau: number) => {
  if (lateCache.tau !== tau) {
    lateCache.tau = tau;
    flowMap(TAU_REL, tau, lateCache.D);
  }
  return lateCache.D;
};

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

/** the field's peak optical density (display units) near the figure at the last drawn frame — the outline's cap */
const peak = { f: -1, v: 1.2 };
export const fieldPeak = (f: number) => (peak.f === f ? peak.v : 1.2);

/**
 * Draw the spreading ink at frame f (multiply). `gain` scales the optical density (light-table power, fades).
 */
export function drawInkField(ctx: CanvasRenderingContext2D, f: number, gain: number, hazeAmt: number): boolean {
  if (gain <= 0.003) return true;
  const tau = Math.max(0, (f - SNAP_F) / 30);
  const sigma = fieldSigma(tau);
  const r = resFor(sigma);
  const W = 1080 / r,
    H = 1920 / r;
  DEV.tick?.('f:start');
  const { rho, rho1 } = initialDensity(r);
  // the tributaries fade out over the hand-over (gone before the quarter-res switch at f498)
  const w1 = rho1 ? 1 - smoothstep(SNAP_F + 4, SNAP_F + 30, f) : 0;
  const RW_ = 1080 / r; // rho0 row length
  DEV.tick?.('f:rho0');
  const late = tau > TAU_REL;
  const D = earlyMap(Math.min(tau, TAU_REL));
  const DL = late ? lateMap(tau) : null;
  DEV.tick?.('f:flowmap');
  const PF = plumeField(tau, r);
  const PD = PF.PD;
  DEV.tick?.('f:eddies');
  // the figure (figure.ts): lens, clearing, wash — only once the lens has started
  const figOn = f >= INK_T.lens[0];
  const G = figOn ? figGrid() : null;
  DEV.tick?.('f:figGrid');
  const LD = figOn ? lensDelta(f) : null;
  const WG = figOn ? washGrid(f) : null;
  DEV.tick?.('f:lens');
  const ff = Math.min(f, INK_T.hold);
  const share = fieldShare(tau);
  // the figure's outline, let go: its ink joins this field (carried from the hold on by the late flow)
  const relG = late ? releaseGain(f) : 0;
  const REL = relG > 0.003 ? releaseDensityQ() : null;
  // after the let-go the wash (fresh, thin ink) is handed to the haze faster than the web's threads
  const washFade = late ? (fieldShare(tau) / fieldShare(TAU_REL)) * (1 - 0.65 * smoothstep(0, 2.4, tau - TAU_REL)) : 1;
  const out = memo('s09:fieldOut', () => ({ a: new Float32Array(1) }));
  if (out.a.length < W * H) out.a = new Float32Array(W * H);
  const R = out.a;
  const LXmax = LX0 + (LW - 1.001) * LG,
    LYmax = LY0 + (LH - 1.001) * LG;
  const pkRow = new Float32Array(LH); // paint gate per grid row (frame f, frozen at the hold)
  if (G) for (let k = 0; k < LH; k++) pkRow[k] = paintK(ff, LY0 + k * LG);
  const ymin = Math.ceil(SURFACE_Y / r);
  for (let y = 0; y < H; y++) {
    if (y < ymin) {
      R.fill(0, y * W, y * W + W);
      continue;
    }
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let X = (x + 0.5) * r,
        Y = (y + 0.5) * r;
      // 1. undo the eddies (the latest motion)
      if (PF.any) {
        X -= PD[i * 2];
        Y -= PD[i * 2 + 1];
      }
      // 2. after the let-go: trace back to τ_rel through the smooth flow
      if (DL) {
        const gx = Math.min(GW - 1.001, Math.max(0, X / GS)),
          gy = Math.min(GH - 1.001, Math.max(0, Y / GS));
        const i0 = gx | 0,
          j0 = gy | 0;
        const fx = gx - i0,
          fy = gy - j0;
        const k00 = (j0 * GW + i0) * 2,
          k10 = k00 + 2,
          k01 = k00 + GW * 2,
          k11 = k01 + 2;
        X -= (DL[k00] * (1 - fx) + DL[k10] * fx) * (1 - fy) + (DL[k01] * (1 - fx) + DL[k11] * fx) * fy;
        Y -= (DL[k00 + 1] * (1 - fx) + DL[k10 + 1] * fx) * (1 - fy) + (DL[k01 + 1] * (1 - fx) + DL[k11 + 1] * fx) * fy;
      }
      // 3. the figure (frame-fixed until the let-go, then carried with the water)
      const X0q = X / 4 - 0.5,
        Y0q = Y / 4 - 0.5;
      let dep = 0,
        wash = 0,
        inn = 0;
      if (G && WG && X > LX0 && X < LXmax && Y > LY0 && Y < LYmax) {
        const gx = (X - LX0) / LG,
          gy = (Y - LY0) / LG;
        const i0 = gx | 0,
          j0 = gy | 0;
        const fx = gx - i0,
          fy = gy - j0;
        const k00 = j0 * LW + i0,
          k10 = k00 + 1,
          k01 = k00 + LW,
          k11 = k01 + 1;
        const pg = pkRow[j0] * (1 - fy) + pkRow[j0 + 1] * fy;
        if (pg > 0.001) {
          dep = pg * ((G.dep[k00] * (1 - fx) + G.dep[k10] * fx) * (1 - fy) + (G.dep[k01] * (1 - fx) + G.dep[k11] * fx) * fy);
          wash = pg * ((WG[k00] * (1 - fx) + WG[k10] * fx) * (1 - fy) + (WG[k01] * (1 - fx) + WG[k11] * fx) * fy);
          inn = pg * ((G.inn[k00] * (1 - fx) + G.inn[k10] * fx) * (1 - fy) + (G.inn[k01] * (1 - fx) + G.inn[k11] * fx) * fy);
        }
        if (LD && LD.any) {
          X += (LD.dx[k00] * (1 - fx) + LD.dx[k10] * fx) * (1 - fy) + (LD.dx[k01] * (1 - fx) + LD.dx[k11] * fx) * fy;
          Y += (LD.dy[k00] * (1 - fx) + LD.dy[k10] * fx) * (1 - fy) + (LD.dy[k01] * (1 - fx) + LD.dy[k11] * fx) * fy;
        }
      }
      // 4. trace back to τ = 0 through the smooth flow
      {
        const gx = Math.min(GW - 1.001, Math.max(0, X / GS)),
          gy = Math.min(GH - 1.001, Math.max(0, Y / GS));
        const i0 = gx | 0,
          j0 = gy | 0;
        const fx = gx - i0,
          fy = gy - j0;
        const k00 = (j0 * GW + i0) * 2,
          k10 = k00 + 2,
          k01 = k00 + GW * 2,
          k11 = k01 + 2;
        X -= (D[k00] * (1 - fx) + D[k10] * fx) * (1 - fy) + (D[k01] * (1 - fx) + D[k11] * fx) * fy;
        Y -= (D[k00 + 1] * (1 - fx) + D[k10 + 1] * fx) * (1 - fy) + (D[k01 + 1] * (1 - fx) + D[k11 + 1] * fx) * fy;
      }
      // the tank's walls are far outside the frame: mirror at the sides and the bottom (no paper flows in)
      let sx = X / r - 0.5,
        sy = Y / r - 0.5;
      if (sx < 0) sx = -sx;
      else if (sx > W - 1.001) sx = 2 * (W - 1.001) - sx;
      if (sy > H - 1.001) sy = 2 * (H - 1.001) - sy;
      const xi = Math.floor(sx),
        yi = Math.floor(sy);
      let v = 0;
      if (xi >= 0 && yi >= 0 && xi < W - 1 && yi < H - 1) {
        const ax = sx - xi,
          ay = sy - yi;
        const b = yi * RW_ + xi;
        v = (rho[b] * (1 - ax) + rho[b + 1] * ax) * (1 - ay) + (rho[b + RW_] * (1 - ax) + rho[b + RW_ + 1] * ax) * ay;
        if (w1 > 0.002) v += w1 * ((rho1![b] * (1 - ax) + rho1![b + 1] * ax) * (1 - ay) + (rho1![b + RW_] * (1 - ax) + rho1![b + RW_ + 1] * ax) * ay);
      }
      // mass leaves the threads for the uniform haze (drawHaze grows by the same amount); inside the body the dense
      // knots of the web are thinned harder (no dark smudge survives in the figure)
      const vs = v * share;
      if (inn > 0.001 && vs > 0.5) dep = Math.min(0.95, dep + 0.2 * inn * smoothstep(0.5, 1.2, vs));
      R[i] = vs * (1 - dep) + wash * washFade;
      if (REL) {
        const qx = X0q - RQ.x0,
          qy = Y0q - RQ.y0;
        if (qx >= 0 && qy >= 0 && qx < RQ.w - 1.001 && qy < RQ.h - 1.001) {
          const ii = qx | 0,
            jj = qy | 0,
            ax = qx - ii,
            ay = qy - jj,
            b = jj * RQ.w + ii;
          R[i] += relG * ((REL[b] * (1 - ax) + REL[b + 1] * ax) * (1 - ay) + (REL[b + RQ.w] * (1 - ax) + REL[b + RQ.w + 1] * ax) * ay);
        }
      }
    }
  }
  DEV.tick?.('f:advect');
  // diffuse: σ ∝ √τ (molecular) + ∝ τ (the slow turbulent mixing of the tank)
  const pre = r === 2 ? 0 : r === 4 ? PRE_Q : PRE_E;
  const sig = Math.sqrt(Math.max(0, sigma * sigma - pre * pre)) / (r / 2);
  if (sig > 0.45) blurSigma(R, W, H, sig);
  DEV.tick?.('f:blur');
  // the ink's fate: the uniform haze of spent ink (inkfx.hazeAt: 1/8 resolution, bilinear), in the same density field
  if (hazeAmt > 0.002) {
    const HZ = hazeAt(f, hazeAmt / Math.max(0.003, gain));
    const k8 = r / 8;
    for (let y = ymin; y < H; y++) {
      const hy = Math.min(238.999, Math.max(0, (y + 0.5) * k8 - 0.5));
      const hj = hy | 0,
        hv = hy - hj;
      for (let x = 0; x < W; x++) {
        const hx = Math.min(133.999, Math.max(0, (x + 0.5) * k8 - 0.5));
        const hi = hx | 0,
          hu = hx - hi,
          ho = hj * 135 + hi;
        R[y * W + x] += (HZ[ho] * (1 - hu) + HZ[ho + 1] * hu) * (1 - hv) + (HZ[ho + 135] * (1 - hu) + HZ[ho + 136] * hu) * hv;
      }
    }
  }
  // Beer–Lambert → multiply; the peak near the figure (the outline's cap)
  const L = lut();
  const c = scratch(`fieldOut:${r}`, W, H);
  const g = ctxOf(c);
  const img = g.createImageData(W, H);
  const px = img.data;
  const lk = (LUT_N - 1) / LUT_MAX;
  const fx0 = Math.floor((FIG.cx - 160) / r),
    fx1 = Math.ceil((FIG.cx + 160) / r),
    fy0 = Math.floor((FIG_TOP + 25) / r),
    fy1 = Math.ceil((FIG.feet + 15) / r);
  let pk = 0;
  for (let y = 0; y < H; y++) {
    const inRows = y >= fy0 && y < fy1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const rr = R[i] * gain;
      if (inRows && x >= fx0 && x < fx1 && rr > pk) pk = rr;
      const li = Math.min(LUT_N - 1, (rr * lk) | 0) * 3;
      const o = i * 4;
      px[o] = L[li];
      px[o + 1] = L[li + 1];
      px[o + 2] = L[li + 2];
      px[o + 3] = 255;
    }
  }
  peak.f = f;
  peak.v = pk;
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, W, H, 0, 0, 1080, 1920);
  ctx.restore();
  return true;
}

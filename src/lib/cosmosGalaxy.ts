// Galaxies for the cosmos module (see the API header in ./cosmos.tsx):
//   drawGalaxy  — a single spiral. Unresolved light is analytic (exponential disc × log-spiral density wave with
//                 clumpy star clouds and flocculent spurs, bar, Sérsic bulge) with 2–3 broken, feathered Beer–Lambert
//                 dust filaments per arm; RESOLVED stars are sharp points that carry a real share of the flux (≈ 35 %
//                 at hero sizes): old disc / bulge stars on a FLAT rotation curve, young blue associations and pink HII
//                 knots born in the arms that age and drift through them (so the pattern persists at any t).
//   drawMerger  — two disc galaxies on a parabolic encounter: a restricted N-body integration (Toomre & Toomre 1972)
//                 of dispersion-supported discs + bulges with dynamical friction, precomputed once (memo) and indexed by
//                 progress p ∈ [0, 1]. Light = a density field (two-scale KDE, so tails stay smooth and continuous);
//                 particles are drawn only as sharp point stars; spiral arms are a density wave (no winding rings).
// Rendering: the unresolved light goes into a low-res float buffer (tone-mapped, then upscaled by the canvas),
// stars into a device-res point buffer; both composited ADDITIVELY ('lighter'). Pure functions of the inputs.
import { clamp, lerp, memo, smoothstep } from './math';
import { mulberry32 } from './random';
import { PointSplat, ctx2d } from './cosmosDraw';

type RGB = readonly [number, number, number];
const TAU = Math.PI * 2;
const hexLin = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [Math.pow(((n >> 16) & 255) / 255, 2.2), Math.pow(((n >> 8) & 255) / 255, 2.2), Math.pow((n & 255) / 255, 2.2)];
};

export interface GalaxyPaletteDef {
  /** bulge / old-star light */
  core: string;
  /** smooth disc light */
  disc: string;
  /** young arm stars */
  young: string;
  /** star-forming knots */
  hii: string;
  /** dissolved hot gas (rewind) */
  gas: string;
  /** weight of the unresolved smooth light (default 1) */
  smooth: number;
  /** weight of the particle stars (default 1) */
  dots: number;
  /** dust-lane strength (default 1) */
  dust: number;
}
export const GALAXY_PALETTES = {
  /** photographic: warm old bulge, blue young arms, pink HII regions, brown dust */
  natural: { core: '#FFD9A0', disc: '#E8DCCB', young: '#9DB8FF', hii: '#FF7FA8', gas: '#FF8A4A', smooth: 1, dots: 1, dust: 1 },
  /** S03: monochrome amber data-vis Milky Way (more dots, less photo) */
  amber: { core: '#FFE3A3', disc: '#FF9F2E', young: '#FFC56B', hii: '#FFF1D0', gas: '#FF7A3D', smooth: 0.55, dots: 1.5, dust: 0.7 },
  /** the web palette (S04 / S09): blue-white nodes, violet gas */
  cool: { core: '#E4EEFF', disc: '#A3AEFF', young: '#6E95FF', hii: '#C9A8FF', gas: '#8E5BFF', smooth: 0.9, dots: 1.1, dust: 0.9 },
  /** hot young universe: everything already warm (for the rewind into plasma) */
  ember: { core: '#FFE2B0', disc: '#FF9A55', young: '#FFD08A', hii: '#FFF0D0', gas: '#FF7A3D', smooth: 1, dots: 0.9, dust: 0.5 },
} satisfies Record<string, GalaxyPaletteDef>;
export type GalaxyPaletteName = keyof typeof GALAXY_PALETTES;

interface PalLin {
  core: RGB;
  disc: RGB;
  young: RGB;
  hii: RGB;
  gas: RGB;
  smooth: number;
  dots: number;
  dust: number;
}
function palLin(p: GalaxyPaletteName | GalaxyPaletteDef | undefined): PalLin {
  const d: GalaxyPaletteDef = typeof p === 'object' ? p : GALAXY_PALETTES[p ?? 'natural'];
  return memo(`cosmos:pal:${d.core}${d.disc}${d.young}${d.hii}${d.gas}${d.smooth}${d.dots}${d.dust}`, () => ({
    core: hexLin(d.core),
    disc: hexLin(d.disc),
    young: hexLin(d.young),
    hii: hexLin(d.hii),
    gas: hexLin(d.gas),
    smooth: d.smooth,
    dots: d.dots,
    dust: d.dust,
  }));
}

// ───────────────────────── buffers: low-res light + device-res stars ─────────────────────────
interface Buf {
  /** logical origin + size of the buffer region */
  ox: number;
  oy: number;
  lw: number;
  lh: number;
  /** device px per logical px */
  s: number;
  /** device size of the region (stars) */
  W: number;
  H: number;
  /** low-res light buffer: device px per light px, size, linear RGB, dust optical depth */
  div: number;
  hW: number;
  hH: number;
  L: Float32Array;
  T: Float32Array;
  /** star buffer (display-space RGBA bytes, row stride SW) */
  SW: number;
  img: ImageData;
  sd: Uint8ClampedArray;
  starsUsed: boolean;
  /** pixel index of every star footprint (negative = with the 4×4 halo), for the alpha fix-up */
  rec: Int32Array;
  nRec: number;
}
const recPool = { a: new Int32Array(1 << 15) };
/** the pooled record array, grown (contents kept) to hold at least n entries */
function starRec(n: number): Int32Array {
  if (recPool.a.length < n) {
    const a = new Int32Array(Math.max(n, recPool.a.length * 2));
    a.set(recPool.a);
    recPool.a = a;
  }
  return recPool.a;
}
const pool = { L: new Float32Array(0), T: new Float32Array(0), A: new Float32Array(0), C: new Float32Array(0), Lc: new Float32Array(0), Cn: new Float32Array(0), arm: new Float32Array(0), tmp: new Float32Array(0) };
function f32(name: keyof typeof pool, n: number): Float32Array {
  if (pool[name].length < n) pool[name] = new Float32Array(n);
  return pool[name];
}
/** a light buffer over a logical region; `lightPx` = target size of the low-res buffer's longer side */
function getBuf(ox: number, oy: number, lw: number, lh: number, s: number, lightPx: number): Buf {
  const W = Math.max(2, Math.ceil(lw * s)),
    H = Math.max(2, Math.ceil(lh * s));
  const div = Math.max(1, Math.max(W, H) / lightPx);
  const hW = Math.max(2, Math.ceil(W / div)),
    hH = Math.max(2, Math.ceil(H / div));
  const L = f32('L', hW * hH * 3),
    T = f32('T', hW * hH);
  L.fill(0, 0, hW * hH * 3);
  T.fill(0, 0, hW * hH);
  // star buffer: one pooled ImageData (grown on demand), used through a dirty rect
  const sp = memo('cosmos:galstars', () => ({ img: null as ImageData | null }));
  if (!sp.img || sp.img.width < W || sp.img.height < H) {
    const c = scratchCan('galstars', Math.max(W, sp.img?.width ?? 0), Math.max(H, sp.img?.height ?? 0));
    sp.img = ctx2d(c).createImageData(c.width, c.height);
  }
  const img = sp.img;
  const SW = img.width;
  const sd = img.data;
  // transparent black; after the stars are added, only the touched pixels get their alpha (see resolve)
  const u32 = new Uint32Array(sd.buffer, sd.byteOffset, sd.length >> 2);
  for (let y = 0; y < H; y++) u32.fill(0, y * SW, y * SW + W);
  return { ox, oy, lw, lh, s: W / lw, W, H, div, hW, hH, L, T, SW, img, sd, starsUsed: false, rec: starRec(0), nRec: 0 };
}
function scratchCan(name: string, w: number, h: number): HTMLCanvasElement {
  const c = memo(`cosmos:gscratch:${name}`, () => document.createElement('canvas'));
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}
/** bilinear splat of linear light into the low-res buffer (logical coords) */
function splatL(b: Buf, x: number, y: number, r: number, g: number, bl: number, L = b.L) {
  const fx = ((x - b.ox) * b.s) / b.div - 0.5,
    fy = ((y - b.oy) * b.s) / b.div - 0.5;
  const ix = Math.floor(fx),
    iy = Math.floor(fy);
  if (ix < 0 || iy < 0 || ix >= b.hW - 1 || iy >= b.hH - 1) return;
  const tx = fx - ix,
    ty = fy - iy;
  const w00 = (1 - tx) * (1 - ty),
    w10 = tx * (1 - ty),
    w01 = (1 - tx) * ty,
    w11 = tx * ty;
  let k = (iy * b.hW + ix) * 3;
  L[k] += r * w00;
  L[k + 1] += g * w00;
  L[k + 2] += bl * w00;
  L[k + 3] += r * w10;
  L[k + 4] += g * w10;
  L[k + 5] += bl * w10;
  k += b.hW * 3;
  L[k] += r * w01;
  L[k + 1] += g * w01;
  L[k + 2] += bl * w01;
  L[k + 3] += r * w11;
  L[k + 4] += g * w11;
  L[k + 5] += bl * w11;
}
/** gaussian blob of linear light into the low-res buffer (radius in logical px) */
function blobL(b: Buf, x: number, y: number, rad: number, r: number, g: number, bl: number) {
  const k = b.s / b.div;
  const X = (x - b.ox) * k - 0.5,
    Y = (y - b.oy) * k - 0.5,
    R = Math.max(0.6, rad * k);
  const x0 = Math.max(0, Math.floor(X - 2.5 * R)),
    x1 = Math.min(b.hW - 1, Math.ceil(X + 2.5 * R));
  const y0 = Math.max(0, Math.floor(Y - 2.5 * R)),
    y1 = Math.min(b.hH - 1, Math.ceil(Y + 2.5 * R));
  const inv = 1 / (R * R);
  const norm = 1 / (Math.PI * R * R);
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const w = Math.exp(-((xx - X) ** 2 + (yy - Y) ** 2) * inv) * norm;
      if (w < 1e-4) continue;
      const q = (yy * b.hW + xx) * 3;
      b.L[q] += r * w;
      b.L[q + 1] += g * w;
      b.L[q + 2] += bl * w;
    }
}
/** dust optical depth at a logical point (nearest low-res px) */
function tauAt(b: Buf, x: number, y: number): number {
  const ix = Math.floor(((x - b.ox) * b.s) / b.div),
    iy = Math.floor(((y - b.oy) * b.s) / b.div);
  if (ix < 0 || iy < 0 || ix >= b.hW || iy >= b.hH) return 0;
  return b.T[iy * b.hW + ix];
}
const TONE = memo('cosmos:tone', () => {
  const N = 4096;
  const t = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) {
    // filmic shoulder + a toe so faint light fades to true black (no gamma-lifted halos)
    const v = i / 400;
    const x = (v * v) / (v + 0.03);
    t[i] = Math.round(255 * Math.pow(1 - Math.exp(-x), 1 / 2.2));
  }
  return t;
});
/**
 * A sharp star at logical (x, y): linear radiance (r, g, b) concentrated in one device px (plus a 3×3 core for the
 * brightest), tone-mapped on its own and added in display space.
 */
function starPt(b: Buf, x: number, y: number, r: number, g: number, bl: number, exposure: number) {
  const fx = (x - b.ox) * b.s - 0.5,
    fy = (y - b.oy) * b.s - 0.5;
  const ix = Math.floor(fx),
    iy = Math.floor(fy);
  if (ix < 1 || iy < 1 || ix >= b.W - 2 || iy >= b.H - 2) return;
  const k = 400 * exposure;
  const tx = fx - ix,
    ty = fy - iy;
  const mx = Math.max(r, g, bl) * k;
  // energy into the 2×2 bilinear footprint; very bright stars also bloom into a 4×4 halo
  const wts = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const offs = [0, 1, b.SW, b.SW + 1];
  const base = (iy * b.SW + ix) * 4;
  const sd = b.sd;
  for (let q = 0; q < 4; q++) {
    const w = wts[q] * 1.6;
    const o = base + offs[q] * 4;
    sd[o] += TONE[Math.min(4095, (r * k * w) | 0)];
    sd[o + 1] += TONE[Math.min(4095, (g * k * w) | 0)];
    sd[o + 2] += TONE[Math.min(4095, (bl * k * w) | 0)];
  }
  const halo = mx > 3000;
  if (b.nRec >= b.rec.length) b.rec = starRec(b.nRec + 1);
  b.rec[b.nRec++] = halo ? -(iy * b.SW + ix) - 1 : iy * b.SW + ix;
  if (halo) {
    const h = Math.min(1, (mx - 3000) / 20000) * 0.35;
    for (const [dx, dy] of [
      [-1, 0],
      [2, 0],
      [0, -1],
      [0, 2],
      [-1, 1],
      [2, 1],
      [1, -1],
      [1, 2],
    ]) {
      const o = base + (dy * b.SW + dx) * 4;
      sd[o] += TONE[Math.min(4095, (r * k * h) | 0)];
      sd[o + 1] += TONE[Math.min(4095, (g * k * h) | 0)];
      sd[o + 2] += TONE[Math.min(4095, (bl * k * h) | 0)];
    }
  }
  b.starsUsed = true;
}
/** tone-map the low-res light (with dust extinction) and the stars, composite both additively onto ctx */
function resolve(ctx: CanvasRenderingContext2D, b: Buf, exposure: number, alpha: number) {
  if (alpha <= 0.002) return;
  const { hW, hH, L, T } = b;
  const lc = scratchCan('gallight', hW, hH);
  const lx = ctx2d(lc);
  const img = lx.createImageData(hW, hH);
  const d = img.data;
  const k = 400 * exposure;
  for (let i = 0, n = hW * hH; i < n; i++) {
    const tau = T[i];
    // dust reddens: blue absorbed more than red
    const r = L[i * 3] * (tau > 0 ? Math.exp(-tau * 0.75) : 1),
      g = L[i * 3 + 1] * (tau > 0 ? Math.exp(-tau * 0.92) : 1),
      bb = L[i * 3 + 2] * (tau > 0 ? Math.exp(-tau * 1.12) : 1);
    const R8 = TONE[Math.min(4095, (r * k) | 0)],
      G8 = TONE[Math.min(4095, (g * k) | 0)],
      B8 = TONE[Math.min(4095, (bb * k) | 0)];
    // un-premultiplied colour + alpha = max channel → exact additive result under 'lighter', transparent where dark
    const a8 = R8 > G8 ? (R8 > B8 ? R8 : B8) : G8 > B8 ? G8 : B8;
    const o = i * 4;
    if (a8 === 0) continue;
    const ia = 255 / a8;
    d[o] = R8 * ia;
    d[o + 1] = G8 * ia;
    d[o + 2] = B8 * ia;
    d[o + 3] = a8;
  }
  lx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lc, 0, 0, hW, hH, b.ox, b.oy, (hW * b.div) / b.s, (hH * b.div) / b.s);
  if (b.starsUsed) {
    // un-premultiplied colour + alpha = max channel, on the touched pixels only → exact additive result under
    // 'lighter' on ANY canvas (a transparent CanvasLayer stays transparent around the stars)
    const sd = b.sd,
      SW = b.SW;
    const fix = (q: number) => {
      const o = q * 4;
      if (sd[o + 3] !== 0) return;
      const m = Math.max(sd[o], sd[o + 1], sd[o + 2]);
      if (m === 0) return;
      const ia = 255 / m;
      sd[o] *= ia;
      sd[o + 1] *= ia;
      sd[o + 2] *= ia;
      sd[o + 3] = m;
    };
    for (let i = 0; i < b.nRec; i++) {
      const v = b.rec[i];
      const q = v < 0 ? -v - 1 : v;
      fix(q);
      fix(q + 1);
      fix(q + SW);
      fix(q + SW + 1);
      if (v < 0) {
        fix(q - 1);
        fix(q + 2);
        fix(q - SW);
        fix(q + 2 * SW);
        fix(q + SW - 1);
        fix(q + SW + 2);
        fix(q - SW + 1);
        fix(q + 2 * SW + 1);
      }
    }
    const sc = scratchCan('galstars', b.img.width, b.img.height);
    ctx2d(sc).putImageData(b.img, 0, 0, 0, 0, b.W, b.H);
    ctx.drawImage(sc, 0, 0, b.W, b.H, b.ox, b.oy, b.W / b.s, b.H / b.s);
  }
  ctx.restore();
}
function deviceScale(ctx: CanvasRenderingContext2D) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}
/** separable box blur of an n-channel float grid, `passes` × radius R (3 passes ≈ gaussian, σ² = R(R+1)); clamped edges */
function boxBlur(A: Float32Array, W: number, H: number, ch: number, R: number, passes = 3) {
  if (R < 1) return;
  const M = Math.max(W, H);
  const tmp = f32('tmp', M + 2 * R + 2);
  const inv = 1 / (2 * R + 1);
  // one line (stride st, length n) at a time: copy with clamped padding, then a running sum
  const line = (o: number, st: number, n: number) => {
    const v0 = A[o],
      vn = A[o + (n - 1) * st];
    for (let i = 0; i < R; i++) tmp[i] = v0;
    for (let i = 0, q = o; i < n; i++, q += st) tmp[R + i] = A[q];
    for (let i = 0; i <= R; i++) tmp[R + n + i] = vn;
    let acc = 0;
    for (let i = 0; i <= 2 * R; i++) acc += tmp[i];
    for (let i = 0, q = o; i < n; i++, q += st) {
      A[q] = acc * inv;
      acc += tmp[i + 2 * R + 1] - tmp[i];
    }
  };
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) for (let c = 0; c < ch; c++) line(y * W * ch + c, ch, W);
    for (let x = 0; x < W; x++) for (let c = 0; c < ch; c++) line(x * ch + c, W * ch, H);
  }
}

/** 64×64 periodic value-noise table (16×16 lattice, bilinear) — the cheap noise of the analytic galaxy */
const DNOISE = memo('cosmos:dnoise', () => {
  const N = 64;
  const t = new Float32Array(N * N);
  const r = mulberry32(4242);
  const lat = new Float32Array(256);
  for (let i = 0; i < 256; i++) lat[i] = r();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const gx = x / 4,
        gy = y / 4;
      const i0 = Math.floor(gx),
        j0 = Math.floor(gy);
      const fx = gx - i0,
        fy = gy - j0;
      const ux = fx * fx * (3 - 2 * fx),
        uy = fy * fy * (3 - 2 * fy);
      const Lt = (i: number, j: number) => lat[(j & 15) * 16 + (i & 15)];
      const a = Lt(i0, j0),
        b = Lt(i0 + 1, j0),
        c = Lt(i0, j0 + 1),
        d = Lt(i0 + 1, j0 + 1);
      t[y * N + x] = a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }
  return t;
});
/** smoothstep, local so the hot loops inline it */
function ss(a: number, b: number, x: number) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
/** periodic noise (lattice spacing 1, period 16), 0..1 */
function dn(x: number, y: number): number {
  const u = x * 4,
    v = y * 4;
  const ix = Math.floor(u),
    iy = Math.floor(v);
  const fx = u - ix,
    fy = v - iy;
  const x0 = ix & 63,
    y0 = iy & 63;
  const x1 = (x0 + 1) & 63,
    y1 = (y0 + 1) & 63;
  const t = DNOISE;
  const a = t[y0 * 64 + x0],
    b = t[y0 * 64 + x1],
    c = t[y1 * 64 + x0],
    d = t[y1 * 64 + x1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// ───────────────────────── single spiral galaxy ─────────────────────────
export interface GalaxyOpts {
  /** centre, logical px */
  cx: number;
  cy: number;
  /** disc radius in px (light extends to ~1.2 R; arms reach ~R) */
  radius: number;
  /** inclination in rad: 0 = face-on, π/2 = edge-on (default 0.9) */
  tilt?: number;
  /** position angle of the major axis on screen, rad (default 0) */
  angle?: number;
  /** number of arms (default 2) */
  arms?: number;
  /** bar strength 0..1 (Milky Way ≈ 0.6; default 0) */
  bar?: number;
  /** arm pitch angle in rad (default 0.36 ≈ 21°; smaller = more tightly wound) */
  pitch?: number;
  seed?: number;
  /** seconds: rotation (flat curve) + birth/ageing of arm stars */
  t?: number;
  /** angular speed at r = R in rad/s (default 0.045; negative = clockwise) */
  spin?: number;
  /** particle (resolved star) count (default 2500 + 45·radius) */
  n?: number;
  palette?: GalaxyPaletteName | GalaxyPaletteDef;
  /** overall brightness / opacity (default 1) */
  alpha?: number;
  /** 0..1 rewind: stars un-light into glowing gas knots, arms smear, all becomes smooth warm gas */
  dissolve?: number;
  /** tone-map exposure (default 1) */
  exposure?: number;
  /** share of the light in resolved stars (default: 0.12 for small galaxies → 0.34 at radius ≥ 280 px) */
  resolved?: number;
}

interface GalaxyParticles {
  n: number;
  r: Float32Array; // radius (R units)
  th: Float32Array; // phase
  z: Float32Array; // height (R units)
  kind: Uint8Array; // 0 old disc, 1 young arm star, 2 HII knot, 3 bulge, 4 bar
  mag: Float32Array; // relative flux (power-law luminosity function)
  ph: Float32Array; // life phase 0..1
  sm: Float32Array; // dissolve smear random
  magSum: Float32Array; // Σ mag per kind
}
function galaxyParticles(seed: number, n: number, arms: number, bar: number, pitch: number): GalaxyParticles {
  return memo(`cosmos:gal2:${seed}:${n}:${arms}:${bar}:${pitch}`, () => {
    const r = mulberry32(seed * 7919 + 17);
    const g = () => r() + r() + r() - 1.5;
    const P: GalaxyParticles = {
      n,
      r: new Float32Array(n),
      th: new Float32Array(n),
      z: new Float32Array(n),
      kind: new Uint8Array(n),
      mag: new Float32Array(n),
      ph: new Float32Array(n),
      sm: new Float32Array(n),
      magSum: new Float32Array(5),
    };
    const tp = Math.tan(pitch);
    // young stars come in associations: shared birth place on an arm, small spread
    let assoc = { rad: 0.5, th: 0, left: 0, kind: 1 };
    for (let i = 0; i < n; i++) {
      const u = r();
      let kind = u < 0.46 ? 0 : u < 0.76 ? 1 : u < 0.84 ? 2 : u < 0.97 ? 3 : 4;
      if (kind === 4 && bar < 0.05) kind = 3;
      let rad: number, th: number, z: number;
      if (kind === 3) {
        // bulge: ~Sérsic, spherical-ish
        rad = 0.16 * Math.pow(-Math.log(1 - r() * 0.98), 1.6) * 0.5;
        th = r() * TAU;
        z = g() * rad * 0.7;
      } else if (kind === 4) {
        rad = (r() * 2 - 1) * 0.32 * bar;
        th = 0;
        z = g() * 0.02;
      } else if (kind === 0) {
        // exponential disc r = −h ln u (h = 0.3 R), truncated
        do rad = -0.3 * Math.log(1 - r() * 0.985);
        while (rad > 1.25);
        th = r() * TAU;
        z = g() * 0.035;
      } else {
        if (assoc.left <= 0 || assoc.kind !== kind) {
          // star formation lives out in the arms (the inner disc is old and yellow): roughly uniform in radius
          const rr = 0.2 + 0.92 * Math.pow(r(), 0.85);
          const arm = Math.floor(r() * arms);
          // HII knots sit just downstream of the dust lane, young stars spread across the arm
          const width = kind === 2 ? 0.07 : 0.2;
          assoc = { rad: rr, th: (arm / arms) * TAU + Math.log(rr / 0.18) / tp + g() * width * (0.7 + 0.6 * rr), left: kind === 2 ? 3 + Math.floor(r() * 6) : 4 + Math.floor(r() * 14), kind };
        }
        assoc.left--;
        const spread = kind === 2 ? 0.012 : 0.03;
        rad = Math.max(0.12, assoc.rad + g() * spread * 1.4);
        th = assoc.th + (g() * spread * 1.4) / Math.max(rad, 0.15);
        z = g() * 0.012;
      }
      P.r[i] = rad;
      P.th[i] = th;
      P.z[i] = z;
      P.kind[i] = kind;
      // power-law luminosity function: many faint stars, a few very bright ones
      const lf = Math.min(60, Math.pow(Math.max(1e-4, r()), -0.72));
      P.mag[i] = lf * (kind === 1 ? 1.6 : kind === 2 ? 1.2 : kind === 3 ? 0.05 : kind === 4 ? 0.08 : 0.2);
      P.magSum[kind] += P.mag[i];
      P.ph[i] = r();
      P.sm[i] = r();
    }
    return P;
  });
}

/**
 * Draw a spiral galaxy additively onto `ctx` (logical px; works inside a scaled CanvasLayer).
 * Cost ≈ 10–25 ms (radius 200) … 35–60 ms (radius 400) at scale 1.
 */
export function drawGalaxy(ctx: CanvasRenderingContext2D, o: GalaxyOpts) {
  const { cx, cy, radius: R, tilt = 0.9, angle = 0, arms = 2, bar = 0, pitch = 0.36, seed = 1, t = 0, spin = 0.045, n = Math.round(2500 + 45 * o.radius), alpha = 1, dissolve = 0, exposure = 1 } = o;
  if (alpha <= 0.002 || R < 1) return;
  const pal = palLin(o.palette);
  const P = galaxyParticles(seed, n, arms, bar, pitch);
  const ds = deviceScale(ctx);
  const dis = clamp(dissolve);
  const ext = R * 1.32 * (1 + 0.25 * dis);
  const s = Math.min(ds, 1000 / (2 * ext));
  const b = getBuf(cx - ext, cy - ext, 2 * ext, 2 * ext, s, Math.min(320, Math.max(120, 2 * ext * s * 0.36)));
  const ct = Math.cos(tilt),
    st = Math.sin(tilt),
    ca = Math.cos(angle),
    sa = Math.sin(angle);
  const ctc = Math.max(Math.abs(ct), 0.1);
  const tp = Math.tan(pitch);
  const Om = spin; // rad/s at r = 1 (flat curve: Ω(r) = spin / max(r, rc))
  const rc = 0.12;
  const patt = Om * 0.75 * t; // pattern rotation
  const proj = (x: number, y: number, z: number): [number, number] => {
    const y2 = y * ct - z * st;
    return [cx + (x * ca - y2 * sa) * R, cy + (x * sa + y2 * ca) * R];
  };
  const sm = pal.smooth;
  const keep = 1 - dis;
  const armAmp = 0.95 * keep;
  const clK = keep * keep;
  const hd = 0.3 * (1 + 0.35 * dis);
  const barK = bar * keep;
  const barA = patt + 0.6;
  const cbA = Math.cos(barA),
    sbA = Math.sin(barA);
  const dustK = pal.dust * keep * keep * (o.palette === 'amber' ? 0.55 : 1);
  const tpS = Math.tan(1.05); // flocculent spurs: much more open than the arms
  const sx = seed * 3.17,
    sy = seed * 1.91;
  const { hW, hH, L, T } = b;
  const hs = b.s / b.div;
  let flux = 0;
  // ── 1. unresolved light + dust (analytic, low res; the hot loop is hand-inlined: it runs on a cold page per still)
  const rOut = 1.32 * (1 + 0.25 * dis);
  const ctb = Math.max(Math.abs(ct), 0.65);
  const iR = 1 / R,
    ihd = 1 / hd,
    itp = 1 / tp,
    itpS = 1 / tpS;
  const barW = 1 / (0.3 * 0.3 * bar * bar + 0.001);
  const edge1 = 1.25 * (1 + 0.2 * dis);
  const tiltK = 1 + 1.2 * (1 - ctc);
  // the three dust filaments sit at fixed phase offsets behind the arm's light ridge
  const D1c = Math.cos(0.62),
    D1s = Math.sin(0.62),
    D2c = Math.cos(0.95),
    D2s = Math.sin(0.95),
    D3c = Math.cos(1.32),
    D3s = Math.sin(1.32);
  const pdr = pal.disc[0],
    pdg = pal.disc[1],
    pdb = pal.disc[2],
    pcr = pal.core[0],
    pcg = pal.core[1],
    pcb = pal.core[2],
    pyr = pal.young[0],
    pyg = pal.young[1],
    pyb = pal.young[2];
  const cc0 = lerp(pal.core[0], pal.gas[0], dis),
    cc1 = lerp(pal.core[1], pal.gas[1], dis),
    cc2 = lerp(pal.core[2], pal.gas[2], dis);
  for (let y = 0; y < hH; y++) {
    const ly = b.oy + (y + 0.5) / hs - cy;
    for (let x = 0; x < hW; x++) {
      const lx = b.ox + (x + 0.5) / hs - cx;
      // undo screen rotation, deproject the disc
      const X = (lx * ca + ly * sa) * iR,
        yr = (-lx * sa + ly * ca) * iR;
      const Y = yr / ctc;
      const r = Math.sqrt(X * X + Y * Y);
      const Yb = yr / ctb;
      const rb = Math.sqrt(X * X + Yb * Yb);
      if (r > rOut && rb > 0.6) continue;
      // bulge: less flattened than the disc
      const q4 = Math.sqrt(Math.sqrt(rb / 0.075));
      const bulge = Math.exp(-q4 * q4 * q4) * 2.6 + Math.exp(-rb / 0.12) * 0.32;
      let barL = 0;
      if (barK > 0.01) {
        const xb = X * cbA + Y * sbA,
          yb = -X * sbA + Y * cbA;
        barL = barK * 1.3 * Math.exp(-xb * xb * barW - (yb * yb) / 0.004);
      }
      const k = (y * hW + x) * 3;
      let cr = 0,
        cg = 0,
        cb = 0,
        tau = 0;
      if (r < rOut) {
        const th = Math.atan2(Y, X) - patt;
        const lr = Math.log((r > 0.04 ? r : 0.04) / 0.18);
        const phase = arms * (th - lr * itp);
        const disc = Math.exp(-r * ihd) * (1 - ss(0.78, edge1, r));
        const cph = Math.cos(phase),
          sph = Math.sin(phase);
        const w1 = 0.5 + 0.5 * cph;
        const wave = w1 * w1 * w1;
        const armMask = ss(0.08, 0.28, r) * (1 - ss(0.92, 1.3, r));
        // star clouds: 3-octave noise in the (rigidly rotating) pattern frame
        const Xp = r * Math.cos(th),
          Yp = r * Math.sin(th);
        const n1 = dn(Xp * 7 + sx, Yp * 7 + sy),
          n2 = dn(Xp * 17 + 5.3, Yp * 17 + sx),
          n3 = dn(Xp * 41 + sy, Yp * 41 + 2.7);
        const clump = n1 * 0.5 + n2 * 0.32 + n3 * 0.18;
        const cl = ss(0.38, 0.78, clump);
        // flocculent spurs leaving the arms at a large pitch, broken up by the clouds
        const phS = 2 * arms * (th - lr * itpS) + 2.2 * n1;
        const cS = Math.cos(phS),
          sS = Math.sin(phS);
        const ws = 0.5 + 0.5 * cS;
        const ws2 = ws * ws;
        const spur = ws2 * ws2 * ws * ss(0.42, 0.7, n2) * armMask;
        const base = disc * (0.3 + 0.45 * clK * (clump - 0.5));
        const armL = disc * armMask * armAmp * (wave * (0.25 + 2.6 * cl * cl * clK + 0.6 * (1 - clK)) + spur * 0.55 * clK);
        const dI = (base + armL) * 0.55 * sm;
        // arms glow in young-star colour, the inner disc in old-star colour
        let yw = armL / (base + armL + 1e-6);
        yw = (yw > 1 ? 1 : yw) * ss(0.12, 0.45, r);
        const ow = 1 - ss(0.1, 0.45, r);
        cr = (pdr + (pcr - pdr) * ow + (pyr - (pdr + (pcr - pdr) * ow)) * yw) * dI;
        cg = (pdg + (pcg - pdg) * ow + (pyg - (pdg + (pcg - pdg) * ow)) * yw) * dI;
        cb = (pdb + (pcb - pdb) * ow + (pyb - (pdb + (pcb - pdb) * ow)) * yw) * dI;
        if (dustK > 0 && armMask > 0.001) {
          // 2–3 feathered, broken dust filaments hugging the inner (concave) edge of each arm + dark feathers + patches;
          // all filaments meander together (wob) and break up along the arm (nb)
          const wob = (n2 - 0.5) * 0.7;
          const cw = Math.cos(wob),
            sw = Math.sin(wob);
          const cp = cph * cw - sph * sw,
            sp = sph * cw + cph * sw;
          const c1 = cp * D1c - sp * D1s,
            c2 = cp * D2c - sp * D2s,
            c3 = cp * D3c - sp * D3s;
          const nb = dn(lr * 6 + 1.1, phase * 0.18 + sx);
          let lanes = 0;
          if (c1 > 0.6) lanes += Math.exp(28 * (c1 - 1)) * ss(0.36, 0.6, nb);
          if (c2 > 0.75) lanes += Math.exp(60 * (c2 - 1)) * ss(0.3, 0.55, 1 - nb * 0.7 + n3 * 0.3) * 0.85;
          if (c3 > 0.8) lanes += Math.exp(90 * (c3 - 1)) * ss(0.4, 0.66, nb * 0.6 + n1 * 0.4) * 0.65;
          // dark feathers: the spur pattern shifted by ~80°
          const wf = 0.5 + 0.5 * (cS * 0.17 - sS * 0.985);
          const wf2 = wf * wf;
          const dSpur = wf2 * wf2 * wf2 * (1 - cl) * 0.45;
          const patch = ss(0.5, 0.78, n3 * 0.6 + n2 * 0.4) * 0.35;
          tau = dustK * armMask * Math.exp(-r / 0.7) * (lanes * 2.6 + dSpur + patch) * tiltK;
        }
        if (dis > 0) {
          const gl = (disc * 0.7 + bulge * 0.15) * dis * sm;
          cr += (pal.gas[0] * gl - cr) * dis;
          cg += (pal.gas[1] * gl - cg) * dis;
          cb += (pal.gas[2] * gl - cb) * dis;
        }
      }
      const cI = (bulge + barL) * 0.45 * sm * (1 - 0.5 * dis);
      const lr0 = cr + cc0 * cI,
        lg0 = cg + cc1 * cI,
        lb0 = cb + cc2 * cI;
      L[k] = lr0;
      L[k + 1] = lg0;
      L[k + 2] = lb0;
      T[y * hW + x] = tau;
      flux += lr0 + lg0 + lb0;
    }
  }
  // ── 2. resolved stars: a real share of the light (power-law luminosity function → a few dominate)
  const resolved = o.resolved ?? 0.12 + 0.22 * smoothstep(110, 280, R);
  const fracK = (resolved / Math.max(0.05, 1 - resolved)) * pal.dots;
  // light flux per low-res px → per logical px²: × (div/s)²; a star's radiance = its flux × s² (one device px)
  const pxArea = (b.div / b.s) ** 2;
  const totalSmooth = (flux / 3) * pxArea;
  const magTot = P.magSum[0] + P.magSum[1] * 0.55 + P.magSum[2] * 0.45 + P.magSum[3] + P.magSum[4];
  const perMag = (fracK * totalSmooth) / Math.max(1e-6, magTot);
  const starK = Math.pow(keep, 1.6);
  const rad2 = b.s * b.s;
  // knots of glowing gas (the rewind: stars un-light into these, then they smear out)
  const knotK = Math.sin(Math.PI * Math.min(1, dis * 1.25)) * sm;
  for (let i = 0; i < P.n; i++) {
    const kind = P.kind[i];
    let rad = P.r[i];
    let th = P.th[i];
    let bright = P.mag[i] * perMag;
    let col = pal.disc;
    let px: number, py: number;
    if (kind === 4) {
      // bar: rigid, pattern speed
      const ang = barA,
        xb = rad,
        yb = P.z[i] * 3;
      [px, py] = proj(xb * Math.cos(ang) - yb * Math.sin(ang), xb * Math.sin(ang) + yb * Math.cos(ang), P.z[i]);
      col = pal.core;
    } else {
      if (kind === 3) {
        th += (Om / rc) * 0.6 * t;
        col = pal.core;
      } else if (kind === 0) {
        th += (Om / Math.max(rad, rc)) * t;
        col = rad < 0.3 ? pal.core : pal.disc;
      } else {
        // young stars / HII knots: born in the arm (pattern), drift with the disc, fade after their lifetime
        const life = kind === 2 ? 4 : 9;
        const age01 = (t / life + P.ph[i]) % 1;
        const ageS = age01 * life;
        // θ = θ_arm + Ωp·t + (Ω(r) − Ωp)·age
        th += patt + (Om / Math.max(rad, rc) - Om * 0.75) * ageS;
        bright *= smoothstep(0, 0.08, age01) * Math.pow(1 - age01, kind === 2 ? 2.2 : 1.2) * (kind === 2 ? 2.2 : 1.8);
        col = kind === 2 ? pal.hii : pal.young;
      }
      if (dis > 0) {
        rad *= 1 + dis * (0.35 * P.sm[i] - 0.05);
        th += dis * (P.sm[i] - 0.5) * 0.9;
      }
      [px, py] = proj(rad * Math.cos(th), rad * Math.sin(th), P.z[i] * (1 + 2 * dis));
    }
    if (kind === 2 && knotK > 0.01) {
      const kc = 1.1 * knotK * bright;
      const gw = Math.min(1, 0.5 + dis);
      blobL(b, px, py, (3 + 16 * dis) * (R / 300), lerp(col[0], pal.gas[0], gw) * kc, lerp(col[1], pal.gas[1], gw) * kc, lerp(col[2], pal.gas[2], gw) * kc);
    }
    const sb = bright * starK * rad2;
    if (sb < 1e-6) continue;
    const tau = tauAt(b, px, py);
    const er = Math.exp(-tau * 0.75),
      eg = Math.exp(-tau * 0.92),
      eb = Math.exp(-tau * 1.12);
    starPt(b, px, py, col[0] * sb * er, col[1] * sb * eg, col[2] * sb * eb, exposure);
  }
  resolve(ctx, b, exposure, alpha);
}

// ───────────────────────── galaxy merger (restricted N-body) ─────────────────────────
interface MergerSim {
  frames: number;
  n: number; // particles per galaxy
  pos: Int16Array; // frames × (2n) × 3, quantised (Q units per disc radius)
  cores: Float32Array; // frames × 2 × 3
  r0: Float32Array; // initial radius (colour)
  mag: Float32Array;
  bulge: Uint8Array;
  /** fixed disc frames of the two progenitors (for the density-wave arms): [inc, lon, spin] × 2 */
  orient: Float32Array;
  dtRec: number;
}
const Q = 1500;
const SIM_T = 30;
function mergerSim(seed: number, nPer: number): MergerSim {
  return memo(`cosmos:merger2:${seed}:${nPer}`, () => {
    const rnd = mulberry32(seed * 1013 + 7);
    const gauss = () => {
      const u = Math.max(1e-9, rnd()),
        v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    };
    const eps2 = 0.09; // softening²
    const M = [1, 1];
    // centres: parabolic-ish approach in the x-y plane
    const C = [
      [-3.4, -1.2, 0],
      [3.4, 1.2, 0],
    ];
    const V = [
      [0.36, 0.06, 0],
      [-0.36, -0.06, 0],
    ];
    const orient = [
      [0.25, 0.4],
      [1.05, -0.9],
    ];
    const spinS = [1, -1];
    const N = nPer * 2;
    const p = new Float64Array(N * 3),
      v = new Float64Array(N * 3);
    const r0 = new Float32Array(N),
      mag = new Float32Array(N),
      bulge = new Uint8Array(N);
    const vcirc = (rr: number, m: number) => Math.sqrt((m * rr * rr) / Math.pow(rr * rr + eps2, 1.5));
    for (let g = 0; g < 2; g++) {
      const [inc, lon] = orient[g];
      const ci = Math.cos(inc),
        si = Math.sin(inc),
        cl = Math.cos(lon),
        sl = Math.sin(lon);
      for (let k = 0; k < nPer; k++) {
        const i = g * nPer + k;
        const isB = rnd() < 0.14;
        let x: number, y: number, z: number, vx: number, vy: number, vz: number, rr: number;
        if (isB) {
          // hot bulge: compact, isotropic dispersion
          rr = Math.min(0.5, 0.09 * Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) + 0.01);
          const cz = rnd() * 2 - 1,
            ph = rnd() * TAU,
            sz = Math.sqrt(1 - cz * cz);
          x = rr * sz * Math.cos(ph);
          y = rr * sz * Math.sin(ph);
          z = rr * cz * 0.8;
          const sig = 0.55 * vcirc(Math.max(rr, 0.05), M[g]);
          vx = gauss() * sig;
          vy = gauss() * sig;
          vz = gauss() * sig * 0.8;
        } else {
          // smooth exponential disc (no material arms: they would wind into rings), with velocity dispersion
          do rr = 0.04 - 0.3 * Math.log(1 - rnd() * 0.99);
          while (rr > 1.35);
          const a = rnd() * TAU;
          const vc = vcirc(rr, M[g]) * spinS[g];
          x = rr * Math.cos(a);
          y = rr * Math.sin(a);
          z = gauss() * 0.02;
          const vt = vc * (1 + gauss() * 0.07),
            vr = Math.abs(vc) * gauss() * 0.1;
          vx = -vt * Math.sin(a) + vr * Math.cos(a);
          vy = vt * Math.cos(a) + vr * Math.sin(a);
          vz = gauss() * 0.025;
        }
        // tilt about x by inc, then rotate about z by lon
        const y2 = y * ci - z * si,
          z2 = y * si + z * ci;
        const vy2 = vy * ci - vz * si,
          vz2 = vy * si + vz * ci;
        p[i * 3] = C[g][0] + x * cl - y2 * sl;
        p[i * 3 + 1] = C[g][1] + x * sl + y2 * cl;
        p[i * 3 + 2] = C[g][2] + z2;
        v[i * 3] = V[g][0] + vx * cl - vy2 * sl;
        v[i * 3 + 1] = V[g][1] + vx * sl + vy2 * cl;
        v[i * 3 + 2] = V[g][2] + vz2;
        r0[i] = rr;
        bulge[i] = isB ? 1 : 0;
        mag[i] = Math.min(40, Math.pow(Math.max(1e-4, rnd()), -0.7));
      }
    }
    const dt = 0.05;
    const steps = Math.round(SIM_T / dt);
    const every = 3;
    const frames = Math.floor(steps / every) + 1;
    const pos = new Int16Array(frames * N * 3);
    const cores = new Float32Array(frames * 6);
    const ax = new Float64Array(N * 3);
    const accAll = () => {
      for (let i = 0; i < N; i++) {
        const px = p[i * 3],
          py = p[i * 3 + 1],
          pz = p[i * 3 + 2];
        let fx = 0,
          fy = 0,
          fz = 0;
        for (let g = 0; g < 2; g++) {
          const dx = C[g][0] - px,
            dy = C[g][1] - py,
            dz = C[g][2] - pz;
          const d2 = dx * dx + dy * dy + dz * dz + eps2;
          const f = M[g] / (d2 * Math.sqrt(d2));
          fx += dx * f;
          fy += dy * f;
          fz += dz * f;
        }
        ax[i * 3] = fx;
        ax[i * 3 + 1] = fy;
        ax[i * 3 + 2] = fz;
      }
    };
    const coreAcc = () => {
      const dx = C[1][0] - C[0][0],
        dy = C[1][1] - C[0][1],
        dz = C[1][2] - C[0][2];
      const d2 = dx * dx + dy * dy + dz * dz + 0.16;
      const d = Math.sqrt(d2);
      const f = 1 / (d2 * d);
      // dynamical friction on the relative motion when the haloes overlap
      const rvx = V[1][0] - V[0][0],
        rvy = V[1][1] - V[0][1],
        rvz = V[1][2] - V[0][2];
      const fr = 0.55 * Math.exp(-d / 1.1);
      return [
        [dx * f * M[1] + 0.5 * fr * rvx, dy * f * M[1] + 0.5 * fr * rvy, dz * f * M[1] + 0.5 * fr * rvz],
        [-dx * f * M[0] - 0.5 * fr * rvx, -dy * f * M[0] - 0.5 * fr * rvy, -dz * f * M[0] - 0.5 * fr * rvz],
      ];
    };
    const record = (fi: number) => {
      const o = fi * N * 3;
      for (let i = 0; i < N * 3; i++) pos[o + i] = Math.max(-32767, Math.min(32767, Math.round(p[i] * Q)));
      for (let g = 0; g < 2; g++) for (let c = 0; c < 3; c++) cores[fi * 6 + g * 3 + c] = C[g][c];
    };
    record(0);
    // leapfrog (kick-drift-kick), one force evaluation per step
    accAll();
    let ca = coreAcc();
    let mergeStep = -1;
    for (let s = 1; s <= steps; s++) {
      for (let i = 0; i < N * 3; i++) v[i] += ax[i] * dt * 0.5;
      for (let g = 0; g < 2; g++) for (let c = 0; c < 3; c++) V[g][c] += ca[g][c] * dt * 0.5;
      for (let i = 0; i < N * 3; i++) p[i] += v[i] * dt;
      for (let g = 0; g < 2; g++) for (let c = 0; c < 3; c++) C[g][c] += V[g][c] * dt;
      accAll();
      ca = coreAcc();
      for (let i = 0; i < N * 3; i++) v[i] += ax[i] * dt * 0.5;
      for (let g = 0; g < 2; g++) for (let c = 0; c < 3; c++) V[g][c] += ca[g][c] * dt * 0.5;
      if (s % every === 0) record(s / every);
      const sep = Math.hypot(C[1][0] - C[0][0], C[1][1] - C[0][1], C[1][2] - C[0][2]);
      if (mergeStep < 0 && sep < 0.12 && s * dt > 4) mergeStep = s;
      // the range p ∈ [0, 1] ends 5 time units after coalescence: no need to integrate further
      if (mergeStep > 0 && s >= mergeStep + Math.round(5 / dt) + every) break;
    }
    // p = 1 ↔ a little after coalescence (the interesting part fills the whole range)
    const used = mergeStep > 0 ? Math.min(frames, Math.floor((mergeStep + Math.round(5 / dt)) / every) + 1) : frames;
    const of = new Float32Array([orient[0][0], orient[0][1], spinS[0], orient[1][0], orient[1][1], spinS[1]]);
    return { frames: used, n: nPer, pos, cores, r0, mag, bulge, orient: of, dtRec: dt * every };
  });
}

export interface MergerOpts {
  /** screen position of the system's centre of mass (logical px) */
  cx: number;
  cy: number;
  /** px per disc radius (each progenitor disc is ~1.2 of these across in radius) */
  scale: number;
  /** 0 = two separate discs approaching … ~0.3 first pass, tidal tails … 1 = merged remnant with long tails */
  p: number;
  /** view: tilt about the screen x axis and rotation in the screen plane (rad) */
  tilt?: number;
  angle?: number;
  seed?: number;
  /** particles per galaxy (default 3200; precompute ≈ 0.15–0.3 s once per tab) */
  n?: number;
  palette?: GalaxyPaletteName | GalaxyPaletteDef;
  alpha?: number;
  dissolve?: number;
  exposure?: number;
  /** seconds, for core twinkle (default 0) */
  t?: number;
}

/** Two spirals colliding (tidal bridges, tails, starburst, merger). p runs 0 → 1 (pass p decreasing to un-merge). */
export function drawMerger(ctx: CanvasRenderingContext2D, o: MergerOpts) {
  const { cx, cy, scale: S, p, tilt = 0.5, angle = 0.3, seed = 3, n = 3200, alpha = 1, dissolve = 0, exposure = 1 } = o;
  if (alpha <= 0.002) return;
  const pal = palLin(o.palette);
  const sim = mergerSim(seed, n);
  const f = clamp(p) * (sim.frames - 1);
  const f0 = Math.floor(f),
    f1 = Math.min(sim.frames - 1, f0 + 1),
    ft = f - f0;
  const N = sim.n * 2;
  const ct = Math.cos(tilt),
    st = Math.sin(tilt),
    ca = Math.cos(angle),
    sa = Math.sin(angle);
  const iq = 1 / Q;
  // cores now
  const C0 = f0 * 6,
    C1 = f1 * 6;
  const core = [0, 1].map((g) => [
    lerp(sim.cores[C0 + g * 3], sim.cores[C1 + g * 3], ft),
    lerp(sim.cores[C0 + g * 3 + 1], sim.cores[C1 + g * 3 + 1], ft),
    lerp(sim.cores[C0 + g * 3 + 2], sim.cores[C1 + g * 3 + 2], ft),
  ]);
  const sep = Math.hypot(core[0][0] - core[1][0], core[0][1] - core[1][1], core[0][2] - core[1][2]);
  // centre the view on the centre of mass
  const mx = (core[0][0] + core[1][0]) / 2,
    my = (core[0][1] + core[1][1]) / 2,
    mz = (core[0][2] + core[1][2]) / 2;
  const proj = (x: number, y: number, z: number): [number, number] => {
    const X = x - mx,
      Y = y - my,
      Z = z - mz;
    const y2 = Y * ct - Z * st;
    return [cx + (X * ca - y2 * sa) * S, cy + (X * sa + y2 * ca) * S];
  };
  // positions now + bounding box
  const P0 = f0 * N * 3,
    P1 = f1 * N * 3;
  const xyz = f32('A', N * 3);
  const xy = f32('C', N * 2);
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < N; i++) {
    const X = lerp(sim.pos[P0 + i * 3], sim.pos[P1 + i * 3], ft) * iq;
    const Y = lerp(sim.pos[P0 + i * 3 + 1], sim.pos[P1 + i * 3 + 1], ft) * iq;
    const Z = lerp(sim.pos[P0 + i * 3 + 2], sim.pos[P1 + i * 3 + 2], ft) * iq;
    xyz[i * 3] = X;
    xyz[i * 3 + 1] = Y;
    xyz[i * 3 + 2] = Z;
    const [px, py] = proj(X, Y, Z);
    xy[i * 2] = px;
    xy[i * 2 + 1] = py;
    if (sim.r0[i] < 1.1) {
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
  }
  const padL = S * 0.6;
  x0 = Math.max(x0 - padL, -400);
  y0 = Math.max(y0 - padL, -400);
  x1 = Math.min(x1 + padL, 1480);
  y1 = Math.min(y1 + padL, 2320);
  if (x1 <= x0 || y1 <= y0) return;
  const ds = deviceScale(ctx);
  // stars at (nearly) device resolution even when the system is large (the light buffer stays ~300 px)
  const s = Math.min(ds, Math.sqrt(2.4e6 / ((x1 - x0) * (y1 - y0))));
  const b = getBuf(x0, y0, x1 - x0, y1 - y0, s, 300);
  const dis = clamp(dissolve);
  const starK = Math.pow(1 - dis, 1.6);
  const burst = 1 + 1.6 * Math.exp(-sep / 0.8) * smoothstep(0.15, 0.4, p);
  // density-wave arms of the progenitors: strong while they are apart, erased by the encounter's tides
  const armA = 0.9 * smoothstep(1.6, 3.2, sep) * (1 - dis);
  const tSim = f * sim.dtRec;
  // ── 1. unresolved light: a two-scale density field (KDE). Fine where many particles overlap, coarse (smooth,
  //       continuous) in the sparse tails — no per-particle blobs anywhere.
  const { hW, hH, L } = b;
  const nPx = hW * hH;
  const Lc = f32('Lc', nPx * 3); // coarse copy
  const Cn = f32('Cn', nPx); // particle counts (coarse)
  Lc.fill(0, 0, nPx * 3);
  Cn.fill(0, 0, nPx);
  const hs = b.s / b.div;
  const pxArea = 1 / (hs * hs);
  const gK = (0.3 * pal.smooth * (S * S)) / (N * pxArea); // surface brightness independent of scale / count
  const og = sim.orient;
  const armF = f32('arm', N);
  const ia0 = Math.cos(og[0]),
    ia1 = Math.cos(og[3]),
    is0 = Math.sin(og[0]),
    is1 = Math.sin(og[3]);
  const lc0 = Math.cos(og[1]),
    ls0 = Math.sin(og[1]),
    lc1 = Math.cos(og[4]),
    ls1 = Math.sin(og[4]);
  const itp = 1 / Math.tan(0.32);
  for (let i = 0; i < N; i++) {
    const g = i < sim.n ? 0 : 1;
    const rr = sim.r0[i];
    const isB = sim.bulge[i] === 1;
    const w = smoothstep(0.15, 0.75, rr);
    let col: RGB = isB ? pal.core : [lerp(pal.core[0], pal.young[0], w), lerp(pal.core[1], pal.young[1], w), lerp(pal.core[2], pal.young[2], w)];
    if (dis > 0) col = [lerp(col[0], pal.gas[0], dis), lerp(col[1], pal.gas[1], dis), lerp(col[2], pal.gas[2], dis)];
    let px = xy[i * 2],
      py = xy[i * 2 + 1];
    if (dis > 0) {
      const a = (i * 2.399) % TAU;
      px += Math.cos(a) * dis * S * 0.15 * ((i * 0.618) % 1);
      py += Math.sin(a) * dis * S * 0.15 * ((i * 0.618) % 1);
    }
    // spiral density wave in the particle's own (initial) disc frame, rotating rigidly with the pattern
    let arm = 1;
    if (armA > 0.01 && !isB) {
      const dx = xyz[i * 3] - core[g][0],
        dy = xyz[i * 3 + 1] - core[g][1],
        dz = xyz[i * 3 + 2] - core[g][2];
      const cl = g ? lc1 : lc0,
        sl = g ? ls1 : ls0;
      const ux = dx * cl + dy * sl,
        uy = -dx * sl + dy * cl;
      const dyD = uy * (g ? ia1 : ia0) + dz * (g ? is1 : is0);
      const r = Math.sqrt(ux * ux + dyD * dyD);
      const th = Math.atan2(dyD, ux) * og[g * 3 + 2] - 0.35 * tSim;
      const ph = 2 * (th - Math.log((r > 0.05 ? r : 0.05) / 0.15) * itp);
      const wv = 0.5 + 0.5 * Math.cos(ph);
      arm = 1 + armA * (wv * wv * wv * 2.6 - 0.75) * ss(0.24, 0.45, r) * (1 - ss(1.0, 1.4, r));
    }
    armF[i] = arm;
    // outer-disc material (which becomes the tidal tails) is young and blue: brighter per particle so tails glow
    const lum = (0.6 + 0.4 * Math.min(4, sim.mag[i])) * gK * (rr < 0.45 ? burst : 1) * arm * (isB ? 0.8 : 1.15 * (1 + 1.6 * ss(0.55, 1.1, rr)));
    splatL(b, px, py, col[0] * lum, col[1] * lum, col[2] * lum);
    splatL(b, px, py, col[0] * lum, col[1] * lum, col[2] * lum, Lc);
    // counts (into a 1-channel grid, bilinear)
    const fx = ((px - b.ox) * b.s) / b.div - 0.5,
      fy = ((py - b.oy) * b.s) / b.div - 0.5;
    const ix = Math.floor(fx),
      iy = Math.floor(fy);
    if (ix >= 0 && iy >= 0 && ix < hW - 1 && iy < hH - 1) {
      const tx = fx - ix,
        ty = fy - iy;
      Cn[iy * hW + ix] += (1 - tx) * (1 - ty);
      Cn[iy * hW + ix + 1] += tx * (1 - ty);
      Cn[(iy + 1) * hW + ix] += (1 - tx) * ty;
      Cn[(iy + 1) * hW + ix + 1] += tx * ty;
    }
  }
  const sf = Math.max(1, Math.round(1.2 * (1 + 1.5 * dis))),
    sc = Math.max(2, Math.round(4.2 * (1 + 0.6 * dis)));
  boxBlur(L, hW, hH, 3, sf);
  boxBlur(Lc, hW, hH, 3, sc);
  boxBlur(Cn, hW, hH, 1, sc);
  for (let q = 0; q < nPx; q++) {
    // expected particles inside the fine kernel: use the fine field only where it is not shot noise
    const w = smoothstep(0.35, 1.1, Cn[q] * sf * sf);
    const k = q * 3;
    L[k] = Lc[k] + (L[k] - Lc[k]) * w;
    L[k + 1] = Lc[k + 1] + (L[k + 1] - Lc[k + 1]) * w;
    L[k + 2] = Lc[k + 2] + (L[k + 2] - Lc[k + 2]) * w;
  }
  b.T.fill(0, 0, nPx);
  // bulges riding on the cores
  const coreTw = 1 + 0.05 * Math.sin((o.t ?? 0) * 3.1);
  for (let g = 0; g < 2; g++) {
    const [qx, qy] = proj(core[g][0], core[g][1], core[g][2]);
    const rB = S * 0.1 * (1 + dis);
    const gx = (qx - b.ox) * hs,
      gy = (qy - b.oy) * hs,
      gr = rB * hs * 4;
    const ya = Math.max(0, Math.floor(gy - gr)),
      yb = Math.min(hH - 1, Math.ceil(gy + gr));
    const xa = Math.max(0, Math.floor(gx - gr)),
      xb = Math.min(hW - 1, Math.ceil(gx + gr));
    const cc = dis > 0 ? [lerp(pal.core[0], pal.gas[0], dis), lerp(pal.core[1], pal.gas[1], dis), lerp(pal.core[2], pal.gas[2], dis)] : pal.core;
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const dd = Math.hypot(x - gx, y - gy);
        const d = dd / (rB * hs);
        const win = 1 - smoothstep(gr * 0.6, gr, dd);
        const I = (Math.exp(-Math.pow(d, 0.8) * 2.4) * 1.1 + Math.exp(-d * 0.9) * 0.1) * burst * coreTw * pal.smooth * win * 0.45;
        const k = (y * hW + x) * 3;
        L[k] += cc[0] * I;
        L[k + 1] += cc[1] * I;
        L[k + 2] += cc[2] * I;
      }
  }
  // ── 2. stars: sharp points only (old stars faint and warm, young outer / tail stars blue, knots strung along tails)
  let flux = 0;
  for (let q = 0; q < nPx * 3; q++) flux += L[q];
  const perMag = (0.45 * (flux / 3) * (b.div / b.s) ** 2) / (N * 2.2);
  const rad2 = b.s * b.s;
  for (let i = 0; i < N; i++) {
    if (starK < 0.003) break;
    const rr = sim.r0[i];
    const knot = rr > 0.55 && i % 23 === 0;
    const w = smoothstep(0.2, 0.8, rr);
    const col: RGB = knot ? pal.hii : sim.bulge[i] ? pal.core : [lerp(pal.core[0], pal.young[0], w), lerp(pal.core[1], pal.young[1], w), lerp(pal.core[2], pal.young[2], w)];
    // young stars crowd into the arms (density wave), knots ride the tails
    const a = armF[i];
    const m = sim.mag[i] * (knot ? 3 : 1) * (sim.bulge[i] ? 0.25 : 1 + 1.2 * ss(0.55, 1.1, rr)) * a * a;
    const sb = m * perMag * starK * rad2 * pal.dots;
    starPt(b, xy[i * 2], xy[i * 2 + 1], col[0] * sb, col[1] * sb, col[2] * sb, exposure);
  }
  resolve(ctx, b, exposure, alpha);
}

// ───────────────────────── starfield ─────────────────────────
export interface StarfieldOpts {
  seed?: number;
  /** seconds (twinkle) */
  t?: number;
  /** star count multiplier (default 1 ≈ 2600 stars) */
  density?: number;
  /** parallax strength of the camera pan between layers (default 1) */
  depth?: number;
  /** 0..1 twinkle amplitude (default 0.4) */
  twinkle?: number;
  /** camera pan in px (nearest layer moves this much; far layers less, × depth) */
  x?: number;
  y?: number;
  /** zoom about (cx, cy) — nearer layers scale more (default 1) */
  zoom?: number;
  roll?: number;
  cx?: number;
  cy?: number;
  /** 0..1 radial streaks from (cx, cy) — fast-forward / rewind through time (default 0) */
  streak?: number;
  /** 0..1 the stars burn out in random order: redden, dim, gone (default 0) */
  die?: number;
  alpha?: number;
  palette?: 'natural' | 'amber' | 'cool';
}
const STAR_COLS: Record<string, string[]> = {
  natural: ['#9BB0FF', '#CAD7FF', '#F8F7FF', '#FFF4EA', '#FFE4C0', '#FFD2A1', '#FFB56C'],
  amber: ['#FFE3A3', '#FFD07A', '#FFC56B', '#FFB347', '#FF9F2E', '#FF8C1A', '#E07010'],
  cool: ['#8E9BFF', '#A9B8FF', '#D6E6FF', '#E8F0FF', '#C0CCFF', '#9E8CFF', '#8E5BFF'],
};
interface StarSet {
  x: Float32Array;
  y: Float32Array;
  m: Float32Array;
  c: Uint8Array;
  ph: Float32Array;
  layer: Uint8Array;
  n: number;
}
const TILE_W = 1500,
  TILE_H = 2400;
function starSet(seed: number, density: number): StarSet {
  return memo(`cosmos:stars:${seed}:${density}`, () => {
    const r = mulberry32(seed * 31337 + 5);
    const counts = [Math.round(2000 * density), Math.round(520 * density), Math.round(70 * density)];
    const n = counts[0] + counts[1] + counts[2];
    const S: StarSet = { x: new Float32Array(n), y: new Float32Array(n), m: new Float32Array(n), c: new Uint8Array(n), ph: new Float32Array(n), layer: new Uint8Array(n), n };
    let i = 0;
    for (let L = 0; L < 3; L++)
      for (let k = 0; k < counts[L]; k++, i++) {
        S.x[i] = r() * TILE_W;
        S.y[i] = r() * TILE_H;
        S.m[i] = L === 0 ? 0.15 + 0.5 * Math.pow(r(), 2) : L === 1 ? 0.3 + 0.7 * Math.pow(r(), 2.5) : 0.5 + 0.5 * r();
        const u = r();
        S.c[i] = u < 0.06 ? 0 : u < 0.2 ? 1 : u < 0.5 ? 2 : u < 0.72 ? 3 : u < 0.86 ? 4 : u < 0.95 ? 5 : 6;
        S.ph[i] = r();
        S.layer[i] = L;
      }
    return S;
  });
}
function glowSprite(hex: string): HTMLCanvasElement {
  return memo(`cosmos:gsprite:${hex}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = ctx2d(c);
    const n = parseInt(hex.slice(1), 16);
    const rgb = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, `rgba(${rgb},0.9)`);
    g.addColorStop(0.25, `rgba(${rgb},0.25)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  });
}

/** Parallax star layers (far dust of faint stars, mid stars, a few bright near stars with glow), additive. */
export function drawStarfield(ctx: CanvasRenderingContext2D, o: StarfieldOpts = {}) {
  const { seed = 1, t = 0, density = 1, depth = 1, twinkle = 0.4, x = 0, y = 0, zoom = 1, roll = 0, cx = 540, cy = 960, streak = 0, die = 0, alpha = 1, palette = 'natural' } = o;
  if (alpha <= 0.002) return;
  const S = starSet(seed, density);
  const cols = STAR_COLS[palette].map((h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const par = [0.25, 0.55, 1];
  const zpow = [0.35, 0.65, 1];
  const cr = Math.cos(roll),
    sr = Math.sin(roll);
  const m0 = ctx.getTransform();
  const ps = PointSplat.get(1080, 1920, Math.hypot(m0.a, m0.b) || 1);
  const nearList: Array<[number, number, number, number]> = [];
  for (let i = 0; i < S.n; i++) {
    const L = S.layer[i];
    const z = Math.pow(zoom, zpow[L]);
    let sx = S.x[i] - x * par[L] * depth;
    let sy = S.y[i] - y * par[L] * depth;
    sx = ((sx % TILE_W) + TILE_W) % TILE_W - (TILE_W - 1080) / 2;
    sy = ((sy % TILE_H) + TILE_H) % TILE_H - (TILE_H - 1920) / 2;
    const dx0 = (sx - cx) * z,
      dy0 = (sy - cy) * z;
    const dx = dx0 * cr - dy0 * sr,
      dy = dx0 * sr + dy0 * cr;
    const px = cx + dx,
      py = cy + dy;
    if (px < -60 || py < -60 || px > 1140 || py > 1980) continue;
    let m = S.m[i];
    if (twinkle > 0 && L > 0) m *= 1 + twinkle * 0.45 * Math.sin(t * (2 + 5 * S.ph[i]) + S.ph[i] * 40) * S.ph[i];
    let ci = S.c[i];
    if (die > 0) {
      // each star reddens, dims and goes out at its own moment
      const dr = (S.ph[i] * 7.31) % 1;
      const k = clamp((die - dr * 0.9) / 0.1);
      if (k >= 1) continue;
      if (die > dr * 0.9 - 0.2) ci = Math.max(ci, 5);
      if (k > 0) {
        ci = 6;
        m *= 1 - k;
      }
    }
    m *= alpha;
    if (m <= 0.01) continue;
    const c = cols[ci];
    const sz = L === 0 ? 1 : L === 1 ? 1.4 : 1.9;
    const v = m * 255;
    if (streak > 0.01) {
      const k = streak * (0.15 + 0.6 * par[L]);
      ps.streak(px + dx * k, py + dy * k, px, py, (c[0] * v) / 255, (c[1] * v) / 255, (c[2] * v) / 255);
    } else ps.add(px, py, sz, (c[0] * v) / 255, (c[1] * v) / 255, (c[2] * v) / 255);
    if (L === 2) nearList.push([px, py, m, ci]);
  }
  ps.commit(ctx, 1080, 1920);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [px, py, m, ci] of nearList) {
    const r = 6 + 12 * m;
    ctx.globalAlpha = Math.min(1, m * 0.8);
    ctx.drawImage(glowSprite(STAR_COLS[palette][ci]), px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
}

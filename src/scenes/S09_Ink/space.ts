// S09 pull-back, levels 4–6: the pale dot and its Moon, the planets' orbits around the Sun, a log-space tunnel of
// stars (the same number of stars per decade: the rush is self-similar), the Milky Way with you on an arm, the Local
// Group and a field of galaxies — handing over to the cosmic web. World units: metres, the Earth at the origin.
import { drawGalaxy } from '../../lib/cosmos';
import { clamp, memo, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { glow } from './canvas';
import { View, sx, sy } from './city';
import { RE, SUN_DIR2 } from './earth';

export const AU = 1.496e11;
export const LY = 9.461e15;
export const SUN: readonly [number, number] = [SUN_DIR2[0] * AU, SUN_DIR2[1] * AU];
/** the Milky Way: radius 5×10²⁰ m; the Sun sits 26 000 ly from its centre (set on an arm, see mwGeom) */
export const MW_R = 5.0e20;
export const SUN_GAL_R = 26000 * LY;
const MW_TILT = 0.32;
const MW_ANGLE = -0.55;
const MW_PITCH = 0.24;
const MW_SPIN = 0.05;
export const MW_SEED = 5;

/** the galaxy clock at which "you" sit exactly on the arm (the pattern then turns ~2° while it is on screen) */
const T_REF = 44;
/** galactic centre position (world m) such that the Sun lies on an arm at r = 0.52 R (at the reference time) */
export function galCentre(t = T_REF): [number, number] {
  // arm ridge (lib drawGalaxy): th − patt = ln(r/0.18)/tan(pitch) (+ π for the other arm), patt = spin·0.75·t
  const r = SUN_GAL_R / MW_R;
  const patt = MW_SPIN * 0.75 * t;
  const th = patt + Math.log(r / 0.18) / Math.tan(MW_PITCH) + 0.18; // just inside the arm (Orion spur)
  const X = r * Math.cos(th),
    Y = r * Math.sin(th);
  const ct = Math.cos(MW_TILT),
    ca = Math.cos(MW_ANGLE),
    sa = Math.sin(MW_ANGLE);
  const y2 = Y * ct;
  const offX = (X * ca - y2 * sa) * MW_R,
    offY = (X * sa + y2 * ca) * MW_R;
  // Sun = centre + off  →  centre = Sun − off
  return [SUN[0] - offX, SUN[1] - offY];
}

// ───────────────────────────── the Earth as a pale dot, the Moon ─────────────────────────────
export function drawEarthDot(ctx: CanvasRenderingContext2D, v: View, alpha: number) {
  if (alpha <= 0.003) return;
  const x = sx(v, 0),
    y = sy(v, 0);
  const R = RE * v.s;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, '#7FC4FF', x, y, Math.max(5, R * 3), 0.55 * alpha, 0.6);
  // the crescent toward the Sun
  ctx.fillStyle = `rgba(190,225,255,${(0.9 * alpha).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(x + SUN_DIR2[0] * Math.max(0.6, R * 0.3), y + SUN_DIR2[1] * Math.max(0.6, R * 0.3), Math.max(1.1, R * 0.8), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
export function drawMoon(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const D = 3.844e8;
  const cx = sx(v, 0),
    cy = sy(v, 0);
  const Rpx = D * v.s;
  if (Rpx < 4 || Rpx > 4000) return;
  const ang = -2.2 + t * 0.004;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(200,210,230,${(0.22 * alpha * smoothstep(4, 40, Rpx)).toFixed(3)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, Rpx, 0, Math.PI * 2);
  ctx.stroke();
  const mx = cx + Math.cos(ang) * Rpx,
    my = cy + Math.sin(ang) * Rpx;
  const mr = Math.max(1.2, 1.737e6 * v.s);
  glow(ctx, '#D8DCE6', mx, my, mr * 4 + 3, 0.4 * alpha, 0.5);
  ctx.fillStyle = `rgba(225,228,236,${(0.85 * alpha).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────────── the solar system ─────────────────────────────
const PLANETS: Array<[number, string, number]> = [
  // a (AU), colour, phase
  [0.387, '#B9B2A8', 0.4],
  [0.723, '#F2DDA0', 2.1],
  [1.0, '#7FC4FF', -1],
  [1.524, '#E0805A', 4.0],
  [5.2, '#E8C9A0', 1.2],
  [9.54, '#F2D58A', 5.1],
  [19.2, '#9FE6F0', 3.3],
  [30.1, '#6F8FFF', 0.9],
];
function belts(): Float32Array {
  return memo('s09:belts', () => {
    const r = mulberry32(77);
    const out: number[] = [];
    for (let i = 0; i < 520; i++) out.push(2.15 + 1.2 * r(), r() * Math.PI * 2, 0.3 + 0.7 * r());
    for (let i = 0; i < 900; i++) out.push(30 + 22 * Math.pow(r(), 1.6), r() * Math.PI * 2, 0.25 + 0.6 * r());
    return new Float32Array(out);
  });
}
export function drawSolar(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number, sunAlpha: number) {
  const cx = sx(v, SUN[0]),
    cy = sy(v, SUN[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (alpha > 0.003) {
    // orbits: hairlines that are visible while their radius is between ~10 px and ~2500 px
    for (const [a, col, ph] of PLANETS) {
      const R = a * AU * v.s;
      const k = smoothstep(6, 40, R) * (1 - smoothstep(1400, 3200, R)) * alpha;
      if (k <= 0.004) continue;
      ctx.strokeStyle = `rgba(214,222,240,${(0.42 * k).toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      if (ph >= 0) {
        const px = cx + Math.cos(ph + t * 0.01 / a) * R,
          py = cy + Math.sin(ph + t * 0.01 / a) * R;
        glow(ctx, col, px, py, 16, 0.8 * k, 0.6);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.95 * k;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // asteroid & Kuiper belts
    const B = belts();
    for (let q = 0; q < B.length; q += 3) {
      const R = B[q] * AU * v.s;
      if (R < 8 || R > 3000) continue;
      const k = smoothstep(8, 60, R) * (1 - smoothstep(1500, 3000, R)) * alpha * B[q + 2];
      const x = cx + Math.cos(B[q + 1]) * R,
        y = cy + Math.sin(B[q + 1]) * R;
      if (x < -5 || x > 1085 || y < -5 || y > 1925) continue;
      ctx.fillStyle = `rgba(230,218,196,${(0.6 * k).toFixed(3)})`;
      ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    }
  }
  // the Sun: a star with a warm halo
  if (sunAlpha > 0.003) {
    const r0 = Math.max(1.6, 6.96e8 * v.s);
    glow(ctx, '#FFC94A', cx, cy, r0 * 14 + 26, 0.55 * sunAlpha, 0.9);
    glow(ctx, '#FFF7E0', cx, cy, r0 * 4 + 8, 0.9 * sunAlpha, 1);
    // faint diffraction cross, fixed to the "lens"
    const L = r0 * 10 + 40;
    const g = ctx.createLinearGradient(cx - L, cy, cx + L, cy);
    g.addColorStop(0, 'rgba(255,240,200,0)');
    g.addColorStop(0.5, `rgba(255,240,200,${(0.35 * sunAlpha).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - L, cy - 0.7, 2 * L, 1.4);
    const g2 = ctx.createLinearGradient(cx, cy - L, cx, cy + L);
    g2.addColorStop(0, 'rgba(255,240,200,0)');
    g2.addColorStop(0.5, `rgba(255,240,200,${(0.35 * sunAlpha).toFixed(3)})`);
    g2.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(cx - 0.7, cy - L, 1.4, 2 * L);
  }
  ctx.restore();
}

// ───────────────────────────── self-similar fields (stars, galaxies) ─────────────────────────────
// A uniform field seen while pulling back would fill the frame ×100 per decade. Instead: one layer per half-decade,
// each uniform over a square slightly larger than the frame while it is visible; a layer fades in while its points
// are sparse and bright and fades out before its square shrinks inside the frame. 2–3 layers overlap at any zoom,
// so the frame always holds a few hundred points that flow toward the anchor.
interface FieldLayer {
  d: number;
  pts: Float32Array; // x, y (units of the layer's half-side), mag, colour, phase
}
function layers(key: string, d0: number, d1: number, n: number, seed: number): FieldLayer[] {
  return memo(`s09:layers:${key}`, () => {
    const out: FieldLayer[] = [];
    let k = 0;
    for (let d = d0; d <= d1 + 1e-6; d += 0.5, k++) {
      const r = mulberry32(seed + k * 7919);
      const pts = new Float32Array(n * 5);
      for (let i = 0; i < n; i++) {
        pts[i * 5] = r() * 2 - 1;
        pts[i * 5 + 1] = r() * 2 - 1;
        pts[i * 5 + 2] = Math.pow(r(), 2.6);
        pts[i * 5 + 3] = r();
        pts[i * 5 + 4] = r();
      }
      out.push({ d, pts });
    }
    return out;
  });
}
/** visibility of layer d at zoom Z; the layer's square has side 10^(d + 1.25) m */
const layerA = (d: number, Z: number) => smoothstep(d - 0.05, d + 0.4, Z) * (1 - smoothstep(d + 0.8, d + 1.12, Z));
const LAYER_SIDE = (d: number) => Math.pow(10, d + 1.25);

const STAR_COLS = ['#9BB0FF', '#CAD7FF', '#F8F7FF', '#FFF4EA', '#FFE4C0', '#FFD2A1', '#FFB56C'];
/** stars around the Sun: they stream toward the anchor and merge into the galaxy's light */
export function drawStars(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const cx = sx(v, SUN[0]),
    cy = sy(v, SUN[1]);
  const Z = Math.log10(1080 / v.s);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of layers('stars', 14.5, 20.5, 1500, 31337)) {
    const la = layerA(L.d, Z) * alpha;
    if (la <= 0.004) continue;
    const half = (LAYER_SIDE(L.d) / 2) * v.s;
    const P = L.pts;
    for (let i = 0; i < P.length; i += 5) {
      const x = cx + P[i] * half,
        y = cy + P[i + 1] * half;
      if (x < -20 || x > 1100 || y < -20 || y > 1940) continue;
      const m = P[i + 2];
      const k = la * (0.82 + 0.18 * Math.sin(t * 3.1 + P[i + 4] * 40));
      const col = STAR_COLS[Math.floor(P[i + 3] * STAR_COLS.length)];
      if (m > 0.45) glow(ctx, col, x, y, 5 + 22 * m, 0.55 * k * m, 0.8);
      ctx.fillStyle = col;
      ctx.globalAlpha = Math.min(1, k * (0.3 + 0.7 * m));
      const rr = 0.6 + 1.2 * m;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

// ───────────────────────────── the Milky Way & the Local Group ─────────────────────────────
export function drawMilkyWay(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const [gx, gy] = galCentre();
  const R = MW_R * v.s;
  // larger than this the lib's light buffer would be upscaled into blocks: it fades in as it shrinks into view
  alpha *= 1 - smoothstep(1500, 2600, R);
  if (R < 1 || alpha <= 0.003) return;
  drawGalaxy(ctx, {
    cx: sx(v, gx),
    cy: sy(v, gy),
    radius: R,
    tilt: MW_TILT,
    angle: MW_ANGLE,
    arms: 2,
    bar: 0.6,
    pitch: MW_PITCH,
    seed: MW_SEED,
    t,
    spin: MW_SPIN,
    palette: 'natural',
    alpha,
    // the bulge must not burn out while the galaxy still fills the frame
    exposure: 0.62 + 0.18 * clamp((1700 - R) / 1400),
    n: R > 300 ? 9000 : undefined,
  });
}

interface Gal {
  x: number;
  y: number;
  r: number;
  tilt: number;
  ang: number;
  seed: number;
  pal: 'natural' | 'cool';
}
/** Andromeda, Triangulum and the Magellanic Clouds (world m, relative to the galactic centre) */
const LOCAL: Gal[] = [
  { x: -1.35e22, y: -1.62e22, r: 1.1e21, tilt: 1.22, ang: 0.62, seed: 31, pal: 'natural' },
  { x: -0.62e22, y: -2.18e22, r: 3.0e20, tilt: 0.9, ang: -0.3, seed: 33, pal: 'cool' },
];
export function drawLocalGroup(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const [gx, gy] = galCentre();
  for (const g of LOCAL) {
    const R = g.r * v.s;
    if (R < 1.2 || R > 900) continue;
    const x = sx(v, gx + g.x),
      y = sy(v, gy + g.y);
    if (x < -R || x > 1080 + R || y < -R || y > 1920 + R) continue;
    drawGalaxy(ctx, { cx: x, cy: y, radius: R, tilt: g.tilt, angle: g.ang, arms: 2, bar: 0.2, seed: g.seed, t, palette: g.pal, alpha: alpha * 0.95, n: 1800 });
  }
  // the Magellanic Clouds: two irregular smudges next to the Milky Way
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [dx, dy, r] of [
    [3.1e20, 7.4e20, 7e19],
    [4.6e20, 9.1e20, 4e19],
  ] as const) {
    const R = r * v.s;
    if (R < 0.6) continue;
    glow(ctx, '#C9D6FF', sx(v, gx + dx), sy(v, gy + dy), Math.max(2.5, R * 2.2), 0.45 * alpha, 0.4);
  }
  ctx.restore();
}

/** a field of galaxies around the Local Group (self-similar layers, fading as the web's own galaxies take over) */
export function drawGalaxyField(ctx: CanvasRenderingContext2D, v: View, t: number, alpha: number) {
  if (alpha <= 0.003) return;
  const [gx, gy] = galCentre();
  const cx = sx(v, gx),
    cy = sy(v, gy);
  const Z = Math.log10(1080 / v.s);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of layers('galaxies', 21.5, 23.0, 700, 4242)) {
    const la = layerA(L.d, Z) * alpha;
    if (la <= 0.004) continue;
    const half = (LAYER_SIDE(L.d) / 2) * v.s;
    const P = L.pts;
    for (let i = 0; i < P.length; i += 5) {
      const x = cx + P[i] * half,
        y = cy + P[i + 1] * half;
      if (x < -20 || x > 1100 || y < -20 || y > 1940) continue;
      const m = P[i + 2];
      const size = clamp(1.5e21 * v.s * (0.5 + 1.5 * m), 1.2, 16);
      const k = la * (0.35 + 0.65 * m);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(P[i + 4] * Math.PI);
      ctx.scale(1, 0.3 + 0.7 * P[i + 3]);
      glow(ctx, P[i + 3] > 0.55 ? '#FFE0B8' : '#C8D4FF', 0, 0, size * 2.4, 0.75 * k, 0.75);
      ctx.restore();
    }
  }
  ctx.restore();
}

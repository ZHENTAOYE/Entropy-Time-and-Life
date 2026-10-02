// S08 — everything that happens ON the sand, drawn in Canvas2D over the sand shader:
// invisible walker's foot shadows, landing puffs, the slow-motion macro grain splash (ballistic, closed form),
// infrared heat sparks (the entropy tax of making a trace), wind-blown saltating grains, rewind-glitch tears.
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { hash01, mulberry32 } from '../../lib/random';
import { SHADOW_LEVELS, drawPrintSprite, levelPick, shadowSprite } from './relief';
import { cpuCanvas } from './CpuCanvas';
import { Cam, FOOT_L, MACRO_K, PRINTS, Print, T_IMPACT } from './trail';

/** shadow offset per unit height: −(horizontal sun direction) / tan(elevation) — same sun as the sand shader */
export const SH_X = -4.524;
export const SH_Y = 0.857;
/** narration band (no glitch tears across the captions) */
const CAP_Y0 = 1330;
const CAP_Y1 = 1560;

// ------------------------------------------------------------------------------------------- sprites

const GRAIN_COLS = [
  ['#FFF0D2', '#D9B27C', '#6E5235'],
  ['#F6DFB2', '#C99E66', '#5E4329'],
  ['#FFF7E6', '#E2C08C', '#7A5C3A'],
  ['#F2D7A6', '#B88E5A', '#4E3822'],
  ['#E9DCC8', '#A89480', '#4A3E33'],
  ['#FBE3B8', '#D3A267', '#6A4628'],
];
/** pre-shaded grain sprites at integer diameters 2..18 px per colour (blitted unscaled: fast in software raster) */
const D_MIN = 2;
const D_MAX = 18;
function grainAtlas(): HTMLCanvasElement[][] {
  return memo('S08:grainAtlas', () =>
    GRAIN_COLS.map(([hi, mid, lo]) => {
      const row: HTMLCanvasElement[] = [];
      for (let d = 0; d <= D_MAX; d++) {
        const dd = Math.max(D_MIN, d);
        const c = cpuCanvas(dd, dd);
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        const r = dd / 2;
        const g = ctx.createRadialGradient(r * 1.32, r * 0.7, r * 0.05, r, r, r);
        g.addColorStop(0, hi);
        g.addColorStop(0.5, mid);
        g.addColorStop(1, lo);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(r, r, r * 0.96, 0, Math.PI * 2);
        ctx.fill();
        row.push(c);
      }
      return row;
    }),
  );
}
/** soft contact/cast shadow sprites at integer widths */
function shadowAtlas(): HTMLCanvasElement[] {
  return memo('S08:grainShadowAtlas', () => {
    const row: HTMLCanvasElement[] = [];
    for (let d = 0; d <= D_MAX + 6; d++) {
      const w = Math.max(3, d);
      const h = Math.max(2, Math.round(w * 0.8));
      const c = cpuCanvas(w, h);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(12,7,3,1)');
      g.addColorStop(1, 'rgba(12,7,3,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      row.push(c);
    }
    return row;
  });
}

// ------------------------------------------------------------------------------------------- print → world
function local2world(p: Print, u: number, v: number): [number, number] {
  // u,v in units of foot length for a LEFT foot (toes up); mirror for the right foot
  const lx = u * FOOT_L * (p.side < 0 ? 1 : -1);
  const ly = v * FOOT_L;
  const c = Math.cos(p.ang);
  const s = Math.sin(p.ang);
  return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
}

// ------------------------------------------------------------------------------------------- macro splash
interface Grain {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  vh: number;
  vz: number;
  t1: number;
  vh2: number;
  vz2: number;
  t2: number;
  delay: number;
  size: number;
  col: number;
}
const G_SLOW = 0.11;

function splash(): Grain[] {
  return memo('S08:splash', () => {
    const p = PRINTS[MACRO_K];
    const r = mulberry32(2026);
    const out: Grain[] = [];
    const parts = [
      [-0.005, 0.318, 0.15, 0.165, 3],
      [0.02, -0.125, 0.19, 0.145, 4],
      [-0.085, 0.09, 0.075, 0.2, 1],
      [0.105, -0.352, 0.068, 0.078, 1],
      [-0.05, -0.35, 0.09, 0.05, 1],
    ];
    const wsum = parts.reduce((a, q) => a + q[4], 0);
    const [ccx, ccy] = local2world(p, 0, 0);
    for (let i = 0; i < 1100; i++) {
      let pick = r() * wsum;
      let q = parts[0];
      for (const pp of parts) {
        pick -= pp[4];
        if (pick <= 0) {
          q = pp;
          break;
        }
      }
      // bias to the rim of the part (that's where sand is pushed out)
      const a = r() * Math.PI * 2;
      const rr = Math.pow(r(), 0.35);
      const [x0, y0] = local2world(p, q[0] + Math.cos(a) * q[2] * rr, q[1] + Math.sin(a) * q[3] * rr);
      let dx = x0 - ccx + (r() - 0.5) * 60;
      let dy = y0 - ccy + (r() - 0.5) * 60;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const e = r();
      const vh = 0.7 + 3.4 * e * e + r() * 0.6;
      const vz = 0.45 + 1.55 * r();
      const t1 = (2 * vz) / G_SLOW;
      const bounce = r() < 0.4;
      const vz2 = bounce ? vz * 0.3 : 0;
      out.push({
        x0,
        y0,
        dx,
        dy,
        vh,
        vz,
        t1,
        vh2: bounce ? vh * 0.4 : 0,
        vz2,
        t2: bounce ? (2 * vz2) / G_SLOW : 0,
        delay: r() * 5,
        size: 1.0 + r() * r() * 1.6,
        col: Math.floor(r() * GRAIN_COLS.length),
      });
    }
    return out;
  });
}

/** grain state at local time τ (frames since its launch): [x, y, z] */
function grainAt(g: Grain, tau: number): [number, number, number] {
  if (tau <= 0) return [g.x0, g.y0, 0];
  if (tau < g.t1) {
    const d = g.vh * tau;
    return [g.x0 + g.dx * d, g.y0 + g.dy * d, g.vz * tau - 0.5 * G_SLOW * tau * tau];
  }
  const x1 = g.x0 + g.dx * g.vh * g.t1;
  const y1 = g.y0 + g.dy * g.vh * g.t1;
  const tb = Math.min(tau - g.t1, g.t2);
  const d2 = g.vh2 * tb;
  const z2 = g.t2 > 0 ? g.vz2 * tb - 0.5 * G_SLOW * tb * tb : 0;
  // a little slide after the last landing
  const slide = g.vh2 > 0 ? 0 : Math.min(tau - g.t1, 6) * g.vh * 0.08;
  return [x1 + g.dx * (d2 + slide), y1 + g.dy * (d2 + slide), Math.max(0, z2)];
}

// ------------------------------------------------------------------------------------------- per-print puffs
interface Puff {
  dx: number;
  dy: number;
  v: number;
  vz: number;
  u: number;
  w: number;
}
function puffGrains(k: number): Puff[] {
  return memo('S08:puff:' + k, () => {
    const r = mulberry32(500 + k);
    const out: Puff[] = [];
    for (let i = 0; i < 34; i++) {
      const toe = r() < 0.55;
      const a = toe ? -Math.PI / 2 + (r() - 0.5) * 2.2 : Math.PI / 2 + (r() - 0.5) * 2.6;
      out.push({ dx: Math.cos(a), dy: Math.sin(a), v: 1.5 + r() * 5, vz: 1 + r() * 2.6, u: (r() - 0.5) * 0.3, w: toe ? -0.32 : 0.36 });
    }
    return out;
  });
}

// ------------------------------------------------------------------------------------------- main draw
export interface GroundState {
  /** 0..1 strength of the rewind attempt (grains strain backwards, tears) */
  rewind: number;
  /** 0..1 global fade of ground fx (sand → darkness) */
  fade: number;
  /** 0..1 the rewind's target (cyan, the time-symmetric law): grain origins + their way back */
  ghost: number;
  /** 0..1 the rewind failed: the target shatters */
  shatter: number;
}

const CYAN = '57,225,255';

export function drawGround(ctx: CanvasRenderingContext2D, f: number, cam: Cam, st: GroundState) {
  const z = cam.z;
  const X = (x: number) => cam.ax + (x - cam.cx) * z;
  const Y = (y: number) => cam.ay + (y - cam.cy) * z;
  if (st.fade <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = st.fade;

  // ---- foot shadows of the invisible walker (approach → contact → heel-first lift, swinging forward).
  // The penumbra widens with the sole's height above the sand, so the shadow sharpens into a crisp foot as it lands.
  for (const p of PRINTS) {
    if (p.k < 2) continue;
    const macro = p.k === MACRO_K;
    const pre = macro ? 30 : 10;
    const post = macro ? 16 : 9;
    const a = f - p.T;
    if (a <= -pre || a >= post) continue;
    const hmax = macro ? 80 : 46;
    const h = a < 0 ? hmax * Math.pow(-a / pre, macro ? 1.5 : 1.25) : hmax * 0.6 * Math.pow(a / post, 1.3);
    const fwd = a > 0 ? (a / post) * (macro ? 30 : 60) : 0;
    const dx = SH_X * h + Math.sin(p.ang) * fwd;
    const dy = SH_Y * h - Math.cos(p.ang) * fwd;
    const fade = smoothstep(-pre, -pre + (macro ? 4 : 3), a) * (1 - smoothstep(post - 5, post, a));
    const [i, t] = levelPick(SHADOW_LEVELS, 0.9 + h * 0.13);
    const al = st.fade * fade * (macro ? 0.74 : 0.66);
    if (t < 0.98) {
      ctx.globalAlpha = al * (1 - t);
      drawPrintSprite(ctx, shadowSprite(i), p, cam, 1, dx, dy);
    }
    if (t > 0.02) {
      ctx.globalAlpha = al * t;
      drawPrintSprite(ctx, shadowSprite(i + 1), p, cam, 1, dx, dy);
    }
  }
  ctx.globalAlpha = st.fade;

  // ---- landing puffs (regular steps): dust cloud + kicked grains
  for (const p of PRINTS) {
    if (p.k < 2 || p.k === MACRO_K) continue;
    const a = f - p.T;
    if (a < 0 || a > 26) continue;
    const q = a / 26;
    // dust
    for (const [u, v] of [
      [0, 0.32],
      [0.03, -0.2],
      [0.02, -0.38],
    ]) {
      const [wx, wy] = local2world(p, u, v);
      const rr = (18 + 46 * ease.outCubic(q)) * z;
      const gx = X(wx - a * 1.6);
      const gy = Y(wy);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
      const al = 0.2 * (1 - q) * (1 - q);
      g.addColorStop(0, `rgba(240,214,170,${al})`);
      g.addColorStop(1, 'rgba(240,214,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - rr, gy - rr, rr * 2, rr * 2);
    }
    // grains
    ctx.fillStyle = '#F2DDB4';
    for (const pg of puffGrains(p.k)) {
      const tf = (2 * pg.vz) / 0.9;
      const tt = Math.min(a, tf);
      const d = pg.v * tt;
      const hz = Math.max(0, pg.vz * tt - 0.45 * tt * tt);
      const [wx, wy] = local2world(p, pg.u, pg.w);
      const gx = X(wx + pg.dx * d * (p.side < 0 ? 1 : 1));
      const gy = Y(wy + pg.dy * d);
      const sz = Math.max(1, 2.2 * z * (1 + hz * 0.02));
      ctx.globalAlpha = st.fade * (a < tf ? 0.9 : 0.7 * (1 - q));
      ctx.fillRect(gx - sz / 2, gy - sz / 2, sz, sz);
    }
    ctx.globalAlpha = st.fade;
  }

  // ---- macro splash
  if (f >= T_IMPACT - 1) {
    const grains = splash();
    const base = f - T_IMPACT;
    const jitterOn = st.rewind;
    // shadows first (cast to the left by the low sun; darker while airborne)
    const shA = shadowAtlas();
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      if (base - g.delay <= 0) continue;
      const [x, y, hz] = grainAt(g, base - g.delay);
      const w = Math.min(D_MAX + 6, Math.max(3, Math.round(g.size * z * 2.6)));
      const sp = shA[w];
      const sx = Math.round(X(x + SH_X * hz) - sp.width / 2);
      const sy = Math.round(Y(y + SH_Y * hz) - sp.height / 2);
      if (sx < -30 || sx > 1100 || sy < -30 || sy > 1940) continue;
      ctx.globalAlpha = st.fade * (hz > 0 ? 0.3 : 0.14);
      ctx.drawImage(sp, sx, sy);
    }
    // grains: pre-shaded beads (lit toward the low sun on the right), blitted unscaled
    const atlas = grainAtlas();
    ctx.lineCap = 'round';
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      const tau = base - g.delay;
      if (tau <= 0) continue;
      let [x, y, hz] = grainAt(g, tau);
      if (jitterOn > 0 && tau > g.t1 + g.t2) {
        // the rewind command strains every grain back toward where it came from — and nothing happens
        const k = jitterOn * (0.5 + 0.5 * Math.sin(f * 2.3 + i)) * 0.07;
        x += (g.x0 - x) * k + (hash01(i * 13 + f, 9) - 0.5) * 1.6 * jitterOn;
        y += (g.y0 - y) * k + (hash01(i * 17 + f, 11) - 0.5) * 1.6 * jitterOn;
      }
      const sz = g.size * z * (1 + hz * 0.012);
      const sx = X(x);
      const sy = Y(y);
      if (sx < -20 || sx > 1100 || sy < -20 || sy > 1940) continue;
      if (hz > 0.2 && tau < g.t1) {
        // motion streak
        const [px, py] = grainAt(g, tau - 1.6);
        ctx.strokeStyle = GRAIN_COLS[g.col][1];
        ctx.lineWidth = sz * 0.5;
        ctx.globalAlpha = st.fade * 0.3;
        ctx.beginPath();
        ctx.moveTo(X(px), Y(py));
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
      const d = Math.min(D_MAX, Math.max(D_MIN, Math.round(sz * 2)));
      ctx.globalAlpha = st.fade;
      ctx.drawImage(atlas[g.col][d], Math.round(sx - d / 2), Math.round(sy - d / 2));
    }
    ctx.globalAlpha = st.fade;

    // ---- the rewind's target: where every grain came from (the laws would allow the way back) — then it shatters
    if (st.ghost > 0.003) {
      const sh = ease.outCubic(st.shatter);
      const p = PRINTS[MACRO_K];
      const flick = 0.75 + 0.25 * hash01(Math.floor(f), 93);
      const paths = new Path2D();
      const dots = new Path2D();
      const r = Math.max(1, 1.05 * z);
      for (let i = 0; i < grains.length; i += 7) {
        const g = grains[i];
        let ox = g.x0;
        let oy = g.y0;
        if (sh > 0) {
          const a = hash01(i, 95) * Math.PI * 2;
          const v = 20 + 70 * hash01(i, 96);
          ox += ((g.x0 - p.x) * 0.5 + Math.cos(a) * v) * sh;
          oy += ((g.y0 - p.y) * 0.5 + Math.sin(a) * v) * sh;
        }
        const sx = X(ox);
        const sy = Y(oy);
        if (sx < -10 || sx > 1090 || sy < -10 || sy > 1930) continue;
        dots.moveTo(sx + r, sy);
        dots.arc(sx, sy, r, 0, Math.PI * 2);
        if (i % 15 === 0 && sh < 0.05) {
          const tau = base - g.delay;
          if (tau > 0) {
            const [x, y] = grainAt(g, tau);
            paths.moveTo(X(x), Y(y));
            paths.lineTo(sx, sy);
          }
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${CYAN},1)`;
      ctx.globalAlpha = Math.min(1, st.fade * st.ghost * 1.1 * flick * (1 - sh));
      ctx.fill(dots);
      ctx.strokeStyle = `rgba(${CYAN},1)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.globalAlpha = Math.min(1, st.fade * st.ghost * 1.6 * flick);
      ctx.stroke(paths);
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = st.fade;
    }

    // ---- infrared heat: the dissipated energy of the impact (waste red), spreading and fading
    const age = base;
    if (age >= 0 && age < 70) {
      const p = PRINTS[MACRO_K];
      const cx = X(p.x);
      const cy = Y(p.y);
      ctx.globalCompositeOperation = 'lighter';
      const rr = (70 + 220 * ease.outCubic(clamp(age / 50))) * z * 0.6;
      const a = 0.3 * Math.exp(-age / 16) * Math.min(1, age / 2);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, `rgba(255,90,40,${a})`);
      g.addColorStop(0.5, `rgba(200,40,30,${a * 0.45})`);
      g.addColorStop(1, 'rgba(120,14,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      // IR "photons": many small red sparks leaving in all directions
      for (let i = 0; i < 70; i++) {
        const t0 = hash01(i, 41) * 14;
        const la = age - t0;
        if (la < 0 || la > 34) continue;
        const ang = hash01(i, 42) * Math.PI * 2;
        const sp = 2.2 + hash01(i, 43) * 4.5;
        const [ox, oy] = local2world(p, (hash01(i, 44) - 0.5) * 0.3, (hash01(i, 45) - 0.5) * 0.8);
        const d = sp * la;
        const al = (1 - la / 34) * 0.85;
        ctx.fillStyle = `rgba(255,${Math.round(70 + 60 * (1 - la / 34))},40,${al})`;
        const s = Math.max(1.2, 1.6 * z * 0.6);
        ctx.fillRect(X(ox + Math.cos(ang) * d) - s / 2, Y(oy + Math.sin(ang) * d) - s / 2, s, s);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ---- wind: saltating grains streaming right → left (world-anchored, wrapped around the view)
  const windA = seg(f, 50, 110) * (1 - seg(f, 330, 370));
  if (windA > 0) {
    const W = 1400 / z;
    const H = 2200 / z;
    ctx.strokeStyle = '#F6DFB2';
    ctx.lineCap = 'round';
    // batched into 3 brightness buckets × (head, tail)
    const heads = [new Path2D(), new Path2D(), new Path2D()];
    const tails = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < 190; i++) {
      const v = 7 + hash01(i, 61) * 9; // world px / frame
      const x0 = hash01(i, 62) * 4000;
      const y0 = hash01(i, 63) * 4000;
      let wx = x0 - v * f - cam.cx;
      wx = (((wx % W) + W * 1.5) % W) - W / 2 + cam.cx;
      let wy = y0 - cam.cy;
      wy = (((wy % H) + H * 1.5) % H) - H / 2 + cam.cy + Math.sin(f * 0.3 + i) * 3;
      const len = v * (1.4 + 1.6 * hash01(i, 65)) * z;
      const sx = X(wx);
      const sy = Y(wy);
      if (sx < -60 || sx > 1140 || sy < -20 || sy > 1940) continue;
      const hop = Math.sin(f * 0.18 + i * 1.7) * 1.2 * z;
      const b = Math.min(2, Math.floor(hash01(i, 64) * 3));
      heads[b].moveTo(sx, sy);
      heads[b].lineTo(sx + len * 0.35, sy - hop * 0.35);
      tails[b].moveTo(sx + len * 0.35, sy - hop * 0.35);
      tails[b].lineTo(sx + len, sy - hop);
    }
    ctx.lineWidth = Math.max(0.8, 1.3 * z);
    for (let b = 0; b < 3; b++) {
      const a0 = st.fade * windA * (0.12 + 0.08 * b) * (1 - 0.8 * Math.min(1, Math.max(0, (z - 0.9) / 1.2)));
      ctx.globalAlpha = a0;
      ctx.stroke(heads[b]);
      ctx.globalAlpha = a0 * 0.4;
      ctx.stroke(tails[b]);
    }
    ctx.globalAlpha = st.fade;
  }

  // ---- rewind-attempt tears
  if (st.rewind > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const fr = Math.floor(f);
    for (let i = 0; i < 14; i++) {
      if (hash01(i * 31 + fr, 71) > 0.35 + 0.5 * st.rewind) continue;
      const y = hash01(i * 7 + fr, 72) * 1920;
      const h = 1 + hash01(i * 5 + fr, 73) * 5;
      if (y + h > CAP_Y0 && y < CAP_Y1) continue;
      const x0 = hash01(i * 3 + fr, 74) * 600;
      const w = 200 + hash01(i * 11 + fr, 75) * 800;
      ctx.fillStyle = i % 2 ? `rgba(255,40,80,${0.35 * st.rewind})` : `rgba(40,220,255,${0.3 * st.rewind})`;
      ctx.fillRect(x0, y, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

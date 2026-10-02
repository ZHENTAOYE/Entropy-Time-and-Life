// S08 — the S07 → S08 thermal handoff, rebuilt pixel-for-pixel.
// S07's last frame (f899) shows its residual-heat footprints as
//   (1) the 360×640 sensor grid (3 px cells, two separable box blurs r = 2, tone curve 1 − e^(−G·4.1)) upscaled to the
//       frame with smoothing, and
//   (2) the full-resolution analytic print on top with 'lighten',
// both through S07's inferno LUT (index 0 = #05030F). The analytic field below is a copy of S07_Vortex/thermal.ts
// (footHeat, FEET_W, FOOT_L, top-view camera ax 541, ay 970, zoom 41/49, footprintHeat 0.95). S08 then cools the prints
// by scaling the heat (inferno ramp yellow → purple → floor) while the sand sweeps in from the right.
import { clamp, hexToRgb, memo } from '../../lib/math';
import { cpuCanvas } from './CpuCanvas';
import { Cam } from './trail';

const CELL = 3;
const GAIN = 4.1;
const FOOT_L7 = 179;
const FP_H = 0.95;
const ZOOM7 = 41 / 49;
const AX7 = 541;
const AY7 = 970;
const FEET_W = [
  { X: -49, Z: -24, medial: 1 },
  { X: 49, Z: 24, medial: -1 },
];
export const FLOOR = '#05030F';

/** inferno LUT exactly as S07 builds it */
const LUT = memo('S08:thLut', () => {
  const stops = ['#05030F', '#1B0C41', '#4A0C6B', '#781C6D', '#A52C60', '#CF4446', '#ED6925', '#FB9B06', '#F7D13D', '#FCFFA4'].map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    const u = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * u;
  }
  return lut;
});

/** S07's residual heat of one footprint (u along the toes, v toward the big toe), smooth union of the sole parts */
function footHeat(u: number, v: number, L: number): number {
  const el = (cu: number, cv: number, ru: number, rv: number) => {
    const du = (u - cu * L) / (ru * L);
    const dv = (v - cv * L) / (rv * L);
    const d = du * du + dv * dv;
    return d < 1 ? Math.pow(1 - d, 1.25) : 0;
  };
  const cap = (u0: number, v0: number, u1: number, v1: number, r: number) => {
    const ax = u1 - u0;
    const ay = v1 - v0;
    const t = clamp(((u / L - u0) * ax + (v / L - v0) * ay) / (ax * ax + ay * ay));
    const dx = u / L - (u0 + ax * t);
    const dy = v / L - (v0 + ay * t);
    const d = (dx * dx + dy * dy) / (r * r);
    return d < 1 ? Math.pow(1 - d, 1.25) : 0;
  };
  let keep = 1;
  const add = (q: number) => {
    keep *= 1 - Math.min(0.999, q);
  };
  add(1.0 * el(-0.3, -0.01, 0.165, 0.145));
  add(0.72 * cap(-0.22, -0.075, 0.08, -0.1, 0.1));
  add(1.0 * el(0.15, 0.0, 0.125, 0.19));
  add(0.9 * el(0.365, 0.115, 0.078, 0.066));
  add(0.72 * el(0.345, 0.03, 0.052, 0.045));
  add(0.66 * el(0.322, -0.038, 0.047, 0.041));
  add(0.6 * el(0.292, -0.098, 0.043, 0.038));
  add(0.54 * el(0.258, -0.148, 0.039, 0.034));
  return 1 - keep;
}

/** field at screen point (sx, sy) of S07's last frame (top view) */
function fieldAt(sx: number, sy: number): number {
  const X = (sx - AX7) / ZOOM7;
  const Z = -(sy - AY7) / ZOOM7;
  let h = 0;
  for (const ft of FEET_W) {
    const u = Z - ft.Z;
    const vv = (X - ft.X) * ft.medial;
    if (Math.abs(u) < FOOT_L7 * 0.6 && Math.abs(vv) < FOOT_L7 * 0.3) h = Math.max(h, footHeat(u, vv, FOOT_L7));
  }
  return h;
}

// region of interest (screen px of S07's last frame, = S08 world px)
const SX0 = 432;
const SY0 = 816;
const SW = 216; // multiple of CELL
const SH = 312;
const GX0 = SX0 / CELL;
const GY0 = SY0 / CELL;
const GW = SW / CELL;
const GH = SH / CELL;

interface ThermalData {
  grid: Float32Array; // tone-mapped sensor value per cell (GW×GH)
  sharp: Float32Array; // full-res analytic value × footprintHeat (SW×SH)
}

function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horiz: boolean) {
  const n = 2 * r + 1;
  if (horiz) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        dst[row + x] = acc / n;
        acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += src[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = acc / n;
        acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
      }
    }
  }
}

function data(): ThermalData {
  return memo('S08:thermalData', () => {
    const G = new Float32Array(GW * GH);
    const G2 = new Float32Array(GW * GH);
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++) {
        const h = fieldAt((GX0 + gx + 0.5) * CELL, (GY0 + gy + 0.5) * CELL);
        if (h > 0) G[gy * GW + gx] = (-Math.log(1 - Math.min(0.97, h * FP_H)) / GAIN) * 0.55;
      }
    for (let k = 0; k < 2; k++) {
      boxPass(G, G2, GW, GH, 2, true);
      boxPass(G2, G, GW, GH, 2, false);
    }
    for (let j = 0; j < G.length; j++) G[j] = 1 - Math.exp(-G[j] * GAIN);
    const S = new Float32Array(SW * SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) S[y * SW + x] = fieldAt(SX0 + x + 0.5, SY0 + y + 0.5) * FP_H;
    return { grid: G, sharp: S };
  });
}

/**
 * Draw the thermal floor + prints for S08 frame f (heat multiplier k: 1 = S07's last frame) into ctx (logical px),
 * pre-mixed with the incoming sand: alpha = 1 − sm(x), sm(x) = clamp(sand·1.5 − (1 − x/1080)·0.5) — the sand is
 * already in ctx below. `shimmer` 0..1 = faint heat haze on the prints.
 */
export function drawThermalHandoff(ctx: CanvasRenderingContext2D, f: number, cam: Cam, k: number, sand: number, shimmer: number) {
  // alpha ramp (1 − sm) as a horizontal gradient; screen x → world x (the thermal floor lives on the sand plane)
  const A = sand * 1.5 - 0.5;
  const sx0 = ((0 - A) / 0.5) * 1080; // sm = 0
  const sx1 = ((1 - A) / 0.5) * 1080; // sm = 1
  if (sx1 <= 0) return; // fully sand
  const wx0 = cam.cx + (sx0 - cam.ax) / cam.z;
  const wx1 = cam.cx + (sx1 - cam.ax) / cam.z;
  const [fr, fg, fb] = hexToRgb(FLOOR);
  ctx.save();
  ctx.translate(cam.ax - cam.cx * cam.z, cam.ay - cam.cy * cam.z);
  ctx.scale(cam.z, cam.z);
  // floor everywhere except the inner print region (that one comes from the region canvas, same ramp)
  const M = 4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-3000, -3000, 7000, 8000);
  ctx.rect(SX0 + M, SY0 + M, SW - 2 * M, SH - 2 * M);
  ctx.clip('evenodd');
  const gF = ctx.createLinearGradient(wx0, 0, wx1, 0);
  gF.addColorStop(0, `rgba(${fr},${fg},${fb},1)`);
  gF.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
  ctx.fillStyle = gF;
  ctx.fillRect(-3000, -3000, 7000, 8000);
  ctx.restore();

  const d = data();
  const L = LUT;
  const kk = Math.max(0, k);
  // (1) sensor grid → small canvas (cells)
  const [gc, gctx, gimg] = memo('S08:thGridCv', () => {
    const c = cpuCanvas(GW, GH);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    return [c, x, x.createImageData(GW, GH)] as [HTMLCanvasElement, CanvasRenderingContext2D, ImageData];
  });
  const gd = gimg.data;
  for (let j = 0; j < d.grid.length; j++) {
    const i = Math.max(0, Math.min(255, (clamp(d.grid[j] * kk) * 255) | 0)) * 3;
    const o = j * 4;
    gd[o] = L[i];
    gd[o + 1] = L[i + 1];
    gd[o + 2] = L[i + 2];
    gd[o + 3] = 255;
  }
  gctx.putImageData(gimg, 0, 0);
  // (2) analytic print → full-res canvas
  const [sc, sctx, simg] = memo('S08:thSharpCv', () => {
    const c = cpuCanvas(SW, SH);
    const x = c.getContext('2d', { willReadFrequently: true })!;
    return [c, x, x.createImageData(SW, SH)] as [HTMLCanvasElement, CanvasRenderingContext2D, ImageData];
  });
  const sd = simg.data;
  for (let j = 0; j < d.sharp.length; j++) {
    const v = d.sharp[j] * kk;
    const o = j * 4;
    if (v <= 0.004) {
      sd[o + 3] = 0;
      continue;
    }
    const i = Math.min(255, (v * 255) | 0) * 3;
    sd[o] = L[i];
    sd[o + 1] = L[i + 1];
    sd[o + 2] = L[i + 2];
    sd[o + 3] = 255;
  }
  sctx.putImageData(simg, 0, 0);
  // (3) compose the region exactly like S07 (grid upscaled with smoothing, print with 'lighten'), then the ramp
  const [rc, rctx] = memo('S08:thRegionCv', () => {
    const c = cpuCanvas(SW, SH);
    return [c, c.getContext('2d', { willReadFrequently: true })!] as [HTMLCanvasElement, CanvasRenderingContext2D];
  });
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalCompositeOperation = 'source-over';
  rctx.globalAlpha = 1;
  rctx.imageSmoothingEnabled = true;
  rctx.drawImage(gc, 0, 0, GW, GH, 0, 0, SW, SH);
  rctx.globalCompositeOperation = 'lighten';
  rctx.drawImage(sc, 0, 0);
  rctx.globalCompositeOperation = 'destination-in';
  const gR = rctx.createLinearGradient(wx0 - SX0, 0, wx1 - SX0, 0);
  gR.addColorStop(0, 'rgba(0,0,0,1)');
  gR.addColorStop(1, 'rgba(0,0,0,0)');
  rctx.fillStyle = gR;
  rctx.fillRect(0, 0, SW, SH);
  rctx.globalCompositeOperation = 'source-over';

  // place it (clipped to the inner rect), with a faint heat haze (row-wise shimmer)
  ctx.beginPath();
  ctx.rect(SX0 + M, SY0 + M, SW - 2 * M, SH - 2 * M);
  ctx.clip();
  if (shimmer > 0.01) {
    const STRIP = 4;
    for (let y = 0; y < SH; y += STRIP) {
      const dx = shimmer * 1.4 * Math.sin((SY0 + y) * 0.06 + f * 0.5 + Math.sin((SY0 + y) * 0.017 + f * 0.11) * 2.2);
      ctx.drawImage(rc, 0, y, SW, STRIP, SX0 + dx, SY0 + y, SW, STRIP);
    }
  } else ctx.drawImage(rc, SX0, SY0);
  ctx.restore();
}

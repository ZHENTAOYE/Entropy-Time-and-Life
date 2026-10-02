// The thermal camera. A 360×640 float "temperature" grid (1 cell = 3 px):
//   body particles splatted with their tissue warmth (deep = warm, thin limbs cooler, outgoing heat = warm halo),
//   their reflection on the glossy floor, a convection plume with breath pulses, the residual-heat footprints,
//   and (for the W/kg beat) the Sun's limb.
// → separable box blur → tone curve → inferno LUT (index 0 = #05030F, the S08 floor) → ImageData.
import { clamp, memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { hexToRgb } from '../../lib/math';
import { bodyData, HEART, N_BODY } from './body';
import { bodyFrame, dissolve } from './bodyDraw';
import { Cam, camAt, floorHit, project } from './camera';
import { ST_EXT, ST_LINGER, ST_OUT, ST_TREE } from './flow';
import { T } from './timing';
import { beatPulse } from './heart';
import { exhaleRate, forExhale } from './breath';
import { flowTime } from './flow';

export const TW = 360;
export const TH = 640;
const CELL = 1080 / TW;

/** inferno, anchored at the S08 floor colour */
export const LUT = memo('s07:lut', () => {
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
export const lutCss = (t: number, a = 1) => {
  const i = Math.max(0, Math.min(255, Math.round(t * 255))) * 3;
  const L = LUT;
  return `rgba(${L[i]},${L[i + 1]},${L[i + 2]},${a})`;
};

// sensor grids: coverage weight W, weight × temperature WT (→ the average temperature of what covers a cell), and an
// additive halo F (warm exhaled air, residual heat in the floor)
const GW = new Float32Array(TW * TH);
const GT = new Float32Array(TW * TH);
const GF = new Float32Array(TW * TH);
const TMP = new Float32Array(TW * TH);

function splat(G: Float32Array, x: number, y: number, w: number) {
  const gx = x / CELL - 0.5;
  const gy = y / CELL - 0.5;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  if (ix < 0 || iy < 0 || ix >= TW - 1 || iy >= TH - 1) return;
  const fx = gx - ix;
  const fy = gy - iy;
  const o = iy * TW + ix;
  G[o] += w * (1 - fx) * (1 - fy);
  G[o + 1] += w * fx * (1 - fy);
  G[o + TW] += w * (1 - fx) * fy;
  G[o + TW + 1] += w * fx * fy;
}

function boxBlur(G: Float32Array, r: number) {
  const n = 2 * r + 1;
  const G2 = TMP;
  // horizontal G → G2
  for (let y = 0; y < TH; y++) {
    const row = y * TW;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += G[row + Math.min(TW - 1, Math.max(0, x))];
    for (let x = 0; x < TW; x++) {
      G2[row + x] = acc / n;
      acc += G[row + Math.min(TW - 1, x + r + 1)] - G[row + Math.max(0, x - r)];
    }
  }
  // vertical G2 → G
  for (let x = 0; x < TW; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += G2[Math.min(TH - 1, Math.max(0, y)) * TW + x];
    for (let y = 0; y < TH; y++) {
      G[y * TW + x] = acc / n;
      acc += G2[Math.min(TH - 1, y + r + 1) * TW + x] - G2[Math.max(0, y - r) * TW + x];
    }
  }
}

/** body heat level (freeze drains it; the restart floods it back from the chest as a wave) */
export function heatLevel(f: number): number {
  const frozen = f < T.restart ? smoothstep(T.freeze1, T.freeze1 + 40, f) : 1;
  return 1 - 0.9 * frozen;
}
/** the frozen body's temperature index (cold violet) */
const T_COLD = 0.3;
/** skin temperature index of tissue warmth `warm` at heat mix hm (0.1 = frozen … 1 = alive) */
// the sensor auto-ranges its span to the scene: 26–37 °C (the room, ~22 °C, falls below the bottom of the bar).
// skin index t on the 20–37 °C scale → displayed index (t − 0.353)/0.647
const span = (t: number) => (t - 0.353) / 0.647;
const tissueT = (warm: number, hm: number) => T_COLD + (span(warm) - T_COLD) * clamp((hm - 0.1) / 0.9);
function restartWave(f: number, X: number, H: number): number {
  if (f < T.restart) return 0;
  const d = Math.hypot(X - HEART[0], H - HEART[1]);
  return smoothstep(0, 90, (f - T.restart) * 26 - d);
}

/** residual heat of one footprint at local coords (u along the toes, v toward the big toe), L = length */
function footHeat(u: number, v: number, L: number): number {
  const el = (cu: number, cv: number, ru: number, rv: number) => {
    const du = (u - cu * L) / (ru * L);
    const dv = (v - cv * L) / (rv * L);
    const d = du * du + dv * dv;
    return d < 1 ? Math.pow(1 - d, 1.25) : 0;
  };
  // capsule along the outer (lateral) edge connecting heel and ball
  const cap = (u0: number, v0: number, u1: number, v1: number, r: number) => {
    const ax = u1 - u0;
    const ay = v1 - v0;
    const t = clamp(((u / L - u0) * ax + (v / L - v0) * ay) / (ax * ax + ay * ay));
    const dx = u / L - (u0 + ax * t);
    const dy = v / L - (v0 + ay * t);
    const d = (dx * dx + dy * dy) / (r * r);
    return d < 1 ? Math.pow(1 - d, 1.25) : 0;
  };
  // smooth union (probabilistic OR) so heel, outer band, ball and toes read as ONE contiguous sole
  let keep = 1;
  const add = (v: number) => {
    keep *= 1 - Math.min(0.999, v);
  };
  add(1.0 * el(-0.3, -0.01, 0.165, 0.145)); // heel
  add(0.72 * cap(-0.22, -0.075, 0.08, -0.1, 0.1)); // outer band (the arch is lifted, so the inner side is missing)
  add(1.0 * el(0.15, 0.0, 0.125, 0.19)); // ball of the foot
  add(0.9 * el(0.365, 0.115, 0.078, 0.066)); // big toe
  add(0.72 * el(0.345, 0.03, 0.052, 0.045));
  add(0.66 * el(0.322, -0.038, 0.047, 0.041));
  add(0.6 * el(0.292, -0.098, 0.043, 0.038));
  add(0.54 * el(0.258, -0.148, 0.039, 0.034));
  return 1 - keep;
}

/** world footprint placement: feet under the figure, left one a little behind (mid-step); toes toward +Z */
export const FOOT_L = 179;
export const FEET_W = [
  { X: -49, Z: -24, medial: 1 },
  { X: 49, Z: 24, medial: -1 },
];
export const footprintHeat = (f: number) => 0.95 * smoothstep(T.dissolve0 + 14, T.dissolve0 + 40, f);

const noise = makeNoise(707);

export interface ThermalOpts {
  sun: number; // 0..1 Sun limb visibility
  wall: number; // ambient level of the room
}

export const SUN_R = 1150;
export function sunY(f: number) {
  const inn = smoothstep(T.sunIn0, T.sunIn1, f);
  const out = smoothstep(T.sunOut0, T.sunOut1, f);
  return -1480 + 750 * inn - 680 * out; // limb bottom at y = 420 when in
}

/** coverage gain (cells fully covered by tissue → opaque), halo gain */
const KC = 12;
const GAIN = 4.1;
export function renderThermalGrid(f: number, cam: Cam): Float32Array {
  GW.fill(0);
  GT.fill(0);
  GF.fill(0);
  const B = bodyData();
  const bf = bodyFrame(f, cam);
  const lvl = heatLevel(f);
  const pr = new Float32Array(3);
  const w11 = new Float32Array(11);
  const dis = smoothstep(T.dissolve0 - 4, T.tilt2b, f);
  const refl = cam.sp < 0.7 && dis < 1;
  // ---- base: the time-averaged body (every seat, noise-free) — what the flow looks like to a slow sensor
  for (let s = 0; s < B.ns; s++) {
    w11[0] = B.sx[s];
    w11[1] = B.sh[s];
    w11[2] = B.sz[s];
    w11[10] = 1;
    if (f > T.dissolve0) dissolve(s + 7777, f, w11);
    if (w11[10] <= 0.002) continue;
    if (!project(cam, w11[0], w11[1], w11[2], pr, 0)) continue;
    const hm = Math.max(lvl, restartWave(f, B.sx[s], B.sh[s]));
    const Tt = tissueT(B.warm[s] * (1 + 0.09 * beatPulse(f, B.sx[s], B.sh[s])), hm);
    // a rising, dissolving body is warm air: its coverage thins out, its temperature stays
    const w = 0.82 * w11[10] * pr[2] * pr[2];
    splat(GW, pr[0], pr[1], w);
    splat(GT, pr[0], pr[1], w * Tt);
    if (refl && (s & 1) === 0 && project(cam, w11[0], -w11[1], w11[2], pr, 0)) {
      // glossy floor: a dimmer, cooler mirror image (reflectance ≈ 0.3)
      const wr = 0.55 * w * Math.exp(-w11[1] / 520) * (1 - dis);
      splat(GW, pr[0], pr[1], wr);
      splat(GT, pr[0], pr[1], wr * Tt * 0.62);
    }
  }
  // ---- live flow: heat carried out through the skin (warm halo), warm blood in the vessels, the cool inflow
  for (let i = 0; i < bf.n; i++) {
    if (!bf.vis[i]) continue;
    const st = bf.state[i];
    if (st === ST_LINGER || st === ST_EXT) continue;
    const hm = Math.max(lvl, restartWave(f, bf.wx[i], bf.wh[i]));
    const k2 = bf.k[i] * bf.k[i] * bf.fade[i];
    if (st === ST_TREE) {
      const w = 0.35 * k2;
      splat(GW, bf.sx[i], bf.sy[i], w);
      splat(GT, bf.sx[i], bf.sy[i], w * tissueT(Math.min(0.95, B.warm[bf.slot[i]] + 0.04), hm));
    } else if (st === ST_OUT) splat(GF, bf.sx[i], bf.sy[i], 0.75 * (1 - bf.age[i]) * k2 * clamp((hm - 0.1) / 0.9));
    else splat(GF, bf.sx[i], bf.sy[i], 0.12 * k2);
  }
  // ---- the breath: warm exhaled air (CO₂ · H₂O) leaving the mouth every 4 s
  const brA = clamp((lvl - 0.1) / 0.9) * (1 - smoothstep(T.dissolve0, T.dissolve0 + 16, f));
  if (brA > 0.01)
    forExhale(f, (p, q, w) => {
      if (!project(cam, p[0], p[1], p[2], pr, 0)) return;
      splat(GF, pr[0], pr[1], 1.1 * brA * w * (1 - q) * (1 - 0.5 * q) * pr[2] * pr[2]);
    });
  // ---- residual-heat footprints (in the floor), added before the blur so they get the sensor's softness
  const fpH = footprintHeat(f);
  if (fpH > 0.002) {
    const fb = footBounds(cam);
    const gx0 = Math.max(0, Math.floor(fb[0] / CELL));
    const gx1 = Math.min(TW - 1, Math.ceil(fb[2] / CELL));
    const gy0 = Math.max(0, Math.floor(fb[1] / CELL));
    const gy1 = Math.min(TH - 1, Math.ceil(fb[3] / CELL));
    for (let gy = gy0; gy <= gy1; gy++)
      for (let gx = gx0; gx <= gx1; gx++) {
        const hit = floorHit(cam, (gx + 0.5) * CELL, (gy + 0.5) * CELL);
        if (!hit) continue;
        let h = 0;
        for (const ft of FEET_W) {
          const u = hit[1] - ft.Z;
          const vv = (hit[0] - ft.X) * ft.medial;
          if (Math.abs(u) < FOOT_L * 0.6 && Math.abs(vv) < FOOT_L * 0.3) h = Math.max(h, footHeat(u, vv, FOOT_L));
        }
        if (h > 0) GF[gy * TW + gx] += (-Math.log(1 - Math.min(0.97, h * fpH)) / GAIN) * 0.55;
      }
  }
  for (const G of [GW, GT, GF]) {
    boxBlur(G, 2);
    boxBlur(G, 2);
  }
  // radiance (as a temperature index): covered cells show their tissue temperature, the halo adds where uncovered
  for (let j = 0; j < GW.length; j++) {
    const w = GW[j];
    const a = 1 - Math.exp(-w * KC);
    const vb = w > 1e-5 ? (a * GT[j]) / w : 0;
    const vh = 1 - Math.exp(-GF[j] * GAIN);
    GF[j] = vb + (1 - a) * vh;
  }
  return GF;
}

/** Full thermal image for frame f into a 360×640 2D context. */
export function drawThermal(ctx: CanvasRenderingContext2D, f: number) {
  const cam = camAt(f);
  const g = renderThermalGrid(f, cam);
  const img = memo('s07:thimg', () => ctx.createImageData(TW, TH));
  const d = img.data;
  const L = LUT;
  // ---- per-row floor geometry
  const tilt2 = smoothstep(T.tilt2a, T.tilt2b, f);
  const wallLvl = 0.06 * (1 - tilt2);
  const floorLvl = 0.032 * (1 - smoothstep(T.tilt2a, T.tilt2b - 6, f));
  // head (plume source) on screen
  const hp = new Float32Array(3);
  const headOn = project(cam, 0, 1010, 0, hp, 0);
  const plumeA = 0.36 * heatLevelSoft(f) * (1 - smoothstep(T.dissolve0, T.tilt2b - 10, f));
  // the plume swells after each exhale
  const breath = 0.65 + 0.45 * exhaleRate(flowTime(f - 12));
  const sunA = smoothstep(T.sunIn0, T.sunIn0 + 12, f) * (1 - smoothstep(T.sunOut0 + 10, T.sunOut1, f));
  const sy = sunY(f);
  const t3 = f * 0.012;
  for (let y = 0; y < TH; y++) {
    const py = (y + 0.5) * CELL;
    const hitC = floorHit(cam, 540, py);
    const fl = hitC ? 1 - smoothstep(2600, 9000, hitC[2]) : 0;
    const rowAmb = floorLvl * fl + wallLvl * (1 - fl);
    for (let x = 0; x < TW; x++) {
      const px = (x + 0.5) * CELL;
      const j = y * TW + x;
      let v = g[j];
      // ambient room: faint large-scale structure
      let amb = rowAmb;
      if (amb > 0.002) amb *= 0.8 + 0.4 * (0.5 + 0.5 * noise.n2(px * 0.0016, py * 0.0012 + 3));
      // convection plume over the head
      if (headOn && plumeA > 0.002 && py < hp[1] + 30) {
        const dh = hp[1] + 30 - py;
        const wdt = (34 + 0.42 * dh) * hp[2];
        const u = (px - hp[0] - Math.sin(py * 0.006 + f * 0.03) * 0.18 * dh) / wdt;
        if (u > -2.2 && u < 2.2) {
          const env = Math.exp(-u * u * 1.6) * Math.exp(-dh / (720 * hp[2])) * smoothstep(0, 60, dh + 20);
          const wisp = 0.55 + 0.75 * noise.n3(px * 0.011, (py + f * 3.2) * 0.009, t3);
          v += plumeA * breath * env * Math.max(0, wisp);
        }
      }
      // the Sun's limb (W/kg view: 0.0002 W/kg → barely above the floor of the scale)
      if (sunA > 0) {
        const dx = px - 540;
        const dy = py - sy;
        const rr = Math.sqrt(dx * dx + dy * dy);
        if (rr < SUN_R + 120) {
          const mu = Math.sqrt(Math.max(0, 1 - (rr * rr) / (SUN_R * SUN_R)));
          const gran = Math.abs(noise.n2(px * 0.022, py * 0.022 + f * 0.008));
          const disc = rr < SUN_R ? 0.1 + 0.07 * mu + 0.05 * gran : 0;
          const rim = 0.3 * Math.max(0, 1 - Math.abs(rr - SUN_R) / 10);
          const halo = 0.06 * Math.exp(-Math.max(0, rr - SUN_R) / 50);
          amb = Math.max(amb, sunA * Math.max(disc, halo, rim));
        }
      }
      v = Math.max(v, amb) + amb * 0.3;
      const k = Math.max(0, Math.min(255, (clamp(v) * 255) | 0)) * 3;
      const o = j * 4;
      d[o] = L[k];
      d[o + 1] = L[k + 1];
      d[o + 2] = L[k + 2];
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function heatLevelSoft(f: number) {
  return Math.max(heatLevel(f), f >= T.restart ? smoothstep(T.restart, T.restart + 30, f) : 0);
}

/** screen-space bounding box of both footprints */
function footBounds(cam: Cam): [number, number, number, number] {
  const p = new Float32Array(3);
  let x0 = 1e9;
  let y0 = 1e9;
  let x1 = -1e9;
  let y1 = -1e9;
  for (const ft of FEET_W)
    for (const [du, dv] of [
      [-0.6, -0.3],
      [-0.6, 0.3],
      [0.6, -0.3],
      [0.6, 0.3],
    ]) {
      if (!project(cam, ft.X + dv * FOOT_L, 0, ft.Z + du * FOOT_L, p, 0)) continue;
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
  return [x0 - 6, y0 - 6, x1 + 6, y1 + 6];
}

/** The residual-heat footprints at full resolution (per pixel, through the camera), over the thermal image. */
export function drawFootprints(ctx: CanvasRenderingContext2D, f: number) {
  const fpH = footprintHeat(f);
  if (fpH <= 0.002) return;
  const cam = camAt(f);
  const fb = footBounds(cam);
  const x0 = Math.max(0, Math.floor(fb[0]));
  const y0 = Math.max(0, Math.floor(fb[1]));
  const w = Math.min(1080, Math.ceil(fb[2])) - x0;
  const h = Math.min(1920, Math.ceil(fb[3])) - y0;
  if (w <= 2 || h <= 2) return;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const L = LUT;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hit = floorHit(cam, x0 + x + 0.5, y0 + y + 0.5);
      if (!hit) continue;
      let v = 0;
      for (const ft of FEET_W) {
        const u = hit[1] - ft.Z;
        const vv = (hit[0] - ft.X) * ft.medial;
        if (Math.abs(u) < FOOT_L * 0.6 && Math.abs(vv) < FOOT_L * 0.3) v = Math.max(v, footHeat(u, vv, FOOT_L));
      }
      v *= fpH;
      if (v <= 0.004) continue;
      const k = Math.min(255, (v * 255) | 0) * 3;
      const o = (y * w + x) * 4;
      d[o] = L[k];
      d[o + 1] = L[k + 1];
      d[o + 2] = L[k + 2];
      d[o + 3] = 255;
    }
  const [c, cx] = memoCanvas(w, h);
  cx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighten'; // never darken the sensor image (no dark rims)
  ctx.drawImage(c, 0, 0, w, h, x0, y0, w, h);
  ctx.restore();
}
function memoCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, x] = memo('s07:fpcanvas', () => {
    const cc = document.createElement('canvas');
    cc.width = 1080;
    cc.height = 1920;
    return [cc, cc.getContext('2d', { willReadFrequently: true })!] as [HTMLCanvasElement, CanvasRenderingContext2D];
  });
  x.clearRect(0, 0, w + 2, h + 2);
  return [c, x];
}

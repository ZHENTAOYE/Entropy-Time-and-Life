// S08 — the footprint trail: geometry, timing and the camera that rides along it.
// World space = sand plane in px; at frame 0 world == screen (so the S07 FEET handoff matches exactly).
import { FEET } from '../../lib/handoff';
import { clamp, ease, lerp, seg, smoothstep } from '../../lib/math';
import { REWIND } from './timing';

// ---------------------------------------------------------------------------------------------
// The sun (shared by the sand shader, the foot shadows and the grain shadows): from the right and a little from the
// top. A low raking light (12.3° high) for the walk; for the macro shot it climbs to 28° so the hero print's heel,
// arch, ball and five toe pits shade as gradients instead of drowning in one long cast shadow.
const SUN_AZ: [number, number] = [0.98252, -0.18616]; // horizontal direction TOWARD the sun (unit)
export interface Sun {
  /** unit vector toward the sun */
  L: [number, number, number];
  tanE: number;
  /** cast-shadow offset per unit height (world px) */
  shX: number;
  shY: number;
}
export function sunAt(f: number): Sun {
  const e = ((12.3 + (28 - 12.3) * ease.inOutSine(seg(f, 238, 278))) * Math.PI) / 180;
  const c = Math.cos(e);
  const t = Math.tan(e);
  return { L: [SUN_AZ[0] * c, SUN_AZ[1] * c, Math.sin(e)], tanE: t, shX: -SUN_AZ[0] / t, shY: -SUN_AZ[1] / t };
}

/** distance between consecutive prints along the walk (world px) */
export const STEP = 270;
/** half the lateral distance between left and right prints */
export const HALF_GAIT = (FEET.right.x - FEET.left.x) / 2; // 41
export const FOOT_L = FEET.length; // 150
const A_S = 230; // S-curve amplitude (world px)
const LAMBDA = 2720; // one full S over the trail
const X0 = (FEET.left.x + FEET.right.x) / 2; // 541
const Y0 = (FEET.left.y + FEET.right.y) / 2; // 970

/** walk centreline, parametrised by distance walked s (≈ arc length, upward = future) */
export function centre(s: number): [number, number] {
  const r = smoothstep(0, 600, s);
  return [X0 + A_S * Math.sin((2 * Math.PI * s) / LAMBDA) * r, Y0 - s];
}
function slope(s: number): number {
  const e = 2;
  return (centre(s + e)[0] - centre(s - e)[0]) / (2 * e);
}

export interface Print {
  k: number;
  x: number;
  y: number;
  /** rotation (rad, clockwise) from "toes up" */
  ang: number;
  /** -1 left foot, +1 right foot */
  side: number;
  /** frame at which the foot lands (prints 0,1 already exist at scene start) */
  T: number;
  s: number;
}

export const N_PRINTS = 12;
/** the macro print (slow-motion landing) */
export const MACRO_K = 11;
export const T_IMPACT = 282;
/** frames between regular steps */
export const CADENCE = 16;
/** first new step lands */
export const WALK_T0 = 108;

export const PRINTS: Print[] = (() => {
  const out: Print[] = [];
  for (let k = 0; k < N_PRINTS; k++) {
    const s = k === 0 ? -(FEET.left.y - FEET.right.y) / 2 : k === 1 ? (FEET.left.y - FEET.right.y) / 2 : 20 + (k - 1) * STEP;
    const side = k % 2 === 0 ? -1 : 1;
    const [cx, cy] = centre(s);
    const u = slope(s);
    const heading = Math.atan2(u, 1);
    // normal pointing to the walker's right: rotate the up-vector (0,-1) by heading, then 90° clockwise
    const nx = Math.cos(heading);
    const ny = Math.sin(heading);
    const x = cx + nx * side * HALF_GAIT;
    const y = cy + ny * side * HALF_GAIT;
    const toeOut = k >= 2 ? side * 0.1 : 0;
    const T = k < 2 ? -70 : k < MACRO_K ? WALK_T0 + CADENCE * (k - 2) : T_IMPACT;
    out.push({ k, x, y, ang: heading + toeOut, side, T, s });
  }
  // the handoff prints sit exactly on FEET
  out[0].x = FEET.left.x;
  out[0].y = FEET.left.y;
  out[1].x = FEET.right.x;
  out[1].y = FEET.right.y;
  return out;
})();

/** walker's distance along the path at frame f (piecewise linear through the landings) */
export function walkerS(f: number): number {
  if (f <= 86) return 0;
  const pts: Array<[number, number]> = [[86, 0]];
  for (let k = 2; k < N_PRINTS; k++) pts.push([PRINTS[k].T, PRINTS[k].s]);
  if (f >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (f <= pts[i][0]) {
      const [f0, s0] = pts[i - 1];
      const [f1, s1] = pts[i];
      return lerp(s0, s1, (f - f0) / (f1 - f0));
    }
  }
  return pts[pts.length - 1][1];
}

/** smooth camera-follow distance (accelerates from rest at f90, then 300 px / 14 f) */
function camS(f: number): number {
  const v = STEP / CADENCE;
  if (f <= 82) return 0;
  if (f < 122) {
    const u = (f - 82) / 40;
    return v * 40 * (u * u * u - (u * u * u * u) / 2);
  }
  return v * (f - 102);
}

// ---------------------------------------------------------------------------------------------
// Camera. screen = anchor + (world - c) * z
export interface Cam {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  z: number;
}

/** network stage: the trail midpoint M maps to N-space (540, 900) at zoom Z_NET */
export const M_WORLD: [number, number] = [X0, (PRINTS[0].y + PRINTS[MACRO_K].y) / 2];
export const Z_NET = 950 / (PRINTS[0].y - PRINTS[MACRO_K].y);
/** N-space → final figure space: final = FIN_C + (N - (540,900)) * K_N */
export const K_N = 105 / 950;
export const FIN_C: [number, number] = [540, 387.5];
/** fixed point of the final pull-back (zoom about it maps N-space onto the final figure) */
export const P_FIX: [number, number] = [540, (FIN_C[1] - 900 * K_N) / (1 - K_N)];

const logLerp = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));

/** end zoom of the walk pull-back (prints stay ≥ 105 px on screen) */
export const Z_WALK = 0.7;
function walkCam(f: number): Cam {
  const z = logLerp(1, Z_WALK, ease.inOutSine(seg(f, 40, 246)));
  const s = camS(f);
  const [wx, wy] = centre(s - 10);
  const ytarget = lerp(980, 480, ease.inOutSine(seg(f, 60, 246)));
  const cy = wy - (ytarget - 960) / z;
  const cx = lerp(540, X0 + (wx - X0) * 0.55, smoothstep(90, 160, f));
  return { cx, cy, ax: 540, ay: 960, z };
}

const P12 = () => PRINTS[MACRO_K];
const MACRO_SCREEN: [number, number] = [540, 860];

/** zoom of the macro framing (reached at f280, then a slow creep in) */
const macroZ = (f: number) => (f < 280 ? 2.4 : lerp(2.4, 2.62, seg(f, 280, 332)));
/** the macro blend starts here: from the LIVE walk camera (no freeze → no hitch; its pan velocity decays smoothly) */
export const MACRO_T0 = 228;
function macroCam(f: number): Cam {
  // zoom into the landing spot of the macro print: blend the live walk camera into the macro framing —
  // log-zoom and the screen position of the landing spot are interpolated, the camera centre follows from both
  const w = walkCam(f);
  const p = P12();
  const wz = ease.inOutCubic(seg(f, MACRO_T0, 280));
  const wp = ease.inOutSine(seg(f, MACRO_T0, 268));
  const z = Math.exp(lerp(Math.log(w.z), Math.log(macroZ(f)), wz));
  const sx = lerp(w.ax + (p.x - w.cx) * w.z, MACRO_SCREEN[0], wp);
  const sy = lerp(w.ay + (p.y - w.cy) * w.z, MACRO_SCREEN[1], wp);
  return { cx: p.x - (sx - 540) / z, cy: p.y - (sy - 960) / z, ax: 540, ay: 960, z };
}

function pullCam(f: number): Cam {
  // macro → network stage
  const p = P12();
  const z0 = 2.62;
  const z = logLerp(z0, Z_NET, ease.inOutCubic(seg(f, 332, 380)));
  const w = clamp((1 / z - 1 / z0) / (1 / Z_NET - 1 / z0));
  const we = w;
  const cx = lerp(p.x, M_WORLD[0], we);
  const cy = lerp(p.y, M_WORLD[1], we);
  const ax = lerp(MACRO_SCREEN[0], 540, we);
  const ay = lerp(MACRO_SCREEN[1], 900, we);
  return { cx, cy, ax, ay, z };
}

/** final pull-back factor a (1 → K_N) */
export function pullA(f: number): number {
  const u = seg(f, 380, 546);
  // slow while the network grows, then the long pull-back, easing out onto FIGURE_S08
  const e = u < 0.5 ? 0.5 * Math.pow(2 * u, 2.6) : 1 - 0.5 * Math.pow(2 - 2 * u, 2.2);
  return Math.exp(Math.log(K_N) * e);
}

function figCam(f: number): Cam {
  const a = pullA(f);
  return {
    cx: M_WORLD[0],
    cy: M_WORLD[1],
    ax: P_FIX[0] + a * (540 - P_FIX[0]),
    ay: P_FIX[1] + a * (900 - P_FIX[1]),
    z: a * Z_NET,
  };
}

/** impact shake + the 2-frame jolt when the rewind fails (scene-local frames) */
function shake(f: number): [number, number] {
  let a = f >= T_IMPACT ? Math.exp(-(f - T_IMPACT) / 5) * 5 : 0;
  if (f >= REWIND[1] && f < REWIND[1] + 3) a += [7, 4, 1.5][f - REWIND[1]];
  if (a < 0.05) return [0, 0];
  return [Math.sin(f * 2.7) * a, Math.cos(f * 3.9) * a * 0.7];
}

export function camera(f: number): Cam {
  let c: Cam;
  if (f < MACRO_T0) c = walkCam(f);
  else if (f < 332) c = macroCam(f);
  else if (f < 380) c = pullCam(f);
  else c = figCam(f);
  const [sx, sy] = shake(f);
  return { ...c, ax: c.ax + sx, ay: c.ay + sy };
}

export const toScreen = (c: Cam, x: number, y: number): [number, number] => [c.ax + (x - c.cx) * c.z, c.ay + (y - c.cy) * c.z];

/** world → final-figure-space similarity: final = FIN_C + (w - M) * Z_NET * K_N */
export const worldToFinal = (x: number, y: number): [number, number] => [
  FIN_C[0] + (x - M_WORLD[0]) * Z_NET * K_N,
  FIN_C[1] + (y - M_WORLD[1]) * Z_NET * K_N,
];

/** transform (s, tx, ty) so that screen = s * final + t for camera c */
export function finalXf(c: Cam): [number, number, number] {
  const s = c.z / (Z_NET * K_N);
  return [s, c.ax + (M_WORLD[0] - c.cx) * c.z - s * FIN_C[0], c.ay + (M_WORLD[1] - c.cy) * c.z - s * FIN_C[1]];
}

/** depth factor of print k at frame f (formation, then wind erosion e^-age/τ) */
/** the wind (and with it erosion) starts at WIND_T0; prints older than that start eroding from then */
export const WIND_T0 = 50;
/** the macro print lands in slow motion (≈ ×1/3 until the pull-back at f334): its erosion clock runs slow too */
const SLOWMO_END = 334;
const erosionAge = (p: Print, f: number) => {
  if (p.k === MACRO_K) return f < SLOWMO_END ? Math.max(0, f - p.T) / 3 : (SLOWMO_END - p.T) / 3 + (f - SLOWMO_END);
  return Math.max(0, f - Math.max(p.T, WIND_T0));
};
/**
 * How far the ◀◀ attempt drags the macro splash back toward its past (0..~0.36): it strains (with a tremble) during
 * REWIND[0]+2 … REWIND[1], then snaps back at the fail frame — slightly overshooting, then settling (closed form).
 */
export function rewindPull(f: number): number {
  const [a, b] = REWIND;
  if (f < a + 2) return 0;
  if (f < b) return 0.36 * ease.inOutSine(seg(f, a + 2, b - 3)) * (1 + 0.1 * Math.sin(f * 2.9));
  const u = f - b;
  return u > 8 ? 0 : -0.09 * Math.exp(-u / 1.3) * Math.cos(u * 2.2);
}
export function printDepth(p: Print, f: number): number {
  const age = f - p.T;
  if (age < 0) return 0;
  const form = p.k === MACRO_K ? ease.outCubic(clamp(age / 7)) : ease.outCubic(clamp(age / 4));
  // the rewind also tries to refill the hero print (sand trickles back in) — and lets go at the fail
  const rw = p.k === MACRO_K ? 1 - 0.3 * Math.max(0, rewindPull(f)) : 1;
  return form * rw * Math.exp(-erosionAge(p, f) / 165);
}
/** edge softness (world px): crisp when the foot lifts (held ≤ 2.3 px for ~30 f), then diffusion widens it ∝ √age */
export function printBlur(p: Print, f: number): number {
  const a = erosionAge(p, f);
  // the macro print is seen ×2.5: its walls must slope like real sand (angle of repose ≈ 33°), not knife edges
  const b0 = p.k === MACRO_K ? 1.6 : 0.7;
  return b0 + 1.6 * smoothstep(0, 30, a) + 3.0 * Math.sqrt(Math.max(0, a - 30) / 30);
}

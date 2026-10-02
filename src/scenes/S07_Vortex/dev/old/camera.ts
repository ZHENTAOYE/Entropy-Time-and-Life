// A tiny 3D camera that pitches about the world X axis (top view ⇄ side view).
// World: X right, H up (floor = H 0), Z depth (away from the side-view camera; = screen-up in top view).
// The figure stands at the origin and faces +Z (away from us) — so in the final top view its toes point up.
import { ease, lerp, seg } from '../../../../lib/math';

export interface Cam {
  /** pitch in radians: π/2 = looking straight down, 0 = horizontal */
  phi: number;
  /** look-at target (world) */
  th: number;
  /** screen anchor where the target projects */
  ax: number;
  ay: number;
  zoom: number;
  D: number;
  sp: number;
  cp: number;
  /** screen roll (radians) about the anchor */
  roll: number;
  sr: number;
  cr: number;
}

const D = 2600;
const DEG = Math.PI / 180;

interface Key {
  f: number;
  phi: number;
  th: number;
  ax: number;
  ay: number;
  zoom: number;
  roll?: number;
  e?: (t: number) => number;
}

// e = easing used to arrive at this key from the previous one
const KEYS: Key[] = [
  { f: 0, phi: 90, th: 0, ax: 540, ay: 860, zoom: 1.0, roll: 0 },
  { f: 140, phi: 90, th: 0, ax: 540, ay: 860, zoom: 1.03, roll: 5, e: ease.inOutSine },
  // push in on the tracer's journey
  { f: 200, phi: 90, th: 0, ax: 540, ay: 860, zoom: 1.17, roll: 9, e: ease.inOutSine },
  // pull back to see the whole shape for the census
  { f: 238, phi: 90, th: 0, ax: 540, ay: 860, zoom: 0.98, roll: 12, e: ease.inOutCubic },
  { f: 296, phi: 90, th: 0, ax: 540, ay: 860, zoom: 1.03, roll: 15, e: ease.inOutSine },
  // tilt 90°: top view → side view (and unroll)
  { f: 340, phi: 13, th: 500, ax: 540, ay: 812, zoom: 1.0, roll: 0, e: ease.inOutCubic },
  { f: 456, phi: 12, th: 500, ax: 540, ay: 800, zoom: 1.08, roll: 0, e: ease.inOutSine },
  { f: 566, phi: 11, th: 500, ax: 540, ay: 800, zoom: 1.13, roll: 0, e: ease.inOutSine },
  { f: 600, phi: 11, th: 500, ax: 540, ay: 918, zoom: 0.76, roll: 0, e: ease.inOutCubic },
  { f: 652, phi: 11, th: 500, ax: 540, ay: 918, zoom: 0.775, roll: 0, e: ease.linear },
  { f: 692, phi: 11, th: 500, ax: 540, ay: 846, zoom: 0.93, roll: 0, e: ease.inOutCubic },
  { f: 754, phi: 11, th: 500, ax: 540, ay: 846, zoom: 0.95, roll: 0, e: ease.outSine },
  // the freeze: even the camera stops
  { f: 812, phi: 11, th: 500, ax: 540, ay: 846, zoom: 0.95, roll: 0, e: ease.linear },
  { f: 852, phi: 12, th: 500, ax: 540, ay: 846, zoom: 0.985, roll: 0, e: ease.inOutSine },
  // tilt 2: down to the floor, top view, footprints at FEET
  { f: 896, phi: 90, th: 0, ax: 541, ay: 970, zoom: 41 / 49, roll: 0, e: ease.inOutCubic },
  { f: 900, phi: 90, th: 0, ax: 541, ay: 970, zoom: 41 / 49, roll: 0, e: ease.linear },
];

export function camAt(f: number): Cam {
  let k = 1;
  while (k < KEYS.length - 1 && f > KEYS[k].f) k++;
  const a = KEYS[k - 1];
  const b = KEYS[k];
  const t = (b.e ?? ease.inOutCubic)(seg(f, a.f, b.f));
  const phi = lerp(a.phi, b.phi, t) * DEG;
  const roll = lerp(a.roll ?? 0, b.roll ?? 0, t) * DEG;
  return {
    roll,
    sr: Math.sin(roll),
    cr: Math.cos(roll),
    phi,
    th: lerp(a.th, b.th, t),
    ax: lerp(a.ax, b.ax, t),
    ay: lerp(a.ay, b.ay, t),
    zoom: lerp(a.zoom, b.zoom, t),
    D,
    sp: Math.sin(phi),
    cp: Math.cos(phi),
  };
}

/** Project a world point. Writes [sx, sy, scale] into out; returns false if behind the camera. */
export function project(c: Cam, X: number, H: number, Z: number, out: Float32Array | number[], o = 0): boolean {
  const qh = H - c.th;
  const cy = qh * c.cp + Z * c.sp;
  const cz = -qh * c.sp + Z * c.cp + c.D;
  if (cz < 60) return false;
  const k = (c.zoom * c.D) / cz;
  const dx = k * X;
  const dy = -k * cy;
  out[o] = c.ax + dx * c.cr - dy * c.sr;
  out[o + 1] = c.ay + dx * c.sr + dy * c.cr;
  out[o + 2] = k;
  return true;
}

/** Cast the ray through screen pixel (sx, sy) onto the floor H = h0. Returns [X, Z, distance] or null. */
export function floorHit(c: Cam, sx: number, sy: number, h0 = 0): [number, number, number] | null {
  const ex = sx - c.ax;
  const ey = sy - c.ay;
  const u = (ex * c.cr + ey * c.sr) / (c.zoom * c.D);
  const v = -(-ex * c.sr + ey * c.cr) / (c.zoom * c.D);
  const Ch = c.th + c.D * c.sp - h0;
  const Cz = -c.D * c.cp;
  const dh = v * c.cp - c.sp;
  if (dh > -1e-5) return null;
  const lam = -Ch / dh;
  return [lam * u, Cz + lam * (v * c.sp + c.cp), lam];
}

/** Same camera as GLSL uniforms. */
export const camUniforms = (c: Cam) => ({
  u_phi: c.phi,
  u_th: c.th,
  u_ax: c.ax,
  u_ay: c.ay,
  u_zoom: c.zoom,
  u_D: c.D,
  u_roll: c.roll,
});

// World camera. The side view (Sun top, Earth bottom) is "world" space = screen space until the dive.
// The DIVE zooms ×ZF into a point on the Earth's face; the ground (top-down) network lives in "ground"
// space whose final screen mapping is identity (centred on SPIRAL).
import { clamp, ease, lerp, seg } from '../../lib/math';
import { SPIRAL } from '../../lib/handoff';
import { T } from './timing';

export const ZF = 36; // total dive zoom
export const DIVE_T = { x: 540, y: 1468 } as const; // dive target on the Earth's face (world), 178 px below the limb

export interface Cam {
  /** zoom */
  z: number;
  /** screen position of the dive target */
  sx: number;
  sy: number;
  /** dive progress 0..1 (eased) */
  p: number;
  /** log-space zoom progress 0..1 */
  lz: number;
}

export function camAt(frame: number): Cam {
  const raw = seg(frame, T.diveStart, T.diveEnd);
  const p = ease.inOutCubic(raw);
  // gentle "breath" push-in during the ledger beats (follows the photon)
  const push = 1 + 0.03 * ease.inOutSine(seg(frame, 106, 196)) - 0.03 * ease.inOutSine(seg(frame, 330, 412));
  const z = Math.exp(Math.log(ZF) * p) * push;
  const pc = ease.inOutQuad(clamp(raw * 1.25));
  const sx = DIVE_T.x;
  const sy = lerp(DIVE_T.y, SPIRAL.y, pc);
  return { z, sx, sy, p, lz: Math.log(z) / Math.log(ZF) };
}

/** Apply the world→screen transform to a context (world coordinates afterwards). */
export function applyWorld(ctx: CanvasRenderingContext2D, c: Cam) {
  ctx.translate(c.sx, c.sy);
  ctx.scale(c.z, c.z);
  ctx.translate(-DIVE_T.x, -DIVE_T.y);
}

export const worldToScreen = (c: Cam, x: number, y: number): [number, number] => [c.sx + (x - DIVE_T.x) * c.z, c.sy + (y - DIVE_T.y) * c.z];

/** ground (top-down) → screen scale factor; 1 at the end of the dive. `k` = extra magnification of a copy. */
export const groundScale = (c: Cam, k = 1) => (c.z / ZF) * k;

/** Apply ground→screen transform (ground coords are centred on SPIRAL). */
export function applyGround(ctx: CanvasRenderingContext2D, c: Cam, k = 1) {
  const s = groundScale(c, k);
  ctx.translate(c.sx, c.sy);
  ctx.scale(s, s);
  ctx.translate(-SPIRAL.x, -SPIRAL.y);
}

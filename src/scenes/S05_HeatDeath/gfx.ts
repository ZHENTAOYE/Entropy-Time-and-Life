// Small canvas helpers for S05 (scratch canvases, fast hashes, gaussian noise). Pure / deterministic.
import { memo } from '../../lib/math';

/** A reusable offscreen canvas (per name), resized when needed. CPU-backed (willReadFrequently). */
export function scratch(name: string, w: number, h: number): HTMLCanvasElement {
  const c = memo(`s05:scratch:${name}`, () => document.createElement('canvas'));
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  return c;
}
export function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}
/** reset a context to identity / defaults and clear it */
export function fresh(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = ctxOf(c);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.filter = 'none';
  x.shadowBlur = 0;
  x.shadowColor = 'rgba(0,0,0,0)';
  x.clearRect(0, 0, c.width, c.height);
  return x;
}

/** integer hash → [0,1) (fast, for per-pixel noise) */
export function ih(a: number, b: number): number {
  let h = Math.imul(a ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(b + 0x3c6ef372, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** standard normal from two hashes */
export function gauss(a: number, b: number): number {
  const u = Math.max(1e-7, ih(a, b));
  const v = ih(a + 7919, b ^ 0x5bd1e995);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
}

export function rgbStr(c: readonly number[], a = 1): string {
  return a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(4)})`;
}
export function mixRgb(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** a white radial sprite (gaussian core + soft halo), cached */
export function glowSprite(): HTMLCanvasElement {
  return memo('s05:glow', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = ctxOf(c);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (let i = 0; i <= 16; i++) {
      const r = i / 16;
      g.addColorStop(r, `rgba(255,255,255,${(Math.exp(-r * r * 7) * (1 - r)).toFixed(4)})`);
    }
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  });
}

/**
 * Draw something gaussian-blurred WITHOUT a canvas `filter` on the big scene canvas (in the software rasteriser a
 * filtered draw on a 1080×1920 canvas costs ~0.1–0.3 s; on a glyph-sized scratch it is ~0.2 ms). `draw` paints in the
 * caller's current coordinates, inside the box (x0, y0, w, h); the result is composited with the caller's transform,
 * clip and globalAlpha. The scratch inherits font / fillStyle / strokeStyle / text alignment / line width.
 */
export function drawBlurred(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  blur: number,
  draw: (s: CanvasRenderingContext2D) => void,
) {
  if (blur < 0.15) {
    draw(ctx);
    return;
  }
  const pad = Math.ceil(blur * 2.6) + 2;
  const W = Math.ceil((w + 2 * pad) / 32) * 32;
  const H = Math.ceil((h + 2 * pad) / 32) * 32;
  const c = scratch(`blur${W}x${H}`, W, H);
  const s = fresh(c);
  s.font = ctx.font;
  s.fillStyle = ctx.fillStyle;
  s.strokeStyle = ctx.strokeStyle;
  s.textAlign = ctx.textAlign;
  s.textBaseline = ctx.textBaseline;
  s.lineWidth = ctx.lineWidth;
  s.filter = `blur(${blur.toFixed(2)}px)`;
  s.translate(pad - x0, pad - y0);
  draw(s);
  ctx.drawImage(c, x0 - pad, y0 - pad);
}

/** the soft dark halo behind text over bright imagery (radial, rgba(2,3,9) 0.6 → 0.34 → 0), cached; draw it scaled
 *  into the box it should fill (a per-frame radial-gradient fill of that box costs ~30 ms in software) */
export function haloSprite(): HTMLCanvasElement {
  return memo('s05:halo', () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = ctxOf(c);
    x.setTransform(128, 0, 0, 64, 128, 64);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(2,3,8,0.6)');
    g.addColorStop(0.5, 'rgba(2,3,8,0.36)');
    g.addColorStop(1, 'rgba(2,3,8,0)');
    x.fillStyle = g;
    x.fillRect(-1, -1, 2, 2);
    return c;
  });
}

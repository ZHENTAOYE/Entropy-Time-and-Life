// NOISE-DEATH: an element (text, gauge, HUD) rendered once as a white mask, then drawn with every one of its pixels
// displaced by its own random walk (σ grows) while its colour converges to the background — the element does not
// drift away, it dissolves into the noise. Same law as the image's heat death (σ ∝ eq²).
import { clamp, memo } from '../../lib/math';
import { ctxOf, gauss, ih, scratch } from './gfx';

export interface Mask {
  /** logical-px origin of the mask canvas */
  x0: number;
  y0: number;
  w: number;
  h: number;
  px: Int16Array;
  py: Int16Array;
  a: Uint8Array;
  n: number;
}

/** Build (once per key) a mask from a drawing in LOGICAL px; the drawing must stay inside [x0, x0+w]×[y0, y0+h]. */
export function buildMask(key: string, x0: number, y0: number, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Mask {
  return memo(`s05:mask:${key}`, () => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    const x = ctxOf(c);
    x.translate(-x0, -y0);
    x.fillStyle = '#fff';
    x.strokeStyle = '#fff';
    draw(x);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const px: number[] = [];
    const py: number[] = [];
    const a: number[] = [];
    for (let j = 0; j < c.height; j++)
      for (let i = 0; i < c.width; i++) {
        const al = d[(j * c.width + i) * 4 + 3];
        if (al > 10) {
          px.push(i);
          py.push(j);
          a.push(al);
        }
      }
    return { x0, y0, w: c.width, h: c.height, px: Int16Array.from(px), py: Int16Array.from(py), a: Uint8Array.from(a), n: px.length };
  });
}

/** 4096 standard-normal pairs (cheap lookups for per-pixel walks) */
const G = () =>
  memo('s05:gtab', () => {
    const t = new Float32Array(8192);
    for (let i = 0; i < 4096; i++) {
      t[i * 2] = gauss(i, 11);
      t[i * 2 + 1] = gauss(i, 23);
    }
    return t;
  });

/**
 * Draw the mask with each pixel random-walked by σ (px), tinted `rgb`, at opacity `alpha`.
 * The walk is continuous in time (knots every 4 frames, variance-preserving interpolation).
 */
export function drawScattered(ctx: CanvasRenderingContext2D, m: Mask, sigma: number, rgb: readonly number[], alpha: number, seed: number, f: number) {
  if (alpha <= 0.003 || m.n === 0) return;
  const M = Math.min(260, Math.ceil(3.2 * sigma + 2));
  const W = m.w + 2 * M;
  const H = m.h + 2 * M;
  const c = scratch('scatter', W, H);
  const x = ctxOf(c);
  const img = x.createImageData(W, H);
  const d = img.data;
  const g = G();
  const kf = f / 4;
  const k0 = Math.floor(kf);
  const u = kf - k0;
  const w0 = (1 - u) / Math.sqrt((1 - u) * (1 - u) + u * u);
  const w1 = u / Math.sqrt((1 - u) * (1 - u) + u * u);
  const s0 = Math.imul(k0, 7919) + seed;
  const s1 = Math.imul(k0 + 1, 7919) + seed;
  const r = rgb[0] | 0;
  const gg = rgb[1] | 0;
  const b = rgb[2] | 0;
  const sharp = sigma < 0.35;
  for (let i = 0; i < m.n; i++) {
    let dx = 0;
    let dy = 0;
    if (!sharp) {
      const a0 = ((ih(i, s0) * 4096) | 0) * 2;
      const a1 = ((ih(i, s1) * 4096) | 0) * 2;
      dx = (g[a0] * w0 + g[a1] * w1) * sigma;
      dy = (g[a0 + 1] * w0 + g[a1 + 1] * w1) * sigma;
    }
    const X = (m.px[i] + M + dx + 0.5) | 0;
    const Y = (m.py[i] + M + dy + 0.5) | 0;
    if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const k = (Y * W + X) * 4;
    d[k] = r;
    d[k + 1] = gg;
    d[k + 2] = b;
    d[k + 3] = Math.min(255, d[k + 3] + m.a[i]);
  }
  x.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.drawImage(c, 0, 0, W, H, m.x0 - M, m.y0 - M, W, H);
  ctx.restore();
}

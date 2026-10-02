// Small drawing utilities for S07 (offscreen canvases, batched strokes, bloom).
import { memo } from '../../../../lib/math';

/**
 * A persistent offscreen canvas (one per tab, reused every frame — always fully redrawn before use).
 * Always CPU-backed (willReadFrequently): a GPU (SwiftShader) canvas drawn into a CPU canvas forces a slow readback.
 */
export function offscreen(key: string, w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  return memo('s07:cv:' + key + ':' + w + 'x' + h, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    return [c, ctx] as [HTMLCanvasElement, CanvasRenderingContext2D];
  });
}

/** Batches polyline segments into a fixed number of style buckets (one stroke() per bucket). */
export class Strokes {
  paths: Path2D[];
  used: Uint8Array;
  constructor(n: number) {
    this.paths = Array.from({ length: n }, () => new Path2D());
    this.used = new Uint8Array(n);
  }
  seg(b: number, x0: number, y0: number, x1: number, y1: number) {
    const p = this.paths[b];
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    this.used[b] = 1;
  }
  seg3(b: number, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
    const p = this.paths[b];
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    p.lineTo(x2, y2);
    this.used[b] = 1;
  }
  /** polyline from a flat [x0,y0,x1,y1,...] buffer with n points */
  poly(b: number, buf: Float32Array, n: number) {
    const p = this.paths[b];
    p.moveTo(buf[0], buf[1]);
    for (let j = 1; j < n; j++) p.lineTo(buf[j * 2], buf[j * 2 + 1]);
    this.used[b] = 1;
  }
  dot(b: number, x: number, y: number, s: number) {
    this.paths[b].rect(x - s / 2, y - s / 2, s, s);
    this.used[b] = 1;
  }
  stroke(ctx: CanvasRenderingContext2D, b: number, style: string, width: number) {
    if (!this.used[b]) return;
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke(this.paths[b]);
  }
  fill(ctx: CanvasRenderingContext2D, b: number, style: string) {
    if (!this.used[b]) return;
    ctx.fillStyle = style;
    ctx.fill(this.paths[b]);
  }
}

/**
 * Bloom: downsample the canvas' current content into a small blurred copy and add it back ('lighter').
 * Two radii: a tight glow and a wide halo.
 */
export function bloom(ctx: CanvasRenderingContext2D, src: HTMLCanvasElement, tight = 0.7, wide = 0.45) {
  const W = 1080;
  const H = 1920;
  const [c1, x1] = offscreen('bloom1', 270, 480);
  const [c2, x2] = offscreen('bloom2', 135, 240);
  x1.setTransform(1, 0, 0, 1, 0, 0);
  x1.globalCompositeOperation = 'copy';
  x1.filter = 'blur(3px)';
  x1.drawImage(src, 0, 0, src.width, src.height, 0, 0, 270, 480);
  x1.filter = 'none';
  x2.setTransform(1, 0, 0, 1, 0, 0);
  x2.globalCompositeOperation = 'copy';
  x2.filter = 'blur(5px)';
  x2.drawImage(c1, 0, 0, 270, 480, 0, 0, 135, 240);
  x2.filter = 'none';
  ctx.save();
  ctx.setTransform(src.width / W, 0, 0, src.height / H, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  if (tight > 0) {
    ctx.globalAlpha = tight;
    ctx.drawImage(c1, 0, 0, W, H);
  }
  if (wide > 0) {
    ctx.globalAlpha = wide;
    ctx.drawImage(c2, 0, 0, W, H);
  }
  ctx.restore();
}

export const rgbaArr = (c: readonly number[], a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
export const mixArr = (a: readonly number[], b: readonly number[], t: number): number[] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const hex = (h: string): number[] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

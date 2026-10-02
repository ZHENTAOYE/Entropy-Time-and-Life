// Sample points from glyphs or arbitrary drawn shapes (for particles that form text / figures).
// Call only after fonts are loaded (see useFontsReady) — the result is memoised by key.
import { memo } from './math';
import { mulberry32 } from './random';

export interface SampleOpts {
  /** grid step in px (smaller = more points) */
  step?: number;
  /** 0..1 jitter of sample positions within a cell */
  jitter?: number;
  /** alpha threshold 0..255 */
  threshold?: number;
  seed?: number;
  /** shuffle the output order (useful so particle i maps to a random location) */
  shuffle?: boolean;
}

/** Draw anything with `draw(ctx)` into a w×h canvas, return sampled points as Float32Array [x0,y0,x1,y1,...]. */
export function sampleShape(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, o: SampleOpts = {}): Float32Array {
  const { step = 6, jitter = 0.8, threshold = 128, seed = 7, shuffle = true } = o;
  return memo(`shape:${key}:${w}x${h}:${step}:${jitter}:${threshold}:${seed}:${shuffle}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    draw(ctx);
    const data = ctx.getImageData(0, 0, w, h).data;
    const r = mulberry32(seed);
    const pts: number[] = [];
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const sx = Math.min(w - 1, Math.floor(x + (r() - 0.5) * jitter * step + step / 2));
        const sy = Math.min(h - 1, Math.floor(y + (r() - 0.5) * jitter * step + step / 2));
        if (data[(sy * w + sx) * 4 + 3] >= threshold) pts.push(sx, sy);
      }
    }
    if (shuffle) {
      const n = pts.length / 2;
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const ax = pts[i * 2],
          ay = pts[i * 2 + 1];
        pts[i * 2] = pts[j * 2];
        pts[i * 2 + 1] = pts[j * 2 + 1];
        pts[j * 2] = ax;
        pts[j * 2 + 1] = ay;
      }
    }
    return new Float32Array(pts);
  });
}

/**
 * Sample points covering text. `font` is a CSS shorthand e.g. '900 520px "Noto Serif SC"'.
 * (cx, cy) = centre of the text in the w×h frame.
 */
export function sampleText(text: string, font: string, cx: number, cy: number, o: SampleOpts & { w?: number; h?: number } = {}): Float32Array {
  const w = o.w ?? 1080;
  const h = o.h ?? 1920;
  return sampleShape(`text:${text}:${font}:${cx}:${cy}`, w, h, (ctx) => {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    const m = /(\d+)px/.exec(font);
    const lh = (m ? parseInt(m[1], 10) : 100) * 1.15;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, cy + (i - (lines.length - 1) / 2) * lh));
  }, o);
}

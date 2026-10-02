// S09 — "captured ink": a small optical-density field (a word, the ◀◀, the released figure) that then spreads with
// the SAME physics as the web's ink (inkfield.ts): advected by the water's smooth flow (sinking, bending, curling)
// and diffused by a blur ∝ √τ at constant mass. One ink, one physics, for everything that dissolves in the tank.
import { memo, smoothstep } from '../../lib/math';
import { ctxOf, scratch } from './canvas';
import { FLOOR, K, flowField } from './inkfx';
import { backTrace } from './flow';
import { SURFACE_Y } from './timing';

export interface Captured {
  /** box in logical px */
  x0: number;
  y0: number;
  w: number; // samples
  h: number;
  res: number; // samples per logical px
  rho: Float32Array;
}

/** capture a density field from a drawing: `draw` paints coverage (any colour, alpha = coverage) in logical px */
export function captureMask(key: string, x0: number, y0: number, wl: number, hl: number, res: number, density: number, draw: (g: CanvasRenderingContext2D) => void): Captured {
  return memo(`s09:cap:${key}`, () => {
    const w = Math.ceil(wl * res),
      h = Math.ceil(hl * res);
    const c = scratch('capMask', w, h);
    const g = ctxOf(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    g.fillStyle = '#000';
    g.strokeStyle = '#000';
    draw(g);
    const d = g.getImageData(0, 0, w, h).data;
    const rho = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) rho[i] = (d[i * 4 + 3] / 255) * density;
    return { x0, y0, w, h, res, rho };
  });
}

/** capture the density of something already drawn as ink (transmittance) on a white canvas region */
export function captureInk(key: string, x0: number, y0: number, wl: number, hl: number, res: number, draw: (g: CanvasRenderingContext2D) => void): Captured {
  return memo(`s09:capInk:${key}`, () => {
    const w = Math.ceil(wl * res),
      h = Math.ceil(hl * res);
    const c = scratch('capInk', w, h);
    const g = ctxOf(c);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    draw(g);
    const d = g.getImageData(0, 0, w, h).data;
    const rho = new Float32Array(w * h);
    const fl = FLOOR[1],
      k = K[1];
    for (let i = 0; i < w * h; i++) {
      const v = (d[i * 4 + 1] / 255 - fl) / (1 - fl);
      rho[i] = v >= 0.999 ? 0 : v <= 0.0005 ? 7 : Math.min(7, -Math.log(v) / k);
    }
    return { x0, y0, w, h, res, rho };
  });
}

function blurInPlace(a: Float32Array, w: number, h: number, r: number) {
  const R = Math.max(1, Math.round(r));
  const tmp = memo('s09:capTmp', () => ({ a: new Float32Array(1) }));
  if (tmp.a.length < Math.max(w, h)) tmp.a = new Float32Array(Math.max(w, h));
  const t = tmp.a;
  const inv = 1 / (2 * R + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += a[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        t[x] = acc * inv;
        acc += a[o + Math.min(w - 1, x + R + 1)] - a[o + Math.max(0, x - R)];
      }
      for (let x = 0; x < w; x++) a[o + x] = t[x];
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        t[y] = acc * inv;
        acc += a[Math.min(h - 1, y + R + 1) * w + x] - a[Math.max(0, y - R) * w + x];
      }
      for (let y = 0; y < h; y++) a[y * w + x] = t[y];
    }
  }
}

export interface SpreadOpts {
  /** px the ink sinks after τ s (≈ v·τ + a·τ²) */
  sinkV: number;
  sinkA: number;
  /** amplitude (px) of the bending flow and the finer curls */
  flowA: number;
  curlA: number;
  /** blur σ (logical px) = s0 + sK·√τ */
  s0: number;
  sK: number;
  /** extra margin (logical px) the ink may spread into */
  margin: number;
  /** density multiplier (fades, light) */
  gain: number;
  /**
   * tank time (s since the hand-over, flow.ts) at which the ink was released: if given, the ink moves with the
   * tank's own water (flow.ts back-trace) instead of the generic flow above (+ sinkA·τ² of its own weight; sinkV only sizes the box)
   */
  t0?: number;
}

const SL_N = 1024,
  SL_MAX = 8;
const spreadLut = () =>
  memo('s09:spreadLut', () => {
    const o = new Uint8ClampedArray(SL_N * 3);
    for (let i = 0; i < SL_N; i++) {
      const r = (i / (SL_N - 1)) * SL_MAX;
      for (let c = 0; c < 3; c++) o[i * 3 + c] = Math.round(255 * (FLOOR[c] + (1 - FLOOR[c]) * Math.exp(-r * K[c])));
    }
    return o;
  });

/** draw a captured field τ seconds after it was released into the water (multiply) */
export function drawSpread(ctx: CanvasRenderingContext2D, cap: Captured, tau: number, o: SpreadOpts) {
  if (o.gain <= 0.003) return;
  const m = Math.ceil(o.margin * cap.res);
  // extra room below: the ink sinks
  const mb = m + Math.ceil((o.sinkV * tau + o.sinkA * tau * tau) * cap.res);
  const W = cap.w + 2 * m,
    H = cap.h + m + mb;
  const box = memo('s09:spreadBuf', () => ({ a: new Float32Array(1) }));
  if (box.a.length < W * H) box.a = new Float32Array(W * H);
  const R = box.a;
  const r = cap.res;
  const A = o.flowA * (1 - Math.exp(-tau / 1.6));
  const C = o.curlA * (1 - Math.exp(-tau / 1.0));
  const sink = o.sinkV * tau + o.sinkA * tau * tau;
  // coarse displacement grid (every 8 samples), semi-Lagrangian back-trace
  const GS = 8;
  const gw = Math.ceil(W / GS) + 1,
    gh = Math.ceil(H / GS) + 1;
  const D = new Float32Array(gw * gh * 2);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const lx = cap.x0 + (i * GS - m) / r,
        ly = cap.y0 + (j * GS - m) / r;
      if (o.t0 !== undefined) {
        const [ox, oy] = backTrace(lx, ly, o.t0 + tau, o.t0);
        D[(j * gw + i) * 2] = (lx - ox) * r;
        D[(j * gw + i) * 2 + 1] = (ly - oy + o.sinkA * tau * tau) * r;
        continue;
      }
      const [fx, fy] = flowField(lx * 0.85, ly * 0.85, tau * 0.45 + 2.1);
      const [gx, gy] = flowField(lx * 3.1 + 40, ly * 3.1 - 10, tau * 0.9 + 0.7);
      D[(j * gw + i) * 2] = (fx * A + gx * C) * r;
      D[(j * gw + i) * 2 + 1] = (fy * A + gy * C + sink) * r;
    }
  const src = cap.rho;
  for (let y = 0; y < H; y++) {
    const gyf = y / GS;
    const j0 = Math.min(gh - 2, Math.floor(gyf));
    const fy = gyf - j0;
    for (let x = 0; x < W; x++) {
      const gxf = x / GS;
      const i0 = Math.min(gw - 2, Math.floor(gxf));
      const fx = gxf - i0;
      const k00 = (j0 * gw + i0) * 2,
        k10 = k00 + 2,
        k01 = k00 + gw * 2,
        k11 = k01 + 2;
      const dx = (D[k00] * (1 - fx) + D[k10] * fx) * (1 - fy) + (D[k01] * (1 - fx) + D[k11] * fx) * fy;
      const dy = (D[k00 + 1] * (1 - fx) + D[k10 + 1] * fx) * (1 - fy) + (D[k01 + 1] * (1 - fx) + D[k11 + 1] * fx) * fy;
      const sx = x - m - dx,
        sy = y - m - dy;
      const xi = Math.floor(sx),
        yi = Math.floor(sy);
      if (xi < 0 || yi < 0 || xi >= cap.w - 1 || yi >= cap.h - 1) {
        R[y * W + x] = 0;
        continue;
      }
      const ax = sx - xi,
        ay = sy - yi;
      const b = yi * cap.w + xi;
      R[y * W + x] = (src[b] * (1 - ax) + src[b + 1] * ax) * (1 - ay) + (src[b + cap.w] * (1 - ax) + src[b + cap.w + 1] * ax) * ay;
    }
  }
  const sigma = (o.s0 + o.sK * Math.sqrt(tau) * smoothstep(0, 0.5, tau)) * r;
  if (sigma > 0.6) blurInPlace(R.subarray(0, W * H), W, H, sigma);
  // feather the box so the spread never shows its edges
  const fe = Math.max(4, Math.round(Math.min(m, 40 * r)));
  for (let y = 0; y < H; y++) {
    const ky = Math.min(1, y / fe, (H - 1 - y) / fe);
    for (let x = 0; x < W; x++) {
      const k = Math.min(ky, x / fe, (W - 1 - x) / fe);
      if (k < 1) R[y * W + x] *= Math.max(0, k);
    }
  }
  const c = scratch('spreadOut', W, H);
  const g = ctxOf(c);
  const img = g.createImageData(W, H);
  const d = img.data;
  const topRow = Math.ceil((SURFACE_Y - (cap.y0 - m / r)) * r);
  const L = spreadLut();
  const lk = ((SL_N - 1) / SL_MAX) * o.gain;
  for (let i = 0; i < W * H; i++) {
    const y = (i / W) | 0;
    const li = y < topRow ? 0 : Math.min(SL_N - 1, (R[i] * lk) | 0) * 3;
    const k4 = i * 4;
    d[k4] = L[li];
    d[k4 + 1] = L[li + 1];
    d[k4 + 2] = L[li + 2];
    d[k4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, W, H, cap.x0 - m / r, cap.y0 - m / r, W / r, H / r);
  ctx.restore();
}

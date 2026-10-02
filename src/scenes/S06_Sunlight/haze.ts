// B5 「像那滴墨，阳光在地球上“散开”了。」 — the sky fills with infrared LIKE INK IN WATER.
// What the Earth sends back is not a beam but a spreading cloud: from the whole limb, plumes of infrared rise and
// diffuse upward like S01's ink — fingers (vertically stretched, domain-warped noise advected upward, thresholded
// against a level that rises with height: the higher, the fewer fingers survive), a dense layer at the limb, a dilute
// fringe higher up (Beer–Lambert ramp: dense = hot red-orange, thin = deep wine #7A0E1A), lit rims at the plume
// edges. The cloud's reach grows the whole beat: the same energy, ever more spread out.
// Computed per frame at ¼ resolution in WORLD space (it rides the camera), ~90k px of table lookups (~5 ms).
import { clamp, ease, memo, seg } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { Cam, applyWorld } from './camera';
import { LIMB_Y, limbY } from './palette';
import { T } from './timing';

const K = 4; // ¼ resolution
const W = 1080 / K;
const Y0 = 120; // world y of the first row (the Sun's corona above stays clean)
// down to the limb at the frame edges (it curves down to y ≈ 1429 there) — no straight cut-off line
const H = Math.ceil((Math.max(limbY(0), limbY(1080)) + 14 - Y0) / K);
const NS = 256; // tileable noise table

/** periodic value-noise fbm (tileable NS×NS, 0..1) */
const noiseTab = () =>
  memo('s06:hazeNoise', () => {
    const rnd = mulberry32(3131);
    const out = new Float32Array(NS * NS);
    let amp = 0.5;
    let tot = 0;
    for (const cells of [4, 8, 16, 32]) {
      const L = new Float32Array(cells * cells);
      for (let i = 0; i < L.length; i++) L[i] = rnd();
      const k = cells / NS;
      for (let y = 0; y < NS; y++) {
        const fy = y * k;
        const y0 = Math.floor(fy);
        let ty = fy - y0;
        ty = ty * ty * (3 - 2 * ty);
        const r0 = (y0 % cells) * cells;
        const r1 = ((y0 + 1) % cells) * cells;
        for (let x = 0; x < NS; x++) {
          const fx = x * k;
          const x0 = Math.floor(fx);
          let tx = fx - x0;
          tx = tx * tx * (3 - 2 * tx);
          const c0 = x0 % cells;
          const c1 = (x0 + 1) % cells;
          const a = L[r0 + c0] + (L[r0 + c1] - L[r0 + c0]) * tx;
          const b = L[r1 + c0] + (L[r1 + c1] - L[r1 + c0]) * tx;
          out[y * NS + x] += (a + (b - a) * ty) * amp;
        }
      }
      tot += amp;
      amp *= 0.5;
    }
    // standardise: mean 0.5, σ 0.15 (thresholds below are calibrated to it)
    let m = 0;
    for (let i = 0; i < out.length; i++) m += out[i] / tot;
    m /= out.length;
    let v2 = 0;
    for (let i = 0; i < out.length; i++) v2 += (out[i] / tot - m) ** 2;
    const sd = Math.sqrt(v2 / out.length);
    for (let i = 0; i < out.length; i++) out[i] = 0.5 + ((out[i] / tot - m) / sd) * 0.15;
    return out;
  });

/** bilinear, wrapping lookup (u, v in table cells) */
function nz(N: Float32Array, u: number, v: number) {
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = u - x0;
  const ty = v - y0;
  const xa = x0 & (NS - 1);
  const xb = (x0 + 1) & (NS - 1);
  const ya = (y0 & (NS - 1)) * NS;
  const yb = ((y0 + 1) & (NS - 1)) * NS;
  const a = N[ya + xa] + (N[ya + xb] - N[ya + xa]) * tx;
  const b = N[yb + xa] + (N[yb + xb] - N[yb + xa]) * tx;
  return a + (b - a) * ty;
}

const buf = () =>
  memo('s06:hazeBuf', () => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const limb = new Float32Array(W);
    for (let x = 0; x < W; x++) limb[x] = limbY((x + 0.5) * K);
    return { cv, cx, img: cx.createImageData(W, H), limb };
  });

/** overall presence of the infrared cloud */
export const hazeOn = (f: number) => ease.inOutSine(seg(f, T.irStart + 4, T.irStart + 44)) * (1 - ease.inOutSine(seg(f, T.diveStart - 4, T.diveStart + 24)));

export function drawIRHaze(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  const A = hazeOn(f);
  if (A <= 0.004) return;
  const N = noiseTab();
  const B = buf();
  const D = B.img.data;
  // reach of the ink (px above the limb): it keeps spreading through the beat
  const top = 60 + 820 * ease.outCubic(seg(f, T.irStart + 4, T.diveStart + 6));
  const t = f - T.irStart;
  for (let y = 0; y < H; y++) {
    const wy = Y0 + (y + 0.5) * K;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const h = B.limb[x] - wy; // height above the limb (world px)
      const q = h / top;
      if (h < -6 || q > 1.3) {
        D[o + 3] = 0;
        continue;
      }
      const wx = (x + 0.5) * K;
      // domain-warped, vertically stretched noise advected UPWARD → rising, curling plume fingers
      const w1 = nz(N, wx / 34 + 3.3, (h - 0.8 * t) / 40 + 9.9) - 0.5;
      const w2 = nz(N, wx / 34 + 21.7, (h - 0.8 * t) / 40 + 1.3) - 0.5;
      const n = nz(N, wx / 9 + 3.4 * w1, (h - 1.8 * t) / 30 + 3 * w2);
      const d = nz(N, wx / 6 + 17.3, (h - 2.6 * t) / 12 + 5.1) - 0.5;
      // the higher, the fewer fingers survive (the same energy over ever more sky): a rising threshold
      const th = 0.3 + 0.38 * q;
      const v = n + 0.2 * d;
      let rho = clamp((v - th + 0.02) / 0.16);
      rho = rho * rho * (3 - 2 * rho) * (1 - clamp((q - 0.85) / 0.45));
      // a faint diffuse glow under the fingers, and the dense layer hugging the limb where every plume is born
      rho = Math.max(rho, 0.22 * Math.exp(-Math.max(0, h) / (0.45 * top)), 0.9 * Math.exp(-Math.max(0, h) / 34) * clamp(h / 8 + 0.75));
      if (rho < 0.012) {
        D[o + 3] = 0;
        continue;
      }
      // Beer–Lambert-like ramp: thin = deep wine #7A0E1A, mid = IR red #FF3B2F, dense = hot #FF6A3D; lit plume rims
      const rim = 4 * rho * (1 - rho);
      const m1 = clamp(rho * 2);
      const m2 = clamp((rho - 0.6) / 0.4);
      D[o] = 122 + 133 * m1 + 40 * rim;
      D[o + 1] = 14 + 45 * m1 + 47 * m2 + 50 * rim;
      D[o + 2] = 26 + 21 * m1 + 14 * m2 + 36 * rim;
      D[o + 3] = 255 * Math.min(1, (1 - Math.exp(-2.6 * rho)) * 0.6 * A);
    }
  }
  B.cx.putImageData(B.img, 0, 0);
  ctx.save();
  applyWorld(ctx, cam);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(B.cv, 0, Y0, 1080, H * K);
  ctx.restore();
}

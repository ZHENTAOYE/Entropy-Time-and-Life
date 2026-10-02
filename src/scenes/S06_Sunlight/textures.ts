// Memoised procedural textures (computed once per tab).
import { memo } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { mulberry32 } from '../../lib/random';

const mk = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Solar granulation: dark lanes between bright cells (soft-light over the disc). */
export const granTex = () =>
  memo('s06:gran', () => {
    const S = 128;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(S, S);
    // cheap Worley F2-F1 on a jittered grid
    const G = 12;
    const r = mulberry32(61);
    const pts: number[] = [];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push((i + 0.15 + r() * 0.7) / G, (j + 0.15 + r() * 0.7) / G);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const u = x / S;
        const v = y / S;
        const ci = Math.floor(u * G);
        const cj = Math.floor(v * G);
        let f1 = 9;
        let f2 = 9;
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = (ci + di + G) % G;
            const jj = (cj + dj + G) % G;
            let px = pts[(jj * G + ii) * 2];
            let py = pts[(jj * G + ii) * 2 + 1];
            if (ci + di < 0) px -= 1;
            if (ci + di >= G) px += 1;
            if (cj + dj < 0) py -= 1;
            if (cj + dj >= G) py += 1;
            const d = (px - u) * (px - u) + (py - v) * (py - v);
            if (d < f1) {
              f2 = f1;
              f1 = d;
            } else if (d < f2) f2 = d;
          }
        const e = Math.sqrt(f2) - Math.sqrt(f1);
        const lane = Math.min(1, e * G * 2.2);
        // centred on mid-grey (neutral for soft-light): dark intergranular lanes, bright cell centres
        const val = 60 + Math.pow(lane, 0.7) * 150;
        const i = (y * S + x) * 4;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/** Heat-death grey: #5C5C5C ± ~6 % gaussian luminance noise (tileable 256²). Several variants for boiling. */
export const greyTiles = () =>
  memo('s06:grey', () => {
    const out: HTMLCanvasElement[] = [];
    for (let k = 0; k < 4; k++) {
      const S = 256;
      const c = mk(S, S);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const img = ctx.createImageData(S, S);
      const r = mulberry32(900 + k * 17);
      for (let i = 0; i < S * S; i++) {
        const g = (r() + r() + r() - 1.5) / 0.5; // ~N(0,1)
        const v = 92 + g * 5.5;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  });

/** Very faint interstellar dust (blue/violet), 270×480, drawn upscaled. */
export const nebulaTex = () =>
  memo('s06:neb', () => {
    const W = 126;
    const H = 224;
    const c = mk(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(W, H);
    const n = makeNoise(77);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = n.fbm2(x / 49, y / 49, 4);
        const w = n.fbm2(x / 21 + 9, y / 21, 3);
        const d = Math.max(0, v * 0.9 + w * 0.35 + 0.05);
        const i = (y * W + x) * 4;
        img.data[i] = 40 + w * 40;
        img.data[i + 1] = 60;
        img.data[i + 2] = 140;
        img.data[i + 3] = Math.min(255, d * 120);
      }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/** Land seen from low orbit at dusk: fbm relief hillshaded by a low Sun from the top of the frame — olive / umber
 *  slopes catching warm light, slate shadows (mean luminance ~0.3). 320², drawn with a soft circular edge. */
export const terrainTex = () =>
  memo('s06:terrain', () => {
    const S = 320;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(S, S);
    const n = makeNoise(1717);
    const h = new Float32Array(S * S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const v = n.fbm2(x / 70, y / 70, 5);
        const rid = 1 - Math.abs(n.fbm2(x / 34 + 5, y / 34 - 3, 3));
        h[y * S + x] = v * 0.7 + rid * rid * 0.45;
      }
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        const hx = h[y * S + Math.min(S - 1, x + 1)] - h[y * S + Math.max(0, x - 1)];
        const hy = h[Math.min(S - 1, y + 1) * S + x] - h[Math.max(0, y - 1) * S + x];
        // light from the top of the frame, low (dusk): slopes facing up catch it
        const shade = Math.max(0, Math.min(1, 0.55 + hy * 9 - hx * 2.5));
        const moist = n.fbm2(x / 52 + 20, y / 52, 3) * 0.5 + 0.5;
        const t = Math.max(0, Math.min(1, (h[i] + 0.4) / 1.1));
        // olive lowlands → umber uplands; slate in shadow, warm amber where lit
        const br = [62 + 40 * (1 - moist) + 30 * t, 70 + 22 * moist - 6 * t, 40 + 10 * moist];
        const sh = [26, 32, 40];
        const k = 0.25 + 0.95 * shade;
        const j = i * 4;
        img.data[j] = sh[0] + (br[0] * 1.35 - sh[0]) * k + 40 * Math.pow(shade, 3);
        img.data[j + 1] = sh[1] + (br[1] * 1.3 - sh[1]) * k + 24 * Math.pow(shade, 3);
        img.data[j + 2] = sh[2] + (br[2] * 1.2 - sh[2]) * k;
        // soft circular edge (alpha) so it melts into the planet around it
        const dx = (x + 0.5) / S - 0.5;
        const dy = (y + 0.5) / S - 0.5;
        const rr = Math.sqrt(dx * dx + dy * dy) * 2;
        img.data[j + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - rr) / 0.35)));
      }
    ctx.putImageData(img, 0, 0);
    return c;
  });

/** Soft cloud puffs (white, alpha = density) for the cloud deck the camera passes through during the dive. */
export const cloudPuffs = () =>
  memo('s06:cloudPuffs', () => {
    const nz = makeNoise(4646);
    const out: HTMLCanvasElement[] = [];
    const S = 128;
    for (let v = 0; v < 3; v++) {
      const c = mk(S, S);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const img = ctx.createImageData(S, S);
      const o = v * 9.3;
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const px = (x / S) * 2 - 1;
          const py = (y / S) * 2 - 1;
          const q = nz.fbm2(px * 1.6 + o, py * 1.6, 3);
          const n = nz.fbm2(px * 2.8 + q * 1.4 + o, py * 2.8 + q, 4);
          const r = Math.hypot(px, py * 1.25) + n * 0.45;
          const d = Math.max(0, Math.min(1, (0.92 - r) / 0.6));
          const i = (y * S + x) * 4;
          // lit from the top (warm), shadowed below (blue-grey)
          const lit = Math.max(0, Math.min(1, 0.5 - py * 0.6 + n * 0.5));
          img.data[i] = 150 + 105 * lit;
          img.data[i + 1] = 160 + 85 * lit;
          img.data[i + 2] = 185 + 55 * lit;
          img.data[i + 3] = Math.round(255 * d * d * (0.6 + 0.4 * (n * 0.5 + 0.5)));
        }
      ctx.putImageData(img, 0, 0);
      out.push(c);
    }
    return out;
  });

/** Tinted soft sprite (cached per colour). */
export const tintDot = (rgb: string) =>
  memo('s06:tdot:' + rgb, () => {
    const S = 64;
    const c = mk(S, S);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.22, `rgba(${rgb},0.5)`);
    g.addColorStop(0.55, `rgba(${rgb},0.12)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  });

/** Scratch canvases for bloom passes (reused). */
export const scratch = (key: string, w: number, h: number) =>
  memo(`s06:scratch:${key}:${w}x${h}`, () => mk(w, h));

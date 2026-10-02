// S08 — low-frequency sand noise as a tileable 128×128 RGBA texture (one texture fetch instead of six value-noise
// evaluations in the shader — the shader compiles once per render tab, and its size dominates that cost).
//   R,G = gradient of the broad dune undulation (analytic derivative of quintic value noise, encoded ×1/4 + ½)
//   B   = light-pool / colour-patch noise      A = drifting veil of blown sand
// The texture spans NOISE_WORLD world px and repeats.
import { memo } from '../../lib/math';
import { hash01 } from '../../lib/random';

export const NOISE_WORLD = 4096;
const N = 128; // low-frequency content, linearly filtered: 128² is plenty (and 4× cheaper to build per tab)

/** periodic quintic value noise on a P×P lattice over [0,1)²: [value, d/du, d/dv] in lattice units */
function pnoise(u: number, v: number, P: number, seed: number): [number, number, number] {
  const x = u * P;
  const y = v * P;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const h = (a: number, b: number) => hash01((((a % P) + P) % P) * 131 + (((b % P) + P) % P), seed);
  const a = h(i, j);
  const b = h(i + 1, j);
  const c = h(i, j + 1);
  const d = h(i + 1, j + 1);
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dsx = 30 * fx * fx * (fx - 1) * (fx - 1);
  const dsy = 30 * fy * fy * (fy - 1) * (fy - 1);
  const val = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  const du = (b - a + (a - b - c + d) * sy) * dsx;
  const dv = (c - a + (a - b - c + d) * sx) * dsy;
  return [val, du, dv];
}

export function sandNoise(): ImageData {
  return memo('S08:sandNoise', () => {
    const img = new ImageData(N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const u = (x + 0.5) / N;
        const v = (y + 0.5) / N;
        const [, gx, gy] = pnoise(u, v, 5, 11);
        const pool = 0.6 * pnoise(u, v, 5, 12)[0] + 0.4 * pnoise(u, v, 8, 13)[0];
        const veil = pnoise(u, v, 11, 14)[0];
        const o = (y * N + x) * 4;
        img.data[o] = Math.round((gx / 4 + 0.5) * 255);
        img.data[o + 1] = Math.round((gy / 4 + 0.5) * 255);
        img.data[o + 2] = Math.round(pool * 255);
        img.data[o + 3] = Math.round(veil * 255);
      }
    return img;
  });
}

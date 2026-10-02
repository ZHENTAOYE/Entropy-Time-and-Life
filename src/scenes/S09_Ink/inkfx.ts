// S09 B5–B7: everything that is INK after the inversion (drawn into the shared ink stage with multiply).
// One colour law for all of it (the inverted web's: COSMOS paper / COSMOS_INK_K / COSMOS_INK_FLOOR), so the web,
// the figure, the brush 你, the ◀◀ and the title are visibly the same ink at different dilutions.
//
// * (the web's own ink is a density field advected by the tank's water: inkfield.ts / flow.ts)
// * haze — the ink's fate: an almost uniform blue-grey haze that keeps growing (the S-gauge keeps rising).
// * (the figure — made of the web's own ink, by flow: figure.ts + inkfield.ts)
// * ◀◀ and the title — captured exactly as drawn, then handed to the same water (inklocal.ts).
import { COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../lib/cosmos';
import { clamp, memo, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';
import { captureMask, drawSpread } from './inklocal';
import { F } from './fonts';
import { END, INV, RW, SURFACE_Y } from './timing';

export const K = COSMOS_INK_K;
export const FLOOR = COSMOS_INK_FLOOR;

/** smooth divergence-free displacement field (sum of 4 stream-function modes), ~unit amplitude */
export function flowField(x: number, y: number, t: number): [number, number] {
  const M: Array<[number, number, number, number]> = [
    [0.0061, 0.0042, 0.31, 0.4],
    [-0.0035, 0.0078, 0.23, 2.1],
    [0.0093, -0.0051, 0.41, 4.4],
    [0.0022, 0.0105, 0.37, 5.3],
  ];
  let vx = 0,
    vy = 0;
  for (const [kx, ky, w, ph] of M) {
    const c = Math.cos(kx * x + ky * y + w * t + ph);
    const kk = Math.hypot(kx, ky);
    vx += (c * ky) / kk;
    vy -= (c * kx) / kk;
  }
  return [vx * 0.5, vy * 0.5];
}

// ───────────────────────────── haze ─────────────────────────────
const HW = 135,
  HH = 240;
function hazeField(): Float32Array {
  return memo('s09:haze', () => {
    const nz = makeNoise(4242);
    const out = new Float32Array(HW * (HH + 120));
    for (let j = 0; j < HH + 120; j++)
      for (let i = 0; i < HW; i++) {
        const x = i * 8,
          y = j * 8 - 960;
        const v = 0.6 + 0.28 * nz.fbm2(x * 0.0014, y * 0.0011, 3) + 0.08 * nz.fbm2(x * 0.004 + 3, y * 0.0035, 2);
        out[j * HW + i] = clamp(v);
      }
    return out;
  });
}
/**
 * The uniform blue-grey haze of spent ink at frame f (density `amount`, slowly sinking): a 135×240 density image
 * (8 px per sample) that inkfield adds to the web's own density before the Beer–Lambert conversion.
 */
const hzCache = { key: '', a: new Float32Array(HW * HH) };
export function hazeAt(f: number, amount: number): Float32Array {
  const key = `${f}|${amount}`;
  if (hzCache.key === key) return hzCache.a;
  hzCache.key = key;
  const H = hazeField();
  const d = hzCache.a;
  const off = Math.round(((f - INV.handover) / 30) * 1.2) % 120;
  for (let j = 0; j < HH; j++) {
    // spent ink settles: denser towards the bottom of the tank, none above the surface
    const y = j * 8;
    const vert = y < SURFACE_Y ? 0 : smoothstep(SURFACE_Y, SURFACE_Y + 260, y) * (0.75 + 0.35 * (y / 1920));
    for (let i = 0; i < HW; i++) d[j * HW + i] = amount * vert * H[(119 - off + j) * HW + i] * 1.25;
  }
  return d;
}

// ───────────────────────────── ◀◀ → ink, title → ink ─────────────────────────────
export const TC = { x: 90, y: 340 } as const;
export const TITLE = { y: 950, pinyinY: 846 } as const;

export const TC_FONT = F.tc;
/** the ◀◀ timecode, captured as ink exactly as drawn when it melts, then spreading (sinks into the water) */
export function drawRewindInk(ctx: CanvasRenderingContext2D, f: number, light: number, text: string) {
  const tau = (f - RW.melt[0]) / 30;
  if (tau < 0 || light <= 0.01) return;
  const cap = captureMask(`tc:${text}`, TC.x - 10, TC.y - 30, 560, 60, 0.5, 2.6, (g) => {
    g.font = TC_FONT;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(text, TC.x, TC.y);
  });
  const gain = light * smoothstep(0, 0.2, tau) * (1 - 0.55 * smoothstep(0, 1.6, tau));
  if (gain < 0.01) return;
  drawSpread(ctx, cap, tau, { sinkV: 60, sinkA: 14, flowA: 0, curlA: 0, s0: 0.2, sK: 6, margin: 140, gain, t0: (RW.melt[0] - INV.handover) / 30 });
}

export const TITLE_TEXT = '熵 · 时间 · 生命';
/** draw the title glyphs (+ pinyin) exactly where the title caption lays them out */
export function drawTitleMask(c: CanvasRenderingContext2D) {
  c.font = F.title;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  const ls = 0.26 * 86;
  const chars = Array.from(TITLE_TEXT);
  const ws = chars.map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let x = 540 - total / 2;
  chars.forEach((ch, i) => {
    c.fillText(ch, x + ws[i] / 2, TITLE.y + 86 * 0.38);
    if (i === 0) {
      c.save();
      c.font = F.pinyin;
      c.fillText('shāng', x + ws[i] / 2, TITLE.y - 62);
      c.restore();
    }
    x += ws[i] + ls;
  });
}
export function drawTitleInk(ctx: CanvasRenderingContext2D, f: number, light: number) {
  const tau = (f - END.titleMelt[0]) / 30;
  if (tau < 0 || light <= 0.01) return;
  const gain = light * smoothstep(0, 0.33, tau) * (1 - 0.4 * smoothstep(0, 1.2, tau));
  if (gain < 0.01) return;
  const cap = captureMask('title', 40, TITLE.y - 130, 1000, 200, 0.5, 2.5, drawTitleMask);
  drawSpread(ctx, cap, tau, { sinkV: 40, sinkA: 8, flowA: 0, curlA: 0, s0: 0.2, sK: 7, margin: 120, gain, t0: (END.titleMelt[0] - INV.handover) / 30 });
}

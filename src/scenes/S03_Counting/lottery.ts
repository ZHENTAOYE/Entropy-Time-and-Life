// Beat 5: the lottery that never wins. A waterfall of random 100-bit microstates (lit = particle on the left)
// streams down under a pinned TARGET row (all 100 on the left). Each row is a trial; HITS stays 0, BEST creeps to the
// high 60s. The waterfall reads as a uniform grey-amber shimmer — maximum entropy looks like noise (→ S05).
import { clamp, ease, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { C, T } from './constants';
import { Ctx, MONO, SANS, drawRich, glow, rgbaHex, sup } from './paint';

export const LOT = { x0: 140, top: 428, bot: 1310, cellW: 8, pitch: 6, targetY: 392 } as const;
const NB = 100;
const MAXROWS = 420;

/** bits of row r (memo) + popcount + running best */
const ROWS = () =>
  memo('S03:lotRows', () => {
    const bits = new Uint8Array(MAXROWS * NB);
    const pop = new Uint8Array(MAXROWS);
    const best = new Uint8Array(MAXROWS);
    let b = 0;
    for (let r = 0; r < MAXROWS; r++) {
      let p = 0;
      for (let i = 0; i < NB; i++) {
        const v = hash01(r * 131 + i * 7, 4242) < 0.5 ? 1 : 0;
        bits[r * NB + i] = v;
        p += v;
      }
      pop[r] = p;
      b = Math.max(b, p);
      best[r] = b;
    }
    return { bits, pop, best };
  });

/** scrolled distance (px): the curtain unrolls fast, then streams at 9 px/frame */
export function lotScroll(f: number): number {
  const fill = LOT.bot - LOT.top;
  return fill * ease.outCubic(seg(f, T.lottery, T.lottery + 18)) + 9 * Math.max(0, f - (T.lottery + 18));
}
export const lotRowsEntered = (f: number) => Math.max(0, Math.min(MAXROWS - 1, Math.floor(lotScroll(f) / LOT.pitch)));

const BUF_W = NB * 4; // 3 px lit + 1 px gap per cell (×2 when drawn)
function buffer(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData } {
  return memo('S03:lotBuf', () => {
    const c = document.createElement('canvas');
    const rows = Math.ceil((LOT.bot - LOT.top) / LOT.pitch) + 3;
    c.width = BUF_W;
    c.height = rows * 3;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    return { c, g, img: g.createImageData(c.width, c.height) };
  });
}

export function lotteryAlpha(f: number) {
  return seg(f, T.lottery, T.lottery + 6) * (1 - seg(f, T.glass + 2, T.glass + 22));
}

export function drawLottery(ctx: Ctx, f: number) {
  const A = lotteryAlpha(f);
  if (A <= 0.003) return;
  const R = ROWS();
  const D = lotScroll(f);
  const { c, g, img } = buffer();
  const data = img.data;
  data.fill(0);
  const nVis = c.height / 3;
  // row at buffer slot j (top = 0) is the row whose y is LOT.top + (D mod pitch) + (j − 1)·pitch
  const frac = D % LOT.pitch;
  const newest = Math.floor(D / LOT.pitch); // index of the row just entering at the top
  // the glass beat: rows dissolve top-down into loose bits
  const dis = seg(f, T.glass, T.glass + 22);
  for (let j = 0; j < nVis; j++) {
    const r = newest - j + 1;
    if (r < 0 || r >= MAXROWS) continue;
    const y = LOT.top + frac + (j - 1) * LOT.pitch;
    if (y < LOT.top - 1 || y > LOT.bot) continue;
    const p = R.pop[r];
    const hot = p >= 64 ? 1 : 0;
    const flick = 0.55 + 0.45 * hash01(r * 17 + f, 99);
    const age = clamp((newest - r) / 6); // just-entered rows are brighter
    const lum = (0.42 + 0.35 * (1 - age)) * flick;
    for (let i = 0; i < NB; i++) {
      const on = R.bits[r * NB + i];
      if (dis > 0 && hash01(r * 977 + i, 5) < dis * 1.4 - (y - LOT.top) / 1800) continue;
      let rr: number, gg: number, bb: number, aa: number;
      if (on) {
        if (hot) {
          rr = 255;
          gg = 236;
          bb = 196;
          aa = 255 * Math.min(1, lum + 0.3);
        } else {
          rr = 255;
          gg = 159 + 60 * hash01(i + r * 3, 11);
          bb = 46 + 60 * hash01(i + r * 3, 12);
          aa = 255 * lum;
        }
      } else {
        rr = 255;
        gg = 159;
        bb = 46;
        aa = 255 * 0.07;
      }
      for (let yy = 0; yy < 2; yy++) {
        let o = ((j * 3 + yy) * BUF_W + i * 4) * 4;
        for (let xx = 0; xx < 3; xx++) {
          data[o] = rr;
          data[o + 1] = gg;
          data[o + 2] = bb;
          data[o + 3] = aa;
          o += 4;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = A;
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(LOT.x0 - 4, LOT.top, NB * LOT.cellW + 8, LOT.bot - LOT.top);
  ctx.clip();
  ctx.drawImage(c, 0, 0, c.width, c.height, LOT.x0, LOT.top + frac - LOT.pitch, NB * LOT.cellW, (c.height / 3) * LOT.pitch);
  ctx.restore();
  // every few rows: how many of its 100 are on the left (always ≈ 50; near-misses ≥ 64 in white)
  ctx.save();
  ctx.font = MONO(14, 400);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let j = 0; j < nVis; j++) {
    const r = newest - j + 1;
    if (r < 0 || r >= MAXROWS) continue;
    const y = LOT.top + frac + (j - 1) * LOT.pitch;
    if (y < LOT.top + 4 || y > LOT.bot - 120) continue;
    const p = R.pop[r];
    if (r % 7 !== 0 && p < 64) continue;
    ctx.fillStyle = p >= 64 ? `rgba(255,255,255,${(0.9 * A).toFixed(3)})` : rgbaHex(C.amber, 0.45 * A);
    ctx.fillText(String(p), LOT.x0 + NB * LOT.cellW + 10, y + 2);
  }
  ctx.restore();
  // fade the bottom edge of the waterfall
  ctx.save();
  const gr = ctx.createLinearGradient(0, LOT.bot - 160, 0, LOT.bot);
  gr.addColorStop(0, 'rgba(7,6,4,0)');
  gr.addColorStop(1, 'rgba(7,6,4,1)');
  ctx.fillStyle = gr;
  ctx.globalAlpha = A;
  ctx.fillRect(LOT.x0 - 6, LOT.bot - 160, NB * LOT.cellW + 12, 162);
  ctx.restore();
  // pinned target row: all 100 on the left
  const tA = A * seg(f, T.lottery + 6, T.lottery + 14);
  if (tA > 0.003) {
    const sweep = (f - T.lottery) * 3.2;
    for (let i = 0; i < NB; i++) {
      const s = 0.75 + 0.25 * Math.max(0, Math.cos((i - sweep) * 0.12));
      ctx.fillStyle = `rgba(255,255,255,${(tA * s).toFixed(3)})`;
      ctx.fillRect(LOT.x0 + i * LOT.cellW, LOT.targetY, LOT.cellW - 2, 8);
    }
    ctx.font = SANS(24, 400);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,255,255,${(0.9 * tA).toFixed(3)})`;
    ctx.fillText('目标：100 个全在左边', LOT.x0, LOT.targetY - 18);
    drawRich(ctx, sup('1 / 2^{100}'), LOT.x0 + NB * LOT.cellW, LOT.targetY - 18, { font: MONO(24, 400), size: 24, color: '#FFFFFF', align: 'right', alpha: 0.8 * tA });
    // brackets marking the waterfall as trials
    ctx.strokeStyle = rgbaHex(C.amber, 0.45 * tA);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LOT.x0 - 14, LOT.top);
    ctx.lineTo(LOT.x0 - 14, LOT.top + 300);
    ctx.stroke();
  }
}

/** dark band behind the monumental 10⁻³⁰ (Ikeda: hard black slab across the data) */
export function drawLotteryBand(ctx: Ctx, f: number) {
  const A = lotteryAlpha(f) * seg(f, T.c5 - 4, T.c5 + 8) * (1 - seg(f, T.c5End - 12, T.c5End));
  if (A <= 0.003) return;
  ctx.save();
  const y0 = 690;
  const y1 = 1120;
  const gr = ctx.createLinearGradient(0, y0 - 50, 0, y1 + 50);
  gr.addColorStop(0, 'rgba(7,6,4,0)');
  gr.addColorStop(50 / (y1 - y0 + 100), 'rgba(7,6,4,0.9)');
  gr.addColorStop(1 - 50 / (y1 - y0 + 100), 'rgba(7,6,4,0.9)');
  gr.addColorStop(1, 'rgba(7,6,4,0)');
  ctx.fillStyle = gr;
  ctx.globalAlpha = A;
  ctx.fillRect(0, y0 - 50, 1080, y1 - y0 + 100);
  ctx.restore();
}

export function drawLotteryHud(ctx: Ctx, f: number) {
  const A = lotteryAlpha(f) * seg(f, T.lottery + 8, T.lottery + 14);
  if (A <= 0.003) return;
  const R = ROWS();
  const n = lotRowsEntered(f);
  const trials = String(n + 1).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2');
  drawRich(ctx, [{ t: `TRIALS ${trials}  ·  HITS ` }, { t: '0', color: C.strike }], 90, 252, { font: MONO(26, 400), size: 26, color: C.amber, alpha: 0.9 * A, tracking: 1.5 });
  drawRich(ctx, [{ t: `BEST   ${R.best[n]}/100` }], 90, 290, { font: MONO(26, 400), size: 26, color: C.pale, alpha: 0.75 * A, tracking: 1.5 });
}

export function glowLottery(ctx: Ctx, f: number) {
  const A = lotteryAlpha(f) * seg(f, T.lottery + 6, T.lottery + 14);
  if (A <= 0.003) return;
  ctx.save();
  ctx.globalAlpha = A * 0.7;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(LOT.x0, LOT.targetY - 2, 800, 12);
  ctx.restore();
  glow(ctx, C.amber, 540, 860, 520, 0.12 * A);
}

export const lotSup = sup;

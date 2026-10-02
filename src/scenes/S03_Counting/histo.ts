// Beat 4: the histogram sharpens with N. N = 10: all 1024 microstates (10-bit barcodes) rain into 11 columns
// (1 10 45 120 210 252 …). N = 100: 101 thin bars (each a stack of microstates). N = 10⁴: a needle.
// Relative width σ/N = 1/(2√N): 16 % → 5 % → 0.5 % — shown by a dimension bracket that closes on the peak.
import { clamp, ease, lerp, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { AX, C, T, axX } from './constants';
import { Ctx, MONO, binom, dimLineH, drawRich, glow, popcount, rgbaHex, sup } from './paint';

const N10 = 10;
const BAR10_W = 64;
const PITCH10 = 2.2;
const BAR10_H = 1.7;

/** Galton board: microstate c drops through 10 rows of pegs; at row r its bit r decides the bounce (1 = left).
 * After 10 bounces it sits above column popcount(c) — the board itself counts the arrangements. */
export const BOARD = { x: 540, y0: 336, dy: 19, step: 23, rows: 10 } as const;
const BOUNCE = 1.25; // frames per row
const DROP = 8; // frames from the board's exit to the stack
interface Rain {
  col: Int8Array;
  slot: Int16Array;
  spawn: Float32Array;
}
const RAIN = () =>
  memo('S03:rain2', (): Rain => {
    const n = 1 << N10;
    const col = new Int8Array(n);
    const slot = new Int16Array(n);
    const spawn = new Float32Array(n);
    const order = Array.from({ length: n }, (_, c) => c).sort((a, b) => hash01(a, 5) - hash01(b, 5));
    order.forEach((c, k) => (spawn[c] = T.rain + (k / n) * 16));
    const cnt = new Array(N10 + 1).fill(0);
    for (const c of order) {
      const k = popcount(c);
      col[c] = k;
      slot[c] = cnt[k]++;
    }
    return { col, slot, spawn };
  });
const landAt = (R: Rain, c: number) => R.spawn[c] + BOARD.rows * BOUNCE + DROP;

/** position of microstate c at frame f (null before it spawns); `inBoard` while bouncing */
function galtonPos(R: Rain, c: number, f: number): { x: number; y: number; w: number; landed: boolean } | null {
  const t = f - R.spawn[c];
  if (t < 0) return null;
  const rowsT = t / BOUNCE;
  const yl = AX.base - PITCH10 * (R.slot[c] + 1);
  const xEnd = axX(R.col[c] / N10);
  if (rowsT < BOARD.rows) {
    const r = Math.floor(rowsT);
    const u = rowsT - r;
    let off = 0;
    for (let i = 0; i < r; i++) off += (c >> (N10 - 1 - i)) & 1 ? -1 : 1;
    const dir = (c >> (N10 - 1 - r)) & 1 ? -1 : 1;
    const x = BOARD.x + (off + dir * ease.inOutQuad(u)) * BOARD.step;
    const y = BOARD.y0 + (r + u) * BOARD.dy - Math.sin(u * Math.PI) * 3;
    return { x, y, w: 16, landed: false };
  }
  const d = clamp((t - BOARD.rows * BOUNCE) / DROP);
  const yb = BOARD.y0 + BOARD.rows * BOARD.dy;
  const y = lerp(yb, yl, d * d);
  let off = 0;
  for (let i = 0; i < N10; i++) off += (c >> (N10 - 1 - i)) & 1 ? -1 : 1;
  const x = lerp(BOARD.x + off * BOARD.step, xEnd, ease.outCubic(clamp(d * 1.6)));
  const w = lerp(16, BAR10_W, ease.inOutQuad(clamp((d - 0.55) / 0.45)));
  return { x, y, w, landed: d >= 1 };
}

export const COUNTS10 = Array.from({ length: N10 + 1 }, (_, k) => binom(N10, k));

/** σ of the left-fraction for N particles */
const sigmaN = (N: number) => 1 / (2 * Math.sqrt(N));

/** current histogram "N" in log space and its σ */
function sigmaAt(f: number): number {
  const a = ease.inOutCubic(seg(f, T.n100, T.n100 + 14));
  const b = ease.inOutCubic(seg(f, T.n1e4, T.n1e4 + 14));
  const lnN = lerp(lerp(Math.log(10), Math.log(100), a), Math.log(1e4), b);
  return sigmaN(Math.exp(lnN));
}

/** striped fill = stacked microstates */
function stripePattern(ctx: Ctx, hex: string, a: number): CanvasPattern | string {
  const key = 'S03:stripe:' + hex;
  const tile = memo(key, () => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 3;
    const g = c.getContext('2d')!;
    g.fillStyle = hex;
    g.fillRect(0, 0, 4, 2);
    g.globalAlpha = 0.35;
    g.fillRect(0, 2, 4, 1);
    return c;
  });
  const p = ctx.createPattern(tile, 'repeat');
  return p ?? rgbaHex(hex, a);
}

export function drawHisto(ctx: Ctx, f: number) {
  if (f < T.rain - 2 || f > T.lottery + 20) return;
  const out = 1 - seg(f, T.lottery, T.lottery + 14);
  const drop = ease.inCubic(seg(f, T.lottery, T.lottery + 16)) * 260;
  if (out <= 0.003) return;
  ctx.save();
  ctx.translate(0, drop);
  // ── axis
  const axA = out;
  ctx.strokeStyle = rgbaHex(C.amber, 0.6 * axA);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(70, AX.base + 4);
  ctx.lineTo(1010, AX.base + 4);
  ctx.stroke();
  // end labels
  ctx.font = `400 24px ${'"Noto Sans SC", sans-serif'}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgbaHex(C.amber, 0.7 * axA);
  ctx.textAlign = 'left';
  ctx.fillText('全在左', AX.x0 - 60, AX.base + 82);
  ctx.textAlign = 'center';
  ctx.fillText('各半', 540, AX.base + 82);
  ctx.textAlign = 'right';
  ctx.fillText('全在右', AX.x1 + 60, AX.base + 82);
  // ── N = 10: the Galton board
  const a10 = 1 - seg(f, T.n100, T.n100 + 10);
  if (a10 > 0.003) {
    const R = RAIN();
    // pegs
    const pa = a10 * seg(f, T.rain - 6, T.rain + 2) * (1 - seg(f, T.rain + 30, T.rain + 40));
    if (pa > 0.003) {
      ctx.fillStyle = rgbaHex(C.amber, 0.7 * pa);
      for (let r = 0; r < BOARD.rows; r++) {
        for (let j = 0; j <= r; j++) {
          const x = BOARD.x + (2 * j - r) * BOARD.step;
          ctx.beginPath();
          ctx.arc(x, BOARD.y0 + r * BOARD.dy + 5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // the hopper
      ctx.strokeStyle = rgbaHex(C.amber, 0.6 * pa);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(BOARD.x - 60, BOARD.y0 - 44);
      ctx.lineTo(BOARD.x - 10, BOARD.y0 - 10);
      ctx.moveTo(BOARD.x + 60, BOARD.y0 - 44);
      ctx.lineTo(BOARD.x + 10, BOARD.y0 - 10);
      ctx.stroke();
    }
    const cw = (w: number) => w / N10;
    // colours resolved once per frame (string building per bit cell is the expensive part)
    const colWhite = `rgba(255,255,255,${(0.95 * a10).toFixed(3)})`;
    const colLit = rgbaHex(C.pale, 0.95 * a10);
    const colDarkLanded = rgbaHex(C.amber, 0.16 * a10);
    const colDarkFlying = rgbaHex(C.amber, 0.3 * a10);
    for (let c = 0; c < 1 << N10; c++) {
      const p = galtonPos(R, c, f);
      if (!p) continue;
      const k = R.col[c];
      const fresh = p.landed && f < landAt(R, c) + 3;
      const h = p.landed ? BAR10_H : 3;
      const w = p.w;
      const x0 = p.x - w / 2;
      const cww = cw(w);
      const gap = w > 40 ? 0.8 : 0.3;
      // dark base for the whole microstate, then its lit bits
      ctx.fillStyle = p.landed ? colDarkLanded : colDarkFlying;
      ctx.fillRect(x0, p.y - h, w - gap, h);
      ctx.fillStyle = fresh || !p.landed || k === N10 ? colWhite : colLit;
      for (let b = 0; b < N10; b++) {
        if (((c >> (N10 - 1 - b)) & 1) === 0) continue;
        ctx.fillRect(x0 + b * cww, p.y - h, Math.max(0.6, cww - gap), h);
      }
    }
    // live counts under the columns (count up as the microstates land)
    const lands = memo('S03:rainLands', () => {
      const out: number[][] = Array.from({ length: N10 + 1 }, () => []);
      for (let c = 0; c < 1 << N10; c++) out[R.col[c]].push(landAt(R, c));
      out.forEach((l) => l.sort((x, y) => x - y));
      return out;
    });
    ctx.font = MONO(17, 400);
    ctx.textAlign = 'center';
    for (let k = 0; k <= N10; k++) {
      let n = 0;
      while (n < lands[k].length && lands[k][n] <= f) n++;
      if (n === 0) continue;
      const done = n === lands[k].length;
      ctx.fillStyle = k === N10 ? `rgba(255,255,255,${(0.95 * a10).toFixed(3)})` : rgbaHex(done ? C.pale : C.amber, (done ? 0.95 : 0.6) * a10);
      ctx.fillText(String(n), axX(k / N10), AX.base + 36);
    }
  }
  // ── N = 100 thin bars (σ shrinking toward the N = 100 value as they appear)
  const sig = sigmaAt(f);
  const a100 = seg(f, T.n100 + 2, T.n100 + 10) * (1 - seg(f, T.n1e4 + 2, T.n1e4 + 10));
  if (a100 > 0.003) {
    ctx.fillStyle = stripePattern(ctx, C.pale, a100);
    ctx.globalAlpha = a100;
    for (let k = 0; k <= 100; k++) {
      const p = k / 100;
      const g = Math.exp(-((p - 0.5) ** 2) / (2 * sig * sig));
      const h = AX.h * g;
      if (h < 0.4) continue;
      const x = axX(p);
      ctx.fillRect(x - 2.7, AX.base - h, 5.4, h);
    }
    ctx.globalAlpha = 1;
  }
  // ── the needle (continuous)
  const aN = seg(f, T.n1e4 + 2, T.n1e4 + 10);
  if (aN > 0.003) {
    ctx.beginPath();
    const halfW = Math.max(sig * 4.5, 0.002) * (AX.x1 - AX.x0);
    ctx.moveTo(540 - halfW * 1.5, AX.base);
    for (let i = 0; i <= 80; i++) {
      const x = 540 - halfW * 1.5 + (i / 80) * halfW * 3;
      const p = (AX.x1 - x) / (AX.x1 - AX.x0);
      const g = Math.exp(-((p - 0.5) ** 2) / (2 * sig * sig));
      ctx.lineTo(x, AX.base - AX.h * g);
    }
    ctx.lineTo(540 + halfW * 1.5, AX.base);
    ctx.closePath();
    const gr = ctx.createLinearGradient(0, AX.base - AX.h, 0, AX.base);
    gr.addColorStop(0, rgbaHex('#FFFFFF', aN));
    gr.addColorStop(0.3, rgbaHex(C.pale, aN));
    gr.addColorStop(1, rgbaHex(C.amber, 0.85 * aN));
    ctx.fillStyle = gr;
    ctx.fill();
  }
  // ── width bracket (relative width 1/(2√N))
  const bA = seg(f, T.rain + 18, T.rain + 26) * out;
  if (bA > 0.003) {
    const half = sig * (AX.x1 - AX.x0);
    const y = AX.base - AX.h - 36;
    dimLineH(ctx, 540 - Math.max(half, 3), 540 + Math.max(half, 3), y, 1, C.pale, 0.85 * bA, 0, 8);
    const pct = sig * 100;
    const label = pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(0) : pct.toFixed(1);
    drawRich(ctx, [{ t: `宽度 ${label} %` }], 540, y - 22, { font: MONO(26, 400), size: 26, color: C.pale, align: 'center', alpha: bA });
  }
  ctx.restore();
}

/** big data label N = 10 / 100 / 10⁴ + the count of arrangements (HUD-like, top-left of the chart) */
export function drawHistoLabels(ctx: Ctx, f: number) {
  if (f < T.rain || f > T.lottery + 12) return;
  const out = 1 - seg(f, T.lottery, T.lottery + 10);
  const stage = f < T.n100 ? 0 : f < T.n1e4 ? 1 : 2;
  const st = [T.rain, T.n100, T.n1e4][stage];
  const rev = seg(f, st, st + 6);
  const labels = ['N = 10', 'N = 100', 'N = 10^{4}'];
  const counts = ['2^{10} = 1 024 种排列', '2^{100} ≈ 1.27×10^{30} 种排列', '2^{10000} ≈ 10^{3010} 种排列'];
  drawRich(ctx, sup(labels[stage]), 90, 270, { font: MONO(52, 700), size: 52, color: C.pale, reveal: rev, alpha: out, cursor: true, frame: f });
  drawRich(ctx, sup(counts[stage]), 90, 312, { font: MONO(24, 400), size: 24, color: C.amber, reveal: seg(f, st + 3, st + 12), alpha: 0.85 * out });
}

export function glowHisto(ctx: Ctx, f: number) {
  if (f < T.n1e4 || f > T.lottery + 16) return;
  const aN = seg(f, T.n1e4 + 2, T.n1e4 + 12) * (1 - seg(f, T.lottery, T.lottery + 14));
  const drop = ease.inCubic(seg(f, T.lottery, T.lottery + 16)) * 260;
  for (let i = 0; i < 8; i++) glow(ctx, C.amber, 540, AX.base - AX.h * (i / 8) + drop, 90 - i * 6, 0.35 * aN);
}

export const clampH = clamp;

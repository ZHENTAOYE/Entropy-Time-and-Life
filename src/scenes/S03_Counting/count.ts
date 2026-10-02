// Beats 1–3: the box of 4 particles (closed-form gas), its live microstate ledger (左 | 右 bins), the 16 worlds
// (every left/right arrangement as a mini box) and their FLIP into the histogram 1 · 4 · 6 · 4 · 1.
import { clamp, ease, foldRange, lerp, memo, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { AX, BOX, C, P4, P4_R, T, axX } from './constants';
import { Ctx, MONO, SANS, barcode, brackets, glow, popcount, rgbaHex } from './paint';

// ------------------------------------------------------------------ the gas (closed form, exact elastic walls)
/** velocities (px per warped frame) found offline: 6 crossings 22–67, freezes in a 2:2 arrangement (A,B right). */
const V: Array<[number, number]> = [
  [12.36, 15.79],
  [-16.05, 13.57],
  [17.58, 2.19],
  [-22.42, -1.89],
];
const XL = [BOX.x0 + P4_R, BOX.divider - P4_R] as const; // left compartment
const XF = [BOX.x0 + P4_R, BOX.x1 - P4_R] as const; // whole box
const YB = [BOX.y0 + P4_R, BOX.y1 - P4_R] as const;

/** warped time: still until f4, ramps to full speed by f14, decelerates 66 → stops at the shutter (f74) */
export function gasU(f: number): number {
  if (f < 4) return 0;
  if (f <= 14) return (f - 4) ** 2 / 20;
  if (f <= 66) return 5 + (f - 14);
  const g = Math.min(f, 74) - 66;
  return 57 + g - (g * g) / 16;
}
const UL = gasU(T.release);

export function gasPos(i: number, f: number): [number, number] {
  const [x0, y0] = P4[i];
  const [vx, vy] = V[i];
  const u = gasU(f);
  let x: number;
  if (f <= T.release) x = foldRange(x0 + vx * u, XL[0], XL[1]);
  else {
    const xl = foldRange(x0 + vx * UL, XL[0], XL[1]);
    const d = foldRange(x0 + vx * (UL + 1e-4), XL[0], XL[1]) - xl;
    const s = Math.sign(d) || 1;
    x = foldRange(xl + s * Math.abs(vx) * (u - UL), XF[0], XF[1]);
  }
  const y = foldRange(y0 + vy * u, YB[0], YB[1]);
  return [x, y];
}

export const LETTERS = ['A', 'B', 'C', 'D'];
const isLeft = (i: number, f: number) => gasPos(i, f)[0] < BOX.divider;
/** microstate code: bit (3 − i) = 1 when particle i is on the left */
export function codeAt(f: number): number {
  let c = 0;
  for (let i = 0; i < 4; i++) if (isLeft(i, f)) c |= 1 << (3 - i);
  return c;
}
export const FREEZE_CODE = memo('S03:freezeCode', () => codeAt(T.freeze));

/** crossing events (frame, particle) — also the tick cues */
export const CROSSINGS: Array<[number, number]> = memo('S03:crossings', () => {
  const out: Array<[number, number]> = [];
  for (let f = T.release; f <= T.freeze; f++) for (let i = 0; i < 4; i++) if (isLeft(i, f) !== isLeft(i, f - 1)) out.push([f, i]);
  return out;
});
/** wall bounces (for crackle density) */
export const BOUNCES: number[] = memo('S03:bounces', () => {
  const out: number[] = [];
  for (let f = 5; f <= T.freeze; f++) {
    for (let i = 0; i < 4; i++) {
      const a = gasPos(i, f - 1);
      const b = gasPos(i, f);
      const c = gasPos(i, f + 1);
      if ((b[0] - a[0]) * (c[0] - b[0]) < 0 || (b[1] - a[1]) * (c[1] - b[1]) < 0) out.push(f);
    }
  }
  return out;
});

// ------------------------------------------------------------------ drawing helpers
export function drawDot(ctx: Ctx, x: number, y: number, r: number, alpha = 1, white = false) {
  if (alpha <= 0.003) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgbaHex('#FFF8EA', alpha));
  gr.addColorStop(0.45, rgbaHex(white ? '#FFFFFF' : C.pale, alpha));
  gr.addColorStop(1, rgbaHex(white ? '#FFF1D0' : C.amber, alpha));
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** the big box at the start (identical geometry to S02's OUT) */
function drawBigBox(ctx: Ctx, f: number, alpha: number) {
  const { x0, y0, x1, y1, divider } = BOX;
  // 「咔」: frame 0 is S02's OUT in amber; the click's light pulse peaks on f1 and decays
  const pulse = f < 1 ? 0 : Math.exp(-(f - 1) / 3.2);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgbaHex(C.amber, 0.9 * alpha);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  if (pulse > 0.02) {
    ctx.strokeStyle = rgbaHex(C.pale, pulse * alpha);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  // divider: lifts out of the box (10–20) — leaves a dashed reference line (the left/right border)
  const lift = ease.inOutCubic(seg(f, T.dividerLift, T.dividerLift + 10));
  const dy = -470 * lift;
  const da = (1 - seg(f, T.dividerLift + 5, T.dividerLift + 12)) * alpha;
  if (da > 0.003) {
    ctx.strokeStyle = rgbaHex(C.amber, 0.9 * da);
    ctx.beginPath();
    ctx.moveTo(divider, Math.max(y0 + dy, y0 - 400));
    ctx.lineTo(divider, y1 + dy);
    ctx.stroke();
    if (pulse > 0.02) {
      ctx.strokeStyle = rgbaHex(C.pale, pulse * da);
      ctx.stroke();
    }
  }
  const ref = seg(f, T.dividerLift + 6, T.dividerLift + 18) * alpha;
  if (ref > 0.003) {
    ctx.setLineDash([6, 8]);
    ctx.lineDashOffset = -f * 0.6;
    ctx.strokeStyle = rgbaHex(C.amber, 0.32 * ref);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(divider, y0 + 4);
    ctx.lineTo(divider, y1 - 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // notches where the divider used to sit
  ctx.fillStyle = rgbaHex(C.amber, 0.9 * alpha * seg(f, T.dividerLift + 4, T.dividerLift + 10));
  ctx.fillRect(divider - 5, y0 - 1, 10, 3);
  ctx.fillRect(divider - 5, y1 - 2, 10, 3);
  ctx.restore();
}

/** particle labels A–D (type on next to each dot) */
function drawLabels(ctx: Ctx, pos: Array<[number, number]>, f: number, alpha: number) {
  ctx.save();
  ctx.font = MONO(22, 400);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const on = seg(f, T.labels + i * 3, T.labels + i * 3 + 2);
    if (on <= 0) continue;
    const [x, y] = pos[i];
    ctx.fillStyle = rgbaHex(C.pale, 0.75 * alpha * on);
    ctx.fillText(LETTERS[i], x + 16, y - 16);
  }
  ctx.restore();
}

/** live microstate ledger under the box: 左 [ … ] | 右 [ … ] with letters hopping between bins on each crossing */
const BIN = { y: 1196, h: 64, lx: BOX.x0, rx: BOX.divider + 10, w: BOX.divider - BOX.x0 - 10 } as const;
function slotX(bin: 0 | 1, slot: number) {
  return (bin === 0 ? BIN.lx : BIN.rx) + 34 + slot * 46;
}
function ledgerTargets(f: number): number[] {
  // left bin letters in alphabetical order, then right bin
  const xs: number[] = [];
  let l = 0;
  let r = 0;
  for (let i = 0; i < 4; i++) {
    if (isLeft(i, f)) xs.push(slotX(0, l++));
    else xs.push(slotX(1, r++));
  }
  return xs;
}
function drawLedger(ctx: Ctx, f: number, alpha: number) {
  if (alpha <= 0.003) return;
  const ff = Math.min(f, T.freeze);
  // smoothed letter positions (box filter over the last frames: hops ease over ~5 f)
  const xs = [0, 0, 0, 0];
  const K = 3;
  let wsum = 0;
  for (let j = 0; j < K; j++) {
    const w = K - j;
    const t = ledgerTargets(Math.max(0, ff - j));
    for (let i = 0; i < 4; i++) xs[i] += t[i] * w;
    wsum += w;
  }
  for (let i = 0; i < 4; i++) xs[i] /= wsum;
  ctx.save();
  // bins
  const draw = ease.outCubic(seg(f, 14, 30));
  ctx.strokeStyle = rgbaHex(C.amber, 0.55 * alpha);
  ctx.lineWidth = 1.5;
  for (const bx of [BIN.lx, BIN.rx]) {
    ctx.beginPath();
    ctx.moveTo(bx, BIN.y - BIN.h / 2 + 10);
    ctx.lineTo(bx, BIN.y + BIN.h / 2);
    ctx.lineTo(bx + BIN.w * draw, BIN.y + BIN.h / 2);
    ctx.moveTo(bx + BIN.w, BIN.y - BIN.h / 2 + 10);
    ctx.lineTo(bx + BIN.w, BIN.y + BIN.h / 2);
    ctx.stroke();
  }
  ctx.font = SANS(24, 400);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgbaHex(C.amber, 0.75 * alpha * draw);
  ctx.fillText('左', BIN.lx, BIN.y - BIN.h / 2 - 6);
  ctx.textAlign = 'right';
  ctx.fillText('右', BIN.rx + BIN.w, BIN.y - BIN.h / 2 - 6);
  ctx.textAlign = 'left';
  // letters
  ctx.font = MONO(34, 700);
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 4; i++) {
    const on = seg(f, 16 + i * 2, 20 + i * 2);
    // flash on the frame a letter changes bin
    let flash = 0;
    for (const [cf, ci] of CROSSINGS) if (ci === i && f >= cf) flash = Math.max(flash, Math.exp(-(f - cf) / 3));
    ctx.fillStyle = flash > 0.05 ? `rgba(255,255,255,${(alpha * on).toFixed(3)})` : rgbaHex(C.pale, alpha * on);
    ctx.fillText(LETTERS[i], xs[i] - 10, BIN.y + 4);
  }
  // counts n : 4−n
  let nl = 0;
  for (let i = 0; i < 4; i++) if (isLeft(i, ff)) nl++;
  ctx.font = MONO(30, 400);
  ctx.textAlign = 'right';
  ctx.fillStyle = rgbaHex(C.amber, 0.9 * alpha * draw);
  ctx.fillText(String(nl), BIN.lx + BIN.w - 16, BIN.y + 4);
  ctx.fillText(String(4 - nl), BIN.rx + BIN.w - 16, BIN.y + 4);
  ctx.restore();
}


// ------------------------------------------------------------------ microstate tape (strip chart above the box)
/** each frame's microstate as a 4-bit column (rows A–D, lit = left), scrolling left; above it the left-count trace */
const TAPE = { x0: BOX.x0 + 40, x1: BOX.x1, y0: 478, pitch: 22, cell: 15, col: (BOX.x1 - BOX.x0 - 40) / 68, trace0: 372, trace1: 438 } as const;
function drawTape(ctx: Ctx, f: number, alpha: number) {
  if (alpha <= 0.003 || f < 6) return;
  const ff = Math.min(f, T.freeze);
  const n = Math.floor((TAPE.x1 - TAPE.x0) / TAPE.col);
  const draw = ease.outCubic(seg(f, 6, 20));
  ctx.save();
  // frame + row labels
  ctx.font = MONO(18, 400);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = rgbaHex(C.amber, 0.7 * alpha * draw);
    ctx.fillText(LETTERS[i], TAPE.x0 - 12, TAPE.y0 + i * TAPE.pitch + TAPE.cell / 2);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = rgbaHex(C.amber, 0.6 * alpha * draw);
  ctx.fillText('MICROSTATE  (亮 = 在左边)', BOX.x0, TAPE.y0 - 16);
  ctx.fillText('左边的个数', BOX.x0, TAPE.trace0 - 16);
  // bit columns, newest at the right edge
  for (let j = 0; j < n; j++) {
    const fr = ff - j;
    if (fr < 4) break;
    const x = TAPE.x1 - (j + 1) * TAPE.col;
    if (x < TAPE.x0 + (TAPE.x1 - TAPE.x0) * (1 - draw)) break;
    const code = codeAt(fr);
    const fresh = j === 0 && f <= T.freeze ? 1 : 0;
    for (let i = 0; i < 4; i++) {
      const on = (code >> (3 - i)) & 1;
      ctx.fillStyle = on ? (fresh ? `rgba(255,255,255,${alpha.toFixed(3)})` : rgbaHex(C.pale, alpha * (0.95 - 0.5 * (j / n)))) : rgbaHex(C.amber, 0.1 * alpha);
      ctx.fillRect(x, TAPE.y0 + i * TAPE.pitch, TAPE.col - 1, TAPE.cell);
    }
  }
  // the macro trace: number on the left (0..4), stepped
  ctx.strokeStyle = rgbaHex(C.amber, 0.25 * alpha * draw);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= 4; k++) {
    const y = TAPE.trace1 - (k / 4) * (TAPE.trace1 - TAPE.trace0);
    ctx.moveTo(TAPE.x0, y);
    ctx.lineTo(TAPE.x1, y);
  }
  ctx.stroke();
  ctx.strokeStyle = rgbaHex(C.pale, 0.9 * alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let j = n - 1; j >= 0; j--) {
    const fr = ff - j;
    if (fr < 4) continue;
    const x = TAPE.x1 - (j + 1) * TAPE.col;
    if (x < TAPE.x0 + (TAPE.x1 - TAPE.x0) * (1 - draw)) continue;
    const k = popcount(codeAt(fr));
    const y = TAPE.trace1 - (k / 4) * (TAPE.trace1 - TAPE.trace0);
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else ctx.lineTo(x, y);
    ctx.lineTo(x + TAPE.col, y);
  }
  ctx.stroke();
  ctx.font = MONO(16, 400);
  ctx.textAlign = 'left';
  ctx.fillStyle = rgbaHex(C.amber, 0.6 * alpha * draw);
  for (const k of [0, 4]) ctx.fillText(String(k), TAPE.x1 + 8, TAPE.trace1 - (k / 4) * (TAPE.trace1 - TAPE.trace0) + 5);
  // the freeze: the last column is the snapshot
  if (f >= T.shutter) {
    const k = 1 - seg(f, T.shutter, T.shutter + 10);
    ctx.strokeStyle = `rgba(255,255,255,${(0.9 * alpha * (0.4 + 0.6 * k)).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(TAPE.x1 - TAPE.col - 3, TAPE.y0 - 4, TAPE.col + 5, 3 * TAPE.pitch + TAPE.cell + 8);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the 16 worlds
const CODES = Array.from({ length: 16 }, (_, c) => c);
/** canonical dot positions inside a 700×400 box (relative to its top-left): P4 shifted by +350 when on the right */
function canonical(i: number, left: boolean): [number, number] {
  return [P4[i][0] - BOX.x0 + (left ? 0 : 350), P4[i][1] - BOX.y0];
}
const GRID16 = { cx: 540, y0: 610, dx: 228, dy: 148, w: 196 } as const;
function gridCell(c: number): [number, number] {
  const i = Math.floor(c / 4);
  const j = c % 4;
  return [GRID16.cx + (j - 1.5) * GRID16.dx, GRID16.y0 + i * GRID16.dy];
}
export const COL_W = 150;
export const COL_PITCH = 100;
/** slot within its column (by code) */
const SLOT = memo('S03:slots', () => {
  const cnt = [0, 0, 0, 0, 0];
  return CODES.map((c) => cnt[popcount(c)]++);
});
export function colCell(c: number): [number, number] {
  const k = popcount(c);
  return [axX(k / 4), AX.base - COL_PITCH / 2 - SLOT[c] * COL_PITCH];
}
/** order in which the 15 copies peel off the original (ripple outward from its cell) */
const PEEL = memo('S03:peel', () => {
  const [fx, fy] = gridCell(FREEZE_CODE);
  const others = CODES.filter((c) => c !== FREEZE_CODE).sort((a, b) => {
    const [ax, ay] = gridCell(a);
    const [bx, by] = gridCell(b);
    return Math.hypot(ax - fx, ay - fy) - Math.hypot(bx - fx, by - fy) + (hash01(a, 3) - hash01(b, 3)) * 30;
  });
  const rank = new Array<number>(16).fill(0);
  others.forEach((c, k) => (rank[c] = k));
  return rank;
});

interface BoxState {
  cx: number;
  cy: number;
  w: number; // box width (height = w · 4/7)
  alpha: number;
  /** 0 = gas positions (big box only), 1 = canonical */
  canon: number;
  /** 0 = box, 1 = compressed into its barcode */
  bar: number;
}

function boxState(c: number, f: number): BoxState | null {
  const [gx, gy] = gridCell(c);
  const [kx, ky] = colCell(c);
  if (f < T.deal) return null;
  // the original (frozen) box shrinks into its cell
  let cx: number, cy: number, w: number;
  let alpha = 1;
  let canon = 1;
  if (c === FREEZE_CODE) {
    const k = ease.inOutCubic(seg(f, T.deal, T.deal + 14));
    cx = lerp(540, gx, k);
    cy = lerp(900, gy, k);
    w = lerp(700, GRID16.w, k);
    canon = ease.inOutQuad(seg(f, T.deal + 2, T.deal + 14));
  } else {
    const s = T.deal + 6 + PEEL[c] * 1.3;
    if (f < s) return null;
    const k = ease.outCubic(seg(f, s, s + 13));
    const [ox, oy] = gridCell(FREEZE_CODE);
    cx = lerp(ox, gx, k);
    cy = lerp(oy, gy, k);
    w = GRID16.w * lerp(0.92, 1, k);
    alpha = seg(f, s, s + 3);
  }
  // FLIP into the columns
  const s2 = T.sort + c * 1.1;
  const k2 = ease.inOutCubic(seg(f, s2, s2 + 16));
  if (k2 > 0) {
    // bowed path (all bows turn the same way)
    const mx = (cx + kx) / 2 + (ky - cy) * 0.12;
    const my = (cy + ky) / 2 - (kx - cx) * 0.12;
    const u = 1 - k2;
    cx = u * u * cx + 2 * u * k2 * mx + k2 * k2 * kx;
    cy = u * u * cy + 2 * u * k2 * my + k2 * k2 * ky;
    w = lerp(w, COL_W, k2);
  }
  const bar = ease.inOutCubic(seg(f, T.toBars + (4 - popcount(c)) * 1.5, T.toBars + 10 + (4 - popcount(c)) * 1.5));
  alpha *= 1 - seg(f, T.rain - 2, T.rain + 8);
  if (alpha <= 0.003) return null;
  return { cx, cy, w, alpha, canon, bar };
}

/** a mini world: box + dashed border + 4 dots + its 4-bit barcode */
export function drawMiniBox(ctx: Ctx, c: number, cx: number, cy: number, w: number, alpha: number, opt: { canon?: number; gasF?: number; bar?: number; white?: number; dotScale?: number } = {}) {
  const { canon = 1, bar = 0, white = 0 } = opt;
  const h0 = (w * 4) / 7;
  const h = lerp(h0, Math.max(10, w * 0.075), bar);
  const s = w / 700;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  const boxA = alpha * (1 - bar);
  // fill (very faint) so overlapping copies read as solid objects
  ctx.fillStyle = rgbaHex('#140D05', 0.85 * alpha);
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = w > 400 ? 2 : 1.5;
  ctx.strokeStyle = white > 0 ? `rgba(255,255,255,${(alpha * (0.6 + 0.4 * white)).toFixed(3)})` : rgbaHex(C.amber, 0.85 * alpha);
  ctx.strokeRect(x, y, w, h);
  if (boxA > 0.01) {
    ctx.setLineDash([Math.max(2, 6 * s * 3.5), Math.max(2, 8 * s * 3.5)]);
    ctx.strokeStyle = rgbaHex(C.amber, 0.32 * boxA);
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx, y + h - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // dots
    for (let i = 0; i < 4; i++) {
      const left = ((c >> (3 - i)) & 1) === 1;
      const [px, py] = canonical(i, left);
      let dx = x + px * s;
      let dy = y + py * s;
      if (canon < 1 && opt.gasF !== undefined) {
        const [gx, gy] = gasPos(i, opt.gasF);
        // gas positions mapped into this (shrinking) box
        const bx = x + (gx - BOX.x0) * s;
        const by = y + (gy - BOX.y0) * s;
        dx = lerp(bx, dx, canon);
        dy = lerp(by, dy, canon);
      }
      drawDot(ctx, dx, dy, Math.max(2.6, P4_R * s * (opt.dotScale ?? 1.25)), boxA, white > 0);
    }
  }
  // barcode: under the box while it is a box; becomes the whole thing when compressed
  const bw = w * lerp(0.42, 1, bar);
  const bh = lerp(Math.max(5, w * 0.045), h, bar);
  const by = lerp(y + h + Math.max(6, w * 0.04), y, bar);
  barcode(ctx, cx - bw / 2, by, bw, bh, c, 4, white > 0 ? '#FFFFFF' : C.pale, alpha * lerp(0.85, 1, bar), 0.16);
  ctx.restore();
}

// ------------------------------------------------------------------ beat drawing
export function drawCount(ctx: Ctx, f: number) {
  if (f > T.rain + 18) return;
  // ── the big box + gas (until the deal)
  if (f < T.deal + 1) {
    const a = 1;
    drawBigBox(ctx, f, a);
    const gf = Math.min(f, T.freeze);
    const pos = [0, 1, 2, 3].map((i) => gasPos(i, gf));
    // motion trails
    if (f >= 5 && f < T.freeze + 2) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 6; j++) {
          const fa = gf - j * 0.7;
          const fb = gf - (j + 1) * 0.7;
          if (fb < 4) break;
          const [ax, ay] = gasPos(i, fa);
          const [bx, by] = gasPos(i, fb);
          if (Math.abs(ax - bx) > 60 || Math.abs(ay - by) > 60) continue;
          ctx.strokeStyle = rgbaHex(C.amber, 0.38 * (1 - j / 6));
          ctx.lineWidth = 8 * (1 - j / 7);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) drawDot(ctx, pos[i][0], pos[i][1], P4_R);
    drawLabels(ctx, pos, f, 1 - seg(f, T.deal - 4, T.deal));
  }
  drawLedger(ctx, f, (1 - seg(f, T.deal - 2, T.deal + 8)) * seg(f, 12, 20));
  drawTape(ctx, f, 1 - seg(f, T.deal - 2, T.deal + 8));
  // shutter: the freeze is a snapshot
  if (f >= T.shutter && f < T.shutter + 8) {
    const k = 1 - seg(f, T.shutter, T.shutter + 8);
    brackets(ctx, BOX.x0 - 24, BOX.y0 - 24, BOX.x1 - BOX.x0 + 48, BOX.y1 - BOX.y0 + 48, 40, C.white, k * 0.9, 2);
  }
  // ── the 16 worlds
  if (f >= T.deal) {
    // draw the copies first, the original on top while it shrinks
    const order = CODES.filter((c) => c !== FREEZE_CODE).concat([FREEZE_CODE]);
    for (const c of order) {
      const st = boxState(c, f);
      if (!st) continue;
      const white = c === 15 ? ease.outCubic(seg(f, T.c3a + 8, T.c3a + 16)) * (1 - seg(f, T.c3End - 10, T.c3End)) : 0;
      drawMiniBox(ctx, c, st.cx, st.cy, st.w, st.alpha, { canon: st.canon, gasF: T.freeze, bar: st.bar, white });
    }
    drawColumnsChrome(ctx, f);
  }
}

/** axis, column counts 1 4 6 4 1, macro labels n:4−n, highlight brackets for card 3 */
function drawColumnsChrome(ctx: Ctx, f: number) {
  const a = seg(f, T.sort + 10, T.sort + 24) * (1 - seg(f, T.rain + 2, T.rain + 14));
  if (a <= 0.003) return;
  ctx.save();
  // baseline
  ctx.strokeStyle = rgbaHex(C.amber, 0.6 * a);
  ctx.lineWidth = 1.5;
  const k = ease.inOutCubic(seg(f, T.sort + 8, T.sort + 26));
  ctx.beginPath();
  ctx.moveTo(540 - 470 * k, AX.base + 4);
  ctx.lineTo(540 + 470 * k, AX.base + 4);
  ctx.stroke();
  const cnt = [1, 4, 6, 4, 1];
  for (let kk = 0; kk <= 4; kk++) {
    const x = axX(kk / 4);
    ctx.beginPath();
    ctx.moveTo(x, AX.base + 4);
    ctx.lineTo(x, AX.base + 14);
    ctx.stroke();
    // macro label  左:右
    const la = a * seg(f, T.sort + 18 + kk, T.sort + 24 + kk);
    ctx.font = MONO(22, 400);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = rgbaHex(C.amber, 0.8 * la);
    ctx.fillText(`${kk}:${4 - kk}`, x, AX.base + 44);
    // counts on top of the columns
    const n = cnt[kk];
    const ca = a * seg(f, T.sort + 24 + (4 - kk) * 2, T.sort + 27 + (4 - kk) * 2);
    if (ca > 0) {
      const top = AX.base - n * COL_PITCH;
      ctx.font = MONO(40, 700);
      ctx.fillStyle = kk === 4 && f >= T.c3a + 8 ? `rgba(255,255,255,${ca.toFixed(3)})` : rgbaHex(C.pale, ca);
      ctx.fillText(String(n), x, top - 16);
    }
  }
  ctx.font = SANS(22, 400);
  ctx.textAlign = 'center';
  ctx.fillStyle = rgbaHex(C.amber, 0.55 * a * seg(f, T.sort + 24, T.sort + 32));
  ctx.fillText('左 : 右', 540, AX.base + 82);
  // card 3 highlights: the all-left world (1/16) and the 2:2 column (6/16)
  const h1 = ease.outCubic(seg(f, T.c3a + 8, T.c3a + 18)) * (1 - seg(f, T.c3End - 10, T.c3End));
  if (h1 > 0) {
    const [x, y] = colCell(15);
    const w = COL_W + 26;
    const h = (COL_W * 4) / 7 + 40;
    brackets(ctx, x - w / 2, y - h / 2 + 4, w, h, 16, C.white, h1 * 0.9, 1.5);
    ctx.font = MONO(22, 400);
    ctx.textAlign = 'left';
    ctx.fillStyle = `rgba(255,255,255,${(0.85 * h1).toFixed(3)})`;
    ctx.fillText('1/16', x - w / 2, y - h / 2 - 8);
  }
  const h2 = ease.outCubic(seg(f, T.c3b + 8, T.c3b + 18)) * (1 - seg(f, T.c3End - 10, T.c3End));
  if (h2 > 0) {
    const x = axX(0.5);
    const top = AX.base - 6 * COL_PITCH - 4;
    brackets(ctx, x - COL_W / 2 - 14, top, COL_W + 28, AX.base - top + 2, 18, C.pale, h2, 1.5);
    ctx.font = MONO(22, 400);
    ctx.textAlign = 'left';
    ctx.fillStyle = rgbaHex(C.pale, 0.9 * h2);
    ctx.fillText('6/16', x + COL_W / 2 + 22, top + 20);
  }
  ctx.restore();
}

export function glowCount(ctx: Ctx, f: number) {
  if (f > T.rain + 18) return;
  if (f < T.deal + 1) {
    const gf = Math.min(f, T.freeze);
    for (let i = 0; i < 4; i++) {
      const [x, y] = gasPos(i, gf);
      glow(ctx, C.amber, x, y, 34, 0.55);
    }
    const pulse = f < 1 ? 0 : Math.exp(-(f - 1) / 3.2);
    if (pulse > 0.02) {
      ctx.save();
      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = C.pale;
      ctx.lineWidth = 8;
      ctx.strokeRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
      ctx.restore();
    }
  }
  // the 2:2 column glows during card 3 line 2
  const h2 = ease.outCubic(seg(f, T.c3b + 8, T.c3b + 18)) * (1 - seg(f, T.c3End - 10, T.c3End));
  if (h2 > 0) {
    for (let s = 0; s < 6; s++) {
      const x = axX(0.5);
      const y = AX.base - COL_PITCH / 2 - s * COL_PITCH;
      glow(ctx, C.amber, x, y, 110, 0.32 * h2 * (0.8 + 0.2 * Math.sin(f * 0.3 + s)));
    }
  }
  const h1 = ease.outCubic(seg(f, T.c3a + 8, T.c3a + 18)) * (1 - seg(f, T.c3End - 10, T.c3End));
  if (h1 > 0) {
    const [x, y] = colCell(15);
    glow(ctx, '#FFFFFF', x, y, 110, 0.35 * h1);
  }
}

export const clampA = clamp;

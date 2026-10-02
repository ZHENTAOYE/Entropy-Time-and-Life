// The number ladder, rung 5: a monumental mono year odometer whose EXPONENT rolls — every tick is ×10 in time.
//   ~10¹⁰ 年 (now) → ~10¹⁴ 年 · 最后的恒星熄灭 → (whirr) → ~10¹⁰⁰ 年 · 最大的黑洞蒸发殆尽
// Card 3's numerals lose contrast while displayed, then random-walk into the heat death with the image (σ ∝ eq²).
import { clamp, ease, seg } from '../../lib/math';
import { F } from './fonts';
import { buildMask, drawScattered } from './scatter';
import { Cap, GREY, RGB, VOICE, drawCap, drawCapMask, lerpRGB } from './text';
import { T, eqAt } from './timing';
import { rgbStr } from './gfx';

const NUM = 124;
const EXP = 64;
const NY = 1098; // numeral baseline
const EY = NY - NUM * 0.5; // exponent baseline
const DOT_Y = 1134;
const LABEL_Y = 1172;
const PITCH = 1.08;

/** the exponent (years = 10^value) as a continuous odometer value */
export function expoAt(f: number): number {
  if (f < T.roll1[0]) return 10;
  if (f < T.roll1[1]) return 10 + 4 * ease.inOutSine(seg(f, T.roll1[0], T.roll1[1]));
  if (f < T.roll2[0]) return 14;
  return 14 + 86 * ease.inOutCubic(seg(f, T.roll2[0], T.roll2[1]));
}

/** frames at which the exponent crosses each integer (sound ticks) */
export function expoTicks(): Array<{ f: number; n: number }> {
  const out: Array<{ f: number; n: number }> = [];
  let last = Math.floor(expoAt(0) + 1e-9);
  for (let f = 1; f < 200; f += 0.25) {
    const n = Math.floor(expoAt(f) + 1e-9);
    if (n !== last) {
      out.push({ f: Math.round(f), n });
      last = n;
    }
  }
  return out;
}

export const LABEL1: Cap = {
  lines: ['最后的恒星熄灭'],
  from: T.label1.at,
  dur: T.label1.out + 16 - T.label1.at,
  font: F.label,
  size: 44,
  y: LABEL_Y,
  letterSpacing: 0.16,
  stagger: 1.5,
  enterLen: 15,
  exitLen: 16,
  color: () => [236, 232, 224],
};
export const LABEL2: Cap = {
  lines: ['最大的黑洞蒸发殆尽'],
  from: T.label2.at,
  dur: 9999,
  font: F.label,
  size: 44,
  y: LABEL_Y,
  letterSpacing: 0.16,
  stagger: 1.5,
  enterLen: 15,
  exit: 'none',
  color: () => [236, 232, 224],
};

interface Geo {
  x0: number;
  wT: number;
  wDigit: number;
  wYear: number;
}
function geo(ctx: CanvasRenderingContext2D, hundreds: number): Geo {
  ctx.font = F.numeral;
  const wT = ctx.measureText('~10').width;
  ctx.font = F.expo;
  const wDigit = ctx.measureText('0').width;
  ctx.font = F.year;
  const wYear = ctx.measureText('年').width;
  const total = wT + 8 + wDigit * (2 + hundreds) + 26 + wYear;
  return { x0: 540 - total / 2, wT, wDigit, wYear };
}

/** one rolling digit column: digit d moving up by r (0..1) with the next one entering from below */
function digitColumn(ctx: CanvasRenderingContext2D, x: number, w: number, d: number, r: number, speed: number, alpha: number) {
  if (alpha <= 0.003) return;
  const P = EXP * PITCH;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, EY - EXP * 0.95, w + 8, EXP * 1.25);
  ctx.clip();
  ctx.textAlign = 'center';
  // motion blur when it spins fast: a soft vertical smear (three offset copies, blurred)
  const fast = speed > 0.25;
  const span = Math.min(P * 0.7, speed * P * 0.5);
  const nb = fast ? 3 : 1;
  if (fast) ctx.filter = `blur(${Math.min(5, 1 + speed * 1.5).toFixed(1)}px)`;
  for (let k = 0; k < nb; k++) {
    const off = nb === 1 ? 0 : (k / (nb - 1) - 0.5) * span;
    ctx.globalAlpha = clamp(alpha * (fast ? 0.55 : 1));
    ctx.fillText(String(d), x + w / 2, EY - r * P + off);
    ctx.fillText(String((d + 1) % 10), x + w / 2, EY + (1 - r) * P + off);
  }
  ctx.filter = 'none';
  ctx.restore();
}

function lockupColor(f: number): RGB {
  // card 3: the numerals lose contrast while they are displayed
  const k = 0.42 * ease.inOutSine(seg(f, T.roll2[1], T.lockDie[0] + 10));
  return lerpRGB(VOICE, [118, 108, 120], k);
}

function drawNumeral(ctx: CanvasRenderingContext2D, f: number, col: RGB, alpha: number, blur: number, scale: number) {
  const v = expoAt(f);
  const dv = Math.abs(expoAt(f + 0.5) - expoAt(f - 0.5));
  const hund = clamp(v - 99);
  const g = geo(ctx, hund);
  ctx.save();
  ctx.translate(540, NY - NUM * 0.3);
  ctx.scale(scale, scale);
  ctx.translate(-540, -(NY - NUM * 0.3));
  if (blur > 0.2) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.fillStyle = rgbStr(col);
  ctx.globalAlpha = clamp(alpha);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = F.numeral;
  ctx.fillText('~10', g.x0, NY);
  ctx.font = F.expo;
  let x = g.x0 + g.wT + 8;
  // a slow roll ticks (snaps between integers); the whirr just spins
  const tick = (u: number) => (dv < 0.3 ? ease.inOutCubic(clamp((u - 0.45) / 0.55)) : u);
  const places = [2, 1, 0];
  for (const p of places) {
    const P10 = Math.pow(10, p);
    const d = Math.floor(v / P10) % 10;
    const lower = v - Math.floor(v / P10) * P10;
    const r = p === 0 ? tick(v - Math.floor(v)) : tick(clamp(lower - (P10 - 1)));
    const w = g.wDigit * (p === 2 ? hund : 1);
    if (p === 2 && hund <= 0) continue;
    digitColumn(ctx, x, w, d, r, dv / P10, alpha * (p === 2 ? hund : 1));
    x += w;
  }
  ctx.font = F.year;
  ctx.fillText('年', x + 26, NY);
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, col: RGB, alpha: number) {
  ctx.save();
  ctx.font = F.label;
  ctx.textAlign = 'center';
  ctx.fillStyle = rgbStr(col);
  ctx.globalAlpha = clamp(alpha);
  ctx.fillText('·', 540, DOT_Y + 15);
  ctx.restore();
}

function backdrop(ctx: CanvasRenderingContext2D, a: number) {
  if (a < 0.01) return;
  ctx.save();
  ctx.translate(540, 1120);
  ctx.scale(430, 150);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(2,3,9,0.62)');
  g.addColorStop(0.55, 'rgba(2,3,9,0.36)');
  g.addColorStop(1, 'rgba(2,3,9,0)');
  ctx.globalAlpha = clamp(a);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

export function drawLockup(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.lockIn) return;
  const inK = ease.outCubic(seg(f, T.lockIn, T.lockIn + 16));
  const dying = f >= T.lockDie[0];
  const eq = eqAt(f);
  const dieK = seg(f, T.lockDie[0], T.lockDie[1] + 16);
  backdrop(ctx, inK * (1 - ease.inOutSine(seg(f, T.lockDie[0] - 6, T.lockDie[0] + 22))));
  if (!dying) {
    const col = lockupColor(f);
    drawNumeral(ctx, f, col, inK, (1 - inK) * 12, 1 + (1 - inK) * 0.12);
    drawDot(ctx, col, inK * 0.8);
    drawCap(ctx, LABEL1, f);
    drawCap(ctx, LABEL2, f);
    return;
  }
  // NOISE-DEATH with the image: same random walk law, contrast → the background
  const m = buildMask('lockup', 120, 960, 840, 260, (x) => {
    drawNumeral(x, T.roll2[1] + 2, [255, 255, 255], 1, 0, 1);
    drawDot(x, [255, 255, 255], 0.8);
    drawCapMask(x, LABEL2);
  });
  const sigma = 0.55 * 650 * eq * eq;
  const col = lerpRGB(lockupColor(f), lerpRGB([70, 64, 78], GREY, clamp(eq / 0.6)), ease.inOutSine(dieK));
  drawScattered(ctx, m, sigma, col, 1 - ease.inQuad(dieK), 9101, f);
}

// The number ladder, rung 5 — ONE monumental line, exactly the screenplay's string, read left to right:
//     ~10¹⁴ 年 · 最后的恒星熄灭      →(the exponent whirrs)→      ~10¹⁰⁰ 年 · 最大的黑洞蒸发殆尽
// A mono odometer whose EXPONENT rolls (every tick is ×10 in time), the unit, an interpunct, and the label (which
// CONDENSES / DIFFUSES like every line of the film). The line re-centres while the exponent whirrs to three digits.
// Card 3: the numerals lose contrast as they display, then the whole line random-walks into the heat death with the
// image (NOISE-DEATH, σ ∝ eq²).
import { clamp, ease, memo, seg } from '../../lib/math';
import { F } from './fonts';
import { buildMask, drawScattered } from './scatter';
import { Cap, GREY, RGB, VOICE, drawCap, drawCapMask, layoutCap, lerpRGB } from './text';
import { T, dieAt, eqAt } from './timing';
import { drawBlurred, haloSprite, rgbStr } from './gfx';

const N = 106; // "~10"
const EXP = 55; // exponent digits
const LBL = 38; // label / interpunct (a full-width ·: its advance already frames it)
const NY = 1100; // baseline of the whole line
const EY = NY - N * 0.5; // exponent baseline
const PITCH = 1.08;
const GAP_E = 5;
const GAP_Y = 15;
const GAP_D = 6;
const LABEL_LS = 0.12;
const LABEL_COL: RGB = [236, 232, 224];

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

// labels: drawn by drawCap at x = 0 (layout cache key stays fixed) and translated into place
export const LABEL1: Cap = {
  lines: ['最后的恒星熄灭'],
  from: T.label1.at,
  dur: T.label1.dur,
  font: F.label,
  size: LBL,
  x: 0,
  y: NY - LBL * 0.38,
  letterSpacing: LABEL_LS,
  stagger: 0.8,
  enterLen: 12,
  exitLen: 14,
  color: () => LABEL_COL,
};
export const LABEL2: Cap = {
  lines: ['最大的黑洞蒸发殆尽'],
  from: T.label2.at,
  dur: 9999,
  font: F.label,
  size: LBL,
  x: 0,
  y: NY - LBL * 0.38,
  letterSpacing: LABEL_LS,
  stagger: 0.8,
  enterLen: 12,
  exit: 'none',
  color: () => LABEL_COL,
};

interface Metrics {
  wT: number;
  wD: number;
  wY: number;
  wDot: number;
  wL1: number;
  wL2: number;
}
/** font metrics of the line (a pure function of the loaded fonts; only ever called once they are ready) */
const metrics = (ctx: CanvasRenderingContext2D): Metrics => memo('s05:lockmet', () => measure(ctx));
function measure(ctx: CanvasRenderingContext2D): Metrics {
  ctx.save();
  ctx.font = F.numeral;
  const wT = ctx.measureText('~10').width;
  ctx.font = F.expo;
  const wD = ctx.measureText('0').width;
  ctx.font = F.year;
  const wY = ctx.measureText('年').width;
  ctx.font = F.label;
  const wDot = ctx.measureText('·').width;
  ctx.restore();
  const wl = (c: Cap) => {
    const L = layoutCap(ctx, c);
    return L.right - L.left - LABEL_LS * LBL;
  };
  return { wT, wD, wY, wDot, wL1: wl(LABEL1), wL2: wl(LABEL2) };
}

interface Geo {
  x0: number; // left of "~10"
  xE: number; // left of the exponent
  hund: number; // 0..1 width of the hundreds column
  xY: number; // left of 年
  xDot: number; // centre of ·
  xLab: number; // left of the label
}
function lineWidth(m: Metrics, digits: number, wl: number) {
  return m.wT + GAP_E + m.wD * digits + GAP_Y + m.wY + GAP_D + m.wDot + GAP_D + wl;
}
function geoAt(ctx: CanvasRenderingContext2D, f: number): Geo {
  const m = metrics(ctx);
  const u = ease.inOutSine(seg(f, T.relayout[0], T.relayout[1]));
  const x0 = 540 - (lineWidth(m, 2, m.wL1) + u * (lineWidth(m, 3, m.wL2) - lineWidth(m, 2, m.wL1))) / 2;
  const hund = clamp(expoAt(f) - 99);
  const xE = x0 + m.wT + GAP_E;
  const xY = xE + m.wD * (2 + hund) + GAP_Y;
  const xDot = xY + m.wY + GAP_D + m.wDot / 2;
  return { x0, xE, hund, xY, xDot, xLab: xDot + m.wDot / 2 + GAP_D };
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
  // motion blur when it spins fast: a soft vertical smear (three offset copies, blurred on a scratch)
  const fast = speed > 0.25;
  const span = Math.min(P * 0.7, speed * P * 0.5);
  const nb = fast ? 3 : 1;
  ctx.globalAlpha = clamp(alpha * (fast ? 0.55 : 1));
  drawBlurred(ctx, x - 4, EY - EXP * 0.95 - P, w + 8, EXP * 1.25 + 2 * P, fast ? Math.min(5, 1 + speed * 1.5) : 0, (s) => {
    for (let k = 0; k < nb; k++) {
      const off = nb === 1 ? 0 : (k / (nb - 1) - 0.5) * span;
      s.fillText(String(d), x + w / 2, EY - r * P + off);
      s.fillText(String((d + 1) % 10), x + w / 2, EY + (1 - r) * P + off);
    }
  });
  ctx.restore();
}

/** "~10ⁿ 年" at frame f (geometry g), in the current fillStyle */
function drawNumber(ctx: CanvasRenderingContext2D, f: number, g: Geo, alpha: number) {
  const m = metrics(ctx);
  const v = expoAt(f);
  const dv = Math.abs(expoAt(f + 0.5) - expoAt(f - 0.5));
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = F.numeral;
  ctx.fillText('~10', g.x0, NY);
  ctx.font = F.expo;
  let x = g.xE;
  // a slow roll ticks (snaps between integers); the whirr just spins
  const tick = (u: number) => (dv < 0.3 ? ease.inOutCubic(clamp((u - 0.45) / 0.55)) : u);
  for (const p of [2, 1, 0]) {
    if (p === 2 && g.hund <= 0) continue;
    const P10 = Math.pow(10, p);
    const d = Math.floor(v / P10) % 10;
    const lower = v - Math.floor(v / P10) * P10;
    const r = p === 0 ? tick(v - Math.floor(v)) : tick(clamp(lower - (P10 - 1)));
    const w = m.wD * (p === 2 ? g.hund : 1);
    digitColumn(ctx, x, w, d, r, dv / P10, alpha * (p === 2 ? g.hund : 1));
    x += w;
  }
  ctx.globalAlpha = clamp(alpha);
  ctx.textAlign = 'left';
  ctx.font = F.year;
  ctx.fillText('年', g.xY, NY);
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, g: Geo, alpha: number) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  ctx.font = F.label;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('·', g.xDot, NY);
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, c: Cap, f: number, xLeft: number, w: number) {
  ctx.save();
  ctx.translate(xLeft + w / 2, 0);
  drawCap(ctx, c, f);
  ctx.restore();
}

function backdrop(ctx: CanvasRenderingContext2D, a: number) {
  if (a < 0.01) return;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(haloSprite(), 540 - 500, NY - 34 - 140, 1000, 280);
  ctx.restore();
}

/** card 3: the numerals lose contrast while they are displayed (the label stays readable) */
function numColor(f: number): RGB {
  return lerpRGB(VOICE, [128, 122, 132], 0.55 * ease.inOutSine(seg(f, T.roll2[1] + 4, T.lockDie[0])));
}

export function drawLockup(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.lockIn) return;
  const m = metrics(ctx);
  const inK = ease.outCubic(seg(f, T.lockIn, T.lockIn + 14));
  const dying = f >= T.lockDie[0];
  // the dark halo only while the web is bright behind the line; it would read as a dark band once the image greys out
  backdrop(ctx, inK * (1 - 0.35 * dieAt(f)) * (1 - ease.inOutSine(seg(eqAt(f), 0.02, 0.2))) * (1 - ease.inOutSine(seg(f, T.lockDie[0] - 8, T.lockDie[0] + 20))));
  if (!dying) {
    const g = geoAt(ctx, f);
    const col = numColor(f);
    // the number condenses in: blur 10 → 0, scale 1.08 → 1 (one scratch blur for the whole group)
    ctx.save();
    ctx.fillStyle = rgbStr(col);
    const cx = (g.x0 + g.xY + m.wY) / 2;
    const sc = 1 + (1 - inK) * 0.08;
    ctx.translate(cx, NY - N * 0.3);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -(NY - N * 0.3));
    drawBlurred(ctx, g.x0 - 6, NY - N * 1.0, g.xY + m.wY - g.x0 + 12, N * 1.25, (1 - inK) * 10, (s) => drawNumber(s, f, g, inK));
    ctx.restore();
    // the interpunct arrives with the first label and stays through card 3
    ctx.save();
    ctx.fillStyle = rgbStr(LABEL_COL);
    drawDot(ctx, g, 0.85 * ease.outCubic(seg(f, T.label1.at, T.label1.at + 10)));
    ctx.restore();
    drawLabel(ctx, LABEL1, f, g.xLab, m.wL1);
    drawLabel(ctx, LABEL2, f, g.xLab, m.wL2);
    return;
  }
  // NOISE-DEATH with the image: same random-walk law, contrast → the background
  const m2 = metrics(ctx);
  const gEnd = geoAt(ctx, T.lockDie[0]);
  const mask = buildMask('lockup', 60, NY - 150, 960, 220, (x) => {
    drawNumber(x, T.lockDie[0], gEnd, 1);
    drawDot(x, gEnd, 0.85);
    x.save();
    x.translate(gEnd.xLab + m2.wL2 / 2, 0);
    drawCapMask(x, LABEL2);
    x.restore();
  });
  const eq = eqAt(f);
  const dieK = seg(f, T.lockDie[0], T.lockDie[1]);
  const sigma = 0.55 * 650 * eq * eq;
  const col = lerpRGB(lerpRGB(numColor(f), LABEL_COL, 0.4), lerpRGB([70, 64, 78], GREY, clamp(eq / 0.6)), ease.inOutSine(dieK));
  drawScattered(ctx, mask, Math.max(0.5, sigma), col, 1 - ease.inQuad(dieK), 9101, f);
}

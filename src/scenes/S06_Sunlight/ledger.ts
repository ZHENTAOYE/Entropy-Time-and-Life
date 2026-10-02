// The double-entry ledger written in light, drawn into the scene canvas: 收 (IN, gold) | 还 (OUT, red).
//   B1  能量 row: flow bars + 240 ≈ 240 W/m² (odometers)
//   B2  split-flap flip 能量 → 光子 (its own text-free beat, 90×110 tiles); readings roll back to 0
//   B3  光子 row: 1 → 20 (counters locked to the unzip)
//   B4  熵 row flips in (1 | ≈20) AND the energy row is typed back at the top (1 = 1, in units of one sunlight photon):
//       the final balance shows the whole argument in one image — 能量 1 = 1 / 光子 1 → 20 / 熵 1 ≈20, with the
//       accountant's double underline under 熵.
import { FONT } from '../../lib/fonts';
import { clamp, ease, seg } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { P } from './palette';
import { T, unzipAt } from './timing';

export const COL_IN = 330;
export const COL_OUT = 750;
const SPINE = 540;
const HEAD_Y = 314;
const RULE_Y = 372;
const E_Y = 414;
const TILE_A_Y = 506;
export const ROW_A = 610;
const SEP_Y = 676;
const TILE_B_Y = 736;
export const ROW_B = 832;
const DBL_Y = 892;
const HALF = 420;
/** bottom of the ledger block (photons dim above this) */
export const LEDGER_BOTTOM = 905;

const FLAP_NOISE = '光能熵子量多少';
const RED_TXT = '#FF4A3A';

export const LEDGER_FONTS: Array<[string, string]> = [
  [`900 76px ${FONT.serif}`, '收还'],
  [`600 64px ${FONT.serif}`, '能量光子熵' + FLAP_NOISE],
  [`600 120px ${FONT.latin}`, '0123456789≈→='],
  [`400 20px ${FONT.mono}`, 'INOUTENERGYPHOTONSENTROPYW/m²▍·'],
];

export const ledgerOn = (f: number) => f >= T.ledgerIn - 2 && f <= T.ledgerOut + 28;

let XB = 0; // extra blur applied to every element (whole-ledger dissolve)
const filt = (b: number) => {
  const t = b + XB;
  return t > 0.2 ? `blur(${t.toFixed(1)}px)` : 'none';
};

// optical vertical centre of a glyph for the current font
const vc = (ctx: CanvasRenderingContext2D, ch: string) => {
  const m = ctx.measureText(ch);
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
};

// ---------------------------------------------------------------- split-flap tile
function tileHalf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ch: string, top: boolean, sy: number, bright: number, size: number, color: string) {
  if (Math.abs(sy) < 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  ctx.beginPath();
  ctx.rect(-w / 2, top ? -h / 2 : 0, w, h / 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, 'rgba(22,24,38,0.94)');
  g.addColorStop(1, 'rgba(9,10,19,0.94)');
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.font = `600 ${size}px ${FONT.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (ch.trim()) ctx.fillText(ch, 0, vc(ctx, ch));
  if (bright < 0.999) {
    ctx.fillStyle = `rgba(0,0,0,${(1 - bright).toFixed(3)})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function flap(ctx: CanvasRenderingContext2D, frame: number, o: { x: number; y: number; from: string; to: string; at: number; w?: number; h?: number; size?: number; color?: string; opacity?: number; seed?: number }) {
  const { x, y, from, to, at, w = 90, h = 110, size = 64, color = P.voice, opacity = 1, seed = 0 } = o;
  if (opacity <= 0.01) return;
  const seq = [from, FLAP_NOISE[Math.floor(hash01(seed, 3) * FLAP_NOISE.length)], FLAP_NOISE[Math.floor(hash01(seed, 4) * FLAP_NOISE.length)], to];
  const per = 3;
  const t = frame - at;
  const k = clamp(Math.floor(t / per), 0, seq.length - 1);
  const ph = t < 0 || k >= seq.length - 1 ? 1 : (t % per) / per;
  const cur = seq[k];
  const nxt = seq[Math.min(seq.length - 1, k + 1)];
  const flipping = t >= 0 && k < seq.length - 1;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.filter = filt(0);
  // static halves: top = next char while flipping, bottom = current char
  tileHalf(ctx, x, y, w, h, flipping ? nxt : cur, true, 1, 1, size, color);
  tileHalf(ctx, x, y, w, h, cur, false, 1, 1, size, color);
  if (flipping && ph < 0.5) {
    const a1 = ph * 2; // top half of the current char folds down towards us
    tileHalf(ctx, x, y, w, h, cur, true, Math.cos((a1 * Math.PI) / 2), 1 - 0.5 * a1, size, color);
  }
  if (flipping && ph >= 0.5) {
    const a2 = ph * 2 - 1; // bottom half of the next char lands
    tileHalf(ctx, x, y, w, h, nxt, false, Math.cos(((1 - a2) * Math.PI) / 2), 0.5 + 0.5 * a2, size, color);
  }
  // hinge + frame
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(x - w / 2, y - 0.5, w, 1.2);
  ctx.strokeStyle = 'rgba(243,239,230,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
  ctx.restore();
}

// ---------------------------------------------------------------- rolling numeral (odometer)
function roll(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, size: number, color: string, o: { glow?: number; align?: 'center' | 'left' | 'right'; prefix?: string; opacity?: number } = {}) {
  const { glow = 0.4, align = 'center', prefix = '', opacity = 1 } = o;
  if (opacity <= 0.01) return;
  const v = Math.max(0, value);
  const n = Math.max(1, Math.floor(Math.log10(Math.max(1, Math.floor(v + 1e-6)))) + 1);
  const cw = size * 0.56;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.font = `600 ${size}px ${FONT.latin}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const pw = prefix ? size * 0.62 * 0.62 + 6 : 0;
  const W = n * cw + pw;
  const x0 = align === 'center' ? x - W / 2 : align === 'left' ? x : x - W;
  const off = vc(ctx, '0');
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(22, size * 0.18 * glow);
  if (prefix) {
    ctx.save();
    ctx.font = `600 ${size * 0.62}px ${FONT.latin}`;
    ctx.filter = filt(0);
    ctx.fillText(prefix, x0 + pw / 2 - 3, y + off - size * 0.02);
    ctx.restore();
  }
  const lh = size * 1.05;
  for (let i = n - 1; i >= 0; i--) {
    const p = Math.pow(10, i);
    const d = Math.floor(v / p) % 10;
    const lower = v % p;
    const rr = i === 0 ? v % 1 : clamp(lower - (p - 1));
    const r = ease.inOutQuad(rr);
    const blur = Math.sin(r * Math.PI) * size * 0.05;
    const cx = x0 + pw + (n - 1 - i) * cw + cw / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - cw, y - lh / 2, cw * 2, lh);
    ctx.clip();
    ctx.filter = filt(blur);
    ctx.fillText(String(d), cx, y + off - r * lh);
    if (r > 0.001) ctx.fillText(String((d + 1) % 10), cx, y + off - r * lh + lh);
    ctx.restore();
  }
  ctx.restore();
}

/** a static glyph/word with a soft glow */
function word(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, o: { opacity?: number; glow?: number; align?: CanvasTextAlign; blur?: number; scale?: number } = {}) {
  const { opacity = 1, glow = 0, align = 'center', blur = 0, scale = 1 } = o;
  if (opacity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.filter = filt(blur);
  const off = vc(ctx, s);
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.fillText(s, 0, off);
  ctx.restore();
}

/** small mono label with type-on */
function mono(ctx: CanvasRenderingContext2D, frame: number, text: string, x: number, y: number, at: number, o: { color?: string; size?: number; align?: CanvasTextAlign; opacity?: number; spacing?: number } = {}) {
  const { color = 'rgba(243,239,230,0.6)', size = 20, align = 'left', opacity = 1, spacing = 0.28 } = o;
  const n = Math.floor(clamp((frame - at) / 1.2, 0, text.length));
  if (n <= 0 || opacity <= 0.01) return;
  const cursor = n < text.length ? '▍' : '';
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.font = `400 ${size}px ${FONT.mono}`;
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${(spacing * size).toFixed(1)}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.filter = filt(0);
  ctx.fillText(text.slice(0, n) + cursor, x, y);
  ctx.restore();
}

/** column head glyph that condenses out of blur */
function head(ctx: CanvasRenderingContext2D, frame: number, ch: string, x: number, y: number, at: number, color: string) {
  const p = ease.outCubic(seg(frame, at, at + 18));
  if (p <= 0) return;
  word(ctx, ch, x, y, `900 76px ${FONT.serif}`, color, { opacity: p, glow: 16, blur: (1 - p) * 12, scale: 1 + (1 - p) * 0.3 });
}

function hline(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string, w = 1) {
  if (x1 - x0 < 0.5) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

export function drawLedger(ctx: CanvasRenderingContext2D, frame: number) {
  if (!ledgerOn(frame)) return;
  const vis = 1 - ease.inQuad(seg(frame, T.ledgerOut, T.ledgerOut + 26));
  if (vis <= 0.001) return;
  const outQ = seg(frame, T.ledgerOut, T.ledgerOut + 26);
  XB = outQ * 8;
  ctx.save();
  ctx.globalAlpha = vis;
  ctx.translate(0, -outQ * 30);

  // ---- hairlines
  const rule = ease.inOutCubic(seg(frame, T.ledgerIn + 4, T.ledgerIn + 26));
  const spine = ease.inOutCubic(seg(frame, T.ledgerIn + 8, T.ledgerIn + 36));
  const ruleB = ease.inOutCubic(seg(frame, T.entropyRow - 4, T.entropyRow + 14));
  const dbl = ease.inOutCubic(seg(frame, T.entropyRow + 26, T.entropyRow + 46));
  ctx.filter = filt(0);
  hline(ctx, SPINE - HALF * rule, SPINE + HALF * rule, RULE_Y, 'rgba(243,239,230,0.3)');
  ctx.strokeStyle = 'rgba(243,239,230,0.13)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SPINE - 4, 290);
  ctx.lineTo(SPINE - 4, 290 + 615 * spine);
  ctx.moveTo(SPINE + 4, 290);
  ctx.lineTo(SPINE + 4, 290 + 615 * spine);
  ctx.stroke();
  hline(ctx, SPINE - HALF * ruleB, SPINE + HALF * ruleB, SEP_Y, 'rgba(243,239,230,0.2)');
  hline(ctx, SPINE - HALF * dbl, SPINE + HALF * dbl, DBL_Y, 'rgba(243,239,230,0.62)', 1.3);
  hline(ctx, SPINE - HALF * dbl, SPINE + HALF * dbl, DBL_Y + 7, 'rgba(243,239,230,0.62)', 1.3);

  // ---- column heads
  head(ctx, frame, '收', COL_IN, HEAD_Y, T.ledgerIn, P.gold);
  head(ctx, frame, '还', COL_OUT, HEAD_Y, T.ledgerIn + 6, P.ir);
  mono(ctx, frame, 'IN', COL_IN + 52, HEAD_Y + 18, T.ledgerIn + 14, { color: 'rgba(255,201,74,0.75)' });
  mono(ctx, frame, 'OUT', COL_OUT + 52, HEAD_Y + 18, T.ledgerIn + 18, { color: 'rgba(255,90,70,0.8)' });

  // ---- energy line, B1: flow bars (light flowing in, gold, towards the spine; out, red, away from it)
  const barsIn = ease.outCubic(seg(frame, T.barsIn, T.barsIn + 22));
  const barsOut = ease.inCubic(seg(frame, T.flipAt, T.flipAt + 14));
  const barLen = 300 * barsIn * (1 - barsOut);
  if (barLen > 1) {
    const gi = ctx.createLinearGradient(COL_IN + 150 - barLen, 0, COL_IN + 150, 0);
    gi.addColorStop(0, 'rgba(255,201,74,0.12)');
    gi.addColorStop(1, 'rgba(255,201,74,1)');
    ctx.fillStyle = gi;
    ctx.fillRect(COL_IN + 150 - barLen, E_Y - 3, barLen, 6);
    const go = ctx.createLinearGradient(COL_OUT - 150, 0, COL_OUT - 150 + barLen, 0);
    go.addColorStop(0, 'rgba(255,59,47,1)');
    go.addColorStop(1, 'rgba(255,59,47,0.12)');
    ctx.fillStyle = go;
    ctx.fillRect(COL_OUT - 150, E_Y - 3, barLen, 6);
    ctx.setLineDash([10, 22]);
    ctx.lineDashOffset = -frame * 6;
    hline(ctx, COL_IN + 150 - barLen, COL_IN + 150, E_Y, 'rgba(255,244,214,0.9)', 2);
    hline(ctx, COL_OUT - 150, COL_OUT - 150 + barLen, E_Y, 'rgba(255,208,192,0.8)', 2);
    ctx.setLineDash([]);
  }

  // ---- category flap A: 能量 → 光子 (two tiles straddling the spine; the photon falls through the gap)
  const tA = seg(frame, T.ledgerIn + 10, T.ledgerIn + 22);
  flap(ctx, frame, { x: SPINE - 52, y: TILE_A_Y, from: '能', to: '光', at: T.flipAt, seed: 1, opacity: tA });
  flap(ctx, frame, { x: SPINE + 52, y: TILE_A_Y, from: '量', to: '子', at: T.flipAt + 4, seed: 2, opacity: seg(frame, T.ledgerIn + 12, T.ledgerIn + 24) });
  mono(ctx, frame, 'ENERGY', SPINE + 112, TILE_A_Y + 40, T.ledgerIn + 20, { size: 16, opacity: 1 - seg(frame, T.flipAt, T.flipAt + 4) });
  mono(ctx, frame, 'PHOTONS', SPINE + 112, TILE_A_Y + 40, T.flipAt + 10, { size: 16 });

  // ---- B1 energy amounts (W/m²) with ≈ at the spine
  const energyVal = 240 * ease.outCubic(seg(frame, T.barsIn, T.barsIn + 30)) * (1 - ease.inOutCubic(seg(frame, T.flipAt, T.flipAt + 14)));
  const energyA = seg(frame, T.barsIn, T.barsIn + 8) * (1 - seg(frame, T.flipAt + 10, T.flipAt + 18));
  if (energyA > 0.01) {
    roll(ctx, energyVal, COL_IN, ROW_A, 88, P.gold, { opacity: energyA });
    roll(ctx, energyVal, COL_OUT, ROW_A, 88, RED_TXT, { opacity: energyA });
    mono(ctx, frame, 'W/m²', COL_IN, ROW_A + 62, T.barsIn + 4, { size: 19, align: 'center', color: 'rgba(255,201,74,0.72)', opacity: energyA, spacing: 0.2 });
    mono(ctx, frame, 'W/m²', COL_OUT, ROW_A + 62, T.barsIn + 4, { size: 19, align: 'center', color: 'rgba(255,90,70,0.78)', opacity: energyA, spacing: 0.2 });
  }
  const approxA = Math.min(seg(frame, T.barsIn + 22, T.barsIn + 32), 1 - seg(frame, T.flipAt, T.flipAt + 10));
  if (approxA > 0.01) word(ctx, '≈', SPINE, ROW_A, `600 100px ${FONT.latin}`, P.voice, { opacity: approxA, glow: 18, scale: 0.8 + 0.2 * ease.outBack(clamp(approxA)) });

  // ---- photon counters
  const cntA = seg(frame, T.flipAt + 14, T.flipAt + 22);
  if (cntA > 0.01) {
    const inVal = clamp((frame - T.photonLand) / 4);
    let outVal = 0;
    for (let i = 0; i < 20; i++) outVal += clamp((frame - unzipAt(i) - 3) / 3);
    roll(ctx, inVal, COL_IN, ROW_A, 120, P.gold, { glow: 0.5 + inVal * 0.5, opacity: cntA });
    roll(ctx, outVal, COL_OUT, ROW_A, 120, RED_TXT, { glow: 0.4 + outVal / 30, opacity: cntA });
    const arrowA = seg(frame, unzipAt(19), unzipAt(19) + 10);
    if (arrowA > 0.01) word(ctx, '→', SPINE + (1 - arrowA) * -20, ROW_A + 4, `600 66px ${FONT.latin}`, 'rgba(243,239,230,0.88)', { opacity: arrowA });
  }

  // ---- B4: the energy row is typed back at the top — 1 = 1 (energy of one sunlight photon in = energy out)
  const eb = seg(frame, T.energyBack, T.energyBack + 8);
  if (eb > 0.01) {
    roll(ctx, 1, COL_IN, E_Y, 60, P.gold, { opacity: eb, glow: 0.35 });
    roll(ctx, 1, COL_OUT, E_Y, 60, RED_TXT, { opacity: seg(frame, T.energyBack + 4, T.energyBack + 12), glow: 0.35 });
    const eq = seg(frame, T.energyBack + 8, T.energyBack + 18);
    word(ctx, '=', SPINE, E_Y, `600 64px ${FONT.latin}`, P.voice, { opacity: eq, glow: 12, scale: 0.7 + 0.3 * ease.outBack(eq) });
    word(ctx, '能量', 96, E_Y - 6, `600 34px ${FONT.serif}`, 'rgba(243,239,230,0.85)', { opacity: eb, align: 'left' });
    mono(ctx, frame, 'ENERGY', 98, E_Y + 24, T.energyBack + 2, { size: 14 });
  }

  // ---- entropy row
  flap(ctx, frame, { x: SPINE, y: TILE_B_Y, from: ' ', to: '熵', at: T.entropyRow, seed: 3, opacity: seg(frame, T.entropyRow - 2, T.entropyRow + 4) });
  mono(ctx, frame, 'ENTROPY', SPINE + 60, TILE_B_Y + 40, T.entropyRow + 10, { size: 16 });
  const entA = seg(frame, T.entropyRow + 8, T.entropyRow + 18);
  if (entA > 0.01) {
    const entOut = clamp((frame - T.entropyRow - 16) / 18) * 20;
    roll(ctx, 1, COL_IN, ROW_B, 100, P.gold, { glow: 0.4, opacity: entA });
    roll(ctx, entOut, COL_OUT + 14, ROW_B, 100, RED_TXT, { glow: 0.4 + entOut / 25, opacity: entA, prefix: '≈' });
  }
  ctx.restore();
  XB = 0;
}

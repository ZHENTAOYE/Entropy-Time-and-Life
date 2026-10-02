// Narration of S05 (text locked by docs/screenplay.md). The voice drains to grey with the universe and regains its
// warmth only for the last line. Card 6 dies by NOISE-DEATH (its pixels random-walk while its contrast → 0).
import { clamp, ease, seg } from '../../lib/math';
import { F } from './fonts';
import { buildMask, drawScattered } from './scatter';
import { Cap, GREY, RGB, VOICE, drawCap, drawCapMask, layoutCap, lerpRGB } from './text';
import { T } from './timing';

const drain = (from: RGB, to: RGB, len: number, delay = 0) => (l: number): RGB => lerpRGB(from, to, ease.inOutSine(seg(l, delay, len)));

export const C1: Cap = {
  lines: ['滚到最后呢？'],
  from: T.c1.at,
  dur: T.c1.dur,
  font: F.voice,
  size: 56,
  color: () => VOICE,
  backdrop: 1,
  stagger: 1.3,
  enterLen: 16,
  exitLen: 20,
};
export const C4: Cap = {
  lines: ['温度处处相同。'],
  from: T.c4.at,
  dur: T.c4.dur,
  font: F.voice,
  size: 56,
  color: drain(VOICE, [186, 186, 186], T.c4.dur),
  stagger: 1.3,
  enterLen: 16,
  exitLen: 20,
};
export const C5: Cap = {
  lines: ['能量{都还在}，', '却再也[做不了]任何事。'],
  from: T.c5.at,
  dur: T.c5.dur,
  font: F.voice,
  size: 56,
  stagger: 1.1,
  enterLen: 16,
  lineDelay: [0, 10],
  color: drain([212, 209, 203], [178, 178, 178], T.c5.dur),
  em: () => VOICE,
  em2: drain([212, 209, 203], [138, 138, 138], 50, 30),
  exitLen: 24,
};
export const C6A: Cap = {
  lines: ['这叫——'],
  from: T.c6.at,
  dur: 9999,
  font: F.voice,
  size: 56,
  y: 652,
  stagger: 3,
  exit: 'none',
  color: () => [196, 194, 190],
};
/** 热寂 — Serif 200, the gap between 热 and 寂 exactly on the gold point's x; 。 hangs outside the centring */
export const C6B: Cap = {
  lines: ['热寂。'],
  from: T.c6.at + 12,
  dur: 9999,
  font: F.void,
  size: 210,
  y: 830,
  letterSpacing: 0.06,
  hang: '。',
  exit: 'none',
  color: () => [214, 214, 214],
};
export const C8: Cap = {
  lines: ['但在滚落的路上——'],
  from: T.c8.at,
  dur: T.c8.dur,
  font: F.voice,
  size: 56,
  stagger: 1.4,
  enterLen: 16,
  exitLen: 24,
  color: () => VOICE,
};

const C6_FADE = T.c6.at + 12; // 热寂 fades in (6 f)
const C6_DIE = T.c6.at + 30; // …then fades to exactly the grey while its pixels random-walk
const C6_END = T.c6.at + 62;

function drawCard6(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.c6.at || f > C6_END + 2) return;
  // 这叫—— condenses, holds, then dies into the noise too
  const aDie = seg(f, C6_DIE + 4, C6_END - 4);
  if (aDie <= 0) drawCap(ctx, C6A, f);
  else {
    const m = buildMask('c6a', 300, 590, 480, 130, (x) => drawCapMask(x, C6A));
    drawScattered(ctx, m, 0.5 + 34 * aDie * aDie, lerpRGB(C6A.color(0), GREY, ease.inOutSine(aDie)), 1 - ease.inQuad(aDie), 616, f);
  }
  // 热寂
  if (f < C6_FADE) return;
  layoutCap(ctx, C6B);
  const m = buildMask('c6b', 200, 660, 760, 340, (x) => drawCapMask(x, C6B));
  const inK = ease.inOutSine(seg(f, C6_FADE, C6_FADE + 6));
  const dk = seg(f, C6_DIE, C6_END);
  // contrast: from the grey up to light grey (fade in), then back down to EXACTLY the background grey
  const col = lerpRGB(GREY, C6B.color(0), inK * (1 - ease.inOutSine(dk)));
  const sigma = 26 * Math.pow(dk, 1.6);
  drawScattered(ctx, m, sigma, col, clamp(1.15 - dk), 6060, f);
}

export function drawCaptions(ctx: CanvasRenderingContext2D, f: number) {
  drawCap(ctx, C1, f);
  drawCap(ctx, C4, f);
  drawCap(ctx, C5, f);
  drawCard6(ctx, f);
  drawCap(ctx, C8, f);
}

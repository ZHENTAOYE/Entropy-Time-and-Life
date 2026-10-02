// Narration of S05 (text locked by docs/screenplay.md). The voice drains to grey with the universe and regains its
// warmth only for the last line. Card 6 dies by NOISE-DEATH (its pixels random-walk while its contrast → 0).
// Reading time: a fast condense (stagger 0.8, enterLen 12 → every glyph crisp ~0.6 s after the line starts) and a
// short diffuse (14–16 f) leave each line fully crisp for ≥ (glyphs / 5) s inside the locked card windows (±0.5 s):
//   C1 「滚到最后呢？」 crisp f20–56 (1.2 s) · C4 「温度处处相同。」 f210–246 (1.2 s) · C5 two lines f285–354 (2.3 s; line 1
//   from f277) · C6 「这叫——热寂。」 f365–~394 incl. the slow start of its noise-death · C8 「但在滚落的路上——」 f463–505 (1.4 s).
// Lanes: narration y 1440; the statement 「这叫——」/「热寂。」 sits at the centre (y 652 / 830) so it can start while C5
// diffuses; no two lines ever share a lane at the same time.
import { clamp, ease, seg } from '../../lib/math';
import { F } from './fonts';
import { buildMask, drawScattered } from './scatter';
import { Cap, GREY, RGB, VOICE, drawCap, drawCapMask, layoutCap, lerpRGB } from './text';
import { T } from './timing';

const drain = (from: RGB, to: RGB, len: number, delay = 0) => (l: number): RGB => lerpRGB(from, to, ease.inOutSine(seg(l, delay, len)));

/**
 * 「但在滚落的路上——」 — THE "……的路上——" LINE. S09's 「但在散开的路上——」 copies this exactly: Noto Serif SC 600 56 px
 * (F.voice), centred on x 540, line centre y 1440 (alphabetic baseline y 1440 + 0.38·56), tracking 0.08 em, warm
 * white #F3EFE6, CONDENSE stagger 0.8 / enterLen 12, DIFFUSE exitLen 14, and the 「——」 drawn as ONE unbroken rule at
 * the font's own dash height and thickness (text.ts: each "—" of a run is a bar reaching the middle of the tracking
 * gap, so the advance — and every other glyph's position — is exactly that of the plain text).
 */
export const ROAD_LINE = {
  font: F.voice,
  size: 56,
  x: 540,
  y: 1440,
  letterSpacing: 0.08,
  color: VOICE,
  stagger: 0.8,
  enterLen: 12,
  exitLen: 14,
} as const;

export const C1: Cap = {
  lines: ['滚到最后呢？'],
  from: T.c1.at,
  dur: T.c1.dur,
  font: F.voice,
  size: 56,
  color: () => VOICE,
  backdrop: 1,
  stagger: 0.8,
  enterLen: 12,
  exitLen: 14,
};
export const C4: Cap = {
  lines: ['温度处处相同。'],
  from: T.c4.at,
  dur: T.c4.dur,
  font: F.voice,
  size: 56,
  color: drain(VOICE, [190, 190, 190], T.c4.dur),
  stagger: 0.8,
  enterLen: 12,
  exitLen: 14,
};
export const C5: Cap = {
  lines: ['能量{都还在}，', '却再也[做不了]任何事。'],
  from: T.c5.at,
  dur: T.c5.dur,
  font: F.voice,
  size: 56,
  stagger: 0.8,
  enterLen: 12,
  lineDelay: [0, 5],
  color: drain([214, 211, 205], [182, 182, 182], T.c5.dur),
  em: () => VOICE,
  em2: drain([214, 211, 205], [140, 140, 140], 56, 34),
  exitLen: 16,
};
export const C6A: Cap = {
  lines: ['这叫——'],
  from: T.c6.at,
  dur: 9999,
  font: F.voice,
  size: 56,
  y: 652,
  stagger: 1.5,
  enterLen: 12,
  exit: 'none',
  color: () => [200, 198, 194],
};
/** 热寂 — Serif 200, the gap between 热 and 寂 exactly on the gold point's x; 。 hangs outside the centring */
export const C6B: Cap = {
  lines: ['热寂。'],
  from: T.c6.at + 10,
  dur: 9999,
  font: F.void,
  size: 210,
  y: 830,
  letterSpacing: 0.06,
  hang: '。',
  exit: 'none',
  color: () => [216, 216, 216],
};
export const C8: Cap = {
  lines: ['但在滚落的路上——'],
  from: T.c8.at,
  dur: T.c8.dur,
  font: ROAD_LINE.font,
  size: ROAD_LINE.size,
  x: ROAD_LINE.x,
  y: ROAD_LINE.y,
  letterSpacing: ROAD_LINE.letterSpacing,
  stagger: ROAD_LINE.stagger,
  enterLen: ROAD_LINE.enterLen,
  exitLen: ROAD_LINE.exitLen,
  color: () => ROAD_LINE.color,
};

const C6_FADE = T.c6.at + 10; // 热寂 fades in by contrast (6 f)
const C6_DIE = T.c6.at + 24; // …then fades to EXACTLY the grey while its pixels random-walk (slow start: still read)
const C6_END = T.silence[0]; // pure grey from here: the silence

function drawCard6(ctx: CanvasRenderingContext2D, f: number) {
  if (f < T.c6.at || f >= C6_END) return;
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
  const dk = seg(f, C6_DIE, C6_END - 2);
  // contrast: from the grey up to light grey (fade in), then back down to EXACTLY the background grey
  const col = lerpRGB(GREY, C6B.color(0), inK * (1 - ease.inOutSine(dk)));
  const sigma = 24 * dk * dk;
  drawScattered(ctx, m, sigma, col, clamp(1.15 - dk), 6060, f);
}

export function drawCaptions(ctx: CanvasRenderingContext2D, f: number) {
  drawCap(ctx, C1, f);
  drawCap(ctx, C4, f);
  drawCap(ctx, C5, f);
  drawCard6(ctx, f);
  drawCap(ctx, C8, f);
}

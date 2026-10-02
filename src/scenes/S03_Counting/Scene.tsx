// S03 数一数 / Counting — 1092 frames (36.4 s). "The histogram is made of worlds."
// A clinical amber data-lab (Ikeda unit-vis): every microstate is a drawn object, so every chart is literally a pile of
// arrangements; then one probability, written out with 1 mm per zero, outgrows the Milky Way.
//
// Beat sheet (scene-local frames; constants.ts `T` is the clock, cues.ts derives every sound cue from it):
//   0      IN = S02's OUT recoloured amber on 「咔」: BOX + divider + 4 dots at P4, faint grid (20 %).
//   4-20   labels A–D type on; the divider lifts (10-20, clack); a dashed L|R reference stays.
//   4-94   C1 「4个粒子，数一数。」 (amber 4). The gas runs (closed form, exact walls); a ledger under the box shows
//          左 [ … ] | 右 [ … ] — letters hop bins on each of the 6 crossings (f22 30 37 45 61 67) and count n : 4−n;
//          a strip chart above records every frame's microstate.
//   66-74  the gas decelerates and stops: a snapshot (shutter brackets) = ONE microstate (C D left, A B right).
//   78-104 the frozen box (identical look, no pop) shrinks into its cell of a 4×4 table; the other 15 peel off it.
//   108-141 FLIP into five columns by number on the left: 1 · 4 · 6 · 4 · 1 (a histogram made of worlds).
//   132-228 C3 colon-aligned: 「全在左边：1种」 (white 1 slams 140, the all-left world bracketed, 1/16) /
//          「左右各半：6种」 (amber 6 slams 158, the 2:2 column bracketed and glowing, 6/16).
//   204-251 the worlds compress into 4-bit barcodes; N = 10: all 1024 10-bit microstates fall through a Galton board
//          (one bounce per bit) into 11 columns, live counts 1 10 45 120 210 252 …; width bracket 宽度 ±16 % (±σ).
//   254-286 N = 100 (101 striped bars, ±5 %), N = 10⁴ (a needle, ±0.5 %). Labels only.
//   288-382 the chart drops; a waterfall of random 100-bit trials under a pinned white TARGET row; TRIALS count up,
//          HITS stays 0, BEST ≈ 66/100. A black slab: C5 「100个粒子全在左边：」 + monumental 约 10⁻³⁰ (slam 300;
//          2⁻¹⁰⁰ = 7.9 × 10⁻³¹ under it); the number leaves as one unit.
//   372-502 the waterfall dissolves into molecules that pour into a drawn glass (250 mL, N ≈ 8×10²⁴); C6
//          「一杯水，约 10²⁵ 个分子——/ 全挤到一边的概率：」; the molecules crowd into the left half (a white
//          hypothetical, 436-456) and spread back on their own (474-496).
//   482-600 the glass shrinks to an icon; 「0.000…」 types out at y 960, one zero = 1 mm (ruler, 「1 mm」 callout);
//          C7 「每个零，只占1毫米。」 (rides into the zoom); the camera rides along the row (522→), zeros streak.
//   556-668 powers of ten around the row's start (Hermite in log z): zeros → dots → a line of light; 书桌 (578) →
//          城市 (600) → 地球 (620) → 太阳系 (643) → star layers converge on the Sun → the Milky Way materialises
//          AROUND the start (the Sun is 2.6×10⁴ ly from the centre). Odometer 视野宽度 m×10ⁿ m (one sig. digit).
//   654-748 C9 「这串零，比银河系还长。」; dimension lines 银河系 ≈ 10⁵ 光年 / 这一行 ≈ 2.6×10⁵ 光年, a 10⁴-ly ruler,
//          「0.」 at the Sun … 「第 2.5×10²⁴ 位」 at the far end; light pulses read along the row.
//   748-852 C10 golden line, mirror-aligned: 「聚回来，不是不可能——/ 只是太不可能。」 (不可能 in one column).
//   826-850 the galaxy dissolves; the row settles onto the handoff line 90 → 990.
//   834-882 the glass's histogram needle (N ≈ 10²⁵) rises out of the line and unfolds into 熵 (+ shāng); lock 864.
//   882-956 熵 shatters into the S of S = k log W (S k W italic, = log upright), carved and gilded on a granite stele
//          standing on the line, W made of microstates; C12 「玻尔兹曼墓碑上的公式」; note 「那串零有多长，熵就差多少」.
//   942-1085 C13 「熵不是“乱”。/ 它数的是：多少种微观排列，/ 看起来一模一样。」 — 乱 struck (966); the six 2:2 worlds
//          appear, coarse-grain (1000) into the same even stipple, merge into one (1014) — W = 6 — and flatten into the
//          line (1048-1072), which becomes S04's exact line (1060-1076).
//   1086-1091 OUT = S04's IN: the single glowing amber ZERO_LINE (S04's own passes + bloom) alone on #070604.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SoftCanvas } from './SoftCanvas';
import { ease, memo, seg } from '../../lib/math';
import { C, T } from './constants';
import { drawCount, glowCount } from './count';
import { Cards } from './cards';
import { fontsAt, useFontsWindowed } from './fonts';
import { drawGlass, glowGlass } from './glass';
import { drawShang, drawShangToS, drawSix, drawStele, glowShang, glowSix, glowStele, lineBoost } from './glyph';
import { drawHisto, drawHistoLabels, glowHisto } from './histo';
import { drawLottery, drawLotteryBand, drawLotteryHud, glowLottery } from './lottery';
import { Ctx, MONO, drawRich, gridCanvas, sup, vignetteSprite } from './paint';
import { drawGalaxyLayer, drawPulses, drawRow, drawZoom, glowZoom } from './zoom';

function gridAlpha(f: number) {
  // 20 % on frame 0 (S02's OUT), up to 34 % for the data beats, down under the waterfall, gone before space
  let a = 0.2 + 0.14 * ease.inOutQuad(seg(f, 2, 30));
  a *= 1 - 0.6 * seg(f, T.lottery, T.lottery + 14);
  a += 0.08 * seg(f, T.glass, T.glass + 20);
  a *= 1 - seg(f, T.zoom + 4, T.zoom + 24);
  return a;
}

function drawBackground(ctx: Ctx, f: number) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, 1080, 1920);
  const ga = gridAlpha(f);
  if (ga > 0.003) {
    // the grid canvas is the 100 % look; S02 shows it at 20 % on the OUT frame
    ctx.globalAlpha = ga;
    ctx.drawImage(gridCanvas(), 0, 0);
    ctx.globalAlpha = 1;
  }
}

function drawHud(ctx: Ctx, f: number) {
  // chapter + N (beats 1–3)
  const a = seg(f, T.c1, T.c1 + 4) * (1 - seg(f, T.rain - 6, T.rain + 2));
  if (a > 0.003) {
    drawRich(ctx, [{ t: 'FIG.03  COUNTING MICROSTATES' }], 90, 252, { font: MONO(24, 400), size: 24, color: C.amber, alpha: 0.75 * a, reveal: seg(f, T.c1, T.c1 + 22), tracking: 2, cursor: true, frame: f });
    const two = seg(f, T.sort - 6, T.sort + 10);
    if (two < 1) drawRich(ctx, [{ t: 'N = 4' }], 90, 296, { font: MONO(30, 700), size: 30, color: C.pale, alpha: a * (1 - two), reveal: seg(f, T.c1 + 10, T.c1 + 16), tracking: 2 });
    if (two > 0) drawRich(ctx, sup('N = 4   2×2×2×2 = 2^{4} = 16 种排列'), 90, 296, { font: MONO(30, 700), size: 30, color: C.pale, alpha: a, reveal: two, tracking: 1 });
  }
}

function drawMain(ctx: Ctx, f: number, ready: boolean) {
  drawBackground(ctx, f);
  if (!ready) return;
  // data beats
  drawHisto(ctx, f);
  drawLottery(ctx, f);
  drawLotteryBand(ctx, f);
  drawGlass(ctx, f);
  // the cosmos + context layers, then the row (the line lies over the galaxy)
  drawGalaxyLayer(ctx, f);
  drawZoom(ctx, f);
  drawStele(ctx, f, ready);
  drawRow(ctx, f, lineBoost(f));
  drawPulses(ctx, f);
  drawCount(ctx, f);
  drawShang(ctx, f, ready);
  drawShangToS(ctx, f, ready);
  drawSix(ctx, f);
  // HUD
  drawHud(ctx, f);
  drawHistoLabels(ctx, f);
  drawLotteryHud(ctx, f);
  // vignette (lib look, 0.42 like S02's OUT), gone for the bare OUT line
  const va = 1 - seg(f, T.collapse, T.lineOnly - 4);
  if (va > 0.003) {
    ctx.globalAlpha = va;
    ctx.drawImage(vignetteSprite(0.42), 0, 0, 1080, 1920);
    ctx.globalAlpha = 1;
  }
}

/** quarter-res bloom buffer (CPU-backed scratch, fully redrawn every frame) */
function bloomCanvas(): HTMLCanvasElement {
  return memo('S03:bloom', () => {
    const c = document.createElement('canvas');
    c.width = 270;
    c.height = 480;
    c.getContext('2d', { willReadFrequently: true });
    return c;
  });
}
/** the S03 scanline texture (1 dark row in 3), as a canvas pattern tile */
function scanTile(): HTMLCanvasElement {
  return memo('S03:scanTile', () => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 3;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 2, 4, 1);
    return c;
  });
}

/**
 * One full-frame canvas for everything (content, vignette, additive bloom, scanlines): under SwiftShader every extra
 * full-frame layer (a blend-mode canvas, a CSS gradient overlay) costs a compositing pass per frame. Narration (DOM)
 * stays on top, as before.
 */
function drawFrame(ctx: Ctx, f: number, ready: boolean) {
  drawMain(ctx, f, ready);
  if (!ready) return;
  // bloom: the emissive elements again at quarter res, screened on top
  const bc = bloomCanvas();
  const g = bc.getContext('2d', { willReadFrequently: true })!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, 270, 480);
  g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  drawGlow(g, f);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bc, 0, 0, 1080, 1920);
  ctx.restore();
  // scanline texture (fades in on the 咔, gone for the bare OUT line)
  const scan = seg(f, 2, 20) * (1 - seg(f, T.collapse, T.lineOnly - 4));
  if (scan > 0.003) {
    ctx.save();
    ctx.globalAlpha = 0.32 * scan;
    ctx.fillStyle = ctx.createPattern(scanTile(), 'repeat')!;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.restore();
  }
}

function drawGlow(ctx: Ctx, f: number) {
  ctx.globalCompositeOperation = 'lighter';
  glowCount(ctx, f);
  glowHisto(ctx, f);
  glowLottery(ctx, f);
  glowGlass(ctx, f);
  glowZoom(ctx, f);
  glowShang(ctx, f);
  glowStele(ctx, f);
  glowSix(ctx, f);
  ctx.globalCompositeOperation = 'source-over';
}

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  // only the faces on screen around this frame (see fonts.ts)
  const ready = useFontsWindowed(fontsAt(f));
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <SoftCanvas draw={(ctx, { frame }) => drawFrame(ctx, frame, ready)} />
      <Cards ready={ready} />
    </AbsoluteFill>
  );
};

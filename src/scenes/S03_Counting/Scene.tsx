// S03 数一数 / Counting — 1092 frames (36.4 s). "The histogram is made of worlds."
// A clinical amber data-lab (Ikeda unit-vis): every microstate is a drawn object, so every chart is literally a pile of
// arrangements; then one probability, written out with 1 mm per zero, outgrows the Milky Way.
//
// Beat sheet (scene-local frames; constants.ts `T` is the clock):
//   0      IN = S02's OUT recoloured amber on 「咔」: BOX + divider + 4 dots at P4, faint grid (20 %).
//   4-20   labels A–D type on; the divider lifts (10-20, clack); a dashed L|R reference stays.
//   6-82   C1 「4个粒子，数一数。」 (amber 4). The gas runs (closed form, exact walls); a ledger under the box shows
//          左 [ … ] | 右 [ … ] — letters hop bins on each of the 6 crossings (f22 30 37 45 61 67) and count n : 4−n.
//   66-74  the gas decelerates and stops: a snapshot (shutter brackets) = ONE microstate (A B right, C D left).
//   78-104 the box shrinks into its cell of a 4×4 truth table; the other 15 arrangements peel off it (ripple).
//   108-136 FLIP into five columns by number on the left: 1 · 4 · 6 · 4 · 1 (a histogram made of worlds).
//   138-226 C3 colon-aligned: 「全在左边：1种」 (white, the all-left world bracketed, 1/16) /
//          「左右各半：6种」 (amber, the 2:2 column bracketed and glowing, 6/16).
//   212-252 the worlds compress into 4-bit barcodes; N = 10: all 1024 10-bit microstates rain into 11 columns
//          (1 10 45 120 210 252 …). A width bracket: 16 %.
//   254-286 N = 100 (thin striped bars, 5 %), N = 10⁴ (a needle, 0.5 %). Labels only.
//   284-372 the chart drops; a waterfall of random 100-bit trials falls under a pinned white TARGET row; TRIALS
//          count up, HITS stays 0, BEST ≈ 67/100. A black slab: 「100个粒子全在左边：」 + monumental 约 10⁻³⁰.
//   366-506 the waterfall dissolves into molecules that pour into a drawn glass (250 mL, N ≈ 8×10²⁴); C6
//          「一杯水，约 10²⁵ 个分子——/ 全挤到一边的概率：」; the molecules crowd into the left half (a white
//          hypothetical, 436-456) and spread back on their own (474-494).
//   488-576 the glass shrinks to an icon; 「0.000…」 types out at y 960, one zero = 1 mm (ruler, 「1 mm」 callout);
//          C7 「每个零，只占1毫米。」; the camera rides along the row (522→), zeros streak.
//   556-668 powers of ten (Hermite in log z): zeros → dots → a line of light; 书桌 (578) → 城市 (600) → 地球 (620)
//          → 太阳系 (643) → star layers → the amber Milky Way slides onto the line (668). Odometer 10ⁿ m.
//   664-742 C9 「这串零，比银河系还长。」; dimension lines 银河系 ≈ 10⁵ 光年 / 这一行 ≈ 2.6×10⁵ 光年.
//   742-840 C10 golden line, mirror-aligned: 「聚回来，不是不可能——/ 只是太不可能。」 (不可能 in one column).
//   832-882 the galaxy dissolves; the glass's histogram needle (N ≈ 10²⁵) rises out of the line and unfolds into 熵
//          (+ shāng); lock 874.
//   884-958 熵 → the S of S = k log W, carved and gilded on a stone stele standing on the line, W made of microstates;
//          C12 「玻尔兹曼墓碑上的公式」, note 「那串零有多长，熵就差多少」.
//   948-1080 C13 「熵不是“乱”。/ 它数的是：多少种微观排列，/ 看起来一模一样。」 — 乱 struck (974); the six 2:2 worlds
//          appear, coarse-grain (1004) into identical looks, merge into one (1020, W = 6) and flatten into the line
//          (1044-1070).
//   1080-1091 OUT = S04's IN: the single glowing amber ZERO_LINE (90→990, y 960, 2 px + glow) alone on #070604.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SoftCanvas } from './SoftCanvas';
import { FONT, useFontsReady } from '../../lib/fonts';
import { ease, seg } from '../../lib/math';
import { C, T } from './constants';
import { drawCount, glowCount } from './count';
import { Cards } from './cards';
import { drawGlass, glowGlass } from './glass';
import { drawShang, drawShangToS, drawSix, drawStele, glowShang, glowSix, glowStele, lineBoost } from './glyph';
import { drawHisto, drawHistoLabels, glowHisto } from './histo';
import { drawLottery, drawLotteryBand, drawLotteryHud, glowLottery } from './lottery';
import { Ctx, MONO, drawRich, gridCanvas, sup, vignetteSprite } from './paint';
import { drawGalaxyLayer, drawPulses, drawRow, drawZoom, glowZoom } from './zoom';

const CJK_SANS = '左右全在各半目标个边一杯水分子假如空视野宽度书桌城市地球太阳系银河光年这行第位几乎部的排列都“”那串零有多长熵就差少种：，亮数万';

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
    ctx.globalAlpha = ga / 0.2 > 1 ? 1 : ga / 0.2;
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
    drawRich(ctx, [{ t: 'FIG.03  COUNTING MICROSTATES' }], 90, 252, { font: MONO(22, 400), size: 22, color: C.amber, alpha: 0.75 * a, reveal: seg(f, T.c1, T.c1 + 22), tracking: 2, cursor: true, frame: f });
    const two = seg(f, T.sort - 6, T.sort + 10);
    if (two < 1) drawRich(ctx, [{ t: 'N = 4' }], 90, 292, { font: MONO(28, 700), size: 28, color: C.pale, alpha: a * (1 - two), reveal: seg(f, T.c1 + 10, T.c1 + 16), tracking: 2 });
    if (two > 0) drawRich(ctx, sup('N = 4   2×2×2×2 = 2^{4} = 16 种排列'), 90, 292, { font: MONO(28, 700), size: 28, color: C.pale, alpha: a, reveal: two, tracking: 1 });
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
  const ready = useFontsReady([
    [`400 22px ${FONT.mono}`, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789=+-−.,:/×·≈%()  '],
    [`700 28px ${FONT.mono}`, 'ABCDN0123456789=×·≈ '],
    [`400 22px ${FONT.sans}`, CJK_SANS],
    [`700 22px ${FONT.sans}`, '种排列宽度'],
    [`300 30px ${FONT.sans}`, '空'],
    [`900 470px ${FONT.serif}`, '熵'],
    [`italic 600 176px ${FONT.latin}`, 'SkWlog'],
    [`600 176px ${FONT.latin}`, '= '],
    [`italic 600 64px ${FONT.latin}`, 'W=6 '],
  ]);
  const scan = seg(f, 2, 20) * (1 - seg(f, T.collapse, T.lineOnly - 4));
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <SoftCanvas draw={(ctx, { frame }) => drawMain(ctx, frame, ready)} />
      <SoftCanvas draw={(ctx, { frame }) => drawGlow(ctx, frame)} scale={0.25} style={{ mixBlendMode: 'screen' }} />
      {scan > 0.003 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: 0.5 * scan,
            backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.0) 0px, rgba(0,0,0,0.0) 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 3px)',
          }}
        />
      ) : null}
      <Cards />
    </AbsoluteFill>
  );
};

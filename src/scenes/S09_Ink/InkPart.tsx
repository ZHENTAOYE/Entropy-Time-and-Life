// S09 B4–B7 (f ≥ 428): the inversion and everything after it, inside ONE shared ink stage (lib/ink InkStage: a
// single CPU canvas — the tank, the hand-over image of the inverted web, the haze, every ink particle and the
// narration — plus the GL bloom of the last drop as its own multiply layer only once it exists).
import React from 'react';
import { COSMOS } from '../../lib/cosmos';
import { SGauge } from '../../lib/hud';
import { InkBloom, InkCanvas, InkDrop, InkMotes, InkStage, InkTank, inkDropFall } from '../../lib/ink';
import { ease, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { RGB, rgbStr } from './canvas';
import { BRUSH_PAD, drawBrushNi } from './brush';
import { F } from './fonts';
import { FLOOR, K, TC, TITLE, TITLE_TEXT, drawFigure, drawHaze, drawRewindInk, drawTitleInk } from './inkfx';
import { drawInkField } from './inkfield';
import { CAP, END, INK_T, INV, RW, SURFACE_Y, gaugeAlpha, lightAt, sValue } from './timing';
import { Cap, INK_TEXT, drawCap, layoutCap } from './voice';
import { DEV } from './dev';

const PAPER: RGB = [241, 234, 219];
const ink = () => INK_TEXT;
export const C9: Cap = {
  lines: ['墨，终将散开。'],
  from: CAP.c9.at,
  dur: CAP.c9.dur,
  font: F.voice,
  size: 56,
  color: ink,
  stagger: 1.6,
  enterLen: 16,
  exitLen: 22,
  backdrop: 0.55,
  backdropRgb: PAPER,
  inkFade: true,
};
/** = S05's C8 「但在滚落的路上——」 (same layout, stagger, enter & exit), in ink on the cream tank */
export const C10: Cap = {
  lines: ['但在散开的路上——'],
  from: CAP.c10.at,
  dur: CAP.c10.dur,
  font: F.voice,
  size: 56,
  stagger: 1.4,
  enterLen: 16,
  exitLen: 24,
  color: ink,
  inkFade: true,
};
export const C11: Cap = {
  lines: ['它画出了<你>。'],
  from: CAP.c11.at,
  dur: CAP.c11.dur,
  font: F.voice,
  size: 56,
  slotFont: F.brush,
  color: ink,
  stagger: 2.2,
  enterLen: 16,
  exitLen: 26,
  delayOf: (g) => (g.ch === '。' ? 54 : 0),
  backdrop: 0.4,
  backdropRgb: PAPER,
  inkFade: true,
};
const TITLE_CAP: Cap = {
  lines: [TITLE_TEXT],
  from: END.title[0],
  dur: 200,
  font: F.title,
  size: 86,
  y: TITLE.y,
  letterSpacing: 0.26,
  color: ink,
  stagger: 1.0,
  enterLen: 12,
  exit: 'none',
  backdrop: 0.75,
  backdropRgb: PAPER,
  inkFade: true,
};

/** the inversion (CosmicWeb `invert`), 0 → 1 */
export const invertAt = (f: number) => ease.inOutSine(seg(f, INV.invert[0], INV.invert[1]));

// ───────────────────────────── HUD: ◀◀ (in the water, ink-coloured) ─────────────────────────────
const FILM_T0 = 184.4; // S09 starts at 3:04.4
function clock(s: number) {
  const v = Math.max(0, s);
  const hh = Math.floor(v / 3600),
    mm = Math.floor((v % 3600) / 60),
    ss = Math.floor(v % 60),
    ff = Math.floor((v % 1) * 30);
  return [hh, mm, ss, ff].map((x) => String(x).padStart(2, '0')).join(':');
}
function tcSeconds(f: number) {
  const a = RW.attempt[0];
  if (f < a) return FILM_T0 + f / 30;
  // the rewind runs the CLOCK backwards ×8 — the picture does not follow
  return FILM_T0 + a / 30 - ((f - a) * 8) / 30;
}
function drawTimecode(ctx: CanvasRenderingContext2D, f: number) {
  if (f < RW.on || f > RW.melt[0] + 10) return;
  // flicker in
  const k = f - RW.on;
  if (k < 6 && (k === 1 || k === 3)) return;
  const out = 1 - seg(f, RW.melt[0], RW.melt[0] + 6);
  const tamper = f >= RW.attempt[0] && f < RW.melt[0] + 4 ? 1 : 0.35;
  const text = `◀◀ ×8  ${clock(tcSeconds(f))}`;
  ctx.save();
  ctx.font = F.tc;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const split = tamper * (2 + 2.5 * hash01(f, 77));
  const jit = tamper * (hash01(f, 78) - 0.5) * 3;
  ctx.globalAlpha = 0.55 * out;
  ctx.fillStyle = 'rgba(255,40,80,1)';
  ctx.fillText(text, TC.x + split + jit, TC.y);
  ctx.fillStyle = 'rgba(30,190,255,1)';
  ctx.fillText(text, TC.x - split + jit, TC.y);
  ctx.globalAlpha = 0.92 * out;
  ctx.fillStyle = rgbStr(INK_TEXT);
  ctx.fillText(text, TC.x + jit, TC.y);
  ctx.restore();
}
/** the timecode's text at the moment it melts (the ink takes exactly this shape) */
const meltText = () => `◀◀ ×8  ${clock(tcSeconds(RW.melt[0]))}`;

// ───────────────────────────── the stage ─────────────────────────────
export const InkPart: React.FC<{ f: number; web: () => HTMLCanvasElement | null; fontsReady: boolean }> = ({ f, web, fontsReady }) => {
  const light = lightAt(f);
  const age = (f - END.impact) / 30;
  const drop = inkDropFall(age, { fromY: 150, surfaceY: SURFACE_Y, r: 9, x: 540 });
  const t = 20 + f / 30;
  const airK = smoothstep(INV.tank[0], INV.tank[0] + 26, f);
  const span = ease.inOutCubic(seg(f, INV.hairline[0], INV.hairline[1])) * (1 - ease.inOutCubic(seg(f, END.span[0], END.span[1])));
  const hairline = smoothstep(INV.hairline[0], INV.hairline[0] + 6, f) * (1 - seg(f, END.point[0], END.point[1]));
  const haze = (0.03 + 0.1 * ease.inOutSine(seg(f, INV.handover, 800))) * smoothstep(INV.handover, INV.handover + 40, f);
  return (
    <>
      <InkStage>
        <InkCanvas z={-1} draw={(ctx) => DEV.mark?.('pre-tank', ctx)} />
        <InkTank
          time={t}
          impactAge={age > 0 ? age : -1}
          surfaceY={SURFACE_Y}
          paper={COSMOS.paper}
          light={light}
          airLight={airK * light}
          hairline={hairline}
          hairlineSpan={Math.max(0.0005, span)}
          crown={0.75}
          rippleAmp={0.55 * (1 - 0.6 * smoothstep(END.span[0] - 4, END.span[0] + 6, f))}
          bubbles={0.55}
        />
        {/* the inverted web, now ink, keeps spreading (advection + diffusion of its own optical density) */}
        <InkCanvas
          z={4}
          draw={(ctx) => {
            if (f < INV.handover) return;
            DEV.mark?.('stage-start', ctx);
            drawInkField(ctx, f, light);
            DEV.mark?.('field', ctx);
          }}
        />
        {/* the live inverted web hands over to the tank: first in the air above the line, then in the water */}
        <InkCanvas
          z={5}
          draw={(ctx) => {
            const src = web();
            if (!src || f > INV.tank[1] + 2) return;
            const aAir = 1 - smoothstep(INV.tank[0], INV.tank[0] + 24, f);
            const aWater = 1 - smoothstep(INV.handover, INV.handover + 26, f);
            ctx.save();
            if (aAir > 0.003) {
              ctx.globalAlpha = aAir;
              ctx.drawImage(src, 0, 0, src.width, SURFACE_Y * (src.height / 1920), 0, 0, 1080, SURFACE_Y);
            }
            if (aWater > 0.003) {
              ctx.globalAlpha = aWater;
              const sy = SURFACE_Y * (src.height / 1920);
              ctx.drawImage(src, 0, sy, src.width, src.height - sy, 0, SURFACE_Y, 1080, 1920 - SURFACE_Y);
            }
            ctx.restore();
            DEV.mark?.('liveweb', ctx);
          }}
        />
        <InkCanvas
          z={8}
          draw={(ctx) => {
            drawHaze(ctx, f, haze * light);
            DEV.mark?.('haze', ctx);
          }}
        />
        <InkCanvas
          z={20}
          draw={(ctx) => {
            if (light <= 0.01) return;
            drawFigure(ctx, f, light);
            DEV.mark?.('figure', ctx);
            if (f >= RW.melt[0]) drawRewindInk(ctx, f, light, meltText());
            drawTitleInk(ctx, f, light);
            DEV.mark?.('rw+title', ctx);
          }}
        />
        <InkBloom age={age} scale={0.55} seed={2} surfaceY={SURFACE_Y} k={K} floor={FLOOR} opacity={light} />
        <InkDrop {...drop} surfaceY={SURFACE_Y} opacity={light} />
        <InkMotes time={t} surfaceY={SURFACE_Y} opacity={0.8 * light * airK} count={18} />
        <InkCanvas
          z={100}
          draw={(ctx) => {
            if (!fontsReady || light <= 0.01) return;
            drawCap(ctx, C9, f, light);
            drawCap(ctx, C10, f, light);
            drawCap(ctx, C11, f, light, (c, g, st) => {
              const u = seg(f, INK_T.brush[0], INK_T.brush[1]);
              drawBrushNi(c, F.brush, 124, g.x + st.dx * 0.3, g.cy - 25.8 + st.dy * 0.3, u, st.diffuse, light);
            });
            DEV.mark?.('caps', ctx);
            drawTimecode(ctx, f);
            // the title condenses, then melts into ink particles (drawn on the ink layer)
            if (f >= END.title[0]) {
              const melt = 1 - smoothstep(END.titleMelt[0], END.titleMelt[0] + 10, f);
              // (the ink version of the title fades in under it over the same 10 frames: inkfx.drawTitleInk)
              drawCap(ctx, TITLE_CAP, f, melt * light);
              const L = layoutCap(ctx, TITLE_CAP);
              const g0 = L.glyphs[0];
              const pa = smoothstep(END.title[0] + 8, END.title[0] + 22, f) * melt * light;
              if (pa > 0.003) {
                ctx.save();
                ctx.font = F.pinyin;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = rgbStr(INK_TEXT, 0.82 * pa);
                ctx.fillText('shāng', g0.x, TITLE.y - 62);
                ctx.restore();
              }
            }
          }}
        />
      </InkStage>
      <SGauge value={sValue(f)} color="#17151C" opacity={gaugeAlpha(f)} />
    </>
  );
};
export const _pad = BRUSH_PAD;

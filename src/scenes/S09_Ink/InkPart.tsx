// S09 B4–B7 (f ≥ 428): the inversion and everything after it, inside ONE shared ink stage (lib/ink InkStage: a
// single CPU canvas — the tank, the hand-over image of the inverted web, the haze, every ink particle and the
// narration — plus the GL bloom of the last drop as its own multiply layer only once it exists).
import React from 'react';
import { COSMOS } from '../../lib/cosmos';
import { SGauge } from '../../lib/hud';
import { InkCanvas, InkDrop, InkMotes, InkStage, InkTank, inkDropFall } from '../../lib/ink';
import { clamp, ease, lerp, seg, smoothstep } from '../../lib/math';
import { hash01 } from '../../lib/random';
import { RGB, rgbStr, vignette } from './canvas';
import { BRUSH_EM, drawBrushNi } from './brush';
import { F } from './fonts';
import { FLOOR, K, TC, TITLE, TITLE_TEXT, drawRewindInk, drawTitleInk } from './inkfx';
import { drawFigureInk } from './figure';
import { drawInkField, fieldPeak } from './inkfield';
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
/**
 * = S05's C8 「但在滚落的路上——」 (S05 captions.ts ROAD_LINE: Serif 600 56 px, centred on x 540, y 1440, tracking
 * 0.08 em, stagger 0.8 / enterLen 12 / exitLen 14, 「——」 one unbroken rule), in ink on the cream tank.
 */
export const C10: Cap = {
  lines: ['但在散开的路上——'],
  from: CAP.c10.at,
  dur: CAP.c10.dur,
  font: F.voice,
  size: 56,
  x: 540,
  y: 1440,
  letterSpacing: 0.08,
  stagger: 0.8,
  enterLen: 12,
  exitLen: 14,
  color: ink,
  inkFade: true,
};
export const C11: Cap = {
  lines: ['它画出了<你>。'],
  from: CAP.c11.at,
  dur: CAP.c11.dur,
  font: F.voice,
  size: 56,
  slotW: BRUSH_EM,
  color: ink,
  stagger: 2.2,
  enterLen: 16,
  exitLen: 26,
  // 。 lands as the brush lifts off the last stroke
  delayOf: (g) => (g.ch === '。' ? 58 : 0),
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

// ───────────────────────────── the last drop ─────────────────────────────
/** the drop starts above the frame (fall 0.85 s to the surface) */
const DROP_FROM_Y = -30;
const WARM_LENS: RGB = [70, 52, 30];
/** its reflection under the hairline, rising to meet it (a soft dark gradient: no canvas filter) */
function drawDropReflection(ctx: CanvasRenderingContext2D, y: number, light: number) {
  const gap = SURFACE_Y - (y + 9);
  const k = clamp(1 - gap / 220) * light;
  if (k <= 0.01) return;
  const ry = SURFACE_Y + Math.max(4, gap * 0.72) + 6;
  ctx.save();
  ctx.beginPath();
  ctx.rect(500, SURFACE_Y + 1, 80, 90);
  ctx.clip();
  const g = ctx.createRadialGradient(540, ry, 0, 540, ry, 12);
  g.addColorStop(0, `rgba(20,22,32,${(0.3 * k).toFixed(3)})`);
  g.addColorStop(1, 'rgba(20,22,32,0)');
  ctx.fillStyle = g;
  ctx.fillRect(520, ry - 14, 40, 28);
  ctx.restore();
}

/** colour of ink of optical density ρ under the scene's law, as css rgba */
const inkRgba = (rho: number, a: number) => {
  const c = [0, 1, 2].map((ch) => Math.round(255 * (FLOOR[ch] + (1 - FLOOR[ch]) * Math.exp(-rho * K[ch]))));
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(3)})`;
};
/**
 * The last drop's bloom (multiply; visible only for the ~0.7 s before the light table is off): the young vortex ring of
 * S01 at 0.55× — a glossy torus darkest at its two ends, under the faint dome of its vortex bubble, hanging from a thin
 * stem to the crater, descending and braking. Drawn in 2D (a GL bloom would cost a WebGL context for 20 frames).
 */
function drawLastBloom(ctx: CanvasRenderingContext2D, age: number, light: number) {
  const k = smoothstep(0.03, 0.14, age) * light;
  if (k <= 0.01) return;
  const y = SURFACE_Y + 16 + 78 * (1 - Math.exp(-age / 0.5));
  const R = 13 + 19 * smoothstep(0, 0.55, age);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // the stem: the dye shed on the way down, a thin thread to the crater
  const st = k * (1 - 0.5 * smoothstep(0.3, 0.9, age));
  const sg = ctx.createLinearGradient(0, SURFACE_Y + 2, 0, y);
  sg.addColorStop(0, inkRgba(0.5, 0.2 * st));
  sg.addColorStop(1, inkRgba(1.2, 0.9 * st));
  ctx.strokeStyle = sg;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(540, SURFACE_Y + 2);
  ctx.quadraticCurveTo(541.5, (SURFACE_Y + y) / 2, 540, y - 0.25 * R);
  ctx.stroke();
  // the vortex bubble: a faint dome around the ring
  ctx.fillStyle = inkRgba(0.12, 0.8 * k);
  ctx.beginPath();
  ctx.ellipse(540, y - 0.18 * R, 1.08 * R, 0.62 * R, 0, 0, Math.PI * 2);
  ctx.fill();
  // the torus seen edge-on: a lens of ink, densest at its two ends (the longest optical path), thinner across the hole
  const tg = ctx.createLinearGradient(540 - R, 0, 540 + R, 0);
  tg.addColorStop(0, inkRgba(1.6, 0));
  tg.addColorStop(0.1, inkRgba(2.8, k));
  tg.addColorStop(0.32, inkRgba(1.3, k));
  tg.addColorStop(0.5, inkRgba(0.9, k));
  tg.addColorStop(0.68, inkRgba(1.3, k));
  tg.addColorStop(0.9, inkRgba(2.8, k));
  tg.addColorStop(1, inkRgba(1.6, 0));
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(540, y, R, 0.36 * R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────────── the stage ─────────────────────────────
export const InkPart: React.FC<{ f: number; web: () => HTMLCanvasElement | null; fontsReady: boolean }> = ({ f, web, fontsReady }) => {
  const light = lightAt(f);
  const age = (f - END.impact) / 30;
  // the last drop falls INTO view from above the frame (it exists only while it falls)
  const drop = inkDropFall(age, { fromY: DROP_FROM_Y, surfaceY: SURFACE_Y, r: 9, x: 540 });
  const dropOn = f >= END.dropFrom - 1 && f < END.impact;
  // the lens vignette: continuous with the eye/web beat's (black 0.42) at f428, then — as the tank takes over — S01's
  // warm lens (70,52,30 at 0.35)
  const vk = ease.inOutSine(seg(f, INV.tank[0], INV.tank[1] - 6));
  const vigS = lerp(0.42, 0.35, vk);
  const t = 20 + f / 30;
  const airK = smoothstep(INV.tank[0], INV.tank[0] + 26, f);
  const span = ease.inOutCubic(seg(f, INV.hairline[0], INV.hairline[1])) * (1 - ease.inOutCubic(seg(f, END.span[0], END.span[1])));
  const hairline = smoothstep(INV.hairline[0], INV.hairline[0] + 6, f) * (1 - seg(f, END.point[0], END.point[1]));
  const haze = (0.03 + 0.14 * ease.inOutSine(seg(f, INV.handover, 800))) * smoothstep(INV.handover, INV.handover + 40, f);
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
          crown={0.75 * light}
          rippleAmp={0.55 * (1 - 0.6 * smoothstep(END.span[0] - 4, END.span[0] + 6, f))}
          bubbles={0.55 * light}
        />
        {/* the inverted web, now ink, keeps spreading (advection + diffusion of its own optical density) */}
        <InkCanvas
          z={4}
          draw={(ctx) => {
            if (f < INV.handover) return;
            DEV.mark?.('stage-start', ctx);
            drawInkField(ctx, f, light, haze * light);
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
          z={20}
          draw={(ctx) => {
            if (light <= 0.01) return;
            drawFigureInk(ctx, f, light, clamp(0.92 * fieldPeak(f), 0.85, 1.7));
            DEV.mark?.('figure', ctx);
            if (f >= RW.melt[0]) drawRewindInk(ctx, f, light, meltText());
            drawTitleInk(ctx, f, light);
            DEV.mark?.('rw+title', ctx);
          }}
        />
        {age > 0 ? <InkCanvas z={10} draw={(ctx) => drawLastBloom(ctx, age, light)} /> : null}
        {dropOn ? <InkDrop {...drop} surfaceY={SURFACE_Y} opacity={light * smoothstep(END.dropFrom - 1, END.dropFrom + 2, f)} reflection={0} /> : null}
        {dropOn ? <InkCanvas z={31} draw={(ctx) => drawDropReflection(ctx, drop.y, light)} /> : null}
        <InkMotes time={t} surfaceY={SURFACE_Y} opacity={0.8 * light * airK} count={18} />
        <InkCanvas
          z={45}
          draw={(ctx) => {
            vignette(ctx, vigS * (1 - vk));
            vignette(ctx, vigS * vk * light, WARM_LENS);
          }}
        />
        <InkCanvas
          z={100}
          draw={(ctx) => {
            if (!fontsReady || light <= 0.01) return;
            drawCap(ctx, C9, f, light);
            drawCap(ctx, C10, f, light);
            DEV.mark?.('c9c10', ctx);
            drawCap(ctx, C11, f, light, (c, g, st) => {
              const u = seg(f, INK_T.brush[0], INK_T.brush[1]);
              // the 124 px glyph sits on the line's baseline (centre = baseline − 0.38 em)
              drawBrushNi(c, g.x + st.dx * 0.3, g.cy + 0.38 * 56 - 0.38 * BRUSH_EM + st.dy * 0.3, u, st.diffuse, light);
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

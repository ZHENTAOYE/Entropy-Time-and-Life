// S08 记忆 / Memory — 570 f. Traces only point backward.
// Beats (scene-local frames):
//   0–62    S07 handoff: S07's last frame rebuilt exactly (thermal grid + analytic prints on #05030F); the prints cool
//           through the inferno ramp while a low raking sun sweeps the sand in from the right and the same prints
//           show up as dents.                                                                           C1 4–150
//   86–250  the invisible walker: a print every 16 f from f108 (future = up); the foot's shadow precedes each step and
//           sharpens as it lands; grain puffs; wind (from f50) erodes the prints (depth e^-age/τ, edge blur ∝ √age);
//           time ruler 现在 / −1…−4 s / 未来 · ？ over pristine sand; S-gauge ticks up per print.      C3 178–252
//   236–340 macro zoom, slow motion: full-res lit grain pack; a foot shadow slides in and sharpens → impact f282 →
//           ~1100 ballistic grains + infrared heat; ◀◀ rewind attempt 310–326 shows its *target* in law-cyan (the
//           pristine ripple crests, every grain's origin) — and fails at f326: ✕ 不可逆, the cyan target shatters,
//           the print stays.                                                                             C4 252–342
//   332–420 pull back; sand goes dark; prints pool with molten gold → beads; ignition runs down the trail-axon
//           (352–387); lightning dendrites (space colonisation) grow from every bead and 17 other cells. C5 342–416
//   380–569 echo pulses every 30 f from f418 (main + 2 delay taps), rings, infrared embers; zoom out about a fixed
//           point into the head of the gold-line figure (outline grows from the neck 414–534), pulses run down the
//           body. Hold f545–569 = FIGURE_S08 (drawn by figure.ts, which S09 imports).               C6 416–545
// All raster content is composited into ONE CPU-backed canvas (the sand shader renders offscreen and is drawn in).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Caption } from '../../lib/Caption';
import { SGauge, Timecode } from '../../lib/hud';
import { FIGURE_S08 } from '../../lib/handoff';
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { CpuCanvas } from './CpuCanvas';
import { RichCaption } from './RichCaption';
import { drawFigureS08 } from './figure';
import { renderFrag } from './gl';
import { drawGrainOverlay } from './grainTex';
import { drawGround } from './groundFx';
import { TimeRuler } from './hud';
import { drawMotes } from './motes';
import { drawNetGhost } from './network';
import { RELIEF_SCALE, paintRelief } from './relief';
import { sandFrag } from './sandShader';
import { sandNoise } from './sandNoise';
import { drawThermalHandoff } from './thermal';
import { CAP, ECHO_F } from './timing';
import { Cam, MACRO_K, PRINTS, T_IMPACT, camera, finalXf } from './trail';

export const BG = FIGURE_S08.bg;
const GOLD = '#FFC94A';
const FILM_T0 = 165.4; // S08 starts at 2:45.4 in the film

const live = (f: number, c: readonly [number, number]) => f >= c[0] && f < c[0] + c[1];

/** rewind attempt strength (◀◀ tries 310–326, then fails) */
const rewindK = (f: number) => (f >= 310 && f < 327 ? Math.min(1, (f - 309) / 5) : 0);
/** the rewind's target (cyan): flickers in during the attempt, shatters when it fails */
const ghostA = (f: number) => (f < 310 ? 0 : f < 326 ? 0.32 * smoothstep(310, 313, f) : 0.32 * (1 - seg(f, 326, 342)));
const shatterK = (f: number) => seg(f, 326, 341);

function entropyS(f: number): number {
  let n = 0;
  for (const p of PRINTS) if (p.k >= 2 && p.k < MACRO_K && f >= p.T) n += ease.outCubic(clamp((f - p.T) / 6));
  let s = 0.3 + n * 0.028 + 0.14 * ease.outCubic(seg(f, T_IMPACT, T_IMPACT + 26));
  if (f >= 310 && f < 326) s -= 0.05 * seg(f, 310, 318);
  return s;
}

/** visibility of the narration over the dark network/figure (for the matte that keeps line art off the text) */
function captionMatte(f: number): number {
  const c5 = seg(f, CAP.c5[0], CAP.c5[0] + 10) * (1 - seg(f, CAP.c5[0] + CAP.c5[1] - 14, CAP.c5[0] + CAP.c5[1]));
  const c6 = seg(f, CAP.c6[0], CAP.c6[0] + 12) * (1 - seg(f, 538, 546));
  return Math.max(0.75 * c5, c6) * seg(f, 344, 362);
}

function vignette(ctx: CanvasRenderingContext2D, strength: number) {
  // = lib Vignette: radial-gradient(ellipse 75% 62% at 50% 50%, rgba(14,8,4,0) 55%, rgba(14,8,4,s) 100%)
  if (strength <= 0.003) return;
  const rx = 0.75 * 1080;
  const ry = 0.62 * 1920;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 1080, 1920);
  ctx.ellipse(540, 960, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.clip('evenodd');
  ctx.translate(540, 960);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0.55, 'rgba(14,8,4,0)');
  g.addColorStop(1, `rgba(14,8,4,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(-540, -960 * (rx / ry), 1080, 1920 * (rx / ry));
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, f: number, cam: Cam) {
  // ---------------- sand (offscreen shader, drawn in) + the thermal handoff on top of it
  const sand = ease.inOutSine(seg(f, 6, 58));
  if (f < 416 && sand > 0.001) {
    const relief = paintRelief(f, cam);
    const light = Math.min(1, 0.25 + 0.75 * ease.outCubic(seg(f, 10, 64))) * (1 - 0.75 * ease.inOutSine(seg(f, 336, 392)));
    const p = PRINTS[MACRO_K];
    const dofK = 0.55 * seg(f, 60, 140) + 0.45 * seg(f, 250, 280) * (1 - seg(f, 334, 360));
    {
      const rwv = f >= 310 && f < 342;
      const c = renderFrag(rwv ? 'sandRW' : 'sand', sandFrag(rwv), 540, 960, {
        u_rs: [1 / relief.width, 1 / relief.height],
        u_cam: [cam.cx, cam.cy, cam.z, RELIEF_SCALE],
        u_anchor: [cam.ax, cam.ay],
        u_t: f,
        u_light: light,
        u_dark: ease.inOutSine(seg(f, 350, 414)),
        u_gold: ease.inOutSine(seg(f, 334, 360)) * (1 - ease.inOutSine(seg(f, 384, 416))),
        u_glitch: rewindK(f),
        u_wind: seg(f, 60, 120) * (1 - seg(f, 330, 370)),
        u_dof: [0.5, f < 250 ? 0.42 : 0.45, dofK],
        u_ghost: [p.x, p.y, ghostA(f), shatterK(f)],
      }, { u_relief: relief, u_noise: { src: sandNoise(), repeat: true } });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(c, 0, 0, 1080, 1920);
    }
    // macro: full-resolution lit grains over the shaded sand
    const grainAmt = smoothstep(1.3, 2.2, cam.z) * (1 - seg(f, 336, 360));
    if (grainAmt > 0.01) drawGrainOverlay(ctx, cam, 0.85 * grainAmt * light, [540, (f < 250 ? 0.42 : 0.45) * 1920], dofK);
  }
  if (f < 62) {
    const k = Math.exp(-f / 22) * (1 - seg(f, 40, 62));
    const shimmer = seg(f, 2, 14) * (1 - seg(f, 14, 48));
    drawThermalHandoff(ctx, f, cam, k, sand, shimmer);
  }
  // ---------------- on the sand
  if (f < 396) drawGround(ctx, f, cam, { rewind: rewindK(f), fade: 1 - ease.inOutSine(seg(f, 340, 392)), ghost: ghostA(f), shatter: shatterK(f) });
  // ---------------- the network / figure
  const xf = finalXf(cam);
  if (f >= 360 && f < 500) drawNetGhost(ctx, f, xf[0], 0.32 * ease.inOutSine(seg(f, 362, 404)) * (1 - ease.inOutSine(seg(f, 446, 496))));
  if (f >= 346) {
    drawFigureS08(ctx, f, { scale: xf[0], tx: xf[1], ty: xf[2] });
    // keep the glowing line art off the narration (released before the FIGURE_S08 hold)
    const m = captionMatte(f);
    if (m > 0.003) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.translate(540, 1452);
      ctx.scale(1, 150 / 520);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 520);
      g.addColorStop(0, `rgba(0,0,0,${0.62 * m})`);
      g.addColorStop(0.6, `rgba(0,0,0,${0.5 * m})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-540, -520, 1080, 1040);
      ctx.restore();
    }
  }
  // ---------------- foreground motes, vignette
  drawMotes(ctx, f, cam, seg(f, 20, 60) * (1 - seg(f, 330, 380)), seg(f, 360, 420));
  vignette(ctx, 0.5 * ease.inOutSine(seg(f, 0, 30)));
}

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const cam = camera(f);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <CpuCanvas draw={(ctx) => drawFrame(ctx, f, cam)} />

      {/* HUD & narration are mounted only while visible: each mounted text component loads its font slices
          (useFontsReady → delayRender) on every frame of a fresh render tab, visible or not */}
      {f >= 98 && f < 252 ? <TimeRuler f={f} cam={cam} /> : null}
      {f >= 150 && f < 362 ? (
        <SGauge
          value={entropyS(f)}
          falling={f >= 310 && f < 326}
          color="#F6DFB2"
          opacity={seg(f, 150, 172) * (1 - seg(f, 344, 362))}
        />
      ) : null}
      {f >= 304 && f < 362 ? (
        <div style={{ position: 'absolute', left: 70, top: 232, width: 470, height: 74, borderRadius: 6, background: 'rgba(8,5,3,0.55)', filter: 'blur(6px)', opacity: seg(f, 304, 308) * (1 - seg(f, 352, 362)) }} />
      ) : null}
      {f >= 304 && f < 362 ? (
        <Timecode
          size={34}
          mode={f < 326 ? (f < 310 ? 'pause' : 'rewind') : 'fail'}
          speed={f >= 310 && f < 326 ? '×1' : ''}
          seconds={FILM_T0 + (f < 310 ? f : 310 - (f - 310) * 0.25) / 30}
          text={f >= 326 ? '不可逆' : undefined}
          color="#F6DFB2"
          opacity={seg(f, 304, 308) * (1 - seg(f, 352, 362))}
        />
      ) : null}

      {/* narration */}
      {(
        <>
          {live(f, CAP.c1) ? (
            <RichCaption
              from={CAP.c1[0]}
              dur={CAP.c1[1]}
              y={1428}
              lines={[
                { text: '最后一个问题：', size: 34, weight: 400, opacity: 0.78, letterSpacing: 0.34, marginBottom: 10 },
                { text: '你为什么记得{昨天}，', delay: 14 },
                { text: '却记不得<明天>？', delay: 30 },
              ]}
            />
          ) : null}
          {live(f, CAP.c3) ? <Caption text="脚印，只指向{过去}。" from={CAP.c3[0]} dur={CAP.c3[1]} accent={GOLD} shadow stagger={1} enterLen={16} exitLen={20} /> : null}
          {live(f, CAP.c4) ? (
            <Caption text={'痕迹，\n只能{顺着}熵增的方向留下。'} from={CAP.c4[0]} dur={CAP.c4[1]} accent={GOLD} stagger={0.6} enterLen={12} exitLen={20} shadow />
          ) : null}
          {live(f, CAP.c5) ? (
            <Caption text="{记忆}，是大脑里的脚印。" from={CAP.c5[0]} dur={CAP.c5[1]} accent={GOLD} shadow glow={0.15} stagger={0.6} enterLen={12} exitLen={18} />
          ) : null}
          {live(f, CAP.c6) ? (
            <RichCaption
              from={CAP.c6[0]}
              dur={CAP.c6[1]}
              y={1452}
              echoAt={ECHO_F - CAP.c6[0]}
              stagger={0.9}
              enterLen={14}
              exitLen={22}
              lines={[
                { text: '你感到的“时间之箭”——' },
                { text: '也许，正是熵增', delay: 10 },
                { text: '在你身体里的[回声]。', delay: 18 },
              ]}
            />
          ) : null}
        </>
      )}
    </AbsoluteFill>
  );
};

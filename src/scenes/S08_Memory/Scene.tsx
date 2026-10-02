// S08 记忆 / Memory — 570 f. Traces only point backward.
// Beats (scene-local frames):
//   0–62    S07 handoff: S07's last frame rebuilt exactly (thermal grid + analytic prints on #05030F); the prints cool
//           through the inferno ramp while a low raking sun sweeps the sand in from the right and the same prints
//           show up as dents.                                                                           C1 4–150
//   86–250  the invisible walker: a print every 16 f from f108 (future = up) along a lit corridor; the foot's shadow
//           precedes each step; grain puffs; wind (from f50) erodes the prints (depth e^-age/τ, edge blur ∝ √age);
//           time ruler 现在 / −1…−4 s (leaders + rings on the trail) / 未来 · ？ over pristine sand; S-gauge ticks up
//           per print. The camera pulls back to z 0.7.                                                    C3 178–256
//   228–340 macro, slow motion: the live walk camera blends into a ×2.4 macro framing (no hitch); the sun climbs to
//           28°; a foot shadow slides in → impact f282 → ~1100 ballistic grains + infrared heat; ◀◀ ×¼ rewind attempt
//           310–330: every grain is dragged ~35 % back toward where it came from (law-cyan return paths, the
//           pristine ripples in cyan over the dent, the dent partly refills, S falls red) — and fails at f330: the
//           grains snap back with a jolt, a red ✕ snaps across the print, ✕ 不可逆 held > 1 s.               C4 252–342
//   332–420 pull back; sand goes dark; prints pool with molten gold → beads; ignition runs down the trail-axon
//           (352–387); lightning dendrites (space colonisation) grow from every bead and 17 other cells. C5 342–416
//   380–569 echo pulses every 30 f from f418 (main + 2 delay taps), rings, infrared embers; zoom out about a fixed
//           point into the head of the gold-line figure (outline grows from the neck 414–534), pulses run down the
//           body. Hold f545–569 = FIGURE_S08 (drawn by figure.ts, which S09 imports).               C6 416–545
// All raster content is composited into ONE CPU-backed canvas (the sand shader renders offscreen, is read back with
// readPixels — see gl.ts — and drawn in).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Caption } from '../../lib/Caption';
import { SGauge, Timecode } from '../../lib/hud';
import { COLOR, FIGURE_S08 } from '../../lib/handoff';
import { clamp, ease, hexToRgb, memo, seg, smoothstep } from '../../lib/math';
import { CpuCanvas, cpuCanvas } from './CpuCanvas';
import { RichCaption } from './RichCaption';
import { drawFigureS08 } from './figure';
import { renderFrag } from './gl';
import { drawGrainOverlay } from './grainTex';
import { drawGround } from './groundFx';
import { FailStamp, RULER, TimeRuler, drawRulerCanvas } from './hud';
import { drawMotes } from './motes';
import { drawNetGhost } from './network';
import { RELIEF_SCALE, paintRelief } from './relief';
import { sandFrag } from './sandShader';
import { sandNoise } from './sandNoise';
import { drawThermalHandoff } from './thermal';
import { CAP, ECHO_F, REWIND } from './timing';
import { Cam, MACRO_K, PRINTS, T_IMPACT, camera, finalXf, sunAt } from './trail';

export const BG = FIGURE_S08.bg;
const GOLD = '#FFC94A';
const WARM = '#F6DFB2';
const FILM_T0 = 165.4; // S08 starts at 2:45.4 in the film
const [RW0, RW1] = REWIND; // ◀◀ tries 310–330, fails at 330

const live = (f: number, c: readonly [number, number]) => f >= c[0] && f < c[0] + c[1];

/** rewind attempt strength (tears, glitch, jitter) */
const rewindK = (f: number) => (f >= RW0 && f < RW1 ? Math.min(1, (f - RW0 + 1) / 5) : 0);
/** the rewind's target (cyan): flickers in during the attempt, shatters when it fails */
const ghostA = (f: number) => (f < RW0 ? 0 : f < RW1 ? 0.7 * smoothstep(RW0, RW0 + 3, f) : 0.7 * (1 - seg(f, RW1, RW1 + 16)));
const shatterK = (f: number) => seg(f, RW1, RW1 + 15);

/** the entropy meter: one notch per print, a jump at the macro impact; the rewind drags it down (red), and when
 *  it fails S eases back up (no jump) */
function entropyS(f: number): number {
  let n = 0;
  for (const p of PRINTS) if (p.k >= 2 && p.k < MACRO_K && f >= p.T) n += ease.outCubic(clamp((f - p.T) / 6));
  let s = 0.3 + n * 0.028 + 0.14 * ease.outCubic(seg(f, T_IMPACT, T_IMPACT + 26));
  if (f >= RW0) s -= 0.05 * ease.inOutSine(seg(f, RW0 + 1, RW1 - 4)) * (1 - ease.outCubic(seg(f, RW1, RW1 + 8)));
  return s;
}
function mixHexHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** a narration card is up over the sand (C1, C3, C4) */
function sandCaption(f: number): number {
  return Math.max(...[CAP.c1, CAP.c3, CAP.c4].map(([a, d]) => ease.inOutSine(seg(f, a - 4, a + 10)) * (1 - ease.inOutSine(seg(f, a + d - 14, a + d + 4)))));
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

/** offscreen CPU layer for the figure while it shares the frame with the sand */
function figLayer(): CanvasRenderingContext2D {
  return memo('S08:figLayer', () => cpuCanvas(1080, 1920).getContext('2d', { willReadFrequently: true })!);
}

/** soft dark ellipse behind a text block (narration lane over bright sand, the HUD timecode) */
function softBacking(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a: number) {
  if (a <= 0.003) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(10,7,5,${a})`);
  g.addColorStop(0.55, `rgba(10,7,5,${a * 0.8})`);
  g.addColorStop(1, 'rgba(10,7,5,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** ripple amplitude / lee fraction / print depth / cast-shadow strength: calmer sand, and calmer still in macro */
function ripUniform(f: number): number[] {
  const m = ease.inOutSine(seg(f, 238, 276));
  return [2.0 - 0.3 * m, 0.26 + 0.04 * m, 8 - 1.8 * m, 0.7 + 0.15 * m];
}

export function drawFrame(ctx: CanvasRenderingContext2D, f: number, cam: Cam, mark?: (label: string) => void) {
  // ---------------- sand (offscreen shader, read back and drawn in) + the thermal handoff on top of it
  const sand = ease.inOutSine(seg(f, 6, 58));
  // the sand ends at f404: by then it has faded to exactly the background and its gold has drained
  if (f < 404 && sand > 0.001) {
    const relief = paintRelief(f, cam);
    mark?.('relief');
    const light = Math.min(1, 0.25 + 0.75 * ease.outCubic(seg(f, 10, 64))) * (1 - 0.75 * ease.inOutSine(seg(f, 336, 392)));
    const p = PRINTS[MACRO_K];
    const dofK = 0.55 * seg(f, 60, 140) + 0.45 * seg(f, 250, 280) * (1 - seg(f, 334, 360));
    const sun = sunAt(f);
    {
      const rwv = f >= RW0 && f < RW1 + 16;
      // the darkening, defocusing pull-back needs less resolution
      const sc = f >= RW1 + 16 ? 0.35 : 0.5;
      const c = renderFrag(rwv ? 'sandRW' : 'sand', sandFrag(rwv), Math.round(1080 * sc), Math.round(1920 * sc), {
        u_rs: [1 / relief.width, 1 / relief.height],
        u_cam: [cam.cx, cam.cy, cam.z, RELIEF_SCALE],
        u_anchor: [cam.ax, cam.ay],
        u_t: f,
        u_light: light,
        u_dark: ease.inOutSine(seg(f, 350, 404)),
        u_gold: ease.inOutSine(seg(f, 334, 360)) * (1 - ease.inOutSine(seg(f, 380, 402))),
        u_glitch: rewindK(f),
        u_wind: seg(f, 60, 120) * (1 - seg(f, 330, 370)),
        u_dof: [0.5, f < 250 ? 0.42 : 0.45, dofK],
        u_ghost: [p.x, p.y, ghostA(f), shatterK(f)],
        u_sun: [sun.L[0], sun.L[1], sun.L[2], sun.tanE],
        u_rip: ripUniform(f),
        u_corr: seg(f, 40, 90) * (1 - seg(f, 236, 270)),
      }, { u_relief: relief, u_noise: { src: sandNoise(), repeat: true } });
      mark?.('shader');
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(c, 0, 0, 1080, 1920);
    }
    mark?.('sandBlit');
    // macro: full-resolution lit grains over the shaded sand
    const grainAmt = smoothstep(1.3, 2.2, cam.z) * (1 - seg(f, 336, 360));
    if (grainAmt > 0.01) drawGrainOverlay(ctx, cam, 0.85 * grainAmt * light, [540, (f < 250 ? 0.42 : 0.45) * 1920], dofK);
    mark?.('grain');
  }
  if (f < 62) {
    const k = Math.exp(-f / 22) * (1 - seg(f, 40, 62));
    const shimmer = seg(f, 2, 14) * (1 - seg(f, 14, 48));
    drawThermalHandoff(ctx, f, cam, k, sand, shimmer);
  }
  mark?.('thermal');
  // ---------------- on the sand
  if (f < 396) drawGround(ctx, f, cam, { rewind: rewindK(f), fade: 1 - ease.inOutSine(seg(f, 340, 392)), ghost: ghostA(f), shatter: shatterK(f) }, mark);
  mark?.('ground');
  // the narration lane over bright sand: a soft dark band (the sand is busy and bright)
  softBacking(ctx, 540, 1446, 520, 140, 0.3 * sand * sandCaption(f) * (1 - ease.inOutSine(seg(f, 336, 372))));
  // ---------------- the network / figure
  const xf = finalXf(cam);
  if (f >= 362 && f < 432) drawNetGhost(ctx, xf, 0.14 * ease.inOutSine(seg(f, 362, 392)) * (1 - ease.inOutSine(seg(f, 404, 430))));
  if (f >= 346) {
    // keep the glowing line art off the narration (released before the FIGURE_S08 hold). While the sand is still
    // there the matte must not punch through it: the (purely additive) figure is then drawn on its own layer.
    const m = captionMatte(f);
    const own = m > 0.003 && f < 404;
    const fig = own ? figLayer() : ctx;
    if (own) {
      fig.setTransform(1, 0, 0, 1, 0, 0);
      fig.globalCompositeOperation = 'source-over';
      fig.globalAlpha = 1;
      fig.clearRect(0, 0, 1080, 1920);
    }
    drawFigureS08(fig, f, { scale: xf[0], tx: xf[1], ty: xf[2], mark });
    if (m > 0.003) {
      fig.save();
      fig.globalCompositeOperation = 'destination-out';
      fig.translate(540, 1452);
      fig.scale(1, 150 / 520);
      const g = fig.createRadialGradient(0, 0, 0, 0, 0, 520);
      g.addColorStop(0, `rgba(0,0,0,${0.62 * m})`);
      g.addColorStop(0.6, `rgba(0,0,0,${0.5 * m})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fig.fillStyle = g;
      fig.fillRect(-540, -520, 1080, 1040);
      fig.restore();
    }
    if (own) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(fig.canvas, 0, 0, 1080, 1920);
      ctx.restore();
    }
  }
  mark?.('figure');
  // ---------------- foreground motes, vignette (a little heavier over the bright sand)
  drawMotes(ctx, f, cam, seg(f, 20, 60) * (1 - seg(f, 330, 380)), seg(f, 360, 420));
  mark?.('motes');
  vignette(ctx, 0.5 * ease.inOutSine(seg(f, 0, 30)) + 0.15 * ease.inOutSine(seg(f, 40, 80)) * (1 - ease.inOutSine(seg(f, 240, 290))));
  mark?.('vignette');
  // ---------------- HUD strokes (on the lens: after the vignette)
  drawRulerCanvas(ctx, f, cam);
  {
    // backing behind the timecode: sized to its label (the fail stamp is shorter than the running clock)
    // half-widths: '❚❚ / ◀◀ ×¼  00:02:55:20' ends near x 560, '✕  不可逆' near x 300
    const w = f < RW1 ? 250 : 250 - 118 * ease.outCubic(seg(f, RW1, RW1 + 4));
    softBacking(ctx, 66 + w, 268, w + 26, 44, 0.42 * seg(f, 304, 308) * (1 - seg(f, 364, 374)));
  }
  mark?.('hud');
}

export const Scene: React.FC = () => <SceneBody />;

/** (hud / captions flags: dev profiling only) */
export const SceneBody: React.FC<{ hud?: boolean; captions?: boolean }> = ({ hud = true, captions = true }) => {
  const f = useCurrentFrame();
  const cam = camera(f);
  const tcA = seg(f, 304, 308) * (1 - seg(f, 364, 374));

  return (
    <AbsoluteFill style={{ background: BG }}>
      <CpuCanvas draw={(ctx) => drawFrame(ctx, f, cam)} />

      {/* HUD & narration are mounted only while visible: each mounted text component loads its font slices
          (useFontsReady → delayRender) on every frame of a fresh render tab, visible or not */}
      {hud && f >= RULER[0] && f < RULER[1] ? <TimeRuler f={f} cam={cam} /> : null}
      {hud && f >= 150 && f < 362 ? (
        <SGauge
          value={entropyS(f)}
          falling={f >= RW0 && f < RW1}
          color={f >= RW1 ? mixHexHex(COLOR.alarmRed, WARM, ease.inOutSine(seg(f, RW1, RW1 + 8))) : WARM}
          opacity={seg(f, 150, 172) * (1 - seg(f, 344, 362))}
        />
      ) : null}
      {hud && f >= 304 && f < RW1 ? (
        <Timecode
          size={34}
          mode={f < RW0 ? 'pause' : 'rewind'}
          speed={f >= RW0 ? '×¼' : ''}
          seconds={FILM_T0 + (f < RW0 ? f : RW0 - (f - RW0) * 0.25) / 30}
          color={WARM}
          opacity={tcA}
        />
      ) : null}
      {hud && f >= RW1 && f < 374 ? <FailStamp f={f} t0={RW1} opacity={tcA} /> : null}

      {/* narration */}
      {captions && (
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
              shadow={false}
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

// S09 B2–B3 framing: the three hits (星系 / 细胞 / 你) and the eye → web bridge, drawn into the scene canvas.
import { WEB_FINAL, WebParams, centerOn } from '../../lib/cosmos';
import { ease, lerp, seg, smoothstep } from '../../lib/math';
import { RGB, fresh, glow, rgbStr, scratch, vignette } from './canvas';
import { drawEye, eyeState } from './eye';
import { F } from './fonts';
import { ANCHOR, CAP, EYE, HIT } from './timing';
import { bloomPass, drawCellShot, drawGalaxyShot, flashAt } from './triplet';
import { Cap, VOICE, drawCap } from './voice';
import { heroNode, webT } from './pullback';
import { DEV } from './dev';

const punch = (word: string, at: number, dur: number, exit: 'diffuse' | 'none'): Cap => ({
  lines: [word],
  from: at,
  dur,
  font: F.punch,
  size: 140,
  y: 1450,
  color: () => VOICE,
  stagger: 2,
  enterLen: 8,
  exitLen: 18,
  exit,
  letterSpacing: 0.04,
  glow: 0.18,
});
export const P1 = punch('星系。', HIT.galaxy, HIT.cell - HIT.galaxy, 'none');
export const P2 = punch('细胞。', HIT.cell, HIT.eye - HIT.cell, 'none');
export const P3 = punch('你。', HIT.eye, CAP.c7.at - HIT.eye + 4, 'diffuse');
const GOLDC: RGB = [255, 201, 74];
export const C7: Cap = {
  lines: ['然后，其中最小的一块，', '抬起头问：{时间是什么？}'],
  from: CAP.c7.at,
  dur: CAP.c7.dur,
  font: F.voice,
  size: 56,
  color: () => VOICE,
  em: () => GOLDC,
  stagger: 1.1,
  enterLen: 16,
  exitLen: 24,
  lineDelay: [0, 18],
  backdrop: 0.85,
  glow: 0.2,
};

/** the sky seen through the pupil (and inverted afterwards): a calm web around the hero cluster */
export function skyWeb(f: number): WebParams {
  const t = webT(f);
  const h = heroNode();
  const d = ease.inOutSine(seg(f, EYE.dive[0], EYE.dive[1] + 10));
  return {
    ...WEB_FINAL,
    t,
    // inside the window the web pulls back while we push in (a dolly zoom), then settles
    zoom: lerp(1.9, 0.92, d),
    roll: lerp(0.2, 0.06, d),
    ...centerOn(h.wx, h.wy, t),
    px: ANCHOR[0],
    py: ANCHOR[1] - 120,
    sparks: 0.5,
  };
}
export const skyWebOn = (f: number) => f >= EYE.webIn[0] - 2;

export function drawMiddle(ctx: CanvasRenderingContext2D, f: number, web: HTMLCanvasElement | null, fontsReady: boolean) {
  if (f < HIT.cell) {
    drawGalaxyShot(ctx, f);
    bloomPass(ctx, 0.35);
  } else if (f < HIT.eye) {
    drawCellShot(ctx, f);
    bloomPass(ctx, 0.55, 4);
  } else {
    drawEye(ctx, f);
    DEV.mark?.('eye', ctx);
    // the window: the pupil opens onto the web
    const st = eyeState(f);
    const wa = smoothstep(EYE.webIn[0], EYE.webIn[0] + 26, f);
    if (web && wa > 0.003) {
      const full = smoothstep(EYE.webIn[1] - 14, EYE.webIn[1], f);
      ctx.save();
      ctx.globalAlpha = wa;
      if (full < 1) {
        // the clipped window at half resolution (a full-frame image through an AA clip costs ~0.4 s here)
        const c = scratch('pupilWin', 540, 960);
        const g = fresh(c);
        g.scale(0.5, 0.5);
        g.beginPath();
        g.arc(st.px, st.py, st.rp * (1 + 2.2 * full), 0, Math.PI * 2);
        g.clip();
        g.drawImage(web, 0, 0, 1080, 1920);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(c, 0, 0, 1080, 1920);
      } else ctx.drawImage(web, 0, 0, 1080, 1920);
      ctx.restore();
      // the pupil's rim stays dark a moment longer (depth), then dissolves
      if (full < 1) {
        const g = ctx.createRadialGradient(st.px, st.py, st.rp * 0.7, st.px, st.py, st.rp * 1.02);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${(0.85 * (1 - full)).toFixed(3)})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(st.px, st.py, st.rp * 1.02, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    DEV.mark?.('window', ctx);
    // a faint warm light from the cosmos on the skin (the eye is lit by what it sees)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#8E5BFF', st.px, st.py - 300 * st.S, 900, 0.05 * (1 - wa), 0);
    ctx.restore();
  }
  DEV.mark?.('shot', ctx);
  vignette(ctx, f < HIT.eye ? 0.5 : 0.42);
  DEV.mark?.('vig', ctx);
  // the 2-frame flash at each cut
  const fl = Math.max(flashAt(f, HIT.galaxy), flashAt(f, HIT.cell), flashAt(f, HIT.eye));
  if (fl > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#FFF4E0', 540, 860, 1500, fl, 0.6);
    ctx.restore();
  }
  if (!fontsReady) return;
  drawCap(ctx, P1, f);
  drawCap(ctx, P2, f);
  drawCap(ctx, P3, f);
  drawCap(ctx, C7, f);
  DEV.mark?.('caps', ctx);
}

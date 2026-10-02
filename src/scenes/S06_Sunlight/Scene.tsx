// S06 阳光的账本 / The Sun's Ledger — 582 frames.
// Visual language: double-entry bookkeeping written in light + wave optics. ENERGY = crests; one gold packet
// (20 crests, 0.5 µm) comes in, twenty one-crest red packets (10 µm) go out. Then one direction in / all directions
// out (a parallel gold beam vs. hemispherical half-rings of red wavelets), a dive onto the dusk land (rivers of light),
// and the branching flows of life (leaf veins) that wind into the vortex of S07. See timing.ts for the beat sheet.
//
// Everything (world, bloom, ledger, labels, narration, vignette, the vein network) is composited into ONE canvas —
// no WebGL at all (a GL context + shader compile + readback costs ~300 ms per still):
// every extra full-frame DOM layer — and DOM text with per-glyph CSS blur — costs far more in the software
// compositor than drawing the same pixels ourselves.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { Cam, camAt, worldToScreen } from './camera';
import { CAPTIONS } from './captions';
import { drawDiveClouds, drawEarth, drawLand, earthDisc, landAlpha, worldFade } from './earth';
import { useFontGate } from './fontGate';
import { LEDGER_FONTS, drawLedger, ledgerOn } from './ledger';
import { Layer } from './Layer';
import { drawMotes } from './motes';
import { drawInflow, drawNetwork, drawRiver, drawStreamlines } from './network';
import { P, SUN } from './palette';
import { LABEL_FONTS, drawBeam, drawGhostFans, drawHero, drawIR, drawImpact, drawPhotonLabels, drawRed, drawStreams, irFill, labelsOn } from './photons';
import { captionFonts, capOn, drawCaption } from './RichCaption';
import { drawBackground, drawGoldPoint, drawGrey, drawIgnitionFlare, drawSun, greyOn, sunGeom } from './sky';
import { scratch } from './textures';
import { T } from './timing';
import { drawVeins } from './veins';

/** IR aura strength of the Earth over the scene */
const irGlow = (f: number) => 0.35 * seg(f, T.ledgerIn, T.ledgerIn + 30) + 0.65 * seg(f, T.photonLand, T.photonLand + 30) + 0.6 * seg(f, T.irStart, T.irStart + 40);

/** ground-network visibility during/after the dive */
const netAlpha = (f: number) => clamp((camAt(f).lz - 0.55) / 0.3);
/** rivers of light on the land: from the start of the dive, handing over to the rosette at its end (frame-based) */
const riverAlpha = (f: number, c: Cam) => Math.min(clamp((c.lz - 0.02) / 0.12), 1 - smoothstep(T.diveStart + 38, T.diveStart + 66, f));
/** is (any of) the Sun on screen? */
const sunVisible = (f: number, c: Cam) => {
  const s = sunGeom(f);
  return worldToScreen(c, SUN.cx, s.cy + s.r * 1.6)[1] > -10;
};

/** Draw `fn` into a reusable offscreen canvas at `k` × resolution (logical coordinates), return it. */
function pass(key: string, k: number, fn: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const W = Math.round(1080 * k);
  const H = Math.round(1920 * k);
  const cv = scratch(key, W, H);
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';
  c.clearRect(0, 0, W, H);
  c.setTransform(k, 0, 0, k, 0, 0);
  fn(c);
  return cv;
}

/** the vignette returns with the light (S05 ends with none: equilibrium has no gradients) */
function drawVignette(ctx: CanvasRenderingContext2D, f: number) {
  const s = 0.45 * ease.inOutSine(seg(f, 6, 54));
  if (s <= 0.003) return;
  ctx.save();
  ctx.translate(540, 960);
  ctx.scale(810, 1190);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${s})`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function drawComposite(ctx: CanvasRenderingContext2D, f: number) {
  const c = camAt(f);
  const na = netAlpha(f);
  // background (soft content at half resolution)
  ctx.drawImage(
    pass('bg', 0.5, (b) => {
      drawBackground(b, f, c);
      // the out-of-focus river web behind the rosette leaves before the cut (S07's first frame has none)
      drawRiver(b, f, c, na * 1.6 * (0.55 + 0.45 * smoothstep(470, 510, f)) * (1 - smoothstep(515, 572, f)), 2.4, 'far');
    }),
    0,
    0,
    1080,
    1920,
  );
  // world: the Sun, the Earth (and, during the dive, its land and rivers — clipped to the planet)
  const sunOn = sunVisible(f, c);
  if (sunOn) drawSun(ctx, f, c);
  drawEarth(ctx, f, c, irGlow(f), irFill(f));
  const la = landAlpha(f, c);
  if (la > 0.004) {
    ctx.save();
    ctx.globalAlpha = la;
    ctx.drawImage(
      pass('land', 0.5, (g) => drawLand(g, f, c, 1)),
      0,
      0,
      1080,
      1920,
    );
    ctx.restore();
  }
  const ra = riverAlpha(f, c);
  if (ra > 0.01) {
    ctx.save();
    if (worldFade(f) > 0.001) {
      const [ex, ey, er] = earthDisc(f, c);
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.clip();
    }
    drawRiver(ctx, f, c, ra, 13, 'water');
    ctx.restore();
  }
  drawStreams(ctx, f, c);
  drawBeam(ctx, f, c);
  drawIR(ctx, f, c);
  drawGhostFans(ctx, f, c);
  drawImpact(ctx, f, c);
  drawRed(ctx, f, c);
  drawStreamlines(ctx, f, c);
  drawInflow(ctx, f, c);
  drawVeins(ctx, f, c, na);
  drawNetwork(ctx, f, c, na);
  // the camera passes through a cloud deck during the dive (parallax, in front of the ground)
  drawDiveClouds(ctx, f, c);
  // heat-death grey dissolving grain by grain + the gold point (opening only)
  if (greyOn(f)) {
    drawGrey(ctx, f);
    drawGoldPoint(ctx, f);
  }
  // bloom: emissive elements again at ¼ res, blurred twice, screened
  const gl = pass('glowSrc', 0.25, (g) => {
    if (sunOn) drawSun(g, f, c, true);
    drawStreams(g, f, c, true);
    drawBeam(g, f, c, true);
    drawIR(g, f, c, true);
    drawImpact(g, f, c);
    drawRed(g, f, c, true);
    drawHero(g, f, c, true);
    drawInflow(g, f, c, true);
    drawVeins(g, f, c, na, true);
    drawNetwork(g, f, c, na, true);
    if (ra > 0.01 && worldFade(f) > 0.001) {
      g.save();
      const [ex, ey, er] = earthDisc(f, c);
      g.beginPath();
      g.arc(ex, ey, er, 0, Math.PI * 2);
      g.clip();
      drawRiver(g, f, c, ra * 0.8, 13, 'glow');
      g.restore();
    }
    drawIgnitionFlare(g, f, c);
  });
  const blurred = pass('glowBlur', 0.25, (g) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.filter = 'blur(3px)';
    g.globalAlpha = 0.9;
    g.drawImage(gl, 0, 0);
    g.filter = 'blur(10px)';
    g.globalAlpha = 0.8;
    g.drawImage(gl, 0, 0);
  });
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // no bloom at f0 (S05 match); softer at the end so the whirlpool's eye does not blow out (S07's first frame)
  ctx.globalAlpha = seg(f, 2, 10) * (1 - 0.3 * smoothstep(520, 572, f));
  ctx.drawImage(blurred, 0, 0, 1080, 1920);
  ctx.restore();
  if (f < 60) drawIgnitionFlare(ctx, f, c);
  drawMotes(ctx, f, c);
  drawVignette(ctx, f);
  // ---- text & HUD (needs the font slices of this frame)
  drawLedger(ctx, f);
  drawHero(ctx, f, c);
  drawPhotonLabels(ctx, f, c);
  for (const cap of CAPTIONS) drawCaption(ctx, cap, f);
}

/** the font slices needed at frame f */
function fontsAt(f: number): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (ledgerOn(f)) out.push(...LEDGER_FONTS);
  if (labelsOn(f)) out.push(...LABEL_FONTS);
  for (const cap of CAPTIONS) if (capOn(cap, f)) out.push(...captionFonts(cap));
  return out;
}

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const fontsKey = useFontGate(fontsAt(frame));
  return (
    <AbsoluteFill style={{ background: P.space }}>
      {/* nothing is drawn until this frame's font slices are in (the screenshot waits for them anyway) */}
      <Layer draw={(ctx, { frame: f }) => (fontsKey === null ? undefined : drawComposite(ctx, f))} version={fontsKey === null ? 'wait' : 'ok'} />
    </AbsoluteFill>
  );
};

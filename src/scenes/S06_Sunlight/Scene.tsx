// S06 阳光的账本 / The Sun's Ledger — 582 frames.
// Visual language: double-entry bookkeeping written in light + wave optics. ENERGY = crests; one gold packet
// (20 crests, 0.5 µm) comes in, twenty one-crest red packets (10 µm) go out. Then the spreading (ink rhyme),
// a dive into the Earth, and the branching flows of life (leaf veins) that wind into the vortex of S07.
// See timing.ts for the beat sheet.
//
// Everything (world, bloom, ledger, labels, narration, vignette, the GPU vein layer) is composited into ONE canvas:
// every extra full-frame DOM layer — and DOM text with per-glyph CSS blur — costs far more in the software
// compositor than drawing the same pixels ourselves.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { clamp, ease, seg } from '../../lib/math';
import { camAt } from './camera';
import { CAPTIONS } from './captions';
import { useFontGate } from './fontGate';
import { renderGL } from './glOff';
import { drawHaze } from './haze';
import { LEDGER_FONTS, drawLedger, ledgerOn } from './ledger';
import { Layer } from './Layer';
import { drawMotes } from './motes';
import { drawInflow, drawNetwork, drawRiver, drawStreamlines, netUniforms } from './network';
import { NET_FRAG, netDmax, veinGlowTex, veinTex } from './netGL';
import { P } from './palette';
import { LABEL_FONTS, drawBeam, drawGhostFans, drawHero, drawImpact, drawPhotonLabels, drawRed, drawStreams, labelsOn } from './photons';
import { captionFonts, capOn, drawCaption } from './RichCaption';
import { drawBackground, drawDiveClouds, drawEarth, drawFloodFront, drawGoldPoint, drawGrey, drawIgnitionFlare, drawSun } from './sky';
import { scratch } from './textures';
import { T } from './timing';
import { pEnd, pMark, pStart } from './dev/profmark';

/** IR aura strength of the Earth over the scene */
const irGlow = (f: number) => 0.35 * seg(f, T.ledgerIn, T.ledgerIn + 30) + 0.65 * seg(f, T.photonLand, T.photonLand + 30) + 0.8 * seg(f, T.hazeStart, T.hazeStart + 40);

/** ground-network visibility during/after the dive */
const netAlpha = (f: number) => clamp((camAt(f).lz - 0.55) / 0.3);
const riverAlpha = (f: number) => {
  const c = camAt(f);
  return Math.min(clamp((c.lz - 0.02) / 0.12), 1 - 0.55 * clamp((c.lz - 0.6) / 0.22) - 0.45 * clamp((c.lz - 0.86) / 0.12));
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

function drawComposite(ctx: CanvasRenderingContext2D, f: number, fontsReady: boolean) {
  pStart();
  const c = camAt(f);
  // background (soft content at half resolution)
  ctx.drawImage(
    pass('bg', 0.5, (b) => {
      drawBackground(b, f, c);
      drawRiver(b, f, c, netAlpha(f) * 1.6, 2.4, 'far');
    }),
    0,
    0,
    1080,
    1920,
  );
  pMark('bg');
  // world
  if (c.lz < 0.9) {
    drawSun(ctx, f, c);
    drawEarth(ctx, f, c, irGlow(f));
  }
  if (c.p > 0) {
    // darken the Earth's face into the ground as we dive
    ctx.fillStyle = `rgba(4,5,11,${clamp((c.lz - 0.62) / 0.36)})`;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  pMark('sunEarth');
  drawRiver(ctx, f, c, riverAlpha(f), 13);
  drawStreams(ctx, f, c);
  drawBeam(ctx, f, c);
  drawGhostFans(ctx, f, c);
  drawImpact(ctx, f, c);
  drawRed(ctx, f, c);
  drawStreamlines(ctx, f, c);
  drawInflow(ctx, f, c);
  const na = netAlpha(f);
  if (na > 0.005) {
    ctx.drawImage(renderGL(NET_FRAG, netUniforms(f, c, na, netDmax()), { u_vein: veinTex(), u_glow: veinGlowTex() }), 0, 0, 1080, 1920);
    pMark('gl');
  }
  drawNetwork(ctx, f, c, na);
  pMark('fx');
  // infrared haze (soft)
  drawHaze(ctx, f, c);
  pMark('haze');
  // the camera passes through a cloud deck during the dive (parallax, in front of the ground)
  drawDiveClouds(ctx, f, c);
  // heat-death grey with the colour-flood hole + the gold point (opening only)
  if (f < T.floodEnd + 4)
    ctx.drawImage(
      pass('grey', 0.5, (g) => {
        drawGrey(g, f);
        drawGoldPoint(g, f);
      }),
      0,
      0,
      1080,
      1920,
    );
  drawFloodFront(ctx, f);
  pMark('grey');
  // bloom: emissive elements again at ¼ res, blurred twice, screened
  const gl = pass('glowSrc', 0.25, (g) => {
    if (c.lz < 0.9) drawSun(g, f, c, true);
    drawStreams(g, f, c, true);
    drawBeam(g, f, c, true);
    drawImpact(g, f, c);
    drawRed(g, f, c, true);
    drawHero(g, f, c, true);
    drawInflow(g, f, c, true);
    drawNetwork(g, f, c, na, true);
    drawFloodFront(g, f, 1.6);
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
  ctx.globalAlpha = seg(f, 2, 10);
  ctx.drawImage(blurred, 0, 0, 1080, 1920);
  ctx.restore();
  pMark('bloom');
  if (f < 60) drawIgnitionFlare(ctx, f, c);
  drawMotes(ctx, f, c);
  drawVignette(ctx, f);
  pMark('motes');
  // ---- text & HUD (needs the font slices of this frame)
  if (fontsReady) {
    drawLedger(ctx, f);
    drawHero(ctx, f, c);
    drawPhotonLabels(ctx, f, c);
    for (const cap of CAPTIONS) drawCaption(ctx, cap, f);
  } else drawHero(ctx, f, c);
  pMark('text');
  pEnd(f);
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
      <Layer draw={(ctx, { frame: f }) => drawComposite(ctx, f, fontsKey !== null)} version={fontsKey === null ? 'wait' : 'ok'} />
    </AbsoluteFill>
  );
};

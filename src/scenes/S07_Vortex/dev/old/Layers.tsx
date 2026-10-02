// All raster content of S07 is composited into ONE DOM canvas (each extra full-frame DOM layer — and especially a
// CSS mix-blend-mode layer — costs hundreds of ms in the headless compositor):
//   1. thermal image (360×640 offscreen, upscaled with smoothing — a soft sensor image)
//   2. particles, lines, glows
//   3. bloom: the canvas is downsampled into a 270×480 offscreen copy, blurred (tight + wide), added back once.
// Every 2D context is created with willReadFrequently → Skia CPU raster (the accelerated canvas runs on SwiftShader
// in the headless renderer and is ~10× slower for thousands of thin strokes).
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { LAYERS } from './devflags';
import { offscreen } from './gfx';
import { layerState, renderMain, renderThermal } from './render';
import { drawFootprints } from './thermal';

export const S07Layers: React.FC = () => {
  const f = useCurrentFrame();
  const main = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = main.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const st = layerState(f);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, 1080, 1920);
    // 1. thermal sensor image
    if (st.thermal > 0.001) {
      const [tc, tx] = offscreen('rd-thermal', 360, 640);
      renderThermal(tx, f);
      ctx.save();
      if (st.thermalClipY !== undefined) {
        ctx.beginPath();
        ctx.rect(0, 0, 1080, st.thermalClipY);
        ctx.clip();
      }
      ctx.globalAlpha = st.thermal;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tc, 0, 0, 1080, 1920);
      ctx.restore();
      drawFootprints(ctx, f);
    }
    // 2. particles etc. (the bloom below also catches the thermal image: a mild sensor glow, kept weak there)
    renderMain(ctx, f);
    // 3. bloom
    if (LAYERS.bloom && (st.bloomA > 0 || st.bloomB > 0)) {
      const [bc, bx] = offscreen('rd-bloom', 270, 480);
      const [wc, wx] = offscreen('rd-bloomw', 68, 120);
      bx.setTransform(1, 0, 0, 1, 0, 0);
      bx.globalCompositeOperation = 'copy';
      bx.filter = 'none';
      bx.drawImage(c, 0, 0, 1080, 1920, 0, 0, 270, 480);
      wx.setTransform(1, 0, 0, 1, 0, 0);
      wx.globalCompositeOperation = 'copy';
      wx.filter = 'blur(2px)';
      wx.drawImage(bc, 0, 0, 270, 480, 0, 0, 68, 120);
      wx.filter = 'none';
      bx.filter = 'blur(2.5px)';
      bx.drawImage(bc, 0, 0);
      bx.filter = 'none';
      bx.globalCompositeOperation = 'source-over';
      bx.globalAlpha = 1;
      // wide halo added into the small copy (cheap), then a single full-frame additive pass
      bx.globalCompositeOperation = 'lighter';
      bx.globalAlpha = st.bloomB / Math.max(0.01, st.bloomA);
      bx.imageSmoothingEnabled = true;
      bx.drawImage(wc, 0, 0, 270, 480);
      bx.globalAlpha = 1;
      bx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = st.bloomA;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bc, 0, 0, 1080, 1920);
      ctx.restore();
    }
  });
  return <canvas ref={main} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />;
};

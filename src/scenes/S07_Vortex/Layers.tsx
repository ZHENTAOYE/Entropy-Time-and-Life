// All raster content of S07 is composited into ONE DOM canvas (each extra full-frame DOM layer — and especially a
// CSS mix-blend-mode layer — costs hundreds of ms in the headless compositor):
//   1. particles, lines, glows
//   2. bloom source: the emissive layer is downsampled into a 270×480 offscreen copy, blurred (tight + wide)
//   3. thermal image drawn UNDER it (destination-over): the sensor's calibrated colours are never bloomed
//   4. bloom added back once.
// Every 2D context is created with willReadFrequently → Skia CPU raster (the accelerated canvas runs on SwiftShader
// in the headless renderer and is ~10× slower for thousands of thin strokes).
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { LAYERS } from './devflags';
import { offscreen } from './gfx';
import { layerState, renderMain, renderThermal } from './render';
import { drawFootprints } from './thermal';
import { drawS06Vignette } from './s06';
import { smoothstep } from '../../lib/math';
import { T } from './timing';

export const S07Layers: React.FC = () => {
  const f = useCurrentFrame();
  const main = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = main.current;
    if (!c) return;
    // the thermal phase is a soft sensor image: its raster runs at 0.75 resolution (the end — the footprints for the
    // S08 match cut — at full resolution again)
    const k = LAYERS.scale || (f >= T.scan0 && f < T.tilt2a + 16 ? 0.75 : 1);
    const W = Math.round(1080 * k);
    const H = Math.round(1920 * k);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const st = layerState(f);
    if (!LAYERS.draw) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // 1. particles, lines, glows (additive onto transparent)
    renderMain(ctx, f);
    // 2. bloom source = the emissive layer only (the sensor image must keep its calibrated colours)
    const doBloom = LAYERS.bloom && (st.bloomA > 0 || st.bloomB > 0);
    const [bc, bx] = offscreen('rd-bloom', 270, 480);
    if (doBloom) {
      const [wc, wx] = offscreen('rd-bloomw', 68, 120);
      bx.setTransform(1, 0, 0, 1, 0, 0);
      bx.globalCompositeOperation = 'copy';
      bx.filter = 'none';
      bx.drawImage(c, 0, 0, W, H, 0, 0, 270, 480);
      wx.setTransform(1, 0, 0, 1, 0, 0);
      wx.globalCompositeOperation = 'copy';
      wx.filter = 'blur(2px)';
      wx.drawImage(bc, 0, 0, 270, 480, 0, 0, 68, 120);
      wx.filter = 'none';
      bx.filter = 'blur(2.5px)';
      bx.drawImage(bc, 0, 0);
      bx.filter = 'none';
      // wide halo added into the small copy (cheap), then a single full-frame additive pass
      bx.globalCompositeOperation = 'lighter';
      bx.globalAlpha = st.bloomB / Math.max(0.01, st.bloomA);
      bx.imageSmoothingEnabled = true;
      bx.drawImage(wc, 0, 0, 270, 480);
      bx.globalAlpha = 1;
      bx.globalCompositeOperation = 'source-over';
    }
    // 3. thermal sensor image UNDER the particles (360×640 offscreen, upscaled with smoothing — a soft sensor image)
    if (st.thermal > 0.001) {
      const [tc, tx] = offscreen('rd-thermal', 360, 640);
      renderThermal(tx, f);
      ctx.save();
      if (st.thermalClipY !== undefined) {
        ctx.beginPath();
        ctx.rect(0, 0, 1080, st.thermalClipY);
        ctx.clip();
      }
      ctx.globalCompositeOperation = 'destination-over';
      ctx.globalAlpha = st.thermal;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tc, 0, 0, 1080, 1920);
      ctx.restore();
      drawFootprints(ctx, f);
    }
    // 4. bloom
    if (doBloom) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = st.bloomA;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bc, 0, 0, 1080, 1920);
      ctx.restore();
    }
    // 5. S06's vignette at the cut (S07's own vignette lives in the water shader)
    if (f < 48) drawS06Vignette(ctx, 1 - smoothstep(6, 46, f));
  });
  return <canvas ref={main} width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920 }} />;
};

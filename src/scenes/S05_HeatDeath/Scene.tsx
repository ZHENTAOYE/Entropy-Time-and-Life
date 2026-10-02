// S05 热寂 / Heat Death — 522 frames. See timing.ts for the beat sheet.
// Layers: <CosmicWeb> renders hidden (its canvas is the source image: web + light shells + Hawking light, all of
// which random-walk into grey together); ONE visible canvas composites it with the post treatment, instruments,
// HUD and narration (canvas text: DOM text with per-glyph CSS blur is far too slow in the software compositor).
// Once the cosmos sits at exact equilibrium (f ≥ GREY_FROM) its grey is replicated in JS (≈ 15 ms instead of the
// shader's two random-walk taps per pixel).
import React, { useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../lib/cosmos';
import { Layer } from './Layer';
import { drawShells } from './shells';
import { drawGrey, drawVignette, drawWebPost } from './post';
import { GREY_FROM, vignetteAt, webAt } from './timing';
import { useFontGate } from './fontGate';
import { FONT_SPECS } from './fonts';
import { drawHistogram, drawLoupe } from './instruments';
import { drawCounters, drawGauge, drawReticles, drawTimecode } from './hud';
import { drawLockup } from './lockup';
import { drawCaptions } from './captions';
import { drawGold } from './gold';

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const wrap = useRef<HTMLDivElement>(null);
  const fontsReady = useFontGate(FONT_SPECS);
  const useWeb = frame < GREY_FROM;
  // the web element is memoised per frame: the font gate's re-render must not make <CosmicWeb> (whose layout effect
  // has no deps) draw the whole cosmos a second time
  const web = useMemo(
    () =>
      useWeb ? (
        <div ref={wrap} style={{ display: 'none' }}>
          <CosmicWeb {...webAt(frame)} draw={(ctx, info) => drawShells(ctx, info, frame)} />
        </div>
      ) : null,
    [frame, useWeb],
  );
  const draw = (ctx: CanvasRenderingContext2D, f: number) => {
    // nothing is captured before the fonts are ready (the gate holds the frame), so don't composite twice
    if (!fontsReady) return;
    const src = useWeb ? wrap.current?.querySelector('canvas') ?? null : null;
    if (src) drawWebPost(ctx, src, f);
    else drawGrey(ctx, f);
    drawVignette(ctx, vignetteAt(f));
    drawHistogram(ctx, f, src);
    drawLoupe(ctx, f);
    drawReticles(ctx, f);
    drawLockup(ctx, f);
    drawTimecode(ctx, f);
    drawCounters(ctx, f);
    drawGauge(ctx, f);
    drawCaptions(ctx, f);
    drawGold(ctx, f);
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {web}
      <Layer draw={draw} version={fontsReady ? 'f' : 'w'} />
    </AbsoluteFill>
  );
};

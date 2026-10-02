// S09 墨的形状 / The Shape of Ink — FINALE (848 f). See timing.ts for the beat sheet.
import React, { useRef } from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../lib/cosmos';
import { Layer } from './canvas';
import { fontSpecsAt, useFontGate } from './fonts';
import { drawPullback, pullbackWeb, pullbackWebOn } from './pullback';
import { EYE, PB_END } from './timing';
import { drawMiddle, skyWeb, skyWebOn } from './middle';
import { InkPart, invertAt } from './InkPart';
import { END, INV } from './timing';

export const Scene: React.FC = () => {
  const f = useCurrentFrame();
  const fontsReady = useFontGate(fontSpecsAt(f));
  const wrap = useRef<HTMLDivElement>(null);
  const webSrc = () => (wrap.current?.querySelector('canvas') as HTMLCanvasElement | null) ?? null;
  // Nothing is drawn until the font slices are in (the frame is held by delayRender meanwhile): drawing the whole
  // frame once without text and again with it would double the cost of every cold frame.
  if (!fontsReady) return <AbsoluteFill style={{ background: '#000' }} />;

  if (f < PB_END) {
    const webOn = pullbackWebOn(f);
    const wp = webOn ? pullbackWeb(f) : null;
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        {wp ? (
          <div ref={wrap} style={{ display: 'none' }}>
            <CosmicWeb {...wp} scale={0.35} overlayScale={0.5} flares={{ spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 }} />
          </div>
        ) : null}
        <Layer draw={(ctx, fr) => drawPullback(ctx, fr, webOn ? webSrc() : null, fontsReady)} version={fontsReady ? 'f' : 'w'} />
      </AbsoluteFill>
    );
  }
  if (f < EYE.end) {
    const webOn = skyWebOn(f);
    const wp = webOn ? skyWeb(f) : null;
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        {wp ? (
          <div ref={wrap} style={{ display: 'none' }}>
            <CosmicWeb {...wp} scale={0.4} overlayScale={0.5} />
          </div>
        ) : null}
        <Layer draw={(ctx, fr) => drawMiddle(ctx, fr, webOn ? webSrc() : null, fontsReady)} version={fontsReady ? 'f' : 'w'} />
      </AbsoluteFill>
    );
  }
  if (f < END.black) {
    const webOn = f < INV.handover + 28;
    const wp = webOn ? { ...skyWeb(f), invert: invertAt(f) } : null;
    return (
      <AbsoluteFill style={{ background: '#000' }}>
        {wp ? (
          <div ref={wrap} style={{ display: 'none' }}>
            <CosmicWeb {...wp} scale={0.4} overlayScale={0.5} />
          </div>
        ) : null}
        <InkPart f={f} web={webSrc} fontsReady={fontsReady} />
      </AbsoluteFill>
    );
  }
  // B8: pure black (the film may loop to S01's cold open)
  return <AbsoluteFill style={{ background: '#000' }} />;
};

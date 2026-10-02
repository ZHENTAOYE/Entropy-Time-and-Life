// S09 dev probe 3 (NOT part of the film): bisect the slow still.
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { pullbackWeb, pcam, mwT } from '../pullback';
import { drawMilkyWay, drawLocalGroup, drawGalaxyField, drawStars } from '../space';
import { drawEarth } from '../earth';
import { drawStreets, metroRaster } from '../city';

const P: React.FC = () => {
  const f = useCurrentFrame();
  const wp = pullbackWeb(170);
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const mode = f % 9;
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d', { willReadFrequently: true })!;
    const c = wrap.current?.querySelector('canvas');
    if (c) ctx.drawImage(c, 0, 0, 1080, 1920);
    const cam = pcam(170);
    if (mode === 1) drawGalaxyField(ctx, cam, mwT(170), 1);
    if (mode === 2) drawLocalGroup(ctx, cam, mwT(170), 1);
    if (mode === 3) drawMilkyWay(ctx, cam, mwT(170), 1);
    if (mode === 4) drawStars(ctx, cam, 5, 1);
    if (mode === 5) drawEarth(ctx, cam, 1, 1, 0);
    if (mode === 6) metroRaster();
    if (mode === 7) drawStreets(ctx, cam, 5, 1, 1);
  });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {mode < 8 ? (
        <div ref={wrap} style={{ display: 'none' }}>
          <CosmicWeb {...wp} flares={{ spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 }} />
        </div>
      ) : null}
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="P" component={P} durationInFrames={9} fps={30} width={1080} height={1920} />);

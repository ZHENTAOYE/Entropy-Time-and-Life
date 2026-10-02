// S09 dev probe 2 (NOT part of the film): which CosmicWeb usage is slow?
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { pullbackWeb } from '../pullback';

const P: React.FC = () => {
  const f = useCurrentFrame();
  const wp = pullbackWeb(170);
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = wrap.current?.querySelector('canvas');
    const x = ref.current?.getContext('2d', { willReadFrequently: true });
    if (c && x) x.drawImage(c, 0, 0, 1080, 1920);
  });
  const mode = f % 4;
  const fl = mode === 2 ? undefined : { spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {mode === 0 ? <CosmicWeb {...wp} flares={fl} /> : null}
      {mode >= 1 ? (
        <div ref={wrap} style={{ display: mode === 3 ? 'block' : 'none', position: 'absolute', inset: 0, opacity: mode === 3 ? 0 : 1 }}>
          <CosmicWeb {...wp} flares={fl} />
        </div>
      ) : null}
      {mode >= 1 ? <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} /> : null}
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="P" component={P} durationInFrames={8} fps={30} width={1080} height={1920} />);

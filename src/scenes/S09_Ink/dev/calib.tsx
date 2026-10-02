// S09 dev (NOT part of the film): live inverted web (left half) vs the ink field at τ = 0 (right half).
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { SNAP_F, SNAP_PARAMS, drawInkField } from '../inkfield';

const Calib: React.FC = () => {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#F1EADB';
    ctx.fillRect(0, 0, 1080, 1920);
    drawInkField(ctx, SNAP_F, 1);
    const src = wrap.current?.querySelector('canvas');
    if (src) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 540, 1920);
      ctx.clip();
      ctx.drawImage(src, 0, 0, 1080, 1920);
      ctx.restore();
    }
    ctx.fillStyle = '#f00';
    ctx.fillRect(539, 0, 2, 1920);
  });
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <div ref={wrap} style={{ display: 'none' }}>
        <CosmicWeb {...SNAP_PARAMS} scale={0.4} overlayScale={0.5} />
      </div>
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Calib" component={Calib} durationInFrames={1} fps={30} width={1080} height={1920} />);

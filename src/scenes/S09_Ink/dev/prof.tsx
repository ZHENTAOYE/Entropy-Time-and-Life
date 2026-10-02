// DEV ONLY (deleted before hand-off): S09 with profiling marks logged to the browser console.
import React from 'react';
import { Composition, getInputProps, registerRoot } from 'remotion';
import { Scene } from '../Scene';
import { SceneFrame } from '../../../lib/SceneFrame';
import { DEV } from '../dev';

let last = 0;
const ip = getInputProps() as { skip?: string[] };
for (const k of ip.skip ?? []) DEV.skip.add(k);
const t0 = { v: 0 };
DEV.mark = (label: string, ctx: CanvasRenderingContext2D) => {
  ctx.getImageData(0, 0, 1, 1); // force rasterisation
  const t = performance.now();
  console.log(`[mark] ${label} ${(t - last).toFixed(1)}`);
  last = t;
};
DEV.tick = (label: string) => {
  const t = performance.now();
  console.log(`[tick] ${label} ${(t - last).toFixed(1)}`);
  last = t;
};
const Wrap: React.FC = () => {
  last = performance.now();
  t0.v = last;
  return (
    <SceneFrame>
      <Scene />
    </SceneFrame>
  );
};
registerRoot(() => <Composition id="S09prof" component={Wrap} durationInFrames={848} fps={30} width={1080} height={1920} />);

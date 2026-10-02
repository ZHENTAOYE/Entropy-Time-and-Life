// S09 dev profiler (NOT part of the film): the real frame, with a forced canvas flush after each part so the
// deferred rasterisation is attributed to the right step. Prints the timings onto the frame (top-left).
//   node scripts/stills.mjs scratch:src/scenes/S09_Ink/dev/prof.tsx --comp Prof --frames 30,170 --scale 0.5 --out out/stills/S09_prof
import React, { useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { Scene } from '../Scene';
import { DEV } from '../dev';

const lines: string[] = [];
let last = 0;
DEV.mark = (label, ctx) => {
  ctx.getImageData(0, 0, 1, 1);
  const now = performance.now();
  lines.push(`${label} ${(now - last).toFixed(0)}`);
  last = now;
};
const Prof: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLPreElement>(null);
  lines.length = 0;
  last = performance.now();
  React.useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = `f${f}\n` + lines.join('\n');
  });
  return (
    <AbsoluteFill>
      <Scene />
      <pre ref={ref} style={{ position: 'absolute', left: 30, top: 30, color: '#0f0', fontSize: 34, background: 'rgba(0,0,0,0.7)' }} />
    </AbsoluteFill>
  );
};
const ProfSkip: React.FC = () => {
  DEV.skip = new Set(['vig', 'caps', 'hud', 'post', 'marker']);
  return <Prof />;
};
registerRoot(() => (
  <>
    <Composition id="Prof" component={Prof} durationInFrames={848} fps={30} width={1080} height={1920} />
    <Composition id="ProfSkip" component={ProfSkip} durationInFrames={848} fps={30} width={1080} height={1920} />
  </>
));

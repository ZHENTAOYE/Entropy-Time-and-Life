// Dev-only: in-page cost of the real Scene (render → last layout effect), cold then warm, at a scene frame.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, Sequence, registerRoot, useCurrentFrame } from 'remotion';
import { Scene } from '../Scene';

const FRAMES = [40, 150, 200, 230, 280, 320, 470];
const times: number[] = [];
let t0 = 0;
const Start: React.FC = () => {
  t0 = performance.now();
  return null;
};
const End: React.FC<{ label: string }> = ({ label }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    times.push(performance.now() - t0);
    if (ref.current) ref.current.innerText = `${label}: commits ${times.map((t) => t.toFixed(0)).join(' / ')} ms`;
  });
  return <div ref={ref} style={{ position: 'absolute', left: 20, top: 1800, color: '#ff0', fontSize: 34, fontFamily: 'monospace', background: '#000' }} />;
};
const B: React.FC = () => {
  const bf = useCurrentFrame();
  const f = FRAMES[bf % FRAMES.length];
  return (
    <>
      <Start />
      <Sequence from={-f} layout="none">
        <Scene />
      </Sequence>
      <End label={`f${f}`} />
    </>
  );
};
registerRoot(() => <Composition id="B" component={B} durationInFrames={7} fps={30} width={1080} height={1920} />);

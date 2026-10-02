// Dev-only: WARM in-page cost of the real Scene (as in a render, where a tab renders many frames): mounts the scene at
// a base frame (cold), then steps through the next frames in the same page and records each commit.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Composition, Sequence, continueRender, delayRender, registerRoot, useCurrentFrame } from 'remotion';
import { Scene } from '../Scene';

const FR = [20, 60, 96, 140, 206, 236, 300, 470];
const STEPS = 4;
const W: React.FC = () => {
  const bf = useCurrentFrame();
  const base = FR[bf % FR.length];
  const [k, setK] = useState(0);
  const [handle] = useState(() => delayRender('warm'));
  const log = useRef<string[]>([]);
  const t0 = useRef(0);
  const out = useRef<HTMLDivElement>(null);
  t0.current = performance.now();
  useLayoutEffect(() => {
    // force the deferred rasterisation of every canvas now, so the number includes it (as a render's paint would)
    for (const c of Array.from(document.querySelectorAll('canvas'))) c.getContext('2d')?.getImageData(0, 0, 1, 1);
    log.current.push(`${base + k}:${(performance.now() - t0.current).toFixed(0)}`);
    if (out.current) out.current.innerText = log.current.join(' ');
  });
  useEffect(() => {
    const id = setTimeout(() => {
      if (k < STEPS) setK(k + 1);
      else continueRender(handle);
    }, 400);
    return () => clearTimeout(id);
  }, [k, handle]);
  return (
    <>
      <Sequence from={bf - (base + k)} layout="none">
        <Scene />
      </Sequence>
      <div ref={out} style={{ position: 'absolute', left: 10, top: 1820, color: '#ff0', fontSize: 22, fontFamily: 'monospace', background: '#000' }} />
    </>
  );
};
registerRoot(() => <Composition id="W" component={W} durationInFrames={8} fps={30} width={1080} height={1920} />);

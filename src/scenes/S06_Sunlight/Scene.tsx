// S06 阳光的账本 / The Sun's Ledger — 582 frames.
// Visual language: double-entry bookkeeping written in light + wave optics. ENERGY = crests; one gold packet
// (20 crests, 0.5 µm) comes in, twenty one-crest red packets (10 µm) go out. Then one direction in / all directions
// out (a parallel gold beam vs. hemispherical half-rings of red wavelets, the sky filling with infrared like ink), a
// dive onto the dusk land (rivers of light), and the branching flows of life (leaf veins) that wind into the vortex
// of S07. Beat sheet: timing.ts. Compositor: composite.ts (one canvas, no WebGL).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { drawComposite, fontsAt } from './composite';
import { useFontGate } from './fontGate';
import { Layer } from './Layer';
import { P } from './palette';

export const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const fontsKey = useFontGate(fontsAt(frame));
  return (
    <AbsoluteFill style={{ background: P.space }}>
      {/* nothing is drawn until this frame's font slices are in (the screenshot waits for them anyway) */}
      <Layer draw={(ctx, { frame: f }) => (fontsKey === null ? undefined : drawComposite(ctx, f))} version={fontsKey === null ? 'wait' : 'ok'} />
    </AbsoluteFill>
  );
};

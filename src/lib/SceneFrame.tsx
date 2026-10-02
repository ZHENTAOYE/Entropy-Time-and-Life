import React from 'react';
import { AbsoluteFill } from 'remotion';
import { FilmGrain } from './overlays';

/** Global finishing layer used both in the full film and in per-scene previews (so previews match the final). */
export const SceneFrame: React.FC<{ children: React.ReactNode; grain?: number }> = ({ children, grain = 0.06 }) => (
  <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
    {children}
    <FilmGrain opacity={grain} />
  </AbsoluteFill>
);

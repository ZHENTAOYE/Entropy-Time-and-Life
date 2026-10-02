import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Caption } from '../../lib/Caption';

// S06 阳光的账本 — placeholder, to be implemented.
export const Scene: React.FC = () => (
  <AbsoluteFill style={{ background: '#05060a' }}>
    <Caption text="S06 · 阳光的账本" from={0} dur={9999} y={960} size={80} exit="none" />
  </AbsoluteFill>
);

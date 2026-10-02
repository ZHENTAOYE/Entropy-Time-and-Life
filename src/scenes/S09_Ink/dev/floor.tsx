// DEV ONLY (deleted before hand-off): an empty composition with the film's finishing layers, to measure the
// per-still floor of scripts/stills.mjs.
import React from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';

const Empty: React.FC = () => (
  <SceneFrame>
    <AbsoluteFill style={{ background: '#000' }} />
  </SceneFrame>
);
registerRoot(() => <Composition id="Floor" component={Empty} durationInFrames={30} fps={30} width={1080} height={1920} />);

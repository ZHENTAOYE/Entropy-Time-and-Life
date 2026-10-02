// dev-only: an empty 1080×1920 composition — measures the per-still overhead (page load + screenshot) of stills.mjs
import React from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';
import { SceneFrame } from '../../../../lib/SceneFrame';
const Empty: React.FC = () => (
  <SceneFrame>
    <AbsoluteFill style={{ background: '#04050B' }} />
  </SceneFrame>
);
registerRoot(() => <Composition id="S06" component={Empty} durationInFrames={582} fps={30} width={1080} height={1920} />);

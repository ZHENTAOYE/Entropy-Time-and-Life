// S04 dev bench (not part of the film): frame 0 = empty, 1 = bare WEB_FINAL, 2.. = scene frames (frozen).
import React from 'react';
import { AbsoluteFill, Composition, Freeze, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';
import { CosmicWeb, WEB_FINAL } from '../../../lib/cosmos';
import { Scene } from '../Scene';

const F = [205, 470, 572, 648, 700, 760, 100, 300];
const Bench: React.FC = () => {
  const f = useCurrentFrame();
  const k = f % (F.length + 2);
  return (
    <SceneFrame>
      {k === 0 ? <AbsoluteFill style={{ background: '#000' }} /> : k === 1 ? <CosmicWeb {...WEB_FINAL} /> : (
        <Freeze frame={F[k - 2]}>
          <Scene />
        </Freeze>
      )}
    </SceneFrame>
  );
};
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={(F.length + 2) * 2} fps={30} width={1080} height={1920} />);

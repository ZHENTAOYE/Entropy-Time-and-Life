// S04 dev bench (not part of the film; never imported by Scene.tsx). Each frame renders one case in a fresh tab
// (stills.mjs): 0 = empty page, 1 = bare WEB_FINAL, 2 = the Scene before its first frame (fonts + DOM, no content),
// 3.. = scene frames frozen (F list). The composition is 960 frames long: Freeze clamps to the duration.
import React from 'react';
import { AbsoluteFill, Composition, Freeze, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';
import { CosmicWeb, WEB_FINAL } from '../../../lib/cosmos';
import { Scene } from '../Scene';

const F = [90, 160, 180, 240, 380, 400, 450, 540, 650, 744, 900, 953];
const N = F.length + 3;
const Bench: React.FC = () => {
  const f = useCurrentFrame();
  const k = f % N;
  return (
    <SceneFrame>
      {k === 0 ? (
        <AbsoluteFill style={{ background: '#000' }} />
      ) : k === 1 ? (
        <CosmicWeb {...WEB_FINAL} />
      ) : k === 2 ? (
        <Freeze frame={-1000}>
          <Scene />
        </Freeze>
      ) : (
        <Freeze frame={F[k - 3]}>
          <Scene />
        </Freeze>
      )}
    </SceneFrame>
  );
};
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={960} fps={30} width={1080} height={1920} />);

import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';
import { FPS, HEIGHT, SCENES, TOTAL_FRAMES, WIDTH } from './timeline';
import { SCENE_COMPONENTS } from './scenes';
import { SceneFrame } from './lib/SceneFrame';

export const Root: React.FC = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ withAudio: true }} />
    {SCENES.map((s) => {
      const C = SCENE_COMPONENTS[s.id];
      const Wrapped: React.FC = () => (
        <SceneFrame>
          <C />
        </SceneFrame>
      );
      return <Composition key={s.id} id={s.id} component={Wrapped} durationInFrames={s.durationInFrames} fps={FPS} width={WIDTH} height={HEIGHT} />;
    })}
  </>
);

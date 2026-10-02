import React from 'react';
import { AbsoluteFill, Sequence, staticFile, Audio } from 'remotion';
import { SCENES, sceneStarts } from './timeline';
import { SCENE_COMPONENTS } from './scenes';
import { SceneFrame } from './lib/SceneFrame';
import { SCORE_FILE } from './audio';

export const Main: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const hasScore = withAudio && SCORE_FILE !== null;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <SceneFrame>
        {SCENES.map((s) => {
          const C = SCENE_COMPONENTS[s.id];
          return (
            <Sequence key={s.id} from={sceneStarts[s.id]} durationInFrames={s.durationInFrames} name={`${s.id} ${s.title}`}>
              <C />
            </Sequence>
          );
        })}
      </SceneFrame>
      {hasScore ? <Audio src={staticFile(SCORE_FILE as string)} /> : null}
    </AbsoluteFill>
  );
};

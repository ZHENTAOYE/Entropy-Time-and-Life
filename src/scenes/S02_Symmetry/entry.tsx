// Isolated preview entry for S02 (bundles ONLY this scene, so other scenes' errors can't break it).
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Scene } from './Scene';
import { SceneFrame } from '../../lib/SceneFrame';
import { FPS, HEIGHT, SCENES, WIDTH } from '../../timeline';

const def = SCENES.find((s) => s.id === 'S02')!;
const Preview: React.FC = () => (
  <SceneFrame>
    <Scene />
  </SceneFrame>
);
registerRoot(() => (
  <Composition id="S02" component={Preview} durationInFrames={def.durationInFrames} fps={FPS} width={WIDTH} height={HEIGHT} />
));

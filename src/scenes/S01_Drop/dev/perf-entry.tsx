// Dev-only: perf variants of S01 (node scripts/stills.mjs scratch:src/scenes/S01_Drop/dev/perf-entry.tsx --comp Vfull ...)
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Scene } from '../Scene';
import { SceneFrame } from '../../../lib/SceneFrame';
import type { DevFlags } from '../Scene';

const V: Record<string, DevFlags> = {
  Vfull: {},
  VnoTamper: { noTamper: true },
  VnoText: { noText: true },
  VnoHud: { noHud: true },
  VinkOnly: { noTamper: true, noText: true, noHud: true, noFx: true },
};
registerRoot(() => (
  <>
    {Object.entries(V).map(([id, flags]) => (
      <Composition key={id} id={id} component={() => (<SceneFrame><Scene dev={flags} /></SceneFrame>)} durationInFrames={390} fps={30} width={1080} height={1920} />
    ))}
  </>
));

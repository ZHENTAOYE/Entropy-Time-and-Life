// Dev-only: render the scene with individual layer groups switched off (profiling).
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Scene } from '../Scene';
import { SceneFrame } from '../../../lib/SceneFrame';
import { LAYERS } from '../devflags';

const mk = (off: Partial<typeof LAYERS>): React.FC => () => {
  Object.assign(LAYERS, { water: true, raster: true, bloom: true, captions: true, hud: true, hudThermal: true, cards: true }, off);
  return <SceneFrame><Scene /></SceneFrame>;
};
const comps: Record<string, React.FC> = {
  All: mk({}),
  NoRaster: mk({ raster: false }),
  NoBloom: mk({ bloom: false }),
  NoText: mk({ captions: false, hud: false, hudThermal: false }),
  Bare: mk({ raster: false, captions: false, hud: false, hudThermal: false, water: false }),
};
registerRoot(() => <>{Object.entries(comps).map(([id, C]) => <Composition key={id} id={id} component={C} durationInFrames={900} fps={30} width={1080} height={1920} />)}</>);

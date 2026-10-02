import React from 'react';
import { Scene as S01 } from './S01_Drop/Scene';
import { Scene as S02 } from './S02_Symmetry/Scene';
import { Scene as S03 } from './S03_Counting/Scene';
import { Scene as S04 } from './S04_Arrow/Scene';
import { Scene as S05 } from './S05_HeatDeath/Scene';
import { Scene as S06 } from './S06_Sunlight/Scene';
import { Scene as S07 } from './S07_Vortex/Scene';
import { Scene as S08 } from './S08_Memory/Scene';
import { Scene as S09 } from './S09_Ink/Scene';

export const SCENE_COMPONENTS: Record<string, React.FC> = {
  S01,
  S02,
  S03,
  S04,
  S05,
  S06,
  S07,
  S08,
  S09,
};

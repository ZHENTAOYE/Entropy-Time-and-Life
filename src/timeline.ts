// Single source of truth for scene order & durations (frames @ 30 fps).
// scripts/score.py reads this file (via scripts/export-timeline.mjs) to place sound cues.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export interface SceneDef {
  id: string;
  dir: string;
  title: string;
  durationInFrames: number;
}

export const SCENES: SceneDef[] = [
  { id: 'S01', dir: 'S01_Drop', title: '墨滴', durationInFrames: 390 },
  { id: 'S02', dir: 'S02_Symmetry', title: '对称', durationInFrames: 522 },
  { id: 'S03', dir: 'S03_Counting', title: '数一数', durationInFrames: 1092 },
  { id: 'S04', dir: 'S04_Arrow', title: '时间之箭', durationInFrames: 954 },
  { id: 'S05', dir: 'S05_HeatDeath', title: '热寂', durationInFrames: 522 },
  { id: 'S06', dir: 'S06_Sunlight', title: '阳光的账本', durationInFrames: 582 },
  { id: 'S07', dir: 'S07_Vortex', title: '涡旋', durationInFrames: 900 },
  { id: 'S08', dir: 'S08_Memory', title: '记忆', durationInFrames: 570 },
  { id: 'S09', dir: 'S09_Ink', title: '墨的形状', durationInFrames: 848 },
];

export const sceneStarts = (() => {
  const out: Record<string, number> = {};
  let t = 0;
  for (const s of SCENES) {
    out[s.id] = t;
    t += s.durationInFrames;
  }
  return out;
})();

export const TOTAL_FRAMES = SCENES.reduce((a, s) => a + s.durationInFrames, 0);

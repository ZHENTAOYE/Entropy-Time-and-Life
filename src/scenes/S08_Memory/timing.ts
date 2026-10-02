// S08 — narration & HUD timing (scene-local frames), shared by Scene.tsx and cues.ts.
/** [from, dur] of each narration card */
export const CAP = {
  c1: [4, 146],
  c3: [178, 74],
  c4: [252, 90],
  c5: [342, 74],
  c6: [416, 129],
} as const;
/** the f478 pulse (and its +7 tap) launches the 回声 echo copies; fainter again on the next pulse */
export const ECHO_F = 478;
/** ◀◀ rewind attempt [start, fail] */
export const REWIND: readonly [number, number] = [310, 330];

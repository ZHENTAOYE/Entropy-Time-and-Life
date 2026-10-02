// S01 sound cues (scene-local frames) for scripts/audio/score.py. `kind` keywords follow score.py's cue_sound():
// tick/click/type -> tick · impact/stamp -> impact · drop/plop/splash -> water drop · whoosh/sweep -> whoosh ·
// glitch/rewind -> glitch · flash/spark/shimmer -> high bell · reveal/chime -> bell. Frames of the ink events come
// from the shared ink model through this scene's tape remap (timeline.ts): un-splits f31–33 / f51–53 (rewind),
// leap f72, clunk f90, impact f126, Widnall split f186–188, second split f222–227.
export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

export const CUES: Cue[] = [
  { frame: 0, kind: 'rewind', description: 'COLD OPEN: tape engages mid-rewind (V-hold roll f0–3); reversed-reverb inhale + falling Shepard whir runs to f72', intensity: 0.75 },
  { frame: 9, kind: 'glitch', description: '「这是倒放。」 condenses; 倒放 glitch burst on arrival (more short bursts until f90)', intensity: 0.45 },
  { frame: 27, kind: 'reveal', description: 'line 2 「你一眼就知道。」 enters (soft)', intensity: 0.15 },
  { frame: 31, kind: 'shimmer', description: 'rewind: the 12 grand-lobes fold back into 4 (reversed sparkle)', intensity: 0.35 },
  { frame: 51, kind: 'shimmer', description: 'rewind: the 4 lobes merge back into one vortex ring (reversed sparkle)', intensity: 0.45 },
  { frame: 72, kind: 'drop', description: 'REVERSED PLOP: swell peaks exactly as the ink, re-gathered into a drop, leaps out of the water', intensity: 0.85 },
  { frame: 74, kind: 'sweep', description: 'tape-stop: playback decelerates to zero, pitch dives (the drop decelerates toward its apex)', intensity: 0.4 },
  { frame: 90, kind: 'impact', description: 'TAPE-STOP CLUNK at the apex: vertical roll, ◀◀ → ▶, artefacts snap off', intensity: 0.85 },
  { frame: 91, kind: 'silence', description: 'total silence: the drop hangs above a perfectly still surface (to ~f106)', intensity: 0 },
  { frame: 100, kind: 'whoosh', description: 'tape spin-up (very low, rising) as ▶ speeds from ×0 to ×1.4; the drop starts to fall', intensity: 0.2 },
  { frame: 126, kind: 'drop', description: 'IMPACT PLOP (slowed ×0.25: deep, long) + camera shake; flash', intensity: 1.0 },
  { frame: 127, kind: 'flash', description: 'impact flash / anamorphic streak; crown jets and micro-spray glitter (to ~f150)', intensity: 0.35 },
  { frame: 148, kind: 'whoosh', description: 'speed ramp up and pull-out reveal of the vortex ring on its stem (f146–196)', intensity: 0.3 },
  { frame: 162, kind: 'reveal', description: 'card 4 「现实里，没人见过它自己聚回来。」 condenses (soft)', intensity: 0.12 },
  { frame: 187, kind: 'chime', description: 'first Widnall split: the ring breaks into 4 lobes', intensity: 0.4 },
  { frame: 224, kind: 'shimmer', description: 'second split: each lobe into 3 (the ink chandelier)', intensity: 0.35 },
  { frame: 264, kind: 'swell', description: 'the bloom breathes alone: long swell to the cut (camera leans in, light blooms up)', intensity: 0.6 },
  { frame: 329, kind: 'swell peak', description: 'peak of the swell on the brightest frame', intensity: 0.95 },
  { frame: 330, kind: 'silence', description: 'HARD CUT to black: all sound cuts to room tone', intensity: 0 },
  { frame: 331, kind: 'silence', description: '「为什么？」 fades in over room tone (no hit)', intensity: 0.05 },
  { frame: 360, kind: 'shimmer', description: '为什么 diffuses into grains (very faint granular hiss, f360–384)', intensity: 0.12 },
  { frame: 384, kind: 'silence', description: 'only the dot of 「？」 remains at Q_DOT (→ S02)', intensity: 0 },
];

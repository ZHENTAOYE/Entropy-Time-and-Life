// S01 sound cues (scene-local frames) for scripts/audio/score.py. `kind` keywords follow score.py's cue_sound():
// tick/click/type -> tick · impact/stamp -> impact · drop/plop/splash -> water drop · whoosh/sweep -> whoosh ·
// glitch/rewind -> glitch · flash/spark/shimmer -> high bell · reveal/chime -> bell. Kinds the S01 bed owns (rewind,
// drop, impact, sweep, swell) are already designed into bed_S01 (leap f52, clunk f72, impact f126).
// Frames of the ink events come from the shared ink model through this scene's tape remap (timeline.ts): the
// grand-lobes un-split f4–7, the 4 lobes merge f19–20, the Worthington jet rises and retracts f31–42, the crown
// closes f38–52, the drop leaves the water at f52.5; forward: impact f126, Widnall split f186–188, second split
// f222–227. The V-hold jumps of the rewind are hash-chosen frames (timeline.ts vholdJump, f2–35).
import { vholdJump } from './timeline';

export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

const VHOLD_JUMPS = Array.from({ length: 36 }, (_, f) => f).filter((f) => vholdJump(f) !== 0);

export const CUES: Cue[] = [
  { frame: 0, kind: 'rewind', description: 'COLD OPEN, loud on frame 0: transport thunk + VHS rewind whine + reversed roar, rising into the leap at f52', intensity: 0.9 },
  { frame: 0, kind: 'glitch', description: 'cover frame: two scan tears, ◀◀ ×16 OSD; the tape shrieks into the violent rewind (×16 → ×24)', intensity: 0.5 },
  ...VHOLD_JUMPS.map((frame) => ({ frame, kind: 'glitch', description: 'rewind: vertical-hold jump / tracking skew (picture slips, tears)', intensity: 0.25 })),
  { frame: 5, kind: 'shimmer', description: 'rewind: the 12 grand-lobes fold back into 4 (reversed sparkle, f4–7)', intensity: 0.35 },
  { frame: 20, kind: 'shimmer', description: 'rewind: the 4 lobes merge back into one vortex ring (reversed sparkle, f19–20)', intensity: 0.45 },
  { frame: 22, kind: 'whoosh', description: 'whip tilt up the stem to the surface, pushing in (f20–46)', intensity: 0.35 },
  { frame: 31, kind: 'spark reversed', description: 'rewind: the Worthington jet rises out of the crater and retracts (f31–42); ripples run INWARD', intensity: 0.3 },
  { frame: 38, kind: 'shimmer', description: '「你永远不会看到这一幕。」 diffuses (f38–48, granular hiss) while the crown begins to close', intensity: 0.15 },
  { frame: 42, kind: 'flash', description: 'reversed impact flash gathers into the crater (f42–52, snaps off as the drop leaves)', intensity: 0.4 },
  { frame: 50, kind: 'reveal', description: '「可物理定律，并不禁止它。」 condenses (f50–58, crisp from f58)', intensity: 0.2 },
  { frame: 52, kind: 'drop', description: 'REVERSED PLOP: the crown has closed, the ink re-gathered into a drop LEAPS OUT of the water (contact at f52.5)', intensity: 0.9 },
  { frame: 53, kind: 'whoosh', description: 'punch-in with the drop as it leaps at the lens (f53–57), motion-blurred, strobe ghosts', intensity: 0.4 },
  { frame: 54, kind: 'sweep', description: 'tape decelerates to zero, pitch dives; the drop decelerates toward its apex (f53–72)', intensity: 0.4 },
  { frame: 72, kind: 'impact', description: 'TAPE-STOP CLUNK at the apex: vertical roll, ◀◀ → ▶ ×0.00, artefacts snap off', intensity: 0.85 },
  { frame: 73, kind: 'silence', description: 'held breath: the drop hangs above a perfectly still surface (macro still life, to ~f100)', intensity: 0 },
  { frame: 90, kind: 'tape-stop', description: 'tape motor starts again (very low; ▶ ×0.00 → ×0.11 by f100, the drop barely moves until ~f108)', intensity: 0.1 },
  { frame: 100, kind: 'whoosh', description: 'the drop falls; fall whistle into the impact, the camera pulls back (f100–121)', intensity: 0.25 },
  { frame: 112, kind: 'shimmer', description: '「可物理定律，并不禁止它。」 diffuses (f112–124)', intensity: 0.12 },
  { frame: 126, kind: 'drop', description: 'IMPACT PLOP (slowed ×0.25: deep, long) + camera shake; flash', intensity: 1.0 },
  { frame: 127, kind: 'flash', description: 'impact flash / anamorphic streak; crown jets and micro-spray glitter (to ~f150)', intensity: 0.35 },
  { frame: 148, kind: 'whoosh', description: 'speed ramp up and pull-out reveal of the vortex ring on its stem (f146–196)', intensity: 0.3 },
  { frame: 162, kind: 'reveal', description: 'card 4 「现实里，它只会散开。」 condenses (soft); 散开 then slowly drifts apart', intensity: 0.12 },
  { frame: 187, kind: 'chime', description: 'first Widnall split: the ring breaks into 4 lobes', intensity: 0.4 },
  { frame: 224, kind: 'shimmer', description: 'second split: each lobe into 3 (the ink chandelier)', intensity: 0.35 },
  { frame: 264, kind: 'swell', description: 'the bloom breathes alone: long swell to the cut (camera leans in, light blooms up)', intensity: 0.6 },
  { frame: 329, kind: 'swell peak', description: 'peak of the swell on the brightest frame', intensity: 0.95 },
  { frame: 330, kind: 'silence', description: 'HARD CUT to black: all sound cuts to room tone', intensity: 0 },
  { frame: 331, kind: 'silence', description: '「为什么？」 fades in over room tone (no hit)', intensity: 0.05 },
  { frame: 360, kind: 'shimmer', description: '为什么 diffuses into grains (very faint granular hiss, f360–384)', intensity: 0.12 },
  { frame: 384, kind: 'silence', description: 'only the dot of 「？」 remains at Q_DOT (→ S02)', intensity: 0 },
];

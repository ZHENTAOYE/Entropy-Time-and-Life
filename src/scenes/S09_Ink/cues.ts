// S09 — sound cues for the score (scene-local frames 0…847). Derived from the same constants the picture uses
// (timing.ts only: pure, no DOM), so the cues move with the picture when the timing changes.
import { CAP, END, EYE, HIT, INK_T, INV, PB_END, RW, zoomSpeed, zoomZ } from './timing';

export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

/** first frame at which the pull-back passes Z (log10 of the frame width in metres) */
function frameAtZ(Z: number): number {
  for (let f = 0; f < PB_END; f += 0.25) if (zoomZ(f) >= Z) return f;
  return PB_END;
}

/** the odometer's level names (pullback.ts LEVELS) */
const LEVELS: Array<[number, string]> = [
  [1.55, '街区 (street)'],
  [3.4, '城市 (city)'],
  [5.55, '地球 (Earth)'],
  [8.2, '地月系 (Earth–Moon)'],
  [10.7, '太阳系 (solar system)'],
  [13.9, '奥尔特云 (Oort cloud)'],
  [16.2, '恒星 (stars)'],
  [20.0, '银河系 (Milky Way)'],
  [21.9, '本星系群 (Local Group)'],
  [23.45, '宇宙网 (cosmic web)'],
];

export function s09Cues(): Cue[] {
  const c: Cue[] = [];
  const add = (frame: number, kind: string, description: string, intensity: number) => c.push({ frame: Math.round(frame), kind, description, intensity });

  // ── B1 pull-back ──
  add(0, 'transition', 'continuous from S08 (identical frame): the long reverb tail of the last echo pulse carries over; S08’s gold motes drift off the lens', 0.3);
  add(5, 'pulse', 'S08’s last pulse (fired at its f568): echo tap +7 f still ringing in the head (amp 0.5)', 0.35);
  add(12, 'pulse', 'echo tap +14 f (amp 0.26) — the last trace of the brain’s rhythm as the figure shrinks away', 0.18);
  add(3, 'swell', 'the POWERS-OF-TEN PULL-BACK begins: a sub-bass rise + airy whoosh whose pitch follows the zoom speed (peaks f80–110, eases on the Earth f52–68 and the Milky Way f124–150)', 0.55);
  add(frameAtZ(0.9), 'ambience', 'night street: sodium-lamp hum, distant traffic (car lights streaming on the arterials), fading by Z≈5', 0.3);
  for (const [Z, name] of LEVELS) add(frameAtZ(Z), 'tick', `odometer rolls to 10^${Math.floor(Z)} m — level name types in: ${name}`, 0.18);
  add(CAP.c2.at, 'text', 'C2 「宇宙，一路滚向平衡。」 condenses', 0.25);
  add(frameAtZ(5.9), 'texture', 'the Earth’s night side: city clusters strung by highways — a faint radio-static shimmer, airglow', 0.3);
  add(frameAtZ(9.0), 'texture', 'the pale blue dot sits in a ray of scattered sunlight (Voyager): a single high glassy tone', 0.3);
  add(frameAtZ(10.8), 'tick', 'planet orbits sweep past (tiny pings, one per orbit)', 0.15);
  add(frameAtZ(15.0), 'texture', 'stars stream outward in the log-space tunnel: granular sparkle, densest f100–118', 0.4);
  add(CAP.c3.at, 'text', 'C3 「途中，它在一些角落，/ 暂时织出了结构：」 (cut off by the hard cut at f210)', 0.25);
  add(frameAtZ(20.0), 'swell', 'the Milky Way resolves around you (you are on an arm): wide warm pad', 0.5);
  add(frameAtZ(21.9), 'texture', 'Local Group & galaxy field: the pad thins to a cold shimmer', 0.3);
  add(frameAtZ(22.7), 'swell', 'the cosmic web fades in (violet light along filaments): low choir-like drone rising to the cut', 0.55);
  // ── B2 the triplet ──
  add(HIT.galaxy, 'impact', 'HARD CUT + 2-frame flash: a galaxy (on the circle) — 「星系。」 (punch hit, everything else cut)', 0.9);
  add(HIT.cell, 'impact', 'HARD CUT + flash: a living cell, same circle — 「细胞。」', 0.9);
  add(HIT.eye, 'impact', 'HARD CUT + flash: an eye, same circle — 「你。」 (strongest hit)', 1.0);
  add(HIT.eye + 2, 'silence', 'silence after the third hit (only a near-inaudible room tone)', 0.05);
  // ── B3 the eye ──
  add(EYE.gaze[0], 'texture', 'the eye looks up (抬起头): a soft inhale; the web glints in the cornea (faint high shimmer)', 0.2);
  add(CAP.c7.at, 'text', 'C7 「然后，其中最小的一块，/ 抬起头问：时间是什么？」 (时间是什么？ in gold)', 0.3);
  add(EYE.dive[0], 'swell', 'the push into the pupil begins: a slow deep whoosh accelerating to f416', 0.55);
  add(EYE.webIn[0], 'swell', 'the pupil’s dark opens onto the web: the web drone returns inside the whoosh', 0.45);
  add(EYE.webIn[1], 'transition', 'the web fills the frame (the eye is gone)', 0.4);
  // ── B4 the inversion ──
  add(INV.invert[0], 'transition', 'INVERSION: emissive → transmission — the drone turns inside out (reverse swell, spectrum flips, highs → lows) as the web becomes ink from the water line down', 0.75);
  add(INV.tank[0], 'ambience', 'S01’s tank returns: room tone, the hum of the light table, soft bubbles', 0.35);
  add(INV.hairline[0], 'texture', 'the silver hairline of the surface draws itself from the centre outward: a thin glass tone spreading in stereo', 0.3);
  add(INV.handover, 'transition', 'the inverted web hands over to the ink: it is now ink in water', 0.3);
  // ── B5 the ink ──
  add(INK_T.gauge[0], 'tick', 'S-gauge fades in at the left (ink-coloured); it only rises from here', 0.15);
  add(CAP.c9.at, 'text', 'C9 「墨，终将散开。」', 0.3);
  add(INV.handover + 15, 'texture', 'the ink starts to sink and curl: slow liquid textures, eddies spinning up one by one (to f~640), a low drone that keeps rising with the S-gauge', 0.35);
  add(INK_T.lens[0], 'swell', 'the tank’s water begins to run down through an invisible form: the web’s threads sag and bend onto an outline (crown first) — a low, slowly rising current tone', 0.3);
  add(INK_T.paint[0], 'texture', 'ink pours down the outline from the crown, both sides together (to f604): a wet bristle hiss descending in stereo, drips at the hands and feet', 0.45);
  add(CAP.c10.at, 'text', 'C10 「但在散开的路上——」 = S05’s 「但在滚落的路上——」 (same layout, same musical motif as S05 C8)', 0.35);
  add(INK_T.paint[1], 'swell', 'the figure is complete — held while the ink keeps streaming down its outline (warm sustained chord)', 0.45);
  add(CAP.c11.at, 'text', 'C11 「它画出了你。」', 0.35);
  add(INK_T.brush[0], 'texture', '你 is written stroke by stroke with a real brush (the only brush glyph in the film): 7 strokes in stroke order to f682 — a soft press-and-flick per stroke', 0.5);
  // 。 is held back 58 f (InkPart C11.delayOf) and is glyph #5 (stagger 2.2, enter 16 f)
  add(CAP.c11.at + 58 + 5 * 2.2 + 8, 'tick', '。 lands as the brush lifts (f~683–699), closing the sentence', 0.15);
  add(INK_T.hold, 'swell', 'the form is let go: the current through it eases off, its ink joins the water and diffuses (the chord dissolves, to f~760)', 0.5);
  // ── B6 ◀◀ ──
  add(RW.on, 'tick', '◀◀ ×8 timecode flickers in under the water line (mono clicks)', 0.3);
  add(RW.attempt[0], 'rewind', 'REWIND ATTEMPT: tape strain / reverse squeal, digits run back ×8 with a chromatic split — the picture does not follow, the ink keeps spreading', 0.6);
  add(RW.melt[0], 'fail', 'the ◀◀ itself bleeds into ink and sinks: the reverse sound collapses into a soft liquid gurgle', 0.5);
  // ── B7 title & ending ──
  add(END.title[0], 'swell', 'title 「熵 · 时间 · 生命」 condenses out of the melting ◀◀ ink (shāng over 熵): final theme statement, held 1.5 s', 0.65);
  add(END.dropFrom, 'texture', 'a last drop falls into view from above the frame (tiny whistle, 0.85 s)', 0.25);
  add(END.impact, 'impact', 'the drop breaks the surface (plink + low thump, ripples, a small vortex ring); the title starts dissolving into ink', 0.85);
  add(END.light[0], 'transition', 'the light table switches off: the hum dies (power-down), the tank goes dark', 0.55);
  add(END.span[0], 'texture', 'the hairline of light contracts toward the centre: a thin high tone narrowing', 0.35);
  add(END.point[0], 'tick', 'the hairline is a single point of light', 0.2);
  add(END.black, 'silence', 'the point goes out: pure black #000, total silence to the end (loops to S01’s cold open)', 0);
  return c.filter((q) => q.frame >= 0 && q.frame <= 847).sort((a, b) => a.frame - b.frame);
}

/** zoom speed (decades / frame) sampled every 6 frames, for driving the pull-back whoosh */
export function s09ZoomEnvelope(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let f = 0; f < PB_END; f += 6) out.push([f, Math.max(0, zoomSpeed(f))]);
  return out;
}

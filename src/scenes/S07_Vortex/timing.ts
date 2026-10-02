// S07 涡旋 / The Vortex — beat sheet (scene-local frames, 30 fps, 900 frames). Revision 2.
//
//  B0  f0–40    IN = S06's OUT, the same image (s06.ts redraws S06 rev 1's last frame with its own formulas, seeds and
//               pre-grown vein data): a fully wound clockwise log-spiral whirlpool of light (K = 5), ~1500 gold → olive
//               → teal inflow streaks, the 13-leaf vein rosette, red IR sparks, the white-green sink (R 76 / glow 160).
//               The whirlpool underneath has the same pitch and sense of rotation from frame 0 (no un-twist): S06's
//               light hands over to water — teal floods in from the rim, 7 gold feeder arms (continuing 7 of S06's
//               leaf streams) crystallise, the sink closes into the drain's dark eye; the flow settles from S06's
//               inflow speed (×2.5) to the whirlpool's by f36.
//  C1  f4–96    「1944年，薛定谔问：/ 生命是什么？」 — the question typeset like the 1944 book cover (rules, WHAT IS LIFE?).
//  C2  f98–178  「他写道：/ 生命以“负熵”为食。」 — white-hot packets of free energy race inward along the gold arms.
//  B3  f146–210 The tracer: one gold particle enters at the rim, spirals in, leaves through the eye (停留 2.1 s · 离开).
//  C4  f212–310 「形状一直都在，/ 水，没有一滴停留。」 — CENSUS: the tagged (white) disc drains, 100 % → 0 % at f279,
//               while the dashed outline 形状 · 不变 never changes.
//  C5  f318–369 「你也是。」 — TILT 1 (f296–340). THE WATERSPOUT (f298–358): the innermost 10 000 drops stop draining,
//               spiral ever faster along their own streamlines into the eye (the eye water first, the rim last), rise
//               up a tight spinning column (constant pitch) and peel off into their seats from the feet up; the
//               figure is 90 % complete at f351 — 「你也是。」 sits on the person.
//  C6  f372–466 「你的大部分原子，/ 几个月前还不在这里。」 — the body as a flow: the gold intake thread streams into the
//               mouth from the side (food · water · O₂), down the throat to the heart, out through a Murray's-law
//               vessel tree pumped from the heart into every seat; the atoms they replace leave the skin as rising
//               heat; CO₂ · H₂O leave with the breath (breath.ts, every 4 s of flow time). Time-lapse 第0天 → 第90天:
//               原有原子 100 → 34 %; the original (cyan) skeleton persists in new (gold) flesh. Heartbeat from f396.
//  C7  f468–572 「此刻，你像一只100瓦的灯泡，/ 向宇宙散热。」 — THERMAL SWITCH (scan f462–482): an anatomical FLIR portrait
//               (anatomy.ts, auto-ranged 26–37 °C: hot canthi, neck, armpits, groin; cool nose, hair, hands, feet;
//               superficial veins; mottling), visible heartbeat waves, exhale puffs, convection plume, IR packets;
//               slow push-in on the chest; ≈100 W bulb (2000 kcal/天 ÷ 86400 s ≈ 97 W), SP1 35.4 °C.
//  C8  f574–654 「按每公斤算，/ 你发的热是太阳的约7000倍。」 — pull back; the sensor re-maps to W/kg; the Sun's limb
//               slides in dim purple; log colour bar with two markers (你 1.4 / 太阳 0.0002 W/kg); ×7000 lands f622.
//  C9  f656–770 「你不是在对抗熵增——/ 你借着它，活着。」 — line 1 held complete f678–714; STRIKE across 对抗 (f714),
//               对抗 stays as a ghost while its diffusing copy re-condenses as 借着 (f726–745). S-gauge: S身体 flat,
//               S宇宙 rising; 吃进低熵 (the intake thread) / 排出高熵 (breath and heat).
//  C10 f772–822 「你不是一个东西。」 — FREEZE ❚❚ (f758–766): flow time and camera stop, the heat drains: a cold violet
//               constellation of atoms — a "thing". Music drops out.
//  C11 f826–892 「你是一个过程。」 — ▶ the flow restarts with a heartbeat (f822); 过程 is a steady particle flow. From
//               f850 the figure rises away as heat, head first; TILT 2 (f854–896) down to the floor.
//  OUT f890–899 top view, cold floor #05030F, two inferno residual-heat footprints at FEET (toes up), nothing else.

export const DUR = 900;

export const T = {
  // opening / vortex
  waterIn0: 0,
  waterIn1: 48,
  tracerBirth: 146,
  tracerLife: 64,
  /** census pulse: born exactly as the tracer's exit flash leaves the eye */
  tag: 210,
  /** census HUD / dashed outline fade out */
  censusOut: 316,
  // tilt 1 + morph
  tilt1a: 296,
  tilt1b: 340,
  /** the waterspout: the inner drops leave the whirlpool for the column (bodyDraw.ts spout) */
  morph0: 298,
  treeGrow0: 360,
  treeGrow1: 410,
  flowOn0: 376,
  flowOn1: 394,
  days0: 388,
  days1: 458,
  // thermal
  scan0: 462,
  scan1: 482,
  sunIn0: 570,
  sunIn1: 600,
  sunOut0: 650,
  sunOut1: 676,
  gauge0: 656,
  // freeze / restart
  freeze0: 758,
  freeze1: 766,
  restart: 822,
  restartLen: 10,
  // ending
  dissolve0: 850,
  tilt2a: 854,
  tilt2b: 896,
} as const;

// Narration slots (C9–C11 sit up to ~0.7 s later than the screenplay table: C9 needs its 1.2 s hold + strike).
export const CAP = {
  c1: { at: 4, dur: 92 },
  c2: { at: 98, dur: 80 },
  c4: { at: 212, dur: 98 },
  c5: { at: 318, dur: 51 },
  c6: { at: 372, dur: 94 },
  c7: { at: 468, dur: 104 },
  c8: { at: 574, dur: 80 },
  c9: { at: 656, dur: 114 },
  c10: { at: 772, dur: 50 },
  c11: { at: 826, dur: 66 },
} as const;

// S07 涡旋 / The Vortex — beat sheet (scene-local frames, 30 fps, 900 frames).
//
//  B0  f0–48    IN = S06's OUT: gold→green streams spiralling clockwise into SPIRAL (540,860) on #04050B, a white-gold
//               sink, red IR sparks flying outward. Water floods in from the rim: the streams become the gold feeder
//               arms of a particle whirlpool (closed-form log-spiral sink flow), the sink becomes the drain's dark eye.
//  C1  f4–88    「1944年，薛定谔问：/ 生命是什么？」 — the question typeset like the 1944 book cover (rules, WHAT IS LIFE?).
//  C2  f90–162  「他写道：/ 生命以“负熵”为食。」 — white-hot packets of free energy race inward along the gold arms.
//  B3  f146–212 The tracer: one gold particle enters at the rim, spirals in, leaves through the eye (停留 2.1 s · 离开);
//               the camera pushes in on it. Its whole path stays drawn (the shape = a statistic of paths).
//  C4  f212–306 「形状一直都在，/ 水，没有一滴停留。」 — CENSUS: at f216 a sonar pulse tags every drop in the vortex
//               white; new water is teal; the white disc drains (100 % → 0 % at f294) while the dashed outline,
//               形状 · 不变, never changes. Camera pulls back to show the whole shape.
//  C5  f308–358 「你也是。」 — TILT 1 (f296–340, with a slow un-roll): top view → side view; the whirlpool becomes a 3D
//               basin and lifts off as a spinning helix that settles bottom-up into the human figure (f316–384).
//  C6  f358–462 「你的大部分原子，/ 几个月前还不在这里。」 — the body as a flow: an ordered gold thread brings food, water
//               and O₂ in at the mouth, a Murray's-law vessel tree distributes it, atoms linger, then leave through the
//               skin (热 · CO₂ · H₂O). Time-lapse 第0天 → 第90天: original (cyan) atoms are replaced by new (gold)
//               ones while the outline stays; a few long-lived atoms remain in the head. Heartbeat from f396 (60 bpm).
//  C7  f464–570 「此刻，你像一只100瓦的灯泡，/ 向宇宙散热。」 — THERMAL SWITCH (scan f462–482): inferno sensor view,
//               convection plume with breath pulses, IR wave packets (S06's long red waves), floor reflection,
//               FLIR chrome, spot meter SP1, ≈100 W bulb (2000 kcal/天 ÷ 86400 s ≈ 97 W).
//  C8  f572–654 「按每公斤算，/ 你发的热是太阳的约7000倍。」 — the sensor re-maps to W/kg; the Sun's limb slides in dim
//               purple (0.0002 W/kg) while you blaze (1.4 W/kg); box tools BX1/BX2, log colour bar, ×7000 count-up.
//  C9  f650–752 「你不是在对抗熵增——/ 你借着它，活着。」 — 对抗 diffuses; its cloud re-condenses as 借着.
//               S-gauge twin ticks: S身体 flat, S宇宙 rising; 吃进低熵 (gold thread in) / 排出高熵 (IR out).
//  C10 f754–812 「你不是一个东西。」 — FREEZE ❚❚ (f752–760): flow time stops, trails vanish, the heat drains: a cold violet
//               constellation of atoms — a "thing". Music drops out.
//  C11 f814–890 「你是一个过程。」 — ▶ the flow restarts with a heartbeat (f812), heat floods back from the chest; 过程 is a
//               steady particle flow (particles slow inside the strokes → density = glyph). From f846 the figure rises
//               away as heat, head first; TILT 2 (f852–896) down to the floor.
//  OUT f886–899 top view, cold floor #05030F, two inferno residual-heat footprints at FEET (toes up), nothing else.

export const DUR = 900;

export const T = {
  // opening / vortex
  waterIn0: 0,
  waterIn1: 48,
  tracerBirth: 146,
  tracerLife: 64,
  tag: 216,
  // tilt 1 + morph
  tilt1a: 296,
  tilt1b: 340,
  morph0: 316,
  morphSpan: 34, // stagger by height
  morphLen: 30,
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
  freeze0: 752,
  freeze1: 760,
  restart: 812,
  restartLen: 10,
  // ending
  dissolve0: 846,
  tilt2a: 852,
  tilt2b: 896,
} as const;

export const CAP = {
  c1: { at: 4, dur: 84 },
  c2: { at: 90, dur: 72 },
  c4: { at: 212, dur: 94 },
  c5: { at: 308, dur: 50 },
  c6: { at: 358, dur: 104 },
  c7: { at: 464, dur: 106 },
  c8: { at: 572, dur: 82 },
  c9: { at: 650, dur: 102 },
  c10: { at: 754, dur: 58 },
  c11: { at: 814, dur: 76 },
} as const;

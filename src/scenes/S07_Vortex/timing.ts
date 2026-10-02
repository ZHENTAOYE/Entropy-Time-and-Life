// S07 涡旋 / The Vortex — beat sheet (scene-local frames, 30 fps, 900 frames).
//
//  B0  f0–46    IN = S06's OUT, the same image: S06's 7-leaf vein rosette (regrown with S06's own recipe, s06.ts),
//               twisted by S06's own law and still turning at S06's rate, its red IR sparks and gold inflow, its sink.
//               The flow winds it up (clockwise, the centre fastest) into the whirlpool's log spirals: the leaves become
//               7 gold feeder arms that grow out to the frame edge (f10–42), teal water floods in from the rim, the sink
//               becomes the drain's dark eye (closed-form spiral sink; vortex.ts wOpen blend).
//  C1  f4–96    「1944年，薛定谔问：/ 生命是什么？」 — the question typeset like the 1944 book cover (rules, WHAT IS LIFE?).
//  C2  f98–178  「他写道：/ 生命以“负熵”为食。」 — white-hot packets of free energy race inward along the gold arms.
//  B3  f146–210 The tracer: one gold particle enters at the rim, spirals in, leaves through the eye (停留 2.1 s · 离开);
//               the camera pushes in on it. Its whole path stays drawn (the shape = a statistic of paths).
//  C4  f212–310 「形状一直都在，/ 水，没有一滴停留。」 — CENSUS: at f210 (born with the tracer's exit flash) a sonar pulse
//               tags every drop inside the rim white; new water is teal; the white disc drains (100 % → 0 % at f279,
//               every drop leaves within ≤ 69 f) while the dashed outline, 形状 · 不变, never changes — it flashes at 0 %
//               and holds to f306. Camera pulls back to show the whole shape.
//  C5  f312–364 「你也是。」 — TILT 1 (f296–340, with a slow un-roll): top view → side view; the whirlpool becomes a 3D
//               basin and lifts into a coherently spinning waterspout that settles bottom-up into the figure (f316–384).
//  C6  f366–466 「你的大部分原子，/ 几个月前还不在这里。」 — the body as a flow: every seat always occupied (the shape
//               persists), occupants exchanged (flow.ts): newcomers come in along an ordered gold thread at the mouth and a
//               Murray's-law vessel tree, the atoms they replace leave through the skin (热 · CO₂ · H₂O). Two pools —
//               water ≈ 60 % (t½ 10 d) and a slow pool (skeleton, fat, lens). Time-lapse 第0天 → 第90天: 原有原子
//               100 → 77 → 44 → 34 %; by day 90 the flesh is new (gold) around the original (cyan) skeleton.
//               Heartbeat from f396 (60 bpm).
//  C7  f468–572 「此刻，你像一只100瓦的灯泡，/ 向宇宙散热。」 — THERMAL SWITCH (scan f462–482): inferno sensor view,
//               convection plume with breath pulses, IR wave packets (S06's long red waves), floor reflection,
//               FLIR chrome, spot meter SP1, ≈100 W bulb (2000 kcal/天 ÷ 86400 s ≈ 97 W).
//  C8  f574–656 「按每公斤算，/ 你发的热是太阳的约7000倍。」 — the sensor re-maps to W/kg; the Sun's limb slides in dim
//               purple (0.0002 W/kg) while you blaze (1.4 W/kg); box tools BX1/BX2, log colour bar, ×7000 count-up.
//  C9  f658–760 「你不是在对抗熵增——/ 你借着它，活着。」 — 对抗 diffuses; its cloud re-condenses as 借着.
//               S-gauge twin ticks: S身体 flat, S宇宙 rising; 吃进低熵 (gold thread in) / 排出高熵 (IR out).
//  C10 f762–816 「你不是一个东西。」 — FREEZE ❚❚ (f752–760): flow time stops, trails vanish, the heat drains: a cold violet
//               constellation of atoms — a "thing". Music drops out.
//  C11 f818–892 「你是一个过程。」 — ▶ the flow restarts with a heartbeat (f812), heat floods back from the chest; 过程 is a
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
  /** census pulse: born exactly as the tracer's exit flash leaves the eye */
  tag: 210,
  /** census HUD / dashed outline fade out */
  censusOut: 316,
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

// Narration slots. Each card is fully formed (every glyph condensed, none diffusing yet) for ≥ 0.75 s:
//   c1 f38–80 (imprint complete f52) · c2 f130–162 · c4 f246–292 (census 0 % lands f280 inside it) · c5 f327–350 ·
//   c6 f402–448 · c7 f508–552 · c8 f611–638 · c9 line 2 f720–738 · c10 f776–802 · c11 f852–876.
export const CAP = {
  c1: { at: 4, dur: 92 },
  c2: { at: 98, dur: 80 },
  c4: { at: 212, dur: 98 },
  c5: { at: 312, dur: 52 },
  c6: { at: 366, dur: 100 },
  c7: { at: 468, dur: 104 },
  c8: { at: 574, dur: 82 },
  c9: { at: 658, dur: 102 },
  c10: { at: 762, dur: 54 },
  c11: { at: 818, dur: 74 },
} as const;

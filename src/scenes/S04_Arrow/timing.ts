// S04 时间之箭 / The Arrow — master clock (scene-local frames, 0..953 @ 30 fps).
//
// Screenplay v1 card table (seconds → frames), nudged by ≤ 0.5 s for reading time:
//   C1 0.0–3.0   熵增的方向，/ 就是时间的方向。          f4–104
//   C2 3.0–5.4   往回追：/ 越早，熵越低。                  f102–172
//   C3 5.4–10.0  ◀◀ + year counter 1天 → 1亿年 → 138亿年  f172–292 (slam f288)
//   C4 10.0–12.8 宇宙的起点，/ 熵低得不可思议：             f296–390
//   C5 12.8–16.8 概率 ≈ 1 / 10^(10¹²³) · 1后面，跟着 10¹²³ 个零 · 彭罗斯估算   f384–520
//   C6 16.8–20.4 怪的是：它几乎完全均匀，/ 像散尽的墨。    f516–622
//   C7 20.4–24.4 但对引力来说：/ 均匀是低熵，抱团才是熵增。 f622–740
//   C8 24.4–25.4 — web forms, stars ignite                    f728–800
//   C9 25.4–27.8 宇宙，从那里一路滚落。                      f754–830
//   C10 27.8–31.8 你经历的每一个“之后”，/ 都是这场滚落。   f828–935, then 0.6 s still → f953 = WEB_FINAL

export const DUR = 954;
export const LAST = DUR - 1;

export const T = {
  // ── A · the line becomes the arrow
  headGrow: [4, 28] as const,
  rotate: [14, 52] as const,
  extend: [26, 66] as const,
  plume0: 22, // flow clock starts (dust leaves the tail)
  bg: [8, 70] as const,
  ruler: [48, 80] as const,
  brackets: 54,
  // ── B · reversal + dive into the tail
  stall: 98, // flow clock starts to decelerate
  stallEnd: 118, // flow clock runs backward at full speed from here
  rewindHud: 106, // ◀◀ appears (time is being tampered with)
  dive: [126, 186] as const, // camera rushes into the tail point
  iris: [142, 184] as const, // the tail point opens onto the present-day cosmos
  cosmosOn: 138, // CosmicWeb mounted
  // ── C · cosmic rewind
  counterOn: 172,
  counterRamp: [182, 286] as const,
  slam: 288, // the floor of time
  merger: [158, 240] as const, // p 1 → 0 (un-merge)
  mergerDissolve: [204, 252] as const,
  unIgnite: [170, 226] as const,
  unClump: [184, 250] as const,
  heatUp: [222, 274] as const,
  contract: [150, 278] as const, // zoom 1 → 0.55 (space contracts)
  // ── D · floor of time
  counterFly: [292, 314] as const,
  // ── E · Penrose
  overlayIn: [376, 394] as const,
  base10: 390,
  exp10: 405,
  exp123: 419,
  pullBack: [432, 468] as const,
  fraction: [438, 456] as const,
  zeros: [448, 512] as const,
  overlayOut: [500, 524] as const,
  // ── F · uniform like spent ink
  probe: [516, 600] as const,
  whiteOut: [538, 566] as const,
  inkIn: [546, 582] as const,
  cosmosOff: 578, // CosmicWeb unmounted (ink only)
  inkTick: [574, 596] as const,
  // ── G · gravity
  boxesIn: [602, 628] as const,
  boxRun: 626,
  collapse: [640, 694] as const, // right box: gravity pulls the gas into a clump
  sparks: [656, 730] as const,
  cosmosBack: 626, // CosmicWeb remounted (inverted = ink on paper)
  inkOut: [630, 658] as const,
  inkOff: 659,
  clump: [646, 726] as const, // full-frame: c 0.12 → 0.92 (the ink gathers under gravity)
  boxesOut: [688, 722] as const,
  flip: [704, 746] as const, // invert → 0 (the paper goes dark, the ink becomes light)
  // ── H · ignition
  ignite: [728, 802] as const,
  sparksUp: [720, 790] as const,
  camera: [640, 935] as const, // zoom 1.06 → 0.8, roll 0 → 6°
  forward: [704, 900] as const, // ▶ forward clock
  // ── end
  hudOut: [896, 926] as const,
  still: 935,
};

/** narration cards: [from, dur] */
export const CAP = {
  c1: [4, 100] as const,
  c2: [102, 70] as const,
  c4: [296, 94] as const,
  c5: [440, 78] as const,
  c6: [516, 106] as const,
  c7: [622, 118] as const,
  c9: [754, 76] as const,
  c10: [828, 107] as const,
};

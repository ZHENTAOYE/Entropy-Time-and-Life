// S04 时间之箭 / The Arrow — master clock (scene-local frames, 0..953 @ 30 fps).
//
// Screenplay v1 card table (seconds → frames). Card order and text are locked; the boundaries are nudged so that
// every narration line stays on screen ≥ chars/5 s + 0.8 s (fast condense: stagger 0.4 f, 12 f; diffuse 13 f) and
// the cosmic rewind runs in sync with its year counter:
//   C1 0.0–3.0   熵增的方向，/ 就是时间的方向。               f1–117
//   C2 3.0–5.4   往回追：/ 越早，熵越低。                      f114–206 (reads over the first beat of the rewind)
//   C3 5.4–10.0  ◀◀ + year counter 1天 → 1亿年 → 138亿年      f160–276 (counter in the TOP lane), slam f276
//   C4 10.0–12.8 宇宙的起点，/ 熵低得不可思议：                 f276–382
//   C5 12.8–16.8 概率 ≈ 1 / 10^(10¹²³) · 1后面，跟着 10¹²³ 个零 · 彭罗斯估算   tower f370–418, C5 f398–492
//   C6 16.8–20.4 怪的是：它几乎完全均匀，/ 像散尽的墨。         f489–607
//   C7 20.4–24.4 但对引力来说：/ 均匀是低熵，抱团才是熵增。     f604–734
//   C8 24.4–25.4 — the ink-dark field turns to light, stars ignite at the nodes        f732–808
//   C9 25.4–27.8 宇宙，从那里一路滚落。                        f737–821
//   C10 27.8–31.8 你经历的每一个“之后”，/ 都是这场滚落。       f818–935, then 0.6 s still → f953 = WEB_FINAL

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
  stall: 104, // flow clock starts to decelerate
  stallEnd: 124, // flow clock runs backward at full speed from here
  rewindHud: 112, // ◀◀ appears (time is being tampered with)
  dive: [132, 188] as const, // camera rushes into the tail point
  iris: [146, 186] as const, // the tail point opens onto the present-day cosmos
  cosmosOn: 140, // CosmicWeb mounted
  // ── C · cosmic rewind, locked to the look-back counter (see hud.tsx lookback()):
  //   1天 → 1亿年 (f170–196): nothing changes on cosmic scales — only the time-compression streaks
  //   1亿 → 100亿年 (f196–238): space contracts, galaxies converge, the merger un-merges
  //   100 → 136亿年 (f238–258): stars un-light, galaxies dissolve into gas, filaments smooth out
  //   136 → 137亿年 (f258–266): the dark ages · 137 → 138亿年 (f266–276): the heat surge into plasma
  counterOn: 160,
  counterLog: [170, 196] as const,
  slam: 276, // the floor of time
  merger: [194, 240] as const, // p 1 → 0 (un-merge)
  mergerDissolve: [230, 256] as const,
  unIgnite: [228, 254] as const,
  unClump: [206, 262] as const,
  heatUp: [256, 278] as const,
  contract: [192, 266] as const, // zoom 1 → 0.55 (space contracts)
  // ── D · floor of time
  counterFly: [280, 300] as const,
  // ── E · Penrose (the base 10 is a window that EMERGES as the darkness falls — no empty frame)
  overlayIn: [370, 388] as const,
  base10: 384,
  exp10: 396,
  exp123: 408,
  pullBack: [418, 450] as const,
  fraction: [422, 440] as const,
  zeros: [434, 494] as const,
  overlayOut: [486, 510] as const,
  // ── F · uniform like spent ink
  probe: [500, 584] as const,
  whiteOut: [522, 550] as const,
  inkIn: [536, 554] as const,
  cosmosOff: 554, // CosmicWeb unmounted (ink only)
  inkTick: [558, 580] as const,
  // ── G · gravity
  boxesIn: [588, 614] as const,
  boxRun: 612,
  collapse: [628, 680] as const, // right box: gravity pulls the gas into a clump
  sparks: [644, 716] as const,
  cosmosBack: 610, // CosmicWeb remounted (inverted = ink on paper)
  inkOut: [614, 642] as const,
  inkOff: 643,
  boxesOut: [674, 702] as const,
  clump: [676, 790] as const, // full-frame: c 0.12 → 1 (the spent ink gathers under gravity)
  flip: [732, 758] as const, // invert → 0 from the bottom up (the paper goes dark, the ink becomes light)
  // ── H · ignition
  ignite: [744, 808] as const,
  sparksUp: [740, 792] as const,
  camera: [628, 932] as const, // zoom 1.45 → 0.8, roll 0 → 6°
  // ── end
  hudOut: [888, 918] as const,
  still: 935,
};

/** narration cards: [from, dur] (Voice: stagger 0.5, enter 13, exit 15 unless overridden) */
export const CAP = {
  c1: [1, 116] as const,
  c2: [114, 92] as const,
  c4: [276, 106] as const, // condenses under the slam's flash
  c5: [398, 94] as const, // with the exponent: the tower is still climbing
  c6: [489, 118] as const,
  c7: [604, 130] as const,
  c9: [737, 84] as const, // the caption lane has turned to light by f742
  c10: [818, 117] as const,
};

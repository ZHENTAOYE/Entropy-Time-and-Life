// S06 阳光的账本 — beat sheet (scene-local frames, 30 fps, 582 frames). Revision 2 (screenplay timing ±0.5 s).
//
//  B0  f0–62    IN: S05's grey noise + gold point (540,820), no vignette. The grey DISSOLVES GRAIN BY GRAIN from the
//               point outward along an organic front (S05's random walk run backwards); the grains glint gold as the
//               light reaches them (f3–36). Behind: deep space, the point's warm light, stars. The point rises and
//               swells into the Sun (f6–62); the Earth rises (f16–80).
//  C1  f14–102  「地球不“攒”阳光：/ 收多少，几乎就还多少。」 Ledger draws on: 收 | 还, bars IN ≈ OUT 240 W/m².
//  B2  f102–130 text-free: split-flap flip 能量 → 光子; readings roll back to 0; streams dim.
//  B3  f122–191 ONE gold photon (20 crests, 0.5 µm) falls, lands (f148), UNZIPS: every crest peels off as its own
//               one-crest red wave (10 µm) — 20 out (f151–189). Counters 收 1, 还 1→20. The labels 阳光 0.5 µm /
//               红外 10 µm ride the photons, then pin under the counters with λ ×20.               C2 f130–222
//  B4  f222–304 熵 row flips in (1 | ≈20) + the energy row typed back (1 = 1); double underline. Ghost fans
//               (f232–304): all the other ways out.                                                   C3 f224–310
//  B5  f296–400 ONE DIRECTION IN, ALL DIRECTIONS OUT: a parallel gold beam lands on the whole limb; every packet that
//               lands bursts into long red wavelets fanning out over the hemisphere, thinning with distance; the sky
//               fills with infrared. 散开 bleeds like S01's ink.                                     C4 f312–402
//  B6  f396–466 DIVE ×36 through a cloud deck onto dusk land (multi-scale terrain clipped to the planet): rivers of
//               light (crisp, flowing to the mouth); at the mouth the leaf rosette — same branching law (f428–498).
//                                                                                                      C5 f404–516
//  B7  f500–581 The 13-leaf rosette winds clockwise into a log-spiral whirlpool, blades fade by f555, gold → teal
//               inflow spirals in, red IR sparks escape. Picture only f516–581 (2.2 s).  OUT = S07 f0.
export const DUR = 582;

export const T = {
  // opening
  floodStart: 3,
  floodEnd: 40,
  sunGrowStart: 6,
  sunGrowEnd: 62,
  earthRiseStart: 16,
  earthRiseEnd: 80,
  // ledger
  ledgerIn: 42,
  barsIn: 54,
  flipAt: 104,
  streamsDim: 106,
  // hero photon
  photonEmit: 122,
  photonLand: 148,
  unzip0: 151,
  unzipStep: 2,
  unzipCount: 20,
  // entropy row + energy row back
  entropyRow: 222,
  energyBack: 230,
  ghostStart: 232,
  ghostEnd: 304,
  ledgerOut: 306,
  // one direction in, all directions out
  beamIn: 294,
  irStart: 298,
  // dive
  diveStart: 396,
  diveEnd: 466,
  // network — END STATE FROZEN: S07 r2 rebuilds its opening from these exact constants (leaf rosette of
  // network.ts / netData.blob.ts, its twist law, spin clock, inflow clock, bladeOut). Do not change.
  netGrowStart: 428,
  netGrowEnd: 498,
  swirlStart: 500,
  bladeOut: 555,
  end: 581,
} as const;

/** narration schedule (screenplay v1: C1 0–3.2 s, C3 4.4–7.4, C4 7.4–10.2, C5 10.2–13.4, C6 13.4–17.2) */
export const CAP = {
  c1: { at: 14, dur: 88 },
  c2: { at: 130, dur: 92 },
  c3: { at: 224, dur: 86 },
  c4: { at: 312, dur: 90 },
  c5: { at: 404, dur: 112 },
} as const;

/** 你 brightens in caption 5 (the sink takes one beat) */
export const YOU_AT = CAP.c5.at + 52;

/** frame at which red photon i (in emission order) leaves the surface */
export const unzipAt = (i: number) => T.unzip0 + i * T.unzipStep;

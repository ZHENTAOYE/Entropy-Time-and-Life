// S06 阳光的账本 — beat sheet (scene-local frames, 30 fps, 582 frames). Revision 1.
//
//  B0  f0–62    IN: S05's grey noise + gold point (540,820), no vignette. The point flares; a white-gold shock front
//               floods colour back radially (f3–40): luminous dawn inside, stars pop in behind the front, relaxing to
//               deep space as the point rises and swells into the Sun (f6–62). The Earth rises (f16–80).
//  C1  f4–100   「地球不“攒”阳光：/ 收多少，几乎就还多少。」 Ledger draws on: 收 | 还, bars IN ≈ OUT 240 W/m².
//  B2  f102–128 text-free: split-flap flip 能量 → 光子 (big tiles); readings roll back to 0; streams dim.
//  B3  f122–191 ONE gold photon (20 crests, 0.5 µm) falls (f122–148), lands, UNZIPS: every crest peels off as its own
//               one-crest red wave (10 µm) — 20 out (f151–189, every 2 f). Counters 收 1, 还 1→20.   C2 f126–236
//  B4  f238–340 熵 row flips in (1 | ≈20) + the energy row is typed back at the top (240 = 240): three rows, double
//               underline under 熵. Ghost fans (f250–336): all the other ways out.                      C3 f238–349
//  B5  f330–440 像那滴墨… ordered parallel beam in; the whole limb exhales IR as small ink-like rings that thin out
//               into space (dilution ∝ 1/(1+d/d0)²). 散开 bleeds.                                         C4 f350–449
//  B6  f420–490 DIVE ×36 through a cloud layer onto lit dusk land: river network of light → leaf rosette
//               (golden-angle phyllotaxis, same branching law). Veins grow & green (f428–498).          C5 f450–552
//  B7  f500–581 The rosette winds into a clockwise log-spiral whirlpool (S07's pitch & arms), blades fade by f555,
//               dense gold→olive→teal inflow streams, white-green sink, red IR sparks escape.  Picture only f552–581.
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
  entropyRow: 238,
  energyBack: 246,
  ghostStart: 250,
  ghostEnd: 336,
  ledgerOut: 340,
  // haze
  beamIn: 334,
  hazeStart: 332,
  // dive
  diveStart: 420,
  diveEnd: 490,
  // network
  netGrowStart: 428,
  netGrowEnd: 498,
  swirlStart: 500,
  bladeOut: 555,
  end: 581,
} as const;

/** narration schedule (see RichCaption: per-line stagger; every 2nd line holds fully formed ≥ 1.5 s, C3 ≥ 2 s) */
export const CAP = {
  c1: { at: 4, dur: 96 },
  c2: { at: 126, dur: 110 },
  c3: { at: 238, dur: 111 },
  c4: { at: 350, dur: 99 },
  c5: { at: 450, dur: 102 },
} as const;

/** 你 brightens in caption 5 */
export const YOU_AT = CAP.c5.at + 44;

/** frame at which red photon i (in emission order) leaves the surface */
export const unzipAt = (i: number) => T.unzip0 + i * T.unzipStep;

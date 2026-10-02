// S06 sound cues (scene-local frames) for the score (scripts/score.py) — every audible event of the picture, derived
// from the same timing constants the picture uses (timing.ts), so they can never drift.
// Score idea (visual-direction §2.8): the photon ledger is sonified — ONE high sine (the gold photon, 20 crests)
// splits into TWENTY sines at 1/20 of the frequency (the red photons, one crest each), at equal total energy.
import { CAP, T, YOU_AT, unzipAt } from './timing';

export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

/** a split-flap tile flip: three clacks, 3 frames apart (ledger.ts flap: from → 2 noise glyphs → to) */
const flap = (at: number, what: string): Cue[] =>
  [0, 1, 2].map((k) => ({ f: at + k * 3, kind: 'flap-clack', description: `split-flap tile ${what} (${k + 1}/3)`, intensity: 0.3 }));

const GHOST_HOLD = 6; // photons.ts drawGhostFans

export const CUES: Cue[] = [
  // ---- B0: the colour returns
  { f: 0, kind: 'continue', description: "S05's near-silence; the gold point flickers (tiny glassy tick)", intensity: 0.15 },
  { f: T.floodStart, kind: 'grain-sparkle', description: "the grey dissolves grain by grain from the point outward (S05's noise run backwards): granular glassy sparkle spreading outward with the front (until ~f30)", intensity: 0.55 },
  { f: 5, kind: 'light-bloom', description: 'light floods the opening hole: warm exposure swell, peaks ~f8 and settles by ~f38 (a breath in, not a hit)', intensity: 0.6 },
  { f: T.sunGrowStart, kind: 'sun-swell', description: 'the point rises and swells into the Sun: warm low pad grows until f62 (colour returns)', intensity: 0.7 },
  { f: CAP.c1.at, kind: 'text-in', description: 'caption 「地球不“攒”阳光：/ 收多少，几乎就还多少。」 condenses', intensity: 0.15 },
  { f: T.earthRiseStart, kind: 'drone-in', description: "the Earth's limb rises from below: low blue drone enters", intensity: 0.4 },
  { f: 30, kind: 'noise-gone', description: 'last grey grains gone at the frame corners: the heat-death noise bed is fully gone', intensity: 0.3 },
  // ---- B1: the energy ledger
  { f: T.ledgerIn, kind: 'ui-tick', description: 'ledger column head 收 condenses (gold)', intensity: 0.3 },
  { f: T.ledgerIn, kind: 'streams', description: 'gold short-wave rain falls (bright shimmer) / red long waves rise (low hum) — continuous until ~f120', intensity: 0.35 },
  { f: T.ledgerIn + 6, kind: 'ui-tick', description: 'ledger column head 还 condenses (red)', intensity: 0.3 },
  { f: T.ledgerIn + 6, kind: 'pen-line', description: 'ledger hairlines draw on (rule + spine)', intensity: 0.2 },
  { f: T.barsIn, kind: 'counter-roll', description: 'energy bars fill, both odometers roll 0 → 240 W/m² (until ~f84)', intensity: 0.3 },
  { f: T.barsIn + 22, kind: 'chime', description: 'the ≈ sign lands between IN and OUT: balance', intensity: 0.4 },
  // ---- B2: flip to photons
  { f: T.flipAt, kind: 'counter-roll', description: 'energy readings roll back to 0', intensity: 0.25 },
  ...flap(T.flipAt, '能 → 光'),
  ...flap(T.flipAt + 4, '量 → 子'),
  { f: T.streamsDim, kind: 'hush', description: 'ambient streams fade: the stage clears for one photon', intensity: 0.3 },
  // ---- B3: one photon in, twenty out
  { f: T.photonEmit, kind: 'high-sine', description: 'ONE gold photon leaves the Sun: a single pure high sine begins (sustains until the unzip ends); tag 阳光 · 0.5 µm rides along', intensity: 0.6 },
  { f: CAP.c2.at, kind: 'text-in', description: 'caption 「进来1个光子，」 condenses (line 2 「出去约20个。」 with the unzip, f150)', intensity: 0.15 },
  { f: T.photonLand, kind: 'impact', description: 'the photon lands on the limb: soft bright impact + flash, slow motion', intensity: 0.7 },
  { f: T.photonLand + 2, kind: 'counter-tick', description: '收 counter 0 → 1 (gold)', intensity: 0.4 },
  ...Array.from({ length: 20 }, (_, i): Cue => ({
    f: unzipAt(i),
    kind: 'split-tone',
    description: `crest ${i + 1}/20 peels off → one long red wave; a low sine (1/20 of the high one) is added; 还 counter → ${i + 1} at f${unzipAt(i) + 3}`,
    intensity: 0.25,
  })),
  { f: T.photonLand + 34, kind: 'ui-tick', description: 'the 阳光 · 0.5 µm tag settles under the IN counter', intensity: 0.2 },
  { f: unzipAt(19) + 4, kind: 'resolve', description: 'high sine gone; twenty low sines sustain; → arrow appears (1 → 20)', intensity: 0.5 },
  { f: unzipAt(19) + 12, kind: 'ui-tick', description: 'the 红外 · 10 µm tag settles under the OUT counter', intensity: 0.2 },
  { f: unzipAt(19) + 16, kind: 'ui-tick', description: 'λ ×20 appears between the two wavelength tags', intensity: 0.25 },
  // ---- B4: entropy ×20
  ...flap(T.entropyRow, '_ → 熵'),
  { f: CAP.c3.at, kind: 'text-in', description: 'caption 「能量一样多——」 condenses', intensity: 0.15 },
  ...flap(T.energyBack - 2, '_ → 能 (energy row returns)'),
  { f: T.energyBack, kind: 'ui-tick', description: 'energy row typed back at the top: 1 = 1', intensity: 0.25 },
  ...flap(T.energyBack + 2, '_ → 量'),
  { f: CAP.c3.at + 16, kind: 'emphasis-hit', description: '“20倍” (largest type of the scene) condenses: deep hit', intensity: 0.6 },
  { f: T.entropyRow + 16, kind: 'counter-roll', description: 'entropy row rolls ≈0 → ≈20', intensity: 0.3 },
  { f: T.entropyRow + 26, kind: 'pen-line', description: 'double underline (final balance) draws', intensity: 0.3 },
  ...Array.from({ length: Math.floor((T.ghostEnd - 6 - T.ghostStart) / GHOST_HOLD) + 1 }, (_, k): Cue => ({
    f: T.ghostStart + k * GHOST_HOLD,
    kind: 'ghost-tick',
    description: `another arrangement of the same 20 red wavelets (${k + 1}): faint soft tick (S03's counting rhyme)`,
    intensity: 0.12,
  })),
  // ---- B5: one direction in, all directions out — 散开
  { f: T.beamIn, kind: 'shimmer', description: 'the parallel gold beam fades in (one direction): steady high shimmer until ~f430', intensity: 0.3 },
  { f: T.irStart, kind: 'burst-texture', description: 'landing gold packets burst into half-rings of long red wavelets over the whole hemisphere: dense, soft low crackle/chorus of falling blips, thickening until ~f396', intensity: 0.45 },
  { f: T.irStart + 4, kind: 'ink-swell', description: 'the sky fills with infrared like ink in water: red plumes rise and spread from the whole limb — slow, deep swelling rumble until ~f396', intensity: 0.45 },
  { f: T.ledgerOut, kind: 'dissolve', description: 'the ledger rises and dissolves as one sheet', intensity: 0.2 },
  { f: CAP.c4.at, kind: 'text-in', description: 'caption 「像那滴墨，/ 阳光在地球上“散开”了。」 condenses', intensity: 0.15 },
  { f: CAP.c4.at + 30, kind: 'ink-bleed', description: '散开 bleeds like ink: soft tendrils creep out of the two glyphs (until ~f384)', intensity: 0.3 },
  // ---- B6: the dive
  { f: T.diveStart, kind: 'dive', description: 'DIVE into the Earth: rising Shepard swell (zoom ×36), fastest ~f431; the red sky clears in the first half second', intensity: 0.8 },
  { f: CAP.c5.at, kind: 'text-in', description: 'caption 「这一“散”的差价，/ 养活了绿叶，也养活了你。」 condenses', intensity: 0.15 },
  { f: T.diveStart + 28, kind: 'glint', description: 'dusk land; rivers of light glint and flow to the mouth (shimmer)', intensity: 0.35 },
  { f: T.diveStart + 32, kind: 'whoosh', description: "the limb and the thin blue atmosphere sweep out of the top of the frame (~f431)", intensity: 0.5 },
  { f: T.netGrowStart, kind: 'growth', description: 'leaf veins grow at the river mouth (dendritic crackle of tiny ticks, until ~f498)', intensity: 0.3 },
  { f: T.netGrowStart + 16, kind: 'pings', description: 'sunlight lands on vein tips: sparse tiny bell pings (continuous)', intensity: 0.15 },
  { f: T.netGrowStart + 24, kind: 'sparks', description: 'red IR sparks leave every junction: soft crackle (continuous, grows in the vortex)', intensity: 0.2 },
  { f: YOU_AT, kind: 'heartbeat', description: '你 brightens alone; the sink takes one deep warm beat', intensity: 0.7 },
  { f: T.diveEnd, kind: 'land', description: 'the zoom settles on the leaf rosette over deep space (soft landing, sustain)', intensity: 0.4 },
  // ---- B7: the vortex
  { f: T.swirlStart, kind: 'vortex-swell', description: 'the flows twist into a whirlpool: rising swirl swell that carries straight into S07 (no silence at the cut)', intensity: 0.6 },
  { f: CAP.c5.at + CAP.c5.dur, kind: 'clear', description: 'last caption gone: 2.1 s of picture only, the swell keeps rising', intensity: 0.5 },
  { f: T.end, kind: 'cut', description: 'match cut to S07 (the wound rosette → particle whirlpool), swell continues', intensity: 0.7 },
].sort((a, b) => a.f - b.f);

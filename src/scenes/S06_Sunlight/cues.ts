// S06 sound cues (scene-local frames) for scripts/audio/score.py — every audible event of the picture, derived
// from the same timing constants the picture uses (so they can never drift).
// Score idea (visual-direction §2.8): the photon ledger is sonified — ONE high sine (the gold photon, 20 crests)
// splits into TWENTY sines at 1/20 of the frequency (the red photons, one crest each), equal total energy.
import { CAP, T, YOU_AT, unzipAt } from './timing';

export interface Cue {
  f: number;
  kind: string;
  description: string;
  intensity?: number;
}

const flaps = (at: number, tiles: number): Cue[] => {
  const out: Cue[] = [];
  for (let t = 0; t < tiles; t++)
    for (let k = 0; k < 3; k++) out.push({ f: at + t * 4 + k * 3, kind: 'flap-clack', description: `split-flap tile ${t + 1} flips (${k + 1}/3)`, intensity: 0.3 });
  return out;
};

export const CUES: Cue[] = [
  { f: 0, kind: 'continue', description: "S05's near-silence; the gold point flickers (tiny glassy tick)", intensity: 0.15 },
  { f: T.floodStart, kind: 'reverse-swell', description: 'colour floods back out of the grey: a bright reverse swell, front leaves the frame ~f26', intensity: 0.6 },
  { f: 26, kind: 'swell-peak', description: 'flood front passes the frame edges; heat-death noise bed gone', intensity: 0.5 },
  { f: T.sunGrowStart, kind: 'sun-swell', description: 'the point rises and swells into the Sun: warm low pad grows until f62 (D major colour returns)', intensity: 0.7 },
  { f: 20, kind: 'drone-in', description: "the Earth's limb rises from below: low blue drone enters", intensity: 0.4 },
  { f: T.ledgerIn, kind: 'ui-tick', description: 'ledger column head 收 condenses (gold)', intensity: 0.3 },
  { f: T.ledgerIn + 6, kind: 'ui-tick', description: 'ledger column head 还 condenses (red)', intensity: 0.3 },
  { f: T.ledgerIn + 6, kind: 'pen-line', description: 'ledger hairlines draw on (spine + rule)', intensity: 0.2 },
  { f: T.ledgerIn, kind: 'streams', description: 'gold short-wave rain falls (bright shimmer) / red long-wave haze rises (low hum) — continuous until ~f120', intensity: 0.35 },
  { f: T.barsIn, kind: 'counter-roll', description: 'energy bars fill, both odometers roll 0 → 240 W/m² (until ~f84)', intensity: 0.3 },
  { f: T.barsIn + 22, kind: 'chime', description: 'the ≈ sign lands between IN and OUT: balance', intensity: 0.4 },
  { f: T.flipAt, kind: 'counter-roll', description: 'energy readings roll back to 0', intensity: 0.25 },
  ...flaps(T.flipAt, 2),
  { f: T.streamsDim, kind: 'hush', description: 'ambient streams fade: the stage clears for one photon', intensity: 0.3 },
  { f: T.photonEmit, kind: 'high-sine', description: 'ONE gold photon leaves the Sun: a single pure high sine begins (sustain until the unzip ends)', intensity: 0.6 },
  { f: T.photonLand, kind: 'impact', description: 'the photon lands on the limb: soft bright impact + flash, slow-motion', intensity: 0.7 },
  { f: T.photonLand + 2, kind: 'counter-tick', description: '收 counter 0 → 1 (gold)', intensity: 0.4 },
  ...Array.from({ length: 20 }, (_, i): Cue => ({
    f: unzipAt(i),
    kind: 'split-tone',
    description: `crest ${i + 1}/20 peels off → long red wave; a low sine (1/20 of the high one) is added; 还 counter → ${i + 1} at f${unzipAt(i) + 3}`,
    intensity: 0.25,
  })),
  { f: unzipAt(19) + 4, kind: 'resolve', description: 'high sine gone; twenty low sines sustain; → arrow appears (1 → 20)', intensity: 0.5 },
  ...flaps(T.entropyRow, 1),
  { f: T.entropyRow + 16, kind: 'counter-roll', description: 'entropy row rolls ≈0 → ≈20', intensity: 0.3 },
  { f: T.ghostStart, kind: 'crackle', description: 'ghost fans flicker (all the other ways out): granular shimmer, continuous until f318', intensity: 0.25 },
  { f: T.entropyRow + 26, kind: 'pen-line', description: 'double underline (final balance) draws', intensity: 0.3 },
  { f: CAP.c3.at + 34, kind: 'emphasis-hit', description: '“20倍” (largest type of the scene) condenses: deep hit', intensity: 0.6 },
  { f: T.hazeStart, kind: 'bloom', description: 'infrared ink bloom rises from the impact point: soft reverse swell + deep red rumble (until ~f390)', intensity: 0.5 },
  { f: T.hazeStart + 12, kind: 'bloom', description: 'smaller blooms rise all along the limb (staggered every ~6 f until ~f370)', intensity: 0.35 },
  { f: T.beamIn, kind: 'shimmer', description: 'the ordered parallel beam fades in: steady high shimmer', intensity: 0.3 },
  { f: T.ledgerOut, kind: 'dissolve', description: 'the ledger dissolves upward', intensity: 0.2 },
  { f: CAP.c4.at + 30, kind: 'ink-bleed', description: '散开 starts to bleed like ink', intensity: 0.3 },
  { f: T.diveStart, kind: 'dive', description: 'DIVE into the Earth: rising Shepard swell (zoom ×36), fastest at ~f430', intensity: 0.8 },
  { f: 414, kind: 'whoosh', description: 'camera passes through the red haze / clouds', intensity: 0.6 },
  { f: 428, kind: 'glint', description: 'river network of light glints on the land (shimmer)', intensity: 0.35 },
  { f: T.netGrowStart, kind: 'growth', description: 'leaf veins grow (dendritic crackle of tiny ticks, until f474)', intensity: 0.3 },
  { f: T.diveEnd, kind: 'land', description: 'zoom settles on the leaf rosette (soft landing, sustain)', intensity: 0.4 },
  { f: T.netGrowStart + 16, kind: 'pings', description: 'sunlight lands on vein tips: sparse tiny bell pings (random, continuous)', intensity: 0.15 },
  { f: T.netGrowStart + 24, kind: 'sparks', description: 'red IR sparks leave every junction: soft crackle (continuous, grows in the vortex)', intensity: 0.2 },
  { f: YOU_AT, kind: 'heartbeat', description: '你 brightens alone; the sink takes one deep warm beat', intensity: 0.7 },
  { f: T.swirlStart, kind: 'vortex-swell', description: 'the flows twist into a whirlpool: rising swirl swell that carries straight into S07 (no silence at the cut)', intensity: 0.6 },
  { f: CAP.c5.at + CAP.c5.dur, kind: 'clear', description: 'last caption gone: picture only, swell keeps rising', intensity: 0.5 },
  { f: T.end, kind: 'cut', description: 'match cut to S07 (spiral sink → particle whirlpool), swell continues', intensity: 0.7 },
];

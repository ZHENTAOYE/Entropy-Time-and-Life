// S03 sound cues (scene-local frames) for scripts/audio/score.py. `kind` keywords follow score.py's cue_sound():
// tick/collision/click/type -> tick, crackle/rain -> crackle, impact/slam -> impact, stamp/settle -> stamp,
// strike -> strike, whoosh/sweep/zoom/dissolve -> whoosh, glitch -> glitch, shimmer/sparkle/glint -> high bell,
// chime/reveal/pop -> bell, swell/rise -> swell; silence/hum/hold belong to the bed.
// Every frame is derived from the beat clock (constants.ts `T`) or from the exact closed-form gas (count.ts), so the
// cues cannot drift from the picture.
import { T } from './constants';
import { BOUNCES, CROSSINGS, LETTERS } from './count';

export interface Cue {
  frame: number;
  kind: string;
  description: string;
  intensity: number;
}

const cue = (frame: number, kind: string, description: string, intensity: number): Cue => ({ frame: Math.round(frame), kind, description, intensity });

/** the gas of beat 1: every crossing of the old divider line (the microstate changes) and every wall bounce */
function gasCues(): Cue[] {
  const out: Cue[] = [];
  for (const [f, i] of CROSSINGS) {
    out.push(cue(f, 'tick', `${LETTERS[i]} crosses the middle — its ledger letter hops bins, a new microstate column on the tape`, 0.5));
  }
  const per = new Map<number, number>();
  for (const f of BOUNCES) per.set(f, (per.get(f) ?? 0) + 1);
  for (const [f, n] of per) out.push(cue(f, 'collision', n > 1 ? `${n} particles hit the walls on the same frame` : 'a particle bounces off a wall', n > 1 ? 0.45 : 0.3));
  return out;
}

export const CUES: Cue[] = [
  // ── card 1 · 4个粒子，数一数。
  cue(T.click, 'click', '「咔」 colour-temperature flip: S02’s cyan box + 4 dots become amber (light pulse peaks f1)', 0.75),
  cue(T.labels, 'type', 'labels A B C D type on next to the dots; HUD FIG.03 COUNTING MICROSTATES; C1 「4个粒子，数一数。」 condenses', 0.2),
  cue(T.dividerLift, 'impact', 'the divider lifts out of the box (clack, slides up 10–20)', 0.45),
  ...gasCues(),
  cue(T.release + 54, 'hum', 'the gas decelerates (66–74)', 0.1),
  cue(T.shutter, 'stamp', 'SHUTTER: the gas freezes in white viewfinder brackets — one snapshot = one microstate (C D left, A B right)', 0.6),
  // ── card 2 · the 16 worlds
  cue(T.deal, 'whoosh', 'the frozen box shrinks into its cell of a 4×4 table (78–92)', 0.35),
  cue(T.deal + 6, 'tick', 'the 15 other arrangements peel off the original one by one, every 1.3 f (84–102), rippling outward', 0.3),
  cue(T.deal + 15, 'tick', 'peel ripple continues (copy 8 of 15)', 0.25),
  cue(T.deal + 24, 'tick', 'last copy lands — 16 worlds on screen', 0.3),
  cue(T.sort, 'sweep', 'FLIP: the 16 worlds fly into five columns 1 · 4 · 6 · 4 · 1 (108–141, staggered 1.1 f)', 0.45),
  cue(T.sort + 16, 'tick', 'worlds land in their columns (124–141), soft ticks', 0.25),
  // ── card 3 · 全在左边：1种 / 左右各半：6种
  cue(T.sort + 24, 'pop', 'column counts appear 1 4 6 4 1 (132–140)', 0.4),
  cue(T.c3a, 'type', 'C3 line 1 「全在左边：」 condenses', 0.2),
  cue(T.c3a + 8, 'slam', 'monumental white 「1」 slams in; the all-left world gets white brackets + 1/16', 0.6),
  cue(T.c3b, 'type', 'C3 line 2 「左右各半：」 condenses', 0.2),
  cue(T.c3b + 8, 'slam', 'monumental amber 「6」 slams in; the 2:2 column brackets and glows (swell under it)', 0.7),
  cue(T.toBars, 'glitch', 'the worlds compress into 4-bit barcodes (zip); card 3 diffuses (204–228)', 0.35),
  // ── card 4 · N = 10 → 100 → 10⁴
  cue(T.rain, 'rain', 'N = 10 Galton board: 1024 microstates bounce through 10 rows of pegs (one bounce per bit) and stack; dense crackle 214–251, peak ~232', 0.7),
  cue(T.rain + 18, 'pop', 'width bracket 「宽度 ±16 %」 over the bell', 0.3),
  cue(T.rain + 37, 'tick', 'last microstate lands: the counts read 1 10 45 120 210 252 210 120 45 10 1', 0.35),
  cue(T.n100, 'sweep', 'N = 100: the bell narrows into 101 striped bars (±5 %)', 0.4),
  cue(T.n1e4, 'whoosh', 'N = 10⁴: the bell squeezes into a glowing needle (±0.5 %) — rising pitch', 0.5),
  // ── card 5 · 100个粒子全在左边：约 10⁻³⁰
  cue(T.lottery, 'glitch', 'the chart drops away; a data curtain of random 100-bit trials unrolls (288–306)', 0.55),
  cue(T.lottery + 6, 'shimmer', 'waterfall shimmer bed (288–392): uniform grey-amber noise, HITS stays 0 — maximum entropy looks like noise', 0.2),
  cue(T.c5, 'type', 'TARGET row pins in white, TRIALS counter runs; C5 「100个粒子全在左边：」 condenses', 0.25),
  cue(T.c5num, 'impact', 'MONUMENTAL 「约 10⁻³⁰」 slams in on a black slab (biggest hit so far)', 0.9),
  cue(T.c5num + 18, 'type', '「2⁻¹⁰⁰ = 7.9 × 10⁻³¹」 types on under it', 0.2),
  // ── card 6 · the glass of water
  cue(T.glass, 'rain', 'the waterfall dissolves into loose bits that pour into a glass of water (372–410)', 0.45),
  cue(T.glass + 2, 'sweep', 'the glass draws on as a technical drawing', 0.3),
  cue(T.c6, 'type', 'C6 「一杯水，约 10²⁵ 个分子——」 condenses; labels 250 mL / N ≈ 8×10²⁴ (398)', 0.2),
  cue(T.c6 + 20, 'type', 'C6 line 2 「全挤到一边的概率：」', 0.2),
  cue(T.squeeze, 'whoosh', 'HYPOTHETICAL: all molecules crowd into the left half (white), right half hatched 「空」 (436–456)', 0.5),
  cue(T.squeeze + 20, 'silence', 'held tension: the impossible state (456–474)', 0.1),
  cue(T.relax, 'whoosh', 'release: the molecules spread back on their own (474–496) — the arrow again', 0.45),
  // ── card 7 · 每个零，只占1毫米。
  cue(T.row - 6, 'whoosh', 'the glass shrinks to an icon at the start of the row (482–504)', 0.25),
  cue(T.row, 'type', '「0.000…」 types out at y 960, rapid ticks (1.6 zeros per frame, 488–520)', 0.4),
  cue(T.c7, 'type', 'C7 「每个零，只占1毫米。」 condenses', 0.15),
  cue(T.c7 + 4, 'pop', 'the 「1 mm」 dimension callout over the third zero', 0.3),
  cue(T.ride, 'whoosh', 'the camera starts riding along the row (accelerating, zeros streak); ZEROS counter spins', 0.4),
  // ── card 8 · powers of ten
  cue(T.zoom, 'zoom', 'POWERS OF TEN: endless rising Shepard tone 556–668 (zeros → dots → a line of light)', 0.7),
  cue(578 - 8, 'pop', 'scale label 书桌 ≈ 1 m (the glass on the desk at the row start)', 0.3),
  cue(600 - 8, 'pop', 'scale label 城市 ≈ 10 km', 0.3),
  cue(620 - 8, 'pop', 'scale label 地球 ≈ 1.3×10⁴ km (the row leaves the Earth tangentially)', 0.3),
  cue(643 - 8, 'pop', 'scale label 太阳系 ≈ 60 AU', 0.3),
  cue(645, 'whoosh', 'star layers stream past (fastest part of the zoom, 645–660)', 0.5),
  // ── card 9 · 这串零，比银河系还长。
  cue(T.c9, 'type', 'C9 「这串零，比银河系还长。」 condenses', 0.15),
  cue(T.zoomEnd, 'reveal', 'the amber Milky Way has materialised around the row’s start (the Sun); the zoom stops (Shepard tone resolves)', 0.8),
  cue(T.zoomEnd + 4, 'shimmer', 'light pulses start reading along the finished row (672–830)', 0.15),
  cue(T.dims, 'sweep', 'dimension line 银河系 ≈ 10⁵ 光年 draws (676–698)', 0.3),
  cue(T.dims + 10, 'sweep', 'dimension line 这一行 ≈ 2.6×10⁵ 光年 draws (686–710); light-year ruler ticks on (706–726)', 0.3),
  // ── card 10 · 聚回来，不是不可能——只是太不可能。
  cue(T.c10, 'chime', 'C10 golden line 1 「聚回来，不是不可能——」', 0.4),
  cue(T.c10 + 20, 'chime', 'C10 line 2 「只是太不可能。」 (gold, 太 white) — the film’s first golden line', 0.6),
  // ── card 11 · 熵
  cue(T.galaxyOut, 'swell', 'the galaxy dissolves into warm gas (826–848) while the row settles onto the handoff line; a swell begins', 0.4),
  cue(T.needle, 'whoosh', 'the glass’s histogram needle (N ≈ 10²⁵) shoots up out of the line (rising)', 0.6),
  cue(T.glyph, 'shimmer', 'the needle’s particles unfold into the glyph 熵 (844–866)', 0.5),
  cue(T.glyph + 8, 'pop', 'pinyin 「shāng」 condenses above', 0.25),
  cue(T.glyphLock, 'impact', '熵 LOCKS crisp (flash) — the first appearance of the word', 0.85),
  // ── card 12 · S = k log W
  cue(T.formula - 8, 'shimmer', '熵 breaks back into particles (882–888) that stream into the S of the formula (888–906)', 0.45),
  cue(T.c12, 'type', 'C12 「玻尔兹曼墓碑上的公式」 (small)', 0.15),
  cue(T.formula - 4, 'impact', 'the granite stele rises onto the line (low thud)', 0.5),
  cue(T.formula + 12, 'glitch', 'carving sweep: 「= k log W」 is cut left → right into the stone with a white spark (902–922); W fills with microstates', 0.4),
  cue(T.formula + 28, 'type', 'inscription L. BOLTZMANN · 1844 – 1906 · WIEN, ZENTRALFRIEDHOF', 0.15),
  cue(T.formula + 34, 'glint', 'specular glint sweeps the gold leaf (924–956)', 0.4),
  cue(T.formula + 36, 'type', 'note 「那串零有多长，熵就差多少」 under W', 0.15),
  // ── card 13 · 熵不是“乱”。它数的是：多少种微观排列，看起来一模一样。
  cue(T.c13, 'type', 'C13 line 1 「熵不是“乱”。」; the stele sinks away (940–956)', 0.2),
  cue(T.c13 + 12, 'type', 'C13 line 2 「它数的是：多少种微观排列，」', 0.2),
  cue(T.boxes6, 'tick', 'the six 2:2 worlds appear one by one: 958, 962, 966, 970, 974, 978', 0.3),
  cue(T.c13 + 24, 'strike', `STRIKE: a red line cuts through 乱 (${T.c13 + 24}–${T.c13 + 32}), 乱 dims`, 0.55),
  cue(T.c13 + 26, 'type', 'C13 line 3 「看起来一模一样。」', 0.2),
  cue(T.coarse, 'dissolve', `coarse-graining: each world’s particles smear into the same even stipple (${T.coarse}–${T.coarse + 16}) — all six look identical`, 0.35),
  cue(T.merge, 'whoosh', `the six slide together into one (${T.merge}–${T.merge + 18})`, 0.4),
  cue(T.merge + 8, 'pop', '「W = 6」 — six arrangements, one look', 0.45),
  cue(T.collapse, 'swell', `the box flattens and stretches into the row (${T.collapse}–${T.collapse + 24})`, 0.45),
  cue(T.collapse + 12, 'rise', `the line brightens into S04’s glowing amber line (${T.collapse + 12}–${T.lineOnly - 4})`, 0.35),
  cue(T.c13End - 23, 'shimmer', `C13 diffuses (${T.c13End - 23}–${T.c13End - 1})`, 0.15),
  cue(T.lineOnly - 4, 'chime', 'the single glowing amber line, 90 → 990 — everything has resolved into it', 0.5),
  cue(T.c13End, 'hum', 'OUT (1086–1091): the line alone on #070604 — low hum only, into S04', 0.1),
].sort((a, b) => a.frame - b.frame);

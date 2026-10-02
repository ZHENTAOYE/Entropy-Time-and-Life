// S03 数一数 / Counting — palette, layout and the beat clock (scene-local frames, 1092 total).
import { BOX, P4, P4_R, ZERO_LINE } from '../../lib/handoff';

export const DUR = 1092;

export const C = {
  bg: '#070604',
  grid: '#1C1409',
  gridMajor: '#2E200C',
  amber: '#FF9F2E',
  pale: '#FFE3A3',
  white: '#FFFFFF',
  strike: '#FF5A36',
  voice: '#F3EFE6',
  goldDeep: '#B8691A',
  ember: '#7A4310',
} as const;

export { BOX, P4, P4_R, ZERO_LINE };

/** S02 blueprint grid geometry (50 px cells centred on (540, 900)), recoloured amber. */
export const GRID = { ox: 540, oy: 900, minor: 50, major: 200 } as const;

/** The histogram axis: fraction of particles on the LEFT, plotted spatially (all-left at the left). */
export const AX = { x0: 150, x1: 930, base: 1120, h: 560 } as const;
/** x of a column with fraction p = k/N on the left */
export const axX = (p: number) => AX.x1 - p * (AX.x1 - AX.x0);

/** The beat clock. Every visual event of the scene is keyed to one of these frames. */
export const T = {
  // ── card 1 · 4个粒子，数一数。 (0.0–2.2 s)
  click: 0, // cyan → amber flip on 「咔」
  labels: 4,
  c1: 6,
  dividerLift: 10, // divider rises out of the box 10–20 (clack)
  release: 12, // particles may cross from here (closed-form switch of the wall)
  freeze: 74, // the gas decelerates 66–74 and stops: one snapshot = one microstate
  shutter: 74,
  // ── card 2 · 16 arrangements (2.2–4.4 s)
  deal: 78, // the big box shrinks into its cell 78–92; the 15 others peel off it 84–104
  sort: 108, // FLIP into five columns 108–136 (stagger 1 f by code)
  // ── card 3 · 全在左边：1种 / 左右各半：6种 (4.4–7.4 s)
  c3a: 138,
  c3b: 160,
  c3End: 218,
  // ── card 4 · N = 10 → 100 → 10⁴ (7.4–9.4 s)
  toBars: 204, // boxes compress into 4-bit barcodes 204–218
  rain: 214, // N = 10 Galton board: spawns 214–230, all landed by ~251
  n100: 254, // morph 254–268
  n1e4: 270, // morph to the needle 270–284
  // ── card 5 · 100个粒子全在左边：约 10⁻³⁰ (9.4–12.4 s)
  lottery: 288, // the data curtain falls 288–306
  c5: 294,
  c5num: 306,
  c5End: 374,
  // ── card 6 · glass of water (12.4–16.2 s)
  glass: 366,
  c6: 374,
  squeeze: 436, // molecules crowd to one side 436–456, hold, relax 474–494
  relax: 474,
  c6End: 506,
  // ── card 7 · 每个零，只占1毫米。 (16.2–18.4 s)
  row: 488, // 「P = 0.」 + zeros type on 488–508
  c7: 504,
  ride: 522, // camera rides along the row (accelerating)
  c7End: 576,
  // ── card 8 · powers of ten (18.4–22.0 s)
  zoom: 556,
  zoomEnd: 668,
  // ── card 9 · 这串零，比银河系还长。 (22.0–24.6 s)
  c9: 664,
  dims: 676,
  c9End: 742,
  // ── card 10 · 聚回来，不是不可能——只是太不可能。 (24.6–27.8 s)
  c10: 742,
  c10End: 840,
  // ── card 11 · 熵 (27.8–29.4 s)
  galaxyOut: 826,
  needle: 834,
  glyph: 844,
  glyphLock: 864,
  // ── card 12 · S = k log W (29.4–31.8 s)
  formula: 890,
  c12: 892,
  c12End: 960,
  // ── card 13 · 熵不是“乱”。… (31.8–36.4 s)
  c13: 948,
  boxes6: 958,
  coarse: 1004,
  merge: 1020,
  collapse: 1044,
  c13End: 1084,
  lineOnly: 1080,
} as const;

/** Row of zeros: each zero is exactly 1 mm. Mono 72 px → advance 43.2 px = 1 mm at the start. */
export const ROW = {
  y: ZERO_LINE.y,
  x0: ZERO_LINE.x0,
  font: 72,
  adv: 43.2, // px per zero at the start
  /** zeros needed: 2⁻ᴺ with N ≈ 8.3×10²⁴ molecules (a 250 mL glass) → N·log₁₀2 ≈ 2.5×10²⁴ zeros */
  nZeros: 2.5e24,
  /** total length in metres (1 mm per zero) */
  lengthM: 2.5e21,
} as const;
/** final framing: the whole row spans x 90 → 990 */
export const LY = 9.4607e15; // m per light-year

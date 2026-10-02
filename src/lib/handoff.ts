// Shared constants for match cuts between scenes and the film-wide colour language.
// A scene's LAST frame and the next scene's FIRST frame must agree on these exactly.

/** Film-wide colour meanings (fixed for the whole film). */
export const COLOR = {
  /** low entropy / free energy: the arrow, the last point, sunlight, tracer particle, neurons */
  orderGold: '#FFC94A',
  /** degraded energy / infrared / waste heat; also "falling entropy = fake/rewind" alarms */
  wasteRed: '#FF3B2F',
  alarmRed: '#FF3B5C',
  /** time-symmetric physics (laws of motion) */
  lawCyan: '#39E1FF',
  /** gravity / the cosmic web */
  gravityViolet: '#8E5BFF',
  /** narration voice (warm white) — the one constant */
  voice: '#F3EFE6',
  /** ink-on-cream text colour (S01 / S09 tank scenes) */
  inkText: '#17151C',
  /** amber of the counting scene (S03) */
  amber: '#FF9F2E',
} as const;

/** S01 → S02: the dot of the final 「？」 (S01 draws it as a circle here; S02 starts from it). */
export const Q_DOT = { x: 744, y: 1000, r: 10 } as const;

/** S02 → S03: the box with divider and 4 particles (S02 ends cyan, S03 starts identical but amber). */
export const BOX = { x0: 190, y0: 700, x1: 890, y1: 1100, divider: 540 } as const;
export const P4: ReadonlyArray<readonly [number, number]> = [
  [292, 812],
  [432, 902],
  [318, 1006],
  [470, 1038],
];
export const P4_R = 10;

/** S03 → S04: the glowing amber line (the row of zeros) that becomes the arrow of time. */
export const ZERO_LINE = { x0: 90, x1: 990, y: 960, width: 2 } as const;

/** S05 → S06: the last gold point inside the grey (becomes the Sun / the photon). */
export const GOLD_POINT = { x: 540, y: 820, r: 3.5 } as const;
export const HEAT_DEATH_GREY = '#5C5C5C';

/** S06 → S07: the spiral sink of the branching light flows (becomes the vortex). */
export const SPIRAL = { x: 540, y: 860, r: 420 } as const;

/** S07 → S08: two residual thermal footprints on a cold floor, top view (toes pointing up). */
export const FEET = {
  left: { x: 500, y: 990 },
  right: { x: 582, y: 950 },
  length: 150,
  floor: '#05030F',
} as const;

/** S08 → S09: the gold-line human with the neural network glowing in the head. */
export const FIGURE_S08 = { cx: 540, groundY: 1610, height: 1300, bg: '#0A0705' } as const;

/** S01 / S09 ink tank: water surface hairline y. */
export const WATER_LINE_Y = 360;

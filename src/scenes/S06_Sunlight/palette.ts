// S06 palette (visual-direction §2.6) — hard key light from the top (the Sun).
export const P = {
  space: '#04050B',
  spaceHi: '#0A0C1A',
  sunCore: '#FFF7E0',
  sunGold: '#FFC94A',
  sunEdge: '#FF8A1F',
  earth: '#0A2742',
  earthDeep: '#061527',
  rim: '#5BC8FF',
  ir: '#FF3B2F',
  irDeep: '#7A0E1A',
  irHot: '#FF6A3D',
  gold: '#FFC94A',
  leaf: '#9EE06A',
  teal: '#2CC5A6',
  voice: '#F3EFE6',
  grey: '#5C5C5C',
  hair: 'rgba(243,239,230,0.22)',
} as const;

/** Earth geometry (side view). Top of the limb at y = EARTH.cy - EARTH.r = 1290: the whole photon stage (impact,
 *  unzip, ghost fans) happens ABOVE the narration lane; captions (y≈1440) sit over the Earth's calm dark face. */
export const EARTH = { cx: 540, cy: 2410, r: 1120 } as const;
/** Sun geometry (side view) once fully formed. Bottom limb at y = SUN.cy + SUN.r = 240. */
export const SUN = { cx: 540, cy: -190, r: 430 } as const;
export const LIMB_Y = EARTH.cy - EARTH.r; // 1290
export const SUN_BOTTOM = SUN.cy + SUN.r; // 240

/** y of the Earth's limb at x (side view). */
export const limbY = (x: number) => EARTH.cy - Math.sqrt(Math.max(0, EARTH.r * EARTH.r - (x - EARTH.cx) * (x - EARTH.cx)));

/** the narration lane (captions): keep busy imagery dim in here */
export const LANE = { y0: 1370, y1: 1530 } as const;

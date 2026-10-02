// S02 对称 — layout, palette and the beat clock (scene-local frames, 522 total).
import { BOX, P4, P4_R, Q_DOT } from '../../lib/handoff';

export const DUR = 522;

export const C = {
  bg: '#03070C',
  gridMinor: '#0B2230',
  gridMajor: '#12394A',
  cyan: '#39E1FF',
  cyanDeep: '#1A8FB0',
  core: '#E6FCFF',
  red: '#FF3B5C',
  gold: '#FFC94A',
  voice: '#F3EFE6',
} as const;

// Blueprint grid: 50 px cells centred on (540, 900) so the S03 BOX (190,700)-(890,1100) sits on grid lines.
export const GRID = { ox: 540, oy: 900, minor: 50, major: 200 } as const;

// Two stacked 2:1 panels (a pool table each) and the gutter between them.
export const PANEL_W = 900;
export const PANEL_H = 450;
export const PA = { x: 90, y: 300 } as const;
export const PB = { x: 90, y: 900 } as const;
export const GUTTER_Y = 825;
export const LANE_Y = 1500; // narration lane under panel B

export { BOX, P4, P4_R, Q_DOT };

/** The beat clock. Every visual event in the scene is keyed to one of these frames. */
export const T = {
  // opening
  ping: 6,
  mitosis1: 10, // stretch starts
  pinch: 18, // first division (Q_DOT -> A, B)
  arrive: 30,
  mitosis2: 28, // second division (each daughter -> 2 balls)
  panelsOn: 14,
  // 2-ball run (recording time = frame - run2)
  run2: 36,
  run2End: 128, // = run2 + TWO_T
  collide2: 82, // midpoint: both panels show the contact on the same frame
  slowEnd: 146,
  // countdown (matches the score bed: 2.4 s / 3.1 s / 3.8 s)
  count: [72, 93, 114] as const,
  qStamp: 134,
  // the law (no audit: the picture leads and C3 confirms — the equations write on while 「分不出来。」 is still up)
  eqIn: 150,
  subst: 166, // t -> (−t)
  twin: 174, // second minus born from the square
  annihilate: 188,
  collapse: 192,
  invariant: 204, // 「t → −t ：不变 ✓」 complete by f212, held fully opaque to f252 (1.3 s)
  eqOut: 254,
  // escalation
  wipe10: 260,
  run10: 268,
  run10End: 314,
  wipe400: 314,
  run400: 322,
  run400End: 390,
  verdictQ: 274,
  verdict1: 306,
  verdict2: 390,
  // the answer: clocks switch, stamps ▶ 正放 / ◀◀ 倒放 land and B's frame turns red together (2 f after the !!)
  reveal: 392,
  // B's push-in on the condensing drop (released by the !! shake)
  pushIn: 366,
  // resolution: C6 「方向，出现了。」 390-450 is crisp ~412-436 (gold arrows grow 398-418); the gutter clears 396-412;
  // B's tape is pulled out of its panel (gone by 436); the panels retract 426-444
  panelsOut: 426,
  swarm: 426, // launches 426-433, 20 f flights biased downward -> clear of card 7 line 1 (y 640) by f444, 很多 by f453
  swarmLand: 453,
  c7Line1: 442, // C7 condenses after the swarm has crossed line 1: line 1 + 「藏在“」 at 442, 「”之中。」 at 446
  c7Exit: 498, // the full sentence is complete ~f464 and holds to 498 (1.1 s), then diffuses (14 f), gone by 512
  evaporate: 496, // "many" evaporates 496-514 (12 f per ball, spread 6); survivors glide 496-512, grow to r = 10 by 514
  boxDraw: 500, // the S03 box closes symmetrically from the top/bottom centre 500-514 (its sides meet at y = 900 last)
  dividerDraw: 506, // divider drops 506-516
  outHold: 516, // f516-521: static OUT frame
} as const;

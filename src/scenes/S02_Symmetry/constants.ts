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
  // conservation audit: both panels draw Σp tip to tail (before, then after) and the KE bars — both runs are lawful
  audit: 146,
  auditLandA: 162, // A's after-chain closes on its before-chain
  auditLand: 168, // B's after-chain closes on its before-chain (chime)
  // the law
  eqIn: 186,
  subst: 198, // t -> (−t)
  twin: 206, // second minus born from the square
  annihilate: 220,
  collapse: 224,
  invariant: 236, // 「t → −t ：不变 ✓」 fully shown f244-256
  eqOut: 258,
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
  // resolution: C6 「方向，出现了。」 390-438 is crisp ~409-424 over static panels; the panels retract only after it
  panelsOut: 428,
  swarm: 434, // launches 434-441, 22 f flights -> 很多 complete by f463
  swarmLand: 463,
  c7Line1: 436, // C7 line 1 condenses as C6 finishes diffusing (2 f crossfade, different lane)
  c7Exit: 498, // the full sentence holds until here, then diffuses (16 f)
  evaporate: 498, // "many" evaporates with the text, 498-516 (12 f per ball, spread 6); survivors glide 498-514
  boxDraw: 502,
  dividerDraw: 507,
  outHold: 516, // f516-521: static OUT frame
} as const;

// What a thermal camera sees on a resting, clothed-less person at ~22 °C room temperature, as an index on the
// 20–37 °C colour bar ((T − 20)/17). Box coordinates of HUMAN_PATH (600 × 1420, x mirrored about 300).
//   hottest (0.95–1.0, 36–37 °C): inner canthi of the eyes, neck (carotid), armpits, groin
//   warm (0.89–0.93): forehead (SP1 35.4 °C), cheeks, mouth, chest
//   abdomen 0.84 · upper arms / thighs 0.78–0.82 · forearms 0.7 (superficial veins +0.07) · calves 0.68
//   cool: nose 0.72 (tip 0.66), ears 0.66, hair 0.62, hands 0.52, feet 0.45
//   + edges run cooler (emissivity at grazing angles), + two octaves of low-amplitude skin mottling.
import { clamp, smoothstep } from '../../lib/math';
import { makeNoise } from '../../lib/noise';

const noise = makeNoise(4711);

/** smooth bump: 1 inside radius r of (cx, cy), 0 beyond r·(1 + soft) */
const bump = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, soft = 0.6) => {
  const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
  return 1 - smoothstep(1, 1 + soft, d);
};

/** distance from (x, y) to the polyline P (flat [x0,y0,x1,y1,…]) */
function polyDist(x: number, y: number, P: number[]): number {
  let best = 1e9;
  for (let k = 0; k + 3 < P.length; k += 2) {
    const ax = P[k];
    const ay = P[k + 1];
    const dx = P[k + 2] - ax;
    const dy = P[k + 3] - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

// superficial veins (right half; mirrored): forearm cephalic / basilic / median, the external jugular, the temple
const VEINS: number[][] = [
  [468, 600, 474, 650, 480, 700, 488, 760, 494, 795],
  [446, 604, 452, 650, 460, 700, 470, 770],
  [456, 640, 464, 690, 476, 735],
  [316, 222, 324, 248, 333, 282],
  [346, 96, 352, 118, 350, 134],
];

/** skin temperature index at box point (bx, by); dd = depth inside the silhouette (world px); X, H world (mottling) */
export function skinTemp(bx: number, by: number, dd: number, X: number, H: number): number {
  const x = 300 + Math.abs(bx - 300);
  const ax = x - 300;
  let t: number;
  if (by < 214) {
    // ---- head
    const eyeBand = bump(ax, by, 24, 138, 22, 8);
    t = 0.89;
    t += 0.03 * bump(ax, by, 0, 112, 46, 16); // forehead → 0.92
    t = Math.max(t, 0.9 * eyeBand + t * (1 - eyeBand));
    t += (1.0 - t) * bump(ax, by, 12, 137, 6, 5, 0.9); // inner canthus
    const nose = bump(ax, by, 0, 158, 8, 18, 0.5);
    t += (0.72 - t) * nose;
    t += (0.66 - t) * bump(ax, by, 0, 174, 7, 5, 0.6); // nose tip
    t += (0.93 - t) * bump(ax, by, 0, 199, 18, 6, 0.6); // mouth
    t += (0.66 - t) * bump(ax, by, 58, 146, 6, 18, 0.5); // ears
    const hair = 1 - smoothstep(70, 90, by);
    const hairSide = smoothstep(0.86, 0.98, Math.hypot(ax / 58, (by - 138) / 76)) * (1 - smoothstep(104, 120, by));
    t += (0.62 - t) * Math.max(hair, hairSide);
  } else {
    // ---- body
    const neck = (1 - smoothstep(262, 282, by)) * (1 - smoothstep(24, 34, ax));
    const arm = smoothstep(104, 118, ax) * smoothstep(300, 330, by) * (1 - smoothstep(880, 900, by));
    const legs = smoothstep(860, 900, by);
    // trunk
    let trunk = 0.9;
    trunk += 0.03 * bump(ax, by, 0, 400, 30, 90); // sternum
    trunk += (0.84 - trunk) * smoothstep(520, 620, by); // abdomen
    trunk += (1.0 - trunk) * bump(ax, by, 106, 418, 14, 20, 0.8); // armpit
    trunk += (0.96 - trunk) * bump(ax, by, 0, 862, 40, 22, 0.8); // groin
    trunk += (0.8 - trunk) * smoothstep(60, 110, ax) * smoothstep(300, 340, by) * (1 - smoothstep(380, 420, by)); // shoulders
    // arms: shoulder → elbow → hand
    let armT = 0.8 - 0.1 * smoothstep(560, 640, by);
    armT += (0.52 - armT) * smoothstep(770, 805, by);
    // legs: inner thigh → knee → calf → foot
    let legT = 0.8 + 0.06 * (1 - smoothstep(30, 70, ax)) * (1 - smoothstep(900, 1000, by));
    legT += (0.71 - legT) * smoothstep(1060, 1130, by);
    legT += (0.68 - legT) * smoothstep(1130, 1200, by);
    legT += (0.45 - legT) * smoothstep(1320, 1360, by);
    t = trunk;
    t += (legT - t) * legs * (1 - arm);
    t += (armT - t) * arm;
    t += (0.95 - t) * neck;
  }
  // superficial veins
  for (const V of VEINS) {
    const d = polyDist(x, by, V);
    if (d < 5) t += 0.07 * (1 - d / 5);
  }
  // edges run cooler; thin parts (hands, feet) carry less core heat
  t -= (by < 214 ? 0.03 : 0.07) * (1 - smoothstep(0, 9, dd));
  // skin mottling (two octaves, low amplitude)
  t += 0.022 * noise.n2(X * 0.025, H * 0.025) + 0.012 * noise.n2(X * 0.08 + 31, H * 0.08 - 7);
  return clamp(t, 0.4, 1);
}

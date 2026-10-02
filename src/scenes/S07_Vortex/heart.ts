// The heartbeat (60 bpm, lub-dub): heat pulses run outward from the heart through the body and the vessels flash.
// It stops during the freeze and restarts with the flow — the first beat is the restart.
import { HEART } from './body';
import { T } from './timing';

export const BEATS: number[] = (() => {
  const b: number[] = [];
  for (let t = 396; t < T.freeze0 - 8; t += 30) b.push(t);
  for (let t = T.restart; t < T.dissolve0 + 10; t += 30) b.push(t);
  return b;
})();

function lastBeat(f: number): number {
  let tb = -1e9;
  for (const b of BEATS) if (b <= f) tb = b;
  return tb;
}

/** 0..1 heat pulse at distance d (world px) from the heart */
export function beatPulse(f: number, X: number, H: number): number {
  const tb = lastBeat(f);
  const d = Math.hypot(X - HEART[0], H - HEART[1]);
  let p = 0;
  for (const [off, amp] of [
    [0, 1],
    [8, 0.55],
  ] as const) {
    const a = f - tb - off;
    if (a < 0 || a > 40) continue;
    p += amp * Math.exp(-(((d - 26 * a) / 55) ** 2)) * Math.exp(-a / 18);
  }
  return p;
}

/** 0..1 global flash right after a beat (vessels) */
export function beatFlash(f: number): number {
  const a = f - lastBeat(f);
  if (a < 0 || a > 24) return 0;
  return Math.exp(-a / 6) + 0.5 * (a >= 8 ? Math.exp(-(a - 8) / 6) : 0);
}

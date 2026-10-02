// S09 B5–B7: the water of the tank. ONE velocity field moves every ink in the scene (the web's ink, the released
// figure, the melted ◀◀, the title): "one ink, one physics".
import { smoothstep } from '../../lib/math';

// ───────────────────────────── the flow ─────────────────────────────
// A closed-form, divergence-free velocity field (full-res px/s):
//   * sinking whose speed varies ACROSS the tank (vy = S(x): ∂vy/∂y = 0, divergence-free by itself) — where it sinks
//     faster the filaments are drawn down into hanging veils and fingers;
//   * stream-function modes from large (the whole pattern bends and drifts) to small (curls) — the small ones switch
//     on later: the stirring cascades down to finer eddies as the tank's motion develops.
// The ink at τ is the initial density pulled back through the FLOW MAP of this field (RK2, back-traced from τ to 0 on
// a coarse grid): filaments stretch thin and fold like real advection and never tear. A pure function of τ.
type Mode = readonly [number, number, number, number, number, number]; // kx, ky, U (px/s), ω, φ, onset (s)
const MODES: ReadonlyArray<Mode> = [
  [0.0066, 0.0043, 12, 0.19, 0.4, 0],
  [-0.0047, 0.0074, 10, 0.15, 2.1, 0],
  [0.0205, 0.0128, 9, 0.31, 4.4, 0.3],
  [-0.0158, 0.0236, 8, 0.27, 5.3, 0.8],
  [0.0262, -0.0187, 7, 0.38, 1.1, 1.3],
  [0.046, 0.0305, 4.6, 0.5, 3.3, 3.0],
  [-0.0385, 0.0515, 4.2, 0.45, 0.9, 3.6],
];
const MU = MODES.map(([kx, ky, U]) => {
  const k = Math.hypot(kx, ky);
  return [(U * ky) / k, (-U * kx) / k] as const;
});
/** the last velocity velAt computed: [vx, vy] (px/s) — no allocation in the inner loops */
export const V = new Float64Array(2);
/** velocity of the tank's water at (x, y) full-res px, τ s after the hand-over */
export function velAt(x: number, y: number, t: number) {
  let vx = 0,
    vy = 0;
  for (let m = 0; m < MODES.length; m++) {
    const md = MODES[m];
    const on = t <= md[5] ? 0 : t >= md[5] + 2.5 ? 1 : smoothstep(md[5], md[5] + 2.5, t);
    if (on === 0) continue;
    const c = Math.cos(md[0] * x + md[1] * y + md[3] * t + md[4]) * on;
    vx += MU[m][0] * c;
    vy += MU[m][1] * c;
  }
  const s = 9 + 6 * Math.sin(0.0093 * x + 0.8) + 4 * Math.sin(0.0217 * x + 2.3) + 1.2 * Math.sin(0.047 * x + 1.1);
  vy += Math.max(1.5, s) * (0.5 + 0.5 * smoothstep(0, 3, t));
  V[0] = vx;
  V[1] = vy;
}

/** where the water at (x, y) at time t1 was at time t0 < t1 (RK2 back-trace, steps ≤ 0.4 s) → [x0, y0] */
export function backTrace(x: number, y: number, t1: number, t0: number): [number, number] {
  const span = t1 - t0;
  if (span <= 0) return [x, y];
  const n = Math.max(1, Math.ceil(span / 0.4));
  const dt = span / n;
  let t = t1;
  for (let k = 0; k < n; k++) {
    velAt(x, y, t);
    const hx = x - V[0] * dt * 0.5,
      hy = y - V[1] * dt * 0.5;
    velAt(hx, hy, t - dt * 0.5);
    x -= V[0] * dt;
    y -= V[1] * dt;
    t -= dt;
  }
  return [x, y];
}



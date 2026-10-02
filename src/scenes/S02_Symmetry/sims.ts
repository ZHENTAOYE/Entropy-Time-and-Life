// S02 physics: every panel shows a *recorded* run of an ideal elastic hard-disc gas. Panel B is the very same
// recording indexed backward (exact reversal by construction). Everything is precomputed once (memo) and indexed
// by frame, so each video frame is a pure function of the frame number.
import { memo } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { PANEL_H, PANEL_W } from './constants';
import { DROP400 } from './drop400';

// ------------------------------------------------------------------ N = 2 : closed form (one oblique collision)
// Sim time unit = video frames (30 / s). Velocities in px / frame, positions in panel px.
export const TWO = (() => {
  const m1 = 1.5;
  const m2 = 1.0;
  const R1 = 36;
  const R2 = 29;
  const phi = (20 * Math.PI) / 180;
  const n: [number, number] = [Math.cos(phi), Math.sin(phi)];
  const cx = 450;
  const cy = 225;
  const c1: [number, number] = [cx - R1 * n[0], cy - R1 * n[1]];
  const c2: [number, number] = [cx + R2 * n[0], cy + R2 * n[1]];
  const u1: [number, number] = [5.44, 0.96];
  const u2: [number, number] = [-4.48, -1.12];
  const rel = (u1[0] - u2[0]) * n[0] + (u1[1] - u2[1]) * n[1];
  const k1 = ((2 * m2) / (m1 + m2)) * rel;
  const k2 = ((2 * m1) / (m1 + m2)) * rel;
  const v1: [number, number] = [u1[0] - k1 * n[0], u1[1] - k1 * n[1]];
  const v2: [number, number] = [u2[0] + k2 * n[0], u2[1] + k2 * n[1]];
  return { m: [m1, m2], R: [R1, R2], n, contact: [cx, cy] as [number, number], c: [c1, c2], u: [u1, u2], v: [v1, v2] };
})();
/** Length of the 2-ball "recording" in frames; the collision happens exactly in the middle. */
export const TWO_T = 92;
const TWO_TC = TWO_T / 2;

/** Position of ball i at recording time tau (frames). Valid for any tau (no wall contact in [-12, 102]). */
export function twoPos(i: 0 | 1, tau: number): [number, number] {
  const c = TWO.c[i];
  const vel = tau < TWO_TC ? TWO.u[i] : TWO.v[i];
  const d = tau - TWO_TC;
  return [c[0] + vel[0] * d, c[1] + vel[1] * d];
}
export function twoVel(i: 0 | 1, tau: number): [number, number] {
  return tau < TWO_TC ? TWO.u[i] : TWO.v[i];
}
export const TWO_TC_FRAME = TWO_TC;

// ------------------------------------------------------------------ generic hard-disc recorder
export interface DiscRun {
  n: number;
  frames: number;
  /** frames * n * 2 */
  pos: Float32Array;
  /** frames * n * 2 */
  vel: Float32Array;
  r: Float32Array;
  /** ball-ball collisions during the step that *ends* at frame f */
  hits: Uint16Array;
  /** coarse-grained entropy, normalised 0..1 (only meaningful for large n) */
  S: Float32Array;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
}

/** A recording that is simulated incrementally: `advance(k)` steps the (deterministic, sequential) simulation until
 * frames 0..k are recorded. A render tab only pays for the frames it actually shows — and because the steps always
 * run in the same order from frame 0, the recording is identical however (and in whatever order) it is requested. */
interface Recorder {
  run: DiscRun;
  advance: (upTo: number) => void;
}
function recorder(balls: Ball[], frames: number, substeps: number, cell: number): Recorder {
  const n = balls.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const r = new Float32Array(n);
  const im = new Float64Array(n);
  balls.forEach((b, i) => {
    x[i] = b.x;
    y[i] = b.y;
    vx[i] = b.vx;
    vy[i] = b.vy;
    r[i] = b.r;
    im[i] = 1 / b.m;
  });
  const pos = new Float32Array(frames * n * 2);
  const vel = new Float32Array(frames * n * 2);
  const hits = new Uint16Array(frames);
  const gw = Math.ceil(PANEL_W / cell) + 1;
  const gh = Math.ceil(PANEL_H / cell) + 1;
  const head = new Int32Array(gw * gh);
  const next = new Int32Array(n);
  const rec = (f: number) => {
    for (let i = 0; i < n; i++) {
      pos[(f * n + i) * 2] = x[i];
      pos[(f * n + i) * 2 + 1] = y[i];
      vel[(f * n + i) * 2] = vx[i];
      vel[(f * n + i) * 2 + 1] = vy[i];
    }
  };
  const S = new Float32Array(frames);
  rec(0);
  S[0] = entropyAt(pos, n, 0);
  let done = 0;
  const dt = 1 / substeps;
  const step = (f: number) => {
    let h = 0;
    for (let s = 0; s < substeps; s++) {
      for (let i = 0; i < n; i++) {
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
        const ri = r[i];
        if (x[i] < ri) {
          x[i] = 2 * ri - x[i];
          vx[i] = Math.abs(vx[i]);
        } else if (x[i] > PANEL_W - ri) {
          x[i] = 2 * (PANEL_W - ri) - x[i];
          vx[i] = -Math.abs(vx[i]);
        }
        if (y[i] < ri) {
          y[i] = 2 * ri - y[i];
          vy[i] = Math.abs(vy[i]);
        } else if (y[i] > PANEL_H - ri) {
          y[i] = 2 * (PANEL_H - ri) - y[i];
          vy[i] = -Math.abs(vy[i]);
        }
      }
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        const cx = Math.min(gw - 1, Math.max(0, Math.floor(x[i] / cell)));
        const cy = Math.min(gh - 1, Math.max(0, Math.floor(y[i] / cell)));
        const k = cy * gw + cx;
        next[i] = head[k];
        head[k] = i;
      }
      for (let i = 0; i < n; i++) {
        const cx = Math.min(gw - 1, Math.max(0, Math.floor(x[i] / cell)));
        const cy = Math.min(gh - 1, Math.max(0, Math.floor(y[i] / cell)));
        for (let oy = -1; oy <= 1; oy++) {
          const yy = cy + oy;
          if (yy < 0 || yy >= gh) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = cx + ox;
            if (xx < 0 || xx >= gw) continue;
            for (let j = head[yy * gw + xx]; j !== -1; j = next[j]) {
              if (j <= i) continue;
              const dx = x[j] - x[i];
              const dy = y[j] - y[i];
              const rr = r[i] + r[j];
              const d2 = dx * dx + dy * dy;
              if (d2 >= rr * rr || d2 < 1e-9) continue;
              const d = Math.sqrt(d2);
              const nx = dx / d;
              const ny = dy / d;
              const relv = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny;
              // positional separation (mass weighted)
              const over = rr - d;
              const wsum = im[i] + im[j];
              x[i] -= nx * over * (im[i] / wsum);
              y[i] -= ny * over * (im[i] / wsum);
              x[j] += nx * over * (im[j] / wsum);
              y[j] += ny * over * (im[j] / wsum);
              if (relv >= 0) continue; // separating already
              const jimp = (-2 * relv) / wsum;
              vx[i] -= jimp * im[i] * nx;
              vy[i] -= jimp * im[i] * ny;
              vx[j] += jimp * im[j] * nx;
              vy[j] += jimp * im[j] * ny;
              h++;
            }
          }
        }
      }
    }
    hits[f] = Math.min(65535, h);
    rec(f);
    S[f] = entropyAt(pos, n, f);
  };
  const run: DiscRun = { n, frames, pos, vel, r, hits, S };
  return {
    run,
    advance: (upTo: number) => {
      const t = Math.min(frames - 1, Math.ceil(upTo));
      while (done < t) step(++done);
    },
  };
}
function simulate(balls: Ball[], frames: number, substeps: number, cell: number): DiscRun {
  const rc = recorder(balls, frames, substeps, cell);
  rc.advance(frames - 1);
  return rc.run;
}

/** Coarse-grained (Boltzmann/Gibbs) entropy of the occupancy of a 12x6 grid of 75 px cells, normalised so that 1 =
 * perfectly uniform over all 72 cells. The cells are coarse enough that S keeps rising until the gas has filled the
 * box (95 % of the 0..68 rise is reached at recorded frame ~52), so the gauges move through the whole N = 400 window. */
const EGX = 12;
const EGY = 6;
const eCnt = new Float32Array(EGX * EGY);
function entropyAt(pos: Float32Array, n: number, f: number): number {
  eCnt.fill(0);
  for (let i = 0; i < n; i++) {
    const cx = Math.min(EGX - 1, Math.max(0, Math.floor((pos[(f * n + i) * 2] / PANEL_W) * EGX)));
    const cy = Math.min(EGY - 1, Math.max(0, Math.floor((pos[(f * n + i) * 2 + 1] / PANEL_H) * EGY)));
    eCnt[cy * EGX + cx]++;
  }
  let s = 0;
  for (let k = 0; k < EGX * EGY; k++) {
    if (eCnt[k] > 0) {
      const p = eCnt[k] / n;
      s -= p * Math.log(p);
    }
  }
  return s / Math.log(Math.min(n, EGX * EGY));
}

// ------------------------------------------------------------------ N = 10 : a 9-ball diamond rack + cue ball
export const RACK_R = 15;
export const RACK_FRAMES = 60;
export function rackRun(): DiscRun {
  return memo('S02:rack10', () => {
    const balls: Ball[] = [];
    const r = RACK_R;
    const gap = 0.25;
    const dx = (2 * r + gap) * Math.cos(Math.PI / 6);
    const cx = 250;
    const cy = 225;
    // diamond 1-2-3-2-1, apex pointing right (towards the cue)
    const rows = [1, 2, 3, 2, 1];
    rows.forEach((cntRow, k) => {
      const xx = cx + (2 - k) * dx;
      for (let i = 0; i < cntRow; i++) {
        balls.push({ x: xx, y: cy + (i - (cntRow - 1) / 2) * (2 * r + gap), vx: 0, vy: 0, r, m: 1 });
      }
    });
    // cue ball (index 9)
    balls.push({ x: 760, y: cy + 2.2, vx: -46, vy: -0.35, r, m: 1 });
    return simulate(balls, RACK_FRAMES, 32, 2 * r + 2);
  });
}

// ------------------------------------------------------------------ N = 400 : a dense hot drop released into the box
export const GAS_R = 4;
export const GAS_FRAMES = 122;
export const GAS_N = 400;
export const GAS_DISC = { x: 232, y: 225 };
export const GAS_SEED = 20402;
export const GAS_SUBSTEPS = 6;

/** The N = 400 recording, guaranteed simulated up to recorded frame `upTo` (default: all of it). */
export function gasRun(upTo: number = GAS_FRAMES - 1): DiscRun {
  const rc = memo('S02:gas400', () => {
    const rnd = mulberry32(GAS_SEED);
    const gauss = () => {
      const u = Math.max(1e-9, rnd());
      const v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const r = GAS_R;
    const drop = DROP400; // compact, amorphous (see drop400.ts)
    let Rd = 0;
    for (let k = 0; k < GAS_N; k++) Rd = Math.max(Rd, Math.hypot(drop[k * 2], drop[k * 2 + 1]));
    const balls: Ball[] = [];
    for (let k = 0; k < GAS_N; k++) {
      const px = drop[k * 2];
      const py = drop[k * 2 + 1];
      const rho = Math.sqrt(px * px + py * py) / Rd;
      const a = Math.atan2(py, px);
      // hot (thermal) + a gentle outward bias: slow enough that the spreading takes most of the 68-frame window
      const radial = 1.6 * rho;
      balls.push({
        x: GAS_DISC.x + px,
        y: GAS_DISC.y + py,
        vx: gauss() * 3.6 + Math.cos(a) * radial,
        vy: gauss() * 3.6 + Math.sin(a) * radial,
        r,
        m: 1,
      });
    }
    return recorder(balls, GAS_FRAMES, GAS_SUBSTEPS, 2 * r + 1);
  });
  rc.advance(upTo);
  return rc.run;
}
/** A cheap fingerprint of the N = 400 initial state (positions + velocities of recorded frame 0): it changes whenever
 * the drop, the seed or the velocity model changes. Used to validate baked data derived from the recording. */
export function gasFingerprint(): string {
  const run = gasRun(0);
  let h = 0;
  for (let i = 0; i < run.n * 2; i++) h += run.pos[i] * ((i % 7) + 1) + run.vel[i] * ((i % 5) + 1) * 10;
  return h.toFixed(1);
}
export const gasDiscRadius = () => {
  const run = gasRun(0);
  let m = 0;
  for (let i = 0; i < run.n; i++) {
    const dx = run.pos[i * 2] - GAS_DISC.x;
    const dy = run.pos[i * 2 + 1] - GAS_DISC.y;
    m = Math.max(m, Math.hypot(dx, dy));
  }
  return m + GAS_R;
};

/** Ball i of a run at (possibly fractional) recorded frame t (linear interpolation, clamped). */
export function runPos(run: DiscRun, i: number, t: number): [number, number] {
  const tt = Math.max(0, Math.min(run.frames - 1, t));
  const f0 = Math.floor(tt);
  const f1 = Math.min(run.frames - 1, f0 + 1);
  const a = tt - f0;
  const n = run.n;
  const x0 = run.pos[(f0 * n + i) * 2];
  const y0 = run.pos[(f0 * n + i) * 2 + 1];
  if (a === 0) return [x0, y0];
  const x1 = run.pos[(f1 * n + i) * 2];
  const y1 = run.pos[(f1 * n + i) * 2 + 1];
  // avoid smearing across a wall reflection: if the jump is large, snap
  if (Math.abs(x1 - x0) > 60 || Math.abs(y1 - y0) > 60) return a < 0.5 ? [x0, y0] : [x1, y1];
  return [x0 + (x1 - x0) * a, y0 + (y1 - y0) * a];
}
export function runSpeed(run: DiscRun, i: number, t: number): number {
  const f = Math.max(0, Math.min(run.frames - 1, Math.round(t)));
  const n = run.n;
  return Math.hypot(run.vel[(f * n + i) * 2], run.vel[(f * n + i) * 2 + 1]);
}

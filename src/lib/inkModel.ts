// Ink-in-water physical model (pure functions of age) — used by ink.tsx / inkShader.ts.
// See the header of src/lib/ink.tsx for the scene-author API.
//
// Units: "local" px at size scale 1, origin at the impact point on the surface (x right, y DOWN, so y = depth).
// Time: seconds since impact ("age"). Everything here is closed-form in age, so evaluating at a decreasing age
// IS the rewind — no state, no integration at render time.
import { clamp, memo, smoothstep } from './math';
import { makeNoise } from './noise';
import { mulberry32 } from './random';

// ───────────────────────────── colour law (Beer–Lambert) ─────────────────────────────

/** Ink palette (S01 / S04 / S09). */
export const INK = {
  /** backlit water, centre of the light table */
  paper: '#F4EEE2',
  /** backlit water, low corners */
  paperLow: '#E3D9C6',
  /** dim warm air above the surface */
  air: '#2B2824',
  /** thick ink (optical floor) */
  core: '#0A0B10',
  /** dilute ink, density 1 */
  dilute: '#3C4A6A',
  /** caption colour on the cream tank */
  text: '#17151C',
  /** caption emphasis on the cream tank */
  em: '#2E4A7A',
} as const;

/**
 * Per-channel absorption coefficients (optical depth per unit density) in display space, fitted so that
 * density 1 over INK.paper gives ≈ INK.dilute (#3E4964) and density → ∞ gives INK.core. Red is absorbed most,
 * so dilute ink drifts blue-grey while thick ink goes neutral black: dilution is visible as colour.
 */
export const INK_K: readonly [number, number, number] = [1.5, 1.3, 0.92];
/** Transmittance floor (stray light / flare): thick ink bottoms out at INK.core instead of pure black. */
export const INK_FLOOR: readonly [number, number, number] = [0.041, 0.046, 0.071];

export type InkRgb = readonly [number, number, number];

/**
 * Transmittance [r,g,b] (0..1) of ink at optical density `rho` (0 = clear, 1 = dilute blue-grey, ≥4 = black).
 * `k` / `floor` select another absorption law (e.g. S09's COSMOS_INK_K / COSMOS_INK_FLOOR); default the S01 law.
 */
export function inkTransmittance(rho: number, k: InkRgb = INK_K, floor: InkRgb = INK_FLOOR): [number, number, number] {
  const r = Math.max(0, rho);
  return [0, 1, 2].map((i) => floor[i] + (1 - floor[i]) * Math.exp(-r * k[i])) as [number, number, number];
}

function hexRgb01(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** CSS colour of ink at density `rho` seen against `paper` (default the light table), under law `k` / `floor`. */
export function inkColor(rho: number, paper: string = INK.paper, alpha = 1, k: InkRgb = INK_K, floor: InkRgb = INK_FLOOR): string {
  const p = hexRgb01(paper);
  const t = inkTransmittance(rho, k, floor);
  const c = p.map((v, i) => Math.round(255 * v * t[i]));
  return alpha >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/**
 * Colour to paint with globalCompositeOperation='multiply' so that N overlapping dabs of alpha a approximate
 * Beer–Lambert with INK_K (1 − C ∝ INK_K). Optical depth per dab ≈ a · INK_K[0].
 */
export function inkDabRgb(k: InkRgb = INK_K): [number, number, number] {
  return [0, 1 - k[1] / k[0], 1 - k[2] / k[0]].map((v) => Math.round(clamp(v) * 255)) as [number, number, number];
}
export const INK_DAB_RGB: InkRgb = inkDabRgb(INK_K);

// ───────────────────────────── vortex-ring cascade ─────────────────────────────

export interface InkRingNode {
  id: number;
  gen: number;
  parent: number;
  /** azimuth on the parent's rim where it was born (rad); sin(phi) > 0 = towards the camera */
  phi: number;
  tBirth: number;
  /** time at which this ring breaks into children (Widnall instability); Infinity for leaves */
  tSplit: number;
  nChildren: number;
  /** lobe phase used for the pre-split waviness so lobes line up with the children */
  lobePhase: number;
  vOut: number;
  vDown: number;
  /** decay time of the downward self-induced motion */
  tau: number;
  /** decay time of the outward breakup impulse (shorter → the arm curves down like a chandelier) */
  tauOut: number;
  r0: number;
  rGrow: number;
  strength: number;
  /** spawn point (local px) */
  sx: number;
  sy: number;
  /** -1 (far) .. 1 (near) */
  depth: number;
  /** tilt of the ring axis (rad, screen plane) */
  tilt: number;
  /** per-ring variation of the apparent ellipse (axis wobble towards/away from the camera) */
  eMul: number;
}

export interface InkRingState {
  /** node id in inkTree (stable across ages; index into the full tree) */
  id: number;
  /** generation: 0 = primary ring, 1 = first split (4 lobes), 2 = second split (3 per lobe) */
  gen: number;
  x: number;
  y: number;
  R: number;
  /** ellipse minor/major ratio (seen from slightly above) */
  e: number;
  tilt: number;
  core: number;
  width: number;
  cap: number;
  halo: number;
  haloR: number;
  /** stem anchor (local px) */
  ax: number;
  ay: number;
  stemW: number;
  stemS: number;
  lobeN: number;
  lobeAmp: number;
  lobePhase: number;
  depth: number;
  vis: number;
  /** culling radius of the ring body (px) */
  bound: number;
  /** height of the bell (the bubble's rear surface) above the ring plane */
  bellH: number;
  /** lateral bow of the stem at its midpoint (px) */
  bow: number;
  /** 0..1 edge crispness of the core (1 = the young primary: a glossy, hard-edged tube) */
  crisp: number;
}

export interface InkTreeOpts {
  seed: number;
  /** children of the primary ring (Widnall mode number) */
  n1?: number;
  /** children of each child */
  n2?: number;
}

/** Root ring descent (closed form, decelerating): depth below the surface in local px. */
function rootY0(t: number): number {
  return 18 * (1 - Math.exp(-t / 0.1)) + 560 * (1 - Math.exp(-t / 2.5));
}
/** Ink is slightly denser than water: everything keeps sinking slowly after the vortices have braked. */
const SINK = 9;
/** After the Widnall split the primary loses its circulation: the remnant crown brakes quickly. */
function rootY(t: number, t1 = Infinity): number {
  if (t <= t1) return rootY0(t);
  const v1 = (560 / 2.5) * Math.exp(-t1 / 2.5);
  const tr = 0.55;
  return rootY0(t1) + v1 * tr * (1 - Math.exp(-(t - t1) / tr)) + SINK * 0.6 * (t - t1);
}
function rootR(t: number): number {
  return 10 + 58 * (1 - Math.exp(-t / 0.45)) + 7 * t;
}
/** Seen from slightly above: deeper rings look rounder. */
function ellipseRatio(y: number): number {
  return 0.2 + 0.2 * clamp(y / 1300);
}

export function inkTree(o: InkTreeOpts): InkRingNode[] {
  const n1 = o.n1 ?? 4;
  const n2 = o.n2 ?? 3;
  return memo(`ink-tree:${o.seed}:${n1}:${n2}`, () => {
    const rnd = mulberry32(o.seed * 7919 + 17);
    const nodes: InkRingNode[] = [];
    const t1 = 1.75 + rnd() * 0.3;
    const root: InkRingNode = {
      id: 0, gen: 0, parent: -1, phi: Math.PI / 2, tBirth: 0, tSplit: t1, nChildren: n1,
      lobePhase: rnd() * Math.PI * 2, vOut: 0, vDown: 0, tau: 1, tauOut: 1, r0: 9, rGrow: 0, strength: 1,
      sx: 0, sy: 0, depth: 0, tilt: 0, eMul: 1,
    };
    nodes.push(root);
    // gen 1
    for (let k = 0; k < n1; k++) {
      const phi = root.lobePhase / n1 + (Math.PI * 2 * k) / n1 + (rnd() - 0.5) * 0.35;
      // spawn on the parent's rim at the split time
      const pR = rootR(t1);
      const pe = ellipseRatio(rootY0(t1));
      const c: InkRingNode = {
        id: nodes.length, gen: 1, parent: 0, phi, tBirth: t1 + (rnd() - 0.5) * 0.15,
        tSplit: t1 + 1.9 + rnd() * 0.5, nChildren: n2, lobePhase: rnd() * Math.PI * 2,
        vOut: 140 + rnd() * 45, vDown: 130 + rnd() * 45, tau: 2.5 + rnd() * 0.6, tauOut: 0.95 + rnd() * 0.35,
        r0: pR * (0.38 + rnd() * 0.06), rGrow: 6 + rnd() * 2,
        strength: 0.8 + rnd() * 0.35, eMul: 0.8 + rnd() * 0.5,
        sx: pR * Math.cos(phi) * 0.9, sy: rootY0(t1) + pe * pR * Math.sin(phi) * 0.9 + pR * 0.05,
        depth: Math.sin(phi), tilt: -Math.cos(phi) * 0.38 + (rnd() - 0.5) * 0.25,
      };
      nodes.push(c);
    }
    // gen 2
    const g1 = nodes.slice(1);
    for (const p of g1) {
      for (let k = 0; k < p.nChildren; k++) {
        const phi = p.lobePhase / p.nChildren + (Math.PI * 2 * k) / p.nChildren + (rnd() - 0.5) * 0.4;
        const ps = ringState(p, nodes, p.tSplit);
        const c: InkRingNode = {
          id: nodes.length, gen: 2, parent: p.id, phi, tBirth: p.tSplit + (rnd() - 0.5) * 0.2,
          tSplit: Infinity, nChildren: 0, lobePhase: 0,
          vOut: 80 + rnd() * 35, vDown: 70 + rnd() * 30, tau: 2.6 + rnd() * 0.6, tauOut: 0.9 + rnd() * 0.3,
          r0: ps.R * (0.44 + rnd() * 0.08), rGrow: 3.8 + rnd() * 1.5,
          strength: 0.55 + rnd() * 0.55, eMul: 0.75 + rnd() * 0.6,
          // child lobes lean outward with the parent's own outward direction
          sx: ps.x + ps.R * Math.cos(phi) * 0.85 * Math.cos(p.tilt),
          sy: ps.y + ps.e * ps.R * Math.sin(phi) * 0.85 + ps.R * Math.cos(phi) * Math.sin(p.tilt) * 0.85 + ps.R * 0.05,
          depth: clamp(p.depth * 0.6 + Math.sin(phi) * 0.5, -1, 1),
          tilt: p.tilt * 0.8 - Math.cos(phi) * 0.3 + (rnd() - 0.5) * 0.5,
        };
        nodes.push(c);
      }
    }
    return nodes;
  });
}

const relax = (dt: number, tau: number) => tau * (1 - Math.exp(-Math.max(0, dt) / tau));

/** Child trajectory: the outward breakup impulse decays fast, the downward drift slowly → a curved 'arm'. */
function childPos(n: InkRingNode, t: number): [number, number] {
  const dt = t - n.tBirth;
  const out = n.vOut * relax(dt, n.tauOut);
  // outward in 3D: screen-x gets cos(phi); depth gets sin(phi) → foreshortened to screen-y by the ellipse ratio
  const e0 = ellipseRatio(n.sy);
  // after its own split the ring's remnant brakes (it handed its circulation to its children)
  const dts = n.tSplit - n.tBirth;
  let down = n.vDown * relax(Math.min(dt, dts), n.tau);
  if (dt > dts) down += n.vDown * Math.exp(-dts / n.tau) * relax(dt - dts, 0.6);
  down += SINK * Math.max(0, dt);
  // a slow lateral drift (outward, weakening) keeps the chandelier opening
  const drift = 4 * Math.sqrt(Math.max(0, dt));
  return [n.sx + Math.cos(n.phi) * (out + drift), n.sy + down + e0 * Math.sin(n.phi) * (out + drift)];
}

/** Closed-form state of ring `n` at age t (local px). */
export function ringState(n: InkRingNode, nodes: InkRingNode[], t: number): InkRingState {
  let x: number, y: number, R: number;
  const dt = t - n.tBirth;
  if (n.gen === 0) {
    x = 0;
    y = rootY(t, n.tSplit);
    R = rootR(t);
  } else {
    const p = childPos(n, t);
    x = p[0];
    y = p[1];
    R = n.r0 + n.rGrow * Math.sqrt(Math.max(0, dt)) + 0.1 * n.vOut * relax(dt, n.tauOut);
  }
  // the young primary is seen a little more from above (its hole opens; it reads as a torus), settling by the split
  const young = n.gen === 0 ? 1 - smoothstep(0.9, 1.9, t) : 0;
  const e = ellipseRatio(y) * (1 + 0.15 * n.depth) * n.eMul * (1 + 0.3 * young);
  const age = Math.max(0, dt);
  // Visibility: children grow out of the parent's lobes.
  const vis = n.gen === 0 ? smoothstep(0, 0.02, t) : smoothstep(n.tBirth - 0.3, n.tBirth + 0.45, t);
  // After its own split a ring leaves only a faint remnant crown.
  const post = Number.isFinite(n.tSplit) ? smoothstep(n.tSplit - 0.25, n.tSplit + 1.0, t) : 0;
  const pre = Number.isFinite(n.tSplit) ? smoothstep(n.tSplit - 1.1, n.tSplit, t) * (1 - 0.7 * post) : 0;
  const depthSoft = 1 - 0.3 * Math.max(0, -n.depth); // far rings slightly fainter / softer
  // dilution by generation: each split shares the ink among N smaller rings → lighter, bluer
  const genK = n.gen === 0 ? 1 : n.gen === 1 ? 0.82 : 0.58;
  // core thickness: the young primary is a thin, glossy torus (its hole stays readable); it fattens towards the split
  const wK = n.gen === 2 ? 0.34 : n.gen === 1 ? 0.3 : 0.17 + 0.1 * smoothstep(1.1, 2.6, t);
  const width = (wK * R + 1.5 + 1.1 * Math.sqrt(age)) * (1 + 0.3 * Math.max(0, -n.depth)) + (n.gen === 0 ? 5 * Math.exp(-t / 0.08) : 0);
  const entry = n.gen === 0 ? 1.6 * Math.exp(-t / 0.25) : 0; // the drop's ink is still concentrated right after entry
  const core = n.strength * (2.6 * genK + entry) * (1 - 0.7 * post) * vis * depthSoft / (1 + 0.035 * age);
  const cap = n.strength * 0.5 * genK * vis * (1 - 0.6 * post) * depthSoft;
  const halo = n.strength * (0.075 + 0.012 * age) * vis * (0.6 + 0.4 * genK);
  const haloR = R * 1.25 + 15 * Math.sqrt(age);
  // stem: root hangs from the impact point, children from their parent's rim (current position)
  let ax = 0,
    ay = 0,
    bow = (n.lobePhase > Math.PI ? 1 : -1) * (5 + 4 * Math.sqrt(age));
  if (n.gen > 0) {
    // tethered to its birth point on the parent's rim, which drifts with the parent's (braking) remnant
    const pd = parentDrift(n, nodes, t);
    ax = n.sx + pd[0];
    ay = n.sy + pd[1];
    // bow = sagitta of the real (curved) trajectory relative to the straight chord
    const tm = n.tBirth + Math.max(0, dt) * 0.3;
    const m = childPos(n, tm);
    const cx = x - ax,
      cy = y - ay;
    const L2 = Math.max(1, cx * cx + cy * cy);
    const hm = clamp(((m[0] - ax) * cx + (m[1] - ay) * cy) / L2, 0.05, 0.95);
    const off = m[0] - (ax + cx * hm);
    bow = clamp(off / Math.sin(Math.PI * (1 - hm)), -80, 80) * smoothstep(0, 0.3, dt);
  }
  const stemW = (n.gen === 0 ? 0.05 * R + 1.6 : 0.06 * R + 1.2) + 1.1 * Math.sqrt(age);
  const stemS = vis * (n.gen === 0 ? 0.75 : 0.6) * n.strength * depthSoft * genK / (1 + 0.1 * age);
  return {
    id: n.id, gen: n.gen, x, y, R, e, tilt: n.tilt, core, width, cap, halo, haloR, ax, ay, stemW, stemS,
    lobeN: n.nChildren, lobeAmp: 0.15 * pre, lobePhase: n.lobePhase, depth: n.depth, vis,
    bound: R * 1.6 + width * 2.2 + 8,
    bellH: R * (0.62 + 0.5 * e),
    bow,
    crisp: young,
  };
}

/** Displacement of the parent (and grandparent…) since this ring's birth — the tether's anchor drifts with it. */
export function parentDrift(n: InkRingNode, nodes: InkRingNode[], t: number): [number, number] {
  if (n.gen === 0) return [0, 0];
  const p = nodes[n.parent];
  const a = ringState(p, nodes, Math.max(t, n.tBirth));
  const b = ringState(p, nodes, n.tBirth);
  return [a.x - b.x, a.y - b.y];
}

/** Every node's state at age t, INCLUDING unborn rings (vis = 0, parked at their spawn points); index = node id. */
export function ringStatesAt(t: number, o: InkTreeOpts): InkRingState[] {
  if (t <= 0) return [];
  const nodes = inkTree(o);
  return nodes.map((n) => ringState(n, nodes, t));
}

/**
 * The rings that EXIST at age t (vis > 0.01), local px at size scale 1 (origin = impact point, y = depth). Use `id`
 * (stable) to follow one ring over time; `vis` (0..1) is how far it has grown out of its parent. Empty for t <= 0.
 */
export function inkRingsAt(t: number, o: InkTreeOpts = { seed: 1 }): InkRingState[] {
  return ringStatesAt(t, o).filter((r) => r.vis > 0.01);
}

// ───────────────────────────── streak-line filaments ─────────────────────────────
//
// A filament is a streak line: the fluid shed from one point of a ring's rim over time. A parcel shed at time τ sat
// on the rim at P_rim(τ) and has since drifted by D_k(age − τ), a precomputed curl-noise displacement. Drawing the
// parcels shed over [tBirth, age] in order gives a thread that hangs from the ring back up along its path — the
// stems and wisps of the 'ink chandelier' — and older parts wander further (spread ~ √age). Pure in age.

export interface InkFilament {
  ring: number;
  /** 0 = stem / tether thread (from the head's top), 1 = rim wisp, 2 = core winding (stays with the ring) */
  kind: number;
  phi: number;
  /** radial offset from the core in units of R (negative = towards the axis) */
  off: number;
  /** vertical lift (units of R·e, negative = up) of the shedding point */
  lift: number;
  /** capture time constant (s): how long a shed parcel keeps riding with the ring */
  capS: number;
  /** orbit angular speed around the core (rad/s) */
  omega: number;
  /** shedding window (s): only parcels shed during the last `win` seconds are drawn */
  win: number;
  /** drift table: DRIFT_N samples of (dx, dy) at s = i * DRIFT_DT seconds after shedding */
  drift: Float32Array;
  alpha: number;
  /** index among the threads of the same ring and kind (0 = the crisp lead thread of a tether) */
  rank: number;
  /** orbit radius factor (units of the core width; kind 1 and 2) */
  orbK: number;
}
export const DRIFT_DT = 0.1;
export const DRIFT_N = 140;

export function inkFilaments(o: InkTreeOpts): InkFilament[] {
  const nodes = inkTree(o);
  return memo(`ink-fil:${o.seed}:${o.n1 ?? 4}:${o.n2 ?? 3}`, () => {
    const noise = makeNoise(o.seed * 31 + 5);
    const rnd = mulberry32(o.seed * 104729 + 3);
    const gauss = () => {
      const u = Math.max(1e-9, rnd());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * rnd());
    };
    const out: InkFilament[] = [];
    for (const n of nodes) {
      const counts = n.gen === 0 ? [6, 10, 10] : n.gen === 1 ? [3, 4, 4] : [2, 2, 2];
      for (let kind = 0; kind < 3; kind++) {
        for (let k = 0; k < counts[kind]; k++) {
          let phi: number, off: number, lift: number, capS: number, alpha: number, win: number;
          if (kind === 0) {
            // stem / tether: shed from the top of the head over the whole life → hangs back up the path
            phi = rnd() * Math.PI * 2;
            off = -0.9 + rnd() * 0.12;
            lift = -0.75 - rnd() * 0.2;
            capS = 0.02 + rnd() * 0.04;
            alpha = (0.75 + rnd() * 0.5) * (n.gen === 2 ? 0.55 : 1);
            win = 1e9;
          } else if (kind === 1) {
            // wisps peel off mostly where the core is seen edge-on (the ring's two ends), short-lived
            phi = (rnd() < 0.5 ? 0 : Math.PI) + gauss() * 0.6;
            off = -0.05 + rnd() * 0.3;
            lift = -0.1 - rnd() * 0.4;
            capS = 0.3 + rnd() * 0.5;
            alpha = 0.35 + rnd() * 0.75;
            win = 0.5 + rnd() * 0.8;
          } else {
            // windings: parcels captured by the core, orbiting it (toroidal striation of the ring)
            phi = rnd() * Math.PI * 2;
            off = (rnd() - 0.5) * 0.25;
            lift = 0;
            capS = 3 + rnd() * 4;
            alpha = 0.3 + rnd() * 0.5;
            win = 0.7 + rnd() * 0.8;
          }
          // coherent curl drift: neighbouring threads sample neighbouring noise → they move as sheets
          const drift = new Float32Array(DRIFT_N * 2);
          let x = 0,
            y = 0;
          const fx = Math.cos(phi) * 1.4 * (1 + off) + n.id * 5.31,
            fy = Math.sin(phi) * 0.5 + lift * 0.4 + n.id * 2.17;
          const amp = (kind === 0 ? 14 : kind === 1 ? 60 : 12) * (n.gen === 0 ? 1 : 0.75);
          const outward = kind === 1 ? Math.cos(phi) * (14 + rnd() * 18) : 0;
          const rise = kind === 1 ? 0.9 + rnd() * 0.8 : 0.15;
          for (let i = 0; i < DRIFT_N; i++) {
            drift[i * 2] = x;
            drift[i * 2 + 1] = y;
            const s = i * DRIFT_DT;
            const [cx, cy] = noise.curl2(fx + x * 0.008, fy + y * 0.008, s * 0.12, 0.01);
            const fall = 1 / Math.sqrt(1 + s * 1.5);
            x += (cx * amp * 0.05 + outward * 0.1) * fall * DRIFT_DT * 3;
            y += (cy * amp * 0.05 - rise) * fall * DRIFT_DT * 3;
          }
          // wisps leave the core within ~a quarter turn (a full orbit would fold the thread into a paper-clip loop);
          // windings stay captured but coil tightly inside the core
          const om = (3.5 + rnd() * 5) * (rnd() < 0.5 ? 1 : 1);
          out.push({
            ring: n.id, kind, phi, off, lift, capS, omega: kind === 1 ? Math.min(om, 1.3 / capS) : om, win, drift,
            alpha: alpha * (n.gen === 0 ? 1 : n.gen === 1 ? 0.85 : 0.65),
            rank: k,
            orbK: kind === 1 ? 0.8 : 0.55,
          });
        }
      }
    }
    return out;
  });
}

/** Linear interpolation into a filament's drift table. */
export function driftAt(f: InkFilament, s: number): [number, number] {
  const u = clamp(s / DRIFT_DT, 0, DRIFT_N - 1.001);
  const i = Math.floor(u);
  const a = u - i;
  const d = f.drift;
  return [d[i * 2] * (1 - a) + d[i * 2 + 2] * a, d[i * 2 + 1] * (1 - a) + d[i * 2 + 3] * a];
}

// ───────────────────────────── surface ─────────────────────────────

/**
 * Vertical displacement (px, + = down) of the water surface at x, `t` seconds after an impact at x0.
 * Pure in t: evaluating at a decreasing t makes ripples converge (rewind). Zero for t <= 0.
 * Capillary wave packets: envelopes travel at the group velocity, crests at 2/3 of it (cg = 1.5 cp).
 */
export function inkRipple(x: number, t: number, x0 = 540, amp = 1, size = 1): number {
  if (t <= 0) return 0;
  const d = Math.abs(x - x0) / size;
  // crater: a dip that opens and recoils
  let y = 15 * Math.exp(-t / 0.11) * (1 - Math.exp(-t / 0.015)) * Math.exp(-((d / 24) ** 2));
  // recoil bump (Worthington rebound) pulls the centre up briefly
  y -= 7 * smoothstep(0.08, 0.2, t) * Math.exp(-(t - 0.2) * (t > 0.2 ? 5 : 0)) * Math.exp(-((d / 16) ** 2));
  const P: Array<[number, number, number, number]> = [
    // [group speed px/s, wavenumber rad/px, amplitude px, decay s]
    [300, 0.11, 4.2, 0.9],
    [190, 0.075, 3.4, 1.5],
    [120, 0.05, 2.2, 2.4],
  ];
  for (const [cg, k, A, tau] of P) {
    const front = cg * t;
    const sig = 14 + 42 * t;
    const env = Math.exp(-(((d - front) / sig) ** 2)) * Math.exp(-t / tau) * smoothstep(0, 18, d + 6);
    const cp = cg / 1.5;
    y += A * env * Math.sin(k * (d - cp * t));
  }
  return y * amp * size;
}

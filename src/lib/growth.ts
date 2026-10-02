// Space-colonization branching growth (Runions et al. 2005) — leaf veins, river deltas, dendrites, lightning.
// Deterministic. Precompute once with memo() and reveal by `order` (growth step) over time.
import { memo } from './math';

export interface GrowthNode {
  x: number;
  y: number;
  parent: number; // -1 for roots
  /** growth step at which the node was created (0 = root) */
  step: number;
  /** distance (in nodes) from the root */
  depth: number;
  /** Murray's-law radius: leaves = 1, r³ = Σ child r³ */
  radius: number;
  /** number of leaf descendants (incl. itself) */
  load: number;
  /** index of the root this node descends from */
  root: number;
}

export interface GrowthOpts {
  /** attractor points [x0,y0,x1,y1,...] (e.g. from sampleShape) */
  attractors: Float32Array | number[];
  roots: Array<[number, number]>;
  /** segment length in px */
  step?: number;
  /** attractors further than this are ignored by a node */
  influence?: number;
  /** attractors closer than this to any node are consumed */
  kill?: number;
  maxSteps?: number;
  /** small deterministic bias added to growth direction, e.g. [0,-1] to grow upward */
  bias?: [number, number];
  biasWeight?: number;
}

export function grow(key: string, o: GrowthOpts): GrowthNode[] {
  return memo('growth:' + key, () => growNow(o));
}

function growNow(o: GrowthOpts): GrowthNode[] {
  const step = o.step ?? 8;
  const infl = o.influence ?? 80;
  const kill = o.kill ?? step * 1.5;
  const maxSteps = o.maxSteps ?? 400;
  const bias = o.bias ?? [0, 0];
  const bw = o.biasWeight ?? 0;
  const A = Array.from(o.attractors);
  const na = A.length / 2;
  const alive = new Uint8Array(na).fill(1);
  const nodes: GrowthNode[] = o.roots.map(([x, y], i) => ({ x, y, parent: -1, step: 0, depth: 0, radius: 1, load: 1, root: i }));

  // spatial hash for nodes
  const cell = infl;
  const grid = new Map<number, number[]>();
  const keyOf = (x: number, y: number) => ((Math.floor(x / cell) + 4096) << 13) ^ (Math.floor(y / cell) + 4096);
  const addNode = (i: number) => {
    const k = keyOf(nodes[i].x, nodes[i].y);
    let b = grid.get(k);
    if (!b) grid.set(k, (b = []));
    b.push(i);
  };
  nodes.forEach((_, i) => addNode(i));
  const nearest = (x: number, y: number): [number, number] => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let best = -1;
    let bd = infl * infl;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const b = grid.get(((cx + dx + 4096) << 13) ^ (cy + dy + 4096));
        if (!b) continue;
        for (const i of b) {
          const ddx = nodes[i].x - x;
          const ddy = nodes[i].y - y;
          const d = ddx * ddx + ddy * ddy;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      }
    return [best, bd];
  };

  for (let s = 1; s <= maxSteps; s++) {
    const dirs = new Map<number, [number, number, number]>();
    let any = false;
    for (let a = 0; a < na; a++) {
      if (!alive[a]) continue;
      const ax = A[a * 2];
      const ay = A[a * 2 + 1];
      const [ni, d2] = nearest(ax, ay);
      if (ni < 0) continue;
      if (d2 < kill * kill) {
        alive[a] = 0;
        continue;
      }
      any = true;
      const d = Math.sqrt(d2);
      const v = dirs.get(ni) ?? [0, 0, 0];
      v[0] += (ax - nodes[ni].x) / d;
      v[1] += (ay - nodes[ni].y) / d;
      v[2]++;
      dirs.set(ni, v);
    }
    if (!any || dirs.size === 0) break;
    const created: number[] = [];
    // deterministic order
    const keys = [...dirs.keys()].sort((a, b) => a - b);
    for (const ni of keys) {
      const v = dirs.get(ni)!;
      let dx = v[0] / v[2] + bias[0] * bw;
      let dy = v[1] / v[2] + bias[1] * bw;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const p = nodes[ni];
      nodes.push({ x: p.x + dx * step, y: p.y + dy * step, parent: ni, step: s, depth: p.depth + 1, radius: 1, load: 1, root: p.root });
      created.push(nodes.length - 1);
    }
    created.forEach(addNode);
  }

  // Murray's law radii & leaf loads (children are always after parents)
  const childR3 = new Float64Array(nodes.length);
  const loads = new Float64Array(nodes.length);
  const hasChild = new Uint8Array(nodes.length);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!hasChild[i]) {
      n.radius = 1;
      n.load = 1;
    } else {
      n.radius = Math.cbrt(childR3[i]);
      n.load = loads[i];
    }
    if (n.parent >= 0) {
      hasChild[n.parent] = 1;
      childR3[n.parent] += n.radius ** 3;
      loads[n.parent] += n.load;
    }
  }
  return nodes;
}

/** Highest growth step in a node list. */
export const maxStep = (nodes: GrowthNode[]) => nodes.reduce((m, n) => Math.max(m, n.step), 0);

/**
 * Draw the tree as segments. `reveal` in [0,1] shows nodes with step <= reveal*maxStep (growth animation).
 * width(n) maps a node to stroke width (default from Murray radius).
 */
export function drawGrowth(
  ctx: CanvasRenderingContext2D,
  nodes: GrowthNode[],
  reveal = 1,
  opts: { width?: (n: GrowthNode) => number; color?: string | ((n: GrowthNode) => string); maxS?: number } = {},
) {
  const ms = opts.maxS ?? maxStep(nodes);
  const lim = reveal * ms;
  const width = opts.width ?? ((n: GrowthNode) => 0.6 + Math.sqrt(n.radius) * 0.9);
  ctx.lineCap = 'round';
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.parent < 0 || n.step > lim) continue;
    const p = nodes[n.parent];
    ctx.strokeStyle = typeof opts.color === 'function' ? opts.color(n) : opts.color ?? '#FFC94A';
    ctx.lineWidth = width(n);
    // the newest segment grows smoothly
    const f = Math.min(1, lim - n.step + 1);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + (n.x - p.x) * f, p.y + (n.y - p.y) * f);
    ctx.stroke();
  }
}

// S08 — space-colonisation growth (same algorithm and output as lib/growth.ts `grow`), but incremental: every
// attractor remembers its nearest node, and each step only the *new* nodes are tested against the attractors around
// them (nodes are never removed, so the nearest distance can only shrink). ~10× faster than re-searching all nodes
// every step, which matters because every Remotion tab (and every still) rebuilds the network.
import type { GrowthNode, GrowthOpts } from '../../lib/growth';
import { memo } from '../../lib/math';

export function growFast(key: string, o: GrowthOpts): GrowthNode[] {
  return memo('S08:growFast:' + key, () => run(o));
}

function run(o: GrowthOpts): GrowthNode[] {
  const step = o.step ?? 8;
  const infl = o.influence ?? 80;
  const kill = o.kill ?? step * 1.5;
  const maxSteps = o.maxSteps ?? 400;
  const bias = o.bias ?? [0, 0];
  const bw = o.biasWeight ?? 0;
  const A = Float64Array.from(o.attractors);
  const na = A.length / 2;
  const alive = new Uint8Array(na).fill(1);
  const near = new Int32Array(na).fill(-1);
  const nearD2 = new Float64Array(na).fill(infl * infl);
  const nodes: GrowthNode[] = o.roots.map(([x, y], i) => ({ x, y, parent: -1, step: 0, depth: 0, radius: 1, load: 1, root: i }));

  // spatial hash of attractors (cell = influence radius)
  const cell = infl;
  const grid = new Map<number, number[]>();
  const keyOf = (cx: number, cy: number) => ((cx + 4096) << 13) ^ (cy + 4096);
  for (let a = 0; a < na; a++) {
    const k = keyOf(Math.floor(A[a * 2] / cell), Math.floor(A[a * 2 + 1] / cell));
    let b = grid.get(k);
    if (!b) grid.set(k, (b = []));
    b.push(a);
  }
  const infl2 = infl * infl;
  const offer = (ni: number) => {
    const nx = nodes[ni].x;
    const ny = nodes[ni].y;
    const cx = Math.floor(nx / cell);
    const cy = Math.floor(ny / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const b = grid.get(keyOf(cx + dx, cy + dy));
        if (!b) continue;
        for (const a of b) {
          if (!alive[a]) continue;
          const ddx = nx - A[a * 2];
          const ddy = ny - A[a * 2 + 1];
          const d = ddx * ddx + ddy * ddy;
          // strictly closer wins; equal distance keeps the older node (the lib scans cells in a fixed order)
          if (d < nearD2[a] && d < infl2) {
            nearD2[a] = d;
            near[a] = ni;
          }
        }
      }
  };
  for (let i = 0; i < nodes.length; i++) offer(i);

  const kill2 = kill * kill;
  // per-node direction accumulators (typed, grown on demand) + the list of nodes touched this step
  let cap = Math.max(1024, nodes.length * 4);
  let dX = new Float64Array(cap);
  let dY = new Float64Array(cap);
  let dN = new Int32Array(cap);
  let act: number[] = [];
  for (let a = 0; a < na; a++) act.push(a);
  for (let s = 1; s <= maxSteps; s++) {
    const touched: number[] = [];
    const nextAct: number[] = [];
    for (const a of act) {
      if (!alive[a]) continue;
      const ni = near[a];
      if (ni < 0) {
        nextAct.push(a);
        continue;
      }
      const d2 = nearD2[a];
      if (d2 < kill2) {
        alive[a] = 0;
        continue;
      }
      nextAct.push(a);
      const d = Math.sqrt(d2);
      if (dN[ni] === 0) touched.push(ni);
      dX[ni] += (A[a * 2] - nodes[ni].x) / d;
      dY[ni] += (A[a * 2 + 1] - nodes[ni].y) / d;
      dN[ni]++;
    }
    act = nextAct;
    if (touched.length === 0) break;
    touched.sort((a, b) => a - b);
    const created: number[] = [];
    for (const ni of touched) {
      let dx = dX[ni] / dN[ni] + bias[0] * bw;
      let dy = dY[ni] / dN[ni] + bias[1] * bw;
      dX[ni] = 0;
      dY[ni] = 0;
      dN[ni] = 0;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const p = nodes[ni];
      nodes.push({ x: p.x + dx * step, y: p.y + dy * step, parent: ni, step: s, depth: p.depth + 1, radius: 1, load: 1, root: p.root });
      created.push(nodes.length - 1);
    }
    if (nodes.length >= cap) {
      cap = nodes.length * 2;
      const nx = new Float64Array(cap);
      nx.set(dX);
      dX = nx;
      const ny = new Float64Array(cap);
      ny.set(dY);
      dY = ny;
      const nn = new Int32Array(cap);
      nn.set(dN);
      dN = nn;
    }
    for (const ni of created) offer(ni);
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

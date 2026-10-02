// TEMPORARY dev profiler (removed before delivery).
const now = () => (globalThis as any).performance.now() as number;
let t0 = 0;
let last = 0;
const acc: Array<[string, number]> = [];
export function pStart() {
  t0 = last = now();
  acc.length = 0;
}
export function pMark(name: string) {
  const t = now();
  acc.push([name, t - last]);
  last = t;
}
export function pEnd(frame: number) {
  console.log('PROF f' + frame + ' sinceNav ' + t0.toFixed(0) + ' total ' + (now() - t0).toFixed(0) + ' ' + acc.map(([n, d]) => n + ':' + d.toFixed(0)).join(' '));
}

// Shared human figure (front view, standing, arms slightly apart) — a recurring motif (S07, S08, S09).
// Defined in a 600×1420 box; feet at y≈1400, head top at y≈58, centre x = 300.

export const HUMAN_W = 600;
export const HUMAN_H = 1420;

// Right half outline, from top of head clockwise down to the crotch (x >= 300).
const RIGHT: Array<[number, number]> = [
  [300, 58], [338, 66], [362, 96], [368, 140], [362, 182], [346, 212], [326, 232],
  [322, 262], [352, 276], [404, 290], [440, 308], [458, 342], [464, 392],
  [468, 452], [474, 520], [480, 572], [490, 640], [500, 712], [508, 760],
  [516, 800], [516, 842], [502, 868], [484, 860], [478, 822], [474, 772],
  [464, 716], [452, 650], [440, 586], [430, 530], [420, 470], [412, 420],
  [404, 470], [398, 540], [396, 610], [404, 690], [414, 770],
  [416, 850], [410, 950], [398, 1050], [392, 1130], [384, 1230], [374, 1320], [372, 1352],
  [398, 1380], [394, 1402], [332, 1402], [326, 1372],
  [326, 1320], [328, 1220], [330, 1120], [328, 1030], [322, 940], [312, 880], [300, 866],
];

function outline(): Array<[number, number]> {
  const right = RIGHT;
  const left = right
    .slice(1, -1)
    .map(([x, y]) => [600 - x, y] as [number, number])
    .reverse();
  return [...right, ...left];
}

/** Smooth closed Catmull-Rom spline through the outline -> SVG path data (600×1420 box). */
function catmullRom(pts: Array<[number, number]>, tension = 0.5): string {
  const n = pts.length;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * (tension * 2);
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * (tension * 2);
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * (tension * 2);
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * (tension * 2);
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d + ' Z';
}

/** SVG path data for the figure in the 600×1420 box. */
export const HUMAN_PATH = catmullRom(outline());

/**
 * Draw (fill) the figure into a 2D context: feet centred at (cx, groundY), total height `h` px.
 * Uses the current fillStyle unless `fill` given.
 */
export function drawHuman(ctx: CanvasRenderingContext2D, cx: number, groundY: number, h: number, fill?: string | CanvasGradient) {
  const s = h / 1344; // head-top(58) to sole(1402)
  ctx.save();
  ctx.translate(cx - 300 * s, groundY - 1402 * s);
  ctx.scale(s, s);
  if (fill) ctx.fillStyle = fill;
  ctx.fill(new Path2D(HUMAN_PATH));
  ctx.restore();
}

/** Key anatomical anchors in box coordinates (for particle streams: mouth, lungs, heart, hands, feet). */
export const HUMAN_ANCHORS = {
  head: [300, 145],
  mouth: [300, 200],
  heart: [328, 420],
  lungs: [300, 400],
  belly: [300, 600],
  handL: [84, 830],
  handR: [516, 830],
  footL: [234, 1395],
  footR: [366, 1395],
} as const;

/** Convert a box-space point to frame space for a figure drawn with drawHuman(ctx, cx, groundY, h). */
export function humanToFrame(pt: readonly [number, number] | readonly number[], cx: number, groundY: number, h: number): [number, number] {
  const s = h / 1344;
  return [cx - 300 * s + pt[0] * s, groundY - 1402 * s + pt[1] * s];
}

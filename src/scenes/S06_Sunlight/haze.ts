// Beat 5: the Earth gives its infrared back to space — from the WHOLE limb, in every outward direction — in S01's ink
// language (the drop of ink, inverted: light leaving instead of ink falling in). Closed form in time:
//  · ~40 comparable small vortex rings leave all along the limb (staggered), each travelling out along the local
//    normal: fast, then drifting on to the frame edges;
//  · each ring: torus particles with a rolling poloidal phase, widening, Widnall lobes that break into tendrils
//    (a wake of wisps trailing behind it); every particle random-walks away with σ ∝ √t (散开);
//  · DILUTION: density ∝ 1/(1 + d/d0)² with the distance travelled — the rings visibly thin out into space;
//  · splatted into a ¼-res density field, blurred, mapped through a Beer–Lambert-like IR ramp (thin = deep crimson,
//    dense core = hot red-orange: S01's dark-core → dilute-fringe, in infrared); the narration lane is masked to ≤30 %.
import { clamp, ease, memo, seg } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { Cam, applyWorld } from './camera';
import { EARTH, LANE } from './palette';
import { T } from './timing';

export const HZ0 = T.hazeStart;

interface Ring {
  x0: number;
  y0: number;
  nx: number; // outward axis
  ny: number;
  t0: number;
  D: number; // fast travel
  v: number; // drift speed afterwards
  R0: number;
  R1: number;
  lobes: number;
  ph: number;
  k: number;
}
const rings = () =>
  memo('s06:irRings', () => {
    const r = mulberry32(7373);
    const out: Ring[] = [];
    const NE = 14;
    for (let j = 0; j < NE; j++) {
      for (let g = 0; g < 3; g++) {
        const a = -0.6 + (1.2 * (j + 0.2 + 0.6 * r())) / NE; // angle from vertical (Earth centre)
        const tilt = (r() - 0.5) * 0.35;
        const x0 = EARTH.cx + Math.sin(a) * (EARTH.r + 4);
        const y0 = EARTH.cy - Math.cos(a) * (EARTH.r + 4);
        out.push({
          x0,
          y0,
          nx: Math.sin(a + tilt),
          ny: -Math.cos(a + tilt),
          t0: HZ0 + g * 24 + ((j * 7) % NE) * 1.6 + r() * 8,
          D: 170 + r() * 150,
          v: 1.6 + r() * 1.2,
          R0: 10 + r() * 8,
          R1: 48 + r() * 46,
          lobes: 4 + Math.floor(r() * 3),
          ph: r() * 6.28,
          k: 0.75 + r() * 0.35,
        });
      }
    }
    return out;
  });

/** particle constants: azimuth φ, poloidal phase ψ0, gaussian dx, dy, wisp fraction, kind */
const NP = 230;
const parts = () =>
  memo('s06:irParts', () => {
    const r = mulberry32(8484);
    const a = new Float32Array(NP * 6);
    for (let i = 0; i < NP; i++) {
      a[i * 6] = r() * Math.PI * 2;
      a[i * 6 + 1] = r() * Math.PI * 2;
      const g = Math.sqrt(-2 * Math.log(Math.max(1e-6, r()))) * 0.7;
      const d = r() * Math.PI * 2;
      a[i * 6 + 2] = Math.cos(d) * g;
      a[i * 6 + 3] = Math.sin(d) * g;
      a[i * 6 + 4] = r();
      a[i * 6 + 5] = r() < 0.24 ? 1 : 0; // 1 = wisp / tendril particle (the wake)
    }
    return a;
  });

const bloomOn = (frame: number) => 1 - seg(frame, T.diveStart + 14, T.diveEnd - 10);

// infrared "ink" colour ramp (Beer–Lambert-like: thin = deep crimson, dense = hot red-orange)
const IR_LUT = () =>
  memo('s06:irlut', () => {
    const lut = new Uint8ClampedArray(256 * 3);
    const stops: Array<[number, number, number, number]> = [
      [0, 0, 0, 0],
      [0.16, 52, 4, 16],
      [0.4, 122, 14, 26],
      [0.64, 226, 46, 38],
      [0.86, 255, 112, 74],
      [1, 255, 206, 170],
    ];
    for (let i = 0; i < 256; i++) {
      const t = 1 - Math.exp((-i / 255) * 2.6);
      const tt = t / (1 - Math.exp(-2.6));
      let k = 0;
      while (k < stops.length - 2 && tt > stops[k + 1][0]) k++;
      const [t0, r0, g0, b0] = stops[k];
      const [t1, r1, g1, b1] = stops[k + 1];
      const f = clamp((tt - t0) / (t1 - t0));
      lut[i * 3] = r0 + (r1 - r0) * f;
      lut[i * 3 + 1] = g0 + (g1 - g0) * f;
      lut[i * 3 + 2] = b0 + (b1 - b0) * f;
    }
    return lut;
  });

const scr = (key: string, w: number, h: number) =>
  memo(`s06:hz:${key}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { c, x: c.getContext('2d', { willReadFrequently: true })! };
  });

const DK = 0.25; // density field resolution
export function drawHaze(ctx: CanvasRenderingContext2D, frame: number, cam: Cam) {
  if (frame < HZ0 || frame > T.diveEnd) return;
  const out = bloomOn(frame);
  if (out <= 0) return;
  const W = Math.round(1080 * DK);
  const H = Math.round(1920 * DK);
  const Dn = scr('dens', W, H);
  const d = Dn.x;
  d.setTransform(1, 0, 0, 1, 0, 0);
  d.globalCompositeOperation = 'source-over';
  d.globalAlpha = 1;
  d.filter = 'none';
  d.fillStyle = '#000';
  d.fillRect(0, 0, W, H);
  d.setTransform(DK, 0, 0, DK, 0, 0);
  applyWorld(d, cam);
  d.globalCompositeOperation = 'lighter';
  const RG = rings();
  const PA = parts();
  const sparks = new Path2D();
  const NB = 6;
  const dens: Path2D[] = Array.from({ length: NB }, () => new Path2D());
  const px = 1.15 / (DK * Math.max(1, cam.z)); // one density texel in world units
  for (let j = 0; j < RG.length; j++) {
    const b = RG[j];
    const tau = frame - b.t0;
    if (tau < 0) continue;
    // travel: fast launch, then drift on towards the frame edges
    const dist = b.D * (1 - Math.exp(-tau / 24)) + b.v * tau;
    const dil = 1 / (1 + dist / 190) ** 2;
    const life = ease.outCubic(clamp(tau / 8)) * dil * out * b.k * 2.2;
    if (life < 0.02) continue;
    const cxr = b.x0 + b.nx * dist;
    const cyr = b.y0 + b.ny * dist;
    const px1 = -b.ny; // ring plane direction (perpendicular to travel)
    const py1 = b.nx;
    const R = b.R0 + (b.R1 - b.R0) * (1 - Math.exp(-tau / 36));
    const ac = 4 + 0.3 * R;
    const roll = 0.2 * 90 * (1 - Math.exp(-tau / 90));
    const lobeK = 0.28 * ease.inOutSine(seg(tau, 14, 56));
    const sig = 1.2 + 2.1 * Math.sqrt(tau);
    for (let i = 0; i < NP; i++) {
      const o = i * 6;
      const phi = PA[o];
      const psi = PA[o + 1] + roll;
      const wisp = PA[o + 5] > 0.5;
      const rr = R * (1 + lobeK * Math.cos(b.lobes * phi + b.ph)) + ac * Math.cos(psi);
      // side view of a ring travelling along (nx,ny): lateral = rr cosφ, axial = roll + a little depth (rr sinφ)
      let lat = rr * Math.cos(phi);
      let ax = ac * Math.sin(psi) * 0.9 + rr * Math.sin(phi) * 0.28;
      let gx = PA[o + 2] * sig;
      let gy = PA[o + 3] * sig;
      let br = (Math.sin(phi) > 0 ? 1 : 0.62) * (0.7 + 0.3 * Math.cos(psi));
      if (wisp) {
        // tendrils: lobes shed material that trails behind the ring and diffuses much further (dilute fringe)
        const u = PA[o + 4];
        const lobeAt = Math.cos(b.lobes * phi + b.ph) > 0.2 ? 1 : 0.35;
        ax -= (12 + 0.55 * dist * 0.35) * u * lobeK * 3.2 * lobeAt;
        lat *= 1 - 0.25 * u;
        gx *= 2.2;
        gy *= 2.2;
        br *= 0.5 * lobeAt;
      }
      const a = br * life;
      if (a < 0.03) continue;
      const x = cxr + px1 * lat + b.nx * ax + gx;
      const y = cyr + py1 * lat + b.ny * ax + gy;
      dens[Math.min(NB - 1, Math.floor(a * NB))].rect(x - px, y - px, 2 * px, 2 * px);
      if ((i & 15) === 0 && a > 0.4) sparks.rect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
  }
  for (let k = 0; k < NB; k++) {
    const v = Math.round(12 + 26 * ((k + 0.5) / NB));
    d.fillStyle = `rgb(${v},${v},${v})`;
    d.fill(dens[k]);
  }
  // diffuse the density (two blur radii) and map it through the IR ramp; mask the narration lane
  const Bl = scr('densBlur', W, H);
  const b2 = Bl.x;
  b2.setTransform(1, 0, 0, 1, 0, 0);
  b2.globalCompositeOperation = 'source-over';
  b2.filter = 'none';
  b2.fillStyle = '#000';
  b2.fillRect(0, 0, W, H);
  b2.globalCompositeOperation = 'lighter';
  b2.filter = 'blur(1.6px)';
  b2.drawImage(Dn.c, 0, 0);
  b2.filter = 'blur(4.5px)';
  b2.globalAlpha = 0.85;
  b2.drawImage(Dn.c, 0, 0);
  b2.globalAlpha = 1;
  b2.filter = 'none';
  const img = b2.getImageData(0, 0, W, H);
  const px8 = img.data;
  const lut = IR_LUT();
  for (let y = 0; y < H; y++) {
    const sy = (y + 0.5) / DK;
    const m = 1 - 0.7 * clamp(Math.min(sy - (LANE.y0 - 30), LANE.y1 + 30 - sy) / 30);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const v = Math.min(255, Math.round(px8[i] * m)) * 3;
      px8[i] = lut[v];
      px8[i + 1] = lut[v + 1];
      px8[i + 2] = lut[v + 2];
      px8[i + 3] = 255;
    }
  }
  b2.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(Bl.c, 0, 0, 1080, 1920);
  // a fine grain of hot sparks on top (the individual quanta)
  applyWorld(ctx, cam);
  ctx.fillStyle = `rgba(255,170,130,${0.5 * out})`;
  ctx.fill(sparks);
  ctx.restore();
}

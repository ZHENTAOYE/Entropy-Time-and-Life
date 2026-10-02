// S09 pull-back, level 3: the Earth's night side. Orthographic sphere seen from above the person (sub-viewer point =
// the hero city, world origin). Cities are clusters of sodium light strung along coasts and linked by highways —
// the same branching network of light as the neurons and the street grid. A thin sunlit crescent on the upper-right
// limb (the Sun will appear on that side), blue limb scattering and a faint green airglow on the night side.
// City lights are vector sprites (sharp at every scale); land, sea and the crescent are one pre-rendered disc.
import { clamp, memo, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { ctxOf } from './canvas';
import { View, sx, sy } from './city';

export const RE = 6.371e6;
/** direction to the Sun (x right, y down, z toward the viewer): behind and to the upper right */
const SUN3 = (() => {
  const v = [0.56, -0.6, -1.32];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l] as const;
})();
export const SUN_DIR2: readonly [number, number] = (() => {
  const l = Math.hypot(SUN3[0], SUN3[1]);
  return [SUN3[0] / l, SUN3[1] / l] as const;
})();

// ───────────────────────────── 3D value noise ─────────────────────────────
const PERM = (() => {
  const r = mulberry32(5150);
  const p = new Uint8Array(512);
  const q = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = q[i & 255];
  return p;
})();
const VAL = (() => {
  const r = mulberry32(919);
  const v = new Float32Array(256);
  for (let i = 0; i < 256; i++) v[i] = r();
  return v;
})();
function vn3(x: number, y: number, z: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    w = zf * zf * (3 - 2 * zf);
  const X = xi & 255,
    Y = yi & 255,
    Z = zi & 255;
  const h = (a: number, b: number, c: number) => VAL[PERM[PERM[PERM[a] + b] + c]];
  const X1 = (X + 1) & 255,
    Y1 = (Y + 1) & 255,
    Z1 = (Z + 1) & 255;
  const a = h(X, Y, Z) + (h(X1, Y, Z) - h(X, Y, Z)) * u;
  const b = h(X, Y1, Z) + (h(X1, Y1, Z) - h(X, Y1, Z)) * u;
  const c = h(X, Y, Z1) + (h(X1, Y, Z1) - h(X, Y, Z1)) * u;
  const d = h(X, Y1, Z1) + (h(X1, Y1, Z1) - h(X, Y1, Z1)) * u;
  const e = a + (b - a) * v;
  const g = c + (d - c) * v;
  return e + (g - e) * w;
}
function fbm3(x: number, y: number, z: number, oct: number): number {
  let s = 0,
    a = 0.5,
    f = 1,
    n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vn3(x * f + o * 17.1, y * f - o * 9.3, z * f + o * 4.7);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

/** > 0 on land. Near the hero city the coast is pinned so that the metro's sea (east, x ≈ +4 km) continues. */
export function land(nx: number, ny: number, nz: number): number {
  const c = fbm3(nx * 2.1 + 3.3, ny * 2.1 + 1.7, nz * 2.1 + 7.1, 4) - 0.5;
  const big = fbm3(nx * 0.9 + 11, ny * 0.9 + 3, nz * 0.9 + 5, 2) - 0.5;
  let L = c * 1.0 + big * 0.8 + 0.06;
  // hero coast: land to the west, sea to the east, the coastline wiggles north–south
  const x = nx * RE,
    y = ny * RE;
  const r2 = x * x + y * y;
  const near = nz > 0 ? Math.exp(-r2 / (2.6e6 * 2.6e6)) : 0;
  if (near > 0.001) {
    const coast = 3900 + 46000 * Math.sin(y / 210000 + 0.7) + 90000 * Math.sin(y / 520000 + 2.1);
    // within ~400 km the coastline is exact (it continues the metro's); farther out the same continental noise as
    // everywhere else takes over, so the hero sea has a natural shore instead of a round edge
    const pin = Math.exp(-r2 / (4.2e5 * 4.2e5));
    const side = clamp((coast - x) / 260000, -1, 1);
    const local = side * (0.5 * pin + 0.3 * (1 - pin)) + 0.08 * (c + 0.1) * pin + (0.9 * c + 0.5 * big) * (1 - pin);
    L = L * (1 - near) + local * near;
  }
  return L;
}

// ───────────────────────────── cities & highways ─────────────────────────────
export interface City {
  x: number; // unit sphere
  y: number;
  z: number;
  r: number; // radius, m
  b: number; // brightness 0..1
  v: number; // sprite variant
  rot: number;
}
export function cities(): City[] {
  return memo('s09:cities', () => {
    const r = mulberry32(2718);
    const out: City[] = [{ x: 0, y: 0, z: 1, r: 13000, b: 1, v: 0, rot: 0.3 }];
    let tries = 0;
    while (out.length < 1600 && tries < 40000) {
      tries++;
      // uniform on the near hemisphere (+ a little beyond the limb)
      const z = r() * 1.08 - 0.08;
      const a = r() * Math.PI * 2;
      const q = Math.sqrt(Math.max(0, 1 - z * z));
      const x = q * Math.cos(a),
        y = q * Math.sin(a);
      const L = land(x, y, z);
      if (L < 0.005) continue;
      // people live by the sea: coastal bias
      const coastal = Math.exp(-L / 0.05);
      if (r() > 0.18 + 0.8 * coastal) continue;
      // keep the metro's own neighbourhood clear (it is drawn by the metro raster)
      const d = Math.hypot(x * RE, y * RE);
      if (z > 0 && d < 60000) continue;
      const pop = Math.pow(r(), 3.6);
      out.push({ x, y, z, r: 2200 + 30000 * pop, b: 0.22 + 0.78 * Math.sqrt(pop), v: 1 + Math.floor(r() * 4), rot: r() * 6.283 });
    }
    // a denser ring of towns around the hero (region scale)
    for (let k = 0; k < 260; k++) {
      const d = 50000 + 1.4e6 * Math.pow(r(), 1.5);
      const a = r() * Math.PI * 2;
      const x = (Math.cos(a) * d) / RE,
        y = (Math.sin(a) * d) / RE;
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      if (land(x, y, z) < 0.01) continue;
      const pop = Math.pow(r(), 3.5);
      out.push({ x, y, z, r: 1800 + 14000 * pop, b: 0.3 + 0.6 * Math.sqrt(pop), v: 1 + Math.floor(r() * 4), rot: r() * 6.283 });
    }
    return out;
  });
}
/** highway links: each city to its two nearest neighbours (≤ 900 km) */
export function links(): Int32Array {
  return memo('s09:links', () => {
    const C = cities();
    const out: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < C.length; i++) {
      const best: Array<[number, number]> = [];
      for (let j = 0; j < C.length; j++) {
        if (j === i) continue;
        const d = Math.hypot(C[i].x - C[j].x, C[i].y - C[j].y, C[i].z - C[j].z) * RE;
        if (d > 900000) continue;
        best.push([d, j]);
      }
      best.sort((a, b) => a[0] - b[0]);
      for (const [, j] of best.slice(0, i === 0 ? 5 : 2)) {
        const key = Math.min(i, j) * 4096 + Math.max(i, j);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(i, j);
      }
    }
    return new Int32Array(out);
  });
}

/** small towns and villages: dots on land, clustered around the cities (unit-sphere coordinates) */
export function towns(): Float32Array {
  return memo('s09:towns', () => {
    const r = mulberry32(777);
    const C = cities();
    const out: number[] = [];
    for (let k = 0; k < 9000 && out.length < 6500 * 3; k++) {
      const c = C[Math.floor(r() * Math.min(C.length, 700))];
      const d = (20000 + 260000 * Math.pow(r(), 1.8)) / RE;
      const a = r() * Math.PI * 2;
      // a tangent offset on the sphere
      const tx = -c.y,
        ty = c.x;
      const tl = Math.hypot(tx, ty);
      const ux = tl > 1e-6 ? tx / tl : 1,
        uy = tl > 1e-6 ? ty / tl : 0;
      const vx = c.y * 0 - c.z * uy,
        vy = c.z * ux,
        vz = c.x * uy - c.y * ux;
      let x = c.x + (ux * Math.cos(a) + vx * Math.sin(a)) * d,
        y = c.y + (uy * Math.cos(a) + vy * Math.sin(a)) * d,
        z = c.z + vz * Math.sin(a) * d;
      const l = Math.hypot(x, y, z);
      x /= l;
      y /= l;
      z /= l;
      if (land(x, y, z) < 0) continue;
      out.push(x, y, z);
    }
    return new Float32Array(out);
  });
}

/** city-light sprite variants: a white-gold core, sodium sprawl of speckles, radial roads of light */
function citySprite(k: number): HTMLCanvasElement {
  return memo(`s09:citySprite:${k}`, () => {
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = ctxOf(c);
    const r = mulberry32(400 + k * 13);
    g.globalCompositeOperation = 'lighter';
    const core = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    core.addColorStop(0, 'rgba(255,236,200,0.95)');
    core.addColorStop(0.12, 'rgba(255,190,110,0.5)');
    core.addColorStop(0.45, 'rgba(255,150,60,0.12)');
    core.addColorStop(1, 'rgba(255,140,50,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, S, S);
    // radial roads of speckles
    const arms = 4 + Math.floor(r() * 4);
    for (let a = 0; a < arms; a++) {
      const th = (a / arms) * Math.PI * 2 + r() * 0.6;
      const len = 30 + r() * 30;
      for (let d = 6; d < len; d += 1.6) {
        const w = (r() - 0.5) * 2.2;
        const x = 64 + Math.cos(th) * d - Math.sin(th) * w;
        const y = 64 + Math.sin(th) * d + Math.cos(th) * w;
        const al = 0.55 * (1 - d / len);
        g.fillStyle = `rgba(255,170,80,${al.toFixed(3)})`;
        g.fillRect(x, y, 1.3, 1.3);
      }
    }
    // sprawl
    for (let q = 0; q < 420; q++) {
      const rr = 28 * Math.sqrt(-Math.log(1 - r() * 0.995)) * 0.55;
      const th = r() * Math.PI * 2;
      const x = 64 + Math.cos(th) * rr,
        y = 64 + Math.sin(th) * rr;
      const al = 0.25 + 0.6 * r() * Math.exp(-rr / 22);
      g.fillStyle = r() < 0.15 ? `rgba(255,236,210,${al.toFixed(3)})` : `rgba(255,158,64,${(al * 0.8).toFixed(3)})`;
      g.fillRect(x, y, 1, 1);
    }
    return c;
  });
}

// ───────────────────────────── the disc (land, sea, day crescent, clouds) ─────────────────────────────
const DISC_PX = 480;
export function earthDisc(): HTMLCanvasElement {
  return memo('s09:earthDisc', () => {
    const c = document.createElement('canvas');
    c.width = c.height = DISC_PX;
    const g = ctxOf(c);
    const img = g.createImageData(DISC_PX, DISC_PX);
    const d = img.data;
    const R = DISC_PX / 2 - 1;
    for (let j = 0; j < DISC_PX; j++)
      for (let i = 0; i < DISC_PX; i++) {
        const x = (i + 0.5 - DISC_PX / 2) / R,
          y = (j + 0.5 - DISC_PX / 2) / R;
        const q = x * x + y * y;
        if (q > 1) continue;
        const z = Math.sqrt(1 - q);
        const L = land(x, y, z);
        const mu = x * SUN3[0] + y * SUN3[1] + z * SUN3[2];
        const day = smoothstep(-0.04, 0.12, mu);
        const twi = Math.exp(-((mu + 0.03) * (mu + 0.03)) / 0.006);
        // night: black sea, barely moonlit land
        const isL = L > 0;
        let r = isL ? 6 : 3,
          gg = isL ? 7 : 6,
          b = isL ? 9 : 13;
        if (isL) {
          const relief = fbm3(x * 9 + 1, y * 9 + 2, z * 9 + 3, 3);
          r += relief * 4;
          gg += relief * 4;
          b += relief * 5;
        }
        if (day > 0) {
          const lam = Math.max(0, mu) * 0.85 + 0.15;
          let dr: number, dg: number, db: number;
          if (isL) {
            const veg = fbm3(x * 5 + 7, y * 5, z * 5 + 2, 3);
            dr = 120 - 50 * veg;
            dg = 112 - 20 * veg;
            db = 80 - 30 * veg;
          } else {
            dr = 10;
            dg = 38;
            db = 92;
          }
          const cl = smoothstep(0.47, 0.7, fbm3(x * 3.2 + 4, y * 4.4 + 9, z * 3.2 + 1, 4));
          dr = dr + (238 - dr) * cl;
          dg = dg + (242 - dg) * cl;
          db = db + (248 - db) * cl;
          r += (dr * lam - r) * day;
          gg += (dg * lam - gg) * day;
          b += (db * lam - b) * day;
        }
        // twilight: a faint warm gradient along the terminator
        r += 22 * twi;
        gg += 10 * twi;
        b += 6 * twi;
        // limb darkening
        const ld = 0.55 + 0.45 * Math.pow(z, 0.5);
        const k = (j * DISC_PX + i) * 4;
        d[k] = r * ld;
        d[k + 1] = gg * ld;
        d[k + 2] = b * ld;
        d[k + 3] = 255 * clamp((1 - Math.sqrt(q)) * R * 1.2);
      }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** night factor of a point on the sphere (1 = deep night) */
const nightK = (x: number, y: number, z: number) => 1 - smoothstep(-0.08, 0.05, x * SUN3[0] + y * SUN3[1] + z * SUN3[2]);

/**
 * Draw the Earth at the view. `disc` = alpha of the sphere (land/sea/crescent/atmosphere), `lights` = city lights,
 * `heroCut` = suppress the hero city sprite (while the metro raster is still on).
 */
export function drawEarth(ctx: CanvasRenderingContext2D, v: View, disc: number, lights: number, heroCut: number) {
  const cx = sx(v, 0),
    cy = sy(v, 0);
  const R = RE * v.s;
  ctx.save();
  // the sphere
  if (disc > 0.003 && R < 20000) {
    ctx.globalAlpha = disc;
    const img = earthDisc();
    if (R < 6000) ctx.drawImage(img, cx - R, cy - R, 2 * R, 2 * R);
    else {
      // only the visible part of the (huge) disc
      const k = DISC_PX / (2 * R);
      const x0 = Math.max(0, (0 - (cx - R)) * k),
        y0 = Math.max(0, (0 - (cy - R)) * k);
      const x1 = Math.min(DISC_PX, (1080 - (cx - R)) * k),
        y1 = Math.min(DISC_PX, (1920 - (cy - R)) * k);
      if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, cx - R + x0 / k, cy - R + y0 / k, (x1 - x0) / k, (y1 - y0) / k);
    }
    ctx.globalAlpha = 1;
    // atmosphere: limb scattering (bright on the day side), airglow on the night side
    if (R > 3 && R < 9000) {
      const th = Math.max(2.2, Math.min(40, 90000 * v.s));
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, R + th * 2.4);
      g.addColorStop(0, 'rgba(91,200,255,0)');
      g.addColorStop(0.25, `rgba(91,200,255,${(0.32 * disc).toFixed(3)})`);
      g.addColorStop(0.45, `rgba(70,150,255,${(0.14 * disc).toFixed(3)})`);
      g.addColorStop(1, 'rgba(40,90,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R + th * 2.4, 0, Math.PI * 2);
      ctx.fill();
      // day-side brightening of the limb (a crescent of blue light)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(SUN_DIR2[1], SUN_DIR2[0]));
      const g2 = ctx.createRadialGradient(R * 0.55, 0, R * 0.2, R * 0.55, 0, R * 0.75);
      g2.addColorStop(0, `rgba(150,215,255,${(0.28 * disc).toFixed(3)})`);
      g2.addColorStop(1, 'rgba(150,215,255,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(0, 0, R + th * 1.6, 0, Math.PI * 2);
      ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2, true);
      ctx.fill();
      // airglow: a thin green line hugging the night limb
      ctx.strokeStyle = `rgba(80,255,150,${(0.12 * disc).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, th * 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, R + th * 0.55, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
      ctx.restore();
    }
  }
  // highways and cities (night side only)
  if (lights > 0.003 && R > 1.5) {
    const C = cities();
    const Lk = links();
    ctx.globalCompositeOperation = 'lighter';
    const P = new Path2D();
    for (let q = 0; q < Lk.length; q += 2) {
      const a = C[Lk[q]],
        b = C[Lk[q + 1]];
      if (a.z < 0.05 || b.z < 0.05) continue;
      const n = Math.min(nightK(a.x, a.y, a.z), nightK(b.x, b.y, b.z));
      if (n < 0.2) continue;
      const ax = cx + a.x * R,
        ay = cy + a.y * R,
        bx = cx + b.x * R,
        by = cy + b.y * R;
      if (Math.max(ax, bx) < -50 || Math.min(ax, bx) > 1130 || Math.max(ay, by) < -50 || Math.min(ay, by) > 1970) continue;
      const bow = (((q * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
      const mx = (ax + bx) / 2 - (by - ay) * 0.12 * bow,
        my = (ay + by) / 2 + (bx - ax) * 0.12 * bow;
      P.moveTo(ax, ay);
      P.quadraticCurveTo(mx, my, bx, by);
    }
    // towns: a speckle of faint lights (the texture of every night-side photograph)
    const Tn = towns();
    for (let q = 0; q < Tn.length; q += 3) {
      const z = Tn[q + 2];
      if (z < 0.05) continue;
      const x = cx + Tn[q] * R,
        y = cy + Tn[q + 1] * R;
      if (x < -2 || x > 1082 || y < -2 || y > 1922) continue;
      const n = nightK(Tn[q], Tn[q + 1], z);
      if (n < 0.05) continue;
      const rr = Math.max(0.6, 1500 * v.s);
      ctx.fillStyle = `rgba(255,186,110,${(0.55 * lights * n * (0.4 + 0.6 * z)).toFixed(3)})`;
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,170,90,${(0.05 * lights).toFixed(4)})`;
    ctx.lineWidth = Math.max(1.4, 9000 * v.s);
    ctx.stroke(P);
    ctx.strokeStyle = `rgba(255,190,110,${(0.16 * lights).toFixed(4)})`;
    ctx.lineWidth = Math.max(0.5, 2200 * v.s);
    ctx.stroke(P);
    for (let q = 0; q < C.length; q++) {
      const c = C[q];
      if (c.z < 0.02) continue;
      if (q === 0 && heroCut >= 0.999) continue;
      const n = nightK(c.x, c.y, c.z);
      if (n < 0.02) continue;
      const x = cx + c.x * R,
        y = cy + c.y * R;
      const rr = Math.max(1.3, c.r * v.s * 2.4);
      if (x < -rr || x > 1080 + rr || y < -rr || y > 1920 + rr) continue;
      const a = lights * n * c.b * (0.35 + 0.65 * c.z) * (q === 0 ? 1 - heroCut : 1);
      if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a * (rr < 3 ? 1.6 : 1));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.rot);
      ctx.scale(1, 0.35 + 0.65 * c.z);
      ctx.drawImage(citySprite(c.v), -rr, -rr, rr * 2, rr * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

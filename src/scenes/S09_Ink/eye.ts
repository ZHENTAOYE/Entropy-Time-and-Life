// S09 B2/B3: 「你。」 — an eye in the dark, lit by the cosmos. The iris sits on the triplet's circle (graphic match
// with the galaxy and the cell). The cosmic web glints in the cornea; the eye looks up (抬起头); then the camera
// pushes into the pupil, whose darkness opens onto the web itself (the window is the pupil: drawn by the caller).
// Iris = polar anisotropic noise (radial stroma fibres), a jagged bright collarette, dark crypts, contraction furrows,
// a dark limbal ring; amber-gold near the pupil (the film's gold), hazel further out.
import { WEB_FINAL, webGeometry } from '../../lib/cosmos';
import { clamp, ease, memo, seg, smoothstep } from '../../lib/math';
import { mulberry32 } from '../../lib/random';
import { makeNoise } from '../../lib/noise';
import { ctxOf, fresh, glow, scratch } from './canvas';
import { DISC, EYE, HIT } from './timing';

export const RI = 372; // iris radius (px, at camera scale 1)
const TEX = 500; // iris texture size

function irisTexture(): HTMLCanvasElement {
  return memo('s09:iris', () => {
    const c = document.createElement('canvas');
    c.width = c.height = TEX;
    const g = ctxOf(c);
    const img = g.createImageData(TEX, TEX);
    const d = img.data;
    const nz = makeNoise(4711);
    const R = TEX / 2;
    // everything that depends on the angle alone (collarette wobble, the furrows' breaks) is tabulated once
    const NA = 2048;
    const collT = new Float32Array(NA),
      furT = new Float32Array(NA * 3),
      wobT = new Float32Array(NA);
    const FR = [0.7, 0.79, 0.88];
    for (let a = 0; a < NA; a++) {
      const th = (a / NA) * Math.PI * 2 - Math.PI;
      const ca = Math.cos(th),
        sa = Math.sin(th);
      collT[a] = 0.47 + 0.035 * nz.n3(ca * 4 + 1, sa * 4 + 2, 0.5) + 0.02 * nz.n3(ca * 13, sa * 13, 1.5);
      for (let q = 0; q < 3; q++) furT[a * 3 + q] = smoothstep(-0.1, 0.4, nz.n3(ca * 3 + FR[q] * 10, sa * 3, 2));
      wobT[a] = 0.008 * Math.sin(th * 9);
    }
    for (let j = 0; j < TEX; j++)
      for (let i = 0; i < TEX; i++) {
        const x = (i + 0.5 - R) / R,
          y = (j + 0.5 - R) / R;
        const r = Math.hypot(x, y);
        if (r > 1.0) continue;
        const ca = x / (r || 1),
          sa = y / (r || 1);
        const ai = Math.min(NA - 1, Math.max(0, Math.round(((Math.atan2(sa, ca) + Math.PI) / (Math.PI * 2)) * NA))) % NA;
        // radial fibres: fine across, elongated along the radius
        const fib = nz.n3(ca * 26, sa * 26, r * 2.2) * 0.6 + nz.n3(ca * 61 + 3, sa * 61 + 7, r * 3.1) * 0.4;
        const fib2 = nz.n3(ca * 140 + 11, sa * 140 - 5, r * 5.0);
        // jagged collarette
        const coll = Math.exp(-Math.pow((r - collT[ai]) / 0.022, 2));
        // crypts: dark lacunae in the mid zone
        const inMid = r > 0.5 && r < 0.88;
        const crypt = inMid ? smoothstep(0.35, 0.65, nz.n3(ca * 7 + 20, sa * 7 - 4, r * 5.5)) * smoothstep(0.5, 0.58, r) * (1 - smoothstep(0.8, 0.88, r)) : 0;
        // contraction furrows: broken concentric rings
        let furrow = 0;
        if (r > 0.64) for (let q = 0; q < 3; q++) furrow += Math.exp(-Math.pow((r - FR[q] - wobT[ai]) / 0.007, 2)) * furT[ai * 3 + q];
        // colour by zone: gold-amber around the pupil, hazel-olive outside, dark limbus
        const inner = 1 - smoothstep(0.42, 0.62, r);
        let rr = 120 + 130 * inner,
          gg = 96 + 70 * inner,
          bb = 44 + 10 * inner;
        const lum = 0.55 + 0.45 * (0.5 + 0.5 * fib) + 0.25 * Math.max(0, fib2) * (1 - inner * 0.5);
        rr *= lum;
        gg *= lum;
        bb *= lum;
        // collarette ridge catches light
        rr += 90 * coll;
        gg += 66 * coll;
        bb += 30 * coll;
        const dark = 1 - 0.55 * crypt - 0.4 * clamp(furrow);
        // the pupillary ruff and the limbal ring
        const ruff = Math.exp(-Math.pow((r - 0.335) / 0.02, 2));
        const limb = smoothstep(0.88, 0.99, r);
        const k = dark * (1 - 0.75 * ruff) * (1 - 0.82 * limb);
        const o = (j * TEX + i) * 4;
        d[o] = clamp(rr * k + 30 * ruff, 0, 255);
        d[o + 1] = clamp(gg * k + 14 * ruff, 0, 255);
        d[o + 2] = clamp(bb * k + 6 * ruff, 0, 255);
        d[o + 3] = 255 * clamp((1 - r) * R * 0.6);
      }
    g.putImageData(img, 0, 0);
    return c;
  });
}

/** a small rendering of the cosmic web for the corneal reflection (lines + nodes), cached */
function webSprite(): HTMLCanvasElement {
  return memo('s09:webSprite', () => {
    const c = document.createElement('canvas');
    c.width = 540;
    c.height = 960;
    const g = ctxOf(c);
    const geo = webGeometry({ ...WEB_FINAL, zoom: 0.9 }, 60, 1080, 1920, 1);
    g.scale(0.5, 0.5);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const e of geo.edges) {
      g.strokeStyle = `rgba(142,91,255,${(0.35 + 0.4 * Math.min(1, e.w)).toFixed(3)})`;
      g.lineWidth = 2 + 3 * Math.min(1, e.w);
      g.beginPath();
      for (let k = 0; k < e.sx.length; k += 2) {
        if (k === 0) g.moveTo(e.sx[k], e.sx[k + 1]);
        else g.lineTo(e.sx[k], e.sx[k + 1]);
      }
      g.stroke();
    }
    for (const n of geo.nodes) glow(g, '#D6E6FF', n.x, n.y, 10 + 30 * n.mass, 0.9, 1);
    return c;
  });
}

interface EyeGeo {
  lashU: Float32Array; // x0, len, curl, w
  lashL: Float32Array;
  veins: Float32Array[];
}
function eyeGeo(): EyeGeo {
  return memo('s09:eyeGeo', () => {
    const r = mulberry32(8080);
    const lu: number[] = [];
    for (let i = 0; i < 150; i++) lu.push(-560 + r() * 1120, 70 + r() * 90, 0.5 + r() * 0.5, 1.6 + r() * 2.2);
    const ll: number[] = [];
    for (let i = 0; i < 70; i++) ll.push(-520 + r() * 1040, 26 + r() * 40, 0.3 + r() * 0.4, 1 + r() * 1.2);
    const veins: Float32Array[] = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      let x = side * (480 + r() * 120),
        y = (r() - 0.5) * 120;
      const pts = [x, y];
      let a = side > 0 ? Math.PI + (r() - 0.5) * 0.8 : (r() - 0.5) * 0.8;
      for (let k = 0; k < 14; k++) {
        a += (r() - 0.5) * 0.6;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 9;
        pts.push(x, y);
      }
      veins.push(new Float32Array(pts));
    }
    return { lashU: new Float32Array(lu), lashL: new Float32Array(ll), veins };
  });
}

/** lid curves (relative to the eye centre): upper/lower y at x, opened by `lift` px at the centre */
const W_EYE = 760;
function lidU(x: number, lift: number) {
  const u = clamp(Math.abs(x) / W_EYE, 0, 1);
  return -(300 + lift) * Math.pow(Math.cos((Math.PI / 2) * u), 0.85) + 18 * u * u;
}
function lidL(x: number, lift: number) {
  const u = clamp(Math.abs(x) / W_EYE, 0, 1);
  return (318 - lift * 0.35) * Math.pow(Math.cos((Math.PI / 2) * u), 1.1) + 6 * u;
}

export interface EyeState {
  /** camera scale (dive) about the pupil */
  S: number;
  /** pupil centre on screen */
  px: number;
  py: number;
  rp: number; // pupil radius on screen
  gx: number; // gaze offset (eye space)
  gy: number;
}
export function eyeState(f: number): EyeState {
  const look = ease.inOutSine(seg(f, EYE.gaze[0], EYE.gaze[1]));
  const gx = -10 * look,
    gy = -64 * look;
  const dil = 0.315 + 0.045 * ease.inOutSine(seg(f, HIT.eye + 6, EYE.dive[0] + 30));
  const d = seg(f, EYE.dive[0], EYE.dive[1]);
  const S = Math.exp(Math.log(13) * Math.pow(d, 2.2));
  const settle = 1 + 0.12 * (1 - ease.outCubic(seg(f, HIT.eye, HIT.eye + 12)));
  const pcx = DISC.x + gx,
    pcy = DISC.y + gy;
  // the dive is centred on the pupil, which drifts to the frame centre as it grows
  const dc = ease.inOutSine(d);
  const px = pcx + (540 - pcx) * dc,
    py = pcy + (940 - pcy) * dc;
  return { S: S * settle, px, py, rp: RI * dil * S * settle, gx, gy };
}

/** the eye; during the dive (scale > 1.6, in motion) it is rendered at half resolution and upscaled */
export function drawEye(ctx: CanvasRenderingContext2D, f: number) {
  const st = eyeState(f);
  if (st.S <= 1.6) {
    drawEyeInto(ctx, f, st);
    return;
  }
  const c = scratch('eyeHalf', 540, 960);
  const g = fresh(c);
  g.scale(0.5, 0.5);
  drawEyeInto(g, f, st);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, 0, 0, 1080, 1920);
  ctx.restore();
}
function drawEyeInto(ctx: CanvasRenderingContext2D, f: number, st: EyeState) {
  const t = (f - HIT.eye) / 30;
  const geo = eyeGeo();
  const lift = 22 * ease.inOutSine(seg(f, EYE.gaze[0], EYE.gaze[1]));
  ctx.save();
  ctx.fillStyle = '#060404';
  ctx.fillRect(0, 0, 1080, 1920);
  // camera: eye space (origin = the eye's centre) → screen, scaled about the pupil
  ctx.translate(st.px, st.py);
  ctx.scale(st.S, st.S);
  ctx.translate(-st.gx, -st.gy);
  // ── skin around the eye: warm dark, a soft key from the upper left, the lid crease
  const sk = ctx.createRadialGradient(-260, -420, 40, -100, -150, 1100);
  sk.addColorStop(0, 'rgba(70,48,38,1)');
  sk.addColorStop(0.45, 'rgba(34,22,18,1)');
  sk.addColorStop(1, 'rgba(8,5,5,1)');
  ctx.fillStyle = sk;
  ctx.fillRect(-1400, -1400, 2800, 2800);
  // the upper lid fold (crease) and lower lid volume
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 26;
  ctx.beginPath();
  for (let x = -W_EYE; x <= W_EYE; x += 20) {
    const y = lidU(x, lift) - 95 - 30 * Math.cos((x / W_EYE) * 1.4);
    if (x === -W_EYE) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // ── the opening
  const opening = new Path2D();
  for (let x = -W_EYE; x <= W_EYE; x += 10) {
    const y = lidU(x, lift);
    if (x === -W_EYE) opening.moveTo(x, y);
    else opening.lineTo(x, y);
  }
  for (let x = W_EYE; x >= -W_EYE; x -= 10) opening.lineTo(x, lidL(x, lift));
  opening.closePath();
  ctx.save();
  ctx.clip(opening);
  // sclera: dim warm white, shaded towards the corners and under the lids
  const sc = ctx.createRadialGradient(st.gx * 0.5, st.gy * 0.4, 100, 0, 0, 820);
  sc.addColorStop(0, 'rgba(140,128,120,1)');
  sc.addColorStop(0.5, 'rgba(104,92,86,1)');
  sc.addColorStop(1, 'rgba(34,26,24,1)');
  ctx.fillStyle = sc;
  ctx.fillRect(-W_EYE, -400, 2 * W_EYE, 800);
  // veins
  ctx.lineCap = 'round';
  for (const v of geo.veins) {
    ctx.strokeStyle = 'rgba(160,52,48,0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k < v.length; k += 2) {
      if (k === 0) ctx.moveTo(v[k], v[k + 1]);
      else ctx.lineTo(v[k], v[k + 1]);
    }
    ctx.stroke();
  }
  // the iris (with the gaze offset)
  const ix = st.gx,
    iy = st.gy;
  // dark halo of the limbus on the sclera
  const lh = ctx.createRadialGradient(ix, iy, RI * 0.96, ix, iy, RI * 1.18);
  lh.addColorStop(0, 'rgba(40,30,22,0.75)');
  lh.addColorStop(1, 'rgba(40,30,22,0)');
  ctx.fillStyle = lh;
  ctx.beginPath();
  ctx.arc(ix, iy, RI * 1.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(ix, iy);
  ctx.rotate(t * 0.01);
  ctx.drawImage(irisTexture(), -RI, -RI, 2 * RI, 2 * RI);
  ctx.restore();
  // iris luminance: a subtle glow of the gold stroma (the iris is the brightest thing in the dark)
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, '#FFB347', ix, iy, RI * 0.75, 0.16, 0);
  ctx.globalCompositeOperation = 'source-over';
  // the pupil
  const rp = st.rp / st.S;
  const pg = ctx.createRadialGradient(ix, iy, rp * 0.8, ix, iy, rp * 1.08);
  pg.addColorStop(0, 'rgba(2,2,3,1)');
  pg.addColorStop(0.75, 'rgba(4,3,3,1)');
  pg.addColorStop(1, 'rgba(10,6,4,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(ix, iy, rp * 1.08, 0, Math.PI * 2);
  ctx.fill();
  // ── the cornea: the web glints in it (convex mirror: small, curved), plus the window highlight
  ctx.save();
  ctx.beginPath();
  ctx.arc(ix, iy, RI * 1.04, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const refl = 0.3 + 0.25 * ease.inOutSine(seg(f, EYE.gaze[0], EYE.gaze[1] + 10));
  ctx.globalAlpha = refl;
  const ws = webSprite();
  const wscale = 0.95;
  ctx.drawImage(ws, ix * 0.4 - 270 * wscale, iy * 0.4 - 470 * wscale + 30, 540 * wscale, 960 * wscale);
  ctx.globalAlpha = 1;
  // window highlight (soft rounded rectangle), and a small secondary glint
  const hx = ix * 0.55 - 150,
    hy = iy * 0.55 - 150;
  const hg = ctx.createRadialGradient(hx, hy, 4, hx, hy, 70);
  hg.addColorStop(0, 'rgba(255,255,255,0.95)');
  hg.addColorStop(0.35, 'rgba(240,244,255,0.5)');
  hg.addColorStop(1, 'rgba(220,230,255,0)');
  ctx.fillStyle = hg;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.4);
  ctx.scale(1.25, 0.8);
  ctx.translate(-hx, -hy);
  ctx.fillRect(hx - 80, hy - 80, 160, 160);
  ctx.restore();
  glow(ctx, '#FFFFFF', ix * 0.55 + 160, iy * 0.55 + 120, 16, 0.55, 1);
  ctx.restore();
  // lid shadows on the eyeball, and the wet waterline
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 70;
  ctx.strokeStyle = 'rgba(10,6,5,0.5)';
  ctx.beginPath();
  for (let x = -W_EYE; x <= W_EYE; x += 20) {
    const y = lidU(x, lift) + 18;
    if (x === -W_EYE) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 30;
  ctx.strokeStyle = 'rgba(10,6,5,0.35)';
  ctx.beginPath();
  for (let x = -W_EYE; x <= W_EYE; x += 20) {
    const y = lidL(x, lift) - 8;
    if (x === -W_EYE) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore(); // opening clip
  // waterline glints
  ctx.strokeStyle = 'rgba(255,230,210,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -W_EYE * 0.8; x <= W_EYE * 0.8; x += 20) {
    const y = lidL(x, lift) - 2;
    if (x === -W_EYE * 0.8) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // lashes
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(8,5,4,0.95)';
  for (let q = 0; q < geo.lashU.length; q += 4) {
    const x0 = geo.lashU[q],
      L = geo.lashU[q + 1] * (1 - 0.5 * Math.abs(x0) / W_EYE),
      curl = geo.lashU[q + 2];
    const y0 = lidU(x0, lift) - 2;
    const dir = x0 / W_EYE;
    ctx.lineWidth = geo.lashU[q + 3];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + dir * L * 0.5, y0 - L * 0.55, x0 + dir * L * 0.9 + L * 0.1 * curl, y0 - L * (0.6 + 0.4 * curl));
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(10,6,5,0.8)';
  for (let q = 0; q < geo.lashL.length; q += 4) {
    const x0 = geo.lashL[q],
      L = geo.lashL[q + 1],
      curl = geo.lashL[q + 2];
    const y0 = lidL(x0, lift) + 3;
    const dir = x0 / W_EYE;
    ctx.lineWidth = geo.lashL[q + 3];
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + dir * L * 0.4, y0 + L * 0.6, x0 + dir * L * 0.8, y0 + L * (0.7 + 0.3 * curl));
    ctx.stroke();
  }
  ctx.restore();
}

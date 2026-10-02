// GPU rendering of the leaf-vein network. The rosette is rasterised ONCE into a "distance-along-path" texture:
//   R = vein coverage (Murray width baked in), G = coverage × (distance from the root / Dmax), B = leaf blade
// so that per pixel the shader knows where it sits along the flow. That gives, for one texture fetch:
// growth (reveal by distance), flowing pulses that travel towards the sink (fract of distance + time),
// the gold → green → teal colour of life along the path, and the vortex twist (inverse-warped lookup).
import { SPIRAL } from '../../lib/handoff';
import { memo } from '../../lib/math';
import { leaves } from './network';

export const TEX = 1024;
export const SPAN = 1040; // ground px covered by the texture (±520 around SPIRAL)
const STEP = 6; // growth step used for the leaves (network.ts)

const toTex = (x: number, y: number): [number, number] => [((x - SPIRAL.x) / SPAN + 0.5) * TEX, ((y - SPIRAL.y) / SPAN + 0.5) * TEX];

export const netDmax = () => memo('s06:dmax', () => leaves().reduce((m, lf) => Math.max(m, lf.nodes.reduce((a, n) => Math.max(a, n.depth), 0)), 0) * STEP);

export const veinTex = () =>
  memo('s06:veinTex', () => {
    const c = document.createElement('canvas');
    c.width = TEX;
    c.height = TEX;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, TEX, TEX);
    const k = TEX / SPAN;
    const Ls = leaves();
    const Dmax = netDmax();
    const WB = 6;
    const DB = 32;
    ctx.lineCap = 'round';
    // oldest (outer, largest) leaf first; younger leaves are drawn on top and OCCLUDE the veins beneath them
    for (const lf of Ls) {
      // blade (B): interior lightness encodes youth (old = dark, young = light), the margin is a bright rim
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      lf.outline.forEach(([x, y], i) => {
        const [u, v] = toTex(x, y);
        if (i === 0) ctx.moveTo(u, v);
        else ctx.lineTo(u, v);
      });
      ctx.closePath();
      ctx.fillStyle = `rgb(0,0,${Math.round(70 + 70 * lf.youth)})`;
      ctx.fill();
      ctx.strokeStyle = 'rgb(0,0,235)';
      ctx.lineWidth = 1.4 * k;
      ctx.stroke();
      // veins (R, G) of this leaf, bucketed by width and distance
      ctx.globalCompositeOperation = 'lighter';
      const paths: Path2D[][] = Array.from({ length: WB }, () => Array.from({ length: DB }, () => new Path2D()));
      for (const n of lf.nodes) {
        if (n.parent < 0) continue;
        const p = lf.nodes[n.parent];
        const b = Math.max(0, Math.min(WB - 1, Math.floor(Math.log2(n.radius) * 1.35)));
        const d = Math.min(DB - 1, Math.floor(((n.depth - 0.5) * STEP * DB) / Dmax));
        const [x0, y0] = toTex(p.x, p.y);
        const [x1, y1] = toTex(n.x, n.y);
        paths[b][d].moveTo(x0, y0);
        paths[b][d].lineTo(x1, y1);
      }
      for (let b = 0; b < WB; b++)
        for (let d = 0; d < DB; d++) {
          const dn = (d + 0.5) / DB;
          ctx.strokeStyle = `rgb(170,${Math.round(170 * dn)},0)`;
          ctx.lineWidth = (0.75 + b * 0.62) * k;
          ctx.stroke(paths[b][d]);
        }
    }
    return c;
  });

/** soft halo of the veins (R), quarter resolution, pre-blurred */
export const veinGlowTex = () =>
  memo('s06:veinGlow', () => {
    const S = 256;
    const a = document.createElement('canvas');
    a.width = S;
    a.height = S;
    const ctx = a.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    const k = S / TEX;
    const Ls = leaves();
    const P = [new Path2D(), new Path2D(), new Path2D()];
    for (const lf of Ls)
      for (const n of lf.nodes) {
        if (n.parent < 0) continue;
        const p = lf.nodes[n.parent];
        const b = Math.min(2, Math.floor(Math.log2(n.radius) * 0.7));
        const [x0, y0] = toTex(p.x, p.y);
        const [x1, y1] = toTex(n.x, n.y);
        P[b].moveTo(x0 * k, y0 * k);
        P[b].lineTo(x1 * k, y1 * k);
      }
    for (let b = 0; b < 3; b++) {
      ctx.strokeStyle = `rgb(${60 + b * 50},0,0)`;
      ctx.lineWidth = 1.2 + b * 1.2;
      ctx.stroke(P[b]);
    }
    const out = document.createElement('canvas');
    out.width = S;
    out.height = S;
    const o = out.getContext('2d', { willReadFrequently: true })!;
    o.fillStyle = '#000';
    o.fillRect(0, 0, S, S);
    o.globalCompositeOperation = 'lighter';
    o.filter = 'blur(2px)';
    o.drawImage(a, 0, 0);
    o.filter = 'blur(6px)';
    o.drawImage(a, 0, 0);
    return out;
  });

export const NET_FRAG = `
uniform sampler2D u_vein;
uniform sampler2D u_glow;
uniform vec2 u_sc;      // screen position of the sink (logical px)
uniform float u_s;      // ground -> screen scale
uniform float u_K;      // differential twist
uniform float u_spin;   // rigid spin (rad)
uniform float u_q;      // inward pull strength 0..1
uniform float u_reveal; // growth front, fraction of Dmax
uniform float u_dmax;
uniform float u_t;      // frames
uniform float u_alpha;
uniform float u_green;  // vein maturity 0..1
uniform float u_flow;   // pulse strength
uniform float u_blade;  // blade visibility
uniform float u_acc;    // pulse speed factor
const float SPAN = ${SPAN.toFixed(1)};

float gfun(float r){ return log(720. / (r + 20.)); }
float pullf(float r){ return 1. - 0.12*u_q*(1. - clamp(r/520., 0., 1.)); }
vec3 life(float d){ // d: 0 root .. 1 tips
  vec3 gold = vec3(1.0, 0.79, 0.29), lime = vec3(0.62, 0.88, 0.42), teal = vec3(0.17, 0.77, 0.65);
  return d > 0.5 ? mix(lime, gold, (d - .5)*2.) : mix(teal, lime, d*2.);
}
float pulse(float x){ float p = fract(x); return step(0.62, p) * pow(1. - (p - 0.62)/0.38, 1.6); }

void main(){
  vec2 px = v_uv * vec2(1080., 1920.);
  vec2 P = (px - u_sc) / u_s;            // twisted ground offset from the sink
  float rp = length(P);
  if (rp > 540.) { gl_FragColor = vec4(0.); return; }
  float r = rp / pullf(rp); r = rp / pullf(r);
  float th = u_K * gfun(r) + u_spin;
  float c = cos(th), s = sin(th);
  vec2 g = mat2(c, -s, s, c) * (P / pullf(r));
  vec2 uv = g / SPAN + 0.5;
  vec4 T = texture2D(u_vein, uv);
  float cov = T.r * (255./170.);
  float d = T.g / max(T.r, 0.004);           // 0 root .. 1 farthest tip
  float dpx = d * u_dmax;
  // growth reveal by distance from the root + white-hot growth front
  float rev = u_reveal * u_dmax;
  float vis = 1. - smoothstep(rev - 6., rev + 2., dpx);
  float front = exp(-pow((dpx - rev)/7., 2.)) * step(0.001, u_reveal) * (1. - step(0.999, u_reveal));
  vec3 base = mix(vec3(1.0, 0.79, 0.29), vec3(0.62, 0.88, 0.42), u_green * (0.55 + 0.45*(1. - d)));
  float w = clamp(cov, 0., 1.);
  vec3 col = base * w * (0.38 + 0.22*cov) * vis;
  // flowing pulses toward the sink
  float fl = max(pulse((dpx + u_t*3.4*u_acc)/46.), 0.55*pulse((dpx + u_t*4.6*u_acc)/71. + 0.37));
  col += life(d) * fl * w * 1.9 * u_flow * vis;
  col += vec3(1.0, 0.96, 0.84) * front * w * 1.6;
  // halo
  float G = texture2D(u_glow, uv).r;
  col += mix(vec3(1.0, 0.79, 0.29), vec3(0.45, 0.85, 0.55), u_green) * G * 0.55 * smoothstep(rev + 30., rev - 10., dpx + 0.);
  // leaf blades (B: 0.27 old … 0.55 young interior, 0.92 margin)
  float B = T.b;
  float fill = smoothstep(0.12, 0.26, B);
  float rim = smoothstep(0.75, 0.92, B);
  float young = clamp((B - 0.27) / 0.28, 0., 1.) * (1. - rim);
  // blade: translucent, lit along the veins' halo; older leaves deep green, younger ones lighter yellow-green
  vec3 bcol = mix(vec3(0.045, 0.17, 0.085), vec3(0.15, 0.30, 0.09), young);
  vec3 blade = bcol * fill * (0.6 + 1.6 * G) + vec3(0.62, 0.88, 0.42) * rim * 0.22;
  col += blade * u_blade;
  col *= u_alpha;
  float a = clamp(max(max(col.r, col.g), col.b), 0., 1.);
  a = max(a, fill * 0.42 * u_blade * u_alpha);
  gl_FragColor = vec4(min(col, vec3(1.)), a);
}`;

// GLSL of the cosmic web (see ./cosmos.tsx for the API). The web's geometry arrives as a structure texture
// (R = main filaments + clusters, G = gas envelope + ionised halos, B = tributaries + groups; rasterised from the exact Voronoi geometry in cosmosWeb.ts by cosmosDraw.ts). This shader does
// the physics shading: the boiling primordial plasma, density contrast, filament beading (3-octave fbm), black-hole
// shadows + lensing, the heat-death random walk and the Beer–Lambert inversion. Cheap enough for SwiftShader at 0.5.
import { hexToRgb } from './math';
import { CELL_PX, MAX_BH } from './cosmosWeb';

/** Palette of the cosmos module (display-space hex). */
export const COSMOS = {
  deep0: '#02030A',
  deep1: '#0B0F2E',
  plasmaHot: '#FFE2B0',
  plasmaMid: '#FF7A3D',
  plasmaLow: '#A3271B',
  /** intermediate stop between plasmaMid and plasmaHot (keeps the mottling golden, never pink) */
  plasmaGold: '#FFB457',
  violet: '#8E5BFF',
  blue: '#4D7CFF',
  node: '#D6E6FF',
  gold: '#FFC94A',
  grey: '#5C5C5C',
  paper: '#F1EADB',
  ink: '#0B0D14',
  inkDilute: '#43506E',
} as const;

/**
 * Display-space blackbody ramp of the plasma: T (≈ heat × local density factor) → colour. Luminance stays high down
 * to T ≈ 0.4 and only falls through the dark-ages band below ~0.3. T > 1 = the hottest granules (towards white).
 */
export const PLASMA_RAMP: ReadonlyArray<readonly [number, string]> = [
  [0.0, '#000000'],
  [0.08, '#150302'],
  [0.16, '#470D07'],
  [0.24, '#8A1F15'],
  [0.32, '#C7391F'],
  [0.42, '#F25A2E'],
  [0.52, COSMOS.plasmaMid],
  [0.66, '#FF9846'],
  [0.8, COSMOS.plasmaGold],
  [0.92, '#FFCF86'],
  [1.0, COSMOS.plasmaHot],
  [1.12, '#FFF1D6'],
  [1.3, '#FFFAEF'],
];

/** Beer–Lambert law of the inverted web, fitted so density 1 over COSMOS.paper = inkDilute and density ∞ = ink. */
export const COSMOS_INK_K: readonly [number, number, number] = [1.413, 1.193, 0.794];
export const COSMOS_INK_FLOOR: readonly [number, number, number] = [0.0456, 0.0556, 0.0912];
/** half-range (px) of the signed inversion-front texture */
export const FRONT_RANGE = 512;
/** soft half-width (px) of each pixel's flip in the inversion (the large-scale softness comes from the front field) */
export const INV_EDGE = 110;

const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(+x.toFixed(6)));
const lin = (h: string) => `vec3(${hexToRgb(h).map((v) => f(Math.pow(v / 255, 2.2))).join(',')})`;
const disp = (h: string) => `vec3(${hexToRgb(h).map((v) => f(v / 255)).join(',')})`;

const rampGLSL = () => {
  let s = `vec3 plasmaDisp(float T){\n  vec3 c = ${disp(PLASMA_RAMP[0][1])};\n`;
  for (let i = 1; i < PLASMA_RAMP.length; i++) {
    const [t0] = PLASMA_RAMP[i - 1];
    const [t1, h] = PLASMA_RAMP[i];
    s += `  c = mix(c, ${disp(h)}, clamp((T - ${f(t0)})/${f(t1 - t0)}, 0.0, 1.0));\n`;
  }
  return s + '  return c;\n}\n';
};

export const WEB_FRAG = /* glsl */ `
uniform vec2 u_size;      // logical size (1080, 1920)
uniform vec4 u_cam;       // centre.x, centre.y (cells, drift included), px per cell, roll
uniform vec2 u_piv;       // pivot (logical px)
uniform float u_c, u_heat, u_t, u_eq, u_inv, u_exp, u_frame, u_die;
uniform vec3 u_mean;      // channel means of the structure texture
uniform float u_bh[${MAX_BH * 4}];   // x, y, r (px), k (0..1)
uniform sampler2D u_struct;
uniform sampler2D u_noise; // 256² tileable: r = 3-oct fbm (8 cells/tile), g = low-freq (2/tile), b = ridged fbm wisps
uniform sampler2D u_over;  // crisp light (display space, additive) — sampled only when u_overK > 0 (heat death)
uniform float u_overK;
uniform sampler2D u_front; // signed inversion front (px), low res, r = 0.5 + F / (2·FRONT_RANGE)
uniform sampler2D u_dust;  // luminance of the galaxy dust at struct res (inversion frames only; else black)

const vec3 DEEP0 = ${lin(COSMOS.deep0)};
const vec3 DEEP1 = ${lin(COSMOS.deep1)};
const vec3 VIOLET = ${lin(COSMOS.violet)};
const vec3 BLUE = ${lin(COSMOS.blue)};
const vec3 NODE = ${lin(COSMOS.node)};
const vec3 GREY = ${disp(COSMOS.grey)};
const vec3 PAPER = ${disp(COSMOS.paper)};
const vec3 INK_K = vec3(${COSMOS_INK_K.map(f).join(',')});
const vec3 INK_F = vec3(${COSMOS_INK_FLOOR.map(f).join(',')});

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
${rampGLSL()}
float g_fil;   // structure presence at the last shaded point (drives the ink wicking)

// a field that BOILS: two decorrelated lookups of one channel (0 = r fbm, 2 = b ridged wisps) cross-faded with
// constant power (so the variance never dips), each drifting while it lives. Returns zero-mean.
float boil(vec2 p, float rate, float salt, float ch){
  float ph = u_t*rate + salt;
  float k0 = floor(ph); float fr = ph - k0;
  vec2 o0 = vec2(hash12(vec2(k0, salt)), hash12(vec2(k0, salt + 7.1)))*9.0;
  vec2 o1 = vec2(hash12(vec2(k0 + 1.0, salt)), hash12(vec2(k0 + 1.0, salt + 7.1)))*9.0;
  vec2 d0 = (vec2(hash12(vec2(k0, salt + 3.3)), hash12(vec2(k0, salt + 5.9))) - 0.5)*0.25;
  vec2 d1 = (vec2(hash12(vec2(k0 + 1.0, salt + 3.3)), hash12(vec2(k0 + 1.0, salt + 5.9))) - 0.5)*0.25;
  vec4 a = texture2D(u_noise, p + o0 + d0*fr);
  vec4 b = texture2D(u_noise, p + o1 + d1*(fr - 1.0));
  float va = ch < 1.0 ? a.r - 0.5 : a.b - 0.36;
  float vb = ch < 1.0 ? b.r - 0.5 : b.b - 0.36;
  return va*cos(fr*1.5707963) + vb*sin(fr*1.5707963);
}

// DISPLAY-space colour of the emissive universe at logical screen position sp
vec3 shade(vec2 sp){
  // black holes: lens the background, cast a shadow
  vec2 q = sp; float shadow = 1.0;
  for (int i = 0; i < ${MAX_BH}; i++){
    float k = u_bh[i*4+3];
    if (k > 0.0) {
      vec2 dd = sp - vec2(u_bh[i*4], u_bh[i*4+1]);
      float r = u_bh[i*4+2]; float d2 = dot(dd,dd) + 1.0;
      q -= k*(2.4*r*r)*dd/d2;
      shadow *= 1.0 - k*(1.0 - smoothstep(r*0.86, r*1.06, sqrt(d2)));
    }
  }
  vec3 S = texture2D(u_struct, clamp(q/u_size, 0.0, 1.0)).rgb;
  // world coords (cells) for the procedural fine structure
  vec2 u = (q - u_piv)/u_cam.z;
  float cr = cos(u_cam.w), sr = sin(u_cam.w);
  vec2 w = u_cam.xy + vec2(cr*u.x + sr*u.y, -sr*u.x + cr*u.y);
  float fb = texture2D(u_noise, w*0.3875).r;
  float fbb = texture2D(u_noise, w*0.9 + vec2(0.53, 0.29)).r;   // fine beads (~0.14 cells)
  float lo = texture2D(u_noise, w*0.21 + vec2(0.37, 0.11)).g;

  float c = u_c;
  float cs = smoothstep(0.0, 1.0, c);
  // matter clumps along the filaments as they collapse (beads = proto-galaxies)
  float bead = mix(1.0, (0.3 + 2.0*fb*fb)*(0.35 + 1.6*fbb*fbb), smoothstep(0.2, 0.95, c));
  float core = S.r, gas = S.g, trib = S.b;
  g_fil = clamp(core*1.2 + gas*1.1 + trib*0.6, 0.0, 1.0);
  vec3 col = vec3(0.0);

  // ── hot era (display space): a boiling, glowing plasma; density contrast grows with c (gravitational instability)
  if (u_heat > 0.1) {
    float cw = mix(0.35, 1.3, cs), tw = mix(0.25, 0.5, cs);   // the thin filaments emerge inside the thick gas
    float sN = (core*cw + gas + trib*tw)/max(u_mean.r*cw + u_mean.g + u_mean.b*tw, 0.02);
    float amp = mix(0.09, 1.0, smoothstep(0.0, 0.75, c));
    // the gas flows: a slow low-frequency swirl warps everything (no two lookups share a lattice → no visible tiling)
    vec2 pm = w*0.3875;
    vec2 wv = vec2(texture2D(u_noise, pm*0.29 + vec2(u_t*0.011, 0.17)).g, texture2D(u_noise, pm*0.29 + vec2(0.61, 0.33 - u_t*0.009)).g) - 0.5;
    float mott = boil(pm + wv*0.4, 0.16, 3.7, 0.0);                                         // ×10⁵ primordial mottling
    float turb = boil(mat2(0.8, 0.6, -0.6, 0.8)*pm*1.9 + wv*0.8 + 1.3, 0.3, 9.1, 0.0);         // billows
    float wisp = boil(mat2(0.6, -0.8, 0.8, 0.6)*pm*0.95 + wv*0.7 + 0.7, 0.42, 17.3, 2.0);      // thin bright wisps
    float fl = 1.0 - 0.75*cs;   // the turbulence calms as matter collapses onto the web
    float rho = max(1.0 + amp*(sN - 1.0) + mott*0.42*(1.0 - cs), 0.0)*mix(1.0, 0.55 + 0.9*bead, cs);
    // local temperature: denser = hotter; wisps and billows hotter than their surroundings
    float T = u_heat*(0.48 + 0.45*min(rho, 3.6)) + u_heat*fl*(0.1*turb + 0.13*wisp);
    vec3 hot = plasmaDisp(T);
    // emission needs matter: once the voids empty (c → 1) they go dark
    hot *= mix(1.0, smoothstep(0.02, 0.8, rho), cs);
    // incandescent bloom: the hottest wisps bleed light into their surroundings
    hot += plasmaDisp(T)*smoothstep(0.98, 1.2, T)*0.22;
    // the dark ages: the glow dies out completely before the cold web lights up (no red + violet = magenta)
    col += hot*smoothstep(0.1, 0.22, u_heat);
  }

  // ── cold era (linear HDR → tone map): the gravity web (violet gas → blue filaments → white-blue clusters)
  // red glow fades into the dark ages before the cold web lights up (no magenta cross-fade)
  float cold = 1.0 - smoothstep(0.04, 0.15, u_heat);
  if (cold > 0.0) {
    float vis = smoothstep(0.05, 0.7, c);
    vec3 web = core*core*mix(BLUE, NODE, smoothstep(0.35, 1.0, core))*2.6*bead
             + core*mix(VIOLET, BLUE, 0.55)*0.9*bead
             + gas*gas*VIOLET*0.9 + gas*mix(VIOLET, BLUE, 0.3)*0.16
             + trib*mix(VIOLET, BLUE, 0.4)*0.75*mix(1.0, bead, 0.6);
    // deep zooms (S09 starts inside one galaxy): the filaments are far bigger than the frame → fade to darkness
    float zf = 1.0 - 0.97*smoothstep(1.6, 5.0, u_cam.z/${CELL_PX.toFixed(1)});
    web *= vis*(1.0 - 0.8*u_die)*zf;
    vec3 bg = mix(DEEP0, DEEP1, smoothstep(0.25, 0.8, lo));
    vec3 E = (web + bg)*cold*u_exp;
    // hue-preserving filmic tone map (saturated light stays saturated) + incandescent whitening when very bright
    float Lm = max(max(E.r, E.g), max(E.b, 1e-6));
    vec3 tc = E*((1.0 - exp(-Lm))/Lm);
    tc = mix(tc, vec3(1.0 - exp(-Lm)), smoothstep(0.6, 3.2, Lm)*0.62);
    col += pow(tc, vec3(1.0/2.2));
  }
  return col*shadow;
}

void main(){
  vec2 sp = v_uv*u_size;
  vec3 col;
  if (u_eq > 0.0005) {
    // heat death: every pixel random-walks (Gaussian displacement, new each frame) → stochastic blur, σ ∝ eq²
    float A = 650.0*u_eq*u_eq + 3.0*u_eq;
    vec2 fc = floor(gl_FragCoord.xy) + fract(u_frame*0.618)*vec2(37.0, 91.0);
    float a1 = hash12(fc*1.01 + 0.5), a2 = hash12(fc*0.73 + 17.3);
    float b1 = hash12(fc*1.37 + 41.1), b2 = hash12(fc*0.91 + 5.7);
    vec2 o1 = sqrt(-2.0*log(max(a1, 1e-4)))*vec2(cos(6.2831853*a2), sin(6.2831853*a2))*A;
    vec2 o2 = sqrt(-2.0*log(max(b1, 1e-4)))*vec2(cos(6.2831853*b2), sin(6.2831853*b2))*A;
    col = 0.5*(shade(sp + o1) + shade(sp + o2));
    if (u_overK > 0.0) {
      // the crisp light random-walks with the web (display space, added like 'lighter')
      vec3 t1 = texture2D(u_over, clamp((sp + o1)/u_size, 0.0, 1.0)).rgb;
      vec3 t2 = texture2D(u_over, clamp((sp + o2)/u_size, 0.0, 1.0)).rgb;
      col += u_overK*0.5*(t1 + t2);
    }
  } else {
    col = shade(sp);
    if (u_overK > 0.0) col += u_overK*texture2D(u_over, v_uv).rgb;
  }
  col = min(col, vec3(1.0));
  if (u_eq > 0.0005) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l), smoothstep(0.0, 0.7, u_eq));
    col = mix(col, GREY, smoothstep(0.3, 0.97, u_eq));
    vec2 fc = gl_FragCoord.xy + fract(u_frame*0.381)*vec2(113.0, 57.0);
    float n = hash12(fc*1.13 + 3.1) + hash12(fc*0.87 + 9.7) - 1.0;
    col += n*0.06*smoothstep(0.12, 0.9, u_eq);
  }
  if (u_inv > 0.0005) {
    // the negative: emitted light becomes optical density of ink on backlit cream paper (Beer–Lambert)
    float l = dot(col, vec3(0.3, 0.55, 0.15));
    float rhoI = 2.8*l*l + 1.2*l;
    float a = texture2D(u_dust, v_uv).r; rhoI += 2.2*a + 3.0*a*a;
    // the front: a large-scale signed field from JS (multi-octave lobes) + billowing fine scale here, pulled ahead
    // along the web's structure — the ink wicks along the filaments before it floods the voids
    float F = (texture2D(u_front, v_uv).r - 0.5)*${(2 * FRONT_RANGE).toFixed(1)};
    float fine = (texture2D(u_noise, sp*0.0042 + vec2(0.71, 0.13)).r - 0.5)*60.0 + (texture2D(u_noise, sp*0.011 + vec2(0.29, 0.83)).r - 0.5)*16.0;
    float k = smoothstep(-${INV_EDGE.toFixed(1)}, ${INV_EDGE.toFixed(1)}, F + fine + 130.0*g_fil);
    // two stages, so every intermediate colour lies on the ink's own Beer–Lambert curve (never a neutral grey):
    // (1) the web's light drains into dense ink-dark, (2) that ink thins out, revealing the paper and the inked web
    float aK = smoothstep(0.0, 0.4, k), bK = smoothstep(0.12, 1.0, k);
    bK = sqrt(bK);   // the ink thins quickly at first, then lingers: a soft wash, not a hard edge
    float rho = mix(3.4, rhoI, bK);
    vec3 inked = PAPER*(INK_F + (1.0 - INK_F)*exp(-rho*INK_K));
    col = mix(col, inked, aK);
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

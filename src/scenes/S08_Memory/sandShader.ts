// S08 — sand heightfield shader (top view, low raking sun from the right, elevation ≈ 12°).
// Height = two trains of asymmetric wind ripples (steep lee faces left/downwind, long stoss faces right/upwind; the
// second train at 0.6 λ rotated 8°; phase defects where crests fork or end) − footprints (relief texture: R raised
// sand, G depression). Lighting: Lambert key + analytic horizon-test cast shadows (ripple crests and print walls shade
// the troughs — the ripple height function is known, so the test costs no texture taps on bare sand) + cool sky fill
// in the shadows + glints. Also: molten gold pooling in the prints, the rewind glitch, and the rewind's cyan "target":
// the pristine, undented ripple field (time-symmetric law colour) that shatters when the rewind fails.
import { GLSL } from '../../lib/Shader';

/** shader source; the rewind variant (glitch tears + cyan target) compiles only for the frames that need it */
export const sandFrag = (rewind: boolean) => `
${rewind ? '#define REWIND 1' : ''}
uniform sampler2D u_relief;
uniform vec2 u_rs;        // relief texel size (uv)
uniform vec4 u_cam;       // world centre x,y ; zoom ; relief scale
uniform vec2 u_anchor;    // screen anchor px
uniform float u_t;
uniform float u_light;    // key light intensity
uniform float u_dark;     // fade sand to background
uniform float u_gold;     // molten gold inside the prints
uniform float u_glitch;   // rewind-attempt tearing
uniform float u_wind;     // drifting sand veil
uniform vec3 u_dof;       // focus x,y (uv) ; strength
uniform vec4 u_ghost;     // rewind target: print world x,y ; alpha ; shatter 0..1
uniform sampler2D u_noise; // low-frequency noise (sandNoise.ts): rg dune gradient, b light pool, a veil

${GLSL.hash}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
float a=hash12(i),b=hash12(i+vec2(1,0)),c=hash12(i+vec2(0,1)),d=hash12(i+vec2(1,1));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
// quintic (C2) value noise for the ripple phase: no creases along the lattice lines
float vnoise5(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
float a=hash12(i),b=hash12(i+vec2(1,0)),c=hash12(i+vec2(0,1)),d=hash12(i+vec2(1,1));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}

const vec2 RES = vec2(1080.0, 1920.0);
const float DEP = 8.0;    // depression depth (world px) at full depth
const float RIM = 2.8;    // raised sand height
const float LAM = 62.0;   // ripple wavelength (world px)
const float AMP = 3.0;    // ripple height (world px)
const float LEE = 0.22;   // lee-face fraction of a ripple (steep, ~20°: at the angle the sun can't reach)
const vec3 L = vec3(0.96014, -0.18192, 0.21224);   // sun: from the right, a little from the top, 12.3° high
const vec2 LD = vec2(0.98252, -0.18616);           // its horizontal direction
const float TANE = 0.2172;                         // tan(elevation)
const vec2 K1 = vec2(1.0, 0.16) / 62.0;
const vec2 K2 = vec2(0.9679, 0.2976) / 37.2;
const vec3 BG = vec3(10.0, 7.0, 5.0) / 255.0;
const vec3 SKY = vec3(0.2, 0.19, 0.25);

vec3 sandRamp(float l){
  vec3 s0 = BG, s1 = vec3(26.,18.,11.)/255., s2 = vec3(110.,82.,53.)/255., s3 = vec3(217.,178.,124.)/255., s4 = vec3(246.,223.,178.)/255.;
  l = max(l, 0.0);
  if (l < 0.12) return mix(s0, s1, l / 0.12);
  if (l < 0.40) return mix(s1, s2, (l - 0.12) / 0.28);
  if (l < 0.72) return mix(s2, s3, (l - 0.40) / 0.32);
  return mix(s3, s4, min(1.0, (l - 0.72) / 0.3)) + vec3(0.08, 0.06, 0.03) * max(0.0, l - 1.02);
}

// ripple profile: lee rise over s in [0, LEE], stoss fall over [LEE, 1]
float ripH(float s){ return smoothstep(0.0, LEE, s) - smoothstep(LEE, 1.0, s); }
float ripD(float s){
  float u1 = clamp(s / LEE, 0.0, 1.0);
  float u2 = clamp((s - LEE) / (1.0 - LEE), 0.0, 1.0);
  return 6.0 * u1 * (1.0 - u1) / LEE - 6.0 * u2 * (1.0 - u2) / (1.0 - LEE);
}
float relH(vec2 uv){
  vec2 r = texture2D(u_relief, uv).rg;
  return r.r * RIM - r.g * DEP;
}

void main(){
  vec2 screen = v_uv * RES;
  // rewind glitch: horizontal tears (never across the narration band)
#ifdef REWIND
  if (u_glitch > 0.0 && (screen.y < 1330.0 || screen.y > 1560.0)) {
    float band = floor(v_uv.y * 42.0 + hash12(vec2(floor(u_t), 4.0)) * 3.0);
    float r = hash12(vec2(band, floor(u_t)));
    if (r > 0.6) screen.x += (hash12(vec2(band, floor(u_t) + 7.0)) - 0.5) * u_glitch * 70.0;
  }
#endif
  vec2 uv = screen / RES;
  float z = u_cam.z;
  vec2 world = u_cam.xy + (screen - u_anchor) / z;

  vec2 rel = texture2D(u_relief, uv).rg;
  float dep = clamp(rel.g, 0.0, 1.0);
  bool bare = rel.r + rel.g < 0.002;

  // ---- wind ripples: two trains + phase defects (forks / terminations where the phase jumps half a wavelength)
  vec2 wr = mat2(0.8, 0.6, -0.6, 0.8) * world;     // rotated lattice: no axis-aligned seams
  float w = vnoise5(wr * 0.0024) * 1.7 + vnoise5(world * 0.0093 + 7.3) * 0.5;
  float defT = smoothstep(0.3, 0.7, vnoise5(vec2(wr.y, -wr.x) * 0.0036 + 21.0));
  float ph1 = dot(world, K1) + w + 0.5 * defT;
  float ph2 = dot(world, K2) + 0.6 * w + 0.37 - 0.35 * defT;
  float am = vnoise(world * 0.0042 + 3.1);
  float a1r = (0.3 + 0.7 * am) * AMP * (1.0 - 0.7 * defT * (1.0 - defT) * 4.0);
  float a2r = 0.26 * AMP * (0.35 + 0.65 * (1.0 - am));
  float flat0 = 1.0 - dep;                  // a print wipes the ripples where it pressed
  float s1 = fract(ph1);
  float s2 = fract(ph2);
  float hr = (a1r * ripH(s1) + a2r * ripH(s2)) * flat0;
  vec2 gRip = (a1r * ripD(s1) * K1 + a2r * ripD(s2) * K2) * flat0;

  // ---- relief (prints) gradient, world units
  float e = 1.0;
  vec2 du = vec2(u_rs.x * e, 0.0), dv = vec2(0.0, u_rs.y * e);
  float stepW = 2.0 * e / (u_cam.w * z);
  vec2 gRel = vec2(0.0);
  float h0 = 0.0;
  if (!bare) {
    gRel = vec2(relH(uv + du) - relH(uv - du), relH(uv + dv) - relH(uv - dv)) / stepW;
    h0 = rel.r * RIM - rel.g * DEP;
  }

  // ---- broad dune undulation (low-frequency light & shade) + light pools, from the noise texture
  vec4 nz = texture2D(u_noise, world / 4096.0);
  vec2 gDune = (nz.rg - 0.5) * 0.22;

  // ---- depth of field: away from the focus the relief softens
  vec2 fd = (v_uv - u_dof.xy) * vec2(0.75, 1.0);
  float defocus = smoothstep(0.16, 0.55, length(fd)) * u_dof.z;
  gRel *= 1.0 - 0.55 * defocus;
  gRip *= 1.0 - 0.75 * defocus;
  vec3 N = normalize(vec3(-(gRel + gRip + gDune), 1.0));

  // ---- cast shadows: horizon test toward the sun (ripples analytic, prints from the relief texture)
  float H0 = hr + h0;
  float occ = 0.0;
  for (int i = 1; i <= 4; i++) {
    float d = float(i * i) * 2.6 + 2.0;           // 4.6, 12.4, 25.4, 43.6 world px
    float fq = flat0;
    float rq = 0.0;
    if (!bare) {
      vec2 rr = texture2D(u_relief, uv + LD * d * z / RES).rg;
      rq = rr.r * RIM - rr.g * DEP;
      fq = 1.0 - clamp(rr.g, 0.0, 1.0);
    }
    float hq = (a1r * ripH(fract(ph1 + d * dot(K1, LD))) + a2r * ripH(fract(ph2 + d * dot(K2, LD)))) * fq + rq;
    occ = max(occ, smoothstep(0.0, 0.9, hq - H0 - d * TANE));
  }
  occ *= 1.0 - 0.5 * defocus;

  float ndl = max(dot(N, L), 0.0);
  float direct = ndl * (1.0 - occ) / L.z;              // 1 = flat sand in full sun
  float amb = 0.26 * (0.75 + 0.25 * N.z);
  float pool = 0.92 + 0.16 * nz.b;
  float albedo = 0.95 + 0.1 * hash12(floor(world * 0.9));
  float l = (amb + 0.38 * direct) * pool * albedo * u_light;
  vec3 sand = sandRamp(l);
  // cool sky fill where the sun doesn't reach
  float shade = 1.0 - smoothstep(0.0, 0.75, direct);
  sand = mix(sand, SKY * pool * u_light, 0.4 * shade);

  // ---- glints: grains catching the low sun on lit faces
  float cell = max(2.2, 2.6 / z);
  float gl = hash12(floor(world / cell) + floor(u_t / 5.0) * 0.37);
  float glint = (1.0 - defocus) * step(mix(0.9965, 0.999, smoothstep(1.0, 2.0, z)), gl) * smoothstep(0.9, 1.4, direct) * u_light;
  sand += vec3(1.0, 0.93, 0.78) * glint * 0.85;

  // ---- colour patches + drifting veil of blown sand (right -> left)
  float patchN = nz.b;
  sand *= mix(vec3(0.88, 0.83, 0.79), vec3(1.05, 1.02, 0.98), patchN);
  float veil = texture2D(u_noise, (world + vec2(23.0 * u_t, 0.0)) / 4096.0).a;
  sand += vec3(0.95, 0.8, 0.58) * smoothstep(0.55, 1.0, veil) * 0.05 * u_wind * u_light;

  vec3 col = sand;

  // ---- the rewind's target (cyan, time-symmetric law): the pristine, undented ripple crests over the fresh print
#ifdef REWIND
  if (u_ghost.z > 0.001) {
    vec2 r0 = world - u_ghost.xy;
    float sh = u_ghost.w;
    mat2 R = mat2(0.866, 0.5, -0.5, 0.866);
    vec2 rad = normalize(r0 + vec2(0.001, 0.0));
    vec2 cid = floor(R * (r0 - rad * 70.0 * sh) / 36.0);
    vec2 hh = hash22(cid + 17.0);
    vec2 cc = (cid + 0.5) * 36.0 * R;               // shard centre (R^T, since R is a rotation)
    vec2 drift = normalize(cc + vec2(0.001, 0.0)) * 70.0 + (hh - 0.5) * 80.0;
    vec2 src = r0 - drift * sh;
    float inShard = (floor(R * src / 36.0) == cid) ? 1.0 : 0.0;
    inShard = sh > 0.0 ? inShard : 1.0;
    float shardA = inShard * (1.0 - smoothstep(0.0, 1.0, sh * 1.5 - hh.x * 0.5));
    vec2 wq = u_ghost.xy + src;
    // only where the print now is: the dent at the shard's source position, slightly grown
    vec2 suv = (u_anchor + (wq - u_cam.xy) * z) / RES;
    float sdep = texture2D(u_relief, suv).g;
    float inPrint = smoothstep(0.02, 0.25, sdep);
    float g1 = dot(wq, K1) + w + 0.5 * defT;
    float sc = fract(g1 - LEE + 0.5) - 0.5;            // signed phase distance to the (pristine) crest
    float lw = 3.0 / (z * LAM);
    float line = 1.0 - smoothstep(lw * 0.6, lw * 1.6, abs(sc));
    float sc2 = fract(g1 - 0.62 + 0.5) - 0.5;          // a fainter mid-stoss contour
    line += 0.4 * (1.0 - smoothstep(lw * 0.4, lw * 1.2, abs(sc2)));
    float scan = 0.8 + 0.2 * sin(screen.y * 0.9);
    float gk = clamp((line * 2.2 + 0.1) * inPrint * u_ghost.z * shardA * scan, 0.0, 1.0);
    col = mix(col, vec3(0.224, 0.882, 1.0), gk) + vec3(0.1, 0.4, 0.5) * gk * 0.4;
  }
#endif

  // ---- molten gold pooling in the prints
  vec3 gold = vec3(1.0, 0.79, 0.29);
  float molten = smoothstep(0.05, 0.9, dep) * u_gold;
  vec3 emis = gold * molten * 0.85 + vec3(1.0, 0.96, 0.84) * smoothstep(0.75, 1.0, dep) * u_gold * 0.5;

  col = mix(col, BG, u_dark) + emis;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Two-pass WebGL renderer for the ink bloom (see src/lib/ink.tsx for the scene-author API).
//   pass 1 (DENSITY_FRAG): optical density ρ of the vortex-ring cascade → half-float texture
//   pass 2 (COMPOSE_FRAG): Beer–Lambert transmittance with RGB split → canvas, composited with CSS multiply
// Runs on SwiftShader (CPU): noise comes from a baked tileable texture (one fetch instead of ~70 ALU ops),
// every ring is bounding-culled, and the loops are bounded.
import { memo } from './math';
import { mulberry32 } from './random';

/** 1 primary + 4 lobes + 12 grand-lobes (the cascade is fixed at modes 4 → 3). Tight bounds keep SwiftShader's JIT small. */
export const INK_MAX_RINGS = 17;

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 0.5-a_pos.y*0.5); gl_Position = vec4(a_pos,0.,1.); }`;

export const DENSITY_FRAG = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_noise; // 256² tileable smooth value noise, 4 independent channels, REPEAT + LINEAR
uniform vec2 u_view;      // logical frame size (1080, 1920)
uniform vec4 u_cam;       // zoom, origin x, origin y, RGB split px (blends the 3rd warp octave out continuously)
uniform vec4 u_org;       // impact x, surface y, size scale, seed
uniform vec4 u_t;         // age, spread, ring count, haze level
uniform vec4 u_warp;      // warp amp px, fine warp amp px, sheet-fold texture weight, advect ring count
uniform vec4 u_halo;      // global halo: centre x, centre y (local), radius, strength
uniform vec4 u_bb;        // local-space bounding box of the cascade (x0, y0, x1, y1): outside it only the haze is evaluated
                          // (kept alive up to spread = 1 so the advected texture frame never jumps)
uniform vec4 u_A[${INK_MAX_RINGS}]; // x, y, R, e
uniform vec4 u_B[${INK_MAX_RINGS}]; // tilt, core strength, core radius px, dome strength
uniform vec4 u_C[${INK_MAX_RINGS}]; // anchor x, anchor y, stem width, stem strength
uniform vec4 u_D[${INK_MAX_RINGS}]; // halo strength, halo radius, lobe amp, lobe phase
uniform vec4 u_E[${INK_MAX_RINGS}]; // lobe N, body bound radius, advect x, advect y
uniform vec4 u_F[${INK_MAX_RINGS}]; // bell height, stem bow, crispness (0 = Gaussian core, 1 = glossy hard-edged tube), -
vec4 N(vec2 p){ return texture2D(u_noise, p); }
float segDist(vec2 p, vec2 a, vec2 b, out float h){
  vec2 pa=p-a, ba=b-a; h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-3),0.,1.); return length(pa-ba*h);
}
void main(){
  vec2 scr = v_uv * u_view;
  vec2 world = u_cam.yz + (scr - u_cam.yz) / u_cam.x;
  float size = u_org.z;
  vec2 p = (world - u_org.xy) / size;          // local px, origin at impact, y = depth
  float age = u_t.x, spread = u_t.y;
  int n0 = int(u_t.z + .5);
  if (p.y < -3.) { gl_FragColor = vec4(0.); return; }
  float seed = u_org.w;

  // ── texture frame advected with the rings (detail rides with the ink instead of sliding through it)
  bool inside = p.x > u_bb.x && p.y > u_bb.y && p.x < u_bb.z && p.y < u_bb.w;
  vec2 adv = vec2(0.); float wsum = 0.35;
  int na = inside ? int(u_warp.w + .5) : 0;
  int n = inside ? n0 : 0;
  for (int i=0;i<6;i++){
    if (i>=na) break;
    vec4 A=u_A[i];
    vec2 d=p-A.xy; float rr=A.z*2.4+30.;
    float w=exp(-dot(d,d)/(rr*rr));
    adv+=w*u_E[i].zw; wsum+=w;
  }
  adv/=wsum;
  vec2 q = p - adv + vec2(seed*137.1, seed*71.7);

  // ── domain warp: 3 fetches (each gives a 2D vector), amplitude ∝ √age (diffusion). While time is being scrubbed
  // (RGB split) the 3rd octave is blended out CONTINUOUSLY (no jump when the split eases in) and skipped at ≥ 2 px.
  vec2 wv = N(q/1500.).rg*.55 + N(q/700.+vec2(.31,.17)).rg*.3;
  float w3 = 1. - smoothstep(.5, 2., u_cam.w);
  if (w3 > 0.) wv += N(q/330.+vec2(.71,.43)).rg*(.15*w3);
  wv = wv/(.85 + .15*w3) - .5;
  vec2 pw = p + wv * u_warp.x;
  vec2 q2 = q + wv*90.;
  vec4 nf = N(q2/260. + vec2(.13,.57));
  pw += (nf.rg - .5) * u_warp.y;

  float spreadW = 1. + 4.*spread;
  float inv = 1./spreadW;
  // approaching spread = 1 every ring-borne term fades out CONTINUOUSLY (the JS side skips the ring loop only once
  // this is exactly 0, at spread ≥ 0.995) — no pop where 「散尽的墨」 holds on uniformity
  float ringK = 1. - smoothstep(.8, .995, spread);
  float rho = 0.;
  float head = 0.;   // heads: receive the sheet texture
  float soft = 0.;   // stems: smooth
  for (int i=0;i<${INK_MAX_RINGS};i++){
    if (i>=n) break;
    vec4 A=u_A[i], B=u_B[i], C=u_C[i], D=u_D[i], E=u_E[i], F=u_F[i];
    vec2 d = pw - A.xy;
    float d2 = dot(d,d);
    float R = A.z, e = A.w;
    // per-ring dilute cloud (soft)
    float hr = D.y*spreadW;
    if (d2 < 7.*hr*hr) rho += D.x * exp(-d2/(hr*hr)) * inv;
    // wake / stem: a soft sheet from the head's top back to its anchor
    vec2 top = A.xy + vec2(-sin(B.x)*F.x, -cos(B.x)*F.x*0.92);
    float sw = C.z*spreadW;
    float bw = abs(F.y);
    vec2 lo = min(top, C.xy) - vec2(sw*3.+bw), hi = max(top, C.xy) + vec2(sw*3.+bw);
    if (pw.x>lo.x && pw.y>lo.y && pw.x<hi.x && pw.y<hi.y) {
      float h; segDist(pw, top, C.xy, h);
      vec2 pb = pw - vec2(F.y*sin(3.14159*h), 0.);   // gentle bow along the stem
      float sd = segDist(pb, top, C.xy, h);
      float ww = sw*(0.6+1.6*(1.-h)*(1.-h)*(1.-h));   // flares into the bell, thin where stretched
      soft += C.w * exp(-sd*sd/(ww*ww)) * (0.35+0.65*(1.-h)) * inv;
    }
    float bnd = E.y*spreadW;
    if (d2 > bnd*bnd) continue;
    float cs=cos(B.x), sn=sin(B.x);
    d = vec2(cs*d.x+sn*d.y, -sn*d.x+cs*d.y);
    vec2 qq = d / vec2(R, R*e);
    // Widnall waviness before the split: the core bends up/down N times around the ring.
    // sin(Nφ + phase) from complex powers of (cos φ, sin φ) — no atan (expensive on SwiftShader).
    if (D.z > 0.001) {
      vec2 z = qq / (length(qq) + 1e-4);
      vec2 z2 = vec2(z.x*z.x - z.y*z.y, 2.*z.x*z.y);
      vec2 zn = E.x > 3.5 ? vec2(z2.x*z2.x - z2.y*z2.y, 2.*z2.x*z2.y) : vec2(z2.x*z.x - z2.y*z.y, z2.x*z.y + z2.y*z.x);
      d.y -= D.z * R * (zn.y*cos(D.w) + zn.x*sin(D.w));
      qq = d / vec2(R, R*e);
    }
    float r = length(qq) + 1e-4;
    float g = length(vec2(qq.x/R, qq.y/(R*e))) / r;
    float dist = (r-1.) / max(g, 1e-4);   // radial estimate: good near the ring's ends, but on the major axis of a
    float s2 = qq.y*qq.y / (r*r);         // flat ellipse it jumps (it measured along x) — that was a white slit
    if (abs(qq.x) < 1.) {
      // distance to the near / far branch straight above / below: continuous across the major axis
      float yb = R*e*sqrt(1. - qq.x*qq.x);
      float dv = abs(abs(d.y) - yb);
      dist = min(abs(dist), dv);
      s2 = mix(s2, 1. - qq.x*qq.x, smoothstep(.98, .4, r));   // sin²φ of the nearest core point
    }
    // fat core: optical path is longest where the line of sight runs along the core (the ring's two ends)
    float pl = 0.34 + 0.66*exp(-s2/0.12);
    float a = B.z*spreadW;
    // rolled-up layers: faint banding around the core, strongest at the ends
    float roll = 1. - 0.14*pl*pl*(0.5+0.5*sin(dist*0.3 + age*2.2 + float(i)*1.7));
    float x2 = dist*dist/(a*a);
    float core = B.y * pl * exp(-x2*(1. + F.z*x2)) * roll * inv;   // crisp: super-Gaussian edge (young, glossy core)
    // cap: the bubble's rear surface — a thin sheet (dark where seen edge-on) over a faint fill
    vec2 hq = d / vec2(R*1.1, F.x);
    float hl = length(hq);
    float upper = smoothstep(R*e*0.4, -R*e*0.6, d.y);
    float sheet = exp(-(hl-1.)*(hl-1.)/((0.018 - 0.008*F.z)*spreadW*spreadW));
    float fill = smoothstep(1.05, 0.55, hl);
    float dome = B.w * upper * (0.85*sheet + 0.38*fill) * inv;
    // the vortex bubble carries dyed fluid right through the ring's hole: a translucent fill, never a clear slit
    float hole = B.w * 0.55 * smoothstep(1.08, 0.45, r) * inv;
    head += core + dome + hole;
  }
  // sheet texture: thin dark folds where a warped field crosses a level (ink sheets seen edge-on)
  vec4 ns = N(q2/240. + nf.ba*.25);
  float fold = 1. - abs(2.*ns.r - 1.);
  float lines = fold*fold; lines *= lines; lines *= fold*fold;   // ^6
  float tex = mix(1., 0.8 + 0.6*lines, u_warp.z);
  float lumpy = 0.8 + 0.4*smoothstep(0.1, 0.9, ns.g);            // gentle billowy variation
  rho = (rho + head * tex * mix(1., lumpy, u_warp.z) + soft * (0.85 + 0.3*ns.g)) * ringK;
  // global halo: the dilute cloud that widens with age, broken into soft wisps (ring-independent: survives spread 1)
  vec2 gd = (pw - u_halo.xy) / (u_halo.z*vec2(1.2, 1.));
  rho += u_halo.w * exp(-dot(gd,gd)) * (0.55 + 0.9*N(q/900. + vec2(.4,.9)).b);
  // fully spread haze: almost uniform with faint residual structure
  if (spread > 0.) {
    float sp = smoothstep(0., 1., spread);
    float haze = u_t.w * (0.9 + 0.22*(N(q/2400.).a - .5) + 0.12*(ns.g - .5) + 0.06*(lines - .2));
    rho = mix(rho, haze + rho*0.12, sp*sp);
  }
  // only in the water
  rho *= smoothstep(-2., 2., p.y);
  gl_FragColor = vec4(rho, 0., 0., 1.);
}`;

export const COMPOSE_FRAG = `precision highp float;
varying vec2 v_uv;
uniform sampler2D u_d;
uniform vec4 u_split;   // split in uv x, -, opacity, encoded(1)=rgba8
uniform vec3 u_k;
uniform vec3 u_floor;
float rd(vec2 uv){
  vec4 t = texture2D(u_d, vec2(uv.x, 1.-uv.y));
  return u_split.w > .5 ? (t.r*16. + t.g*16./255.) : t.r;
}
void main(){
  vec2 uv = v_uv;
  vec3 rho;
  if (u_split.x > 0.) {
    rho = vec3(rd(uv + vec2(u_split.x, 0.)), rd(uv), rd(uv - vec2(u_split.x, 0.)));
  } else {
    float r = rd(uv); rho = vec3(r);
  }
  rho = max(rho, 0.) * u_split.z;
  vec3 T = exp(-rho * u_k);
  gl_FragColor = vec4(u_floor + (1.-u_floor)*T, 1.);
}`;

/** Baked 256² RGBA tileable value noise (lattice 16 + 32, smoothstep), 4 independent channels. */
export function inkNoiseTexture(): Uint8Array {
  return memo('ink-noise-tex', () => {
    const S = 256;
    const out = new Uint8Array(S * S * 4);
    for (let ch = 0; ch < 4; ch++) {
      const layer = (cells: number, seed: number) => {
        const r = mulberry32(seed);
        const lat = new Float32Array(cells * cells);
        for (let i = 0; i < lat.length; i++) lat[i] = r();
        return (x: number, y: number) => {
          const fx = (x / S) * cells,
            fy = (y / S) * cells;
          const ix = Math.floor(fx),
            iy = Math.floor(fy);
          let tx = fx - ix,
            ty = fy - iy;
          tx = tx * tx * (3 - 2 * tx);
          ty = ty * ty * (3 - 2 * ty);
          const at = (a: number, b: number) => lat[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
          const a = at(ix, iy),
            b = at(ix + 1, iy),
            c = at(ix, iy + 1),
            d = at(ix + 1, iy + 1);
          return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
        };
      };
      const l1 = layer(16, 1013 + ch * 77);
      const l2 = layer(32, 2027 + ch * 91);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const v = l1(x, y) * 0.68 + l2(x, y) * 0.32;
          // stretch contrast a little so the channel covers ~0..1
          out[(y * S + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round((0.5 + (v - 0.5) * 1.5) * 255)));
        }
    }
    return out;
  });
}

/** Packed per-frame uniforms for the density pass. */
export interface InkGLFrame {
  view: [number, number];
  cam: [number, number, number, number];
  org: [number, number, number, number];
  t: [number, number, number, number];
  warp: [number, number, number, number];
  halo: [number, number, number, number];
  /** local-space bbox of the cascade (x0, y0, x1, y1) */
  bb: [number, number, number, number];
  A: Float32Array;
  B: Float32Array;
  C: Float32Array;
  D: Float32Array;
  E: Float32Array;
  F: Float32Array;
  split: number; // uv units
  opacity: number;
  /** bounding box of the ink in logical px [x0, y0, x1, y1] (density pass is scissored to it), or null = full */
  bbox: [number, number, number, number] | null;
  k: readonly [number, number, number];
  floor: readonly [number, number, number];
}

interface Prog {
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
}

/** Minimal two-pass GL pipeline bound to one canvas. */
export class InkGL {
  gl: WebGLRenderingContext;
  private pD: Prog;
  private pC: Prog;
  private fbo: WebGLFramebuffer;
  private tex: WebGLTexture;
  private noise: WebGLTexture;
  private tw = 0;
  private th = 0;
  private rgba8 = false;
  private halfType = 0;
  private buf: WebGLBuffer;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: false }) as WebGLRenderingContext;
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const hf = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    const cb = gl.getExtension('EXT_color_buffer_half_float');
    if (hf && cb) this.halfType = hf.HALF_FLOAT_OES;
    else this.rgba8 = true;
    this.pD = this.program(DENSITY_FRAG);
    this.pC = this.program(COMPOSE_FRAG);
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.fbo = gl.createFramebuffer()!;
    this.tex = gl.createTexture()!;
    this.noise = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, inkNoiseTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  private program(frag: string): Prog {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('ink shader: ' + gl.getShaderInfoLog(sh));
      return sh;
    };
    const src = this.rgba8
      ? frag.replace(
          'gl_FragColor = vec4(rho, 0., 0., 1.);',
          'float rr=clamp(rho,0.,15.99)/16.; float hi=floor(rr*255.)/255.; gl_FragColor=vec4(hi,(rr-hi)*255.,0.,1.);',
        )
      : frag;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, src));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('ink link: ' + gl.getProgramInfoLog(prog));
    return { prog, locs: new Map() };
  }

  private use(p: Prog) {
    const gl = this.gl;
    gl.useProgram(p.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const loc = gl.getAttribLocation(p.prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return (n: string) => {
      if (!p.locs.has(n)) p.locs.set(n, gl.getUniformLocation(p.prog, n));
      return p.locs.get(n)!;
    };
  }

  private ensureTarget(w: number, h: number) {
    if (w === this.tw && h === this.th) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, this.rgba8 ? gl.UNSIGNED_BYTE : this.halfType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !this.rgba8) {
      // fall back to 8-bit encoding
      this.rgba8 = true;
      this.pD = this.program(DENSITY_FRAG);
      this.tw = 0;
      this.ensureTarget(w, h);
      return;
    }
    this.tw = w;
    this.th = h;
  }

  /** Density pass at (dw, dh), compose pass to the canvas. */
  render(f: InkGLFrame, dw: number, dh: number) {
    const gl = this.gl;
    this.ensureTarget(dw, dh);
    // pass 1: density
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, dw, dh);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (f.bbox) {
      const sx = dw / f.view[0],
        sy = dh / f.view[1];
      const x0 = Math.max(0, Math.floor(f.bbox[0] * sx) - 2),
        x1 = Math.min(dw, Math.ceil(f.bbox[2] * sx) + 2);
      const y0 = Math.max(0, Math.floor(f.bbox[1] * sy) - 2),
        y1 = Math.min(dh, Math.ceil(f.bbox[3] * sy) + 2);
      if (x1 <= x0 || y1 <= y0) {
        this.compose(f);
        return;
      }
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, dh - y1, x1 - x0, y1 - y0);
    }
    let L = this.use(this.pD);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.uniform1i(L('u_noise'), 1);
    gl.uniform2f(L('u_view'), f.view[0], f.view[1]);
    gl.uniform4fv(L('u_cam'), f.cam);
    gl.uniform4fv(L('u_org'), f.org);
    gl.uniform4fv(L('u_t'), f.t);
    gl.uniform4fv(L('u_warp'), f.warp);
    gl.uniform4fv(L('u_halo'), f.halo);
    gl.uniform4fv(L('u_bb'), f.bb);
    gl.uniform4fv(L('u_A[0]'), f.A);
    gl.uniform4fv(L('u_B[0]'), f.B);
    gl.uniform4fv(L('u_C[0]'), f.C);
    gl.uniform4fv(L('u_D[0]'), f.D);
    gl.uniform4fv(L('u_E[0]'), f.E);
    gl.uniform4fv(L('u_F[0]'), f.F);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    this.compose(f);
  }

  private compose(f: InkGLFrame) {
    const gl = this.gl;
    // pass 2: compose
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const L = this.use(this.pC);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(L('u_d'), 0);
    gl.uniform4f(L('u_split'), f.split, 0, f.opacity, this.rgba8 ? 1 : 0);
    gl.uniform3f(L('u_k'), f.k[0], f.k[1], f.k[2]);
    gl.uniform3f(L('u_floor'), f.floor[0], f.floor[1], f.floor[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

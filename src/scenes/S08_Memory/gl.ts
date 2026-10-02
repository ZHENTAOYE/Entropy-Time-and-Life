// S08 — offscreen WebGL fragment-shader runner (same conventions as lib/Shader.tsx: FRAG_HEADER, v_uv top-left).
// The result is drawn into S08's single CPU canvas (one DOM raster layer for the whole scene: every extra full-frame
// DOM layer costs a lot in the headless compositor).
// PERFORMANCE (measured): never drawImage() a WebGL canvas into the CPU canvas — Chrome then silently moves that 2D
// canvas onto the (SwiftShader-emulated) GPU path and every later 2D op of the frame gets 10–100× slower (a full-frame
// gradient 8 → 90 ms, the dendrite strokes 6 → 600 ms). Instead the pixels are read back with gl.readPixels into a
// CPU canvas (≈15 ms for 540×960). The quad is rendered upside-down so readPixels' bottom-up rows come out top-down.
import { FRAG_HEADER } from '../../lib/Shader';
import { memo } from '../../lib/math';

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 0.5+a_pos.y*0.5); gl_Position = vec4(a_pos,0.,1.); }`;

interface GLS {
  c: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
  tex: Map<string, WebGLTexture>;
}

function setup(frag: string, w: number, h: number): GLS {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false, alpha: true }) as WebGLRenderingContext;
  if (!gl) throw new Error('WebGL unavailable');
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('S08 shader compile error: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_HEADER + frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('S08 link error: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return { c, gl, prog, locs: new Map(), tex: new Map() };
}

export type Uniforms = Record<string, number | number[]>;

export type Tex = TexImageSource | { src: TexImageSource; repeat: boolean };

/** Render `frag` and return a CPU-backed canvas holding the result (safe to drawImage into a CPU canvas). */
export function renderFrag(key: string, frag: string, w: number, h: number, uniforms: Uniforms, textures: Record<string, Tex>): HTMLCanvasElement {
  const s = renderFragGL(key, frag, w, h, uniforms, textures);
  const gl = s.getContext('webgl') as WebGLRenderingContext;
  const rb = memo(`S08:glrb:${key}:${w}x${h}`, () => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.createImageData(w, h);
    return { c, ctx, img, px: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength) };
  });
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, rb.px);
  rb.ctx.putImageData(rb.img, 0, 0);
  return rb.c;
}

/** Render `frag` into a memoised offscreen w×h WebGL canvas and return it (rows upside-down: use renderFrag). */
function renderFragGL(key: string, frag: string, w: number, h: number, uniforms: Uniforms, textures: Record<string, Tex>): HTMLCanvasElement {
  const s = memo(`S08:gl:${key}:${w}x${h}`, () => setup(frag, w, h));
  const { gl, prog, locs } = s;
  gl.useProgram(prog);
  const L = (n: string) => {
    if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
    return locs.get(n)!;
  };
  gl.viewport(0, 0, w, h);
  gl.uniform2f(L('u_resolution'), w, h);
  for (const [name, v] of Object.entries(uniforms)) {
    const l = L(name);
    if (!l) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    else gl.uniform1fv(l, new Float32Array(v));
  }
  let unit = 0;
  for (const [name, tx] of Object.entries(textures)) {
    const src = 'repeat' in (tx as object) ? (tx as { src: TexImageSource }).src : (tx as TexImageSource);
    const wrap = 'repeat' in (tx as object) && (tx as { repeat: boolean }).repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    let t = s.tex.get(name);
    if (!t) {
      t = gl.createTexture()!;
      s.tex.set(name, t);
    }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.uniform1i(L(name), unit);
    unit++;
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return s.c;
}

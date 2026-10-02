// Offscreen WebGL renderer for the vein network: one context per tab on a DETACHED canvas, static textures uploaded
// once, the result blitted into the scene's single 2D canvas (one fewer full-frame layer in the software compositor).
import { memo } from '../../lib/math';
import { FRAG_HEADER } from '../../lib/Shader';

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 0.5-a_pos.y*0.5); gl_Position = vec4(a_pos,0.,1.); }`;

interface GLState {
  cv: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: Map<string, WebGLUniformLocation | null>;
  tex: Map<string, { src: TexImageSource; t: WebGLTexture }>;
}

const glState = (frag: string, w: number, h: number): GLState =>
  memo(`s06:gl:${w}x${h}:${frag.length}`, () => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const gl = cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: true, antialias: false, alpha: true }) as WebGLRenderingContext;
    const sh = (type: number, src: string) => {
      const o = gl.createShader(type)!;
      gl.shaderSource(o, src);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error('S06 shader: ' + gl.getShaderInfoLog(o));
      return o;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG_HEADER + frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    return { cv, gl, prog, loc: new Map(), tex: new Map() };
  });

/** Render `frag` at `k` × 1080×1920 and return the canvas (draw it into the 2D canvas at 1080×1920). */
export function renderGL(frag: string, uniforms: Record<string, number | number[]>, textures: Record<string, TexImageSource>, k = 1): HTMLCanvasElement {
  return renderGLSize(frag, uniforms, textures, Math.round(1080 * k), Math.round(1920 * k));
}

/** Render `frag` into a w×h detached canvas (one context per shader & size, per tab). */
export function renderGLSize(frag: string, uniforms: Record<string, number | number[]>, textures: Record<string, TexImageSource>, w: number, h: number): HTMLCanvasElement {
  const s = glState(frag, w, h);
  const { gl, prog, loc } = s;
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const L = (n: string) => {
    if (!loc.has(n)) loc.set(n, gl.getUniformLocation(prog, n));
    return loc.get(n)!;
  };
  gl.uniform2f(L('u_resolution'), w, h);
  for (const [n, v] of Object.entries(uniforms)) {
    const l = L(n);
    if (!l) continue;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
  }
  let unit = 0;
  for (const [n, src] of Object.entries(textures)) {
    let e = s.tex.get(n);
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (!e || e.src !== src) {
      const t = e?.t ?? gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      // names ending in _rep: power-of-two map, wraps in u, mipmapped (minified towards the Earth's limb)
      const rep = n.endsWith('_rep');
      if (rep) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, rep ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, rep ? gl.REPEAT : gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      e = { src, t };
      s.tex.set(n, e);
    } else gl.bindTexture(gl.TEXTURE_2D, e.t);
    gl.uniform1i(L(n), unit);
    unit++;
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return s.cv;
}

/** Render a shader ONCE and keep a 2D-canvas copy of the result (e.g. a generated texture map). */
export const bakeGL = (key: string, frag: string, uniforms: Record<string, number | number[]>, w: number, h: number): HTMLCanvasElement =>
  memo('s06:bake:' + key, () => {
    const src = renderGLSize(frag, uniforms, {}, w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(src, 0, 0);
    return c;
  });

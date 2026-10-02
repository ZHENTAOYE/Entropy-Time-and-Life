import React, { useLayoutEffect, useRef } from 'react';
import { useVideoConfig } from 'remotion';

export type UniformValue = number | number[] | Float32Array;

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 0.5-a_pos.y*0.5); gl_Position = vec4(a_pos,0.,1.); }`;

/** Prepended to every fragment shader. v_uv: (0,0)=top-left, (1,1)=bottom-right (DOM orientation). */
export const FRAG_HEADER = `precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution; // internal canvas size in px
`;

interface GLState {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
  tex: Map<string, WebGLTexture>;
  frag: string;
}

/**
 * Full-frame WebGL fragment-shader layer (rendered with SwiftShader on CPU: keep shaders moderate,
 * use `scale` 0.5 for soft/blurry content). Write only `void main(){...}` plus helpers; FRAG_HEADER is
 * prepended. Uniforms: number -> float, [a,b] -> vec2, [a,b,c] -> vec3, [a,b,c,d] -> vec4,
 * Float32Array -> float[] (declare `uniform float u_x[N];`). `textures` uploads canvases as sampler2D
 * (texture units in insertion order) every frame.
 */
export const ShaderLayer: React.FC<{
  frag: string;
  uniforms?: Record<string, UniformValue>;
  textures?: Record<string, TexImageSource | null | undefined>;
  width?: number;
  height?: number;
  scale?: number;
  style?: React.CSSProperties;
}> = ({ frag, uniforms = {}, textures = {}, width, height, scale = 1, style }) => {
  const { width: vw, height: vh } = useVideoConfig();
  const w = width ?? vw;
  const h = height ?? vh;
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<GLState | null>(null);

  useLayoutEffect(() => {
    return () => {
      const s = st.current;
      if (s) s.gl.getExtension('WEBGL_lose_context')?.loseContext();
      st.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    let s = st.current;
    if (!s || s.frag !== frag) {
      const gl =
        s?.gl ??
        (c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false }) as WebGLRenderingContext);
      if (!gl) throw new Error('WebGL unavailable');
      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type)!;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          throw new Error('Shader compile error: ' + gl.getShaderInfoLog(sh) + '\n' + src);
        }
        return sh;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_HEADER + frag));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      s = { gl, prog, locs: new Map(), tex: new Map(), frag };
      st.current = s;
    }
    const { gl, prog, locs } = s;
    const L = (n: string) => {
      if (!locs.has(n)) locs.set(n, gl.getUniformLocation(prog, n));
      return locs.get(n)!;
    };
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(L('u_resolution'), c.width, c.height);
    for (const [name, v] of Object.entries(uniforms)) {
      const l = L(name);
      if (!l) continue;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v instanceof Float32Array) gl.uniform1fv(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else if (v.length === 4) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
      else gl.uniform1fv(l, new Float32Array(v));
    }
    let unit = 0;
    for (const [name, src] of Object.entries(textures)) {
      if (!src) continue;
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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(L(name), unit);
      unit++;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });

  return (
    <canvas
      ref={ref}
      width={Math.round(w * scale)}
      height={Math.round(h * scale)}
      style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, ...style }}
    />
  );
};

/** Handy GLSL snippets to paste into shaders. */
export const GLSL = {
  hash: `float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}`,
  valueNoise: `float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
float a=hash12(i),b=hash12(i+vec2(1,0)),c=hash12(i+vec2(0,1)),d=hash12(i+vec2(1,1));
return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*vnoise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}`,
};

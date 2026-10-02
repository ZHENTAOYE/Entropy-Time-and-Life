import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Composition, registerRoot } from 'remotion';

const Probe: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [txt, setTxt] = useState('');
  useLayoutEffect(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') as WebGLRenderingContext;
    const ext = gl.getSupportedExtensions()?.join(' ');
    const hf = gl.getExtension('OES_texture_half_float');
    const f = gl.getExtension('OES_texture_float');
    gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('WEBGL_color_buffer_float');
    // test render to half float
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    let st = 'none';
    if (hf) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, hf.HALF_FLOAT_OES, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      st = 'hf:' + (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE);
    }
    setTxt(`${gl.getParameter(gl.VERSION)} | ${gl.getParameter(gl.MAX_TEXTURE_SIZE)} | float:${!!f} half:${!!hf} ${st} | ${ext} | hw=${navigator.hardwareConcurrency}`);
  }, []);
  return <AbsoluteFill style={{ background: '#fff', fontSize: 30, padding: 40, wordBreak: 'break-all' }}><div ref={ref}>{txt}</div></AbsoluteFill>;
};
registerRoot(() => <Composition id="InkPreview" component={Probe} durationInFrames={10} fps={30} width={1080} height={1920} />);

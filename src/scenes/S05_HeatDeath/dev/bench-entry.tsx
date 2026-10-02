// Dev-only micro-benchmark (not part of the film): times S05's own renderers in-browser.
import React, { useLayoutEffect, useRef } from 'react';
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { webGeometry, fullParams } from '../../../lib/cosmos';
import { drawShells, shells } from '../shells';
import { drawGrey, drawVignette, drawWebPost } from '../post';
import { vignetteAt, webAt } from '../timing';
import { useFontGate } from '../fontGate';
import { FONT_SPECS } from '../fonts';
import { drawHistogram, drawLoupe } from '../instruments';
import { drawCounters, drawGauge, drawReticles, drawTimecode } from '../hud';
import { drawLockup } from '../lockup';
import { drawCaptions } from '../captions';
import { drawGold } from '../gold';

const Bench: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const bf = useCurrentFrame();
  const ready = useFontGate(FONT_SPECS);
  useLayoutEffect(() => {
    if (!ready) return;
    const L: string[] = [];
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const src = document.createElement('canvas');
    src.width = 1080;
    src.height = 1920;
    const sx = src.getContext('2d')!;
    sx.fillStyle = '#223';
    sx.fillRect(0, 0, 1080, 1920);
    let t0 = performance.now();
    const S = shells();
    L.push(`shells ${S.length} precompute ${(performance.now() - t0).toFixed(0)} ms`);
    const time = (name: string, fn: () => void, n = 1) => {
      fn();
      const t1 = performance.now();
      for (let i = 0; i < n; i++) fn();
      ctx.getImageData(0, 0, 1, 1);
      return (performance.now() - t1) / n;
    };
    for (const f of [[20, 100], [150, 176], [200, 230], [270, 330], [370, 470]][bf % 5]) {
      const p = fullParams(webAt(f));
      const geo = webGeometry(p, 160);
      const parts: string[] = [];
      parts.push('sh ' + time('', () => { ctx.globalCompositeOperation = 'lighter'; drawShells(ctx, { frame: f, width: 1080, height: 1920, geo, params: p }, f); ctx.globalCompositeOperation = 'source-over'; }).toFixed(1));
      parts.push('post ' + time('', () => (f < 300 ? drawWebPost(ctx, src, f) : drawGrey(ctx, f))).toFixed(1));
      parts.push('vig ' + time('', () => drawVignette(ctx, vignetteAt(f))).toFixed(1));
      parts.push('inst ' + time('', () => { drawHistogram(ctx, f, src); drawLoupe(ctx, f); drawReticles(ctx, f); }).toFixed(1));
      parts.push('lock ' + time('', () => drawLockup(ctx, f)).toFixed(1));
      parts.push('hud ' + time('', () => { drawTimecode(ctx, f); drawCounters(ctx, f); drawGauge(ctx, f); }).toFixed(1));
      parts.push('cap ' + time('', () => { drawCaptions(ctx, f); drawGold(ctx, f); }).toFixed(1));
      L.push(`f${f}: ` + parts.join(' | '));
    }
    if (ref.current) ref.current.innerText = L.join('\n');
  });
  return <div ref={ref} style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', fontSize: 24, fontFamily: 'monospace', padding: 30, whiteSpace: 'pre' }} />;
};
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={10} fps={30} width={1080} height={1920} />);

// S09 dev bench (NOT part of the film): times the parts of a frame with performance.now() and prints them on the
// frame. node scripts/stills.mjs scratch:src/scenes/S09_Ink/dev/bench.tsx --comp Bench --frames 150,170,190 --scale 0.4
import React, { useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { pullbackWeb, pullbackWebOn, pcam, mwT } from '../pullback';
import { drawMilkyWay, drawLocalGroup, drawGalaxyField, drawStars } from '../space';
import { drawEarth } from '../earth';
import { drawStreets, metroRaster } from '../city';

const Bench: React.FC = () => {
  const f = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [txt, setTxt] = useState('');
  const t0 = useRef(performance.now());
  const webOn = pullbackWebOn(f);
  const wp = webOn ? pullbackWeb(f) : null;
  useLayoutEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const out: string[] = [`web layout ${(performance.now() - t0.current).toFixed(0)}`];
    const cam = pcam(f);
    const m = (name: string, fn: () => void) => {
      const a = performance.now();
      fn();
      out.push(`${name} ${(performance.now() - a).toFixed(1)}`);
    };
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1080, 1920);
    const web = wrap.current?.querySelector('canvas');
    if (web) m('webBlit', () => ctx.drawImage(web, 0, 0, 1080, 1920));
    m('field', () => drawGalaxyField(ctx, cam, mwT(f), 1));
    m('local', () => drawLocalGroup(ctx, cam, mwT(f), 1));
    m('mw', () => drawMilkyWay(ctx, cam, mwT(f), 1));
    m('stars', () => drawStars(ctx, cam, f / 30, 1));
    m('earth', () => drawEarth(ctx, cam, 1, 1, 0));
    m('metro', () => metroRaster());
    m('streets', () => drawStreets(ctx, cam, f / 30, 1, 1));
    setTxt(`f${f} Z ${cam.Z.toFixed(2)}\n` + out.join('\n'));
  }, [f]);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {wp ? (
        <div ref={wrap} style={{ display: 'none' }}>
          <CosmicWeb {...wp} flares={{ spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 }} />
        </div>
      ) : null}
      <canvas ref={ref} width={1080} height={1920} style={{ position: 'absolute', width: 1080, height: 1920 }} />
      <pre style={{ position: 'absolute', left: 40, top: 60, color: '#0f0', fontSize: 34, whiteSpace: 'pre' }}>{txt}</pre>
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="Bench" component={Bench} durationInFrames={848} fps={30} width={1080} height={1920} />);

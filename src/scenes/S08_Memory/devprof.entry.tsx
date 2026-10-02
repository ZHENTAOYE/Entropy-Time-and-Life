// TEMPORARY dev-only profiling entry (not part of the film; deleted after the revision).
import React from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CpuCanvas } from './CpuCanvas';
import { drawFrame } from './Scene';
import { camera } from './trail';
import { sandNoise } from './sandNoise';
import { bakeNet, getNet } from './network';
import { grainTile } from './grainTex';
import { reliefSprite, shadowSprite } from './relief';
import { renderFrag } from './gl';
import { sandFrag } from './sandShader';
import { Scene, SceneBody } from './Scene';
import { SceneFrame } from '../../lib/SceneFrame';

const Prof: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0A0705' }}>
      <CpuCanvas
        draw={(ctx) => {
          const runs: Array<Array<[string, number]>> = [];
          for (let r = 0; r < 3; r++) {
            const marks: Array<[string, number]> = [];
            let t0 = performance.now();
            const T0 = t0;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, 1080, 1920);
            drawFrame(ctx, f, camera(f), (label) => {
              ctx.getImageData(0, 0, 1, 1); // force the deferred raster to flush
              const t = performance.now();
              marks.push([label, Math.round(t - t0)]);
              t0 = t;
            });
            ctx.getImageData(0, 0, 1, 1);
            marks.push(['TOTAL', Math.round(performance.now() - T0)]);
            runs.push(marks);
          }
          console.log('PROF ' + f + ' ' + JSON.stringify(runs));
        }}
      />
    </AbsoluteFill>
  );
};
const Cold: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#0A0705' }}>
      <CpuCanvas
        draw={(ctx) => {
          const out: string[] = [];
          const T = (n: string, fn: () => unknown) => { const t0 = performance.now(); fn(); out.push(n + '=' + Math.round(performance.now() - t0)); };
          T('sandNoise', () => sandNoise());
          T('getNet', () => getNet());
          T('grainTile', () => grainTile());
          T('relief0-2', () => { reliefSprite(0); reliefSprite(1); reliefSprite(2); });
          T('shadow2-4', () => { shadowSprite(2); shadowSprite(3); shadowSprite(4); });
          const cv = document.createElement('canvas'); cv.width = 540; cv.height = 960;
          T('shaderCompile+run', () => renderFrag('sand', sandFrag(false), 540, 960, { u_cam: [540, 960, 1, 0.5] }, { u_relief: cv, u_noise: { src: sandNoise(), repeat: true } }));
          T('shaderRun2', () => renderFrag('sand', sandFrag(false), 540, 960, { u_cam: [540, 960, 1, 0.5] }, { u_relief: cv, u_noise: { src: sandNoise(), repeat: true } }));
          T('drawFrame cold', () => drawFrame(ctx, f, camera(f)));
          T('flush', () => ctx.getImageData(0, 0, 1, 1));
          console.log('BENCH ' + out.join(' | '));
        }}
      />
    </AbsoluteFill>
  );
};
const Bake: React.FC = () => (
  <AbsoluteFill>
    <CpuCanvas draw={() => { const j = bakeNet(); for (let i = 0; i < j.length; i += 60000) console.log('BAKE' + String(i).padStart(9, '0') + j.slice(i, i + 60000)); console.log('BAKEEND'); }} />
  </AbsoluteFill>
);
const Verify: React.FC = () => (
  <AbsoluteFill>
    <CpuCanvas draw={() => {
      const t0 = performance.now();
      const net = getNet();
      const dt = performance.now() - t0;
      const fresh = JSON.parse(bakeNet());
      const b64 = (a: ArrayBufferView) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
      const keys = ['x', 'y', 'r', 'tA', 'dist', 'seedH', 'firstKid', 'parent'] as const;
      const bad = keys.filter((k) => b64((net as any)[k]) !== fresh.arrays[k]);
      const somaOk = JSON.stringify(net.somas) === JSON.stringify(fresh.somas);
      console.log('BENCH decode=' + dt.toFixed(1) + 'ms n=' + net.n + '/' + fresh.n + ' mismatched=' + JSON.stringify(bad) + ' somas=' + somaOk);
    }} />
  </AbsoluteFill>
);
const Null: React.FC = () => <AbsoluteFill style={{ background: '#0A0705' }} />;
const NullFrame: React.FC = () => <SceneFrame><Null /></SceneFrame>;
const CanvasOnly: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <SceneFrame>
      <AbsoluteFill style={{ background: '#0A0705' }}>
        <CpuCanvas draw={(ctx) => drawFrame(ctx, f, camera(f))} />
      </AbsoluteFill>
    </SceneFrame>
  );
};
const CanvasNoGrain: React.FC = () => {
  const f = useCurrentFrame();
  return (
      <AbsoluteFill style={{ background: '#0A0705' }}>
        <CpuCanvas draw={(ctx) => drawFrame(ctx, f, camera(f))} />
      </AbsoluteFill>
  );
};
const Full: React.FC = () => <SceneFrame><Scene /></SceneFrame>;
const NoHud: React.FC = () => <SceneFrame><SceneBody hud={false} /></SceneFrame>;
const NoCap: React.FC = () => <SceneFrame><SceneBody captions={false} /></SceneFrame>;
registerRoot(() => (
  <>
    <Composition id="S08prof" component={Prof} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="Cold" component={Cold} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="Bake" component={Bake} durationInFrames={2} fps={30} width={1080} height={1920} />
    <Composition id="Verify" component={Verify} durationInFrames={2} fps={30} width={1080} height={1920} />
    <Composition id="Null" component={Null} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="NullFrame" component={NullFrame} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="CanvasOnly" component={CanvasOnly} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="CanvasNoGrain" component={CanvasNoGrain} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="NoHud" component={NoHud} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="NoCap" component={NoCap} durationInFrames={570} fps={30} width={1080} height={1920} />
    <Composition id="Full" component={Full} durationInFrames={570} fps={30} width={1080} height={1920} />
  </>
));

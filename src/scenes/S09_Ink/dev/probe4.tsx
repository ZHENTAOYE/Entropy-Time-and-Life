// S09 dev probe 4 (NOT part of the film): the real pull-back frame with parts switched off.
import React, { useRef } from 'react';
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from 'remotion';
import { CosmicWeb } from '../../../lib/cosmos';
import { DEV, drawPullback, pullbackWeb } from '../pullback';
import { Layer } from '../canvas';
import { FONT_SPECS, useFontGate } from '../fonts';

const SETS = [[], ['web'], ['field', 'local'], ['mw'], ['post'], ['caps'], ['hud', 'marker', 'vig'], ['web', 'field', 'local', 'mw', 'post', 'caps', 'hud', 'marker', 'vig']];
const P: React.FC = () => {
  const fr = useCurrentFrame();
  const mode = fr % SETS.length;
  const F0 = 170;
  DEV.skip = new Set(SETS[mode]);
  const fontsReady = useFontGate(FONT_SPECS);
  const wrap = useRef<HTMLDivElement>(null);
  const wp = pullbackWeb(F0);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div ref={wrap} style={{ display: 'none' }}>
        <CosmicWeb {...wp} flares={{ spikes: 1 / Math.max(1, wp.zoom / 2), size: 1 / Math.max(1, Math.sqrt(wp.zoom / 2)), groups: wp.zoom < 6 }} />
      </div>
      <Layer draw={(ctx) => drawPullback(ctx, F0, (wrap.current?.querySelector('canvas') as HTMLCanvasElement) ?? null, fontsReady)} version={(fontsReady ? 'f' : 'w') + mode} />
    </AbsoluteFill>
  );
};
registerRoot(() => <Composition id="P" component={P} durationInFrames={8} fps={30} width={1080} height={1920} />);

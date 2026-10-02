// S09 dev probe: CosmicWeb at the pull-back's zoom levels, centred on a heavy cluster.
// node scripts/stills.mjs scratch:src/scenes/S09_Ink/dev/probe.tsx --comp Probe --frames 0,1,2,3,4,5 --scale 0.4 --out out/stills/S09_probe
import React from 'react';
import { Composition, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';
import { CosmicWeb, WEB_FINAL, centerOn, webNodes } from '../../../lib/cosmos';

const T0 = WEB_FINAL.t + 30;
const hero = () =>
  webNodes({ ...WEB_FINAL, t: T0, roll: 0 }, { groups: false })
    .filter((n) => Math.abs(n.x - 540) < 300 && Math.abs(n.y - 960) < 400)
    .sort((a, b) => b.mass - a.mass)[0];
const ZOOMS = [120, 40, 12, 4, 1.6, 0.8];
const Probe: React.FC = () => {
  const f = useCurrentFrame();
  const n = hero();
  const z = ZOOMS[f % ZOOMS.length];
  return (
    <SceneFrame>
      <CosmicWeb {...WEB_FINAL} t={T0} zoom={z} roll={0.05} {...centerOn(n.wx, n.wy, T0)} py={940} />
      <div style={{ position: 'absolute', left: 90, top: 240, color: '#fff', fontSize: 30, fontFamily: 'monospace' }}>zoom {z}</div>
    </SceneFrame>
  );
};
registerRoot(() => <Composition id="Probe" component={Probe} durationInFrames={6} fps={30} width={1080} height={1920} />);

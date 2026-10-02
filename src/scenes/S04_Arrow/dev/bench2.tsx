// S04 dev bench 2 (not part of the film; never imported by Scene.tsx): cold cost of individual layers.
import React from 'react';
import { AbsoluteFill, Composition, Freeze, registerRoot, useCurrentFrame } from 'remotion';
import { SceneFrame } from '../../../lib/SceneFrame';
import { CanvasLayer } from '../../../lib/Canvas';
import { CosmicWeb, COSMOS, COSMOS_INK_FLOOR, COSMOS_INK_K } from '../../../lib/cosmos';
import { InkBloom, InkStage, InkTank } from '../../../lib/ink';
import { drawArrow } from '../arrow';
import { drawCosmosExtras, webParams } from '../cosmosTrack';
import { PenroseLayer } from '../Penrose';
import { Counter } from '../hud';
import { Voice } from '../Voice';

const Web: React.FC<{ f: number; scale: number; extras?: boolean }> = ({ f, scale, extras }) => {
  const P = webParams(f);
  return <CosmicWeb {...P} scale={scale} draw={extras ? (ctx, info) => drawCosmosExtras(ctx, info.frame, P) : undefined} />;
};
const Ink: React.FC<{ f: number }> = ({ f }) => (
  <InkStage>
    <InkTank time={f / 30} impactAge={-1} surfaceY={-100} paper={COSMOS.paper} />
    <InkBloom age={20 + f / 30} spread={1} haze={0.38} seed={1} surfaceY={-100} k={COSMOS_INK_K as [number, number, number]} floor={COSMOS_INK_FLOOR as [number, number, number]} />
  </InkStage>
);
const at = (f: number, node: React.ReactNode) => <Freeze frame={f}>{node}</Freeze>;
const CASES: Array<() => React.ReactNode> = [
  () => <AbsoluteFill style={{ background: '#000' }} />,
  () => at(450, <Web f={450} scale={0.4} />),
  () => at(450, <><Web f={450} scale={0.4} /><PenroseLayer f={450} /></>),
  () => at(450, <PenroseLayer f={450} />),
  () => at(400, <><Web f={400} scale={0.4} /><PenroseLayer f={400} /></>),
  () => at(560, <Web f={560} scale={0.4} />),
  () => at(560, <Ink f={560} />),
  () => at(180, <Web f={180} scale={0.5} extras />),
  () => at(180, <Web f={180} scale={0.5} />),
  () => at(180, <CanvasLayer draw={(ctx, { frame }) => drawArrow(ctx, frame)} />),
  () => at(90, <CanvasLayer draw={(ctx, { frame }) => drawArrow(ctx, frame)} />),
  () => at(560, <Voice text={'怪的是：它几乎完全{均匀}，\n像散尽的墨。'} from={493} dur={116} color="#17151C" accent="#2E4A7A" />),
  () => at(195, <Counter f={195} />),
  () => at(240, <Web f={240} scale={0.5} extras />),
];
const Bench: React.FC = () => {
  const f = useCurrentFrame();
  return <SceneFrame><AbsoluteFill style={{ background: '#000' }}>{CASES[f % CASES.length]()}</AbsoluteFill></SceneFrame>;
};
registerRoot(() => <Composition id="Bench2" component={Bench} durationInFrames={960} fps={30} width={1080} height={1920} />);

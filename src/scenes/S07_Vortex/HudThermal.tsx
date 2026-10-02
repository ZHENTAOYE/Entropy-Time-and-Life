// Thermal-camera HUD: FLIR chrome, colour bar (°C → log W/kg), spot meter, ≈100 W bulb, box tools BX1/BX2 with the
// monumental ×7000, the S-gauge twin ticks (S身体 flat / S宇宙 rising), and the ❚❚ / ▶ timecode of the freeze.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { COLOR } from '../../lib/handoff';
import { SGauge, Timecode } from '../../lib/hud';
import { clamp, ease, seg, smoothstep } from '../../lib/math';
import { camAt, project } from './camera';
import { lutCss, SUN_R, sunY } from './thermal';
import { T } from './timing';
import { intakeAt } from './flow';
import { safeBox } from './Hud';

const VOICE = '#F3EFE6';
const fade = (f: number, a: number, b: number, inLen = 8, outLen = 8) => Math.min(seg(f, a, a + inLen), 1 - seg(f, b - outLen, b));
const INFERNO_GRAD = 'linear-gradient(to top, #05030F 0%, #1B0C41 11%, #4A0C6B 22%, #781C6D 33%, #A52C60 44%, #CF4446 55%, #ED6925 66%, #FB9B06 77%, #F7D13D 88%, #FCFFA4 100%)';

const mono = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute',
  fontFamily: FONT.mono,
  fontSize: size,
  letterSpacing: '0.12em',
  whiteSpace: 'pre',
  fontVariantNumeric: 'tabular-nums',
  ...extra,
});
const sans = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: 'absolute',
  fontFamily: FONT.sans,
  fontSize: size,
  letterSpacing: '0.12em',
  whiteSpace: 'pre',
  ...extra,
});

/** line-art light bulb, glowing in the thermal ramp */
const Bulb: React.FC<{ x: number; y: number; s: number; glow: number }> = ({ x, y, s, glow }) => (
  <svg width={60 * s} height={84 * s} viewBox="0 0 60 84" style={{ position: 'absolute', left: x, top: y, overflow: 'visible', filter: `drop-shadow(0 0 ${8 + 10 * glow}px rgba(251,155,6,${0.5 * glow + 0.2}))` }}>
    <defs>
      <linearGradient id="s07bulb" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#CF4446" />
        <stop offset="0.5" stopColor="#FB9B06" />
        <stop offset="1" stopColor="#FCFFA4" />
      </linearGradient>
    </defs>
    <path d="M30 4 C14 4 5 16 5 29 C5 40 12 46 17 53 C19 56 20 59 20 62 L40 62 C40 59 41 56 43 53 C48 46 55 40 55 29 C55 16 46 4 30 4 Z" fill="none" stroke="url(#s07bulb)" strokeWidth="3" />
    <path d="M22 62 L22 70 L38 70 L38 62 M23 74 L37 74 M26 78 L34 78" fill="none" stroke="url(#s07bulb)" strokeWidth="3" strokeLinecap="round" />
    <path d="M24 50 L24 36 L30 42 L36 36 L36 50" fill="none" stroke="#FCFFA4" strokeWidth="2.2" strokeLinejoin="round" opacity={0.6 + 0.4 * glow} />
  </svg>
);

/** FLIR corner brackets */
const Brackets: React.FC<{ a: number }> = ({ a }) => {
  const L = 54;
  const c = `rgba(243,239,230,${0.55 * a})`;
  const corners: Array<[number, number, number, number]> = [
    [60, 170, 1, 1],
    [1020, 170, -1, 1],
    [60, 1690, 1, -1],
    [1020, 1690, -1, -1],
  ];
  return (
    <>
      {corners.map(([x, y, sx, sy], i) => (
        <React.Fragment key={i}>
          <div style={{ position: 'absolute', left: sx > 0 ? x : x - L, top: y - 1, width: L, height: 2, background: c }} />
          <div style={{ position: 'absolute', left: x - 1, top: sy > 0 ? y : y - L, width: 2, height: L, background: c }} />
        </React.Fragment>
      ))}
      {/* centre reticle */}
    </>
  );
};

export const HudThermal: React.FC = () => {
  const f = useCurrentFrame();
  useFontsReady([
    [`400 22px ${FONT.mono}`, 'LWIR8–14µmε0.98SP1BX12°CW/kg≈×0123456789.·kcal=PAUSE '],
    [`400 26px ${FONT.sans}`, '你太阳每公斤功率按算模式低熵高熵吃进排出天⁻¹⁰⁴'],
    [`600 210px ${FONT.latin}`, '×70'],
  ]);
  if (f < T.scan0) return null;
  const cam = camAt(f);
  const p = new Float32Array(3);
  const els: React.ReactNode[] = [];
  const chromeA = fade(f, T.scan0 + 10, T.tilt2a + 26, 14, 20);

  // ---- FLIR chrome
  if (chromeA > 0.01) {
    els.push(<Brackets key="br" a={chromeA} />);
    const wkg = smoothstep(T.sunIn0, T.sunIn0 + 10, f) * (1 - smoothstep(T.sunOut0, T.sunOut0 + 10, f));
    els.push(
      <div key="band" style={mono(20, { right: 90, top: 1608, color: VOICE, opacity: 0.6 * chromeA, textAlign: 'right' })}>
        {wkg > 0.5 ? '模式  每公斤功率  W/kg' : 'LWIR 8–14 µm   ε 0.98'}
      </div>,
    );
  }

  // ---- colour bar (left lane; becomes the S-gauge at beat 9)
  const barA = fade(f, T.scan1 - 4, T.gauge0 + 6, 14, 14);
  if (barA > 0.01) {
    const y0 = 560;
    const y1 = 1360;
    const wkg = smoothstep(T.sunIn0 + 4, T.sunIn0 + 16, f) * (1 - smoothstep(T.sunOut0 - 4, T.sunOut0 + 6, f));
    els.push(
      <div key="bar" style={{ position: 'absolute', left: 62, top: y0, width: 14, height: y1 - y0, background: INFERNO_GRAD, opacity: 0.9 * barA, boxShadow: '0 0 12px rgba(0,0,0,0.6)' }} />,
    );
    // °C labels
    const cA = barA * (1 - wkg);
    if (cA > 0.01) {
      els.push(
        <div key="c1" style={mono(20, { left: 92, top: y0 - 12, color: VOICE, opacity: 0.7 * cA })}>37.0°C</div>,
        <div key="c2" style={mono(20, { left: 92, top: y1 - 12, color: VOICE, opacity: 0.7 * cA })}>20.0°C</div>,
      );
    }
    // log W/kg scale with the two markers: you (1.4) and the Sun (0.0002)
    if (wkg > 0.01) {
      const lg = (v: number) => y1 - ((Math.log10(v) + 4.3) / 5.3) * (y1 - y0);
      const ticks = [1, 0, -1, -2, -3, -4];
      ticks.forEach((e) => {
        const yy = lg(Math.pow(10, e));
        els.push(
          <div key={'t' + e} style={mono(18, { left: 90, top: yy - 10, color: VOICE, opacity: 0.55 * wkg, letterSpacing: '0.05em' })}>
            {'— 10'}
            <span style={{ fontSize: 13, position: 'relative', top: -8 }}>{e < 0 ? '−' + -e : String(e)}</span>
          </div>,
        );
      });
      const mk = (v: number, label: string, col: string, k: string) => {
        const yy = lg(v);
        els.push(
          <div key={k} style={{ position: 'absolute', left: 50, top: yy - 1, width: 38, height: 2, background: col, opacity: wkg, boxShadow: `0 0 8px ${col}` }} />,
          <div key={k + 'l'} style={sans(22, { left: 156, top: yy - 15, color: col, opacity: wkg })}>{label}</div>,
        );
      };
      mk(1.4, '你  1.4', lutCss(0.95), 'mY');
      mk(0.00019, '太阳  0.0002', lutCss(0.42), 'mS');
      // bracket between the two
      const ya = lg(1.4);
      const yb = lg(0.00019);
      const br = ease.inOutCubic(seg(f, T.sunIn1 - 6, T.sunIn1 + 14)) * wkg;
      els.push(
        <div key="brk" style={{ position: 'absolute', left: 136, top: ya, width: 8, height: (yb - ya) * br, borderLeft: `1.5px solid ${VOICE}`, borderTop: `1.5px solid ${VOICE}`, borderBottom: br > 0.98 ? `1.5px solid ${VOICE}` : undefined, opacity: 0.6 * wkg }} />,
        <div key="brl" style={mono(22, { left: 156, top: (ya + yb) / 2 - 12, color: VOICE, opacity: 0.8 * br })}>×7000</div>,
      );
    }
  }

  // ---- spot meter on the forehead (dark-backed ring, label off to the right on a leader line) + ≈100 W readout
  const spotA = fade(f, T.scan1 + 4, T.sunIn0 + 4, 10, 10);
  if (spotA > 0.01 && project(cam, 0, 940, 0, p, 0)) {
    const R = 22;
    const ring = (w: number, col: string, k: string) => (
      <div key={k} style={{ position: 'absolute', left: p[0] - R - w / 2, top: p[1] - R - w / 2, width: 2 * R, height: 2 * R, border: `${w}px solid ${col}`, borderRadius: '50%', opacity: spotA }} />
    );
    const [lx, ly] = safeBox(Math.max(700, p[0] + 160), p[1] - 76, 170, 30);
    const ax = p[0] + R * 0.72;
    const ay = p[1] - R * 0.72;
    const bx = lx - 8;
    const by = ly + 15;
    const len = Math.hypot(bx - ax, by - ay);
    const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    els.push(
      ring(4.5, 'rgba(5,3,15,0.85)', 'spotd'),
      ring(1.5, 'rgba(243,239,230,0.95)', 'spot'),
      ...[0, 1, 2, 3].map((k) => {
        const a = (k * Math.PI) / 2;
        const horiz = k % 2 === 0;
        const cx = p[0] + Math.cos(a) * (R + 11);
        const cy = p[1] + Math.sin(a) * (R + 11);
        return <div key={'sx' + k} style={{ position: 'absolute', left: cx - (horiz ? 7 : 0.75), top: cy - (horiz ? 0.75 : 7), width: horiz ? 14 : 1.5, height: horiz ? 1.5 : 14, background: 'rgba(243,239,230,0.9)', boxShadow: '0 0 0 1.5px rgba(5,3,15,0.7)', opacity: spotA }} />;
      }),
      <div key="spline" style={{ position: 'absolute', left: ax, top: ay, width: len, height: 1.5, background: 'rgba(243,239,230,0.75)', transform: `rotate(${ang}deg)`, transformOrigin: '0 50%', opacity: spotA }} />,
      <div key="spl" style={mono(22, { left: lx, top: ly, color: VOICE, opacity: spotA, textShadow: '0 0 6px rgba(5,3,15,0.9)' })}>{'SP1  35.4°C'}</div>,
    );
  }
  const bulbA = fade(f, T.scan1 + 10, T.sunIn0 + 6, 12, 10);
  if (bulbA > 0.01) {
    const glow = 0.5 + 0.5 * Math.sin(f * 0.21);
    // lower-left, clear of the figure (its hand is at x ≈ 360, its legs at x ≥ 430)
    els.push(
      <div key="bulb" style={{ position: 'absolute', left: 96, top: 1112, opacity: bulbA }}>
        <Bulb x={0} y={0} s={1.0} glow={glow} />
        <div style={mono(52, { left: 78, top: 6, color: lutCss(0.97), letterSpacing: '0.02em', textShadow: '0 0 18px rgba(251,155,6,0.5)' })}>≈100 W</div>
        <div style={mono(19, { left: 2, top: 98, color: VOICE, opacity: 0.62, letterSpacing: '0.06em' })}>{'2000 kcal/天 ÷ 86400 s'}</div>
        <div style={mono(19, { left: 2, top: 126, color: VOICE, opacity: 0.62, letterSpacing: '0.06em' })}>{'≈ 97 W'}</div>
      </div>,
    );
  }

  // ---- W/kg beat: box tools + the monumental ×7000
  const boxA = fade(f, T.sunIn1 - 8, T.sunOut0 + 4, 10, 10);
  if (boxA > 0.01) {
    // BX1 on the chest
    if (project(cam, 0, 640, 0, p, 0)) {
      const s = 84 * p[2];
      els.push(
        <div key="bx1" style={{ position: 'absolute', left: p[0] - s / 2, top: p[1] - s / 2, width: s, height: s, border: '1.5px solid rgba(252,255,164,0.95)', opacity: boxA }} />,
        <div key="bx1k" style={{ position: 'absolute', left: p[0] + s / 2, top: p[1], width: 150 - s / 2, height: 1, background: 'rgba(252,255,164,0.7)', opacity: boxA }} />,
        <div key="bx1l" style={mono(21, { left: p[0] + 160, top: p[1] - 26, color: lutCss(0.97), opacity: boxA })}>{'BX1  你\n1.4 W/kg'}</div>,
      );
    }
    // BX2 on the Sun's disc (right), its label under the limb on a leader line
    const sy = sunY(f);
    const bxc = 880;
    const byc = sy + Math.sqrt(SUN_R * SUN_R - (bxc - 540) * (bxc - 540)) - 84;
    els.push(
      <div key="bx2" style={{ position: 'absolute', left: bxc - 34, top: byc - 34, width: 68, height: 68, border: '1.5px solid rgba(243,239,230,0.75)', opacity: boxA }} />,
      <div key="bx2k" style={{ position: 'absolute', left: bxc, top: byc + 34, width: 1, height: 64, background: 'rgba(243,239,230,0.6)', opacity: boxA }} />,
      <div key="bx2l" style={mono(21, { right: 140, top: byc + 104, color: VOICE, opacity: 0.85 * boxA, textAlign: 'right' })}>{'BX2  太阳\n0.0002 W/kg'}</div>,
    );
    // ×7000 count-up
    const cu = ease.outCubic(seg(f, T.sunIn1 - 2, T.sunIn1 + 22));
    const val = Math.round(Math.pow(10, Math.log10(7000) * cu));
    const monoA = boxA * smoothstep(T.sunIn1 - 4, T.sunIn1 + 4, f);
    els.push(
      <div key="big" style={{ position: 'absolute', left: 0, width: 1080, top: 226, textAlign: 'center', opacity: monoA }}>
        <span style={{ fontFamily: FONT.latin, fontWeight: 600, fontSize: 210, lineHeight: 1, letterSpacing: '0.01em', fontVariantNumeric: 'tabular-nums lining-nums', backgroundImage: 'linear-gradient(to top, #ED6925 10%, #FB9B06 40%, #F7D13D 70%, #FCFFA4 95%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 22px rgba(251,155,6,0.45)) drop-shadow(0 4px 20px rgba(0,0,0,0.8))' }}>
          ×{val}
        </span>
      </div>,
    );
  }

  // ---- beat 9: the ledger of entropy — the body's S stays flat, the universe's S keeps rising
  const gA = fade(f, T.gauge0, T.freeze0 + 4, 14, 10);
  if (gA > 0.01) {
    const rise = clamp((f - T.gauge0) / (T.freeze0 - T.gauge0));
    els.push(
      <SGauge
        key="sg"
        value={0}
        opacity={gA}
        ticks={[
          { value: 0.32 + 0.01 * Math.sin(f * 0.4), label: 'S身体', color: COLOR.orderGold },
          { value: 0.45 + 0.45 * ease.inOutSine(rise), label: 'S宇宙', color: '#FF6A4D' },
        ]}
      />,
    );
    // in / out labels on the streams
    const lA = gA * smoothstep(T.gauge0 + 10, T.gauge0 + 24, f);
    // on the intake thread where it crosses y ≈ 262 (the thread enters from above the frame)
    let ip: [number, number] | null = null;
    for (let k = 0; k <= 60; k++) {
      const [X, H] = intakeAt(k / 60);
      if (!project(cam, X, H, 0, p, 0)) continue;
      ip = [p[0], p[1]];
      if (p[1] >= 262) break;
    }
    if (ip) {
      const [x, y] = safeBox(ip[0] + 26, ip[1] - 14, 170, 32);
      els.push(<div key="in" style={sans(26, { left: x, top: y, color: COLOR.orderGold, opacity: lA })}>{'↙ 吃进低熵'}</div>);
    }
    if (project(cam, 250, 300, 0, p, 0)) {
      const [x, y] = safeBox(p[0], p[1], 170, 32);
      els.push(<div key="out" style={sans(26, { left: x, top: y, color: '#FF6A4D', opacity: lA })}>{'排出高熵 ↘'}</div>);
    }
  }

  // ---- the freeze: ❚❚ (time stopped) … ▶
  const clock = (fr: number) => 135.4 + fr / 30;
  const pA = fade(f, T.freeze0 + 2, T.restart + 2, 4, 4);
  if (pA > 0.01) {
    const blink = Math.floor((f - T.freeze0) / 15) % 2 === 0 ? 1 : 0.3;
    const s = clock(T.freeze1);
    const hh = '00';
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    const ff = String(Math.floor((s % 1) * 30)).padStart(2, '0');
    els.push(
      <div key="pause" style={{ position: 'absolute', left: 90, top: 250, opacity: pA * blink, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ width: 8, height: 26, background: VOICE }} />
          <div style={{ width: 8, height: 26, background: VOICE }} />
        </div>
        <div style={mono(28, { position: 'relative', color: VOICE })}>{`${hh}:${mm}:${ss}:${ff}`}</div>
      </div>,
    );
  }
  const playA = fade(f, T.restart, T.restart + 40, 2, 12);
  if (playA > 0.01) els.push(<div key="play" style={{ opacity: playA }}><Timecode mode="play" seconds={clock(T.freeze1) + (f - T.restart) / 30} /></div>);

  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{els}</div>;
};

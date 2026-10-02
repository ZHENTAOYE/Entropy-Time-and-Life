// S07 HUD (DOM): tracer timer, census of the water, day counter of the body's atoms, stream labels.
// Thermal-phase chrome lives in HudThermal.tsx.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { FONT, useFontsReady } from '../../lib/fonts';
import { clamp, ease, seg } from '../../lib/math';
import { dayAt, flowTime, intakeAt, originalFraction } from './flow';
import { Cam, camAt, project } from './camera';
import { T } from './timing';
import { tracerScreen, zeroFlash } from './vortexDraw';
import { censusFraction, TRACER, V } from './vortex';

const VOICE = '#F3EFE6';
const GOLD = '#FFC94A';
const CYAN = '#BDF4FF';
const RED = '#FF6A4D';

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
  letterSpacing: '0.15em',
  whiteSpace: 'pre',
  ...extra,
});
const fade = (f: number, a: number, b: number, len = 8) => Math.min(seg(f, a, a + len), 1 - seg(f, b - len, b));

/** keep a label of width w (px) inside the safe zone: x ∈ [90, 990], y ∈ [236, 1640]; x ≤ 940 beside the platform
 *  buttons (y 900–1500) */
export function safeBox(x: number, y: number, w: number, h: number): [number, number] {
  const xMax = (y + h > 900 && y < 1500 ? 940 : 990) - w;
  return [Math.min(Math.max(90, x), xMax), Math.min(Math.max(236, y), 1640 - h)];
}

/** screen point of the intake thread where it crosses screen height ySafe (the thread enters from above the frame) */
function intakeLabelPoint(cam: Cam, ySafe: number): [number, number] | null {
  const p = new Float32Array(3);
  let best: [number, number] | null = null;
  for (let k = 0; k <= 60; k++) {
    const [X, H] = intakeAt(k / 60);
    if (!project(cam, X, H, 0, p, 0)) continue;
    if (p[1] >= ySafe) return best ?? [p[0], p[1]];
    best = [p[0], p[1]];
  }
  return best;
}

export const Hud: React.FC = () => {
  const f = useCurrentFrame();
  useFontsReady([
    [`400 22px ${FONT.mono}`, '停留离开0123456789.%s·→↗▍ ×WHATISLFE'],
    [`400 26px ${FONT.sans}`, '原来的水形状不变第天原有原子食物水O₂热CO₂H₂O半衰期约体内的≈60%7–14·骨骼脂肪晶状体：更新慢0123456789'],
  ]);
  const cam = camAt(f);
  const els: React.ReactNode[] = [];

  // ---- tracer residence timer (rides beside the gold particle)
  const ts = tracerScreen(f, cam);
  const tAfter = f - T.tracerBirth - TRACER.L;
  if (ts || (tAfter >= 0 && tAfter < 26)) {
    const resid = ts ? ts[2] / 30 : TRACER.L / 30;
    const a = ts ? clamp((f - T.tracerBirth) / 6) : 1 - seg(tAfter, 10, 26);
    let x: number;
    let y: number;
    if (ts) {
      x = ts[0] + 22;
      y = ts[1] - 40;
      // flip to the left of the particle near the right edge
      if (x > 990 - 190) x = ts[0] - 22 - 190;
    } else {
      const p = new Float32Array(3);
      project(cam, 0, 0, 0, p, 0);
      x = p[0] + 30;
      y = p[1] - 70;
    }
    [x, y] = safeBox(x, y, 190, 28);
    els.push(
      <div key="tr" style={mono(22, { left: x, top: y, color: GOLD, opacity: 0.9 * a })}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: GOLD, marginRight: 10, boxShadow: `0 0 8px ${GOLD}` }} />
        {`停留 ${resid.toFixed(1)} s${ts ? '' : ' · 离开'}`}
      </div>,
    );
  }

  // ---- census of the water (top-left HUD lane)
  const cA = fade(f, T.tag + 2, T.censusOut, 10);
  if (cA > 0.01) {
    const frac = f < T.tag ? 1 : censusFraction(f);
    const pct = Math.round(frac * 100);
    const [zf, zh] = zeroFlash(f);
    els.push(
      <div key="cen" style={{ position: 'absolute', left: 90, top: 240, opacity: cA }}>
        <div style={sans(26, { position: 'relative', color: VOICE, opacity: 0.72 })}>原来的水</div>
        <div style={mono(64, { position: 'relative', color: '#F6FEFF', marginTop: 4, letterSpacing: '0.04em', textShadow: `0 0 ${18 + 26 * zf}px rgba(200,250,255,${0.45 + 0.5 * zf})` })}>
          {String(pct).padStart(3, ' ')}
          <span style={{ fontSize: 30, opacity: 0.7 }}>%</span>
        </div>
        <div style={{ position: 'relative', width: 300, height: 3, marginTop: 8, background: `rgba(243,239,230,${0.16 + 0.2 * zh})` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: 300 * frac, background: '#F6FEFF', boxShadow: '0 0 8px #BDF4FF' }} />
        </div>
      </div>,
    );
    // the shape label at the top of the dashed outline (brightens when the last original drop has gone)
    const p = new Float32Array(3);
    project(cam, 0, 0, 0, p, 0);
    const sh = ease.inOutSine(seg(f, T.tag + 16, T.tag + 32)) * cA;
    const top = p[1] - (V.R0 + 18) * p[2] * Math.max(0.05, cam.sp) - 44;
    els.push(
      <div key="shape" style={mono(22, { left: 0, width: 1080, top, textAlign: 'center', color: VOICE, opacity: Math.min(1, (0.75 + 0.25 * zh) * sh), letterSpacing: '0.3em', textShadow: zf > 0.01 ? `0 0 ${Math.round(16 * zf)}px rgba(243,239,230,${0.8 * zf})` : undefined })}>
        {'形状 · 不变'}
      </div>,
    );
  }

  // ---- day counter + original atoms (time-lapse)
  const dA = fade(f, T.days0 - 6, T.scan0 + 2, 10);
  if (dA > 0.01) {
    const day = dayAt(f);
    const frac = originalFraction(flowTime(f));
    els.push(
      <div key="days" style={{ position: 'absolute', left: 90, top: 240, opacity: dA }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={sans(30, { position: 'relative', color: VOICE, opacity: 0.75 })}>第</span>
          <span style={mono(64, { position: 'relative', color: GOLD, letterSpacing: '0.04em', textShadow: '0 0 16px rgba(255,201,74,0.4)' })}>{String(day).padStart(2, '0')}</span>
          <span style={sans(30, { position: 'relative', color: VOICE, opacity: 0.75 })}>天</span>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <span style={sans(22, { position: 'relative', color: CYAN, opacity: 0.85 })}>原有原子</span>
          <div style={{ position: 'relative', width: 200, height: 3, background: 'rgba(189,244,255,0.16)' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: 3, width: 200 * frac, background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />
          </div>
          <span style={mono(24, { position: 'relative', color: CYAN, letterSpacing: '0.04em' })}>{`${String(Math.round(frac * 100)).padStart(3, ' ')}%`}</span>
        </div>
        <div style={sans(18, { position: 'relative', color: VOICE, opacity: 0.5, marginTop: 10, letterSpacing: '0.1em' })}>{'体内的水 ≈ 原子的60% · 半衰期 7–14 天'}</div>
        <div style={sans(18, { position: 'relative', color: VOICE, opacity: 0.5, marginTop: 4, letterSpacing: '0.1em' })}>{'骨骼、脂肪、晶状体：更新慢'}</div>
      </div>,
    );
  }

  // ---- stream labels (in: food / water, O₂ — out: heat, CO₂, H₂O), kept inside the safe zone
  const sA = fade(f, T.days0 + 14, T.scan0 + 4, 12);
  if (sA > 0.01) {
    const ip = intakeLabelPoint(cam, 262);
    if (ip) {
      const [x, y] = safeBox(ip[0] + 26, ip[1] - 14, 250, 32);
      els.push(
        <div key="in" style={sans(26, { left: x, top: y, color: GOLD, opacity: 0.85 * sA })}>
          {'↙ 食物 · 水 · O₂'}
        </div>,
      );
    }
    const p = new Float32Array(3);
    project(cam, 150, 330, 0, p, 0);
    const [x, y] = safeBox(p[0] + 40, p[1], 250, 30);
    els.push(
      <div key="out" style={sans(24, { left: x, top: y, color: RED, opacity: 0.85 * sA })}>
        {'↗ 热 · CO₂ · H₂O'}
      </div>,
    );
  }

  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{els}</div>;
};

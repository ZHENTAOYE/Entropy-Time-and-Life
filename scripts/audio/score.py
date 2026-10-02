"""Procedural score & sound design for 熵、时间与生命.

    python3 scripts/audio/score.py            -> public/audio/score.wav (+ score.mp3)

Inputs:
  out/timeline.json            (node scripts/export-timeline.mjs) scene starts / durations
  scripts/audio/cues/Sxx.json  frame-accurate sound cues reported by each scene (scene-local frames)

Design (mirrors the film's physics):
  * pure tones (low entropy) decay into noise (high entropy) at the heat death; after it, tones crystallise again;
  * time manipulation = reversed audio, tape effects, Shepard tones (rising = forward/zoom out, falling = rewind);
  * D minor for the physics, turning to D major when life appears (S06+), resolving in the finale;
  * S06 sonifies the photon ledger: one high sine splits into 20 sines at 1/20 the frequency.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from synth import *  # noqa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FPS = 30


def load_timeline():
    with open(os.path.join(ROOT, 'out', 'timeline.json')) as f:
        return json.load(f)


def load_cues(sid):
    p = os.path.join(os.path.dirname(__file__), 'cues', f'{sid}.json')
    if not os.path.exists(p):
        return []
    with open(p) as f:
        return json.load(f)


N = note_hz
D_MIN = [N('D2'), N('A2'), N('D3'), N('F3'), N('A3'), N('E4')]
D_MAJ = [N('D2'), N('A2'), N('D3'), N('F#3'), N('A3'), N('E4')]
BB_MAJ7 = [N('Bb1'), N('F2'), N('D3'), N('A3'), N('C4')]
G_MIN = [N('G1'), N('D2'), N('Bb2'), N('D3'), N('F3'), N('A3')]


def env_curve(n, points):
    """piecewise-linear envelope from [(t_sec, value), ...]."""
    t = np.arange(n) / SR
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return np.interp(t, xs, ys)


def apply_env(x, points):
    e = env_curve(x.shape[-1], points)
    return x * e


def drone(freq, dur, seed=0, amp=0.15, bright=0.3):
    return pad([freq, freq * 1.5, freq * 2], dur, seed=seed, bright=bright, amp=amp, voices=3, detune=0.12, lfo=0.05)


def reversed_buf(x):
    return x[..., ::-1].copy()


def hiss(dur, seed=0, amp=0.02):
    return stereo(highpass(noise(dur, seed), 3000) * amp)


# ============================================================ scene beds (scene-local seconds)

def bed_S01(dur):
    out = silence(dur)
    # --- forward "event" we will reverse: a plop with a long airy reverb bloom
    fw_len = 3.4
    fw = silence(fw_len)
    place(fw, water_drop(seed=3, f0=700, f1=1900, dur=0.5) * 0.7, 0.05)
    place(fw, impact(1.6, f0=120, f1=40, seed=5, noise_amt=0.25) * 0.35, 0.05)
    bloom = pad([N('D3'), N('A3'), N('E4'), N('F4')], fw_len, seed=11, bright=0.45, amp=0.22)
    bloom = apply_env(bloom, [(0, 0), (0.2, 1), (fw_len, 0.15)])
    fw = fw + bloom
    fw = reverb(fw, wet=0.55, seconds=3.0, seed=4)
    rev = reversed_buf(fw)  # swells INTO the reversed plop at its end
    # warble (tape) via varispeed wobble
    n = rev.shape[1]
    wob = 1 + 0.012 * np.sin(2 * np.pi * 5.3 * np.arange(n) / SR) + 0.006 * np.sin(2 * np.pi * 0.7 * np.arange(n) / SR)
    rev = varispeed(rev, wob)
    # place so the reversed plop (end of rev) lands at 2.4 s
    place(out, rev, 2.4 - fw_len + 0.05, gain=0.9)
    place(out, hiss(3.0, 7, 0.018), 0.0)
    # tape-stop clunk at 3.0
    clunk = tape_stop(stereo(pad([N('D3'), N('A3')], 0.6, seed=2, amp=0.25)), 0.5)
    place(out, clunk, 2.55, gain=0.6)
    place(out, stereo(impact(0.25, f0=300, f1=80, seed=8, noise_amt=0.8) * 0.4), 3.0)
    # falling drop: a tiny descending whistle
    place(out, stereo(glide_sine(2400, 1400, 1.0) * np.linspace(0, 0.06, int(SR * 1.0))), 3.2)
    # impact at 4.2
    hit = silence(6.0)
    place(hit, water_drop(seed=21, f0=850, f1=2300, dur=0.45) * 0.9, 0.0)
    place(hit, impact(3.0, f0=95, f1=36, seed=22, noise_amt=0.2) * 0.45, 0.0)
    hit = reverb(hit, wet=0.45, seconds=4.0, seed=6)
    place(out, hit, 4.2)
    # bloom bed 4.2 -> 11.0 (rising, opening filter)
    bl = pad([N('D2'), N('A2'), N('D3'), N('F3'), N('A3'), N('E4'), N('A4')], 7.2, seed=31, bright=0.5, amp=0.26, voices=4)
    bl = apply_env(bl, [(0, 0), (1.5, 0.55), (5.0, 0.9), (6.75, 1.0), (6.8, 0.0)])
    place(out, reverb(bl, 0.35, 4.0, seed=9), 4.2)
    # micro bubbles
    r = rng(41)
    for i in range(26):
        tt = 4.4 + r.uniform(0, 6.4)
        place(out, water_drop(seed=100 + i, f0=r.uniform(1800, 3200), f1=r.uniform(3500, 5200), dur=0.12) * r.uniform(0.03, 0.08), tt, pan=r.uniform(-0.8, 0.8))
    # hard cut 11.0 -> room tone
    out[:, int(11.0 * SR):] = 0
    place(out, stereo(lowpass(noise(2.0, 51, 'pink'), 1200) * 0.004), 11.0)
    # 「为什么？」 a single distant low bell
    place(out, reverb(stereo(bell(N('A2'), 2.0, seed=61, decay=1.2) * 0.18), 0.6, 4.0, seed=12), 11.15)
    return out


def bed_S02(dur):
    out = silence(dur)
    # clinical bed: a cold sine pad (ticks, collisions and the countdown come from the scene's cues)
    cold = pad([N('D3'), N('A3'), N('D4')], dur, seed=71, bright=0.15, amp=0.1, voices=2)
    cold = apply_env(cold, [(0, 0), (1, 0.8), (8.6, 0.8), (13.0, 1.0), (14.6, 0.6), (dur, 0.0)])
    place(out, cold, 0)
    # 「分不出来」 soft two-note shrug
    place(out, reverb(stereo(bell(N('D5'), 1.2, seed=3) * 0.08 + bell(N('C5'), 1.2, seed=4) * 0.06), 0.5, 3.0), 4.45)
    # escalation riser 8.6 -> 13.0
    rs = whoosh(4.4, 200, 6000, seed=81, q=2.5, shape='rise') * 0.18
    place(out, stereo(rs), 8.6)
    sh = shepard(4.4, rate_oct_per_s=0.25, base=110, seed=1) * 0.12
    place(out, stereo(sh * np.linspace(0, 1, len(sh))), 8.6)
    # 「方向，出现了。」 resolving hit at 13.0
    place(out, stereo(impact(3.0, f0=110, f1=40, seed=91) * 0.5), 13.0)
    chord = pad([N('Bb2'), N('F3'), N('D4'), N('A4')], 4.4, seed=92, bright=0.4, amp=0.3)
    place(out, reverb(apply_env(chord, [(0, 0), (0.05, 1), (4.4, 0)]), 0.5, 4.0), 13.0)
    return out


def bed_S03(dur):
    out = silence(dur)
    pent = [N('D4'), N('E4'), N('F4'), N('A4'), N('C5'), N('D5'), N('E5'), N('F5'), N('A5'), N('C6')]
    # 16 arrangements (2.2 -> 4.4): rapid plucks
    for i in range(16):
        place(out, karplus(pent[i % len(pent)], 0.8, seed=200 + i, damp=0.994) * 0.12, 2.2 + i * 0.12, pan=(i / 15) * 1.6 - 0.8)
    # columns 1·4·6·4·1 -> stacked notes
    col_notes = [N('D3'), N('A3'), N('D4'), N('A3'), N('D3')]
    for j, c in enumerate([1, 4, 6, 4, 1]):
        for q in range(c):
            place(out, karplus(col_notes[j] * (1.5 ** (q % 3)), 1.2, seed=300 + j * 10 + q, damp=0.995) * 0.07, 4.4 + j * 0.25 + q * 0.04, pan=-0.8 + j * 0.4)
    # Galton rain 7.4 -> 9.4 (granular ticks thickening), needle = sustained high sine
    r = rng(5)
    for i in range(240):
        tt = 7.4 + (i / 240) ** 0.7 * 2.0
        place(out, tick(seed=400 + i, f=r.uniform(2000, 5000)) * 0.03, tt, pan=r.uniform(-1, 1))
    nd = stereo(sine(N('A6'), 3.0) * 0.025)
    place(out, apply_env(nd, [(0, 0), (0.5, 1), (2.5, 1), (3.0, 0)]), 8.4)
    # 10^-30 (9.4): deep digital hit
    place(out, stereo(impact(2.5, f0=70, f1=30, seed=500) * 0.55), 9.4)
    place(out, reverb(stereo(bell(N('D2'), 3.0, seed=501) * 0.15), 0.4), 9.4)
    # cool pad under 9.4 -> 18.4
    p1 = pad(D_MIN, 9.0, seed=510, bright=0.3, amp=0.16)
    place(out, apply_env(p1, [(0, 0), (1, 1), (8, 1), (9, 0)]), 9.4)
    # zeros ticking from 16.2, accelerating into the Shepard zoom 18.4 -> 22
    t = 16.2
    k = 0
    while t < 22.0:
        gap = max(0.012, 0.16 * (1 - (t - 16.2) / 5.8) ** 2)
        place(out, tick(seed=600 + k, f=3000) * 0.035, t, pan=0.0)
        t += gap
        k += 1
    sh = shepard(4.2, rate_oct_per_s=0.45, base=55, octaves=8, seed=2)
    sh = stereo(sh * np.linspace(0.2, 1, len(sh)) * 0.22)
    place(out, sh, 18.0)
    place(out, stereo(whoosh(3.0, 300, 8000, seed=610, q=2.0, shape='rise') * 0.1), 19.2)
    # galaxy bloom 22.0
    gal = pad([N('D2'), N('A2'), N('E3'), N('F#3'), N('A3'), N('C#4'), N('E4')], 6.0, seed=620, bright=0.5, amp=0.3, voices=4)
    place(out, reverb(apply_env(gal, [(0, 0), (0.08, 1), (2.6, 0.7), (6.0, 0)]), 0.55, 5.0, seed=14), 22.0)
    place(out, stereo(impact(3.5, f0=80, f1=30, seed=621, noise_amt=0.1) * 0.4), 22.0)
    # golden line 24.6 -> 27.8: bell phrase (不是不可能——只是太不可能)
    for i, (nn, tt) in enumerate([(N('A4'), 24.7), (N('F4'), 25.3), (N('E4'), 25.9), (N('D4'), 26.6)]):
        place(out, reverb(stereo(bell(nn, 2.5, seed=700 + i, decay=1.6) * 0.09), 0.5, 4.0), tt)
    # 熵 reveal 27.8 : deep gong
    place(out, reverb(stereo(bell(N('D2'), 5.0, seed=800, inharm=(1, 2.01, 2.76, 4.1, 5.4), decay=3.0) * 0.4), 0.45, 5.0, seed=15), 27.8)
    place(out, stereo(impact(2.0, f0=60, f1=28, seed=801) * 0.4), 27.8)
    # stone formula 29.4 : resonant stone knock
    st = resonator(noise(0.6, 810) * np.exp(-np.arange(int(0.6 * SR)) / (0.04 * SR)), 180, 8) * 0.6
    place(out, reverb(stereo(st), 0.5, 3.0), 29.4)
    # definition card 31.8 -> end: warm pad, and the line hum
    defp = pad([N('D3'), N('F3'), N('A3'), N('C4'), N('E4')], 4.8, seed=820, bright=0.35, amp=0.2)
    place(out, apply_env(defp, [(0, 0), (0.8, 1), (4.0, 0.8), (4.6, 0.4)]), 31.8)
    hum = stereo((sine(N('A3'), 1.8) + 0.3 * sine(N('A4'), 1.8)) * 0.05)
    place(out, apply_env(hum, [(0, 0), (1.0, 1), (1.8, 1)]), dur - 1.8)
    return out


def bed_S04(dur):
    out = silence(dur)
    # line hum continues -> arrow
    hum = stereo((sine(N('A3'), 3.0) + 0.3 * sine(N('A4'), 3.0)) * 0.05)
    place(out, apply_env(hum, [(0, 1), (3.0, 0)]), 0)
    place(out, stereo(whoosh(1.3, 150, 3000, seed=900, shape='rise') * 0.15), 0.0)
    ar = pad([N('D2'), N('A2'), N('D3'), N('A3'), N('D4')], 5.4, seed=901, bright=0.45, amp=0.28)
    place(out, apply_env(ar, [(0, 0), (1.2, 1), (5.0, 0.6), (5.4, 0)]), 0.0)
    # 往回追 3.0: reversed swell
    sw = reversed_buf(reverb(stereo(bell(N('D4'), 2.0, seed=902) * 0.2), 0.7, 2.5))
    place(out, sw, 5.4 - sw.shape[1] / SR)
    # cosmic rewind 5.4 -> 10.0: falling Shepard + reversed whooshes + accelerating ticks
    fs = shepard(4.6, rate_oct_per_s=0.6, base=55, octaves=8, seed=3, up=False)
    place(out, stereo(fs * 0.24), 5.4)
    for i in range(6):
        w = reversed_buf(stereo(whoosh(1.2, 4000, 200, seed=910 + i, q=3, shape='fall') * 0.12))
        place(out, w, 5.4 + i * 0.75, pan=None)
    t = 5.4
    k = 0
    while t < 10.0:
        place(out, tick(seed=950 + k, f=1800) * 0.04, t)
        t += max(0.02, 0.25 * (1 - (t - 5.4) / 4.6) ** 1.5)
        k += 1
    # plasma 10.0 -> 12.8: hot uniform shimmer
    pl = stereo(bandpass(noise(3.0, 960, 'pink'), 800, 9000) * 0.06)
    pl = pl + pad([N('D4'), N('E4'), N('A4'), N('B4'), N('E5')], 3.0, seed=961, bright=0.6, amp=0.12)
    place(out, apply_env(pl, [(0, 0), (0.4, 1), (2.6, 1), (3.0, 0.3)]), 10.0)
    # Penrose tower 12.8 -> 16.8: three ascending monumental hits then silence
    for i, (tt, f0) in enumerate([(12.9, 70), (13.8, 90), (14.7, 120)]):
        place(out, stereo(impact(2.5, f0=f0, f1=f0 * 0.45, seed=970 + i, noise_amt=0.3) * 0.55), tt)
        place(out, reverb(stereo(bell(N('D2') * (1.5 ** i), 3.0, seed=975 + i, decay=2.0) * 0.18), 0.5, 5.0), tt)
    # 散尽的墨 16.8 -> 20.4: uneasy water textures
    wt = stereo(lowpass(noise(3.6, 980, 'pink'), 900) * 0.03)
    un = pad([N('D3'), N('Eb3'), N('A3'), N('Bb3')], 3.6, seed=981, bright=0.25, amp=0.12)
    place(out, apply_env(wt + un, [(0, 0), (0.6, 1), (3.0, 1), (3.6, 0.5)]), 16.8)
    # gravity 20.4 -> 24.4: deep rumble + rising cluster
    rum = stereo(lowpass(noise(4.0, 990, 'brown'), 120) * 0.25)
    cl = pad([N('D2'), N('Eb2'), N('A2'), N('Bb2'), N('D3')], 4.0, seed=991, bright=0.3, amp=0.18)
    place(out, apply_env(rum + cl, [(0, 0), (3.8, 1), (4.0, 0.6)]), 20.4)
    place(out, stereo(whoosh(3.6, 80, 2500, seed=992, shape='rise') * 0.2), 20.6)
    # collapse / ignition 24.4: huge resolving chord + sparkling bells
    place(out, stereo(impact(4.0, f0=90, f1=30, seed=1000) * 0.6), 24.4)
    big = pad([N('Bb1'), N('F2'), N('D3'), N('F3'), N('A3'), N('C4'), N('E4')], 7.4, seed=1001, bright=0.55, amp=0.32, voices=4)
    place(out, reverb(apply_env(big, [(0, 0), (0.1, 1), (4.0, 0.8), (7.4, 0)]), 0.5, 5.0, seed=16), 24.4)
    r = rng(1002)
    for i in range(40):
        tt = 24.4 + r.uniform(0, 2.5)
        place(out, bell(r.choice([N('D6'), N('E6'), N('A6'), N('F6'), N('C7')]), 1.0, seed=1010 + i, decay=0.5) * r.uniform(0.02, 0.05), tt, pan=r.uniform(-0.9, 0.9))
    # 之后: long sustain fading
    sus = pad([N('D3'), N('A3'), N('E4')], 4.4, seed=1050, bright=0.3, amp=0.12)
    place(out, apply_env(sus, [(0, 0), (1, 1), (4.4, 0.3)]), dur - 4.4)
    return out


def bed_S05(dur):
    out = silence(dur)
    # fast-forward 0 -> 1.8
    sh = shepard(1.8, rate_oct_per_s=2.0, base=110, seed=4)
    place(out, stereo(sh * 0.18), 0)
    for i in range(10):
        place(out, stereo(glide_sine(800, 3000, 0.08) * 0.03), i * 0.17)
    # dying drone 0 -> 11.6: harmonics fall away (lowpass closing), then noise takes over
    dr = pad(D_MIN, 11.6, seed=1100, bright=0.4, amp=0.2, voices=3)
    n = dr.shape[1]
    fc = np.geomspace(6000, 120, n)
    # block-wise closing lowpass
    blk = 4096
    for s in range(0, n, blk):
        e = min(n, s + blk)
        dr[:, s:e] = lowpass(dr[:, s:e], fc[s])
    dr = apply_env(dr, [(0, 1), (6.2, 0.7), (11.6, 0.0)])
    place(out, dr, 0)
    # stars wink out 1.8 -> 4.2: blips with falling pitch
    r = rng(1110)
    for i in range(18):
        tt = 1.8 + r.uniform(0, 2.6)
        f0 = r.uniform(900, 2000)
        b = glide_sine(f0, f0 * 0.5, 0.35) * env_exp(int(0.35 * SR), 0.08) * r.uniform(0.02, 0.05)
        place(out, b, tt, pan=r.uniform(-0.8, 0.8))
    # black holes evaporate 4.2 -> 6.2: faint crackles
    for i in range(10):
        tt = 4.2 + r.uniform(0, 2.0)
        c = highpass(noise(0.05, 1200 + i), 4000) * np.exp(-np.arange(int(0.05 * SR)) / (0.006 * SR)) * 0.08
        place(out, c, tt, pan=r.uniform(-0.6, 0.6))
    # pink -> white noise 6.2 -> 13.8, flattening and falling
    nz_len = 7.6
    pk = noise(nz_len, 1300, 'pink')
    wh = noise(nz_len, 1301, 'white') * 0.35
    w = np.linspace(0, 1, int(nz_len * SR))
    nz = stereo(pk * (1 - w) * 0.05 + wh * w * 0.05)
    nz = apply_env(nz, [(0, 0), (1.0, 1.0), (5.4, 0.7), (7.4, 0.1), (7.6, 0.0)])
    place(out, nz, 6.2)
    # 13.8 -> 15.2 : silence. 15.2 -> end: the gold point = a single pure tone appearing out of silence
    gp_len = dur - 15.2
    tone = sine(N('A5'), gp_len) * 0.06
    trem = 1 + 0.25 * np.sin(2 * np.pi * 6.0 * np.arange(len(tone)) / SR) * np.linspace(1, 0.2, len(tone))
    tone = tone * trem
    place(out, reverb(apply_env(stereo(tone), [(0, 0), (0.6, 1), (gp_len, 1)]), 0.4, 3.0), 15.2)
    return out


def bed_S06(dur):
    out = silence(dur)
    # the gold point swells into the Sun: tone grows into D major (life's key)
    sun = pad([N('D3'), N('F#3'), N('A3'), N('D4'), N('A4')], dur, seed=1400, bright=0.45, amp=0.2, voices=3)
    sun = apply_env(sun, [(0, 0.1), (1.5, 0.8), (4.4, 0.6), (10.2, 0.7), (13.4, 0.8), (dur, 0.9)])
    place(out, sun, 0)
    tone = stereo(sine(N('A5'), 1.6) * 0.06)
    place(out, apply_env(tone, [(0, 1), (1.6, 0)]), 0)
    # photon ledger: the incoming high sine and the 20 outgoing tones are cue-driven (high-sine / split-tone)
    # ledger ticks
    for i, tt in enumerate([0.9, 1.4, 3.3, 3.6, 7.5, 7.8, 8.1]):
        place(out, tick(seed=1600 + i, f=4200) * 0.05, tt)
    # 20倍 hit 7.4
    place(out, stereo(impact(2.0, f0=85, f1=40, seed=1700) * 0.4), 7.4)
    # 散开 10.2 -> 13.4: shimmering dispersion
    r = rng(1800)
    for i in range(60):
        tt = 10.2 + r.uniform(0, 3.0)
        place(out, bell(r.choice([N('D6'), N('F#6'), N('A6'), N('E6')]), 0.7, seed=1810 + i, decay=0.3) * r.uniform(0.01, 0.03), tt, pan=r.uniform(-1, 1))
    # branching flows 13.4 -> end: accelerating arpeggio in D major pentatonic
    arp = [N('D4'), N('E4'), N('F#4'), N('A4'), N('B4'), N('D5'), N('E5'), N('F#5'), N('A5')]
    t = 13.4
    k = 0
    while t < dur - 0.2:
        place(out, karplus(arp[k % len(arp)], 1.0, seed=1900 + k, damp=0.995, bright=0.6) * 0.06, t, pan=np.sin(k * 0.7) * 0.7)
        t += max(0.08, 0.32 - (t - 13.4) * 0.05)
        k += 1
    sw = stereo(whoosh(2.4, 200, 3000, seed=1950, shape='rise') * 0.1)
    place(out, sw, dur - 2.4)
    return out


def bed_S07(dur):
    out = silence(dur)
    # warm life pad (D major 9), drops out at 25.0
    lp = pad([N('D2'), N('A2'), N('D3'), N('F#3'), N('A3'), N('E4')], 25.2, seed=2000, bright=0.4, amp=0.2, voices=3)
    lp = apply_env(lp, [(0, 0.6), (5, 0.7), (10.2, 0.9), (19.0, 0.8), (21.8, 1.0), (24.9, 1.0), (25.1, 0.0)])
    place(out, lp, 0)
    # vortex swirl: band noise with circular panning 5 -> 12
    sw_len = 8.0
    nz = bandpass(noise(sw_len, 2010, 'pink'), 300, 2500) * 0.05
    tt = np.arange(len(nz)) / SR
    pan = np.sin(2 * np.pi * 0.35 * tt)
    a = (pan + 1) * np.pi / 4
    swirl = np.stack([nz * np.cos(a), nz * np.sin(a)])
    place(out, apply_env(swirl, [(0, 0), (1.5, 1), (6.5, 1), (8, 0)]), 4.5)
    # Schrödinger bell
    place(out, reverb(stereo(bell(N('F#4'), 3.0, seed=2020) * 0.08), 0.5, 4.0), 0.2)
    # 你也是 10.2 chord swell
    sw = pad([N('D3'), N('F#3'), N('A3'), N('C#4'), N('E4')], 3.0, seed=2030, bright=0.5, amp=0.22)
    place(out, reverb(apply_env(sw, [(0, 0), (0.15, 1), (3.0, 0)]), 0.5, 4.0), 10.2)
    # atoms streaming 11.8 -> 15.4 : sparkles
    r = rng(2040)
    for i in range(70):
        place(out, bell(r.choice([N('A5'), N('D6'), N('E6'), N('F#6')]), 0.4, seed=2050 + i, decay=0.15) * r.uniform(0.008, 0.02), 11.8 + r.uniform(0, 3.6), pan=r.uniform(-1, 1))
    # thermal switch 15.4: click + warm hum (100 W)
    place(out, stereo(impact(0.2, f0=500, f1=200, seed=2060, noise_amt=1.0) * 0.2), 15.4)
    hum = stereo((sine(100, 6.4) * 0.5 + sine(200, 6.4) * 0.2 + sine(300, 6.4) * 0.08) * 0.05)
    place(out, apply_env(hum, [(0, 0), (0.5, 1), (6.0, 1), (6.4, 0)]), 15.4)
    # 7000倍 19.0 punch
    place(out, stereo(impact(2.0, f0=120, f1=45, seed=2070) * 0.45), 19.0)
    # 借着它，活着 21.8 swell
    place(out, stereo(whoosh(2.0, 200, 4000, seed=2080, shape='rise') * 0.08), 19.9)
    # 你是一个过程 26.8 -> end: single sustained tone + breath
    tone = stereo(sine(N('D5'), dur - 26.8) * 0.05)
    place(out, reverb(apply_env(tone, [(0, 0), (0.4, 1), (dur - 26.8, 0.7)]), 0.4, 4.0), 26.8)
    # heartbeat and breaths are cue-driven (scene BEAT_FRAMES / EXHALE_FRAMES)
    return out


def bed_S08(dur):
    out = silence(dur)
    # intimate music-box line (bells) over a soft pad
    pd = pad([N('D3'), N('A3'), N('F#4'), N('B4')], dur, seed=2200, bright=0.3, amp=0.12, voices=2)
    place(out, apply_env(pd, [(0, 0.5), (2, 1), (dur - 3, 1), (dur, 0.6)]), 0)
    mel = [(0.6, 'F#5'), (1.4, 'A5'), (2.2, 'B5'), (3.4, 'A5'), (6.3, 'D6'), (7.2, 'B5'), (8.5, 'A5'), (9.6, 'F#5'), (11.5, 'E5'), (12.4, 'F#5'), (13.9, 'D5')]
    for i, (tt, nn) in enumerate(mel):
        place(out, reverb(stereo(bell(N(nn), 2.0, seed=2210 + i, decay=1.0) * 0.07), 0.4, 3.0), tt)
    # wind
    wd = bandpass(noise(dur, 2230, 'pink'), 300, 1800) * 0.025
    wd = wd * (0.6 + 0.4 * np.sin(2 * np.pi * 0.15 * np.arange(len(wd)) / SR))
    place(out, stereo(wd), 0)
    # neural crackle 11.4 -> 14
    r = rng(2240)
    for i in range(50):
        c = highpass(noise(0.02, 2250 + i), 3000) * np.exp(-np.arange(int(0.02 * SR)) / (0.003 * SR)) * r.uniform(0.02, 0.06)
        place(out, c, 11.4 + (i / 50) ** 1.5 * 2.6, pan=r.uniform(-0.7, 0.7))
    # echo of the last phrase (回声)
    ech = silence(5.0)
    place(ech, stereo(bell(N('D5'), 1.5, seed=2260) * 0.08), 0)
    place(ech, stereo(bell(N('A4'), 1.5, seed=2261) * 0.06), 0.45)
    ech = delay(ech, time=0.42, fb=0.55, mix=0.6, taps=8)
    place(out, reverb(ech, 0.5, 5.0), 15.6)
    return out


def bed_S09(dur):
    out = silence(dur)
    # pull back 0 -> 7: rising Shepard + growing pad
    sh = shepard(7.0, rate_oct_per_s=0.35, base=55, octaves=8, seed=5)
    place(out, stereo(sh * np.linspace(0.1, 1, len(sh)) * 0.18), 0)
    gp = pad([N('D2'), N('A2'), N('D3'), N('F#3'), N('A3'), N('E4')], 7.0, seed=2400, bright=0.45, amp=0.22, voices=3)
    place(out, apply_env(gp, [(0, 0.2), (6.9, 1), (7.0, 0)]), 0)
    # three hits 7.0 / 8.0 / 9.0 then silence
    for i, tt in enumerate([7.0, 8.0, 9.0]):
        place(out, stereo(impact(1.2 if i < 2 else 2.0, f0=110 - i * 15, f1=40, seed=2410 + i) * (0.5 + 0.1 * i)), tt)
        place(out, reverb(stereo(bell([N('A3'), N('D4'), N('F#4')][i], 1.5, seed=2415 + i) * 0.15), 0.5, 3.0), tt)
    # 时间是什么？ 10.6 -> 14.2: high held pad
    hp = pad([N('A4'), N('D5'), N('E5')], 4.0, seed=2420, bright=0.2, amp=0.1, voices=2)
    place(out, apply_env(hp, [(0, 0), (1.0, 1), (3.6, 1), (4.0, 0.5)]), 10.6)
    # inversion 14.2 -> 16.2: reversed swell into water
    rv = reversed_buf(reverb(stereo(water_drop(seed=2430) * 0.5), 0.8, 2.0))
    place(out, rv, 16.2 - rv.shape[1] / SR)
    place(out, stereo(lowpass(noise(6.0, 2431, 'pink'), 900) * 0.02), 14.6)
    # ink 16.2 -> 24.0: D minor -> D major at 「它画出了你」 (20.4)
    mn = pad(D_MIN, 4.4, seed=2440, bright=0.3, amp=0.2)
    place(out, apply_env(mn, [(0, 0), (1, 1), (4.2, 1), (4.4, 0)]), 16.2)
    th = pad([N('D2'), N('A2'), N('D3'), N('F#3'), N('A3'), N('C#4'), N('E4'), N('F#4')], 7.0, seed=2450, bright=0.55, amp=0.32, voices=4)
    place(out, reverb(apply_env(th, [(0, 0), (0.6, 1), (3.0, 0.9), (7.0, 0)]), 0.5, 6.0, seed=17), 20.2)
    # ◀◀ fails 24.0 -> 25.2: a rewind attempt that stutters and dies
    att = reversed_buf(stereo(whoosh(0.9, 300, 3000, seed=2460, shape='rise') * 0.12))
    att = tape_stop(att, 0.5)
    place(out, att, 24.1)
    # title 25.2: final drop + long reverb, then silence at 27.3
    fin = silence(3.0)
    place(fin, water_drop(seed=2470, f0=800, f1=2200, dur=0.5) * 0.8, 0.0)
    fin = reverb(fin, 0.55, 3.5, seed=18)
    place(out, fin, 25.3)
    out[:, int(27.3 * SR):] *= np.linspace(1, 0, out.shape[1] - int(27.3 * SR))
    return out


BEDS = {'S01': bed_S01, 'S02': bed_S02, 'S03': bed_S03, 'S04': bed_S04, 'S05': bed_S05, 'S06': bed_S06, 'S07': bed_S07, 'S08': bed_S08, 'S09': bed_S09}


# ============================================================ cue sounds (frame-accurate events from scenes)

import zlib


def _crackle(dur, seed, density=60, lo=2000, hi=6000, amp=0.025):
    out = np.zeros(int(dur * SR))
    r = rng(seed)
    for i in range(int(density * dur)):
        s0 = int(r.uniform(0, dur - 0.03) * SR)
        x = tick(seed=seed + i, f=r.uniform(lo, hi)) * r.uniform(0.3, 1.0) * amp
        out[s0:s0 + len(x)] += x[: len(out) - s0]
    return out


def _sparkle(seed, n=6, amp=0.03):
    r = rng(seed)
    out = np.zeros(int(1.2 * SR))
    notes = [N('D6'), N('E6'), N('F#6'), N('A6'), N('B6'), N('D7')]
    for i in range(n):
        s0 = int(r.uniform(0, 0.4) * SR)
        b = bell(notes[int(r.integers(0, len(notes)))], 0.7, seed=seed + i, decay=0.25) * r.uniform(0.4, 1.0) * amp
        out[s0:s0 + len(b)] += b[: len(out) - s0]
    return out


SPLIT_COUNT = {}


def cue_sound(kind, intensity, seed, sid=''):
    """Map a scene's cue kind to a synthesized sound (mono or stereo), or None to leave it to the bed."""
    k = kind.lower().strip()
    a = 0.35 + 0.65 * max(0.0, min(1.0, float(intensity if intensity is not None else 0.5)))
    r = rng(seed)
    # --- narration / bed-owned / meta cues: silent here
    if k.startswith('text') or k in ('name', 'resolve', 'release', 'continue', 'handoff', 'hold', 'count', 'time-lapse', 'clear', 'cut',
                                      'silence', 'silence dip', 'hush', 'muffle', 'drone', 'drone-in', 'warm-pad', 'hum', 'texture', 'ambience',
                                      'streams', 'flow-on', 'water', 'noise-white', 'detune', 'instrument', 'swell-continue', 'transform'):
        return None
    # --- S06 photon ledger: 1 high sine in, 20 low tones out (frequency /20)
    if k == 'high-sine':
        d = 1.0
        x = sine(3520.0, d) * env_adsr(int(d * SR), a=0.15, d=0.2, s=0.8, r=0.5) * 0.05
        return x + sine(1760.0, d) * env_adsr(int(d * SR), a=0.15, d=0.2, s=0.8, r=0.5) * 0.02
    if k == 'split-tone':
        i = SPLIT_COUNT.get(sid, 0)
        SPLIT_COUNT[sid] = i + 1
        f = 176.0 * (1 + 0.006 * (i - 10))  # 3520 / 20
        d = 2.2
        x = sine(f, d) * 0.5 + sine(2 * f, d) * 0.3 + sine(3 * f, d) * 0.15
        x = x * env_adsr(int(d * SR), a=0.01, d=0.25, s=0.45, r=1.4) * 0.05
        return stereo(x, -0.9 + 1.8 * (i % 20) / 19)
    # --- life
    if 'heart' in k:
        return heartbeat(seed=seed) * 0.42 * a
    if k == 'breath':
        n = int(1.6 * SR)
        return bandpass(noise(1.6, seed, 'pink'), 350, 2400) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.045 * a
    if k in ('footstep', 'step') or 'crunch' in k or 'sand' in k:
        n = int(0.16 * SR)
        x = bandpass(noise(0.16, seed), 700, 6000) * np.exp(-np.arange(n) / (0.035 * SR))
        x += _crackle(0.16, seed + 7, density=120, lo=3000, hi=8000, amp=0.01)
        return x * 0.12 * a
    if k in ('ember-pluck',) or 'pluck' in k or k == 'note':
        notes = [N('D4'), N('F4'), N('A4'), N('C5'), N('D5'), N('E5')]
        return karplus(notes[int(r.integers(0, len(notes)))], 1.4, seed=seed, damp=0.995, bright=0.45) * 0.09 * a
    # --- ticks, clicks, typing, odometers, collisions
    if k in ('tick', 'ui-tick', 'odometer-tick', 'counter-tick', 'click', 'flap-clack', 'pen-line', 'pen', 'type') or 'tick' in k:
        f = {'type': 4200, 'flap-clack': 1500, 'pen-line': 5200, 'pen': 5200}.get(k, 2600 + (seed % 5) * 350)
        g = {'type': 0.035, 'flap-clack': 0.08, 'pen-line': 0.02, 'pen': 0.02}.get(k, 0.055)
        return tick(seed=seed, f=f) * g * a
    if k in ('counter-roll', 'odometer-whirr', 'ff-whir'):
        return _crackle(0.6 if k != 'ff-whir' else 1.0, seed, density=70, lo=2500, hi=4500, amp=0.03) * a
    if 'collision' in k or 'collide' in k:
        return tick(seed=seed, f=1800 + (seed % 9) * 260) * 0.09 * a
    if k in ('crackle', 'rain', 'swarm', 'burst-texture', 'ember-cascade', 'growth', 'sparks', 'pings'):
        return _crackle(0.8, seed, density=90 if k != 'growth' else 50, amp=0.03) * a
    # --- impacts
    if k in ('impact', 'hit', 'slam', 'emphasis-hit', 'collapse'):
        return impact(1.8, f0=110, f1=38, seed=seed) * 0.42 * a
    if k in ('stamp', 'land', 'odometer-land', 'settle', 'gauge-peg'):
        return impact(0.6, f0=180, f1=70, seed=seed, noise_amt=0.5) * 0.22 * a
    if k in ('pop', 'last-pop'):
        return water_drop(seed=seed, f0=500, f1=1300, dur=0.18) * 0.22 * a
    if k == 'bh-pop':
        n = int(0.5 * SR)
        x = impact(0.5, f0=70, f1=35, seed=seed, noise_amt=0.2) * 0.2 + _crackle(0.5, seed, density=40, lo=5000, hi=9000, amp=0.03)
        return x * a
    if k in ('drop', 'drip', 'splash', 'plop'):
        return water_drop(seed=seed) * 0.45 * a
    if k == 'strike':
        return swept_bandpass(noise(0.35, seed), 600, 5000, q=3) * np.linspace(1, 0, int(0.35 * SR)) * 0.25 * a
    # --- light
    if k in ('ignition', 'gold-ignite', 'last-star', 'flash', 'glint'):
        f = {'last-star': N('A5'), 'gold-ignite': N('A5')}.get(k, N('E6'))
        return bell(f, 2.0, seed=seed, decay=0.9 if k != 'flash' else 0.4) * 0.07 * a
    if k in ('shimmer', 'sparkle', 'grain-sparkle', 'gold-flicker', 'spark', 'ping', 'reveal ping'):
        return _sparkle(seed, n=4 if k != 'gold-flicker' else 1, amp=0.03 if k != 'gold-flicker' else 0.015) * a
    if k in ('chime', 'reveal', 'appear'):
        notes = [N('D5'), N('F#5'), N('A5'), N('E5')]
        return bell(notes[int(r.integers(0, len(notes)))], 1.8, seed=seed, decay=1.0) * 0.06 * a
    if k == 'sonar':
        return delay(stereo(bell(N('A5'), 0.8, seed=seed, decay=0.3) * 0.06 * a), time=0.25, fb=0.5, mix=0.6, taps=4)
    if k == 'hawking-rise':
        n = int(1.2 * SR)
        return glide_sine(300, 2400, 1.2) * np.sin(np.linspace(0, np.pi, n)) ** 2 * 0.03 * a
    if k == 'glissando':
        n = int(1.5 * SR)
        return glide_sine(220, 880, 1.5) * np.sin(np.linspace(0, np.pi, n)) * 0.04 * a
    # --- time tampering
    if k in ('glitch',):
        x = highpass(noise(0.22, seed), 900) * 0.16
        g = (np.sin(2 * np.pi * (25 + seed % 30) * np.arange(len(x)) / SR) > 0).astype(float)
        return x * g * a
    if k in ('rewind', 'rewind swell', 'spark reversed'):
        w = whoosh(0.8 if k != 'rewind' else 1.4, 3000, 300, seed=seed, shape='rise') * 0.12
        return w * a
    if k in ('tape-stop', 'transport'):
        return glide_sine(600, 60, 0.5) * np.linspace(1, 0, int(0.5 * SR)) * 0.08 * a
    # --- motion
    if k in ('whoosh', 'sweep', 'transition', 'camera-move', 'zoom', 'dive', 'drain', 'mode-switch', 'loupe-open', 'loupe-close', 'hud-dissolve', 'dissolve', 'ink-bleed', 'pulse'):
        d = {'pulse': 0.6, 'dive': 1.6, 'zoom': 1.4}.get(k, 0.9)
        shape = 'rise' if k in ('pulse', 'dive') else 'bell'
        return whoosh(d, 250, 3500, seed=seed, shape=shape) * (0.09 if k != 'pulse' else 0.07) * a
    if 'swell' in k or k in ('rise', 'rumble', 'gravity-swell', 'sun-swell', 'vortex-swell'):
        d = 1.8
        x = bandpass(noise(d, seed, 'pink'), 150, 2500) * np.linspace(0, 1, int(d * SR)) ** 2 * 0.06
        return x * a
    return None


# per-scene cue kinds already designed into the scene's bed (avoid doubling)
BED_OWNS = {
    'S01': {'drop', 'impact', 'swell', 'swell peak', 'rewind', 'sweep'},
    'S06': {'swell', 'sun-swell', 'swell-peak'},
}


# ============================================================ master

def dynamics(x, thr_db=-22.0, ratio=3.0, lift_lo=-48.0, lift_hi=-30.0, lift=0.55, win=0.35):
    """Broadband level control for phone speakers: compress loud passages above thr_db by `ratio`,
    lift quiet-but-present passages (between lift_lo and lift_hi dB) toward lift_hi, and leave true
    silences (below lift_lo) untouched so the deliberate silences stay silent."""
    m = np.mean(x ** 2, axis=0)
    k = int(win * SR)
    ker = np.ones(k) / k
    env = np.sqrt(np.convolve(m, ker, mode='same') + 1e-12)
    lev = 20 * np.log10(env + 1e-12)
    g = np.zeros_like(lev)
    over = lev > thr_db
    g[over] = (thr_db - lev[over]) * (1 - 1 / ratio)
    mid = (lev > lift_lo) & (lev < lift_hi)
    # fade the lift in from lift_lo (no lift) to a bit above it (full lift) to avoid pumping up noise floors
    w = np.clip((lev[mid] - lift_lo) / 6.0, 0, 1)
    g[mid] = (lift_hi - lev[mid]) * lift * w
    # smooth gain (attack/release ~ 120 ms)
    k2 = int(0.12 * SR)
    g = np.convolve(g, np.ones(k2) / k2, mode='same')
    return x * (10 ** (g / 20))[None, :]


def master(x, target_rms_db=-19.0, ceiling=0.89):
    # gentle glue: soft-knee compression via tanh on a pre-gain, then RMS normalise and peak-limit
    rms = np.sqrt(np.mean(x ** 2) + 1e-12)
    gain = 10 ** (target_rms_db / 20) / rms
    y = x * gain
    y = soft_clip(y, 1.2) * 0.98
    peak = np.max(np.abs(y))
    if peak > ceiling:
        y = y * (ceiling / peak)
    return y.astype(np.float32)


def write_wav(path, x):
    from scipy.io import wavfile
    y = np.clip(x.T, -1, 1)
    wavfile.write(path, SR, (y * 32767).astype(np.int16))


def main():
    tl = load_timeline()
    total = tl['total'] / tl['fps']
    mix = silence(total + 1.0)
    cue_count = 0
    for s in tl['scenes']:
        sid = s['id']
        start = s['start'] / tl['fps']
        dur = s['frames'] / tl['fps']
        bed = BEDS[sid](dur)
        place(mix, bed[:, : int(dur * SR) + int(0.02 * SR)], start)
        owns = BED_OWNS.get(sid, set())
        for i, c in enumerate(load_cues(sid)):
            kind = c.get('kind', '')
            if kind.lower() in owns:
                continue
            snd = cue_sound(kind, c.get('intensity', 0.5), seed=zlib.crc32(f'{sid}:{i}'.encode()) % 100000, sid=sid)
            if snd is None:
                continue
            place(mix, snd, start + c['frame'] / tl['fps'], pan=c.get('pan', None))
            cue_count += 1
        print(f'{sid}: bed {dur:.1f}s @ {start:.1f}s, cues so far {cue_count}', flush=True)
    mix = mix[:, : int(total * SR)]
    # global highpass to remove rumble below 25 Hz
    mix = highpass(mix, 25).astype(np.float32)
    pre = np.sqrt(np.mean(mix ** 2) + 1e-12)
    mix = mix * (10 ** (-20 / 20) / pre)
    mix = dynamics(mix).astype(np.float32)
    mix = master(mix)
    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    wav = os.path.join(ROOT, 'out', 'score.wav')
    write_wav(wav, mix)
    mp3 = os.path.join(ROOT, 'public', 'audio', 'score.mp3')
    os.system(f'ffmpeg -y -loglevel error -i "{wav}" -codec:a libmp3lame -b:a 256k "{mp3}"')
    print('wrote', wav, 'and', mp3, f'{total:.1f}s', 'peak', float(np.max(np.abs(mix))))


if __name__ == '__main__':
    main()

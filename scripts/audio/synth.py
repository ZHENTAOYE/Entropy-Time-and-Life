"""Procedural instrument library for the film's score (numpy/scipy, 48 kHz stereo float32).

Everything is generated from first principles: oscillators, noise, filters, Karplus-Strong strings,
synthetic convolution reverb. Deterministic (seeded RNG).
"""
import numpy as np
from scipy import signal

SR = 48000


def rng(seed):
    return np.random.default_rng(seed)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def silence(dur, ch=2):
    return np.zeros((ch, int(dur * SR)), dtype=np.float32)


def stereo(x, pan=0.0):
    """mono -> stereo with constant-power pan (-1 left .. 1 right)."""
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)]).astype(np.float32)


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.3):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a_n), endpoint=False),
        np.linspace(1, s, max(1, d_n), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(1, r_n)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def fade(x, fin=0.01, fout=0.01):
    n = x.shape[-1]
    e = np.ones(n)
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        e[:a] = np.linspace(0, 1, a) ** 2
    if b > 0:
        e[-b:] = np.linspace(1, 0, b) ** 2
    return x * e


def lowpass(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def highpass(x, fc, order=2):
    sos = signal.butter(order, max(fc, 10), 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [max(lo, 10), min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def resonator(x, f, q=50.0):
    """Narrow 2-pole resonant bandpass (iirpeak) — 'rings' noise into a pitch."""
    b, a = signal.iirpeak(min(f, SR * 0.45), q, fs=SR)
    return signal.lfilter(b, a, x, axis=-1)


def swept_bandpass(x, f0, f1, q=4.0, block=512):
    """Time-varying bandpass by block processing with SVF-like per-block coefficients."""
    out = np.zeros_like(x)
    n = x.shape[-1]
    nb = max(1, n // block)
    zi = None
    for i in range(nb + 1):
        s, e = i * block, min(n, (i + 1) * block)
        if s >= e:
            break
        fr = f0 * (f1 / f0) ** (i / max(1, nb))
        bw = fr / q
        lo, hi = max(20, fr - bw / 2), min(SR * 0.45, fr + bw / 2)
        sos = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y, zi = signal.sosfilt(sos, x[s:e], zi=zi)
        out[s:e] = y
    return out


# ------------------------------------------------------------------ oscillators

def sine(f, dur, phase=0.0):
    t = t_axis(dur)
    if callable(f):
        ph = 2 * np.pi * np.cumsum(f(t)) / SR
        return np.sin(ph + phase)
    return np.sin(2 * np.pi * f * t + phase)


def glide_sine(f0, f1, dur, curve='exp'):
    n = int(dur * SR)
    if curve == 'exp':
        fr = f0 * (f1 / f0) ** (np.arange(n) / max(1, n - 1))
    else:
        fr = np.linspace(f0, f1, n)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR)


def pad(freqs, dur, seed=0, detune=0.25, voices=3, bright=0.35, lfo=0.07, amp=0.2):
    """Warm evolving pad: detuned additive voices with slow amplitude/filter motion -> stereo."""
    r = rng(seed)
    t = t_axis(dur)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) * detune
            ff = f * 2 ** (d / 1200 * 12)
            ph = r.uniform(0, 2 * np.pi)
            mod = 1 + 0.25 * np.sin(2 * np.pi * lfo * r.uniform(0.6, 1.4) * t + r.uniform(0, 6.28))
            # a few harmonics, softly rolled off
            tone = np.zeros_like(t)
            for h in range(1, 6):
                tone += (bright ** (h - 1)) / h * np.sin(2 * np.pi * ff * h * t + ph * h)
            pan = r.uniform(-0.8, 0.8)
            a = (pan + 1) * np.pi / 4
            L += tone * mod * np.cos(a)
            R += tone * mod * np.sin(a)
    out = np.stack([L, R]) / (len(freqs) * voices)
    return (out * amp).astype(np.float32)


def karplus(f, dur, seed=0, damp=0.996, bright=0.5):
    """Karplus-Strong plucked string (vectorised via IIR comb filter)."""
    r = rng(seed)
    n = int(dur * SR)
    N = max(2, int(SR / f))
    exc = np.zeros(n)
    burst = lowpass(r.uniform(-1, 1, N), 1000 + 9000 * bright)
    exc[:N] = burst
    a = np.zeros(N + 2)
    a[0] = 1.0
    a[N] = -damp * 0.5
    a[N + 1] = -damp * 0.5
    return signal.lfilter([1.0], a, exc)


def bell(f, dur, seed=0, inharm=(1.0, 2.76, 5.4, 8.93), decay=1.6):
    t = t_axis(dur)
    r = rng(seed)
    out = np.zeros_like(t)
    for i, k in enumerate(inharm):
        out += np.sin(2 * np.pi * f * k * t + r.uniform(0, 6.28)) * np.exp(-t * (1 + i * 1.3) / decay) / (i + 1)
    return out * np.minimum(1, t * 400)


def noise(dur, seed=0, color='white'):
    r = rng(seed)
    n = int(dur * SR)
    x = r.standard_normal(n)
    if color == 'pink':
        X = np.fft.rfft(x)
        fr = np.fft.rfftfreq(n, 1 / SR)
        X[1:] /= np.sqrt(fr[1:])
        X[0] = 0
        x = np.fft.irfft(X, n)
        x /= np.std(x) + 1e-9
    elif color == 'brown':
        x = np.cumsum(x)
        x = highpass(x, 15)
        x /= np.std(x) + 1e-9
    return x


# ------------------------------------------------------------------ effects

_IR_CACHE = {}


def reverb_ir(seconds=4.0, seed=3, damp=0.6, predelay=0.02):
    key = (seconds, seed, damp, predelay)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    r = rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    irs = []
    for c in range(2):
        x = r.standard_normal(n) * np.exp(-t * 6.9 / seconds)
        # frequency-dependent damping: progressively lowpass the tail
        lp = lowpass(x, 9000)
        hp_tail = lowpass(x, 2500)
        mixw = np.clip(t / seconds * 2 * damp, 0, 1)
        x = lp * (1 - mixw) + hp_tail * mixw
        x = np.concatenate([np.zeros(int(predelay * SR)), x])
        irs.append(x / np.sqrt(np.sum(x ** 2)))
    ir = np.stack(irs)
    _IR_CACHE[key] = ir
    return ir


def reverb(x, wet=0.35, seconds=4.0, seed=3, damp=0.6):
    """Stereo convolution reverb with a synthetic decorrelated IR."""
    if x.ndim == 1:
        x = stereo(x)
    ir = reverb_ir(seconds, seed, damp)
    n = x.shape[1]
    y = np.stack([signal.fftconvolve(x[c], ir[c])[:n] for c in range(2)])
    return ((1 - wet) * x + wet * y * 3.0).astype(np.float32)


def delay(x, time=0.38, fb=0.35, mix=0.3, taps=6):
    if x.ndim == 1:
        x = stereo(x)
    out = x.copy()
    d = int(time * SR)
    g = 1.0
    for k in range(1, taps + 1):
        g *= fb
        sh = d * k
        if sh >= x.shape[1]:
            break
        # ping-pong
        c = k % 2
        out[c, sh:] += x[c, :-sh] * g * mix / fb
    return out


def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)


def tape_stop(x, dur_stop=0.8):
    """Slow the end of a buffer down to a halt (pitch & speed drop)."""
    if x.ndim == 1:
        x = stereo(x)
    n = x.shape[1]
    m = int(dur_stop * SR)
    s = n - m
    speed = np.linspace(1, 0, m) ** 1.5
    pos = s + np.cumsum(speed)
    pos = np.clip(pos, 0, n - 1)
    out = x.copy()
    for c in range(2):
        out[c, s:] = np.interp(pos, np.arange(n), x[c])
    out[:, s:] *= np.linspace(1, 0, m) ** 0.5
    return out


def varispeed(x, speed_curve):
    """Resample buffer with a per-output-sample speed curve (array). Returns same-length-as-curve output."""
    if x.ndim == 1:
        x = stereo(x)
    pos = np.cumsum(speed_curve)
    pos = np.clip(pos, 0, x.shape[1] - 1)
    return np.stack([np.interp(pos, np.arange(x.shape[1]), x[c]) for c in range(2)]).astype(np.float32)


# ------------------------------------------------------------------ sound objects

def water_drop(seed=0, f0=900, f1=2400, dur=0.35):
    """Minnaert-like bubble: short sine with rising pitch + click."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fr = f0 + (f1 - f0) * (1 - np.exp(-tt / 0.03))
    ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) * np.exp(-tt / 0.045)
    click = noise(0.004, seed) * np.linspace(1, 0, int(0.004 * SR))
    x[: len(click)] += click * 0.4
    return x * 0.8


def impact(dur=3.0, f0=90, f1=32, seed=0, noise_amt=0.4):
    """Cinematic sub boom: pitch-dropping sine + filtered noise burst."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fr = f1 + (f0 - f1) * np.exp(-tt / 0.18)
    body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt / (dur * 0.35))
    nz = lowpass(noise(dur, seed), 900) * np.exp(-tt / 0.12) * noise_amt
    return soft_clip(body + nz, 1.5)


def whoosh(dur=1.5, f0=200, f1=4000, seed=0, q=3.0, shape='rise'):
    x = noise(dur, seed, 'pink')
    y = swept_bandpass(x, f0, f1, q=q)
    n = len(y)
    if shape == 'rise':
        e = np.linspace(0, 1, n) ** 2.5
        e[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    elif shape == 'fall':
        e = np.linspace(1, 0, n) ** 2
    else:
        e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return y * e / (np.max(np.abs(y)) + 1e-9)


def tick(seed=0, f=3200, dur=0.03):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) * 0.6 + noise(dur, seed) * 0.4) * np.exp(-tt / 0.004)


def heartbeat(seed=0):
    """lub-dub, ~0.9 s long."""
    out = np.zeros(int(0.9 * SR))
    for off, f, a in [(0.0, 55, 1.0), (0.24, 70, 0.7)]:
        x = impact(0.4, f0=f * 1.6, f1=f, seed=seed, noise_amt=0.15) * a
        s = int(off * SR)
        out[s:s + len(x)] += x[: len(out) - s]
    return lowpass(out, 400)


def shepard(dur, rate_oct_per_s=0.12, base=55.0, octaves=7, seed=0, up=True):
    """Endlessly rising (or falling) Shepard-Risset glissando."""
    t = t_axis(dur)
    out = np.zeros_like(t)
    center = np.log2(base) + octaves / 2
    for k in range(octaves):
        pos = (k + (rate_oct_per_s * t if up else -rate_oct_per_s * t)) % octaves
        lf = np.log2(base) + pos
        f = 2 ** lf
        amp = np.exp(-0.5 * ((lf - center) / (octaves / 5)) ** 2)
        ph = 2 * np.pi * np.cumsum(f) / SR
        out += amp * np.sin(ph)
    return out / octaves


def glass_shatter(seed=0, dur=2.5):
    r = rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    tt = np.arange(n) / SR
    burst = highpass(noise(dur, seed), 2500) * np.exp(-tt / 0.05)
    out += burst * 0.6
    for i in range(70):
        s = int(abs(r.normal(0, 0.25)) * SR) + int(r.uniform(0, 0.05) * SR)
        f = r.uniform(2500, 9500)
        d = r.uniform(0.08, 0.6)
        b = bell(f, d, seed=seed + i, decay=d * 0.6) * r.uniform(0.05, 0.25)
        e = min(n, s + len(b))
        out[s:e] += b[: e - s]
    return out


def tone_crystallize(f, dur, seed=0, q_start=2.0, q_end=300.0):
    """Noise that progressively rings into a pure tone (order emerging from noise)."""
    x = noise(dur, seed, 'pink')
    n = len(x)
    block = 2048
    out = np.zeros(n)
    nb = n // block + 1
    for i in range(nb):
        s, e = i * block, min(n, (i + 1) * block)
        if s >= e:
            break
        q = q_start * (q_end / q_start) ** (i / nb)
        b, a = signal.iirpeak(f, q, fs=SR)
        out[s:e] = signal.lfilter(b, a, x[max(0, s - 4096):e])[-(e - s):]
    pure = sine(f, dur)
    w = np.linspace(0, 1, n) ** 2
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out * (1 - w) * 0.8 + pure * w * 0.5


def place(track, x, at, gain=1.0, pan=None):
    """Mix buffer x into stereo track at time `at` seconds."""
    if x.ndim == 1:
        x = stereo(x, 0.0 if pan is None else pan)
    elif pan is not None:
        x = x * np.array([[np.cos((pan + 1) * np.pi / 4) * 1.414], [np.sin((pan + 1) * np.pi / 4) * 1.414]])
    s = int(at * SR)
    if s >= track.shape[1]:
        return
    if s < 0:
        x = x[:, -s:]
        s = 0
    e = min(track.shape[1], s + x.shape[1])
    track[:, s:e] += (x[:, : e - s] * gain).astype(np.float32)


def note_hz(name):
    """'A4' -> 440, supports sharps (#) and flats (b)."""
    names = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}
    n = names[name[0]]
    i = 1
    if name[i] == '#':
        n += 1
        i += 1
    elif name[i] == 'b':
        n -= 1
        i += 1
    octave = int(name[i:])
    return 440.0 * 2 ** ((n + (octave - 4) * 12) / 12)

# 熵、时间与生命 · Entropy, Time and Life

A 3′33″ vertical (1080×1920, 30 fps) popular-science film made entirely in code with [Remotion](https://remotion.dev).
Every image is drawn procedurally (Canvas2D + WebGL shaders): no stock footage, no images, no voice-over.
The narration is on-screen typography that is itself part of the physics — every line condenses out of blur and leaves by
diffusing. The score and sound design are synthesized from scratch in Python and hit 475 frame-accurate events.

**Film:** [`out/final/熵、时间与生命.mp4`](out/final/) (distribution encode). Render the full-quality master with `scripts/render.sh`.

## The film

| | Scene | Visual language | Idea |
|---|---|---|---|
| S01 | 墨滴 The Drop | backlit ink tank, VHS rewind | cold open on a reversed ink drop — "you know instantly it's reversed. Why?" |
| S02 | 对称 Symmetry | blueprint split-screen blind test | laws of motion don't care about t → −t; direction appears only with *many* particles and an ordered start |
| S03 | 数一数 Counting | data-viz / powers-of-ten zoom | microstates 1·4·6·4·1 → 10⁻³⁰ → a row of zeros longer than the Milky Way → S = k log W |
| S04 | 时间之箭 The Arrow | cosmic rewind, plasma, cosmic web | the arrow points to rising entropy; the Big Bang was absurdly low-entropy (Penrose 1/10^10^123); gravity makes clumping the high-entropy state |
| S05 | 热寂 Heat Death | the image itself diffuses into grey noise | stars die, black holes evaporate, everything at one temperature; one second of true silence |
| S06 | 阳光的账本 The Sun's Ledger | photon ledger, branching flows | Earth returns as much energy as it gets — but 1 sunlight photon in, ~20 infrared photons out |
| S07 | 涡旋 The Vortex | flow field → body → thermal camera | life keeps its shape while matter flows through; you radiate ~100 W, ~7000× the Sun per kg; "你是一个过程" |
| S08 | 记忆 Memory | sand relief, footprints, neurons | traces only point to the past; memory is the brain's footprint |
| S09 | 墨的形状 The Shape of Ink | powers-of-ten pull-back → web → ink | the ink will spread — but on its way, it drew you |

Recurring motifs tie the film together: the ◀◀/▶▶ timecode (time tampering), an on-screen entropy gauge *S*,
fixed colour meanings (gold = low entropy, red = waste heat, cyan = time-symmetric law, violet = gravity), the same human
figure in S07–S09, and seamless match cuts between every scene (the film loops from its black ending to its cold open).

## Project layout

- `docs/screenplay.md` — locked text and timings (science fact-checked); `docs/visual-direction.md` — design system and
  per-scene concepts; `docs/ENGINEERING.md` — rules and shared-library API.
- `src/lib/` — shared engine: seeded noise/random, Canvas/WebGL layers, the `Caption` typography system, HUD (timecode,
  odometer, entropy gauge), ink-in-water renderer, cosmic web / galaxy renderer, branching growth, handoff constants.
- `src/scenes/Sxx_*/` — one folder per scene; each has an isolated preview entry (`entry.tsx`) and `cues.ts` sound cues.
- `scripts/audio/` — procedural synth library and score composer; `scripts/export-cues.mjs` collects scene cues.

## Build

```bash
npm install
node scripts/export-timeline.mjs && node scripts/export-cues.mjs && python3 scripts/audio/score.py   # score (needs numpy, scipy, ffmpeg)
node scripts/stills.mjs S03 --every 30 --sheet      # contact sheet of one scene
npx remotion studio src/index.ts                    # interactive preview
scripts/render.sh                                   # master + distribution encode
```

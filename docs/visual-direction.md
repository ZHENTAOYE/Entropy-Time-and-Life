# Visual direction (design system · scene concepts · handoffs)

> **Precedence (read this first).**
> - **On-screen TEXT and card TIMINGS: `docs/screenplay.md` v1 is authoritative.** This document was written against
>   the v0 draft (v0 durations: S01 420f, S02 660, S03 1080, S04 840, S05 360, S06 660, S07 900, S08 660, S09 720) and
>   quotes some v0 captions — ignore those captions and re-time beats to the v1 card table of your scene.
> - **Visual concepts, design system, colour language, motifs, handoff constants: authoritative here**, adapted by the
>   "v1 reconciliation" notes in §0 below.
> - Handoff constants live in `src/lib/handoff.ts` (Q_DOT, BOX, P4, ZERO_LINE, GOLD_POINT, SPIRAL, FEET, FIGURE_S08,
>   WATER_LINE_Y, COLOR). HUD vocabulary lives in `src/lib/hud.tsx` (Timecode, Odometer, SGauge, Sci). Branching growth in
>   `src/lib/growth.ts`. Thermal LUT in `src/lib/lut.ts`. Ink renderer in `src/lib/ink*` and cosmic web / galaxy renderers
>   in `src/lib/cosmos*` (built before the scenes; use them so the match cuts are seamless).

## §0 v1 reconciliation notes (per scene)
- **Global:** grain stays global (don't add more). Captions: use `{…}` emphasis, `\n` breaks (inside a JS string, i.e.
  `text={'a\nb'}`), stagger 1 for lines over ~16 characters. No narration caption may still be on screen on a scene's
  last frame unless it is a deliberate hard-cut kill. For big monumental numbers use `<Sci>` from `lib/hud.tsx` (proper
  raised exponents); superscript glyphs inside normal captions are OK.
- **S01 (390 f):** v1 is a **cold open on the rewind**: frame 0 is already a spread ink cloud rolling *backward* (◀◀
  timecode, chromatic aberration, S-gauge falling red), it re-gathers into a drop that leaps out of the water (~2.4 s);
  tape-stop; ▶; the drop falls, impact ~4.2 s, slow-motion bloom (Widnall cascade, Beer–Lambert colour, S-gauge rising);
  hard cut to black at 11.0 s; 「为什么？」 (Serif 200, ~120 px) and its dot at `Q_DOT`; only the dot remains at the end
  (OUT = black + dot). Captions are ink-coloured `#17151C` while over the cream tank. Skip the v0 "point grows into the
  hairline" opening (the hook matters more than the loop; S09 still ends on black).
- **S02 (522 f):** v1 text. Keep the stacked A/B panels, the cell-division opening from `Q_DOT`, the equation
  t → −t with annihilating minus signs, N = 2 → 10 → 400 with the 400 starting as a dense disc (B condenses into the
  disc), guess meter ? → ! → !!. **No glass shatter** (no time). 「时间之箭，藏在“很多”之中。」: 很多 assembled from the balls.
  End: the field dims to 4 cyan dots in `BOX` with divider (OUT).
- **S03 (1092 f):** follow the **v1 order**: 4 particles → 16 states → 1·4·6·4·1 → N=10 (Galton barcodes) → N=100 →
  N=10⁴ needle (labels only) → 「100个粒子全在左边：约 10⁻³⁰」 (the lottery waterfall can sit behind it) → glass of water
  → 「每个零，只占1毫米。」 → exponential zoom-out along the zero row to the Milky Way (with dimension lines
  `银河系 ≈ 10⁵ 光年` / `这一行 ≈ 2.6×10⁵ 光年`) → 「这串零，比银河系还长。」 → 「聚回来，不是不可能——只是太不可能。」 →
  the glyph 熵 (+ pinyin shāng) forms (e.g. from the galaxy/zero particles) → **S = k log W** (W built from barcodes,
  gold-leaf; tiny `L. BOLTZMANN · WIEN, ZENTRALFRIEDHOF`; caption 「玻尔兹曼墓碑上的公式」) → definition card with
  乱 struck through. OUT: everything resolves into the single glowing amber `ZERO_LINE`.
- **S04 (954 f):** v1 text. Concept as below (line → vertical arrow, future up; dive; cosmic rewind with converging,
  dissolving galaxies; floor of time; Penrose power tower + 「彭罗斯估算」; **card 6 dissolves to S01's fully spread
  ink** (use the shared ink renderer) to create the contradiction; card 7 shows the miniature 无引力/有引力 boxes then the
  full-scale collapse into the lit web; 「宇宙，从那里一路滚落。」 「你经历的每一个“之后”，都是这场滚落。」). OUT = `WEB_FINAL`.
- **S05 (522 f):** v1 text (17.4 s, more time than v0 — let the image die slowly). 「热寂」 NOISE-DEATH. ~1.4 s of pure
  grey silence. The gold point at `GOLD_POINT` with 「但在滚落的路上——」 (same layout/position as S09's
  「但在散开的路上——」: centred, y = 1440, Serif 600 56 px).
- **S06 (582 f):** v1 text. Sun top / Earth bottom ledger; the 20-crest gold packet unzips into 20 red waves; ledger
  lines; 「像那滴墨，阳光在地球上“散开”了」 (散开 spreads like ink); branching flows (growth.ts) → spiral sink at `SPIRAL`.
  No human figure in S06 (only the word 你 is brightened).
- **S07 (900 f):** v1 text incl. the new card 「按每公斤算，你发的热是太阳的约7000倍。」 with a tiny log bar comparison
  (太阳 ≈0.0002 W/kg · 你 ≈1.4 W/kg). Final card 「你是一个过程。」 with 过程 built from flowing particles. OUT = top view of
  two thermal footprints at `FEET`.
- **S08 (570 f):** v1 text. Footprints walking up (future is up), labels −4 s … 现在 · 未来？ over pristine sand, ◀◀
  tries and fails (✕ 不可逆), dendrites (growth.ts), gold-line human with the network in the head. OUT = `FIGURE_S08`.
- **S09 (848 f):** v1 text (「途中，它在一些角落，暂时织出了结构：」, 「星系。」「细胞。」「你。」, 「然后，其中最小的一块，抬起头问：
  时间是什么？」, 「墨，终将散开。」, 「但在散开的路上——」, 「它画出了你。」, ◀◀ fails and diffuses into ink, title
  「熵 · 时间 · 生命」 with pinyin shāng, final drop, black). The ink-wash figure must never look like un-diffusion
  (S-gauge keeps rising). OUT = black.

---

Review of `docs/screenplay.md` (draft v0), checked against `docs/ENGINEERING.md`, `src/timeline.ts` and `src/lib/*`. The scene durations below are the fixed ones from `src/timeline.ts`: S01 420f · S02 660 · S03 1080 · S04 840 · S05 360 · S06 660 · S07 900 · S08 660 · S09 720. Every frame number in this review is local to its scene.

---

## 0. Verdict

The thesis and the arc are strong: concept → cosmos → life → self, then back to ink. The "every scene invents a new visual language" principle is right. Five problems need fixing before anyone builds a scene.

1. **Too much text for the time available.** Using the engineering guide's rule (chars/5 s + 0.8 s per line), five of the nine scenes need more reading time than they last. Without cuts, the visuals never get room to explain anything, which defeats the point of the film. Trimmed copy is in §1.1.
2. **Two places where the visuals contradict the science.**
   - S02's 400-ball reversal only looks wrong if the forward run *starts ordered*. A reversed equilibrium gas looks perfectly natural.
   - S09's "ink gathers into a human" must not look like un-diffusion, or the ending contradicts the whole film.
   - The fixes for both make the film *more* explanatory (§1.2).
3. **S03 is in the wrong order.** The answer to S01's 「为什么？」 should be S03's last line, landing over the zero-row/galaxy image. That line then turns directly into S04's arrow of time (§1.3).
4. **The match-cuts don't exist yet.** Each scene needs a defined IN frame and OUT frame, made from shared constants. I define all ten, including S09→S01, so the film loops seamlessly on short-video platforms (§4).
5. **Shared renderers.** The ink (S01/S09), the cosmic web (S04/S05/S09) and the HUD (timecode, odometer, S-gauge) have to look identical on both sides of a cut. They should go into `src/lib` once, written by the lead. If each scene author copies them, the cuts will visibly jump (§5).

---

## 1. Critical notes on the draft

### 1.1 Reading-time audit and trimmed copy

| Scene | Seconds | Draft text needs | Verdict | Trims (used in the beat sheets below) |
|---|---|---|---|---|
| S01 | 14 | ~9 s | OK | Line 3 runs into the rewind (text and image move together) |
| S02 | 22 | ~16 s + 4 visual set-pieces | Tight | Merge the last two lines: 「时间之箭不在单个粒子里，\n而藏在"很多"之中。」 |
| S03 | 36 | **~47 s** | Over by 30% | Histogram counts become HUD numerals (no narration). The lottery becomes a HUD counter only. Merge the 10²⁵ lines. 「熵不是"乱"…」 becomes a typographic strike-through 乱→数 |
| S04 | 28 | **~30 s** | Over | Drop 「物质开始抱团，恒星点亮」 (the image shows it). Merge the uniformity twist into one 2-line caption. End line: 「宇宙从此一路滚落——\n你经历的每个"之后"，都是其中一段。」 |
| S05 | 12 | **~13 s**, and the "hold on grey" needs silence | Over | 「一直滚下去呢？」 / 「处处同温，\n再没有什么能够发生。」 / 「热寂」 (visual word) / 「但在下坡路上——」 |
| S06 | 22 | **~25 s** | Over | Merge the first two lines: 「地球吸收多少能量，\n就向太空送回多少。」 Drop 「真正的交易，在这里：」 (the camera move says it) |
| S07 | 30 | **~37 s** | Over by 7 s | 「1944年，薛定谔说：\n生命以"负熵"为食。」 · 「漩涡的形状一直都在，\n水却没有一滴停留。」 · 「你也是。」 · 「你吃进秩序，排出混乱。」 · final pair merged into one 2-line statement. Drop the 加速熵增 sentence; a HUD ledger carries it |
| S08 | 22 | ~22 s, no air | Tight | 「最后：为什么你只记得过去，\n不记得未来？」 · replace line 4 with 「记忆，也是一种脚印。」 (shorter and more poetic) |
| S09 | 24 | **~24 s** + title + silence | Over | Cut the recap line. Open with 「在滚向平衡的路上，宇宙在一些角落，\n暂时堆起了秩序——」 |

Rules for every caption:
- Use `stagger={1}` for lines over 16 characters. The default of 2 frames per character makes a 20-character line take about 1.9 s just to finish condensing.
- No caption may still be on screen at a scene's last frame. It would vanish on the cut. The only exception is a deliberate hard-cut kill (S01 line 3).

### 1.2 Science fixes that also improve the visuals

- **S02, N = 400:** the 400 balls start packed into a dense disc, the same size and position as the ink drop. In panel A they burst outward. In panel B (reversed) a scattered gas spontaneously condenses into a perfect disc. This is the visual seed of S04's "past hypothesis": the arrow lives in the *starting condition*, not in the laws.
- **S04, the gravity paradox** ("uniform = low entropy") is the most counter-intuitive claim in the film. It needs a picture, not just a caption. Before the full-scale collapse, show a 3-second miniature: two thought-experiment boxes, 「无引力」 next to 「有引力」.
- **S09, the ink-drawn human:** the ink must *flow along* the figure's contour like a 水墨 brush stroke. It never re-concentrates into a blob. The S-gauge (§2.5) keeps rising the whole time the figure is visible. The image itself then proves that local order is happening *within* rising entropy, which is the thesis of S06–S07.
- **S06:** move "→ animals → you" out of S06. "You" is S07's reveal, and showing the human twice weakens it. S06 ends on the flows converging into a vortex.
- **S03:** 2⁻¹⁰⁰ = 7.9×10⁻³¹ ✓. 4.4×10¹⁷ s × 10¹² gives an expected 0.35 hits, so 「多半等不到」 is honest. The zero row is 2.5×10²¹ m ≈ 2.6×10⁵ ly, longer than the Milky Way (~10⁵ ly) ✓. Show both ends of the row with dimension lines, so viewers see it is *one finite number*.
- **S06:** T☉/T⊕ ≈ 5800/255 ≈ 23, so "约20" is fine.
- **S08:** the footprints should run toward the *top* of the frame, matching S04's upward arrow of time. The unmarked sand ahead *is* the visual argument: records only exist behind the present.

### 1.3 Structural changes

- **S03 new order:** 4 particles → 16 states → histogram → N = 10 → N = 100 needle (with the lottery behind it) → S = k log W → 10²⁵ zero-row zoom → **the answer to 「为什么？」** over the galaxy → the zero row becomes a single line → S04's arrow.
- **Loop:** S09 ends on black via a hairline of light collapsing to a point. S01 begins with a point growing into that hairline, so the platform's auto-loop is seamless.
- **Hook:** the first impact has to land by about 2.1 s (f62). The draft's black open is too slow for vertical feeds.
- **Cover frame:** pick the platform cover separately. Good candidates are S03 f1000 (galaxy on the zero line) or S07 f650 (thermal human).

---

## 2. Global design system

### 2.1 Frame lanes (1080×1920)

| Lane | Position | Use |
|---|---|---|
| Narration | centre (540, 1440), maxWidth 900, max 2 lines | All captions |
| Statement | centre y 900–1000 (or 1450 when the subject sits high) | Big words: 为什么？/ 热寂 / 你也是。 |
| HUD top-left | x = 90, y 240–330 | Timecodes, source labels, chapter index |
| Odometer bottom-left | x = 90, y ≈ 1590 | Scale (10ⁿ m), years, °C |
| S-gauge | x = 56–72, y 560–1360 | Entropy needle (non-critical, may sit outside the 90 px margin) |
| Dead zone | x > 940 for y 900–1500; y > 1650 everywhere | Nothing important |

### 2.2 Typography

| Role | Font | Weight / size | Colour | Tracking | In → Out |
|---|---|---|---|---|---|
| Narration | Noto Serif SC | 600 / 56 | `#F3EFE6` (on cream scenes: `#17151C`, no shadow) | .08em | CONDENSE → DIFFUSE |
| Assertion | Noto Serif SC | 900 / 96–140 | per scene | .04em | CONDENSE (fast, enterLen 10) → DIFFUSE |
| Question / void | Noto Serif SC | **200** / 120–160 | per scene | .12em | FADE (4–6f) → DIFFUSE or NOISE |
| HUD Latin / numbers | JetBrains Mono | 400 / 24–30, uppercase | palette at 70% | .2em | TYPE (+ ▍ cursor, blinks every 15f) |
| HUD Chinese | Noto Sans SC | 400 / 26–30 | palette at 70% | .15em | TYPE |
| Math variables | Cormorant Garamond | 600 italic | per scene | 0 | Glyph-level MORPH |
| Big numerals | Cormorant Garamond | 600 / 96–360 | per scene | 0 | ODOMETER |

Rules:
- 900 weight means *assertion*. 200 weight means *question or emptiness*.
- Chinese HUD text is always Sans, never Serif.
- Counters use `font-variant-numeric: tabular-nums` so they don't jitter.
- **Exponent glyphs:** check that the Noto Serif SC font slices cover ⁻ ⁰ ⁴…⁹ (U+2070 block). If they don't, the browser silently falls back to a system font. The safe route is to render exponents as separate raised spans (0.55em, raised 0.85em) in an inline numeral component, not inside `Caption`.

### 2.3 Text-animation grammar (one verb per meaning)

- **CONDENSE / DIFFUSE** (lib default): language obeys entropy. Every narration line uses it.
- **REWIND**: a caption plays its DIFFUSE backward. Used only in S01 f296–356 and S04 f195–420. Needs a local copy of `Caption` with a `frame` override, in the scene folder.
- **TYPE**: HUD only.
- **ODOMETER**: digits roll vertically with y-blur proportional to speed.
- **STRIKE**: a 2 px line draws across a word, the word diffuses, the replacement condenses (S03: 乱 → 数).
- **ANNIHILATE**: two sign glyphs fly together and vanish in a 3-frame radial flash (S02 equation).
- **NOISE-DEATH**: used once, in S05. Text loses contrast and its pixels random-walk. It is the only exit that doesn't drift: language itself dies.
- Never more than one narration line plus two HUD elements on screen at the same time.

### 2.4 Light, grain, vignette, bloom

- **Grain:** the global `FilmGrain` at 0.06 stays. Only S05 adds scene-local *content* noise, ramping to σ ≈ 6%, which is the subject of that scene and not a finish.
- **Vignette:** default 0.45. S01/S09 use a warm vignette `color="70,52,30"` at 0.35. S05 fades the vignette to **0**: at equilibrium even the vignette's gradient is gone. S07's thermal part uses no vignette, just FLIR corner brackets.
- **Bloom recipe (all scenes):** draw the emissive elements again into a 0.25-scale offscreen canvas, apply `ctx.filter = 'blur(10px)'` there, then composite with `'lighter'` at 0.5–0.8. Never use CSS blur on full-frame canvases.
- **Chromatic aberration means time is being tampered with.** It appears only during rewind or fast-forward (S01, S04, S05). It is never decorative.
- **Depth recipe:** background atmosphere (low-frequency, 0.25 scale) → subject → 20–40 foreground motes (radius 6–30 px, blurred, alpha .05–.15, 1.3× parallax). The motes change per scene: micro-bubbles in S01, stars in S04, photons in S06, droplets in S07, sand grains in S08, ink motes in S09. S02 and S03 have none, for clinical cleanliness.

### 2.5 Recurring motifs (each has a rule)

1. **点 The Point** (the low-entropy seed). Every scene opens on a point: the drop → the dot of 「？」 → ball → particle A → the arrow's tail / the Big Bang → the last gold point → the Sun → the vortex eye → footprint / soma → the final drop.
2. **线 The Line** (time's axis). Water surface → panel clocks → the zero row → the arrow (vertical: **future is up**, for the rest of the film) → Earth's limb → the footprint trail (walks upward) → the water surface again.
3. **枝 The Branch** (the shape of dissipation). Ink tendrils → glass cracks → cosmic-web filaments → leaf veins / river network → dendrites → ink tendrils.
4. **Timecode.** Whenever time is manipulated, a mono timecode appears at (90, 250): `◀◀ ×12  00:00:09:28`, `▶▶ ×10¹⁰⁰`. S08 shows it once more and it *fails* (red ✕): reality can't be rewound.
5. **S-gauge.** A 1 px vertical hairline at x = 64 with an 18 px tick and an italic *S* (Cormorant 30 px).
   - Rising is normal. Falling is shown in red `#FF3B5C` with jitter, and only happens in fakes and rewinds.
   - It appears in S01 (bloom, then red during the rewind), S04 (falls during the rewind, rises during the collapse), S05 (pegs at the top, then dissolves into the noise), S07 (two ticks: *S*身体 flat, *S*宇宙 rising) and S09 (keeps rising while the ink draws you).
   - This is the film's most compact piece of explanation.
6. **人 The Human.** Always `HUMAN_PATH` / `drawHuman`. It appears in S07 (made of flow), S08 (line and neurons) and S09 (ink).
7. **Colour meaning (fixed for the whole film):**
   - **Order Gold `#FFC94A`** = low entropy / free energy (the arrow, the last point, sunlight, the tracer particle, neurons).
   - **Waste Red `#FF3B2F`** = degraded energy / infrared.
   - **Law Cyan `#39E1FF`** = time-symmetric physics.
   - **Gravity Violet `#8E5BFF`** = the cosmic web.
   - Narration warm white `#F3EFE6` is the one constant, except in S05, where it fades to grey.

### 2.6 Palette ladder

| Scene | Base | Subject | Accent | Light |
|---|---|---|---|---|
| S01 | water `#F4EEE2`→`#E3D9C6`, air `#2B2824` | ink core `#0A0B10`, dilute `#3C4A6A` | text `#17151C`, em `#2E4A7A` | Backlit light table (transmission) |
| S02 | `#03070C`, grid `#0B2230` / `#12394A` | line `#39E1FF`, core `#E6FCFF` | reveal `#FF3B5C` | Self-emissive vector |
| S03 | `#070604`, grid `#1C1409` | amber `#FF9F2E`, pale `#FFE3A3` | special state `#FFFFFF`, strike `#FF5A36` | Flat graphic + scanline texture |
| S04 | `#02030A` / `#0B0F2E` | plasma `#FFE2B0` → `#FF7A3D` → `#A3271B`; web `#8E5BFF` / `#4D7CFF` | node `#D6E6FF`, arrow `#FFC94A` | Emissive volumetric |
| S05 | S04 → `#5C5C5C` ± 6% | — | the point `#FFC94A` | None. That is the point |
| S06 | `#04050B` | sun `#FFF7E0` / `#FFC94A` / `#FF8A1F`; Earth `#0A2742`, rim `#5BC8FF` | IR `#FF3B2F` → `#7A0E1A`; life `#FFC94A` → `#9EE06A` → `#2CC5A6` | Hard key light from the top (the Sun) |
| S07 | water `#021417` → `#04262B` | particles `#BDF4FF` / `#1FB5C9` | tracer `#FFC94A`; thermal = inferno `#000004 #1B0C41 #4A0C6B #781C6D #A52C60 #CF4446 #ED6925 #FB9B06 #F7D13D #FCFFA4` | Sensor (no "light", only temperature) |
| S08 | `#0A0705` | sand `#1A120B` / `#6E5235` / `#D9B27C` / `#F6DFB2` | neuron `#FFC94A`, tips `#FFF4D6` | Raking light from the right |
| S09 | per zoom level → cream `#F1EADB` | ink `#0B0D14`, dilute `#43506E` | gold `#FFC94A`, hairline `#FFF6E5` | Emissive → transmission (inversion) |

### 2.7 Escalation curve

Two axes rise across the film. **Physical scale** climbs from the drop to the universe (S01→S04), crashes (S05), then turns around and heads toward the self (S06→S08). **Emotional proximity** rises across S06–S09. S09 brings both to their maximum at once.

| Scene | New visual language | Scale | Count | Camera | Intensity |
|---|---|---|---|---|---|
| S01 | Macro photography, subtractive | 10⁻² m | 1 drop → 17 rings | Locked, micro push | 4 → **7** (rewind) |
| S02 | Blueprint / technical drawing | 10⁻¹ m | 2 → 10 → 400 → 70 shards | Locked split → push ×1000 | 5 |
| S03 | Data / Ikeda unit-vis | 10⁻³ → 10²¹ m | 4 → 16 → 1024 → 10³⁰ | FLIP → pan → exponential zoom | **7** |
| S04 | Emissive cosmic volume | 10²⁶ m, 13.8 Gyr | a continuous field | Dive + tilt + pull back | **9** |
| S05 | Entropy of the image itself | 10¹⁰⁰ yr | → 1 point | Static | **1** (deliberate trough) |
| S06 | Wave optics + double-entry ledger | 10¹¹ m | 1 → 20 → network | Tilt, follow, dive | 6 |
| S07 | Flow field + thermal sensor | 1 m | 25k | Two 3D 90° tilts | **8** |
| S08 | Tactile relief + growth | 10⁻² → 10⁻⁵ m | prints → grains → dendrites | Top-down → macro → pull back | 6 (intimate) |
| S09 | Synthesis + 水墨 | All | All motifs | Powers of ten, punch-ins, inversion | **10 → silence** |

### 2.8 Sound grammar (so the visuals have something to cut on)

- A rising Shepard tone means time going forward / zooming out. A falling Shepard tone means rewind.
- Every collision is a tick. 400 balls make a crackle.
- In S06 the score sonifies the physics: one high sine splits into 20 sines at 1/20 of the frequency, at equal total energy.
- S05: pink noise → white noise → −40 dB near-silence.
- S07: 60 bpm heartbeat and breath.
- S08: a delay echo locked to the neural pulse rings.
- S09: three hits on 星系 / 细胞 / 你, then a final drip, then silence.
- Each scene folder exports `cues.ts` (`[{f, kind}]`) so `score.py` can place sounds frame-accurately.

---

## 3. Scenes

### S01 墨滴 / The Drop (420f)

**Concept: a macro light table.** We look sideways through a tank lit from behind. The drop is a picture of a low-entropy state: all the ink in one place. The bloom shows the spreading. The rewind *shows* the impossible.

**What the image explains:** ink is rendered with Beer–Lambert absorption. Thick ink is near-black and thin ink turns blue-grey, so how far the ink has spread is visible as colour. The audience literally sees dilution.

**Composition:**
- The water surface is a silver hairline at y = 360, seen from slightly below.
- Above it: dim warm air with out-of-focus bokeh.
- Below it: cream backlight.
- The drop enters at x = 540. The vortex-ring cascade descends the centre column and decelerates, staying above y ≈ 1250 until line 3, so the caption lane at 1440 stays clean.
- Captions are in ink colour `#17151C` with no shadow. They are "ink" too.

**Choreography:**
- f0–12: on black, a point at (540, 360) stretches into the hairline. This is the loop point.
- f12–36: the light table fades on below the line. Micro-bubbles drift.
- f36–62: a teardrop falls with t² acceleration, stretching, with a specular highlight. Its inverted reflection (total internal reflection on the underside of the surface) rises to meet it.
- **f62 impact.** A damped ripple runs both ways along the line, with a 6–8 droplet micro-crown. 2 px camera shake. The push-in goes 1.00 → 1.06 over the rest of the scene.
- f62–290: the cascade.
  - The primary ring descends: `y(t) = 360 + V·τ·(1 − e^(−t/τ))`, from 360 to about 1050.
  - At f120 it splits into 4 child lobes (Widnall instability). At f180 each splits into 3 again.
  - Each child stays tethered to its parent by a thin stem, giving the classic "ink chandelier".
  - The dilute halo widens. The S-gauge rises.
- Captions:
  - C1 「一滴墨，落入水中。」 f50–150
  - C2 「你见过它散开——」 f155–245
  - C3 「却从没见过它，自己聚回来。」 f250–364, exit `none`. It is killed by the hard cut.
- f290–296: pause. A small ‖ and the timecode `◀◀ ×1` appear at (90, 250).
- **f296–356: REWIND.**
  - Speed eases from ×1 to ×12 and back to ×1.
  - Horizontal scan-tears: bands 6–40 px tall, shifted by a hash per frame.
  - RGB split up to 6 px.
  - The S-gauge falls, in red.
  - The ink un-blooms, the rings rise and merge, the stems retract, ripples *converge* inward, and the drop leaps out to y = 200 and decelerates.
- f356–364: **the drop hangs in mid-air above a perfectly still surface.** Total silence.
- f364: hard cut to black.
- f366–404: 「为什么？」 in Serif 200, 120 px, centred at (540, 900), entering by a 6-frame fade.
- f404–419: 「为什么」 and the hook of 「？」 diffuse. **Only the 「？」 dot remains.**

**IN:** pure black (the same as S09's OUT).
**OUT:** black, with one `#F3EFE6` dot (r = 9) at `Q_DOT`.
- Don't trust the glyph metrics. Draw 「？」 in canvas, clipped above its dot, and draw the dot as a circle at the constant `Q_DOT`, roughly (720, 946); measure it once from a still.
- S02 imports the same constant.

**Implementation:**
- **Ink shader** (`ShaderLayer`, scale 0.5):
  - Density ρ = the sum over at most 24 ring primitives (uniform float array, 5 floats per ring: x, y, R, strength, age).
  - Each ring seen from slightly above is an ellipse band: `d = abs(length((p−c)/vec2(R, .28R)) − 1.)*R` and `ρ += s*exp(−d²/w²)`. Add a tether capsule to the parent.
  - Domain-warp p by 3-octave fbm, with amplitude growing ∝ √age (this is the diffusion).
  - Colour: `col = paper * exp(−ρ * vec3(2.3, 2.05, 1.55))`, which gives blue-grey dilution for free.
  - Rewind: evaluate at `t_eff(frame)`, which runs backward. RGB split re-samples ρ at ±6 px for R and B *only during f296–356*, with fbm cut to 2 octaves while it's on (the motion hides it).
- **Filaments** (`CanvasLayer`, `multiply`):
  - 500–600 polylines precomputed in `memo`. Seed them on the ring rims and integrate 60 steps of curl noise in each ring's local frame.
  - Draw a growing prefix of each line at 0.7 px width and alpha 0.12.
  - The same function of t means the rewind is free.
- The ring tree (generation, spawn time, angle) comes from `mulberry32` in `memo`.
- Surface ripple: `A·e^(−kt)·sin(k|x−540| − ωt)` along the line.
- Budget: about 450 ms per frame.

**Wow:** the ink un-blooms, the ripples run *inward*, and the drop hangs above the water, then the frame snaps to black and 「为什么？」.

---

### S02 对称 / Symmetry (660f)

**Concept: a forensic blueprint lab where the viewer is the judge.** Two stacked panels each show the same event, and one of them is reversed. As N grows, telling them apart goes from impossible to absurdly obvious, but *only because the run starts ordered*.

**What the image explains:**
- An equation shows that the law of motion is unchanged when t → −t.
- The guess meter measures how much evidence of direction there is: ~0 for 2 balls, total for 400 balls and the glass.

**Composition (9:16 suits a vertical stack, not side-by-side):**
- Panel A: (90, 240)–(990, 760). Panel B: (90, 900)–(990, 1420). Each is 900×520, a good billiard aspect.
- The gutter (y 770–890) holds the guess meter and the equation.
- Narration at y = 1520.
- Each panel has a mono clock `t = +02.40 s`. B's clock reads `t = ??.?? s` until the reveal, then runs backward in red.

**Choreography:**
- f0–20: the `Q_DOT` dot pulses and divides like a cell. One copy glides up into A, the other down into B.
- f10–45: the grid reveals radially from `Q_DOT`. Panel frames draw on (SVG stroke-dashoffset). 「A」「B」 type on, with corner ticks.
- f40–140: two balls collide in each panel. A plays forward, B reversed. Cyan trails, and a ring-burst at the moment of contact.
  - C1 「哪一段，是倒放的？」 f40–135
  - Meter: a two-sided bar 「A 倒放 50% | 50% B 倒放」 with a big 「?」.
- C2 「分不出来。」 f138–195.
- f150–290: **equation (gutter).**
  - `m·d²x/dt² = F(x)` in Cormorant italic.
  - Every *t* becomes (−*t*). The denominator becomes d(−t)². The two minus signs fly together and **ANNIHILATE**, leaving the equation unchanged.
  - Stamp 「t → −t：不变」.
  - C3 「在微观世界，物理定律\n不区分过去和未来。」 f198–330.
- f200–290: N = 10 (HUD `N = 10`). The meter wobbles between 48 and 52.
- **f290–400: N = 400, starting as a dense disc** (r = 60, the drop's size, at the left third).
  - A bursts outward.
  - B: a scattered gas *condenses into a perfect disc*.
  - The meter slides to 96%, the big 「?」 becomes 「!」.
  - f385: red stamp `B ◀◀ 倒放`.
- f400–500: **the glass.**
  - A blueprint wine glass, with construction lines and a dimension mark `Ø 78 mm`, falls and shatters at f430 into about 70 Voronoi shards with spark particles.
  - B: the shards leap up and fuse. At f470 the last crack heals with a white flash.
  - The meter reads 「!!」 at 100%.
  - C4 「方向，出现了。」 f405–485.
- f488–600: the camera pushes into one shard in A, with scale labels `×20 → ×1000`. The shard becomes a lattice of jiggling atoms, and each pair-collision is symmetric.
  - C5 「时间之箭不在单个粒子里，\n而藏在"很多"之中。」 f490–630.
- f560–630: the lattice multiplies into a field of thousands of cyan dots ("很多").
- f630–659: the field dims until 4 dots remain. A box and divider draw around them.

**IN:** black, the `Q_DOT` dot.
**OUT:** `#03070C`, grid at 20%, the box `BOX = (190, 700)–(890, 1100)`, a divider at x = 540, and 4 cyan dots (r = 10) at fixed coordinates `P4[]`, all in the left half.

**Implementation:**
- **Hard-disc simulation** in `memo`:
  - dt = 1/240 s, 8 substeps per frame.
  - Uniform-grid broadphase (cell = 2r), elastic impulse response, wall reflection.
  - 400 balls × 110 frames is about 90k floats, precomputed in under 200 ms.
  - Panel B simply indexes `T − f`. Reversal is exact by construction.
- Trails: segments over the last 10 stored frames with decaying alpha, `'lighter'` blending. The core is a 3 px circle with a halo drawn on the 0.25-scale bloom canvas.
- **Voronoi shatter:**
  - The glass silhouette is a polygon. About 70 seeds, denser near the impact point.
  - Each cell = the silhouette clipped by the half-planes of its neighbours (O(n²) clip, fine for n = 70).
  - Shard motion is closed-form: `c + v·τ(1−e^(−t/τ))` for the slide, plus a parabolic hop, plus `ω·t` rotation.
  - Stroke `#39E1FF` with an 8% fill. Crack lines flash white for 3 frames at the moment of breakage.
- Equation: absolutely positioned spans with FLIP interpolation. The minus signs are separate spans.
- Budget: about 250 ms per frame.

**Wow:** in B, 400 particles of gas spontaneously condense into the ink-drop disc, and then the glass heals with a flash. The viewer *feels* the arrow appear.

---

### S03 数一数 / Counting (1080f)

**Concept: the histogram is made of worlds.** Every microstate is a drawn object, so the histogram is literally a pile of microstates (a unit visualisation). Then a lottery machine that never wins, then a number so long it outgrows the galaxy.

**What the image explains:**
- Counting arrangements *is* entropy.
- Probability concentrates as N grows (the bell becomes a needle).
- Scale: a single probability, written out, is a line longer than the Milky Way.

**Composition:**
- Box at y 700–1100.
- The 4×4 microstate grid spans y 300–1300.
- Histograms sit on a baseline at y = 1250. The tallest column (252 barcodes × 4 px) is about 1000 px, so the vertical frame is perfect for it.
- The zoom's horizontal row of zeros runs at y = 960. In the final framing the galaxy sits *on* the line and the line spans the full safe width.

**Choreography:**
- f0–8: colour-temperature flip, cyan → amber, on a 「咔」 SFX.
- f0–60: labels `A B C D` type on next to the dots. HUD `N = 4`.
  - C1 「把4个粒子放进盒子。」 f10–100.
- f55: the divider slides up and out. Clack.
- f60–150: closed-form gas. Live HUD `左 3 · 右 1` updates.
- f150–200: the box clones itself into **16 mini-boxes**, one per arrangement (every L/R combination of A–D).
- f200–270: FLIP into 5 columns by number-on-left (0…4).
  - Big numerals `1 4 6 4 1` (Cormorant 600, 96 px) drop onto the columns.
  - The all-left box gets a white ring. The 6-column glows.
  - HUD (Sans): 「全在左边：1 种」「左右各半：6 种」. No narration; the picture says it.
- f300–400: **Galton rain, N = 10.**
  - 1024 barcodes (10-bit, 72×3 px, filled bit = left) fall into 11 columns.
  - Counts type on: `1 10 45 120 210 252 …`. HUD `2¹⁰ = 1024 种排列`.
- f400–470: **N = 100.**
  - The columns compress and the bell sharpens into a needle at 50%.
  - A leader line from the far-left tail to a callout: `全在左边：1 / 1 267 650 600 228 229 401 496 703 205 376` (2¹⁰⁰ written out in full, in mono).
- f420–560: **the lottery**, behind the needle at 25% opacity.
  - A waterfall of 100-bit rows. A target row (all bits lit) is pinned at the top.
  - HUD: `TRIALS 4.4×10²⁹ (138亿年 × 10¹²/s) · HITS 0 · BEST 71/100`.
  - The waterfall reads as uniform grey shimmer, which **foreshadows S05**: maximum entropy looks like grey noise.
  - C3 「100个粒子全挤在左边：\n概率约 10⁻³⁰。」 f410–530.
- f530–660: the needle's barcodes fly into **S = k log W** (Cormorant 600 italic, 200 px, centred at y = 820).
  - **The W is built from the barcodes themselves**: W is drawn with the microstates it counts.
  - Gold-leaf gradient `#FFE3A3` → `#B8691A`, with a slow specular sweep.
  - Mono subtitle `L. BOLTZMANN · WIEN, ZENTRALFRIEDHOF`.
  - STRIKE: 「熵 ≠ 乱」 → 「熵 = 数」.
  - C4 「熵，数的就是：有多少种微观排列，\n看起来一模一样。」 f535–670.
- f660–700: the formula fades to the mono line `P = 0.000000000…` (64 px) at y = 960. The camera starts *riding* along it; the digits motion-blur.
  - C5 「一杯水，约有10²⁵个分子——」 f665–750.
- f700–960: **exponential zoom-out.**
  - z (log₁₀ of the metres across the screen) goes from −2.5 to 21.6, eased in and out.
  - Line-art context layers fade in and out: mm ruler → desk (1 m) → city grid (10⁴) → Earth (10⁷) → Earth–Moon (10⁹) → orbits (10¹³) → Oort dots (10¹⁶) → stars (10¹⁸) → Milky Way spiral of amber dots (10²¹).
  - Odometer `10ⁿ m` at (90, 1590). A rising Shepard tone.
  - C6 「每个零只占1毫米——\n这一行，也比银河系还长。」 f755–895.
- f960–1040: **hold.** The galaxy (about 380 px) sits on the line, which runs x 90 → 990.
  - Blueprint dimension lines: `银河系 ≈ 10⁵ 光年` and `这一行 ≈ 2.6×10⁵ 光年`.
  - C7 「墨会散开，不是因为不能聚回来，\n而是散开的方式，多到无法想象。」 f898–1075, stagger 1. This is the answer to 「为什么？」.
- f1040–1079: everything fades except the line, whose glow intensifies.

**IN:** S02's OUT, in amber.
**OUT:** `#070604` with a single 2 px line `#FF9F2E` (with glow) from (90, 960) to (990, 960).

**Implementation:**
- The gas is closed-form `fold(x0 + vx·t, L)`.
- 16-state FLIP: each mini-box has a grid position and a column position; lerp with `ease.inOutCubic`, staggered by index.
- Galton rain: `y = min(y_land, y0 + ½g(t−t_i)²)` plus a 2-frame squash. Landing order sorted by column fill.
- Lottery: write a 100×320 `ImageData` (bit = `hash01(row + frame·320, bit) > .5`) and upscale it with `imageSmoothingEnabled = false` into 900×1280. That gives crisp 9×4 blocks at about 2 ms. BEST = the maximum popcount, computed per frame.
- Barcodes → formula: `sampleText('S = k log W', '600 italic 200px Cormorant…')`, with the W glyph's points assigned to the barcode particles.
- Zoom:
  - `pxPerM = 1080 / 10^z`.
  - Zeros are drawn from a cached "0" sprite while each is ≥ 14 px wide, become a dotted line between 14 and 2 px, then a solid line.
  - Each context layer has a characteristic length L and alpha = a log-space bell around `log10(L) ≈ z − 0.3`.
- Split into `gas.ts`, `states.tsx`, `lottery.ts`, `zoom.ts`. This is the heaviest scene in lines of code.
- Budget: about 300 ms per frame.

**Wow:** the zero row zooms out past the desk, the city, the Earth and the solar system, and the galaxy ends up *sitting on a single probability*.

---

### S04 时间之箭 / The Arrow (840f)

**Concept: fly the arrow backward.** The zero row becomes the arrow of time, turned vertical (future is up). The camera dives down its shaft into the past, which becomes a rewind of cosmic history, until it hits the hot, uniform floor of time. Then the twist: gravity makes "uniform" the *ordered* state, and the universe collapses into the cosmic web, shedding light as it does.

**What the image explains:**
- Vertical position is time.
- The S-gauge falls as we rewind.
- The miniature box experiment shows why uniform is low entropy under gravity.
- Every clump *radiates sparks*: the entropy produced by clumping is visible as light. This seeds S06.

**Composition:**
- The arrow runs up the centre (x = 540, y 260 → 1650).
- A log year-ruler at x = 110, labels on the left.
- The Penrose tower stacks vertically, using the 9:16 frame.
- Captions at 1440, with `shadow`.

**Choreography:**
- f0–40: the line grows an arrowhead, rotates −90° about its centre, and extends to full height. Amber shifts to Order Gold. Gold dust streams *up* along it.
  - C1 「所以，时间的方向，\n就是熵增加的方向。」 f15–140.
- f140–200: the stream stalls and reverses. The tail glows. The dive begins: content scrolls upward.
  - C2 「那么——过去的熵，一定更低。」 f145–245.
- **f195–420: REWIND THE UNIVERSE.**
  - Timecode `◀◀` plus a year odometer: `−1 天 → −1 年 → −1 万年 → −1 亿年 → −50 亿年 → −138 亿年`.
  - A foreground spiral galaxy un-merges into two (f200–280).
  - Stars un-light, shrinking into glowing gas knots (f260–340).
  - The web un-collapses: filaments thicken and smooth out (f300–400).
  - Everything warms to plasma (f360–420). The S-gauge falls (red), with a falling Shepard tone.
- f420–520: **the floor of time.** A near-uniform orange glow with faint mottling (HUD `涨落 ×10⁵ 放大`).
  - The Penrose **power tower** rises: `10` (360 px, y ≈ 1250), then exponent `10` (180 px, y ≈ 980), then `123` (110 px, y ≈ 790). The camera tilts up the tower. HUD `PENROSE · 1 / 10^10^123`.
  - C3 「宇宙的起点，熵低得不可思议。」 f420–515.
- f520–620: **the miniature.** Two boxes at y 300–680.
  - Left, 「无引力」: a uniform gas with the S tick near the top.
  - Right, 「有引力」: the same uniform gas collapses into a ball spraying sparks while its S tick climbs.
  - C4 「可那时的宇宙几乎完全均匀——\n而对引力来说，均匀恰恰是低熵。」 f518–680, stagger 1.
- **f600–780: THE COLLAPSE at full scale.**
  - Voids darken and filaments sharpen.
  - Nodes **ignite** as blue-white flashes with 4-point diffraction spikes.
  - Photon sparks radiate from every clump.
  - The odometer runs forward: `38万年 → 2亿年 → 10亿年 → 138亿年 → 现在`.
  - The camera pulls back 1.0 → 0.8 with a 6° roll. The S-gauge rises. A deep swell.
  - C5 「宇宙从此一路滚落——\n你经历的每个"之后"，都是其中一段。」 f683–838.

**IN:** S03's OUT line.
**OUT:** the lit cosmic web, with the clumpiness parameter c = 1, all nodes ignited, zoom 0.8, roll 6°, odometer `现在`. Parameters are frozen as `WEB_FINAL`.

**Implementation:**
- **Web shader** (scale 0.5): two layers of Voronoi.
  - `ridge = 1 − smoothstep(0., w(c), F2 − F1)`.
  - `field = mix(.5 + .04·fbm(p·3), ridge², c)`.
  - Nodes: `exp(−F1²/σ²)` at sites whose `hash > 1 − ignite`.
  - Colour: `mix(webRamp(field), plasmaRamp(field), 1 − c)`.
  - fbm limited to 3 octaves.
- **A JS replica of `hash22`** gives the Canvas layer the node positions, for the ignition spikes and photon sparks. Float differences between GLSL and JS stay below a pixel.
- Galaxies (Canvas, about 5k particles each):
  - Exponential disc `r = −h·ln u`, log-spiral arms `θ = θ₀ + ln(r)/tan(pitch)`, flat rotation curve `θ += (v/r)·t`.
  - Centres on a parabolic approach, with tidal smear proportional to proximity.
  - Played with t decreasing.
- Power tower: DOM spans with transforms. Odometer: the HUD component.
- Budget: about 600 ms per frame (the shader dominates). Use `scale = 0.5` and the bloom canvas at 0.25.

**Wow:** the uniform plasma *condenses* into the lit cosmic web, every node flashing awake and spraying light.

---

### S05 热寂 / Heat Death (360f)

**Concept: the image itself reaches equilibrium.** The scene doesn't *show* heat death, it *performs* it on the picture. Every pixel random-walks, so contrast, colour and even the vignette diffuse into the uniform grey noise the audience already met as S03's maximum-entropy shimmer.

**What the image explains:** a random walk produces uniformity. No gradients means no flow, so even the text can no longer hold its shape.

**Composition:** start on S04's composition and let it dissolve. 「热寂」 at centre, nearly invisible. The final gold point at (540, 820).

**Choreography:**
- f0–40: fast-forward. `▶▶` timecode, exponent odometer `10¹⁰ → 10¹⁴ 年`, radial streaks on the stars, a small RGB split.
  - C1 「一直滚下去呢？」 f6–80.
- f40–130: the stars die in hash order: redden, dim, go out. HUD 「10¹⁴ 年 · 最后的恒星熄灭」 types at f55.
- f120–190: black discs with thin photon rings take the place of the bright clusters. Each evaporates in a pin-prick flash. HUD 「10¹⁰⁰ 年 · 黑洞蒸发」 at f130.
- **f150–260: THE IMAGE DIFFUSES.**
  - Per-block random walk with amplitude ∝ √(t − 150). Saturation and contrast go to 0. The vignette goes to 0. Content noise rises to σ ≈ 6%.
  - The S-gauge pegs at the top, then the gauge itself random-walks away.
  - C2 「处处同温，\n再没有什么能够发生。」 f165–270. Its colour drains from `#F3EFE6` to `#9A9A9A` over its life.
- f270–318: 「热寂」 in Serif 200, 160 px, only 7% brighter than the background. It appears as a faint contrast bump, then its pixels random-walk into the noise (NOISE-DEATH). Audio at −40 dB.
- f300: **one gold point** `#FFC94A`, r 2.5 → 4, flickers on at (540, 820) with irregular hash-driven flicker. It is the only saturated pixel in the frame.
  - C3 「但在下坡路上——」 f305–355, in *warm* white again (the voice regains its colour), with a 10-frame fade exit.

**IN:** `WEB_FINAL`.
**OUT:** a `#5C5C5C` ± 6% boiling noise field with the gold point (r = 3.5) at (540, 820).

**Implementation:**
- Copy the web shader (from the shared lib, ideally) with an extra uniform `u_eq`.
  - Displaced sampling: `p' = p + (hash22(floor(p·g) + floor(t·k)) − .5)·A(t)`.
  - Average 2 taps (gives a blur for free). Desaturate, mix toward the mean, add per-pixel hash noise that changes every frame.
  - Run at scale 0.35, since the content is going to grey anyway.
- Black holes, flashes and the gold point are drawn in Canvas.
- Budget: about 350 ms per frame.

**Wow:** the picture itself dies into the noise, and then one gold pixel.

---

### S06 阳光的账本 / The Sun's Ledger (660f)

**Concept: double-entry bookkeeping in light.** The vertical frame becomes a ledger: the Sun at the top (income), the Earth at the bottom, deep space between them (where entries are written).

**What the image explains:**
- One short, tight gold wave packet with **20 crests** comes in.
- It **unzips**: each crest peels away and stretches into its own long red wave.
- So 20 one-crest packets leave. Energy (crests) is conserved, but the number of photons is multiplied by 20. E = hf, and counting, both visible.

**Composition:**
- The Sun's lower limb spans the top: centre (540, −60), r = 420.
- The Earth's limb rises from the bottom: centre (540, 2600), r = 1100, top edge at y ≈ 1500, with an atmosphere rim glow.
- Ledger UI between them: mono columns 「收入 IN」 at the left and 「支出 OUT」 just inside the right safe margin, with thin ruled lines and a double underline under the totals (the accounting convention for a final balance).
- Counter `1 → 20` at (540, 760).

**Choreography:**
- f0–45: the gold point rises and swells into the Sun. Colour floods back *radially* out of the grey, like a light returning to the world.
- f30–80: the Earth's limb rises in. The ledger draws on.
  - C1 「地球吸收多少能量，\n就向太空送回多少。」 f50–180.
  - Energy bars: IN ≈ OUT, `240 W/m²`. Continuous gold rain comes down and a dull red haze goes up.
- f180–245: the ambient streams dim. **One gold photon** (a 200 px packet with 20 crests) descends, and the camera follows with a slight push-in.
- **f245: impact.** A small flash on the limb.
- **f245–310: UNZIP.** The crests peel apart and each one stretches 20× into a lazy red wave. 20 packets fan upward in all directions. Counter `1` (gold) → `20` (red), Cormorant 140 px. Sound: one high sine splits into 20 low ones.
  - C2 「每收进1个可见光光子，\n地球就送走约20个红外光子。」 f185–350, stagger 1.
- f350–460: ledger lines type on: `能量 1 = 1` / `光子 1 → 20` / `熵 1 → ≈20` (double-underlined).
  - A counting callback: ghosted alternative fans flicker behind the real one, labelled 「排列方式：极多」.
  - C3 「能量相同，熵，却多了约20倍。」 f352–460.
  - C4 「地球收进"秩序"，送出"混乱"。」 f463–565.
- f470–659: **dive to the surface.**
  - The incoming gold flows into a top-down vein network (leaf → river-delta-like).
  - Flow dashes travel toward a central sink. Every junction sheds faint red IR sparks: the entropy tax, paid at each step.
  - The main channels curl into a spiral converging on (540, 860).
  - C5 「这笔差额，养活了一切。」 f568–655.

**IN:** S05's OUT.
**OUT:** `#04050B`, with gold → green streams spiralling into (540, 860), r ≈ 420, and red sparks escaping outward.

**Implementation:**
- Sun: Canvas radial gradients plus limb darkening `I = 1 − 0.6(1 − μ)`, with a memoised noise canvas overlaid for granulation (no shader needed).
- Photons: `p(s) = p0 + d·s + n·A·sin(k·s − ω·t)·env(s)` drawn as polylines with `'lighter'` plus the bloom copy. Gold uses k = 20k₀, red uses k₀. Unzip: crest i's segment is lerped toward its own outgoing ray.
- Network: **space colonization** (Runions 2005) in `memo`, 1500 attractors, under 300 ms.
  - Width by Murray's law: `r³ = Σ rᵢ³`.
  - Flow shown with animated `lineDashOffset`.
  - Spiral sink: rotate the end-segment field by `θ += k / r`.
- Budget: about 250 ms per frame.

**Wow:** the gold photon unzips into twenty red ones, and the ledger balances its energy while the entropy column explodes.

---

### S07 涡旋 / The Vortex (900f)

**Concept: a shape that stays while everything flows.** First a whirlpool of about 25k particles, with one gold tracer passing through. Then the vortex *stands up* and becomes you. Then a thermal camera reveals you glowing at 100 W.

**What the image explains:**
- A "long exposure" toggle: with trails off, there's only chaos; with trails on, the shape snaps back. The shape is a *statistic of the flow*.
- Turnover colouring: each particle is tinted by the time since it entered. The body's colours cycle completely while its outline never changes.
- Ordered gold streams enter, disordered heat speckles leave.

**Composition:**
- Top-view vortex at (540, 860), r = 430.
- Side-view funnel spanning y 300–1500.
- Human: height 1150, feet at y = 1480, cx = 540.
- FLIR UI: brackets, crosshair `SP1 36.6°C` on the chest, colour bar at x = 60–80 (y 500–1300) on the *left*, away from the platform buttons.

**Choreography:**
- f0–40: the streams become a particle whirlpool. Teal water bleeds in; gold stays as the inflow. HUD `WHAT IS LIFE? · E. SCHRÖDINGER · 1944`.
  - C1 「1944年，薛定谔说：\n生命以"负熵"为食。」 f30–165.
- f150–330: **the tracer.** A gold particle with a comet tail enters at f170, makes 4 turns, and leaves through the eye at f300. A residence timer `停留 04.3 s` rides beside it.
  - Trails OFF f220–250 (the vortex vanishes into noise), ON again at f250.
  - C2 「漩涡的形状一直都在，\n水却没有一滴停留。」 f172–310.
- **f310–380: 3D tilt.** Top view → side view. The whirlpool becomes a vertical funnel.
  - C3 「你也是。」 Serif 900, 110 px, at (540, 1450), f330–395.
- **f380–520: the funnel stands up into the human.**
  - Particles retarget bottom-up to points inside `HUMAN_PATH`. Inside the body they keep circulating.
  - Turnover tint (fresh = gold, old = deep teal) cycles. Odometer `第 0 天 → 第 90 天`.
  - C4 「你体内大部分的原子，\n几个月前还不在这里。」 f398–535.
- **f540–580: THERMAL SWITCH.**
  - A scan line sweeps down, converting everything above it to inferno. FLIR click.
  - A convection plume rises from the head. Breath puffs every 4 s. HUD `≈100 W` with a line-art bulb at (90, 300).
  - C5 「此刻，你正以约100瓦向宇宙散热——\n像一只亮着的灯泡。」 f545–710.
- f710–800: laminar gold streams enter at the mouth. Heat speckles leave across the whole skin. HUD `IN 有序 · OUT 无序` and S-gauge twin ticks (*S*身体 flat, *S*宇宙 rising).
  - C6 「你吃进秩序，排出混乱。」 f712–800.
- f800–899: C7 「你不是一个东西，\n你是一个过程。」 f800–898. The second line lands 20 frames later, weight 900, in gold.
  - f840–885: the figure dissolves upward as heat. **Two footprints of residual heat stay on the floor.**
  - f860–899: a second 3D tilt, down to a top view of the floor.

**IN:** S06's spiral.
**OUT:** top view, cold floor `#05030F`, two inferno footprints (yellow-orange cores, 150 px long, toes pointing up). Left at (500, 990), right at (582, 950). Constants `FEET`.

**Implementation:**
- **Closed-form free vortex.**
  - `r(t) = r₀·e^(−t/T)`, `θ(t) = θ₀ + (Γ·T / 4π r₀²)(e^(2t/T) − 1)`.
  - Rankine core: solid-body rotation for r < r_c.
  - Height `h = H·(1 − r/r₀)^0.7`.
  - Particle i has a birth phase: `age = (t − bᵢ) mod life`. Trails are free: draw the segment from `p(t − Δ)` to `p(t)`.
- **3D tilt:** rotate (r cos θ, h, r sin θ) about the x axis by α(t), from π/2 to 0, with perspective f = 1400.
- **Body flow:** `sampleShape('human', …, step 5)` gives about 12k targets. Each particle runs mouth → target → nearest skin point → outward drift with curl noise and upward buoyancy. All parametric in its age.
- **Thermal:**
  - Splat the particle density plus a `drawHuman` core-warm gradient into a 270×480 offscreen canvas. Blur it there.
  - Map through a 256-entry inferno LUT with `getImageData` (about 2 ms), then draw it upscaled with smoothing.
  - No WebGL needed. Draw everything synchronously in the draw callback.
- Particle draw: 2×2 `fillRect`, batched into 8 colour buckets.
- Budget: about 400 ms per frame.

**Wow:** the whirlpool tilts 90° and *stands up as a person*, who then lights up like a bulb on the thermal camera.

---

### S08 记忆 / Memory (660f)

**Concept: traces only point backward.** The footprints walk up the screen (toward the future, as established in S04). Each new print appears only *behind* the present. The sand ahead is pristine and unwritten. Then the trail becomes an axon and memory grows as branching light.

**What the image explains:**
- Labels on the prints: `−4 s · −3 s · −2 s · −1 s · 现在`, then 「未来 · ？」 over clean sand.
- Erosion is shown as diffusion: print depth decays as `e^(−age/τ)`, and edges soften ∝ √age.
- A macro shot shows a print scattering grains, then the `◀◀` HUD tries to rewind it and **fails** (red ✕).

**Composition:**
- Top-down sand under raking light from the right.
- The trail is an S-curve from (540, 1500) to (540, 300).
- The neuron blooms in an oval around (540, 700). The pull-back ends on a gold-line human: height 1300, feet at y = 1610, the network glowing in the head.

**Choreography:**
- f0–50: the thermal prints cool through the inferno ramp (yellow → orange → red → purple) while the sand material crossfades in. They become depressions in the heightfield; the palette goes to sepia.
  - C1 「最后：为什么你只记得过去，\n不记得未来？」 f20–155.
- f60–330: **the walk.** A print every 22 frames, alternating left and right, each with a puff of grains. Wind streaks cross right → left. The labels type on.
  - C2 「脚印，只指向过去。」 f160–245.
- f250–390: **macro ×6** on the newest print. Grains are shaded dots; they scatter, collide and settle, with a faint heat shimmer. The HUD `◀◀` tries for 8 frames, glitches, and fails: `✕ 不可逆`.
  - C3 「因为留下痕迹，\n本身就是一次不可逆的熵增。」 f250–390.
- f390–480: pull back and rotate. The trail becomes a string of glowing gold beads (synaptic boutons) along an axon. The sand fades to `#0A0705`. Dendrites grow from the beads like branching lightning, with white-hot growth tips.
  - C4 「记忆，也是一种脚印。」 f395–480.
- f480–659: the network fills the oval. Echo pulse rings spread from the soma, locked to the delay in the score. Pull back to reveal the network inside the gold-line figure's head. Pulses run down the body: the echo inside you.
  - C5 「你感受到的"时间在流逝"，\n正是熵增在你身体里的回声。」 f485–658.

**IN:** `FEET` (thermal).
**OUT:** `#0A0705`, the gold-line human (height 1300, feet at 1610), the neural network glowing in the head, a pulse mid-flight. Constant `FIGURE_S08`.

**Implementation:**
- **Sand heightfield shader** (scale 0.5):
  - `h = ripples(sin(dot(p, dir)·k + 3·fbm)) − Σ printᵢ(p)·dᵢ(age)`.
  - Print SDF = smooth union of a heel ellipse, a ball ellipse and 5 toe discs, with a raised rim.
  - Normal from central differences (3 height evaluations). Lambert shading under raking light, plus hash glitter.
  - Prints passed as `uniform float u_p[64]` (16 × [x, y, angle, age]). In GLSL ES 1.0 the array can only be indexed by a loop index.
- Grains and wind: Canvas.
- Dendrites: space colonization in `memo` (the same module as S06), rooted on the bead positions.
  - Reveal by growth index. Lightning jitter from precomputed midpoint displacement.
  - Pulses travel along branches via dash offset.
- Budget: about 450 ms per frame.

**Wow:** footprints appear *only behind you*, the sand ahead stays untouched, and the rewind icon tries and fails.

---

### S09 墨的形状 / The Shape of Ink (720f)

**Concept: one network, every scale, one ink.**
- A powers-of-ten pull-back where neurons, city lights and the cosmic web dissolve into one another by topological rhyme.
- Three punch-ins.
- The camera tilts up to the sky, and the sky **inverts**: the cosmic web becomes ink in water, and we're back in S01's tank.
- The ink, flowing, draws you as a 水墨 figure and keeps diffusing.

**What the image explains:**
- Inversion shows the universe and the ink drop are *the same process*.
- The S-gauge keeps rising while the figure forms, so it is order built through flow, not reversal.

**Composition:**
- Zoom anchored at (540, 900).
- Punch-in words centred at y = 1450, Serif 900, 140 px.
- Ink figure: height 1150, head at 330, feet at 1480.
- Title centred at (540, 960).

**Choreography:**
- f0–190: **pull back.**
  - Figure (1 m) → a warm dot in a sodium-lit city grid → city clusters on Earth's night side with an atmosphere rim → the Earth a pale dot with orbit lines → the Milky Way → **the cosmic web from S04**.
  - Odometer `10ⁿ m`, mirroring S03. A rising Shepard tone.
  - C1 「在滚向平衡的路上，宇宙在一些角落，\n暂时堆起了秩序——」 f15–190.
- **f190–285: the triplet.** Hard cuts, each with a 2-frame flash and a 1.12 → 1.0 settle, on three hits in the score:
  - f192: a galaxy + 「星系。」
  - f222: a cell (translucent membrane, gold organelles) + 「细胞。」
  - f252: the gold human + 「你。」
- f285–400: the figure stands in the lower third (height 700). The camera tilts up into the starry web.
  - C2 「然后，这些秩序抬起头，问：\n时间是什么？」 f290–420.
- **f400–470: INVERSION.** The web goes negative into Beer–Lambert ink on cream. A water-surface hairline fades in at y = 300. The filaments drift downward as ink tendrils.
  - C3 「墨，终将散开。」 f455–520 (ink colour from here on).
  - C4 「但在散开之前——」 f522–585.
- **f520–640: THE INK-WASH HUMAN.** Tendrils flow *along* the contour. Never a dense blob. The S-gauge rises throughout.
  - C5 「它画出了你。」 f588–660.
- f640–700: the figure softens into grey clouds. The title 「熵 · 时间 · 生命」 (Serif 600, 96 px, tracking .3em, ink colour) condenses from the ink and immediately begins to diffuse.
- f690: **a new drop** falls through the surface. Drip SFX.
- f700–719: the light table switches off: cream → black. Only the hairline remains, which contracts to a point and is gone on f719. Silence.

**IN:** `FIGURE_S08`.
**OUT:** pure black, the same as S01's IN.

**Implementation:**
- Zoom: `z(t)`. For each costume level k with `|z − k| < 1`, draw at `scale = 10^((k − z)·Lk)` with a log-space alpha bell, plus a light radial streak blur on the 0.25-scale canvas.
- Costumes:
  - Neurons: the S08 module.
  - City: perturbed grid plus radial avenues, with lights along the edges.
  - Earth: a disc with fbm-thresholded light clusters.
  - Galaxy and web: the S04 modules.
- Inversion: the web shader gains `u_invert`: `mix(webCol, paper·exp(−luma·vec3(2.3, 2.05, 1.55)), k)`.
- The ink particles take over over 30 frames, seeded on JS-replicated web edges.
- **Ink-wash figure:**
  - `sampleShape` of the `HUMAN_PATH` *stroke* (lineWidth 14) gives the contour targets.
  - `pos = mix(diffuse_i(t), target_i + curl, w(t))` with w peaking at **0.7**, never 1.
  - Only about 35% of particles take part. The rest keep diffusing.
  - Draw with `multiply` plus a blurred halo copy (墨晕).
- Title: `sampleText`, with the same flow treatment.
- Budget: about 500 ms per frame.

**Wow:** the cosmic web turns negative and becomes ink in water, and the ink, still spreading, draws you, then lets you go.

---

## 4. Handoff chain (shared constants, verified with stills)

| Cut | OUT frame of A | IN frame of B | Type |
|---|---|---|---|
| S01→S02 | Black, `Q_DOT` dot `#F3EFE6` r = 9 | Same dot, tints cyan over 8f, divides into A/B | Position match |
| S02→S03 | `BOX` + divider + 4 dots `P4[]`, cyan | Identical, amber, "咔" | Colour-temperature flip |
| S03→S04 | Amber line (90, 960)–(990, 960) | Line grows an arrowhead, rotates vertical | Morph |
| S04→S05 | `WEB_FINAL`, odometer 现在 | Identical; odometer continues forward | Continuous shot |
| S05→S06 | Grey noise + gold point (540, 820) | The point swells into the Sun; colour floods back | Point → star |
| S06→S07 | Gold spiral sink at (540, 860), r 420 | Particle whirlpool, same geometry | Pattern match |
| S07→S08 | Top view, thermal `FEET` | Same prints cool into sand | Material/temperature dissolve |
| S08→S09 | `FIGURE_S08` (gold human, neural head) | Same, starts the pull-back | Continuous shot |
| S09→S01 | Black (the hairline has collapsed) | Black → a point → the hairline | **Seamless loop** |

Check each pair with `stills.mjs SA --frames <last>` and `stills.mjs SB --frames 0`, side by side.

---

## 5. Engineering notes for the lead

1. **Lift these into `src/lib` before scenes start.** Match-cuts fail if two authors re-implement the same look.
   - `ink.ts`: ring cascade plus the Beer–Lambert shader (S01, S09).
   - `web.ts`: the Voronoi web shader, a JS `hash22` replica, and `WEB_FINAL` (S04, S05, S09).
   - `hud.tsx`: `Timecode`, `Odometer` (with exponent spans), `SGauge`, mono `Label`.
   - `growth.ts`: space colonization (S06, S08, S09).
   - `lut.ts`: an inferno 256-entry table (S07, S08).
   - `handoff.ts`: `Q_DOT`, `BOX`, `P4`, `FEET`, `FIGURE_S08`.
2. **Local `Caption` with a frame override** is needed for REWIND (S01, S04). Copying it into the scene folder is allowed.
3. **Performance.**
   - The heaviest scenes are S04 (shader), S09 (zoom plus ink) and S08 (heightfield). Keep shaders at scale 0.5 or below, Voronoi to 2 layers, fbm to 3 octaves, and ink rings to 24 or fewer.
   - Run bloom on 0.25-scale canvases.
   - Precompute (simulations, trees, samples) in `memo`, under 1 s per tab.
4. **Code size.**
   - S03 and S09 will exceed "a few hundred lines". Split them by beat (`gas.ts`, `states.tsx`, `lottery.ts`, `zoom.ts`), and have S09 import the shared lib modules.
   - Everything else fits in roughly 300–450 lines per scene.
5. **Fonts.** Verify the superscript glyphs and 「？」 metrics with a still before building the S01→S02 and S03 exponents on them.
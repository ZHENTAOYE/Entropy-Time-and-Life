# Engineering guide (read before touching a scene)

Remotion 4 project, 1080×1920 @ 30 fps. Everything is drawn procedurally in code: no images, no stock footage.
The film = 9 scenes played back-to-back (`src/timeline.ts`), finished by a global film-grain layer
(`src/lib/SceneFrame.tsx`) and a procedurally generated score (`public/audio/…`, see `scripts/score.py`).

## File ownership (parallel work!)
- Each scene lives in `src/scenes/<Sxx_Name>/`. **A scene author may only create/modify files inside their own
  scene folder.** `Scene.tsx` must export `export const Scene: React.FC`. Split into more files freely
  (e.g. `sim.ts`, `Ink.tsx`, `shaders.ts`) inside the folder.
- `src/lib/*`, `src/timeline.ts`, `src/Main.tsx`, `src/Root.tsx` are SHARED and READ-ONLY for scene authors.
  If you need a helper that is not in lib, copy/write it inside your scene folder.
- Do not change the scene's duration; it is fixed in `src/timeline.ts`. Frame numbers inside a scene are local
  (0 … durationInFrames-1) because each scene is mounted inside a `<Sequence>`.

## Preview / verification
- `node scripts/stills.mjs S03 --frames 0,60,120 --scale 0.5` → `out/stills/S03/f0060.jpg`… (bundles only S03 via
  `src/scenes/S03_Counting/entry.tsx`, so other scenes' work-in-progress can't break your preview).
- `node scripts/stills.mjs S03 --every 30 --sheet` → also `out/stills/S03/sheet.jpg`, an annotated contact sheet
  (frame number in yellow) — the best way to judge motion/pacing. Use `Read` on the jpg to look at it.
- The script prints ms/frame. **Performance budget: ≤ ~900 ms/frame at --scale 1** (measured by the script,
  which includes ~300 ms screenshot overhead). The whole film must render in reasonable time on 4 CPUs.
- Typecheck: `npx tsc --noEmit -p .` (ignore errors in other scenes' folders — they are in progress).

## Determinism (hard rules)
- Remotion renders frames **out of order, in several browser tabs**. Every frame must be a pure function of the
  frame number. **Never** use `Math.random()`, `Date.now()`, `performance.now()`, or state that accumulates across
  renders. Use `src/lib/random.ts` (`Rng`, `hash01`, `mulberry32`) and `src/lib/noise.ts` (`makeNoise(seed)`).
- Simulations: either closed-form in t (e.g. ideal gas in a box: `x(t) = fold(x0 + vx*t, L)` from `lib/math.ts` —
  exact elastic walls), or **precompute the whole trajectory once** (`memo(key, () => …)` from `lib/math.ts`, a
  module-level cache) and index it by frame. Precompute cost is paid once per tab — keep it < ~1–2 s.
- Draw canvases synchronously (`<CanvasLayer draw={…}>` does this in a layout effect). Never draw in timers/rAF.

## Shared library (src/lib)
- `CanvasLayer` — `<CanvasLayer draw={(ctx, {frame, width, height}) => …} scale={0.5}? frame={override}? />`.
  Context is pre-scaled so you draw in logical 1080×1920 px. Cleared every frame. Use `globalCompositeOperation =
  'lighter'` for additive glow. `scale<1` = cheaper/softer.
- `ShaderLayer` — raw WebGL fragment shader, full frame. `<ShaderLayer frag={src} uniforms={{u_t: frame}} scale={0.5} />`.
  `v_uv` is (0,0) top-left. `u_resolution` provided. `GLSL.hash`, `GLSL.valueNoise` snippets available. Runs on CPU
  (SwiftShader): keep loops small (≤ 5–6 fbm octaves), prefer `scale={0.5}` for soft content. Textures: pass a canvas
  via `textures={{u_tex: canvasEl}}`.
- `Caption` / `CaptionTrack` — **the narration voice of the film**. See below.
- `useFontsReady([[cssFont, text]])` — delayRender until the font slices for `text` are loaded. REQUIRED before
  drawing text into a canvas or sampling glyph points. `FONT.serif | sans | mono | latin` families.
- `sampleText(text, cssFont, cx, cy, {step})`, `sampleShape(key, w, h, drawFn, {step})` — Float32Array of points
  covering glyphs / any drawn shape (memoised). For particles that assemble into words or figures.
- `human.ts` — the shared human figure (recurring motif in S07–S09): `HUMAN_PATH` (SVG path, 600×1420 box),
  `drawHuman(ctx, cx, groundY, height)`, `HUMAN_ANCHORS`, `humanToFrame()`. Use it (e.g. via `sampleShape`) whenever
  the film shows "a human", so the figure is the same person throughout.
- `math.ts` — `clamp, lerp, remap, smoothstep, seg(frame,a,b), prog(frame,a,b,ease), window01, fold, ease.*,
  memo, mixHex, rgba`.
- `overlays.tsx` — `Vignette`, `Flash`, `FilmGrain` (grain is already applied globally — don't add more).

## Typography grammar (keep the film's voice consistent)
- Narration: `<Caption text="…" from={f} dur={d} />`. Default = Noto Serif SC 600, 56 px, warm white `#F3EFE6`,
  centred, y=1440 (lower third), enters by **condensing** out of blur and exits by **diffusing** (characters drift
  apart in random order) — entropy applied to language. This is a film-wide motif: keep it for narration lines.
- Emphasis: wrap words in `{…}` → accent colour (choose an accent that fits your scene palette via `accent=`).
- Explicit line breaks with `\n`; keep lines ≤ ~14 Chinese characters at 56 px; max 2 lines per caption.
- Use Chinese punctuation and curly quotes “ ” (not ASCII "), 「」 not needed.
- Reading time: ≥ (chars / 5) seconds + ~0.8 s; never overlap two narration captions in the same area.
- Big statements: size 84–120, weight 900 (or 200 for whisper-thin elegance), may sit at screen centre.
- HUD/technical labels: `font="mono"` size 24–34, `enter="type"`, letterSpacing 0.15–0.25, uppercase Latin,
  colour from the scene palette. Numbers/equations can use `font="latin"` italic for math letters (S, k, W, t).
- Safe zones for vertical platforms: keep important text within x ∈ [90, 990] and y ∈ [220, 1650]. Right edge
  x > 960 between y 900–1500 is covered by platform buttons; bottom 15 % by captions/UI.
- When text sits over busy/bright imagery pass `shadow` (soft dark halo) or place a subtle gradient behind it.

## Visual quality bar
- This film must look like a premium motion-design piece (Kurzgesagt × Universal Everything × Ryoji Ikeda), not a
  PowerPoint. Rich layering (background atmosphere + mid-ground subject + foreground particles/dust), depth (blur,
  scale, parallax), light (additive glow, bloom via blurred copies, `ctx.filter = 'blur(…)'` on small offscreen
  canvases), restrained but bold colour, deliberate composition for 9:16.
- Motion: everything eases; nothing pops on/off without intent; camera moves are motivated. Hold key images long
  enough to read.
- The visual must **explain** the science (the counting, the flow, the photon ledger…), not decorate it.

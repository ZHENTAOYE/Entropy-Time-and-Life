/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *  cosmos — the shared cosmic renderer (S03 Milky Way · S04 cosmic rewind + collapse · S05 heat death · S09 pull-back
 *  and inversion). Use it on BOTH sides of every cosmic match cut so the cuts are seamless. Everything is a pure
 *  function of its inputs (no Math.random / Date.now); heavy geometry is cached per tab.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *  import { CosmicWeb, WEB_FINAL, webNodes, drawGalaxy, drawMerger, drawStarfield } from '../../lib/cosmos';
 *
 *  ── 1. <CosmicWeb …WebParams /> ─────────────────────────────────────────────────────────────────────────────────
 *  An OPAQUE full-frame layer (paints its own deep space / plasma / paper). Physics, in one picture:
 *    • the web is the "Voronoi foam" model of large-scale structure: voids = cells of an exact Voronoi tessellation of
 *      a variable-density point set (big voids in supervoids, small ones packed in superclusters), filaments = cell
 *      walls (domain-warped so they curve), clusters = vertices (tier 0) + a finer second layer of tributaries/groups
 *      (tier 1). Filament mass follows its clusters ("highways"); cluster masses follow a power law.
 *    • galaxy dust: every particle is a galaxy with a Lagrangian start q in the surrounding void and its place f on the
 *      web; x = q + D(c)·(f − q) (Zel'dovich approximation) — as `c` grows you SEE matter stream onto the filaments.
 *    • hot era: a BOILING emissive plasma — slow ×10⁵ mottling (already shaped like the future web) + billows + thin
 *      bright wisps, all cross-faded through time and swirled by a slow flow; colour from a display-space blackbody
 *      ramp (COSMOS PLASMA_RAMP) whose luminance stays high down to heat ≈ 0.4. Denser gas is hotter, so the
 *      filaments glow brighter than the voids as c grows; the voids go dark once they have emptied.
 *    • dark ages: the glow dies out (heat ≈ 0.22 → 0.1) just before the cold web lights up — never a red+violet mix.
 *    • cold era: violet gas #8E5BFF → blue filaments #4D7CFF → white-blue clusters #D6E6FF on #02030A/#0B0F2E, beaded
 *      by 3-octave fbm; a fainter far slab of web parallaxes behind for depth.
 *    • ignition: clusters first (heaviest earliest), then groups — flash, an expanding shock ring, 4-point diffraction
 *      spikes (fixed to the "telescope": they do not roll), ionised gas halo, gold photon sparks carrying energy away.
 *  Heat → colour (frame mean, c ≈ 0):  1 → boiling gold #FFD797 with near-white #FFF1D6 wisps · 0.75 → amber #FFA24D ·
 *    0.55 → orange #FF7A3D · 0.35 → red-orange #E04A26 · 0.25 → deep red #9A2418 · ≤ 0.15 → the dark ages → cold web.
 *  Rendering: geometry (JS, exact, cached) → structure texture (Canvas2D at `scale`, R = filaments+clusters,
 *  G = gas + a far slab of web, B = tributaries) → fragment shader on an offscreen WebGL canvas (plasma, shading, eq,
 *  lensing, inversion) → composited with the crisp additive light (galaxy dust, stars, spikes, sparks, black-hole rings
 *  and your `draw`) into ONE visible full-res canvas.
 *
 *  Props (WebParams — all numbers; omit the optional ones):
 *    c        0..1   clumpiness: 0 = near-uniform plasma + faint mottling, 1 = sharp filaments, empty voids
 *    ignite   0..1   fraction of nodes lit (clusters light in 0.03–0.5, groups 0.2–0.9). Flashes fade out over the
 *                    last 10 % of ignite, so ignite = 1 is calm (WEB_FINAL).
 *    igniteRate?     ignite-units per second your scene ramps ignite at (default 0.2 = 0→1 in 5 s). The ignition ramp
 *                    (~0.12 s) and the flash / shock-ring life (~0.6 s) are defined in SECONDS through it, so they read
 *                    the same at any ramp speed. Pass the average slope of your ignite curve (e.g. 0→1 over 40 frames
 *                    → 0.75). Without it, ramps much faster than 5 s will strobe.
 *    heat     0..1   plasma temperature (table above); 0 = cold web
 *    zoom     1 = default framing (one void ≈ CELL_PX = 300 px); < 1 pull back, > 1 push in (S09 starts high; the
 *                    web fades out above zoom ≈ 2 so a galaxy can fill the frame). Groups/tributaries fade out
 *                    between zoom 0.32 and 0.22 (no pop), clusters below 0.09.
 *    roll     radians, positive = clockwise; pivot (px, py) default (540, 960)
 *    t        seconds: slow drift (DRIFT cells/s), boiling of the plasma, spark / twinkle animation
 *    eq?      0..1   heat death: each pixel random-walks (σ ≈ 650·eq² px, new noise every frame), the image
 *                    desaturates and settles to #5C5C5C ± 6 % boiling noise at eq = 1. The crisp light stays crisp
 *                    while σ < ~1 px, then cross-fades (eq 0.03 → 0.11) into the shader's random walk.
 *    invert?  0..1   negative into Beer–Lambert ink on cream #F1EADB (ink #0B0D14, dilute #43506E). A soft front
 *                    spreads from (ix, iy) (default 540, 300 = S09's water line): it enters the frame at ≈ 0.15 and
 *                    covers it exactly at 1. Inside the ~250 px front the web's light first DRAINS into ink-dark
 *                    (filaments lead: the ink wicks along the web), then that ink THINS out to reveal clean paper and
 *                    the inked web — every intermediate colour lies on the ink's own curve, never a neutral grey.
 *                    The crisp light (stars, spikes, sparks, your `draw`) goes out just ahead of the front (never
 *                    inverted into dark crosses); the galaxy dust becomes ink specks.
 *    die?     0..1   stars burn out in hash order (redden → dim → gone, with a last ember); the web dims to ~20 %
 *    bh?      0..1   black holes on the 6 most massive clusters of the WEB_FINAL framing (chosen once, t- and camera-
 *                    independent; schedule hashed from each cluster): the host star fades as its hole forms (and never
 *                    comes back), shadow + gravitational lensing of the web (shader) + Doppler-beamed photon ring;
 *                    they evaporate lightest-first with a pin-prick flash (Hawking), all gone by bh ≈ 0.95.
 *                    Holes form at bh ≈ 0.02–0.22.
 *    sparks?  0..1   gold photon sparks radiating from lit / collapsing nodes
 *    cx?, cy? camera centre in world cells (see centerOn) · px?, py? pivot · exposure? (default 1)
 *  Component-only props: scale (shader/structure res, default 0.5), flares (true | false | FlareOpts{groups, spikes,
 *    size}), dust (default true), overlayScale (default 1), draw(ctx, {frame, geo, params}) for extra ADDITIVE
 *    content that must share the web's fate (galaxies / stars that should diffuse with eq / go out with invert),
 *    style, frame.
 *
 *  Typical choreography
 *    S04 rewind  (c 1→0, heat 0→1, ignite 1→0 first):  stars un-light, filaments thicken & smooth, all warms to plasma.
 *    S04 floor of time: hold c ≈ 0, heat 0.75–1 — the plasma keeps boiling on its own (t advances).
 *    S04 collapse (the money shot): c 0→1 with heat 1→0 slightly ahead of it (orange-red filaments mid-way, then the
 *                 dark ages), then ignite 0→1 (pass igniteRate) with sparks ramping up; zoom 1 → 0.8, roll 0 → 6°.
 *                 End EXACTLY on WEB_FINAL.
 *    S05          {...WEB_FINAL, t: WEB_FINAL.t + f/30, die: 0→1, sparks: 1→0, bh: 0→1, eq: 0→1}.
 *    S09          high zoom centred on a cluster (nearestNode + centerOn) with a drawGalaxy() on it, zoom → ~0.8,
 *                 then invert 0→1 (≈ 1.2–1.5 s, ease in-out) — then hand over to the ink renderer.
 *
 *  ── 2. WEB_FINAL ───────────────────────────────────────────────────────────────────────────────────────────────
 *  S04's last frame == S05's first frame: { c 1, ignite 1, heat 0, zoom 0.8, roll 6°, t 953/30, sparks 1, rest 0 }.
 *  Convention: S04 drives t = frame/30 (so its last frame 953 lands on WEB_FINAL.t); S05 uses t = WEB_FINAL.t + f/30.
 *  `<CosmicWeb {...WEB_FINAL} />` renders the identical frame in both scenes.
 *
 *  ── 3. Nodes for canvas layers ─────────────────────────────────────────────────────────────────────────────────
 *  webNodes(params, {groups?, margin?}) → WebNode[] { key, x, y (screen px), wx, wy (world), tier 0|1, mass, rank,
 *    dieRank, lit, flash, alive, redden, vis, host, bright } — exactly the nodes the shader/overlay light (same data).
 *  webGeometry(params) → { cam, nodes, edges (screen polylines `sx`, weight `w`), vis } — e.g. to seed ink tendrils on
 *    the filaments in S09. nearestNode(params, sx, sy, tier) · centerOn(wx, wy, t) → {cx, cy} · webToScreen /
 *    screenToWeb · blackHoles(params) · bhCandidates() · invertFront(params, x, y) (signed px, > 0 = inked) ·
 *    drawWebFlares / webFlarePoints + webFlareSprites / drawWebDust / drawBlackHole / drawSpikes (to put the light in
 *    your own CanvasLayer — then pass flares={false} dust={false} to <CosmicWeb>). COSMOS = the palette.
 *
 *  ── 4. drawGalaxy(ctx, GalaxyOpts) — any CanvasLayer (or CosmicWeb `draw`), logical px, composited additively ─────
 *    { cx, cy, radius (px), tilt (0 face-on … π/2 edge-on, default 0.9), angle (screen PA), arms (2), bar (0..1;
 *      Milky Way ≈ 0.6), pitch (rad, 0.36), seed, t (s), spin (rad/s at R, default 0.045), n (2500+45·R),
 *      palette ('natural' | 'amber' (S03) | 'cool' (web / S09 hero) | 'ember' | custom GalaxyPaletteDef), alpha,
 *      dissolve, exposure, resolved (share of light in resolved stars; default 0.12 small → 0.34 at R ≥ 280) }
 *    Unresolved light: exponential disc × log-spiral density wave broken into clumpy star clouds (3-octave noise) and
 *    flocculent spurs, bar, Sérsic bulge; 2–3 feathered, broken Beer–Lambert dust filaments along the inner edge of
 *    each arm + dark feathers + patches. Resolved stars carry a real share of the flux with a power-law luminosity
 *    function (a few bright cores, many faint): young blue associations and pink HII knots born in the arms that age
 *    and drift through them, sparse old disc / bulge stars on a FLAT rotation curve. `dissolve` 0→1 = the rewind:
 *    stars un-light into glowing gas knots, arms and dust smear out, everything becomes smooth warm gas.
 *    Cost ≈ 25–50 ms (R 190) … 70–140 ms (R 380) on a cold page; about half that once warm.
 *  drawMerger(ctx, MergerOpts) — two spirals on a parabolic encounter (restricted N-body, Toomre & Toomre 1972:
 *    dispersion-supported discs + hot bulges, dynamical friction; ≈ 0.2–0.4 s precompute once per tab):
 *    { cx, cy, scale (px per disc radius), p 0..1 (0 two discs approaching, ~0.35 first passage, ~0.5 tidal tails +
 *    bridge, 1 just merged), tilt, angle, seed, n (per galaxy, 3200), palette, alpha, dissolve, t }.
 *    Light = a two-scale density field (KDE: fine where particles are dense, smooth in the sparse tails, so tails are
 *    continuous); particles are drawn only as sharp point stars; the progenitors' arms are a rigidly rotating density
 *    wave (no winding rings) that the encounter's tides erase. S04's "un-merge" = run p from 1 to 0.
 *
 *  ── 5. drawStarfield(ctx, StarfieldOpts) ───────────────────────────────────────────────────────────────────────
 *    { seed, t, density (1 ≈ 2600 stars), depth (parallax), twinkle (0.4), x, y (camera pan px), zoom, roll, cx, cy,
 *      streak (0..1 radial ◀◀/▶▶ streaks), die (0..1 stars redden and go out), alpha, palette ('natural'|'amber'|'cool') }
 *    Three parallax layers (far dust, mid stars, a few bright glowing near stars), blackbody-ish colours.
 *
 *  Performance (SwiftShader, scale 1, in-page cost of a COLD page as stills.mjs measures it — each still opens a
 *  fresh tab — with 4–8 other renders sharing the 4 CPUs): WEB_FINAL ≈ 0.2 s, heat death ≈ 0.25 s, inversion ≈ 0.3 s,
 *  plasma ≈ 0.17–0.25 s, collapse ≈ 0.2–0.3 s, + a hero galaxy ≈ 0.1 s, a merger ≈ 0.3 s (incl. its simulation).
 *  Chrome adds a fixed ~0.3–0.6 s per still (tab, compositing a full-frame canvas, screenshot); renderMedia reuses
 *  tabs, so the caches (geometry, merger simulation, noise) are then paid once. Levers: scale 0.4,
 *  flares={{groups:false}}, dust={false}, smaller galaxies (radius < 300 → coarser light buffer).
 */
import React, { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FRAG_HEADER } from './Shader';
import { memo, smoothstep } from './math';
import { FRONT_RANGE, INV_EDGE, WEB_FRAG } from './cosmosShader';
import { MAX_BH, WebGeometry, WebParams, blackHoles, fullParams, invertFront, webGeometry } from './cosmosWeb';
import { FlareOpts, PointSplat, ctx2d, drawWebDust, drawWebStructure, noiseTileData, scratchCanvas, webFlarePoints, webFlareSprites } from './cosmosDraw';

export * from './cosmosWeb';
export { COSMOS, COSMOS_INK_K, COSMOS_INK_FLOOR, PLASMA_RAMP } from './cosmosShader';
export { drawWebFlares, webFlarePoints, webFlareSprites, drawWebDust, drawBlackHole, drawSpikes, webWidths, PointSplat } from './cosmosDraw';
export type { FlareOpts } from './cosmosDraw';
export { drawGalaxy, drawMerger, drawStarfield, GALAXY_PALETTES } from './cosmosGalaxy';
export type { GalaxyOpts, GalaxyPaletteDef, GalaxyPaletteName, MergerOpts, StarfieldOpts } from './cosmosGalaxy';

const VERT = `attribute vec2 a_pos; varying vec2 v_uv;
void main(){ v_uv = vec2(a_pos.x*0.5+0.5, 0.5-a_pos.y*0.5); gl_Position = vec4(a_pos,0.,1.); }`;

/** low-res grid of the inversion front (texels ≈ 16 px) */
const FW = 68,
  FH = 120;

interface GL {
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: Map<string, WebGLUniformLocation | null>;
  tex: WebGLTexture[];
  /** granulation channels uploaded (first frame with heat > 0) */
  gran: boolean;
}

function initGL(c: HTMLCanvasElement): GL {
  const gl = c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false }) as WebGLRenderingContext;
  if (!gl) throw new Error('WebGL unavailable');
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('cosmos shader: ' + gl.getShaderInfoLog(sh));
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_HEADER + WEB_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('cosmos link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const tex = [0, 1, 2, 3, 4].map(() => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  });
  // static tileable noise (unit 2, REPEAT), uploaded from raw bytes so its alpha channel is exact
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, tex[2]);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseTileData(false));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return { gl, prog, loc: new Map(), tex, gran: false };
}

export interface CosmicDrawInfo {
  frame: number;
  width: number;
  height: number;
  /** the web on screen this frame (nodes with state, edges with screen polylines) */
  geo: WebGeometry;
  params: Required<WebParams>;
}

export interface CosmicWebProps extends WebParams {
  /** internal resolution of the shader + structure texture (default 0.5) */
  scale?: number;
  /** crisp light (stars, spikes, sparks, black-hole rings): true (default) | false | options */
  flares?: boolean | FlareOpts;
  /** galaxy dust: matter streaming onto the web (Zel'dovich), visible once cold (default true) */
  dust?: boolean;
  /** resolution of the crisp overlay canvas (default 1) */
  overlayScale?: number;
  /**
   * Extra ADDITIVE content drawn with the crisp light (logical px; ctx is in 'lighter' mode): galaxies, starfields…
   * It random-walks into grey with `eq`, and fades out ahead of the ink front with `invert`.
   */
  draw?: (ctx: CanvasRenderingContext2D, info: CosmicDrawInfo) => void;
  style?: React.CSSProperties;
  /** frame override (drives the per-frame noise of `eq`); defaults to useCurrentFrame() */
  frame?: number;
}

/** signed front field on the low-res grid, encoded for the shader (r) — and the matching light mask (alpha) */
function frontGrid(p: Required<WebParams>): { tex: Uint8Array; mask: HTMLCanvasElement } {
  const tex = new Uint8Array(FW * FH * 4);
  const mask = scratchCanvas('invmask', FW, FH);
  const mx = ctx2d(mask);
  const img = mx.createImageData(FW, FH);
  const sx = 1080 / FW,
    sy = 1920 / FH;
  for (let j = 0; j < FH; j++)
    for (let i = 0; i < FW; i++) {
      const F = invertFront(p, (i + 0.5) * sx, (j + 0.5) * sy);
      const k = (j * FW + i) * 4;
      tex[k] = Math.max(0, Math.min(255, Math.round((0.5 + F / (2 * FRONT_RANGE)) * 255)));
      tex[k + 3] = 255;
      // crisp light lives on the filaments: it goes out a little AHEAD of the ink reaching them (never inverted)
      const lightK = 1 - smoothstep(-INV_EDGE * 1.15, -INV_EDGE * 0.2, F + 130);
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(lightK * 255);
    }
  mx.putImageData(img, 0, 0);
  return { tex, mask };
}

/**
 * <CosmicWeb …WebParams /> — the cosmic web (see the API documentation at the top of this file).
 * Opaque full-frame layer (it paints its own deep-space / plasma / paper background): put it at the bottom of the
 * scene; anything that must diffuse / invert with it goes into `draw`, everything else (HUD, captions) on top.
 */
export const CosmicWeb: React.FC<CosmicWebProps> = (props) => {
  const { scale = 0.5, style, frame: frameOverride, flares = true, dust = true, overlayScale = 1, draw } = props;
  const cur = useCurrentFrame();
  const frame = frameOverride ?? cur;
  const { width: W, height: H } = useVideoConfig();
  const outRef = useRef<HTMLCanvasElement>(null);
  const glCanvas = useRef<HTMLCanvasElement | null>(null);
  const st = useRef<GL | null>(null);
  const p = fullParams(props);

  useLayoutEffect(
    () => () => {
      st.current?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      st.current = null;
    },
    [],
  );

  useLayoutEffect(() => {
    const out = outRef.current;
    if (!out) return;
    // heat death: the crisp light stays crisp (full res) while the random walk is < ~1 px, then is handed to the
    // shader over a wide cross-fade so it random-walks with the web
    const routeK = p.eq > 0 ? smoothstep(0.03, 0.11, p.eq) : 0;
    const inverting = p.invert > 0.0005;
    const geo = webGeometry(p, 160, W, H);
    // 1. structure texture (exact geometry rasterised)
    const sc = scratchCanvas('struct', W * scale, H * scale);
    const mean = drawWebStructure(sc, geo, p, scale, W, H, p.heat > 0.1) ?? [0, 0, 0];
    // 2. crisp additive light: points (dust, group stars, sparks) into a splat buffer, sprites drawn later
    const ps = PointSplat.get(W, H, overlayScale);
    if (dust) drawWebDust(null, geo, p, 1, ps);
    // inversion: the galaxy dust turns into ink specks — its luminance at struct res goes to the shader as its own
    // single-channel texture, straight from the point buffer (no canvas read-back)
    let dustLum: Uint8Array | null = null;
    const sw = Math.round(W * scale),
      sh = Math.round(H * scale);
    if (inverting) {
      dustLum = memo(`cosmos:dustlum:${sw}x${sh}`, () => new Uint8Array(sw * sh));
      const d = ps.d,
        PW = ps.W,
        PH = ps.H;
      const fx = PW / sw,
        fy = PH / sh;
      for (let y = 0; y < sh; y++) {
        const y0 = Math.min(PH - 2, Math.floor(y * fy));
        const r0 = y0 * PW * 4,
          r1 = r0 + PW * 4;
        for (let x = 0; x < sw; x++) {
          const k = Math.min(PW - 2, Math.floor(x * fx)) * 4 + 2;
          dustLum[y * sw + x] = (d[r0 + k] + d[r0 + k + 4] + d[r1 + k] + d[r1 + k + 4]) >> 2;
        }
      }
    }
    const fo: FlareOpts = typeof flares === 'object' ? flares : {};
    if (flares) webFlarePoints(ps, p, geo.nodes, fo);
    const sprites = (o: CanvasRenderingContext2D) => {
      o.setTransform(overlayScale, 0, 0, overlayScale, 0, 0);
      if (flares) webFlareSprites(o, p, geo.nodes, fo);
      if (draw) {
        o.save();
        o.globalCompositeOperation = 'lighter';
        draw(o, { frame, width: W, height: H, geo, params: p });
        o.restore();
      }
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
    };
    const needOv = routeK > 0 || inverting;
    let ov: HTMLCanvasElement | null = null;
    if (needOv) {
      ov = scratchCanvas('overlay', W * overlayScale, H * overlayScale);
      const o = ctx2d(ov);
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalAlpha = 1;
      o.globalCompositeOperation = 'source-over';
      o.filter = 'none';
      ps.putTo(o);
      sprites(o);
    }
    const front = inverting ? frontGrid(p) : null;
    // 3. shade (offscreen WebGL: compositing a live WebGL canvas costs ~0.4 s/frame on SwiftShader)
    if (!glCanvas.current) glCanvas.current = document.createElement('canvas');
    const c = glCanvas.current;
    const cw = Math.round(W * scale),
      ch = Math.round(H * scale);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    if (!st.current) st.current = initGL(c);
    const { gl, prog, loc, tex } = st.current;
    if (p.heat > 0.1 && !st.current.gran) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tex[2]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseTileData(true));
      st.current.gran = true;
    }
    const L = (n: string) => {
      if (!loc.has(n)) loc.set(n, gl.getUniformLocation(prog, n));
      return loc.get(n)!;
    };
    const cam = geo.cam;
    gl.viewport(0, 0, c.width, c.height);
    gl.uniform2f(L('u_resolution'), c.width, c.height);
    gl.uniform2f(L('u_size'), W, H);
    gl.uniform4f(L('u_cam'), cam.cx, cam.cy, cam.k, p.roll);
    gl.uniform2f(L('u_piv'), p.px, p.py);
    gl.uniform1f(L('u_c'), p.c);
    gl.uniform1f(L('u_heat'), p.heat);
    gl.uniform1f(L('u_t'), p.t);
    gl.uniform1f(L('u_eq'), p.eq);
    gl.uniform1f(L('u_inv'), p.invert);
    gl.uniform1f(L('u_die'), p.die);
    gl.uniform1f(L('u_exp'), p.exposure);
    gl.uniform1f(L('u_frame'), frame % 1009);
    gl.uniform3f(L('u_mean'), mean[0], mean[1], mean[2]);
    const bh = new Float32Array(MAX_BH * 4);
    blackHoles(p).forEach((b, i) => bh.set([b.x, b.y, Math.max(b.r, 0.01), b.r > 0.05 ? b.k : 0], i * 4));
    gl.uniform1fv(L('u_bh[0]'), bh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sc);
    gl.uniform1i(L('u_struct'), 0);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, tex[4]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (dustLum) gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, sw, sh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, dustLum);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(1));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.uniform1i(L('u_dust'), 4);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex[1]);
    if (ov && routeK > 0) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ov);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(L('u_over'), 1);
    gl.uniform1f(L('u_overK'), routeK);
    gl.uniform1i(L('u_noise'), 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, tex[3]);
    if (front) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, front.tex);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.uniform1i(L('u_front'), 3);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 4. composite into the single visible (CPU) canvas
    const x = ctx2d(out);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = 'none';
    x.globalAlpha = 1;
    x.imageSmoothingEnabled = true;
    if (!ov) {
      // common case: the point buffer IS the base of the frame (one putImageData), the shaded web is added onto it
      ps.putTo(x);
      x.globalCompositeOperation = 'lighter';
      x.drawImage(c, 0, 0, out.width, out.height);
      sprites(x);
    } else {
      x.globalCompositeOperation = 'copy';
      x.drawImage(c, 0, 0, out.width, out.height);
      const crispK = 1 - routeK;
      if (crispK > 0.001) {
        if (front) {
          // the crisp light goes out ahead of the ink front (it is never inverted into dark crosses)
          const o = ctx2d(ov);
          o.globalCompositeOperation = 'destination-in';
          o.imageSmoothingEnabled = true;
          o.drawImage(front.mask, 0, 0, ov.width, ov.height);
          o.globalCompositeOperation = 'source-over';
        }
        x.globalCompositeOperation = 'lighter';
        x.globalAlpha = crispK;
        x.drawImage(ov, 0, 0, out.width, out.height);
      }
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
  });

  return (
    <canvas
      ref={outRef}
      width={Math.round(W * overlayScale)}
      height={Math.round(H * overlayScale)}
      style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, ...style }}
    />
  );
};

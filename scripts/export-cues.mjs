// Export every scene's src/scenes/<dir>/cues.ts to scripts/audio/cues/<id>.json (scene-local frames)
// by bundling it with esbuild and evaluating it in Node. Accepts `export const CUES`, or any exported
// function whose name ends in "Cues" (e.g. s08Cues()).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tl = fs.readFileSync(path.join(root, 'src/timeline.ts'), 'utf8');
const scenes = [...tl.matchAll(/id: '(S\d\d)', dir: '([^']+)'/g)].map((m) => ({ id: m[1], dir: m[2] }));
const outDir = path.join(root, 'scripts/audio/cues');
fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(root, 'out/tmp-cues');
fs.mkdirSync(tmp, { recursive: true });
// minimal DOM stubs in case a transitively imported module touches them at import time
globalThis.document ??= { createElement: () => ({ getContext: () => null, style: {} }), fonts: { load: async () => [], ready: Promise.resolve() } };
globalThis.window ??= globalThis;

for (const s of scenes) {
  const src = path.join(root, 'src/scenes', s.dir, 'cues.ts');
  if (!fs.existsSync(src)) {
    console.log(`${s.id}: no cues.ts`);
    continue;
  }
  const outfile = path.join(tmp, `${s.id}.mjs`);
  try {
    await build({ entryPoints: [src], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error', loader: { '.css': 'empty', '.woff2': 'empty', '.woff': 'empty' }, jsx: 'automatic' });
    const mod = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
    let cues = mod.CUES;
    if (!cues) {
      const fn = Object.entries(mod).find(([k, v]) => typeof v === 'function' && /cues$/i.test(k));
      if (fn) cues = fn[1]();
    }
    if (!Array.isArray(cues)) throw new Error('no CUES export');
    const norm = cues
      .map((c) => ({ frame: Math.round(c.frame ?? c.f ?? 0), kind: String(c.kind ?? ''), description: String(c.description ?? c.desc ?? ''), intensity: c.intensity ?? c.i ?? 0.5 }))
      .sort((a, b) => a.frame - b.frame);
    fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify(norm, null, 1));
    console.log(`${s.id}: ${norm.length} cues`);
  } catch (e) {
    console.log(`${s.id}: FAILED ${e.message.split('\n')[0]}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

#!/usr/bin/env node
// Render stills / a contact sheet for one scene (isolated bundle) or the full film.
//
//   node scripts/stills.mjs S03 --frames 0,45,90           -> out/stills/S03/f0000.jpg ...
//   node scripts/stills.mjs S03 --every 30 --sheet          -> + out/stills/S03/sheet.jpg (annotated contact sheet)
//   node scripts/stills.mjs Main --every 150 --scale 0.25 --sheet
// Options: --scale <0..1> (default 0.5), --out <dir>, --cols <n> (default 6), --from <f> --to <f> (with --every)
// Prints per-frame render time — keep heavy scenes under ~600 ms/frame at scale 1.
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const id = args[0];
if (!id) {
  console.error('usage: node scripts/stills.mjs <S01..S09|Main> [--frames a,b,c | --every n] [--scale s] [--sheet]');
  process.exit(1);
}
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes('--' + name);
const scale = parseFloat(opt('scale', '0.5'));
const compId = opt('comp', id);
const outDir = path.resolve(root, opt('out', `out/stills/${id.replace(/[^A-Za-z0-9_-]/g, '_')}`));
const cols = parseInt(opt('cols', '6'), 10);

const timelineSrc = fs.readFileSync(path.join(root, 'src/timeline.ts'), 'utf8');
const sceneRe = /id: '(S\d\d)', dir: '([^']+)'/g;
const dirs = {};
for (const m of timelineSrc.matchAll(sceneRe)) dirs[m[1]] = m[2];
const entryPoint = id === 'Main' ? path.join(root, 'src/index.ts') : id.startsWith('scratch:') ? path.join(root, id.slice(8)) : path.join(root, 'src/scenes', dirs[id], 'entry.tsx');
if (!fs.existsSync(entryPoint)) throw new Error('No entry for ' + id + ': ' + entryPoint);

const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const chromiumOptions = { gl: 'swangle' };

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint, enableCaching: true, onProgress: () => {} });
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
try {
  const composition = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, browserExecutable, chromiumOptions });
  let frames;
  if (opt('frames')) frames = opt('frames').split(',').map((s) => parseInt(s, 10));
  else {
    const every = parseInt(opt('every', '30'), 10);
    const from = parseInt(opt('from', '0'), 10);
    const to = parseInt(opt('to', String(composition.durationInFrames - 1)), 10);
    frames = [];
    for (let f = from; f <= to; f += every) frames.push(f);
  }
  frames = frames.filter((f) => f >= 0 && f < composition.durationInFrames);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^(f\d+|sheet).*\.(jpg|png)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  const times = [];
  const files = [];
  for (const f of frames) {
    const out = path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`);
    const s = Date.now();
    await renderStill({ composition, serveUrl, output: out, frame: f, scale, imageFormat: 'jpeg', jpegQuality: 88, puppeteerInstance: browser, browserExecutable, chromiumOptions, overwrite: true, logLevel: 'error' });
    const dt = Date.now() - s;
    times.push(dt);
    files.push([f, out]);
    console.log(`frame ${f} -> ${path.relative(root, out)} (${dt} ms)`);
  }
  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  console.log(`avg ${avg.toFixed(0)} ms/frame at scale ${scale}`);
  if (flag('sheet') && files.length) {
    // annotate & tile
    const tmp = path.join(outDir, '_ann');
    fs.mkdirSync(tmp, { recursive: true });
    files.forEach(([f, file], i) => {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf',
        `scale=270:-2,drawtext=fontfile=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc:text='${f}':x=8:y=8:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.6`,
        path.join(tmp, `${String(i).padStart(4, '0')}.jpg`)]);
    });
    const rows = Math.ceil(files.length / cols);
    const sheet = path.join(outDir, 'sheet.jpg');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, '%04d.jpg'), '-vf', `tile=${cols}x${rows}:padding=4:color=0x333333`, '-frames:v', '1', '-q:v', '3', sheet]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('sheet -> ' + path.relative(root, sheet));
  }
} finally {
  await browser.close({ silent: true });
  fs.rmSync(serveUrl, { recursive: true, force: true });
}

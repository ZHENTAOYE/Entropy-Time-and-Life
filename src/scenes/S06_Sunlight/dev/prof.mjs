// profile S06 frames: renders stills at scale 1 and prints browser console logs (PROF lines)
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';
const root = '/home/user/Entropy-Time-and-Life';
const frames = process.argv[2].split(',').map(Number);
const scale = parseFloat(process.argv[3] || '1');
const outDir = process.argv[4] || '/tmp/claude-0/-home-user-Entropy-Time-and-Life/48730b62-e0c2-550b-871f-b6bb04ebcd6c/scratchpad/prof';
fs.mkdirSync(outDir, { recursive: true });
const entryPoint = path.join(root, 'src/scenes/S06_Sunlight/entry.tsx');
const browserExecutable = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const chromiumOptions = { gl: 'swangle' };
const serveUrl = await bundle({ entryPoint, enableCaching: true, onProgress: () => {} });
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
try {
  const composition = await selectComposition({ serveUrl, id: 'S06', puppeteerInstance: browser, browserExecutable, chromiumOptions });
  const times = [];
  for (const f of frames) {
    const out = path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`);
    const s = Date.now();
    const logs = [];
    await renderStill({ composition, serveUrl, output: out, frame: f, scale, imageFormat: 'jpeg', jpegQuality: 88, puppeteerInstance: browser, browserExecutable, chromiumOptions, overwrite: true, logLevel: 'error',
      onBrowserLog: (l) => { if (String(l.text).startsWith('PROF')) logs.push(l.text); } });
    const dt = Date.now() - s;
    times.push(dt);
    console.log(`frame ${f}: ${dt} ms  ${logs.join(' | ')}`);
  }
  console.log('avg', (times.reduce((a, b) => a + b, 0) / times.length).toFixed(0));
} finally {
  await browser.close({ silent: true });
  fs.rmSync(serveUrl, { recursive: true, force: true });
}

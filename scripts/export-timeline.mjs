// Export src/timeline.ts scene list to out/timeline.json (for scripts/audio/score.py).
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'src/timeline.ts'), 'utf8');
const scenes = [...src.matchAll(/id: '(S\d\d)', dir: '([^']+)', title: '([^']+)', durationInFrames: (\d+)/g)].map((m) => ({ id: m[1], dir: m[2], title: m[3], frames: +m[4] }));
let t = 0;
for (const s of scenes) {
  s.start = t;
  t += s.frames;
}
const fps = +(/FPS = (\d+)/.exec(src)[1]);
fs.mkdirSync(path.join(root, 'out'), { recursive: true });
fs.writeFileSync(path.join(root, 'out/timeline.json'), JSON.stringify({ fps, total: t, scenes }, null, 2));
console.log(JSON.stringify({ fps, total: t, seconds: t / fps }));

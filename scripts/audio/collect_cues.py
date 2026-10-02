"""Collect the latest structured scene results (captions + soundCues) from workflow journals.

    python3 scripts/audio/collect_cues.py <journal.jsonl> [...]

Writes scripts/audio/cues/Sxx.json (soundCues) and out/scene-results/Sxx.json (full result).
The latest build/revise result per scene wins (journal order).
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
latest = {}
for path in sys.argv[1:]:
    labels = {}
    for line in open(path):
        d = json.loads(line)
        if d.get('type') == 'started':
            labels[d['agentId']] = d.get('label') or ''
        elif d.get('type') == 'result':
            lab = labels.get(d.get('agentId'), '')
            m = re.match(r'(build|revise):(S\d\d)', lab)
            r = d.get('result')
            if m and isinstance(r, dict) and 'soundCues' in r:
                latest[m.group(2)] = (lab, r)
os.makedirs(os.path.join(os.path.dirname(__file__), 'cues'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'out', 'scene-results'), exist_ok=True)
for sid, (lab, r) in sorted(latest.items()):
    with open(os.path.join(os.path.dirname(__file__), 'cues', f'{sid}.json'), 'w') as f:
        json.dump(r['soundCues'], f, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, 'out', 'scene-results', f'{sid}.json'), 'w') as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
    print(sid, lab, len(r['soundCues']), 'cues', 'ms/frame', r.get('msPerFrame'))

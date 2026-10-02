#!/usr/bin/env bash
# Render last frame of each scene next to the first frame of the next scene -> out/check/handoffs.jpg
set -e
cd "$(dirname "$0")/.."
pairs="S01:389:S02 S02:521:S03 S03:1091:S04 S04:953:S05 S05:521:S06 S06:581:S07 S07:899:S08 S08:569:S09"
mkdir -p out/check/handoffs
files=()
for p in $pairs; do
  a=${p%%:*}; rest=${p#*:}; last=${rest%%:*}; b=${rest#*:}
  node scripts/stills.mjs $a --frames $last --scale 0.3 --out out/check/handoffs/$a >/dev/null 2>&1 || echo "fail $a"
  node scripts/stills.mjs $b --frames 0 --scale 0.3 --out out/check/handoffs/${b}_in >/dev/null 2>&1 || echo "fail $b"
  la=$(printf "out/check/handoffs/%s/f%04d.jpg" $a $last); fb="out/check/handoffs/${b}_in/f0000.jpg"
  ffmpeg -y -loglevel error -i "$la" -i "$fb" -filter_complex "[0]drawtext=fontfile=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc:text='$a end':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6[x];[1]drawtext=fontfile=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc:text='$b f0':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6[y];[x][y]hstack" out/check/handoffs/pair_$a.jpg
  files+=(out/check/handoffs/pair_$a.jpg)
done
args=(); for f in "${files[@]}"; do args+=(-i "$f"); done
n=${#files[@]}
ffmpeg -y -loglevel error "${args[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf '[%d]' $i; done)xstack=inputs=$n:layout=0_0|w0_0|w0+w1_0|w0+w1+w2_0|0_h0|w0_h0|w0+w1_h0|w0+w1+w2_h0" out/check/handoffs.jpg
echo out/check/handoffs.jpg

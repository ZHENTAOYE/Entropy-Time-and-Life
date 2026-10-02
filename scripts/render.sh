#!/usr/bin/env bash
# Full render of the film.
#   scripts/render.sh            -> out/master/entropy-time-life.master.mp4 (CRF 16, for viewing/upload)
#                                   out/final/熵、时间与生命.mp4           (size-capped encode, < 95 MB, committed)
# Prerequisites: node scripts/export-timeline.mjs && node scripts/export-cues.mjs && python3 scripts/audio/score.py
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p out/master out/final
CONC=${CONC:-4}
npx remotion render src/index.ts Main out/master/entropy-time-life.master.mp4 \
  --concurrency="$CONC" --crf=16 --pixel-format=yuv420p --audio-codec=aac --audio-bitrate=256k \
  --x264-preset=slow --log=info "$@"
# distribution encode: two-pass H.264 to a fixed size budget
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/master/entropy-time-life.master.mp4)
TARGET_MB=${TARGET_MB:-92}
ABR=192
VBR=$(python3 -c "print(int(${TARGET_MB}*8*1024/${DUR} - ${ABR}))")
echo "duration ${DUR}s -> video ${VBR} kbps"
ffmpeg -y -loglevel error -i out/master/entropy-time-life.master.mp4 -c:v libx264 -preset slow -tune grain -b:v ${VBR}k -pass 1 -an -f mp4 -passlogfile out/final/x264 /dev/null
ffmpeg -y -loglevel error -i out/master/entropy-time-life.master.mp4 -c:v libx264 -preset slow -tune grain -b:v ${VBR}k -maxrate $((VBR*2))k -bufsize $((VBR*4))k -pass 2 -passlogfile out/final/x264 \
  -c:a aac -b:a ${ABR}k -movflags +faststart -metadata title="熵、时间与生命" "out/final/熵、时间与生命.mp4"
rm -f out/final/x264*
ls -la out/master out/final

#!/bin/sh
# Turn a screencast frame dir (frames/*.jpg + frames.txt with CDP timestamps) into a CFR 30 fps MP4 at real time.
# usage: tovideo.sh <recDir> <out.mp4>
d=$1; out=$2
sort -k2 -n "$d/frames.txt" | awk 'NR>1{printf "file '\''frames/%s.jpg'\''\nduration %.4f\n", p, ($2-pt<0.001?0.001:$2-pt)} {p=$1; pt=$2} END{printf "file '\''frames/%s.jpg'\''\nduration 0.1\n", p}' > "$d/concat.txt"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$d/concat.txt" -vf "fps=30,scale=1920:1022:force_original_aspect_ratio=decrease,pad=1920:1022:(ow-iw)/2:0:white,format=yuv420p" -c:v libx264 -preset veryfast -crf 16 "$out"

set -e
SP="${CAPTURE_WORK:-/tmp/nbc-capture}"
# Social exports live outside the repo entirely — they are things to post, not
# code or site assets, and they sit with the rest of the project's design work.
OUT=${SOCIAL_OUT:-$HOME/Projects/Design/no-bhad-codes/social-media}
mkdir -p "$OUT"
SIZE=1080

for t in light dark; do
  SP=$SP node "$SP/nbc-intro.mjs" $t $SIZE
done

# Cut each take from its own markers rather than fixed times: the two stretches
# where the card sits motionless come out, every join lands on the card at rest.
for t in light dark; do
  D="$SP/nbc-video-$t-$SIZE"
  V=$(ls "$D"/*.webm | head -1)
  read -r HEAD A B C E <<< "$(python3 -c "
import json
m = json.load(open('$D/marks.json'))
print(0.4, round(m['introDone'] + 1.0, 2), round(m['flipStart'] - 0.2, 2), round(m['flipEnd'] + 0.3, 2), round(m['exitStart'] - 0.2, 2), round(m['end'], 2))
" | awk '{print $1, $2, $3, $4, $5, $6}')"
  read -r HEAD A B C D2 E <<< "$(python3 -c "
import json
m = json.load(open('$D/marks.json'))
print(0.4, round(m['introDone'] + 1.0, 2), round(m['flipStart'] - 0.2, 2), round(m['flipEnd'] + 0.3, 2), round(m['exitStart'] - 0.2, 2), round(m['end'], 2))
")"
  ffmpeg -y -loglevel error -i "$V" -filter_complex \
    "[0:v]trim=$HEAD:$A,setpts=PTS-STARTPTS[a];[0:v]trim=$B:$C,setpts=PTS-STARTPTS[b];[0:v]trim=$D2:$E,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1,fps=30,format=yuv420p[v]" \
    -map "[v]" -c:v libx264 -preset slow -crf 20 -movflags +faststart "$SP/social-$t.mp4"
  echo "  $t: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SP/social-$t.mp4" | cut -d. -f1)s"
done

# light first, then dark, as one file
ffmpeg -y -loglevel error -i "$SP/social-light.mp4" -i "$SP/social-dark.mp4" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1,format=yuv420p[v]" -map "[v]" \
  -c:v libx264 -preset slow -crf 20 -movflags +faststart "$OUT/nobhad-codes-intro-square.mp4"
echo "stitched: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/nobhad-codes-intro-square.mp4" | cut -d. -f1)s  $(( $(stat -f%z "$OUT/nobhad-codes-intro-square.mp4") / 1024 ))KB  $(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT/nobhad-codes-intro-square.mp4")"
osascript -e 'display notification "Square social video ready (light then dark)" with title "Capture complete" sound name "Glass"' 2>/dev/null || true

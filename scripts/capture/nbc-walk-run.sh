set -e
SP="${CAPTURE_WORK:-/tmp/nbc-capture}"
D=/Users/noellebhaduri/Projects/Development/Active/no-bhad-codes/public/portfolio/nobhad-codes/videos
mkdir -p "$D"
for t in light dark; do
  SP=$SP node "$SP/nbc-walk.mjs" $t desktop
  V=$(ls "$SP"/nbc-walk-$t-desktop/*.webm | head -1)
  HEAD=$(python3 -c "print(round(float(open('$SP/nbc-walk-$t-desktop/styledAt.txt').read()) + 0.15, 2))")
  echo "  head trim: ${HEAD}s (cut to where styling lands, not to first paint)"
  ffmpeg -y -loglevel error -ss $HEAD -i "$V" -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -deadline good -cpu-used 3 -pix_fmt yuv420p -an "$D/walkthrough-desktop-$t.webm"
  echo "walkthrough-desktop-$t.webm  $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$D/walkthrough-desktop-$t.webm" | cut -d. -f1)s  $(( $(stat -f%z "$D/walkthrough-desktop-$t.webm") / 1048576 ))MB"
done
osascript -e 'display notification "No Bhad Codes walkthroughs ready (light + dark)" with title "Capture complete" sound name "Glass"' 2>/dev/null || true

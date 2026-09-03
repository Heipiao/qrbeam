#!/bin/zsh
set -e

QR_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
QR_WORK="$(mktemp -d)"
QR_FONT="/System/Library/Fonts/SFNS.ttf"
QR_GREEN="#55D98B"
QR_OUT="$QR_ROOT/store-assets/app-store-connect/en-US/ipad-13-v3"
QR_RAW="$QR_ROOT/store-assets/app-store-connect/raw/en-US/ipad-13"

mkdir -p "$QR_OUT"
cd "$QR_ROOT"

make_base() {
  local background="$1"
  local output="$2"
  magick "$background" -resize '2064x2752^' -gravity center -extent 2064x2752 \
    \( -size 2064x780 gradient:'#050809f5-#05080900' \) \
    -gravity north -compose over -composite "$output"
}

make_ipad() {
  local source="$1"
  local angle="$2"
  local output="$3"
  magick "$source" -resize 1370x "$QR_WORK/screen.png"
  local sw="$(magick identify -format '%w' "$QR_WORK/screen.png")"
  local sh="$(magick identify -format '%h' "$QR_WORK/screen.png")"
  local ow=$((sw + 42))
  local oh=$((sh + 42))
  magick -size "${ow}x${oh}" xc:none -fill '#3D464B' -stroke '#55D98B66' -strokewidth 2 \
    -draw "roundrectangle 1,1 $((ow - 2)),$((oh - 2)) 46,46" "$QR_WORK/frame.png"
  magick -size "${sw}x${sh}" xc:none -fill white \
    -draw "roundrectangle 0,0 $((sw - 1)),$((sh - 1)) 32,32" "$QR_WORK/mask.png"
  magick "$QR_WORK/screen.png" "$QR_WORK/mask.png" -alpha off \
    -compose CopyOpacity -composite "$QR_WORK/screen-round.png"
  magick "$QR_WORK/frame.png" "$QR_WORK/screen-round.png" -gravity center \
    -compose over -composite -background none -rotate "$angle" "$output"
}

render() {
  local source="$1"
  local background="$2"
  local output="$3"
  local angle="$4"
  local eyebrow="$5"
  local title1="$6"
  local title2="$7"
  local subtitle="$8"
  local chip1="$9"
  local chip2="${10}"
  local footer="${11}"

  make_base "$background" "$QR_WORK/base.png"
  make_ipad "$source" "$angle" "$QR_WORK/ipad.png"
  magick store-assets/app-store/screenshots/v1/assets/qrbeam-icon.png -resize 70x70 "$QR_WORK/icon.png"

  magick "$QR_WORK/base.png" \
    "$QR_WORK/icon.png" -gravity northwest -geometry +108+82 -compose over -composite \
    -font "$QR_FONT" -fill white -pointsize 46 -gravity northwest -annotate +202+96 'QRBeam' \
    -fill "$QR_GREEN" -pointsize 30 -annotate +1600+108 "$eyebrow" \
    \( "$QR_WORK/ipad.png" \( +clone -background black -shadow 55x28+0+34 \) \
      +swap -background none -layers merge +repage \) \
    -gravity northwest -geometry +347+690 -compose over -composite \
    -fill '#07110EDD' -stroke '#55D98B66' -strokewidth 2 \
    -draw 'roundrectangle 90,1500 365,1600 30,30 roundrectangle 1699,1810 1974,1910 30,30' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 132,1550 141,1550 circle 1741,1860 1750,1860' \
    -font "$QR_FONT" -fill white -pointsize 30 \
    -annotate +164+1522 "$chip1" -annotate +1773+1832 "$chip2" \
    -fill '#07110EE6' -stroke '#55D98B66' -strokewidth 2 \
    -draw 'roundrectangle 180,2585 1884,2695 55,55' \
    -stroke none -font "$QR_FONT" -fill '#DDF7E8' -pointsize 34 \
    -gravity center -annotate +0+1264 "$footer" \
    -gravity northwest -font "$QR_FONT" -fill white -pointsize 120 \
    -annotate +112+215 "$title1" -fill "$QR_GREEN" -annotate +112+350 "$title2" \
    -fill '#AAB3B9' -pointsize 43 -annotate +118+520 "$subtitle" \
    -alpha off -define png:color-type=2 "PNG24:$output"
}

render "$QR_RAW/01-home.png" \
  store-assets/app-store-connect/imagegen-v3-backgrounds/01-home.png \
  "$QR_OUT/01-home.png" 1.5 'OFFLINE FILE TRANSFER' \
  'Send files' 'without a network' \
  'No account. No shared Wi-Fi. No cloud upload.' \
  'REAL iPAD UI' 'ON-DEVICE' 'FILES STAY ON-DEVICE · NO CLOUD UPLOAD'

render "$QR_RAW/02-send.png" \
  store-assets/app-store-connect/imagegen-v3-backgrounds/02-send.png \
  "$QR_OUT/02-send.png" -1.5 'PHONE TO PHONE' \
  'Pick a file' 'send it as light' \
  'Choose a file. The other device opens Receive and scans.' \
  'CHOOSE' 'SCAN' 'SCREEN → CAMERA · ANIMATED QR TRANSFER'

render "$QR_RAW/03-sending.png" \
  store-assets/app-store-connect/imagegen-v3-backgrounds/03-sending.png \
  "$QR_OUT/03-sending.png" 1 'ANIMATED QR' \
  'Real QR frames' 'moving through light' \
  'The actual fixture loops continuously for the other device.' \
  'REAL QR' '2-FRAME LOOP' 'OFFLINE TRANSFER · NO CLOUD UPLOAD'

echo "Generated $QR_OUT"

#!/bin/zsh
set -e

QR_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
QR_WORK="$(mktemp -d)"
QR_ZH_FONT="/System/Library/Fonts/STHeiti Medium.ttc"
QR_EN_FONT="/System/Library/Fonts/SFNS.ttf"
QR_GREEN="#55D98B"

cd "$QR_ROOT"

make_phone() {
  local source="$1"
  local angle="$2"
  local output="$3"

  magick "$source" -resize 720x "$QR_WORK/screen.png"
  local sw="$(magick identify -format '%w' "$QR_WORK/screen.png")"
  local sh="$(magick identify -format '%h' "$QR_WORK/screen.png")"
  local ow=$((sw + 44))
  local oh=$((sh + 44))

  magick -size "${ow}x${oh}" xc:none -fill '#424A50' \
    -draw "roundrectangle 0,0 $((ow - 1)),$((oh - 1)) 66,66" "$QR_WORK/frame.png"
  magick -size "${sw}x${sh}" xc:none -fill white \
    -draw "roundrectangle 0,0 $((sw - 1)),$((sh - 1)) 48,48" "$QR_WORK/mask.png"
  magick "$QR_WORK/screen.png" "$QR_WORK/mask.png" -alpha off \
    -compose CopyOpacity -composite "$QR_WORK/screen-round.png"
  magick "$QR_WORK/frame.png" "$QR_WORK/screen-round.png" -gravity center \
    -compose over -composite -background none -rotate "$angle" "$output"
}

make_base() {
  local background="$1"
  local output="$2"
  magick "$background" -resize '1320x2868!' \
    \( -size 1320x850 gradient:'#050809ee-#05080900' \) \
    -gravity north -compose over -composite "$output"
}

add_brand() {
  local input="$1"
  local output="$2"
  local font="$3"
  local eyebrow="$4"

  magick store-assets/app-store/screenshots/v1/assets/qrbeam-icon.png -resize 52x52 "$QR_WORK/icon.png"
  magick "$input" "$QR_WORK/icon.png" -gravity northwest -geometry +76+72 -compose over -composite \
    -font "$QR_EN_FONT" -fill white -pointsize 34 -gravity northwest -annotate +142+82 'QRBeam' \
    -font "$font" -fill "$QR_GREEN" -pointsize 25 -annotate +1010+91 "$eyebrow" "$output"
}

render_home() {
  local source="$1"
  local output="$2"
  local font="$3"
  local eyebrow="$4"
  local title1="$5"
  local title2="$6"
  local subtitle="$7"
  local chip1="$8"
  local chip2="$9"
  local footer="${10}"

  make_base store-assets/app-store-connect/imagegen-v3-backgrounds/01-home.png "$QR_WORK/base.png"
  add_brand "$QR_WORK/base.png" "$QR_WORK/branded.png" "$font" "$eyebrow"
  make_phone "$source" 4 "$QR_WORK/phone.png"

  magick "$QR_WORK/branded.png" \
    \( "$QR_WORK/phone.png" \( +clone -background black -shadow 45x22+8+24 \) \
      +swap -background none -layers merge +repage \) \
    -gravity northwest -geometry +430+740 -compose over -composite \
    -fill '#08100DCC' -stroke '#55D98B55' -strokewidth 2 \
    -draw 'roundrectangle 72,1210 340,1390 28,28' \
    -stroke none -fill "$QR_GREEN" -draw 'roundrectangle 104,1245 160,1301 10,10' \
    -font "$QR_EN_FONT" -fill white -pointsize 30 -annotate +186+1252 'FILE' \
    -stroke '#55D98B88' -strokewidth 4 -fill none \
    -draw 'bezier 342,1300 430,1280 460,1190 530,1170' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 350,1298 357,1298 circle 405,1260 411,1260 circle 466,1205 472,1205 circle 528,1170 536,1170' \
    -fill '#06100CCC' -stroke '#55D98B55' -strokewidth 2 \
    -draw 'roundrectangle 68,2140 350,2240 28,28 roundrectangle 68,2265 350,2365 28,28' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 106,2190 114,2190 circle 106,2315 114,2315' \
    -font "$font" -fill white -pointsize 30 \
    -annotate +134+2163 "$chip1" -annotate +134+2288 "$chip2" \
    -fill '#07110ECC' -stroke '#55D98B55' -strokewidth 2 \
    -draw 'roundrectangle 90,2580 1230,2695 58,58' \
    -stroke none -font "$font" -fill '#DDF7E8' -pointsize 34 \
    -gravity center -annotate +0+1215 "$footer" \
    -gravity northwest -font "$font" -fill white -pointsize 104 \
    -annotate +86+198 "$title1" -fill "$QR_GREEN" -annotate +86+322 "$title2" \
    -fill '#AAB3B9' -pointsize 39 -annotate +90+470 "$subtitle" \
    -alpha off -define png:color-type=2 "PNG24:$output"
}

render_send() {
  local source="$1"
  local output="$2"
  local font="$3"
  local eyebrow="$4"
  local title1="$5"
  local title2="$6"
  local subtitle="$7"
  local step1="$8"
  local step2="$9"
  local step3="${10}"
  local footer="${11}"

  make_base store-assets/app-store-connect/imagegen-v3-backgrounds/02-send.png "$QR_WORK/base.png"
  add_brand "$QR_WORK/base.png" "$QR_WORK/branded.png" "$font" "$eyebrow"
  make_phone "$source" -5 "$QR_WORK/phone.png"

  magick "$QR_WORK/branded.png" \
    \( "$QR_WORK/phone.png" \( +clone -background black -shadow 45x22-8+24 \) \
      +swap -background none -layers merge +repage \) \
    -gravity northwest -geometry +48+720 -compose over -composite \
    -fill '#08100DDD' -stroke '#55D98B66' -strokewidth 2 \
    -draw 'roundrectangle 965,1170 1245,1340 30,30' \
    -stroke none -fill "$QR_GREEN" -draw 'roundrectangle 1002,1206 1060,1264 10,10' \
    -font "$QR_EN_FONT" -fill white -pointsize 28 -annotate +1085+1218 'FILE' \
    -stroke '#55D98BAA' -strokewidth 5 -fill none \
    -draw 'bezier 968,1260 880,1220 850,1120 790,1100' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 960,1257 968,1257 circle 902,1230 909,1230 circle 850,1155 857,1155 circle 793,1102 801,1102' \
    -fill '#07100DDD' -stroke '#55D98B44' -strokewidth 2 \
    -draw 'roundrectangle 68,2425 398,2580 28,28 roundrectangle 495,2425 825,2580 28,28 roundrectangle 922,2425 1252,2580 28,28' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 112,2470 128,2470 circle 539,2470 555,2470 circle 966,2470 982,2470' \
    -font "$font" -fill white -pointsize 31 \
    -annotate +150+2448 "$step1" -annotate +577+2448 "$step2" -annotate +1004+2448 "$step3" \
    -fill '#07110ECC' -stroke '#55D98B55' -strokewidth 2 \
    -draw 'roundrectangle 90,2650 1230,2765 58,58' \
    -stroke none -font "$font" -fill '#DDF7E8' -pointsize 34 \
    -gravity center -annotate +0+1285 "$footer" \
    -gravity northwest -font "$font" -fill white -pointsize 100 \
    -annotate +86+190 "$title1" -fill "$QR_GREEN" -annotate +86+310 "$title2" \
    -fill '#AAB3B9' -pointsize 37 -annotate +90+455 "$subtitle" \
    -alpha off -define png:color-type=2 "PNG24:$output"
}

render_sending() {
  local source="$1"
  local output="$2"
  local font="$3"
  local eyebrow="$4"
  local title1="$5"
  local title2="$6"
  local subtitle="$7"
  local chip1="$8"
  local chip2="$9"
  local footer="${10}"

  make_base store-assets/app-store-connect/imagegen-v3-backgrounds/03-sending.png "$QR_WORK/base.png"
  add_brand "$QR_WORK/base.png" "$QR_WORK/branded.png" "$font" "$eyebrow"
  make_phone "$source" -2 "$QR_WORK/phone.png"

  magick "$QR_WORK/branded.png" \
    \( "$QR_WORK/phone.png" \( +clone -background black -shadow 50x25+0+26 \) \
      +swap -background none -layers merge +repage \) \
    -gravity northwest -geometry +300+700 -compose over -composite \
    -fill '#06100DDD' -stroke '#55D98B66' -strokewidth 2 \
    -draw 'roundrectangle 60,1360 320,1460 28,28 roundrectangle 995,1630 1260,1730 28,28' \
    -stroke none -fill "$QR_GREEN" \
    -draw 'circle 100,1410 108,1410 circle 1035,1680 1043,1680' \
    -font "$font" -fill white -pointsize 29 \
    -annotate +130+1383 "$chip1" -annotate +1065+1653 "$chip2" \
    -fill '#07110ECC' -stroke '#55D98B66' -strokewidth 2 \
    -draw 'roundrectangle 90,2580 1230,2695 58,58' \
    -stroke none -font "$font" -fill '#DDF7E8' -pointsize 34 \
    -gravity center -annotate +0+1215 "$footer" \
    -gravity northwest -font "$font" -fill white -pointsize 96 \
    -annotate +86+188 "$title1" -fill "$QR_GREEN" -annotate +86+302 "$title2" \
    -fill '#AAB3B9' -pointsize 37 -annotate +90+445 "$subtitle" \
    -alpha off -define png:color-type=2 "PNG24:$output"
}

render_home \
  store-assets/app-store-connect/raw/zh-Hans/01-home.jpg \
  store-assets/app-store-connect/zh-Hans/iphone-6.9-v3/01-home.png \
  "$QR_ZH_FONT" '离线文件传输' '没网，' '也能传文件' \
  '电脑或手机，不用共享网络也能传。' '无需账号' '无需同网' \
  '文件留在设备上 · 传输不经过云端'

render_send \
  store-assets/app-store-connect/raw/zh-Hans/02-send.jpg \
  store-assets/app-store-connect/zh-Hans/iphone-6.9-v3/02-send.png \
  "$QR_ZH_FONT" '手机互传' '选文件，' '让光替你传' \
  '选好文件，另一部手机打开“接收”即可扫描。' \
  '选择文件' '动态播放' '另一部手机扫描' '屏幕 → 镜头 · 动态二维码传输'

render_sending \
  store-assets/app-store-connect/raw/zh-Hans/03-sending.jpg \
  store-assets/app-store-connect/zh-Hans/iphone-6.9-v3/03-sending.png \
  "$QR_ZH_FONT" '动态二维码' '二维码，' '正在穿过屏幕' \
  '真实动态二维码逐帧播放，另一部手机扫描接收。' \
  '真实二维码' '暂停与重播' '全程离线 · 文件不上传'

render_home \
  store-assets/app-store-connect/raw/en-US/01-home.png \
  store-assets/app-store-connect/en-US/iphone-6.9-v3/01-home.png \
  "$QR_EN_FONT" 'OFFLINE FILE TRANSFER' 'Send files' 'without a network' \
  'From phone to phone, with no shared Wi-Fi.' 'NO ACCOUNT' 'NO SHARED WI-FI' \
  'FILES STAY ON-DEVICE · NO CLOUD UPLOAD'

render_send \
  store-assets/app-store-connect/raw/en-US/02-send-clean.png \
  store-assets/app-store-connect/en-US/iphone-6.9-v3/02-send.png \
  "$QR_EN_FONT" 'PHONE TO PHONE' 'Pick a file' 'send it as light' \
  'Choose a file. Open Receive on the other phone and scan.' \
  'CHOOSE' 'PLAY' 'SCAN' 'SCREEN → CAMERA · ANIMATED QR TRANSFER'

render_sending \
  store-assets/app-store-connect/raw/en-US/03-sending.png \
  store-assets/app-store-connect/en-US/iphone-6.9-v3/03-sending.png \
  "$QR_EN_FONT" 'ANIMATED QR' 'Animated QR' 'moving through light' \
  'Real QR frames play continuously for the other phone to scan.' \
  'REAL QR' 'PAUSE / REPLAY' 'OFFLINE TRANSFER · NO CLOUD UPLOAD'

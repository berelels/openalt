#!/bin/bash
# Monta art/demo.gif e art/screens.png a partir do que record.mjs gravou.
# uso (na raiz): art/readme/build.sh <pasta que o record.mjs usou>
# Precisa de ffmpeg e ImageMagick (convert).
set -euo pipefail
src="${1:?pasta do record.mjs}"
here="$(cd "$(dirname "$0")" && pwd)"
art="$here/.."

# GIF: 10 quadros/s, 900 px, uma paleta só para o vídeo inteiro
ffmpeg -loglevel error -y -framerate 10 -i "$src/frames/f%04d.png" \
  -vf "scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$art/demo.gif"

# Telas: cada captura com o contorno de tinta e a sombra dura do site, em 2×2 no papel
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
i=0
for f in "$src/shots/dashboard-light.png" "$src/shots/connected-dark.png" "$src/shots/away-dark.png" "$here/android-start.png"; do
  i=$((i + 1))
  convert "$f" -resize 820x -bordercolor '#26211B' -border 3 "$tmp/c$i.png"
  # sombra dura: um bloco de tinta 12 px para baixo e para a direita, atrás da captura
  w=$(identify -format '%w' "$tmp/c$i.png"); h=$(identify -format '%h' "$tmp/c$i.png")
  convert -size "$((w + 12))x$((h + 12))" xc:none \
    -fill '#26211B' -draw "rectangle 12,12 $((w + 11)),$((h + 11))" \
    "$tmp/c$i.png" -geometry +0+0 -composite "$tmp/s$i.png"
done
montage "$tmp"/s1.png "$tmp"/s2.png "$tmp"/s3.png "$tmp"/s4.png -tile 2x -geometry +36+36 -background '#EFE6D6' "$art/screens.png"
echo "art/demo.gif ($(du -h "$art/demo.gif" | cut -f1)) e art/screens.png prontos"

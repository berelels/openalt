#!/bin/sh
# Ponte prep-cmd do Sunshine -> núcleo do OpenAlt (protótipo do spike S2/S4).
# Roda onde o Sunshine roda (dentro do Flatpak ou no sistema), lê SUNSHINE_CLIENT_* do
# próprio ambiente e repassa ao núcleo no sistema. Não depende de o Sunshine usar shell.
# uso: openalt-prep.sh extend|mirror|down   (extend = "Nova tela" com o GNOME)
set -eu
NODE="/home/berelels/.nvm/versions/node/v24.18.0/bin/node"
HERE=$(cd "$(dirname "$0")" && pwd)
CORE="$HERE/../core/src/cli.ts"
LOG="$HERE/out/prep.log"

case "${1:-}" in extend|mirror|down) ;; *) echo "uso: $0 extend|mirror|down" >&2; exit 2 ;; esac

# Spike: ajudante e estado de execução dentro do projeto (no produto: /usr/libexec e $XDG_RUNTIME_DIR).
OPENALT_HELPER="$HERE/../core/helper/openalt-helper"
OPENALT_RUNTIME_DIR="$HERE/out/runtime"
export OPENALT_HELPER OPENALT_RUNTIME_DIR

if [ -f /.flatpak-info ]; then
  set -- flatpak-spawn --host \
    --env=SUNSHINE_CLIENT_WIDTH="${SUNSHINE_CLIENT_WIDTH:-}" \
    --env=SUNSHINE_CLIENT_HEIGHT="${SUNSHINE_CLIENT_HEIGHT:-}" \
    --env=SUNSHINE_CLIENT_FPS="${SUNSHINE_CLIENT_FPS:-}" \
    --env=OPENALT_HELPER="$OPENALT_HELPER" \
    --env=OPENALT_RUNTIME_DIR="$OPENALT_RUNTIME_DIR" \
    "$NODE" "$CORE" display "$1"
else
  set -- "$NODE" "$CORE" display "$1"
fi

echo "== $(date '+%F %T') $*" >> "$LOG"
"$@" >> "$LOG" 2>&1

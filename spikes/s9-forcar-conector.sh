#!/bin/sh
# Spike S9 (roda como root via pkexec): força o conector DP-1 como "conectado" por alguns
# segundos e SEMPRE volta para "detect" ao sair (fim do tempo, erro ou sinal).
set -eu
C=/sys/class/drm/card1-DP-1/status
SECS="${1:-60}"
case "$SECS" in ''|*[!0-9]*) exit 2 ;; esac
[ "$SECS" -le 120 ] || exit 2
trap 'echo detect > "$C"' EXIT
trap 'exit 1' INT TERM HUP
echo on > "$C"
sleep "$SECS"

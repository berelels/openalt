#!/bin/sh
# Spike S2: registra o que o Sunshine entrega ao prep-cmd (argumentos e variáveis SUNSHINE_*).
# Não grava segredos: só as variáveis SUNSHINE_* (resolução, fps, nome do app etc.).
OUT="$(dirname "$0")/out/s2-env.log"
{
  echo "== $(date '+%F %T') fase=${1:-?}"
  echo "argumentos: $*"
  if [ -f /.flatpak-info ]; then echo "dentro do Flatpak: sim"; else echo "dentro do Flatpak: não"; fi
  env | grep -E '^SUNSHINE_' | sort
} >> "$OUT" 2>&1

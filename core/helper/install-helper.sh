#!/bin/sh
# Instala o ajudante do OpenAlt e a regra do polkit que o libera sem senha para a sessão ativa.
# Roda como root: pelo pacote .deb (depois de instalar) ou pelo app, com a senha da pessoa (pkexec).
# uso: install-helper.sh <pasta com openalt-helper e dev.cattastudios.openalt.policy>
set -eu
src="$1"
install -Dm755 "$src/openalt-helper" /usr/libexec/openalt/openalt-helper
install -Dm644 "$src/dev.cattastudios.openalt.policy" /usr/share/polkit-1/actions/dev.cattastudios.openalt.policy

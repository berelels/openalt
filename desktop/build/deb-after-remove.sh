#!/bin/sh
# .deb: tira o ajudante e a regra do polkit junto com o app (não na atualização)
[ "$1" = "remove" ] || [ "$1" = "purge" ] || exit 0
rm -f /usr/libexec/openalt/openalt-helper /usr/share/polkit-1/actions/dev.cattastudios.openalt.policy
rmdir /usr/libexec/openalt 2>/dev/null || true

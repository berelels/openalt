#!/bin/sh
# .deb: instala o ajudante do OpenAlt e a regra do polkit (sem isso, a "Nova tela" pede senha)
sh "/opt/${sanitizedProductName}/resources/helper/install-helper.sh" "/opt/${sanitizedProductName}/resources/helper"

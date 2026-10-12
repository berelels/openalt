# ADR-0007: Licença GPL-3.0-or-later

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
O app Android será um fork do Moonlight Android (GPL-3.0), e o Sunshine é GPL-3.0. Um fork
herda a licença. O projeto quer ser de código aberto.

## Decisão
Todo o repositório usa **GPL-3.0-or-later** (`LICENSE` na raiz, `"license"` nos `package.json`).
O Sunshine **não** é redistribuído modificado; ele é instalado da fonte oficial.

## Consequências
- Quem distribuir versões modificadas precisa publicar o código.
- Dependências do PC precisam ser compatíveis com a GPL-3 (MIT, BSD, Apache-2.0 e OFL para as fontes são compatíveis).
- O nome e a marca "Moonlight" não podem ser usados como se fossem nossos: o fork terá nome e ícone próprios (OpenAlt), com os créditos.

## Ações
1. [x] `LICENSE` (GPL-3) na raiz.
2. [ ] M2: créditos ao Moonlight/Artemis e ao Sunshine na tela "Sobre".

# ADR-0006: Modelo de segurança (credenciais, interface local e pareamento por QR)

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
O OpenAlt controla um serviço que transmite a tela e **recebe entrada de teclado, mouse e toque**.
Quem parear com o Sunshine controla o PC. Os riscos principais são: alguém na mesma rede (ou
tailnet) pareando sem o usuário querer, a interface web do Sunshine com credenciais fracas, e
páginas web atacando a interface local (DNS rebinding/CSRF).

## Decisão
1. **Credenciais do Sunshine** geradas aleatoriamente (CSPRNG, ≥ 128 bits), guardadas em arquivo **0600**, **nunca** impressas em log, tela ou saída da CLI.
2. **Interface local** do OpenAlt só em `127.0.0.1`, com token por sessão e checagem do cabeçalho `Host` (contra DNS rebinding).
3. **QR de pareamento** leva um token de **uso único** e **validade curta** (proposta: 2 min), além do endereço e da impressão digital do certificado do PC. O celular só confia no PC cujo certificado bate com o QR.
4. **Nada automático:** nunca iniciar serviços de rede nem alterar a configuração do Sunshine sem o usuário pedir. Antes de editar `apps.json`/`sunshine.conf`, fazer backup.
5. Comandos externos sempre com `execFile` e argumentos em lista (sem shell); entradas como resolução são validadas (inteiros, faixas).
6. A interface web do Sunshine (porta 47990) fica restrita ao localhost (`origin_web_ui_allowed = pc`).

## Opções consideradas
- **PIN de 4 dígitos padrão do Moonlight:** funciona, mas exige digitar e não autentica o PC. O QR substitui a digitação e leva a impressão digital do certificado.
- **Token reutilizável no QR:** mais simples, mas uma foto do QR daria acesso para sempre. Descartado.

## Consequências
- Fica mais difícil: o pareamento precisa de um passo no PC (gerar QR, aceitar o pareamento do Sunshine com o PIN que o app envia).
- Rever: em cada marco, rodar a skill `security-review`.

## Ações
1. [ ] M1: gerador de credenciais e armazenamento 0600 (sem log).
2. [ ] M2: formato do QR (versão, endereço, porta, impressão digital, token, validade) e verificação no Android.
3. [ ] `security-review` antes de fechar M1, M2 e M3.

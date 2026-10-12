# ADR-0010: Sunshine com configuração própria do OpenAlt

**Status:** Aceita (suposição 1 de `docs/m1-arquitetura.md` a confirmar na implementação)
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
Muita gente que joga já usa o Sunshine, com apps, pareamentos e senha próprios. O briefing proíbe
alterar a configuração do Sunshine sem o usuário pedir. No M0 testamos em cima da configuração padrão
do Flatpak (com backup), o que não serve para o produto.
O Sunshine 2026.914 aceita o caminho do arquivo de configuração como argumento e, dentro dele,
`file_apps`, `file_state`, `credentials_file`, `cert`, `pkey`, `log_path` e `port`.

## Decisão
O OpenAlt inicia o Sunshine com **um arquivo de configuração próprio** em `~/.config/openalt/sunshine/`
(dentro do home, que o Flatpak enxerga), apontando todos os arquivos para essa pasta. A configuração da
pessoa (`~/.var/app/dev.lizardbyte.app.Sunshine/config/sunshine/`) nunca é lida nem escrita.

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| **A. Configuração própria (escolhida)** | não quebra o Sunshine de ninguém; credenciais e pareamentos só do OpenAlt | portas colidem se o Sunshine da pessoa estiver rodando |
| B. Editar a configuração padrão (com backup) | simples | altera o setup da pessoa; mistura pareamentos; viola o briefing |
| C. Flatpak separado / outra instalação | isolamento total | duplica instalação e atualização |

## Consequências
- Mais fácil: desinstalar o OpenAlt = apagar `~/.config/openalt/`.
- Mais difícil: detectar portas ocupadas e explicar; talvez usar outra porta base (`port`), a testar.
- O certificado do Sunshine do OpenAlt é o que vai no QR (`fp`).

## Ações
1. [ ] M1: gerar a configuração própria e iniciar o Sunshine com ela; conferir no log que todos os caminhos foram usados.
2. [ ] Detecção de portas ocupadas.
3. [ ] Testar porta base alternativa.

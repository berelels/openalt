# ADR-0004: Interface em Electron + TypeScript, núcleo separado em linha de comando

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
O Respiro (mesma família visual) já usa Electron, empacota em AppImage/NSIS com electron-builder
e embute as fontes Newsreader e Plus Jakarta Sans. Observação: o Respiro está em **JavaScript**,
não em TypeScript; dele vêm estilos, fontes e empacotamento, não os tipos.
O Sunshine precisa chamar o monitor virtual por linha de comando (`prep-cmd`), então essa
parte não pode depender da interface estar aberta.

## Decisão
- **Interface do PC:** Electron + TypeScript.
- **Núcleo** (monitor virtual, Sunshine, Tailscale, pareamento): pacote `@openalt/core` em TypeScript, **sem depender do Electron**, com uma CLI `openalt-core` em JSON. A interface e o `prep-cmd` do Sunshine usam a mesma CLI/módulo.
- Código por plataforma isolado em `core/src/<plataforma>/`.
- TypeScript rodando direto no Node 24 (remoção de tipos nativa, sem etapa de build); `tsc --noEmit` só para checar tipos. Por isso: só sintaxe "apagável" (`erasableSyntaxOnly`).

## Opções consideradas

### A: Electron + núcleo separado (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Baixa: stack conhecida |
| Custo | Instalador grande (~100 MB) |
| Reaproveitamento | Alto (estilos, fontes, empacotamento do Respiro) |
| Troca futura | Fácil: a interface é uma casca |

### B: Tauri já
**Prós:** instalador pequeno. **Contras:** Rust + WebKitGTK no Linux, nada reaproveitado; atrasa o M1.

### C: Núcleo dentro do processo main do Electron
**Contras:** o `prep-cmd` do Sunshine teria de falar com o app aberto; acopla tudo à interface.

## Consequências
- Fica mais fácil: testar o núcleo sem tela (executor de comandos injetável); trocar a interface por Tauri depois.
- Fica mais difícil: o AppImage precisa levar um Node para a CLI rodar fora do Electron. Opção: `ELECTRON_RUN_AS_NODE=1 <binário do app> core/cli.ts`. **Validar no M4.**
- Rever: tamanho do instalador e a remoção de tipos se o Electron usar um Node anterior ao 24.

## Ações
1. [x] `core/` com CLI `display up|down|status` e testes.
2. [ ] M1: `desktop/` em Electron chamando o núcleo.
3. [ ] M4: provar a CLI empacotada (`ELECTRON_RUN_AS_NODE`).

# ADR-0011: Sem servidor HTTP local do OpenAlt (IPC do Electron)

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios
**Complementa:** ADR-0006

## Contexto
O briefing pede "interface local só em 127.0.0.1, com token e checagem de Host" (havia uma interface
web no protótipo apagado). Com a interface em Electron, a tela e a lógica estão no mesmo app.
O Sunshine chama o `openalt-prep` sozinho, sem passar pelo app.

## Decisão
O OpenAlt **não abre porta nenhuma**. Renderer ↔ main por IPC (`contextBridge`), com `contextIsolation`,
`sandbox`, sem `nodeIntegration`, CSP sem scripts externos. O main expõe só ações de alto nível
(`ligar`, `desligar`, `parear`, `moverCelular`…), nunca comandos, caminhos ou senhas.
O que o `prep` precisa (posição, modo) fica em `~/.config/openalt/settings.json` (0600).
A única interface local é a do Sunshine, restrita ao PC (`origin_web_ui_allowed = pc`; provado 403 pela rede).

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| **A. IPC do Electron (escolhida)** | nenhuma superfície de rede nossa; sem DNS rebinding/CSRF | `prep` não conversa com o app em tempo real |
| B. HTTP em 127.0.0.1 com token + Host | permitiria uma interface no navegador | superfície a proteger; outros processos locais podem tentar |
| C. Socket Unix 0600 | sem rede; `prep` falaria com o app | mais código; útil só se precisarmos de tempo real (rever) |

## Consequências
- A exigência do briefing é atendida da forma mais forte (não há interface local nossa).
- Se no futuro o `prep` precisar avisar o app em tempo real (ex.: "celular conectou"), usar socket Unix 0600 (opção C) ou ler o log/estado do Sunshine.
- `security-review` no fim do M1 confere as opções do Electron e o IPC.

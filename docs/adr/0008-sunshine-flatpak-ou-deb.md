# ADR-0008: Sunshine em Flatpak ou nativo (.deb)

**Status:** Proposta (decidir com o spike 3)
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
Hoje o PC tem o **Sunshine em Flatpak** (`dev.lizardbyte.app.Sunshine`, 2026.914, instalação de sistema),
**parado**, com configuração de fevereiro de 2026 (de quando a sessão era Wayland). O log
daquela época mostra:
- falha de captura KMS por falta de `CAP_SYS_ADMIN` (o Flatpak não consegue esse privilégio);
- `Gamepad ds5 is disabled due to Permission denied` (falta acesso ao `/dev/uinput`).

No X11 o Sunshine pode capturar pelo próprio X11 (sem privilégio), então a captura KMS não é obrigatória.
O Flatpak pode rodar comandos no sistema com `flatpak-spawn --host` (tem permissão `org.freedesktop.Flatpak=talk`),
mas as variáveis `SUNSHINE_CLIENT_*` **não** passam para o host sozinhas.

## Opções

### A: Flatpak (já instalado)
| Dimensão | Avaliação |
|---|---|
| Instalação | Sem pacote novo; atualiza pelo Flatpak |
| `prep-cmd` | `flatpak-spawn --host` + repassar as variáveis (`--env=…` ou argumentos) |
| Entrada/gamepad | Precisa de regra udev para `/dev/uinput` (mudança de sistema, com sudo) |
| Captura | X11 apenas (sem KMS) |

### B: Nativo (.deb oficial do LizardByte)
| Dimensão | Avaliação |
|---|---|
| Instalação | `apt install ./sunshine.deb` (sudo); instala regras udev |
| `prep-cmd` | Direto, variáveis disponíveis |
| Captura | X11 ou KMS (com `setcap`) |
| Atualização | Manual ou pelo repositório deles |

## Critérios para decidir (spike 3)
1. O `prep-cmd` recebe as variáveis e consegue rodar `xrandr` no host?
2. A captura X11 pega só o monitor virtual?
3. Toque, mouse e gamepad funcionam (uinput)?
4. Quantos pedidos de senha ao usuário, no total?

Preferência inicial: **testar o Flatpak primeiro** (já está instalado, zero instalação). Se
algum critério falhar ou ficar frágil, ir para o `.deb`.

## Resultado parcial do spike 3 (2026-10-12)
Critérios atendidos até aqui, sem instalar nada: (1) sim para chamar o host com `flatpak-spawn --host`
e repassar as variáveis com `--env=` (falta ver se o Sunshine expande `$VAR`); (2) a captura X11
funciona e as telas têm id fixo (falta ver o monitor virtual de fato); (3) `/dev/uinput` já acessível ao
usuário; DualSense precisaria de `/dev/uhid` (opcional); (4) **zero** pedidos de senha até agora.
Detalhes em `docs/m0-resultados.md`. **Tendência: Flatpak.** Mantém "Proposta" até S2/S4 com cliente real.

## Ações
1. [x] Spike 3 com o Flatpak.
2. [x] S2/S4/S14 com o Moonlight do PC: `prep-cmd`, captura e `pkexec` via `flatpak-spawn` funcionam no Flatpak.
3. [ ] Entrada (toque/mouse/gamepad pelo uinput) com celular real; então mudar o status para Aceita.

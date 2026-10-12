# ADR-0005: Monitor virtual no X11 com xrandr em saída desconectada

**Status:** Substituída em parte pela ADR-0009 ("Nova tela" no GNOME). O xrandr sozinho continua valendo para o "Espelhar" e para ambientes sem GNOME. Histórico: Criação, remoção e captura pelo Sunshine provadas, mas **o GNOME ignora
saídas "disconnected"**: a área não vira monitor de verdade (ver `docs/m0-resultados.md`, S4).
Próximo passo: testar forçar o conector como conectado (`/sys/class/drm/…/status`, root) e decidir.
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
Para o modo "Nova tela", o celular precisa de um monitor de verdade para o GNOME
espalhar janelas, na resolução do aparelho. Com amdgpu no X11, uma saída "disconnected"
(ex.: DisplayPort-0) aceita um modo arbitrário criado com `cvt` + `xrandr`, sem plug,
sem reiniciar e sem mexer no GRUB. O protótipo testou 1280x800, 1080x2400, 2000x1200@90 e
1600x900, criando e removendo sem sobras.

## Decisão
- Criar: `cvt W H F` → `xrandr --newmode OA_WxH_F …` → `--addmode SAIDA` → `--output SAIDA --mode … --pos <borda direita>x0`.
- Remover: `--output … --off`, `--delmode`, `--rmmode`, apagando **tudo com prefixo `OA_`** (também limpa sobras de uma sessão que caiu, sem arquivo de estado).
- Ciclo de vida pelo Sunshine: `prep-cmd` **do** = `openalt-core display up` (lê `SUNSHINE_CLIENT_WIDTH/HEIGHT/FPS`; sem elas, 1280x720@60), **undo** = `openalt-core display down`.
- Saída escolhida: a primeira desconectada e desligada, ou a configurada.

## Opções consideradas

### A: xrandr em saída livre (escolhida)
Sem root, reversível e instantâneo. **Contra:** depende de o driver aceitar modos em saída desconectada (amdgpu aceita; Intel/NVIDIA proprietário **não testados**).

### B: Dongle HDMI "fantasma"
Funciona em qualquer GPU, mas exige hardware e não ajusta a resolução livremente.

### C: EDID falso via parâmetro do kernel (`drm.edid_firmware`)
Exige GRUB e reinício. Descartada para o padrão; pode virar plano B para outras GPUs.

### D: Xorg dummy / Xvfb
Seria outra tela X, fora da área de trabalho do usuário. Não serve para "monitor extra".

## Consequências
- Fica mais fácil: monitor na resolução exata do aparelho, criado ao conectar e removido ao desconectar.
- Fica mais difícil: suportar GPUs que recusam o modo; o mutter pode lembrar o layout (verificar `~/.config/monitors.xml` após os testes).
- Rever: spikes 2, 4 e 5 (variáveis no `prep-cmd`, Sunshine capturando só essa tela, resolução enviada pelo Moonlight).

## Ações
1. [x] `core/src/linux-x11/virtual-display.ts` com testes de unidade.
2. [ ] Teste real `display up/down` no PC (monitor aparece e some).
3. [ ] Spike 4: Sunshine capturando só o monitor virtual.

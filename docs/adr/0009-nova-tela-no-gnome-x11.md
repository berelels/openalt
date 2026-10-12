# ADR-0009: "Nova tela" no GNOME X11 com conector forçado e layout aplicado pelo mutter

**Status:** Aceita para GNOME X11 + AMD (S10 passou no PC de testes em 2026-10-12: o GNOME aceitou o modo do xrandr e o layout do usuário foi preservado). Pendentes: outras posições reais, caminho pelo Sunshine, outras GPUs.
**Data:** 2026-10-12
**Decisores:** Catta Studios
**Revê:** ADR-0005

## Contexto
O spike S4 mostrou que o xrandr sozinho não basta: o GNOME (mutter) **descarta saídas
"disconnected"**, então a área do monitor virtual fica preta, sem painel e sem maximizar.
O spike S9 mostrou que, forçando o conector do kernel como conectado
(`/sys/class/drm/<conector>/status = on`, root), o mutter passa a tratá-lo como monitor,
mas (a) só com 640x480, sem EDID, e (b) **rearranja os monitores do usuário** no hotplug.

Requisito do usuário: o celular pode ficar **à direita, à esquerda, acima ou abaixo de qualquer
monitor**, alinhado no início, no centro ou no fim, inclusive **entre** dois monitores.

## Decisão
Fluxo `display extend` (`core/src/linux-x11/extend.ts`):
1. Ler o layout atual do mutter (`GetCurrentState` via `busctl --json`) **antes** de mexer, e calcular e validar o layout final (`core/src/layout.ts`: sem sobreposição, sem monitor solto, origem em 0,0). Posição impossível falha aqui, sem mudar nada.
2. Ligar a saída do xrandr ao conector do kernel pelo `CONNECTOR_ID` (ex.: `DisplayPort-0` = 435 = `card1-DP-1`).
3. Forçar o conector com o **ajudante root** `core/helper/openalt-helper`, que só aceita conectores **desconectados** e só faz `on`/`detect`.
4. Adicionar o modo do celular (`cvt` + `xrandr --newmode/--addmode`) e esperar o mutter listá-lo.
5. Aplicar pelo mutter (`ApplyMonitorsConfig`, método **temporário**, sem gravar `monitors.xml`) os monitores do usuário **nas posições de antes** e o celular onde foi pedido.
6. Desfazer: `detect` no conector (o mutter restaura sozinho) e apagar os modos `OA_`. Os conectores forçados ficam anotados em `$XDG_RUNTIME_DIR/openalt/` para limpar mesmo depois de uma queda.

O "Espelhar" continua pelo truque do xrandr (saída desconectada sobreposta ao monitor escolhido,
que agora pode ser **qualquer** um: `display mirror --of MONITOR`), sem precisar de root.

### Permissão
Política polkit `dev.cattastudios.openalt.connector` com `allow_active=yes`, restrita ao
executável `/usr/libexec/openalt/openalt-helper`: **uma senha na instalação**, nenhuma depois.
Risco aceito: qualquer programa da sessão ativa pode forçar uma saída **desconectada** como
conectada (efeito: um monitor fantasma até `detect`). Não alcança monitores reais nem outros arquivos.

## Atualização (S11/S12): EDID do OpenAlt
Sem EDID, cada sondagem da saída forçada trava o X ~4,3 s (o kernel tenta ler um monitor inexistente).
Decisão: o ajudante grava um EDID gerado pelo OpenAlt (`debugfs edid_override`) junto com o `on` e o apaga
no `detect`. Reserva: modo pelo xrandr quando não houver debugfs. **S12c passou** (ligar e desligar, sem travadas). Desligar exige, no amdgpu: apagar o EDID → `detect` → desplugar simulado (`trigger_hotplug`) → `detect`.

## Opções consideradas
- **Só xrandr (ADR-0005):** não funciona no GNOME. Mantido como `display up` para outros ambientes.
- **EDID do OpenAlt** (`edid_override` no debugfs, root): adotado (ver atualização acima).
- **Adaptador "dummy" HDMI/DP:** funciona sem root, mas exige hardware e não ajusta a resolução livremente.
- **GNOME Wayland:** tem monitores virtuais nativos (ScreenCast "virtual"); é o M6.

## Riscos a testar (spike S10)
1. ✅ O mutter aceita o modo criado pelo xrandr numa saída que ele gerencia (S10). Detalhe: forçar o conector não avisa o X; é preciso `xrandr --query` para o X sondar as saídas.
2. O rearranjo do hotplug pisca na tela por quanto tempo antes do nosso layout?
3. ✅ `pkexec` chamado pelo Sunshine Flatpak (`flatpak-spawn --host`) funciona (S14).
4. ✅ O Sunshine captura o monitor do celular com `output_name = 0` (S14).

## Ações
1. [x] `layout.ts`, `mutter.ts`, `drm.ts`, `extend.ts`, CLI `extend|layout|mirror --of|down` e testes (32 passando).
2. [x] `openalt-helper` + política polkit (não instalados).
3. [x] S10: teste real à direita do principal (passou).
4. [x] `display move`: muda o celular de lugar sem senha, a partir do arranjo original (59 testes).
5. [x] S13: posições de verdade e janela maximizada (passou).
6. [x] Caminho pelo Sunshine (S14: passou, inclusive o pkexec chamado do Flatpak).
7. [ ] Instalar a política polkit só no pacote final (decisão do usuário).

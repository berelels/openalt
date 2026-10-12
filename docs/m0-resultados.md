# M0: resultados dos spikes

Ambiente: Zorin OS 18.1, GNOME 46 em X11, AMD RX 6600 (Mesa 26.2.2, kernel 7.0.0-28), Node 24.18.0.
Monitores: HDMI-A-0 1440x900 (x=0) e DisplayPort-2 1920x1080 primário (x=1440). Saídas livres: DisplayPort-0 e DisplayPort-1.

---

## S0: monitor virtual real ✅ PASSOU (2026-10-12)

Feito com a CLI do núcleo (`node core/src/cli.ts display up|status|down`), não com comandos soltos.

| Pedido | Resultado | Tela X total | Sobras `OA_` depois do `down` |
|---|---|---|---|
| 1080x2400@60 | DisplayPort-0, x=3360 | 4440x2400 | 0 |
| 1280x800@60 | DisplayPort-0, x=3360 | 4640x1080 | 0 |
| 2000x1200@90 | DisplayPort-0, x=3360 | 5360x1200 | 0 |
| sem parâmetros | 1280x720@60 (padrão) | 4640x1080 | 0 |
| variáveis `SUNSHINE_CLIENT_*` 2400x1080@120 | criado com 120 Hz | — | 0 |
| `up` em seguida com `$SUNSHINE_CLIENT_WIDTH` literal (não expandido) | limpou o anterior e caiu para 1280x720@60 | — | 0 |

Depois de todos os ciclos:
- `xrandr` com o mesmo layout de antes (posições e resoluções idênticas), e a tela X voltou a 3360x1080.
- `~/.config/monitors.xml` **não mudou** (hash igual) — o GNOME não gravou o monitor virtual.

**Observação em aberto:** depois da primeira bateria (6 ciclos), uma janela do Nautilus maximizada
no monitor principal apareceu maximizada no HDMI-A-0. Repeti um ciclo (1080x2400) observando todas as
janelas antes, durante e depois: **nenhuma mudou**. Não deu para saber se foi o teste ou o usuário.
Rever no M1 com mais janelas abertas (a tela X fica 2400 px de altura no modo retrato; pode ser o gatilho).

---

## S3: Sunshine em Flatpak ✅ PASSOU, com ressalvas (2026-10-12)

Versão: `dev.lizardbyte.app.Sunshine` 2026.914.233613 (commit 63d35f7), runtime KDE 6.11.

Feito, com autorização:
1. Backup de toda a configuração em `.backup/sunshine-20261012-1434/` (0700) + checksums conferidos.
2. Credenciais novas aleatórias (usuário `openalt`, senha de 192 bits) em `.secrets/sunshine-web.json` (0600). A senha não aparece em texto puro em nenhum arquivo do Sunshine (só o hash com salt em `sunshine_state.json`).
3. `sunshine.conf`: `origin_web_ui_allowed = pc`, `capture = x11`.
4. Iniciado em segundo plano, testado e **parado** (portas fechadas no fim).

Resultados:
- **Encoder:** VAAPI por hardware (RX 6600): **H.264 e HEVC**. AV1 não existe nessa GPU (esperado). NVENC e Vulkan falham, o que é normal.
- **Captura:** X11 (sem KMS, então o `CAP_SYS_ADMIN` que falta no Flatpak não importa). Sem `output_name`, ele grava a **área de trabalho inteira** (aviso no log) → para "Nova tela" é **obrigatório** definir a tela.
- **Telas detectadas** pelo nome da saída, com id fixo: `DisplayPort-0 = 0`, `DisplayPort-1 = 1`, `DisplayPort-2 = 2`, `HDMI-A-0 = 3`. Inclui saídas desconectadas, então o id do monitor virtual (0) é conhecido **antes** de ele existir. (Se o Sunshine re-detecta quando o monitor é criado depois de iniciado → S4.)
- **Portas:** TCP 47984, 47989, 47990, 48010 em 0.0.0.0. Anuncia o PC na rede por Avahi/mDNS.
- **Interface web:** `localhost` + credenciais = 200; `localhost` sem credenciais = 401; pelo IP da rede (192.168.1.100), mesmo com credenciais = **403**. Restrição funcionando.
- **Entrada:** `/dev/uinput` já tem ACL de leitura/escrita para o usuário → mouse/teclado/toque e gamepad tipo Xbox devem funcionar **sem regra udev** (não testado sem cliente). `/dev/uhid` é só root → emulação de DualSense não funciona sem a regra do `additional-install.sh` (precisa de pkexec; deixar opcional).
- Avisos sem efeito prático: `CAP_SYS_NICE` (prioridade do contexto EGL), sessão Qt.

### `prep-cmd` dentro do Flatpak (parte do S2 que dá para testar sem cliente)
- `xrandr` **não existe** dentro do sandbox → é preciso `flatpak-spawn --host`. Funciona.
- O ambiente **não** passa para o host sozinho; com `--env=VAR="$VAR"` (ou como argumento) passa. ✅
- `node` (nvm) **não** está no PATH do host visto pelo `flatpak-spawn` → usar caminho absoluto (no produto, o runtime empacotado; ADR-0004).
- O núcleo rodou chamado de dentro do sandbox: `flatpak-spawn --host <node> core/src/cli.ts display status` → `{"ok":true,"displays":[]}`.
- **Ainda não se sabe** se o Sunshine passa o `prep-cmd` por um shell (que expande `$VAR`). Desenho que não depende disso: um script em `~` (o Flatpak enxerga o home) que roda **dentro** do sandbox, lê `SUNSHINE_CLIENT_*` do próprio ambiente e chama `flatpak-spawn --host --env=… <node> cli.ts display up`. No `.deb`, o mesmo script chama o núcleo direto.

### Notas de segurança
- `sunshine --creds USUÁRIO SENHA` põe a senha na linha de comando do processo por alguns milissegundos (visível em `/proc` para outros usuários locais). Aceitável no spike (PC de um usuário só); no M1, trocar pela API do primeiro acesso (`/api/password`) via HTTPS local, ou gravar o hash direto.
- `sunshine_state.json` fica 0644 (é o Sunshine que cria). Contém só hash + salt, mas o M1 deve deixá-lo 0600.
- O Avahi anuncia o PC na rede local sempre que o Sunshine está ligado. Parear ainda exige PIN.

---

## Cliente de teste no próprio PC (2026-10-12)
Moonlight PC 6.2.0 (Flatpak `com.moonlight_stream.Moonlight`, instalação de usuário, sem senha), conectando
em `127.0.0.1`. Serve para S2/S4 e parte do S5; **não** serve para medir latência (é local).

**Pareamento automatizado** (base do QR no M2): `moonlight pair 127.0.0.1 --pin NNNN` → `GET /api/pin`
lista os pedidos pendentes (`{address, id, name}`) → `POST /api/pin {pairing_id, pin, name}` → `{"status":true}`.
Nesta versão o PIN fica **amarrado a um pedido específico** (`pairing_id` de 32 hex), o que é mais seguro.
O `moonlight pair` da linha de comando não termina sozinho depois de parear (precisa ser encerrado).
Cliente pareado no Sunshine: `moonlight-pc-spike` (continua pareado; remover com `/api/clients/unpair`).

Apps de teste registrados no `apps.json` (backup antes em `.backup/sunshine-20261012-1445-antes-s2/`):
`OA S2 env`, `OA Nova tela`, `OA Espelhar`. `sunshine.conf` ganhou `output_name = 0`.

## S2: variáveis no `prep-cmd` ✅ PASSOU
- O Sunshine põe no **ambiente** do comando: `SUNSHINE_CLIENT_WIDTH=1080`, `HEIGHT=2400`, `FPS=60`, e também `SUNSHINE_APP_ID`, `SUNSHINE_APP_NAME`, `SUNSHINE_CLIENT_NAME`, `…_HDR`, `…_HOST_AUDIO`, `…_AUDIO_CONFIGURATION`, `…_GCMAP`, `…_ENABLE_SOPS`. Iguais no `undo`.
- **Não há shell:** `$VAR` e `${VAR}` chegam literais. `$(VAR)` é expandido pelo Sunshine, mas **vazio** (usa o ambiente do Sunshine, não o do cliente).
- O comando roda **dentro do Flatpak**.
- **Conclusão:** a ponte `spikes/openalt-prep.sh` (lê o próprio ambiente e chama `flatpak-spawn --host --env=…`) é o desenho certo. Funcionou de ponta a ponta.

## S4: o Sunshine captura só o monitor virtual ✅ PASSOU (com um problema grave no GNOME, abaixo)
- O Sunshine **detecta as telas de novo a cada sessão**, depois do `do`. Log: `Streaming display: DisplayPort-0 with res 1080x2400 offset by 3360x0`.
- Criado ao conectar, removido ao desconectar, sem sobras.
- Com `output_name = 0` e o monitor desligado na inicialização, o Sunshine cai para "área de trabalho inteira" só no teste de encoder; na sessão, pega a tela certa.

### ❌ Problema: o GNOME (mutter) ignora o monitor virtual
- O mutter lista só `DisplayPort-2` e `HDMI-A-0` (`org.gnome.Mutter.DisplayConfig.GetCurrentState`). Saídas com estado **disconnected** são descartadas por ele, mesmo ligadas pelo xrandr.
- Efeito: a área existe no X (a tela X cresce, o mouse entra, uma janela movida para lá **aparece e é capturada**), mas **sem fundo (preto), sem painel, sem maximizar e sem janelas abrindo lá**. Não serve como "monitor extra" de verdade.
- O protótipo tinha provado a parte do xrandr, não a do GNOME.
- Conectores DRM: `card1-DP-1` e `card1-DP-2` desconectados (provavelmente `DisplayPort-0/1` no xrandr), `card1-DP-3` e `card1-HDMI-A-1` conectados. O kernel permite forçar `status` em `/sys/class/drm/<conector>/status` (`on`/`detect`), mas **só como root**.
- **Próximo teste (precisa de autorização):** forçar `card1-DP-1` como conectado em tempo de execução (`echo on > …/status`), ver se o mutter passa a tratá-lo como monitor, e voltar com `detect`. Sem reiniciar e sem GRUB. Se funcionar, o produto precisa de um pequeno ajudante com permissão (polkit), instalado uma vez.

## S9: forçar o conector como conectado ⚠️ FUNCIONA EM PARTE (2026-10-12, 15:03)
Com autorização, via um único `pkexec` (`spikes/s9-forcar-conector.sh`: grava `on` em
`/sys/class/drm/card1-DP-1/status` por 60 s e **sempre** volta para `detect` ao sair).
- `card1-DP-1` = `DisplayPort-0` no xrandr (confirmado: só ele mudou para "connected").
- ✅ O **mutter passou a ver** `DisplayPort-0` como monitor físico **e lógico**, e o ligou sozinho.
- ⚠️ Sem EDID, o kernel só oferece **640x480**. A resolução do celular teria de vir de um modo nosso (xrandr) ou de um EDID falso.
- ⚠️ No hotplug, o mutter aplicou o **layout padrão dele** e **rearranjou os monitores do usuário** durante o teste: DisplayPort-2 foi para x=0, o novo para x=1920 e HDMI-A-0 para x=2560 (antes: HDMI em 0 e DisplayPort-2 em 1440).
- ✅ Ao voltar para `detect`, o mutter restaurou o layout original sozinho; `monitors.xml` não mudou; nada sobrou.
- O passo "pôr o nosso modo" não rodou, porque o mutter já tinha ligado a saída (640x480).

**Caminho provável para "Nova tela" no GNOME X11:**
1. forçar o conector (root, por um ajudante com polkit instalado uma vez);
2. dar a ele a resolução do aparelho: `--newmode/--addmode` pelo xrandr (falta ver se o mutter aceita modos adicionados assim) **ou** um EDID gerado com a resolução do celular (`edid_override` no debugfs, root);
3. aplicar o layout pelo próprio mutter (`org.gnome.Mutter.DisplayConfig.ApplyMonitorsConfig`): monitores do usuário onde estavam e o novo à direita, para não haver rearranjo;
4. no fim, `detect` (o mutter restaura sozinho).

## S10: "Nova tela" pelo GNOME — 1ª tentativa ❌ (2026-10-12, intervalo da aula)
- Falhou antes de mudar qualquer coisa: o núcleo limitava todo comando a 10 s e o `pkexec` fica esperando a senha; aos 10 s o Node tentou encerrá-lo (`kill EPERM`) e desistiu. A limpeza automática rodou.
- Estado depois: layout original, `monitors.xml` igual, `card1-DP-1` desconectado, nenhum `pkexec` pendente, nenhum `OA_`.
- Correção: `Runner` aceita `timeoutMs`; o `pkexec` espera até 2 min. Teste de regressão adicionado.
- O fluxo em si (GNOME aceitar o modo, layout aplicado) **ainda não foi testado**.

## S10 — 2ª tentativa ❌ (16:11)
- A senha passou e o ajudante forçou `card1-DP-1` (log do polkit às 16:11:43), mas o GNOME **não listou** `DisplayPort-0` em 8 s; o código desfez tudo sozinho (`detect` às 16:12:08). Estado final limpo (layout, `monitors.xml`, conector).
- Causa (pelo log do kernel): forçar o conector **não avisa o X**. No S9, a primeira sondagem ("No EDID found on connector: DP-1") foi exatamente quando o observador rodou `xrandr --query` (15:03:25). No S10 ninguém rodou, e as sondagens periódicas do kernel (a cada ~4,5 s) não fazem o X atualizar as saídas.
- Correção: durante a espera, o núcleo roda `xrandr --query` (RRGetScreenResources faz o X sondar na hora); espera máxima subiu para 15 s. Teste de regressão adicionado.

## S10 — 3ª tentativa ✅ PASSOU (16:2x, intervalo da aula)
`display extend --width 1080 --height 2400` (padrão: à direita do principal), com `pkexec` pedindo senha.
- O GNOME passou a ter **3 monitores lógicos**: `DisplayPort-0` em (3360,0) com o modo **`1080x2400@59.961`** (o modo criado pelo xrandr **foi aceito** pelo mutter), e os do usuário **nas posições de antes** (HDMI-A-0 em 0,0; DisplayPort-2 principal em 1440,0).
- Na área do monitor novo aparece a **barra de apps do Zorin** → o GNOME o trata como monitor de verdade (no S4 a área era preta e vazia).
- `display down`: `released: ["card1-DP-1"]`, `removed: ["OA_1080x2400_60"]`; GNOME de volta a 2 monitores nas posições originais; `monitors.xml` igual; conector desconectado.
- Tempo total do `extend`: 33 s, quase tudo esperando a senha.

**Relato do usuário:** a tela pisca brevemente e há um instante todo preto (só o mouse aparece).
Causa: o GNOME reconfigura duas vezes (arranjo padrão dele no hotplug, depois o nosso); no X11 cada
reconfiguração redimensiona a área de trabalho e o compositor redesenha. O principal **não** muda
(DisplayPort-2 continuou principal no meio do teste; o núcleo copia o principal do estado anterior;
teste de regressão adicionado). Melhoria aplicada (não testada): criar o modo antes de ligar a saída.
Melhoria possível (precisa de autorização: grava no `monitors.xml` do GNOME): salvar uma vez o arranjo
"com celular" para o GNOME aplicá-lo direto no hotplug → uma piscada só.

Ainda não testado: quanto tempo a tela pisca no hotplug antes do nosso layout; outras posições (entre monitores, acima, abaixo) de verdade; o caminho pelo Sunshine (`pkexec` chamado via `flatpak-spawn`); a captura pelo Sunshine com esse layout; maximizar/abrir janela no monitor novo; o fundo (a captura veio preta, pode ser o papel de parede).

## S11: arranjo salvo no GNOME ✅ (resultado diferente do esperado) (16:45, intervalo)
Backup do `monitors.xml`: `.backup/gnome-monitors-20261012-164549.xml`.
- **Nas duas rodadas o GNOME já aplicou sozinho o arranjo pedido** (`applied: false`): o núcleo não reconfigurou nenhuma vez. Por isso o `--remember` nem gravou nada: `monitors.xml` com o **mesmo hash** do original (4 arranjos salvos antes e depois).
- Explicação provável: com o modo criado **antes** de ligar a saída (melhoria do S10), o arranjo padrão do GNOME no hotplug (monitor novo à direita de tudo, na resolução disponível) coincide com "à direita do principal". Para outras posições (entre monitores, acima, abaixo) o GNOME não vai acertar sozinho, e aí o `--remember` deve fazer diferença: **não testado**.
- Reconfigurações (`MonitorsChanged`): 8 no total para 4 operações (2 ligar + 2 desligar). A contagem por fase se perdeu (bug no registro: o `gdbus monitor` sobrescrevia as marcações; corrigido para `>>`). Hipótese: em cada operação, 1 anúncio vem do `--newmode/--rmmode` (sem efeito visual) e 1 do hotplug (a piscada).
- Final limpo: layout original, conector desconectado, nenhum `OA_`.

### Relato do usuário sobre o S11 e causa
"Piscou uma vez só, congelou por 5 segundos, ficou preto e depois voltou." Pelo log do kernel: com a saída
forçada e sem EDID, cada sondagem tenta ler um monitor que não existe e espera o tempo esgotar —
**~4,3 s com o X travado** (linhas "No EDID found on connector: DP-1", uma a cada ~4,35 s, 6 por rodada,
a primeira exatamente 4,3 s depois do `on`). O núcleo ainda repetia `xrandr --query` em loop enquanto esperava.

**Correção (código pronto, 55 testes; teste real pendente, S12):**
- `core/src/edid.ts` gera um **EDID** (EDID 1.4, fabricante "OAL", nome "OpenAlt", resolução do celular como
  preferida, tirada do `cvt`). O ajudante root o grava em `debugfs .../edid_override` ao ligar (`on --edid-stdin`,
  pela entrada padrão; confere tamanho, cabeçalho e soma) e o apaga no `detect`. Sem leitura de monitor
  inexistente, a sondagem deve ser instantânea; o GNOME vê "OpenAlt" e a resolução certa sem xrandr.
- Se o PC não tiver debugfs/EDID (saída 5 do ajudante), volta ao modo pelo xrandr.
- Sondagem do X no máximo a cada 2 s durante a espera (antes: em loop).
- Kernel do PC de testes: `lockdown` = none (debugfs gravável pelo root).

## S12: EDID do OpenAlt ⚠️ ligar ✅ / desligar ❌ (corrigido) (intervalo da aula)
- **Ligar ✅:** 0 sondagens lentas (antes 6 por rodada); uma sondagem `xrandr --query` levou **0,00 s** (antes ~4,3 s com o X travado). O GNOME viu o monitor como **"OAL OpenAlt"** com `1080x2400@59.961`, à direita do principal, principal mantido. 4 `MonitorsChanged` ao ligar.
- **Desligar ❌:** o ajudante fazia `detect` antes de apagar o EDID; com o EDID, o amdgpu cria um monitor simulado e o mantém **conectado** mesmo no automático. Duas limpezas falharam (ordem; e `echo reset` manda "reset\n", que o debugfs recusa com I/O error — precisa ser exatamente "reset").
- **Limpeza que funcionou:** `printf reset > edid_override` + `echo 0 > /sys/kernel/debug/dri/1/DP-1/trigger_hotplug` (desplugar simulado do amdgpu) + `detect` → desconectado. Levado para o ajudante, que agora também confere e falha (saída 7) se continuar conectado. **Não testado** pelo fluxo completo.
- Custou 3 senhas a mais ao usuário. `monitors.xml` igual; nada sobrando.
- ⚠️ **Efeito colateral:** o vídeo do Zoom do usuário travou (áudio seguiu) depois das várias reconfigurações. Testes que reconfiguram telas não devem rodar durante reuniões/aulas, nem nos intervalos.
- `trigger_hotplug` é do amdgpu: Intel/NVIDIA precisarão de outro jeito (registrado em `docs/compatibilidade.md`).

## S12b: ligar/desligar completo com EDID ⚠️ (outro intervalo)
- **Ligar ✅✅:** `applied: false` (o GNOME acertou o arranjo sozinho), só **2** `MonitorsChanged`, 0 sondagens lentas, sondagem em 0,00 s.
- **Desligar ❌:** o ajudante simulava o desplugar (`trigger_hotplug`) **antes** do `detect`, com a saída ainda forçada; o amdgpu ignora o desplugar nesse estado. Saída 7 do ajudante ("continuou conectado") funcionou como alarme.
- **Correção:** `reset` do EDID → `detect` → se ainda conectado, desplugar simulado → `detect` de novo (até 3 s) → conferir. Rodada isolada a partir do estado que sobrou: **desconectou** (1 senha). O fluxo completo ligar→desligar com essa ordem ainda **não** foi testado de ponta a ponta.

## S12c: ligar/desligar completo com EDID ✅ PASSOU (outro intervalo)
- Ligar: `applied: false`, **2** `MonitorsChanged`, 0 sondagens lentas, sondagem 0,00 s, monitor "OAL OpenAlt" 1080x2400 à direita do principal.
- Desligar: `released: ["card1-DP-1"]` na primeira tentativa, **2** `MonitorsChanged`; conector desconectado; GNOME de volta aos 2 monitores nas posições originais; `monitors.xml` igual; registro de conectores forçados vazio.
- 2 senhas no total (ligar e desligar), como planejado.
- **Percepção do usuário:** "só piscou, não congelou nada, só na hora das duas senhas". Parte da piscada pode ser o próprio diálogo do polkit (o GNOME escurece a tela ao pedir senha); com a política polkit instalada não haverá diálogo — medir de novo então.

## S13: posições de verdade + janela maximizada ✅ PASSOU
2 senhas (ligar e desligar); as 4 mudanças de posição (`display move`) não pediram senha.
| Posição | GNOME = calculado | `MonitorsChanged` |
|---|---|---|
| ligar, à direita do principal (`applied: false`) | ✅ | 2 |
| entre os monitores (27" se afasta para x=2520) | ✅ | 2 |
| acima do principal, centro (celular em 1860,0; monitores descem 2400) | ✅ | 5 |
| abaixo do secundário, fim (celular em 360,900; 27" volta a 1440) | ✅ | 5 |
| de volta ao padrão | ✅ | 3 |
| desligar | — | 2 |
- Principal (DisplayPort-2) mantido em todas.
- Janela de teste do OpenAlt maximizada no monitor do celular: posição 3360,0, largura 1080 (altura útil 2364 + decoração) → o monitor é utilizável de verdade.
- Final limpo: 2 monitores nas posições originais, conector desconectado, `monitors.xml` igual.
- Observação: mudanças que deslocam os monitores na vertical geram mais reconfigurações (5); impacto visual a confirmar com o usuário.

## S14: "Nova tela" pelo Sunshine, de ponta a ponta ✅ PASSOU (durante reunião do usuário, a pedido dele)
Moonlight do PC (`com.moonlight_stream.Moonlight`) pedindo 1080x2400@60 no app "OA Nova tela"; cliente **mudo**
(`SDL_AUDIODRIVER=dummy`) e `--audio-on-host` para não mexer no áudio do PC.
- 17:57:13 `Executing Do Cmd: openalt-prep.sh extend` → o núcleo recebeu `SUNSHINE_CLIENT_*` = 1080x2400@60, ligou a saída com EDID, `applied: false`.
- **`pkexec` chamado de dentro do Flatpak do Sunshine (via `flatpak-spawn --host`) funcionou** (diálogo de senha normal).
- 17:57:18 `CLIENT CONNECTED`; Sunshine detectou `DisplayPort-0 connected: true` e **`Streaming display: DisplayPort-0 with res 1080x2400 offset by 3360x0`**.
- 17:58:01 `Executing Undo Cmd: openalt-prep.sh down` → `released: ["card1-DP-1"]`.
- Saída de áudio do PC inalterada (Bluetooth) antes, durante e depois.
- **Confirmação visual do usuário:** "cheguei o mouse pro lado e apareceu" — o cursor, levado para a direita do monitor principal, entrou no monitor do celular e apareceu na janela do Moonlight (o "celular"). É a "Nova tela" funcionando de ponta a ponta.
- Final: 2 monitores originais, conector desconectado, `monitors.xml` igual, Sunshine parado, portas fechadas.
- O usuário relatou no S13: "piscou um pouco mais, mas tudo certo"; o Zoom travou e foi reiniciado.

## Espelhar ✅ PASSOU
`display mirror` cria o virtual **por cima** do principal (mesmo tamanho e posição). Log:
`Streaming display: DisplayPort-0 with res 1920x1080 offset by 1440x0`. Assim "Nova tela" e "Espelhar"
usam o **mesmo** `output_name = 0` (o Sunshine só aceita a tela na configuração global, não por app).
Como o mutter ignora a saída, sobrepor ao principal não atrapalha nada.

## Áudio nos dois aparelhos ✅ (parcial)
- Sem "áudio no host": o Sunshine troca a saída padrão do PC para `sink-sunshine-stereo` durante a sessão (o PC fica mudo) e volta no fim.
- Com `--audio-on-host` (`SUNSHINE_CLIENT_HOST_AUDIO=true`): a saída do PC **não muda** (continuou nos fones Bluetooth), o Sunshine iniciou o Opus e o Moonlight abriu o stream de áudio. O usuário ouviu um **eco em loop distorcido**: o Moonlight, rodando no mesmo PC, tocava o stream na mesma saída que o Sunshine captura (realimentação). Isso **confirma que o áudio chega ao cliente**; o eco é artefato do teste local e não deve ocorrer com o celular. Confirmar de ouvido no S7.
- Requisito do usuário: áudio no celular **e** no PC → o app deve ligar "áudio no host" por padrão.

## S5 (parcial)
O Moonlight PC manda exatamente o que foi pedido (1080x2400, retrato). O Moonlight **Android** continua não testado.

## Outros achados
- Sem `CAP_SYS_NICE` no Flatpak: `setpriority failed` (prioridade de threads). Efeito na latência: não medido.
- Bitrate padrão do cliente: ~20–26 Mbps; codec negociado HEVC.

## Ainda não testado
S1, S5 no Android, S6 (fora de casa), S7 (latência real, toque, gamepad), áudio de ouvido no cliente,
e o GNOME tratando o monitor virtual como monitor.

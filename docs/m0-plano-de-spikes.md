# M0: plano dos spikes

Objetivo do M0: transformar cada premissa do briefing em **fato medido** antes do M1. Cada spike
tem pré-requisitos, passos, critério de **passou/falhou** e o que anotar. Os resultados vão em
`docs/m0-resultados.md`, um bloco por spike, com data, versões e números.

Legenda dos pré-requisitos: 👤 = ação do usuário · 🔐 = precisa de autorização (mudança de sistema) · 🤖 = posso fazer sozinho.

---

## Camadas de teste do projeto (vale além do M0)

| Camada | O que cobre | Como roda | Situação |
|---|---|---|---|
| Unidade | Parsers do `xrandr`/`cvt`, validação de resolução, escolha de saída, ordem dos comandos, limpeza de sobras; depois: token do QR, configuração do Sunshine | `npm test` (executor de comandos falso, não mexe na tela) | **existe** para o monitor virtual |
| Integração local | CLI `openalt-core` contra o X11 real; edição do `apps.json` em cópia | manual, com `OPENALT_REAL_X11=1` | a fazer |
| Ponta a ponta | Celular real: parear, abrir "Nova tela", espelhar, desligar; em casa e fora | roteiro manual deste documento | a fazer (M0) |
| Segurança | Credenciais fora de logs, 0600, Host/token, QR expirado ou reusado | unidade + `security-review` por marco | a fazer (M1/M2) |

Fora do escopo de teste automático: o protocolo do Moonlight/Sunshine (código de terceiros).

---

## Ordem e dependências

```
S0 monitor virtual real ─┐
S1 celular no adb ───────┼─► S3 Sunshine Flatpak ─► S2 variáveis no prep-cmd ─► S5 resolução do Moonlight
                         │                        └► S4 captura do monitor virtual ─► S7 qualidade/toque/gamepad
Tailscale logado (PC+cel)┴──────────────────────────────────────────────────────────► S6 fora de casa (4G/5G)
S8 pesquisa (tsnet / WebRTC) — independente, só leitura
```

---

## S0: monitor virtual real (pré-condição de tudo)
- **Pré:** 🤖 nenhum (só `xrandr`, reversível; já provado no protótipo).
- **Passos:** `openalt-core display up --width 1080 --height 2400`; conferir que o GNOME mostra a terceira tela à direita; `display status`; `display down`; repetir com 1280x800, 2000x1200@90 e sem parâmetros (deve dar 1280x720@60).
- **Passou se:** a tela aparece na posição certa e, depois do `down`, `xrandr --query | grep -c OA_` = 0, e as outras telas não mudaram de posição nem de resolução.
- **Anotar:** se o GNOME reposiciona janelas; se o `~/.config/monitors.xml` mudou (comparar o hash antes e depois).

## S1: celular Android de verdade
- **Pré:** 👤 plugar o celular por USB, ativar "Depuração USB" e aceitar a chave do PC no aparelho. 👤 instalar o **Moonlight oficial pela Play Store** (para o M0 não precisamos do nosso fork).
- **Passos:** `adb devices -l`; anotar o modelo, a versão do Android e a resolução nativa (`adb shell wm size`, `wm density`) e a taxa da tela (`dumpsys display | grep -i refresh`).
- **Passou se:** o aparelho aparece como `device`.
- **Observação:** o adb serve só para diagnóstico. O streaming é por rede (Wi-Fi/Tailscale), não pelo cabo.

## S3: Sunshine em Flatpak (ADR-0008)
- **Pré:** 🔐 autorização para **iniciar o Sunshine** e **alterar a configuração dele** (o backup é feito antes). 🔐 provavelmente: regra udev para `/dev/uinput` (com sudo), necessária para toque/mouse/gamepad.
- **Passos:**
  1. Backup de `~/.var/app/dev.lizardbyte.app.Sunshine/config/sunshine/` (tudo) para `OpenAlt/.backup/sunshine-AAAAMMDD-HHMM/` (fora do git, 0700).
  2. Credenciais novas aleatórias (as de fevereiro são desconhecidas), gravadas em arquivo 0600 dentro do projeto, sem aparecer na tela.
  3. `sunshine.conf`: `origin_web_ui_allowed = pc`, `capture = x11`.
  4. Iniciar e ler o log: encoder encontrado (VAAPI na RX 6600), lista de monitores X11.
- **Passou se:** o Sunshine sobe sem `Fatal`, encontra um encoder por hardware e lista os monitores.
- **Anotar:** versão, encoder escolhido, quantos pedidos de senha foram necessários.

## S2: o Sunshine entrega `SUNSHINE_CLIENT_*` ao `prep-cmd`?
- **Pré:** S3 + S1 (Moonlight pareado por PIN, em casa).
- **Passos:** um app de teste no `apps.json` cujo `do` é
  `flatpak-spawn --host /…/OpenAlt/spikes/s2-env.sh` (o script grava num arquivo do projeto só as variáveis `SUNSHINE_*` recebidas, sem segredos). Testar três formas: (a) variáveis no ambiente do host, sem fazer nada; (b) `--env=SUNSHINE_CLIENT_WIDTH=$SUNSHINE_CLIENT_WIDTH`; (c) como argumentos (`… "$SUNSHINE_CLIENT_WIDTH"`).
- **Passou se:** pelo menos uma forma entrega os números certos ao host.
- **Anotar:** qual forma funcionou, se o Sunshine usa shell (expande `$VAR`) e quais variáveis vieram.

## S5: o Moonlight manda a resolução nativa do aparelho?
- **Pré:** S2.
- **Passos:** no Moonlight, resolução "Nativa" (e depois 1080p fixo); conectar e comparar `SUNSHINE_CLIENT_WIDTH/HEIGHT` com o `wm size` do S1. Testar o celular em pé e deitado.
- **Passou se:** os valores batem com a tela (é aceitável virem trocados largura/altura, porque o Moonlight transmite deitado; anotar).

## S4: o Sunshine captura **só** o monitor virtual?
- **Pré:** S0 + S3.
- **Passos:** com o monitor virtual ligado, ver no log a lista "Monitor N"; definir `output_name` para o índice dele; conectar. Repetir criando o monitor **pelo `prep-cmd`** (ele passa a existir depois que o Sunshine iniciou) para ver se o Sunshine o enxerga sem reiniciar.
- **Passou se:** o celular mostra a tela nova (não a área inteira de 3 monitores) **e** isso funciona com o monitor criado na hora.
- **Anotar:** se o índice muda conforme a ordem das saídas; se o "Espelhar" pode ser um segundo app com outra tela (configuração por app) ou se precisa trocar `output_name` global.

## S7: qualidade, latência, toque e gamepad (em casa)
- **Pré:** S4. 🔐 regra uinput (se o S3 mostrar que falta).
- **Passos:** sobreposição de estatísticas do Moonlight ligada; 5 min em cada perfil: 720p60/5 Mbps, nativa60/10 Mbps, nativa60/20 Mbps. Testar o toque como mouse e o toque direto, um gamepad Bluetooth no celular e um jogo leve.
- **Passou se:** perda de quadros por rede < 1%, decodificação < 10 ms, toque e gamepad respondendo.
- **Anotar:** latência de rede média e variação, decodificação, quadros perdidos, temperatura/bateria do celular depois de 10 min.

---

## S6: fora de casa com Tailscale oficial (o teste crítico)

**Pergunta:** o streaming funciona de verdade com o celular **na rede móvel**, com conexão direta
ou por relay, e com latência utilizável para "monitor extra" e para jogo?

### Pré-requisitos
- 👤 **Login no Tailscale no PC** (hoje: instalado e deslogado). O login é seu, no navegador; eu não faço login por você.
- 👤 Instalar o **app oficial do Tailscale** no celular e logar **na mesma conta**.
- S3, S4 e S7 aprovados **em casa** primeiro (assim, se falhar fora, o culpado é a rede).
- 👤 Pareamento do Moonlight feito em casa; depois, adicionar o PC no Moonlight pelo **IP 100.x** do Tailscale.
- 🤖 Antes: `tailscale netcheck` no PC (UDP liberado? NAT "difícil"? DERP mais próximo e latência até ele) e `sudo ufw status` (se o firewall estiver ativo, liberar as portas do Sunshine só na interface `tailscale0`; 🔐 autorização).

### Cenários (nessa ordem)
| # | Celular | Objetivo |
|---|---|---|
| A | Wi-Fi de casa, via IP 100.x | linha de base do Tailscale (deve ser direto e quase igual à rede local) |
| B | **Wi-Fi DESLIGADO, 4G/5G**, perto de casa | o teste principal |
| C | 4G/5G em outro lugar (outra antena) | confirmar que não foi sorte |
| D | Wi-Fi de terceiros (café, trabalho), opcional | NAT diferente |

Em cada cenário:
1. Conferir no celular: Wi-Fi **desligado** (B e C), Tailscale conectado.
2. No PC: `tailscale status` e `tailscale ping <celular>` (10 pings). Anotar se diz **`via <ip>:<porta>`** (direto) ou **`via DERP(xxx)`** (relay), e o RTT.
3. Moonlight → app de teste → 3 perfis, 3 min cada: 720p60/5 Mbps, 1080p60/10 Mbps, nativa60/15 Mbps.
4. Anotar: operadora, 4G ou 5G, sinal, direto/relay, RTT do `tailscale ping`, latência e variação de rede do Moonlight, quadros perdidos, se houve travadas ou queda e quanto tempo para reconectar.
5. Teste de uso: 2 min arrastando janelas na "Nova tela" e 2 min de um jogo leve.

### Critérios
| Resultado | Direto | Relay (DERP) |
|---|---|---|
| **Bom para jogo** | RTT < 50 ms, perda < 1%, sem travadas em 1080p60/10 Mbps | improvável; registrar |
| **Bom para monitor extra** | RTT < 80 ms, perda < 3% em 720p60 | RTT < 120 ms, 720p60/5 Mbps estável |
| **Falhou** | não conecta, ou trava/cai em 720p60/5 Mbps | idem |

### Decisões que dependem do S6
- Direto na maioria dos casos → ADR-0003 confirmada; o M3 só detecta e guia.
- Só relay e ruim → avaliar no M7: servidor DERP próprio no Brasil, Headscale, ou ajustar o perfil remoto (720p/5 Mbps) e avisar o usuário.
- Moonlight tratando 100.x como "remoto" e mudando a qualidade sozinho → anotar; o fork pode ajustar.

---

## S10: "Nova tela" pelo GNOME (ADR-0009) — depois da reunião
- **Pré:** 🔐 `pkexec` (pede senha a cada uso enquanto a política polkit não estiver instalada). As telas podem piscar e se mover por alguns segundos.
- **Passos:**
  1. `display layout` (só calcula) e conferir o plano.
  2. `OPENALT_HELPER=core/helper/openalt-helper OPENALT_RUNTIME_DIR=spikes/out/runtime display extend --width 1080 --height 2400`: medir quanto tempo a tela fica rearranjada; conferir no GNOME (Configurações → Telas) que o celular é um monitor de verdade, à direita do principal; abrir e maximizar uma janela nele.
  3. Repetir com 3 posições: entre os monitores (`--anchor HDMI-A-0 --side right`), acima do principal centralizado, abaixo do secundário.
  4. `display down`: o layout original volta, `monitors.xml` igual (hash), nenhum `OA_`, `card1-DP-1` = disconnected.
  5. Pelo Sunshine: app "OA Nova tela" com o Moonlight do PC (`--audio-on-host`), para ver se o `pkexec` funciona chamado pelo Sunshine e se a captura pega o monitor.
- **Passou se:** o GNOME trata o celular como monitor (fundo, painel, maximizar), as 4 posições ficam como calculado e tudo volta ao normal.
- **Se o GNOME não aceitar o modo do xrandr:** testar EDID falso (`edid_override`, root).

## S11: uma piscada só (arranjo salvo no GNOME) — próximo intervalo
- **Pré:** 🔐 autorizado pelo usuário, **com backup** do `~/.config/monitors.xml` (em `.backup/`). 4 senhas (ligar/desligar duas vezes).
- **Rodada 1:** `extend --remember` → o GNOME grava o arranjo "com o celular". Ainda pisca duas vezes.
- **Rodada 2:** `extend` → o GNOME deve aplicar o arranjo salvo sozinho; o núcleo não reaplica (`applied: false`).
- **Medida objetiva:** número de sinais `MonitorsChanged` do GNOME em cada fase (esperado: rodada 2 com menos que a rodada 1), além da percepção do usuário.
- **Passou se:** rodada 2 com `applied: false`, menos reconfigurações e o usuário notar uma piscada só; no fim, layout original e conector desconectado.
- **Para desfazer:** restaurar o backup do `monitors.xml` (vale a partir do próximo login, porque o GNOME guarda a configuração na memória).

## S13: posições de verdade + janela maximizada — depois da aula
- **Pré:** 2 senhas (ligar e desligar). Mudar de posição usa `display move` (só o GNOME, sem senha). Os monitores do usuário mudam de lugar durante o teste; risco de travar o vídeo do Zoom → só depois da aula.
- **Passos:** ligar à direita do principal → janela de teste do OpenAlt maximizada no monitor do celular → mover para entre os monitores → acima do principal (centralizado) → abaixo do secundário (alinhado à direita) → voltar → desligar.
- **Medidas:** layout do GNOME em cada posição comparado com o calculado; tamanho da janela maximizada = 1080x2400; `MonitorsChanged` por fase; final limpo.

## S8: pesquisa (sem mudar nada no sistema)
- tsnet/libtailscale no Android carregando o tráfego UDP do Moonlight: há exemplos? Qual a latência extra relatada?
- WebRTC: algum servidor compatível com a entrada do Moonlight? (Spoiler esperado: exige trocar o cliente.)
- **Entrega:** uma página em `docs/` com fontes e recomendação; não bloqueia a v1.

---

## Lacunas conhecidas
- GPUs Intel e NVIDIA (o monitor virtual por xrandr só foi provado em amdgpu).
- Celulares com HDR / 120 Hz (anotar se o S1 tiver um).
- Conflito com o GNOME: ele pode reaplicar o `monitors.xml` ao fazer login.
- Sessão bloqueada / tela de bloqueio durante o streaming.

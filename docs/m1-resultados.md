# M1: resultados

## Interface ligada ao núcleo (2026-10-12)
- Design aprovado pelo usuário (painel de cartões, destaque #FF746C, logo da bifurcação com laçada, ícone com traço escuro).
- **Abertura** toda vez que o app abre: os traços correm como uma caneta por um caminho contínuo (controle → monitor → celular → logo); a cortina vermelha sobe como gelatina e o painel entra junto. Primeira versão era um "morph" (a forma deslizava); o usuário pediu que as linhas se movessem — refeito. Reação do usuário: "AMASSOU".
  - Bug corrigido: o relógio da abertura começava com a janela ainda escondida; ao aparecer, a abertura "já tinha acabado". Agora começa no primeiro quadro desenhado.
  - Bug corrigido: pontinhos soltos (traço de tamanho zero com ponta redonda) — recorte por `stroke-dashoffset`.
- **Tela cheia**: no X11/GNOME, pedir `fullscreen` no construtor com `show:true` não funciona; agora a janela nasce do tamanho do monitor e vermelha, e pede tela cheia no `ready-to-show` (registro: tela cheia aos ~0,3 s, mantida). Esc/F11/botão saem.
- **Desenvolvimento no monitor secundário** (`node scripts/dev.mjs`, `OPENALT_DEV_DISPLAY=secondary`), tudo gravado em `.dev/`.

## Ligar/Desligar de verdade (controlador sem janela, mesmo código do app)
- Sunshine iniciado com a **configuração própria** em `.dev/config/sunshine/` (ADR-0010, suposição 1 confirmada: certificado, estado e credenciais nos caminhos do OpenAlt). Ligou em ~1,8 s.
- Credenciais criadas **sem a senha na linha de comando**: o OpenAlt grava o hash no formato do Sunshine (SHA-256(senha+salt) com bytes invertidos, hex maiúsculo — descoberto e conferido).
- API local com **certificado fixado**: funciona com o nosso; certificado errado é recusado.
- QR real (biblioteca `qrcode`, MIT), uso único, 120 s.
- Desligar encerra **só** o Sunshine do OpenAlt (achado pelo caminho da nossa configuração); portas livres; **a configuração do Sunshine do usuário ficou intacta** (hash).
- A CLI do núcleo roda pelo Node embutido no Electron (`ELECTRON_RUN_AS_NODE`, Node 24.21) — suposição 4 da arquitetura confirmada.

## Ainda não testado no M1
- Pareamento pelo QR com o app Android (M2). O Moonlight do PC não manda o nome "OpenAlt-<id>", então não dá para testar o casamento do QR sem o app nosso.
- "Nova tela" conectando pelo **app** (prep → connection.json → painel mostra "Conectado"): precisa do Moonlight do PC pareado com o Sunshine do OpenAlt e mexe nos monitores (+2 senhas).
- Instalar o Sunshine pelo botão; instalar a permissão (fica para o instalador, M4).

## Atualização (12/10) — pronto para o teste com celular

- **Pareamento por PIN do Moonlight oficial** (ponte até o app Android do M2): campo no cartão
  "Parear"; só aceita pedidos que não são `OpenAlt-*` (esses são do QR). O cartão mostra o IP do PC.
- **Ponte prep testada de dentro do sandbox Flatpak** do Sunshine (`openalt-prep down` → flatpak-spawn →
  Electron como Node → CLI): ok, apagou `connection.json`.
- **Firewall:** o ufw está ativo neste PC e sem regras para o Sunshine; o celular só conecta depois de
  liberar as portas (o instalador do M4 precisa tratar isso).
- Windows: guia para amigos testarem a base em `docs/teste-windows-amigos.md` (OpenAlt-Windows é M5).

## 1º teste com aparelho de verdade (12/10, tablet "roth", Moonlight oficial)

- **Funcionou:**
  - Pareamento por PIN.
  - "Espelhar": stream do monitor principal.
  - "Nova tela": monitor virtual 2000×1200 criado abaixo do 27″, stream em `DisplayPort-0`, offset 1400×1080.
  - O app mostrou "Conectado".
  - Desligar removeu o monitor virtual e não deixou sobras.
- **Bug corrigido:** o monitor virtual aparecia na lista como 3º monitor ("OAL"). O filtro era pelo nome e
  agora é pelo fabricante do EDID (`isOpenAltMonitor`). Além disso, a lista é relida depois de Desligar.
- **Travamento e "conexão fraca":** o ping do PC até o tablet ficou em 80 ms de média, com pico de 225 ms e
  variação de 70 ms (o normal em Wi-Fi bom é menos de 5 ms). O Moonlight pediu 18 Mbps em HEVC.
  - Suspeita principal: o Wi-Fi do tablet. Próximo teste com 10 Mbps e o tablet em 5 GHz.
  - O Sunshine em Flatpak captura via X11, porque o Flatpak não tem CAP_SYS_ADMIN para KMS. Medir se isso
    pesa.
- **Ainda não confirmado:** se o toque mexe o mouse (ADR-0008).

### "Nova tela" funcionando no tablet (12/10) — dois defeitos

- **Cursor duplicado no tablet:** é um bug do Sunshine na captura X11 (`blend_cursor` em
  `src/platform/linux/x11grab.cpp`, ainda presente no master).
  - Ele limita a posição do cursor a ≥ 0 com `std::max(0, …)` em vez de pular o desenho. Por isso, com o
    cursor acima ou à esquerda do monitor capturado, o cursor é desenhado na borda.
  - Acontece sempre que o aparelho não está no canto superior esquerdo da área de trabalho.
  - Correção no Sunshine: se o retângulo do cursor não cruza a imagem, não desenhar; com coordenadas
    negativas, recortar o cursor em vez de mover.
  - A captura KMS não tem esse problema, mas exige CAP_SYS_ADMIN, impossível no Flatpak. Isso entra no
    ADR-0008.
- **Papel de parede preto no monitor novo:** a suspeita é a extensão "Picture Desktop Remake" (desenha o
  fundo e talvez não trate monitor novo). Falta confirmar.

### Travamento gráfico (12/10, 19:24) — PC reiniciado

- **Linha do tempo:**
  - 19:15:44 — começa a "Nova tela" (2000×1200), que funciona por cerca de 9 minutos.
  - 19:24:27 — o X relê os EDIDs de todos os monitores. Coincide com um comando de diagnóstico **meu**
    (`xrandr --listmonitors`, em seguida uma captura da área do tablet), rodado com o stream ao vivo.
  - 12 s depois — os processos de GPU do Claude desktop e do Brave passam a cair em loop
    (`GPU process exited unexpectedly: exit_code=512`).
  - 19:25:54 — o cliente desconecta, e a pessoa reinicia o PC.
- **O que não aconteceu:** o kernel não registrou reset da GPU nem ring timeout. Depois do reboot, o
  conector está `disconnected` e não sobrou nada. O app já limpa `connection.json` ao abrir.
- **Hipótese:** sondar as saídas do X com o conector forçado e o encoder VAAPI ativos deixa o GL de
  outros apps instável.
- **Regras daqui para frente:**
  - Nada de `xrandr` nem de captura durante a sessão ao vivo.
  - Se o travamento acontecer **sem** nenhuma sondagem, o problema é o conector forçado sob carga, e é
    preciso investigar com os logs.

### Toque, tamanho da interface e Sunshine nativo (12/10)

- **Toque funciona com o Sunshine Flatpak** (uinput ok): a dúvida de entrada do ADR-0008 está resolvida.
- **Tamanho das coisas na Nova tela** (100/125/150/200%, padrão 125%):
  - No X11, a escala do GNOME é a mesma para todos os monitores.
  - Por isso a ponte cria o monitor virtual menor (`scaleRequest`; 2000×1200 a 125% vira 1600×960) e o
    Sunshine amplia a imagem.
- **Sunshine nativo (.deb):**
  - Quando existe `/usr/bin/sunshine`, o OpenAlt usa ele com `capture = kms` e `output_name = DP-1`. A
    versão atual do Sunshine aceita nome de conector na KMS (`map_display_name_to_monitor_index`).
  - Na KMS, o cursor vem da camada de cursor de cada CRTC, então não aparece duplicado. A captura também
    é mais rápida.
  - **Não testado ainda:**
    - a KMS no monitor forçado;
    - o "Espelhar" na KMS (a saída do espelho não é um conector forçado).
- **Aparelhos diferentes:**
  - Cada aparelho guarda o próprio lugar e tamanho em `settings.perDevice`, pela chave do nome. Mudar
    com um aparelho conectado vale para ele e vira o padrão dos aparelhos novos.
  - O EDID do monitor virtual leva uma série por aparelho (FNV-1a do nome, também como texto no
    descritor 0xFF). Assim o "Lembrar o arranjo" do GNOME guarda uma entrada por aparelho, em vez de um
    "monitor OpenAlt" único com resolução trocando. Não testado ao vivo.

### Teste com o Sunshine nativo (.deb, KMS) — 12/10, 19:54

- **O que funcionou:**
  - A KMS mapeou `DP-1` e achou a camada do cursor (plane 422).
  - A série do EDID por aparelho foi salva no monitors.xml (`OAL/1b3b6d92`).
- **Cursor:**
  - Some no tablet, mesmo com o mouse em cima dele; nos monitores do PC fica normal.
  - O log de debug do Sunshine (`OPENALT_SUNSHINE_DEBUG`, ligado no dev.mjs) é para achar o motivo.
- **"Todos os monitores ficaram em 150%":**
  - O GNOME continuou com escala 1, e o Xft.dpi ficou em 96.
  - Hipótese: o EDID dizia tamanho físico 0, e o X/os apps calculam o DPI pelo tamanho. Agora o EDID
    declara o tamanho de um monitor de 96 DPI. A hipótese não foi confirmada.
- **Desligar mostrava "O Sunshine fechou sozinho":** era o próprio OpenAlt parando o Sunshine. Corrigido
  com a flag `stopping`.
- **Esquecer não fazia nada com o OpenAlt desligado:** agora tira o aparelho direto do arquivo de estado
  (`forgetPairedDevice`), e erros aparecem na faixa de erro.

### Reteste 20:02–20:04 (EDID com tamanho físico)

- **A escala dos monitores do PC foi resolvida:** só o monitor extra ficou maior. A hipótese do tamanho
  físico 0 no EDID se confirma.
- **Janelas não se ajustam ao monitor menor:**
  - Uma janela levada para o monitor extra mantém o tamanho em pixels; com 150%, o monitor tem
    1328×800 e ela fica enorme.
  - Isso é inerente ao truque da resolução menor, porque o GNOME no X11 não redimensiona ao mudar de
    monitor.
  - Ideias: padrão em 125%; maximizar com Super+↑; no futuro, o OpenAlt maximizar janelas novas lá.
- **Cursor na KMS:**
  - O log de debug mostra o Sunshine lendo a imagem do cursor do tablet sem erro ("Refreshing cursor
    image after FB changed", várias vezes por segundo, com o mouse sobre o tablet). Mesmo assim, ele não
    aparece no vídeo.
  - Suspeita: o buffer do cursor do driver amdgpu do Xorg fica na VRAM e o mmap lê transparente, ou o
    Sunshine o descarta sem log (`!fb->handles[0]`).
  - Precisa de investigação com o código do Sunshine ou de um issue no projeto deles. **Em aberto.**
- O "Couldn't find monitor [0]" às 20:02 aparece só na detecção de encoders, antes de o monitor
  virtual existir. Não afeta o stream.

### Decisões depois do reteste (12/10, 20:10)

- **Captura volta para X11,** também com o Sunshine nativo. A KMS fica atrás de `OPENALT_KMS=1`, até
  descobrir por que o cursor não aparece.
- **Maximizar janelas no aparelho** (`maximizeOnDevice`, padrão ligado; `windows.ts`, com wmctrl e xprop):
  - A cada 1 s, com "Nova tela" conectada, as janelas normais que **entram** no monitor do aparelho são
    maximizadas uma vez.
  - O que já estava lá ao conectar não é tocado. Diálogos e menus ficam de fora.
  - O wmctrl e o xprop só leem o gerenciador de janelas, não sondam monitores. O wmctrl precisa entrar
    como dependência do instalador (M4).
- **Super abrindo o menu no tablet:**
  - É o ArcMenu do Zorin com `hotkey-open-primary-monitor false`: abre no monitor onde está o mouse.
  - O toque no tablet leva o mouse para lá. Com a KMS o cursor ficava invisível, então parecia aleatório.
  - O OpenAlt não muda configuração de terceiros. Fica como dica para a pessoa.
- **A dock e o Super pulando para o tablet:**
  - O dash-to-dock (a dock do Zorin; a do Ubuntu usa o mesmo esquema) tinha
    `preferred-monitor-by-connector = 'DisplayPort-0'`, o nome antigo da porta do 27″.
  - O monitor virtual usava justamente a DisplayPort-0, então a dock ia para ele e o ArcMenu (Super)
    abria junto.
  - Correção: `chooseOutput` lê essa preferência via gsettings (schema do sistema ou da extensão no
    HOME) e evita esse conector se houver outra saída livre.
  - O app e a ponte usam a mesma função, então a escolha é a mesma.
  - Não testado: forçar a DisplayPort-1 (card1-DP-2); o M0 só testou a DP-1.

### Tela inteira no tablet e "qual é qual" no Moonlight (12/10, 20:20)

- **Tablet mostrando os dois monitores (a área de trabalho inteira):**
  - O Sunshine atual procura a tela pelo **nome** (`refresh_displays` em `video.cpp` compara
    `output_name` com os nomes da lista). Com `output_name = 1`, nada batia e ele caía na primeira da
    lista, a DisplayPort-0.
  - Antes funcionava por acaso, porque o monitor virtual era a DisplayPort-0. Quando a escolha passou a
    evitar a saída da dock, quebrou.
  - Correção: `output_name` agora é o nome da saída (`outputName`).
- **Moonlight com dois itens parecidos ("Nova tela"/"Espelhar"):** agora há um item só, **"OpenAlt"**
  (`prep auto`), que segue o modo escolhido no app do PC.
- **App Android (M2):** a pessoa quer começar já, para conectar direto sem escolher nada no Moonlight.
  Neste PC há o Android SDK em `~/Android/Sdk`, mas sem NDK (necessário para o moonlight-common-c).

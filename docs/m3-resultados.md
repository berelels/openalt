# M3: resultados (acesso remoto e app Android de console)

Decisões: ADR-0003 (Tailscale oficial, atualizado), ADR-0013 (o que o M3 decidiu). Arquitetura:
`docs/m3-arquitetura.md`. Aparelho dos testes: Galaxy S20 FE (SM-G780G, 2400×1080).

## Testado de verdade (13/10)

### Fora de casa
- **Login do Tailscale pelo botão "Entrar"** do cartão "Fora de casa" (pkexec + navegador). O cartão
  passou sozinho para "Pronto".
- **Conexão pelo 4G** (Wi-Fi desligado), com o Tailscale nos dois aparelhos: o celular achou o PC pelo
  100.x guardado no pareamento (`KnownAddresses`) e transmitiu. A pessoa precisou parear em casa antes.
- **"Fora de casa só espelha"** (`clientViaTailscale` na ponte do Sunshine): **não testado** no 4G
  depois da mudança; só testes de unidade.

### Imagem
- **Faixas verdes ao espelhar:** o celular pede 2400×1080 e o monitor é 1920×1080. O Sunshine encaixa
  a imagem e, com AMD + HEVC pela VAAPI, as bordas saíam verdes (LizardByte/Sunshine#4314). Trocar a
  resolução no celular só mudava o tamanho das faixas.
- **Correção:** com placa AMD (sem NVIDIA), o OpenAlt gera o Sunshine com `hevc_mode = 1` e
  `av1_mode = 1` (só H.264). Registro: `h264_vaapi` nas duas sessões; **bordas pretas**, confirmado
  pela pessoa.
- **"Esticar para a tela cheia" do Moonlight não tem efeito ao espelhar:** as bordas já vêm dentro do
  vídeo. Encher a tela exigiria pedir o vídeo no formato do monitor; ficou de lado por decisão da pessoa.

### Som
- Com a escolha antiga "som só no PC" (padrão), o som saía um instante e parava (o Sunshine ligava sem
  transmitir som). A escolha saiu do app do PC: o Sunshine sempre transmite, e a opção "Tocar áudio no
  PC" do app do aparelho decide. **Funcionou** (registro: `localAudioPlayMode -- 1` com a opção ligada).

### Controle
- O Sunshine cria o controle virtual (`libvirtualhid`, "X-Box Series Controller" ou "PS5 Controller",
  conforme o controle do celular); a Steam o detecta e o testador do navegador acende os botões.
- **Minecraft Java não aceita controle** (sem mod como o Controlify). **Bedrock pelo mcpelauncher
  funcionou.**

### App Android
- **Tela de entrada** (StartActivity): abertura igual à do PC, tela cheia (inclusive atrás do recorte
  da câmera), cartões de PC e "Parear um PC", nome do PC numa linha.
- **Título "OpenAlt"** numa linha (era "A/l/t" em linhas separadas no celular em pé).
- **Configurações de console** (SettingsActivity): categorias, cartões, valor abaixo do nome em pé.
  Capturas da grade, do Vídeo e do Controle no celular em pé.

### Nova tela no tablet (Galaxy Tab S6 Lite, SM-P619, 13/10 à noite)
- **Travamento ao desconectar (corrigido):** no modo de desenvolvimento o ajudante pede senha; ao
  desconectar, a caixa de senha escureceu a tela e prendeu o teclado (foi preciso suspender o PC).
  Correção: **desconectar nunca pede senha** (`retractOnDisconnect`). Sem a permissão do sistema, a
  tela do aparelho sai pelo GNOME (sem root), a extensão refaz o papel de parede e a saída forçada fica
  anotada para o "Desligar" ou a próxima conexão. A "Permissão do sistema" passou a ser conferida pelo
  polkit (`pkcheck`), não só pela existência do arquivo.
- **Segunda conexão em outra saída (corrigido):** a saída anotada parecia "conectada" e a escolha pulou
  para outra, que o Sunshine não capturava (rastros de janela na área do tablet). Agora a saída anotada
  é devolvida antes da escolha.
- **Depois das correções:** conectar, desconectar (sem senha, papel de parede de volta) e conectar de
  novo funcionaram; a tela do tablet ficou sempre na `DisplayPort-1` com H.264; **a tecla Super
  funcionou** com o tablet conectado. A pessoa usou o tablet como tela extra (Spotify).
- Som: durante a conexão o Sunshine põe a saída `sink-sunshine-stereo` como principal (é assim que o som
  vai ao aparelho) e devolve a anterior ao desconectar.

## Não testado
- Mapear botões com controle de verdade, e o mapeamento valendo na transmissão.
- Configurações deitado e navegação por controle (LB/RB, esquerda/direita nos números).
- Menu de opções do PC na tela de entrada (toque longo / X) e a orientação seguindo o sensor nas
  telas do Moonlight.
- "Fora de casa só espelha" no 4G.
- Se o reinício do GNOME ao conectar foi pela extensão (sem a caixa do Alt+F2) a partir da 2ª vez.
- O caminho com a permissão do sistema instalada (o ajudante em /usr/libexec): só existe depois do M4.
- Itens antigos: vídeo do Chromium travando na tela virtual; cursor duplicado na borda.
- Tablet, outras placas (Intel, NVIDIA) e outros aparelhos.

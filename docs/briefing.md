# Briefing: OpenAlt (nome provisório), por Catta Studios

## Objetivo
App para usar um celular/tablet Android como monitor extra OU espelho do PC, e para
jogar em streaming do PC pelo celular, de casa ou de qualquer lugar. O usuário deve
fazer o mínimo: instalar, 1 a 2 cliques, escanear um QR e pronto.

## Decisões já tomadas (padrões acordados)
- Primeiro: **Linux (X11)**. O usuário usa Zorin OS 18, GNOME 46, X11, AMD RX 6600. Depois Windows, depois Wayland.
- Só Android no celular. iOS fica de fora por enquanto.
- Código aberto (GPL).
- Idiomas: pt-BR primeiro; en e es depois (como o site do Pauca).
- Pasta do projeto: `~/Documentos/Projetos/Apps/OpenAlt`. NUNCA em Downloads.
- Arquitetura (meio-termo): app próprio no PC que instala e configura o **Sunshine como
  processo separado e sem alterar o código dele**; app Android próprio, **fork do Moonlight
  Android** (ou Artemis, se servir), com pareamento por QR.
- **Acesso remoto (v1): Tailscale OFICIAL no PC e no celular.** O OpenAlt detecta se estão
  instalados e logados, guia a instalação/login (uma vez) e confirma que os dois aparelhos
  estão na mesma tailnet. Conta Tailscale do próprio usuário (login com Google).
  Servidor próprio (Headscale) só se o app crescer.
  - NÃO embutir o Tailscale (tsnet) no app Android na v1: o streaming do Moonlight usa
    várias portas TCP/UDP diretas, e rotear isso por uma rede em userspace é frágil e
    aumenta a latência. Isso é conclusão por conhecimento, ainda NÃO testada. Fica como spike.
  - Alternativa a avaliar depois: WebRTC com STUN/TURN.

## O que já foi provado (protótipo apagado; recriado em `core/`)
No PC do usuário (X11 + amdgpu), sem plug e sem reiniciar, uma saída "disconnected"
vira monitor virtual com resolução arbitrária:
    cvt W H 60                      # gera a Modeline (W múltiplo de 8)
    xrandr --newmode ES_WxH_60 <parâmetros da Modeline, sem aspas>
    xrandr --addmode DisplayPort-0 ES_WxH_60
    xrandr --output DisplayPort-0 --mode ES_WxH_60 --pos <x>x0   # x = borda direita dos monitores ativos
Remover: `--output ... --off`, `--delmode`, `--rmmode`. Testado com 1280x800, 1080x2400,
2000x1200@90 e 1600x900; criou e removeu sem sobras.
O Sunshine chama comandos "do/undo" (prep-cmd no apps.json) com as variáveis
SUNSHINE_CLIENT_WIDTH/HEIGHT/FPS: dá para criar o monitor na resolução do aparelho
ao conectar e removê-lo ao desconectar. Se as variáveis não vierem, usar 1280x720@60.

## NÃO foi testado (validar primeiro, como "spikes")
1. Conexão real com um Android (o usuário precisa plugar um aparelho; `adb` existe).
2. Se o Sunshine expande $SUNSHINE_CLIENT_* nos comandos.
3. Sunshine em Flatpak (precisa de `flatpak-spawn --host`) versus nativo (.deb); prefira o que for mais simples e robusto.
4. Se o Sunshine captura o monitor virtual (escolha da tela via `output_name`).
5. Se o Moonlight manda a resolução nativa do aparelho.
6. **Tailscale oficial + Moonlight FORA da rede de casa**: conexão direta ou por relay,
   latência, e se o streaming funciona de verdade pela rede móvel (testar com o celular
   em 4G/5G, não no Wi-Fi de casa).
7. Qualidade, latência, toque e gamepad.
8. (Pesquisa, opcional) Embutir Tailscale no app Android e a alternativa WebRTC.

## Experiência desejada
PC: instalar, abrir, um botão "Ligar". O app checa e instala Sunshine e Tailscale com um
único pedido de permissão do sistema, cria credenciais aleatórias do Sunshine, registra o
app no Sunshine e mostra um QR.
Celular: instala o app OpenAlt uma vez (o Android não permite instalar de outro aparelho);
para uso remoto, instala também o app oficial do Tailscale e faz login uma vez. Depois
escaneia o QR e está pareado. Alternar entre "Nova tela" e "Espelhar", e desligar a qualquer hora.

## Segurança (obrigatório)
- Credenciais geradas aleatoriamente, arquivos 0600, nunca impressas em log ou tela.
- Interface local só em 127.0.0.1, com token e checagem de Host (já validado no protótipo).
- O QR leva um token de pareamento de uso único e com validade curta.
- Nunca iniciar serviços de rede nem alterar a configuração do Sunshine sem o usuário pedir.

## Design (use os arquivos reais como referência)
- App: família Respiro/Pauca. Referências: `~/Documentos/Projetos/Apps/respiro/src/renderer/styles/app.css` e `.../sossego/app/src/main/res/values/colors.xml`.
  Papel #F6F1E7, tinta #26211B, terracota #C4673F; escuro #1A1713 com #E3875F. Newsreader + Plus Jakarta Sans empacotadas localmente (funciona sem internet). Raios 12/20/28, easing cubic-bezier(0.22,1,0.36,1), textura de papel sutil, tema claro/escuro.
- Site/créditos "Catta Studios": referência `.../Apps/berelels/css/style.css` (papel #F4F2EC, azul #3F6CA8, Inter + JetBrains Mono, mascote gato).
- Acessibilidade: contraste AA, foco visível, botão grande, tudo funcional por teclado.

## Stack
- PC Linux (v1): **Electron + TypeScript**, como o Respiro (reaproveita fontes, estilos,
  testes e empacotamento AppImage/deb). O **núcleo** (monitor virtual, Sunshine, Tailscale,
  pareamento) fica SEPARADO da interface, como módulo ou pequeno programa de linha de
  comando, para trocar a tela depois (por exemplo por Tauri) sem reescrever o resto.
  Núcleo isolado por plataforma: Linux X11 agora; Windows (driver de monitor virtual) depois.
- Android: Kotlin, fork do Moonlight Android, com pareamento por QR.

## Marcos
M0 spikes (acima) · M1 PC Linux: monitor virtual + Sunshine + UI · M2 app Android com QR ·
M3 remoto com Tailscale oficial (detectar, guiar, validar fora de casa) · M4 acabamento
visual e instalador · M5 Windows · M6 Wayland · M7 (pesquisa) Tailscale embutido / WebRTC.

## Regras de trabalho
- Teste de verdade antes de dizer que funciona; relate o que NÃO foi testado.
- Peça confirmação antes de mudanças de sistema (GRUB, instalar pacotes, iniciar o Sunshine).
- Não crie arquivos fora da pasta do projeto. Nada em Downloads.
- Faça backup antes de editar configs de terceiros (apps.json do Sunshine etc.).

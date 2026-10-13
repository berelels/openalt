# OpenAlt (Catta Studios)

Celular/tablet Android como monitor extra, espelho do PC ou tela de jogo em streaming, em casa
ou fora. Sunshine (PC) + fork do Moonlight (Android) + Tailscale oficial para acesso remoto.

- Briefing completo: `docs/briefing.md` · Decisões: `docs/adr/` · Plano do M0: `docs/m0-plano-de-spikes.md` · Resultados: `docs/m0-resultados.md`
- Marcos: M0 spikes · M1 PC Linux (monitor virtual + Sunshine + UI) · M2 Android com QR · M3 remoto (Tailscale) · M4 acabamento e instalador · M5 Windows · M6 Wayland · M7 pesquisa (tsnet/WebRTC)

## O app é para qualquer pessoa
O PC de testes (Zorin X11, AMD, 2 monitores) é só o primeiro caso. Nunca assumir o hardware dele:
1, 2, 3, 4+ monitores, de tamanhos diferentes, girados, com escala; o celular em qualquer lado de
qualquer monitor; outras placas (Intel, NVIDIA, híbridas), outras distros e ambientes. Cada
suposição vai para `docs/compatibilidade.md` como "testado", "só unidade" ou "suposição", e o
`display check` diz a cada pessoa o que funciona no PC dela. Testes de unidade usam arranjos
genéricos, não só o do PC de testes.

## Regras de trabalho
- **Teste de verdade** antes de dizer que funciona; relate sempre o que **não** foi testado.
- **Peça confirmação** antes de mudanças de sistema: GRUB, instalar pacotes (apt/flatpak/APK), iniciar ou configurar o Sunshine, firewall, regras udev, login em serviços.
- **Não crie arquivos fora desta pasta** (`~/Documentos/Projetos/Apps/OpenAlt`). Nada em Downloads. Temporários vão para o scratchpad da sessão.
- **Backup** antes de editar configs de terceiros (`apps.json`, `sunshine.conf` etc.) em `.backup/` (fora do git).
- Avise o usuário sempre que usar uma skill.

## Segurança (obrigatório; ver ADR-0006)
- Credenciais aleatórias, arquivos 0600, nunca em log, tela ou saída da CLI.
- Interface local só em 127.0.0.1, com token e checagem de Host.
- QR com token de uso único e validade curta.
- Nunca iniciar serviços de rede nem alterar o Sunshine sem o usuário pedir.
- Comandos externos com `execFile` e argumentos em lista, nunca shell.

## Código
- `core/`: `@openalt/core`, TypeScript rodando direto no Node ≥ 24 (sem build). Só sintaxe apagável (`erasableSyntaxOnly`), imports com `.ts`. Código por plataforma em `core/src/<plataforma>/`; `core/src/layout.ts` é independente de plataforma. CLI: `core/src/cli.ts` (`display extend|layout|mirror|down|status|up`, saída JSON; `--help`).
- "Nova tela" no GNOME exige o ajudante root `core/helper/openalt-helper` (ADR-0009). Nunca rodar `extend` sem avisar: as telas do usuário podem piscar e se mover.
- O celular pode ficar à direita, à esquerda, acima ou abaixo de qualquer monitor (`--anchor --side --align`); "Espelhar" pode espelhar qualquer monitor (`--of`).
- Áudio: "Onde sai o som" = aparelho / PC (padrão) / os dois (`core/src/audio.ts`). No "PC" o Sunshine liga com `stream_audio = disabled`; o `AudioRouter` confere a saída padrão a cada segundo (o Sunshine a troca ~0,5 s depois de conectar).
- Reinício do GNOME (X11) depois que a Nova tela entra/sai: pela extensão do OpenAlt (`core/gnome-shell/openalt@cattastudios.dev`, D-Bus `dev.cattastudios.OpenAlt.Shell.Restart`); reserva: Alt+F2 → r. O app instala a extensão ao Ligar. **Nunca** testar GNOME aninhado com `dbus-run-session`: o dconf ativado grava no dconf real.
- Nunca capturar a tela inteira do usuário (pode haver reunião/dados); no máximo a área do monitor virtual.
- Testes: `npm test` (unidade, executor falso, não mexe na tela) · `npm run typecheck`.
- `core` compila para `core/dist` (`npm run build -w @openalt/core`); o app (desktop) e a ponte do Sunshine usam o JS compilado, rodado pelo Node do Electron (`ELECTRON_RUN_AS_NODE=1`).
- Rodar o app: `node scripts/dev.mjs` — grava tudo em `.dev/`, abre no monitor SECUNDÁRIO, usa o ajudante do projeto via pkexec. `OPENALT_DEBUG=1` registra eventos da janela.
- `desktop/`: `src/main` (processo principal + `controller.ts`), `src/preload/preload.cjs` (ponte mínima), `src/renderer` (interface + `intro.ts`).
- Monitor virtual: modos com prefixo `OA_`; a remoção apaga tudo com esse prefixo.
- `android/`: fork do Moonlight Android 12.2 (ADR-0012; `moonlight-common-c` é submódulo). Código novo em `android/app/src/main/java/dev/cattastudios/openalt/`; mudanças em arquivos do Moonlight marcadas com "OpenAlt:" e mínimas (para `git subtree pull`). A nuvem não alcança `dl.google.com`: o build e os testes Android rodam no GitHub Actions (`.github/workflows/android.yml`).
- Idiomas: pt-BR, espanhol e inglês; vale o do sistema (se não for nenhum dos três, inglês), e a pessoa troca na aba Sobre. PC: `desktop/src/renderer/i18n.ts` (`t('chave', {valores})`); o processo principal e o núcleo mandam CHAVES (`UiText`, `Check.key`, `LayoutError.code`), não frases. Android: `values/strings_openalt.xml` (inglês, padrão), `values-pt/`, `values-es/`. Texto novo entra nos três; `desktop/test/i18n.test.mjs` confere.

## Design
- **Site** (`site/`, GitHub Pages, sem build): estilo "papel quadriculado" (proposta 20), slogan **"Empowering anyone to stream anywhere"**. Aparelhos PLANOS (`.fd-*`, traço de tinta), não realistas. GSAP 3.13 local em `site/vendor/` (licença própria, não GPL). Revisar com `scripts/capture-site.mjs` (desktop/mobile/reduced). Ver `site/README.md`.
- App: família Respiro/Pauca, em **painel de cartões** (trilho de ícones à esquerda, título grande + pílulas no topo, grade de cartões; aprovado pelo usuário em 2026-10-12). Papel #F6F1E7, tinta #26211B, Newsreader + Plus Jakarta Sans locais, raios 12/20/28, easing cubic-bezier(0.22,1,0.36,1), textura de papel, claro/escuro.
- **Destaque vermelho #FF746C** (pedido do usuário). Contraste AA medido: #FF746C só como FUNDO com texto escuro; texto vermelho no papel claro = `--accent-text` #B8372F; erro = vinho (#8E2A47 / #F59BB0). Segundo cartão de destaque: sálvia (#4A7350 claro / #8FBF92 escuro).
- **Logo:** traço feito à mão que se bifurca (o caminho do Alt) e termina na laçada do Respiro. Ícone: **traço escuro #26211B sobre #FF746C** (`docs/design/logo/`).
- **Abertura toda vez que abre** (como o Big Picture): os mesmos dois traços pastel se redesenham controle → monitor → celular → logo; a cortina vermelha sobe como gelatina (borda ondulada, imperfeita) e o painel entra junto. Pula com clique/tecla; respeita "reduzir movimento". `desktop/src/renderer/intro.ts`.
- **Abre em tela cheia**; Esc, F11 ou botão saem.
- Aparelho = **celular ou tablet, em pé ou deitado** — nunca assumir celular em pé.
- Catta Studios (site/créditos): `../berelels/css/style.css` (papel #F4F2EC, azul #3F6CA8, Inter + JetBrains Mono, gato); assinatura "\ catta studios".
- Acessibilidade: contraste AA (medir!), foco visível, botão grande, tudo por teclado.
- Revisar telas sem atrapalhar o usuário: `electron desktop/scripts/capture.mjs <pasta>` e `capture-intro.mjs` (janela invisível). Não abrir o app em tela cheia durante aulas/reuniões.

## Skills: quando usar cada uma
- `engineering:architecture`: cada decisão importante vira ADR em `docs/adr/`.
- `engineering:system-design`: comunicação PC ↔ Sunshine ↔ celular antes de codar o pareamento.
- `engineering:testing-strategy`: plano dos spikes e dos testes com aparelho real e fora de casa.
- `design`: telas do PC, do celular e da página da Catta antes de implementar.
- `run`: abrir o app de verdade e conferir cada mudança.
- `security-review`: antes de fechar cada marco (pareamento, credenciais, interface local).
- `code-review` e `simplify`: ao fechar cada marco.
- `engineering:debug`: streaming, atraso, conexão.
- `engineering:documentation`: README e guia de instalação em pt-BR.
- `engineering:deploy-checklist`: antes de gerar AppImage/APK para outras pessoas.
- `skill-creator`: transformar o estilo visual e o procedimento do monitor virtual em skills.

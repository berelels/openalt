# M2: resultados (app Android)

Decisões: ADR-0012. Código: `android/`, com o fork do Moonlight Android 12.2 e o código novo em
`android/app/src/main/java/dev/cattastudios/openalt/`.

## Início (12/10)

### O que foi feito
- O Moonlight Android 12.2 entrou em `android/` com o histórico completo (`git subtree`). O
  `moonlight-common-c` (com `enet` e `nanors`) ficou como submódulo, com o `.gitmodules` na raiz.
- **Build no GitHub Actions** (`.github/workflows/android.yml`):
  - O ambiente de nuvem do Claude não alcança `dl.google.com`, de onde vêm o SDK, o NDK e o plugin
    Android do Gradle (o `maven.google.com` redireciona para lá).
  - O CI instala o NDK 29.0.14206865 pedido pelo `build.gradle`. O build usa ndk-build e não usa
    CMake; a plataforma 37 o Gradle baixa sozinho.
  - O CI compila o APK de debug e roda os testes de unidade.
  - **O Moonlight sem mudanças compilou** (execução nº 2, APK de 17 MB) antes de qualquer mudança.
- **Identidade:**
  - Pacote `dev.cattastudios.openalt` (`.debug` no debug).
  - Nome "OpenAlt".
  - Ícone a partir de `docs/design/logo/openalt-icone.svg`, adaptativo com a zona segura conferida em
    máscara redonda e quadrada.
  - Banner de TV.
  - Os textos que chamam o app de "Moonlight" passaram a dizer "OpenAlt". Os 19 textos que faltavam no
    pt-BR foram traduzidos.
- **Tela Parear** (botão de QR no topo e botão grande "Parear com QR" quando não há PC):
  - lê o QR;
  - recusa QR vencido ou estragado;
  - tenta os IPs com o Tailscale por último;
  - pareia com o PIN e o nome `OpenAlt-<d> <modelo>`;
  - confere o certificado com o `fp` antes do desafio do PIN.
- **Tocar no PC** conecta direto no app "OpenAlt" do Sunshine.
- **Padrões:** resolução nativa, 60 FPS e 10 Mbps.
- **Créditos** (Moonlight, Sunshine, ZXing) em Configurações → Sobre o OpenAlt.

### Testado de verdade
- **29 testes de unidade da `PairingUri`**, rodados no JDK 21 com JUnit 4.13.2 (e no CI pelo Gradle). A
  fixture principal é uma URI gerada pelo `newPairing()` do `core`, com acento, vírgula e `#` no nome e
  um 100.x no meio da lista. Os testes cobrem:
  - validade (exatamente no `exp` já está vencido);
  - versão, campos faltando ou repetidos, PIN com zero à esquerda e dígitos de largura total;
  - `fp` com dois-pontos e em maiúsculas;
  - porta;
  - ordem dos IPs, IPv6 e nomes;
  - limpeza do nome do PC;
  - nome do cliente aceito pelo `matchPending`;
  - comparação do certificado.
- A URI com `OpenAlt-<d> Galaxy Tab S9` casa no `matchPending` do `core` (rodado no Node).
- Ícone e banner renderizados e conferidos visualmente.
- A compilação do fork é a do CI: ver o estado no PR.

### NÃO testado (precisa do tablet e do PC)
- **Nada rodou num aparelho Android.** O app nunca foi aberto: nem a tela Parear, nem a câmera, nem a
  rotação, nem o TalkBack.
- Escanear o QR real do app do PC e o PC confirmar sozinho (`matchPending` + `POST /api/pin`).
- Se o Sunshine decodifica o `devicename` com espaço (`%20`) e mostra `OpenAlt-<d> <modelo>` em
  `/api/pin`.
- Se o certificado de `getservercert` (o `cacert.pem` do OpenAlt) bate com o `fp` na prática. A conta
  (SHA-256 do DER) é a mesma do Node, mas não foi vista ao vivo.
- Recusa de um PC com outro certificado (precisa de um segundo Sunshine).
- Tentativa dos IPs em ordem com um IP morto antes do certo (cada um espera até 5 s), e o Tailscale.
- Conexão direta no app "OpenAlt" e a volta para a grade quando ele não existe.
- Resolução nativa: qual valor o aparelho informa (com ou sem barras e recorte) e se o Sunshine e o
  monitor virtual aceitam (ex.: 2000×1200 no tablet "roth").
- 10 Mbps resolve o travamento do 1º teste? (No 1º teste, o Wi-Fi do tablet era a suspeita principal.)
- Android antigo (5.x a 7.x) com o leitor de QR. O zxing 3.4 depende do desugaring, que já está
  ligado.
- Build de release (minify/ProGuard) e assinatura. O CI só gera o debug.
- Ícone monocromático (Android 13) e banner na TV.

### Como testar no PC (próximo passo)
1. Baixar o APK do artefato `openalt-apk-debug` da última execução do workflow `android` e instalar no
   tablet (`adb install`).
2. No PC, rodar `node scripts/dev.mjs`, tocar em Ligar e depois em Parear (o QR aparece).
3. No tablet, abrir o OpenAlt, tocar em "Parear com QR" e escanear. Esperado: "Pareado com …" sem
   digitar nada, e o PC mostrando o aparelho com o nome do modelo.
4. Tocar no PC na lista. Esperado: abre direto no modo escolhido no PC (atenção: "Nova tela" mexe nos
   monitores).
5. Testar também um QR vencido (esperar 2 min) e um QR de outro PC/certificado, se houver.

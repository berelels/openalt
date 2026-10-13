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

## 1º teste real no tablet (12/10, Galaxy Tab S6 Lite SM-P619, Android 14)

### Funcionou
- **O APK instala ao lado do Moonlight.** Cada build do CI assinava com uma chave nova e o tablet
  recusava atualizar, então agora existe uma chave de debug fixa no projeto,
  `android/openalt-debug.keystore`. Ela é só para testes e não é a de release.
- **Parear com QR:**
  - Funcionou de ponta a ponta, sem digitar o PIN.
  - O tablet ficou salvo no Sunshine como "SM-P619", o modelo.
  - Exigiu duas correções:
    1. **O leitor fechava ao abrir a câmera:** `ClassNotFoundException: androidx.core.content.ContextCompat`
       (o zxing-android-embedded 4.x não traz o androidx.core). Agora o projeto inclui
       `androidx.core:core:1.13.1` e liga `android.useAndroidX=true`.
    2. **O PC não confirmava sozinho:** o Sunshine guarda o `devicename` sem decodificar, e o pedido
       chegou como `OpenAlt-3bf6e2b6d6a0%20SM-P619`. O `matchPending` e o `friendlyName` agora
       decodificam (`decodeName`).
- **Tocar no PC:**
  - Entra direto no app "OpenAlt", sem a grade.
  - Na "Nova tela", o monitor criado foi de 1328×800 (2000×1200 a 150%), abaixo do 27″, em
    DisplayPort-1.
  - O cursor aparece.
  - A 10 Mbps ficou fluido.
  - A janela arrastada para o tablet maximizou sozinha.

### Problemas
- **O Super abria no tablet, e o papel de parede ficava preto nele:**
  - O ArcMenu guarda o monitor pelo número. No X11, o GNOME ordena os monitores pelo nome da saída
    (`DisplayPort-1` vem antes de `DisplayPort-2`), então o tablet virava o nº 0.
  - Reiniciar o GNOME (Alt+F2 → r) resolvia as duas coisas; foi a pessoa que descobriu.
  - Agora, ao conectar e ao desconectar, o app recarrega as extensões ligadas
    (`reloadMonitorSensitiveExtensions`), com religação automática se cair no meio.
  - **Não testado ainda.**
- **Vídeo do YouTube (Brave) cheio de artefatos e travado ao ir para o tablet:**
  - O processo de GPU do Brave caiu: `GPU state invalid after WaitForGetOffsetInRange`, depois
    `GPU process exited unexpectedly: exit_code=512`, às 23:20:49.
  - O travamento das 19:24 (M1) teve o mesmo sinal, e a janela do Claude desktop estava no tablet.
    Então a culpa provavelmente **não** era o `xrandr`.
  - Hipótese: o conector forçado não tem monitor de verdade, e as apps com GL/vsync (Chromium,
    Electron) travam no monitor dele. **Investigar** (ADR-0009).
- **Cursor:** continua a captura X11, com o cursor duplicado na borda quando está em outro monitor.
  A pessoa preferiu isso a não ter cursor.

### Reconexão com a interface nova (12/10, 23:4x)
- **Interface nova do app Android instalada:** chave de debug fixa. Desta vez foi preciso desinstalar
  antes; das próximas, a atualização instala por cima.
- **Erro 409 ao parear** ("pairing session with this uniqueid already exists"):
  - Havia um pedido pendente do **Moonlight original** do mesmo tablet ("roth"). Os clientes Moonlight
    se identificam do mesmo jeito para o Sunshine, que recusa um segundo pedido.
  - Desligar e Ligar no PC limpou o pedido.
  - A fazer: mensagem clara no app e limpeza de pedidos que não são do QR.
- **App do PC travado em "Código vencido":**
  - Laço infinito: `render` → `tickCountdown` → vencido → `render` (100% de CPU, 1,3 GB).
  - Corrigido: só redesenha quando o QR vence durante a contagem.
- **Pareamento por QR e conexão funcionaram de novo.**
- **Reinício do GNOME ao conectar e desconectar:**
  - Não é possível: o serviço `org.gnome.Shell@x11` tem `RefuseManualStop=yes`.
  - Simular Alt+F2 → r pelo teclado não é seguro, porque não dá para saber se a caixa abriu.
  - Ficou a recarga das extensões ligadas. Teste ao vivo: o Super abriu no principal e o papel de
    parede apareceu no tablet.

### Som e reinício automático do GNOME (12/10, 23:5x)
- **Som:**
  - O "Som também no PC" não fazia nada, porque a escolha de tocar no PC é do cliente e não chegava.
  - Virou uma opção com três escolhas:
    - **Aparelho:** padrão do Sunshine.
    - **PC:** `stream_audio = disabled`; o Sunshine nem transmite.
    - **Os dois:** o app liga um `module-loopback` da saída do Sunshine para a saída real do PC
      (`audio.ts`).
  - A configuração antiga `audioOnHost: true` vira "Os dois".
  - Não testado ao vivo.
- **Reinício do GNOME:**
  - Só recarregar as extensões trazia o Super de volta, mas não o papel de parede, que só volta com
    Alt+F2 → r.
  - O app agora digita isso sozinho. Antes, foca a própria janela sem trazê-la para a frente e bloqueia
    teclas por 5 s.
  - 1ª tentativa: a caixa abriu, mas o `xdotool type r` não chegou, porque o `type` remapeia o teclado.
    Trocado por `xdotool key r`. Não testado de novo.
- **Reinício do GNOME, de novo:**
  - O `busctl ... Eval 'Meta.restart(...)'` não serve: o `Eval` está desativado desde o GNOME 41 e
    responde `false`.
  - Com capturas só da área da caixa, deu para ver que o Alt+F2 abre a caixa e o `key r` chega. Com
    0,15 s entre o "r" e o Enter não reiniciava; com 0,4 s reiniciou (00:01:28, "Running GNOME Shell").
  - O app agora confere o reinício pelo nome do Shell no D-Bus (`GetNameOwner org.gnome.Shell` muda) e
    tenta até 3 vezes, fechando a caixa com Esc entre as tentativas.
- **Som:**
  - Passou a ser pela saída padrão do PC (`pactl set-default-sink`), que vale na hora, mesmo conectado.
  - O "PC" via `stream_audio = disabled` só valia depois de religar o Sunshine; no teste, a pessoa
    mudou com ele ligado.

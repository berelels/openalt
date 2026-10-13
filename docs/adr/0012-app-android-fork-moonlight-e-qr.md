# ADR-0012: App Android como fork do Moonlight 12.2, com pareamento por QR

**Status:** Aceita (falta o teste com aparelho real)
**Data:** 2026-10-12
**Decisores:** Catta Studios
**Complementa:** ADR-0002 (fork do Moonlight), ADR-0006 (segurança), ADR-0007 (GPL)

## Contexto
O M2 começa o app Android. O ADR-0002 decidiu por um fork do Moonlight Android e deixou em aberto a
comparação com o Artemis. A pessoa pediu o fork do `moonlight-stream/moonlight-android`. O PC já gera o
QR de pareamento (`core/src/pairing.ts`):
`openalt://pair?v=1&n=&h=&p=&fp=&pin=&d=&exp=`. Ele só confirma sozinho um pedido com o nome
`OpenAlt-<d>` ou `OpenAlt-<d> <modelo>` (`matchPending`).

Restrições:
- O ambiente de nuvem do Claude não alcança `dl.google.com`, então não há SDK nem NDK. A compilação é
  feita no GitHub Actions.
- Uma pessoa mantém o projeto, e o upstream continua evoluindo.

## Decisão
1. **Código:** o Moonlight Android 12.2 entra em `android/` via `git subtree`, com o histórico e a
   autoria originais. O `moonlight-common-c` continua como **submódulo** sem mudanças, com o
   `.gitmodules` na raiz.
2. **Identidade:**
   - `applicationId` passa a ser `dev.cattastudios.openalt` (e `.root` para o sabor root), com o nome
     "OpenAlt" e o ícone próprio.
   - O **namespace Java continua `com.limelight`**: renomear mexeria em centenas de arquivos e tornaria
     cada atualização do upstream um conflito. O código novo fica em `dev.cattastudios.openalt`.
3. **Pareamento por QR** (`PairQrActivity` + `PairingUri`):
   - A URI é lida em Java puro e testável. QR vencido (`agora ≥ exp`, a mesma regra do PC), campo
     repetido, PIN fora de 4 dígitos, `fp` que não é SHA-256 e endereço inválido são recusados.
   - Os endereços são tentados na ordem do QR, com os `100.x` (Tailscale) por último. Vale o primeiro
     que responder ao `serverinfo`.
   - O pareamento usa o protocolo do Moonlight com o PIN do QR. O `devicename`, antes fixo em `"roth"`,
     passa a ser `OpenAlt-<d> <modelo>`.
   - **O certificado confere com o `fp` antes de qualquer dado derivado do PIN:** logo depois de
     `getservercert`, o SHA-256 do certificado (DER) é comparado com o `fp`. Se divergir, o app cancela
     (`unpair`) e não envia o `clientchallenge`. Com isso, um PC impostor não recebe nada que permita
     testar PINs offline.
   - Depois de pareado, o PC é guardado com o certificado fixado, pelo mesmo caminho do pareamento por
     PIN do Moonlight.
4. **Tocar no PC conecta direto** no app "OpenAlt" do Sunshine (`NvHTTP.getAppByName`). A grade de
   apps só aparece se esse app não existir ou se outro app estiver aberto no PC. Não há conexão
   automática ao terminar o pareamento, porque conectar pode criar a "Nova tela" e mexer nos monitores
   da pessoa.
5. **Padrões:** resolução nativa do aparelho (deitada, como as opções "Nativa" do Moonlight), 60 FPS e
   10 Mbps.
6. **Leitor de QR:** `zxing-android-embedded` 4.3.0 (Apache-2.0, sem AndroidX, no Maven Central). A tela
   da câmera gira livremente (`fullSensor`).

## Opções consideradas

### A: Moonlight Android 12.2 (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Média: Java, sem AndroidX |
| Manutenção | Upstream ativo; `git subtree pull` traz as atualizações |
| Licença | GPL-3.0 |

**Prós:** base estável e oficial, que a pessoa pediu.
**Contras:** não tem os recursos do Artemis (resolução por app, monitor virtual).

### B: Artemis
**Prós:** já traz recursos de resolução e tela.
**Contras:** a diferença para o upstream é maior, e a pessoa pediu o Moonlight. Fica para avaliar se
faltar algo que o Artemis já resolve.

### C: Renomear o namespace Java para `dev.cattastudios.openalt`
**Contras:** todo `git subtree pull` viraria conflito em massa, e o ganho é cosmético. O
`applicationId` já basta para instalar ao lado do Moonlight.

### D: Leitor de QR com ML Kit / CameraX
**Contras:** depende do Google Play Services e do AndroidX, e o ML Kit é proprietário. O ZXing é livre
e basta para um QR na tela.

## Análise
- O custo principal do fork é acompanhar o upstream. As mudanças em arquivos do Moonlight foram
  mantidas pequenas e marcadas com "OpenAlt:": `NvHTTP`, `PairingManager`, `PcView`,
  `PreferenceConfiguration`, layouts, manifesto e strings.
- A checagem do `fp` dentro do `PairingManager` é a única mudança no protocolo. Ela só vale quando o
  pareamento vem do QR, e o pareamento por PIN do Moonlight continua igual.

## Consequências
- Mais fácil: atualizar a partir do Moonlight; parear com um toque.
- Mais difícil:
  - Sem SDK local na nuvem, cada mudança no Android só compila no CI.
  - O PIN de 4 dígitos segue o protocolo. A mitigação é o uso único, os 2 minutos de validade, o nome
    do pedido e o `fp` (ADR-0006).
- Rever:
  - Endereço do Tailscale guardado como alternativo (M3). Hoje fica só o endereço que respondeu.
  - Aparelho em pé: o stream continua deitado como no Moonlight (o ADR-0009 e o Sunshine aceitam
    resolução em pé, mas o app ainda não oferece).

## Ações
1. [x] Fork em `android/` com histórico, submódulos e build no GitHub Actions.
2. [x] `PairingUri` com testes de unidade (fixture gerada pelo `core`).
3. [ ] Teste real: escanear o QR do PC com o tablet, conferir a confirmação automática no PC e a
   conexão direta (ver `docs/m2-resultados.md`).
4. [ ] M3: guardar os endereços do Tailscale e testar fora de casa.
5. [ ] `security-review` e `code-review` ao fechar o M2.

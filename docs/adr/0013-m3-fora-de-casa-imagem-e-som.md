# ADR-0013: Fora de casa, imagem e som (decisões do M3)

**Status:** Aceita
**Data:** 2026-10-13
**Decisores:** Catta Studios
**Complementa:** ADR-0003 (Tailscale oficial), ADR-0006 (segurança), ADR-0012 (app Android)

## Contexto
O M3 levou o OpenAlt para fora de casa pelo Tailscale e testou o app Android de verdade
(`docs/m3-resultados.md`). Apareceram cinco questões: o celular não acharia o PC fora de casa; o que
fazer com a "Nova tela" fora de casa; faixas verdes ao espelhar; o som parando; e o app Android pouco
amigável em tela cheia.

## Decisões

1. **O celular guarda todos os endereços do QR** (`KnownAddresses`), na ordem do QR (casa antes do
   Tailscale), e o `ComputerManagerService` do Moonlight os consulta além dos dele (mudança marcada).
   O Moonlight sozinho guarda um endereço manual e reescreve os outros a cada consulta.
2. **Fora de casa, só "Espelhar".** A ponte do Sunshine vê, pelas conexões abertas (`ss`), se o
   aparelho veio de 100.64.0.0/10 e, nesse caso, espelha mesmo com "Nova tela" escolhida. Criar um
   monitor no PC para quem está longe não faz sentido (a pessoa decidiu). Pela mesma razão,
   **descartamos espelhar por um monitor virtual** no tamanho do celular.
3. **Placa AMD: só H.264** (`hevc_mode = 1`, `av1_mode = 1` no Sunshine do OpenAlt). O HEVC pela VAAPI
   da AMD deixa faixas e linhas verdes (Sunshine#4314). Com NVIDIA junto, nada muda (o NVENC vem antes).
   Custo: o H.264 gasta mais banda para a mesma qualidade.
4. **O som é do app do aparelho.** Saiu a escolha "Onde sai o som" do PC (e o `AudioRouter`): o Sunshine
   sempre transmite; "Tocar áudio no PC" do Moonlight decide entre só no aparelho e nos dois.
5. **O app Android é o mesmo app, com jeito de console:** tela de entrada em tela cheia, cartões,
   controle (estilo Xbox, PlayStation ou Switch), a mesma abertura do PC (página local, sem rede, sem
   ponte com o Java), Configurações por categorias que leem o `preferences.xml` do Moonlight e
   mapeamento de botões por controle. A lista original do Moonlight continua acessível.
6. **O login do Tailscale pode ser feito pelo app** (botão "Entrar", só com o clique, via pkexec), como
   registrado no ADR-0003.

## Consequências
- Fora de casa funciona sem digitar endereço; um aparelho pareado antes do M3 precisa parear de novo.
- Quem está longe nunca cria monitor no PC; espelhar com bordas é o normal (como em qualquer Moonlight).
- AMD perde o HEVC; se o Sunshine corrigir o defeito, rever a decisão 3.
- Mudanças em arquivos do Moonlight (marcadas "OpenAlt:"): `ComputerManagerService` (endereços),
  `ControllerHandler` (mapeamento), `StreamSettings` (reabre a tela de entrada), `AndroidManifest`
  (entrada e orientação), `preferences.xml` (estilo do controle).

## Rever
- "Preencher" no Espelhar (pedir o vídeo no formato do monitor): deixado de lado.
- HEVC na AMD quando o Sunshine corrigir o defeito.

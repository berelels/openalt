# ADR-0002: Sunshine como processo externo e app Android como fork do Moonlight

**Status:** Aceita
**Data:** 2026-10-12
**Decisores:** Catta Studios

## Contexto
Captura, codificação de vídeo por hardware, áudio, entrada (toque, mouse, gamepad) e o protocolo
de streaming de baixa latência são problemas difíceis e já resolvidos pelo par **Sunshine** (servidor,
GPL-3.0) + **Moonlight** (cliente, GPL-3.0). O valor do OpenAlt está na experiência:
instalar, um botão, escanear um QR, e o monitor virtual na resolução do aparelho.

## Decisão
- **PC:** app próprio que instala, configura e controla o Sunshine **como processo separado, sem alterar o código dele**. A integração usa só as interfaces públicas: `apps.json` (com `prep-cmd` do/undo), `sunshine.conf`, a API web local e o pareamento por PIN.
- **Android:** app próprio, **fork do Moonlight Android** (ou do Artemis, se for melhor ponto de partida), com pareamento por QR.

## Opções consideradas

### A: Sunshine externo + fork do Moonlight (escolhida)
| Dimensão | Avaliação |
|---|---|
| Complexidade | Média: integração por configuração e API |
| Custo | Baixo |
| Qualidade do streaming | Alta (projetos maduros) |
| Manutenção | Atualizar o Sunshine é só trocar o pacote; o fork Android precisa acompanhar o upstream |

### B: Fork do Sunshine também
**Contras:** manter um fork C++ grande com captura/encoder por GPU; perde as atualizações.

### C: Stack própria (WebRTC, captura e encoder próprios)
**Contras:** meses de trabalho para chegar perto da latência do Moonlight. Fica como pesquisa (M7).

### D: Fork do Artemis em vez do Moonlight
Artemis (fork do Moonlight Android) já traz recursos de "monitor virtual"/resolução e pode
encurtar o caminho. **Avaliar no M2**: atividade do projeto, licença (deve ser GPL-3.0) e o
tamanho da diferença para o upstream.

## Análise
A opção A dá a melhor relação entre qualidade e esforço, e o risco fica concentrado em
pontos testáveis (spikes 2, 4 e 5): expansão das variáveis no `prep-cmd`, escolha da tela
capturada e resolução enviada pelo cliente.

## Consequências
- Fica mais fácil: qualidade de streaming de nível profissional desde o início.
- Fica mais difícil: dependemos do formato de configuração do Sunshine, que pode mudar entre versões. Mitigação: detectar a versão e ter testes com fixtures de configuração.
- **Licença:** o app Android herda a GPL-3.0 do Moonlight; o projeto inteiro é GPL-3.0-or-later (ADR-0007).
- Rever: se o Sunshine não permitir escolher a tela por app (spike 4).

## Ações
1. [ ] Spike 2/4: `prep-cmd` com variáveis e captura do monitor virtual.
2. [ ] M2: comparar Moonlight Android × Artemis antes de fazer o fork.
3. [ ] Sempre fazer backup do `apps.json` e do `sunshine.conf` antes de editar.

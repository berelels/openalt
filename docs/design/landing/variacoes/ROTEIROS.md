# Variações 09–14: a história do boneco, contada pela rolagem

Mistura das favoritas: o personagem e o tom editorial da **03 (Ilustrado)** com o brilho escuro, os nomes de
aparelho ligados por linhas e a faixa de projetos da **02 (Brilho noturno)**.

## A história (vale para todas)

| Capítulo | Hora | Cena | O que o OpenAlt mostra |
|---|---|---|---|
| 01 · Em casa | 07:55 | O jogo roda no PC. Hora de sair. | O PC continua ligado em casa |
| 02 · No caminho | 08:30 | No ônibus, jogando no celular deitado | Jogo pelo 4G/5G com Tailscale |
| 03 · No café | 09:10 | Senta, abre o notebook, põe o tablet do lado | O tablet vira monitor extra (mesmo papel de parede) |
| 04 · Em qualquer lugar | — | Volta ao topo: baixar | "Freedom to stream anywhere, for anyone." |

Isto é só conceito, sem código. A animação será feita depois com GSAP + ScrollTrigger, usando as skills
já no projeto. Ela precisa respeitar "reduzir movimento": nesse caso, as cenas aparecem paradas, uma
embaixo da outra.

## Cada variação e como ela "toca" com a rolagem

**09 · Personagem no escuro** (abertura)
1. O personagem está parado no centro, segurando o tablet.
2. Rolando, a câmera recua: os nomes dos aparelhos acendem um a um, cada um com a sua linha.
3. O personagem abaixa o tablet, que fica em cima da mesa.
4. Uma porta se abre: começa o capítulo 01.

**10 · Creme com brilho** (abertura clara)
1. A lista da direita (Tablet → Phone → Game screen → Away) é o índice da história.
2. A cada item que a rolagem alcança, a bolinha fica vermelha.
3. O personagem troca o que segura: tablet, depois celular deitado, depois tablet de novo.
4. O brilho de fundo muda de cor a cada capítulo.

**11 · Storyboard** (a história inteira)
1. Os 3 quadros ficam presos na tela (*pin*).
2. Rolando, cada quadro cresce até ocupar a tela e a cena ganha movimento:
   - 01: a porta abre;
   - 02: a cidade passa pela janela, num efeito de profundidade;
   - 03: o tablet desliza para o lado do notebook.
3. No fim, os quadros encolhem de volta à fileira e aparece o botão de baixar.

**12 · Capítulo 1: em casa** (cena cheia, uma por tela)
1. A história é contada em telas cheias: esta é a primeira.
2. A barra de capítulos embaixo acompanha a rolagem.
3. Rolando:
   - a lua da janela desce e vira sol, porque o dia passa;
   - o personagem pega o celular e sai pela direita;
   - o jogo do notebook continua rodando, porque o PC fica em casa.
4. Uma cortina vermelha (a mesma da abertura do app) sobe para a cena do ônibus.

**13 · Trajeto** (um caminho só)
1. O caminho pontilhado vai sendo desenhado com a rolagem; o traço vermelho é o progresso.
2. O personagem anda sobre o caminho.
3. A cada parada, o ícone da parada pula, o balão muda ("Still racing", "Found a table") e a barra de horário avança.
4. Bem visual, e o mais simples de fazer.

**14 · Chegada** (último capítulo)
1. Rolando, o tablet entra pela direita e encaixa ao lado do notebook.
2. O papel de parede "se espalha" para ele.
3. Uma janela é arrastada do notebook para o tablet.
4. Termina com o slogan e "Replay the day ↺", que volta ao topo.

## Combinações possíveis
- **09 ou 10 + 12 → (ônibus) → 14:** abertura, depois capítulos em tela cheia. É a mais cinematográfica.
- **13 sozinha:** uma única seção que conta tudo. É a mais leve, boa no celular.
- **11 como resumo:** o storyboard no meio da página, depois do herói, para quem rola rápido.

As imagens estão em `../png/09-…` a `../png/14-…`. As fontes são `src/*.html`; para remontar, rode
`python3 ../montar.py` e depois o `capture.mjs`.

## Sem o boneco (15–18): a mesma história, contada pelas coisas

Mesmo dia (07:55 em casa → 08:30 no ônibus → 09:10 no café) e mesma mistura da 02 com a 03, mas sem
personagem.

**15 · O aparelho é o protagonista** (escura)
1. Um único celular segue a rolagem por um caminho pontilhado, com os "fantasmas" das paradas anteriores.
2. Cada parada acende no caminho: Home → On the bus → Café.
3. A tela do celular muda a cada parada: o app, depois o jogo, depois ele vira um segundo monitor.

**16 · Objetos do dia** (clara)
1. Uma mesa de objetos ilustrados: chaves (07:55), bilhete de ônibus (08:30), xícara (09:10), mais os aparelhos de verdade.
2. Rolando, cada objeto entra na mesa com a sua etiqueta, e a linha pontilhada do horário se preenche.
3. No fim, o tablet desliza para o lado do notebook.

**17 · Uma tela vira outra** (escura, editorial)
1. A manchete "Any screen is your screen" fica parada à esquerda.
2. À direita, a tela se transforma com a rolagem:
   - celular em pé, no pareamento (Pair);
   - celular deitado, jogando (Play);
   - tablet ao lado, como monitor extra (Work).
3. A linha do tempo embaixo marca a hora.

**18 · A área de trabalho cresce** (clara)
1. Começa só o PC (passo 1).
2. Rolando, o celular encaixa à esquerda (passo 2) e o papel de parede passa a continuar nele.
3. O tablet preenche o contorno tracejado à direita (passo 3).
4. É o que o app faz de verdade, sem cena inventada. A mais simples de explicar.

**Combinações sem o boneco:**
- 15 ou 17 como abertura e 18 para explicar a "Nova tela";
- ou só a 16, para uma página mais leve e calorosa.

## 01 + 03 sem o boneco (19–22), com as referências gsap.com · huyml.co · illoca.unseen.co

O que vem de cada favorita:
- **Da 01:** a manchete com serifa e o "anywhere" itálico vermelho, os aparelhos de verdade, a nota à mão "your PC… one more screen" e os números grandes.
- **Da 03:** a grade editorial, os painéis pastel, os balões (monitor e controle), o cartão rosa, o losango "&" e as palavras sublinhadas.

**19 · Editorial com aparelhos** (a mistura mais direta)
- **Imagem:** o layout da 03 com o notebook e o celular no lugar do boneco, e os balões saindo deles.
- **Rolagem:**
  1. os painéis pastel sobem;
  2. o notebook entra;
  3. o celular encaixa ao lado;
  4. os balões "estouram" (escala de 0 a 1, com uma curva elástica);
  5. o cartão rosa vira, mostrando o verso.

**20 · Papel quadriculado** (inspirada no illoca)
- **Imagem:** fundo de planta baixa e um mosaico de blocos geométricos nas cores da marca (wi-fi, casa, controle, QR), com anotações de medida ("side: right · align: top") e um carimbo.
- **Rolagem:**
  1. os blocos do mosaico giram e trocam de lugar, como peças que se encaixam;
  2. as linhas de medida se desenham;
  3. o celular "encaixa" ao lado do notebook, como numa planta.

**21 · Rabiscos** (inspirada no gsap.com)
- **Imagem:** a manchete com um círculo feito à mão em volta de "anywhere" e uma seta até o notebook.
- **Rolagem:**
  1. as palavras da manchete "acendem" uma a uma (cinza → tinta) com a rolagem;
  2. o círculo e a seta se desenham;
  3. os sublinhados do texto aparecem em sequência.

  Fica a cara do site do GSAP, mas com o papel e a serifa do OpenAlt.

**22 · Colagem** (inspirada no huyml.co)
- **Imagem:** aparelhos, balões e selos como adesivos com borda branca e sombra; uma faixa preta correndo com o slogan.
- **Rolagem:**
  1. os adesivos se espalham e giram um pouco (*parallax*: cada um numa velocidade);
  2. a faixa corre na direção da rolagem;
  3. ao passar o mouse, um adesivo "descola".

**Sugestão:** a 21 ou a 19 como topo da página, e a 20 ou a 22 numa seção logo abaixo (ex.: "como funciona").

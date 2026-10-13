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

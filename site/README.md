# Site do OpenAlt

"Empowering anyone to stream anywhere." O site é estático e não tem etapa de compilação: HTML, CSS e
JavaScript feitos à mão, prontos para o GitHub Pages.

- `index.html`: a página inteira.
- `css/site.css`: o estilo "papel quadriculado", com o mosaico de blocos e os aparelhos planos (`.fd-*`).
- `js/i18n.js`: os textos em inglês, português e espanhol.
  - Vale o idioma do navegador; se não for um dos três, inglês.
  - A pessoa troca no topo e a escolha fica guardada no aparelho dela.
- `js/main.js`: as animações (GSAP + ScrollTrigger).
  - Usa `gsap.matchMedia()`: com "reduzir movimento" ligado, nada anima e os modos ficam um embaixo do outro.
  - Seção "Modes": rolagem lateral (*pin* + `ease: "none"`), com as entradas de dentro feitas por `containerAnimation`.
- `js/intro.js`: a abertura dos apps (cópia de `desktop/src/renderer/intro.ts`, por `scripts/sync-android-intro.mjs`).
  - Aqui não dá para pular; com "reduzir movimento", só a logo por um instante.
  - A música é feita no navegador (Web Audio). Sem um toque, o navegador não deixa tocar som: ela entra no primeiro toque ou tecla.
- `vendor/`: GSAP 3.13.0 (`gsap.min.js`, `ScrollTrigger.min.js`), copiado do pacote oficial do npm.
- `fonts/`: Newsreader, Plus Jakarta Sans e JetBrains Mono, todas locais.
- `img/`: o ícone e o papel de parede que "atravessa" as telas na cena da Nova tela.

## Privacidade

- O site não chama nenhum serviço de fora: fontes, GSAP e imagens ficam no próprio site.
- Não tem *analytics* nem *cookies*.
- Só guarda uma coisa no navegador: o idioma escolhido (`localStorage`).

## Licenças

- **Código do site:** GPL-3.0, como o resto do projeto.
- **GSAP:** não é GPL. Usa a "Standard No-Charge License" da GreenSock, que é gratuita e permite usar
  no site (<https://gsap.com/standard-license>).
- **Fontes:** OFL-1.1.

## Ver no computador

Qualquer servidor estático serve. Na pasta `site/`, rode:

```bash
python3 -m http.server 8000
```

Para revisar sem abrir janela, tirando fotos com a rolagem em várias posições, rode a partir de `desktop/`:

```bash
npx electron ../scripts/capture-site.mjs /tmp/fotos desktop pt
```

O 2º argumento pode ser `desktop`, `mobile` ou `reduced` (reduzir movimento). O 3º é `en`, `pt` ou `es`.

## Publicar (GitHub Pages)

**Ainda não publicado.** Quando for a hora, use Settings → Pages → "GitHub Actions" com um
*workflow* que publica a pasta `site/`.

O repositório hoje é privado. Antes de publicar:
- os links de download levam a `github.com/berelels/openalt/releases`, que ainda não tem nenhuma versão;
- o Pages de repositório privado exige um plano pago.

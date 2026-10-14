// Animações do site (GSAP 3.13 + ScrollTrigger, em vendor/). Regras seguidas (skills gsap-*):
// - tudo dentro de gsap.matchMedia(): quem pede "reduzir movimento" vê a página parada e completa;
// - a rolagem lateral usa ease "none" e as animações de dentro dela usam containerAnimation;
// - ScrollTriggers criados de cima para baixo, na ordem da página; só transforms e autoAlpha.
(function () {
  const i18n = window.OpenAltI18n;
  i18n.init();

  // ── abertura (a mesma dos apps), sem pular; a página entra quando a cortina sobe ──
  const introRoot = document.getElementById('intro');
  const revealed = new Promise((resolve) => {
    if (!introRoot || typeof window.playIntro !== 'function') {
      introRoot?.remove();
      document.body.classList.remove('intro-on');
      resolve();
      return;
    }
    window.playIntro(introRoot, resolve, { skippable: false }).then(() => {
      introRoot.remove();
      document.body.classList.remove('intro-on');
    });
  });

  // ── palavras da manchete em <span class="w"> (para entrarem uma a uma) ──
  function splitWords(root) {
    const walk = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
      }
    };
    walk(root);
  }
  const splitAll = () => document.querySelectorAll('[data-split]').forEach(splitWords);
  splitAll();

  // ── papel de parede contínuo: cada tela mostra o seu pedaço do mesmo desenho ──
  function offsetWithin(el, root) {
    let x = 0, y = 0;
    for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  }
  function alignWalls() {
    document.querySelectorAll('[data-wall-root]').forEach((root) => {
      const W = root.offsetWidth, H = root.offsetHeight;
      root.querySelectorAll('.ui-wall.cont').forEach((wall) => {
        const o = offsetWithin(wall, root);
        wall.style.setProperty('--ws', `${W}px ${H}px`);
        wall.style.setProperty('--wp', `${-o.x}px ${-o.y}px`);
      });
    });
  }
  alignWalls();
  window.addEventListener('resize', alignWalls);

  // ── topo ganha linha ao rolar ──
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── "qualquer lado": onde o aparelho está, com o nome no idioma atual ──
  const SIDE = { en: { right: 'right', below: 'below', left: 'left', above: 'above' }, pt: { right: 'direita', below: 'abaixo', left: 'esquerda', above: 'acima' }, es: { right: 'derecha', below: 'abajo', left: 'izquierda', above: 'arriba' } };
  const STOPS = [
    // em % da planta; deitado (rot 90) a caixa gira no centro, por isso o topo compensa
    { side: 'right', of: 'DP-1', left: 79, top: 24, rot: 0 },
    { side: 'below', of: 'DP-1', left: 55, top: 63, rot: 90 },
    { side: 'left', of: 'HDMI-1', left: 5, top: 30, rot: 0 },
    { side: 'above', of: 'DP-1', left: 55, top: 1, rot: 90 },
  ];
  let stopIdx = 0;
  const readout = () => {
    const s = STOPS[stopIdx];
    document.getElementById('planSide').textContent = (SIDE[i18n.lang] || SIDE.en)[s.side];
    document.getElementById('planOf').textContent = s.of;
  };
  readout();

  if (!window.gsap || !window.ScrollTrigger) return; // sem o GSAP: a página continua completa e parada
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'power3.out', duration: 0.9 });

  // ao trocar de idioma: separa as palavras de novo e recalcula as posições
  document.addEventListener('openalt:lang', () => {
    splitAll();
    gsap.set('.h1 .w', { autoAlpha: 1, yPercent: 0 });
    readout();
    alignWalls();
    ScrollTrigger.refresh();
  });

  const mm = gsap.matchMedia();
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', small: '(max-width: 960px)' }, (ctx) => {
    if (!ctx.conditions.motion) return;
    const small = ctx.conditions.small;

    // 1) herói: palavras, texto, blocos do mosaico, aparelhos e as linhas de medida
    const intro = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    revealed.then(() => intro.play());
    intro.from('.h1 .w', { yPercent: 60, autoAlpha: 0, duration: 0.8, stagger: 0.06 })
      .from('.hero .lede, .hero .ctas, .hero .stats', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.7 }, '-=0.4')
      .from('.mosaic .tile', { scale: 0, rotation: () => gsap.utils.random([-90, 90, 180]), transformOrigin: '50% 50%', duration: 0.6, stagger: { each: 0.03, from: 'random' }, ease: 'back.out(1.6)' }, 0.2)
      .from('.hero-lap', { y: 60, rotation: -6, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.4)' }, '-=0.5')
      .from('.hero-phone', { x: 60, rotation: 14, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.6)' }, '-=0.7')
      .from('.hero .dim .rule', { scaleX: 0, duration: 0.6 }, '-=0.3')
      .from('.hero .dim:not(.hero-dim1)', { autoAlpha: 0, x: -10, stagger: 0.1, duration: 0.5 }, '<')
      .from('.hero .stamp', { scale: 0, rotation: -90, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.8)' }, '-=0.3');

    // o carimbo gira e os blocos deslizam um pouco enquanto a página rola (paralaxe)
    gsap.to('.hero .stamp', { rotation: 160, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.mosaic .tile:nth-child(odd)', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-phone', { y: -50, rotation: 6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // 2) modos: a rolagem vertical move a faixa para o lado (ease "none", obrigatório)
    const track = document.getElementById('track');
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const hScroll = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: '#modes', pin: '.modes-pin', start: 'top top', end: () => '+=' + distance(), scrub: small ? 0.6 : 1, invalidateOnRefresh: true },
    });
    // dentro de cada painel, os aparelhos entram quando o painel chega (containerAnimation)
    track.querySelectorAll('[data-panel]').forEach((panel) => {
      const items = panel.querySelectorAll('[data-in]');
      const tl = gsap.timeline({ scrollTrigger: { trigger: panel, containerAnimation: hScroll, start: 'left 75%', toggleActions: 'play none none reverse' } });
      tl.from(panel.querySelectorAll('.blk'), { scale: 0, transformOrigin: '100% 100%', duration: 0.6, stagger: 0.08, ease: 'power2.out' })
        .from(items, {
          x: (i, el) => (el.dataset.from === 'right' ? 140 : 0),
          y: (i, el) => (el.dataset.from === 'bottom' ? 140 : 50),
          rotation: (i) => (i % 2 ? 8 : -8),
          autoAlpha: 0, duration: 0.8, stagger: 0.12, ease: 'back.out(1.5)',
        }, '-=0.35')
        .from(panel.querySelectorAll('.pin'), { scale: 0, autoAlpha: 0, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, '-=0.5')
        .from(panel.querySelectorAll('.txt > *'), { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, 0);
    });

    // 3) como funciona: os passos entram juntos, um depois do outro
    gsap.set('.step', { y: 60, autoAlpha: 0 });
    ScrollTrigger.batch('.step', {
      start: 'top 85%',
      onEnter: (els) => gsap.to(els, { y: 0, autoAlpha: 1, stagger: 0.15, overwrite: true }),
    });
    gsap.from('.step .art > *', { scale: 0, rotation: -20, duration: 0.7, stagger: 0.15, ease: 'back.out(2)', scrollTrigger: { trigger: '.steps', start: 'top 70%' } });

    // 4) qualquer lado: o aparelho dá a volta nos monitores conforme a rolagem
    const dev = document.getElementById('planDev');
    gsap.set(dev, { left: STOPS[0].left + '%', top: STOPS[0].top + '%' });
    const sides = gsap.timeline({
      defaults: { duration: 1, ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '#sides', start: small ? 'top 60%' : 'top 30%', end: small ? '+=900' : '+=1400', scrub: 0.8, pin: !small,
        onUpdate: (st) => { const i = Math.min(STOPS.length - 1, Math.floor(st.progress * STOPS.length)); if (i !== stopIdx) { stopIdx = i; readout(); } },
      },
    });
    STOPS.slice(1).forEach((s) => sides.to(dev, { left: s.left + '%', top: s.top + '%', rotation: s.rot }));

    // 5) aberto e privado: os cartões viram para a frente
    gsap.set('.cardx', { rotationX: -70, y: 40, autoAlpha: 0, transformOrigin: '50% 0%', transformPerspective: 800 });
    ScrollTrigger.batch('.cardx', {
      start: 'top 88%',
      onEnter: (els) => gsap.to(els, { rotationX: 0, y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.8, overwrite: true }),
    });

    // 6) baixar: os blocos giram para dentro e o carimbo roda
    gsap.from('.dl-tiles .tile', { scale: 0, rotation: 180, stagger: 0.1, ease: 'back.out(1.6)', scrollTrigger: { trigger: '.dl-box', start: 'top 70%' } });
    gsap.from('.dl-box .h2, .dl-box .lede, .dl-box .plat', { y: 30, autoAlpha: 0, stagger: 0.1, scrollTrigger: { trigger: '.dl-box', start: 'top 75%' } });
    gsap.to('.dl-box .stamp', { rotation: -120, ease: 'none', scrollTrigger: { trigger: '.dl-box', start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // fontes carregadas mudam o tamanho do texto: recalcula as posições
  document.fonts?.ready.then(() => { alignWalls(); ScrollTrigger.refresh(); });
})();

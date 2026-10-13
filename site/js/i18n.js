// Textos do site em inglês, português e espanhol. O idioma é o do navegador (se não for um dos três,
// inglês); a pessoa troca no topo e a escolha fica guardada neste aparelho.
// No HTML: data-i18n="chave" troca o conteúdo (pode ter <em>/<br>); data-i18n-aria troca o aria-label.
(function () {
  const T = {
    en: {
      'meta.title': 'OpenAlt — Empowering anyone to stream anywhere',
      'meta.desc': 'Free and open source: turn your phone or tablet into a second monitor, a mirror of your PC or a game screen. One QR code.',
      skip: 'Skip to content', 'lang.label': 'Language',
      'nav.modes': '01 Modes', 'nav.how': '02 How it works', 'nav.sides': '03 Any side', 'nav.open': '04 Open source', 'nav.download': 'Download',
      'hero.title': 'Empowering anyone to stream <em>anywhere.</em>',
      'hero.lede': 'Your phone or tablet becomes a second monitor, a mirror of your PC or a game screen. One QR code. That’s the setup.',
      'hero.cta': 'Get it for Linux', 'hero.cta2': 'See the plan',
      'stat.modes': 'modes', 'stat.qr': 'QR to pair', 'stat.places': 'places to stream',
      'hero.dim1': '+ 1 screen · 1080×2400', 'hero.dim2': '← side: right · align: top',
      stamp: 'One QR<br>No PIN<br>No account<br>GPL-3.0',
      'modes.eyebrow': '01 · Modes', 'modes.title': 'One phone. <em>Four</em> jobs.',
      'modes.lede': 'Keep scrolling: the page moves sideways, like dragging a window to a new screen.', 'modes.hint': 'Scroll',
      'p1.title': 'A <em>new</em> screen', 'p1.text': 'One more monitor, on any side of any monitor. Drag a window over — it opens maximized on the tablet.', 'p1.tag': 'side: right · align: center',
      'p2.title': '<em>Mirror</em> any monitor', 'p2.text': 'Show your main screen — or any other — exactly as it is, on the phone or tablet in your hands.', 'p2.tag': 'mirror: LG 27″',
      'p3.title': 'A <em>game</em> screen', 'p3.text': 'Your PC games on the sofa or in bed, streamed by Sunshine. Plug in a controller if you like.', 'p3.tag': 'up to your screen’s Hz',
      'p4.title': '<em>Away</em> from home', 'p4.text': 'Leave the PC at home and take its screen with you — over 4G, 5G or any Wi-Fi, with Tailscale and your own account. No port to open.', 'p4.tag': 'encrypted · your account',
      'p4.home': 'Home PC', 'p4.bus': 'On the bus', 'p4.cafe': 'Café',
      'how.eyebrow': '02 · How it works', 'how.title': 'Three steps. <em>Once.</em>',
      's1.title': 'Install on your PC', 's1.text': 'OpenAlt sets up Sunshine with its own config — yours stays untouched. Linux today, Windows next.',
      's2.title': 'Turn it on', 's2.text': 'Nothing runs until you press the button. Press it again and everything goes back to how it was.',
      's3.title': 'Scan the QR', 's3.text': 'Open the OpenAlt app on the phone and point it at the code. It works once and expires in two minutes. No PIN.',
      'sides.eyebrow': '03 · Any side', 'sides.title': 'Any phone. Any side. <em>Any</em> monitor.',
      'sides.lede': 'Right, left, above or below — of any monitor you have. Phone or tablet, standing or lying down. OpenAlt doesn’t assume your setup.',
      'plan.side': 'side', 'plan.of': 'of', chip1: '1 · 2 · 3 · 4+ monitors', chip2: 'phone · tablet', chip3: 'standing · lying down', chip4: 'right · left · above · below',
      'open.eyebrow': '04 · Open source', 'open.title': 'Yours. <em>Open.</em> Private.',
      'c1.b': 'Free, forever', 'c1.p': 'GPL-3.0. No ads, no account, no tracking. Read every line of the code.', 'c1.a': 'Source code ↗',
      'c2.p': 'Single-use pairing code that expires in two minutes.',
      'c3.p': 'ports to open on your router. Away from home it goes through Tailscale, with your own account.',
      'c4.b': 'Built on giants', 'c4.p': 'Streaming by Sunshine (LizardByte) and the Moonlight protocol. The Android app is a fork of Moonlight Android.',
      'c5.p': 'Available now. Windows is next; Wayland after that.', 'c6.p': 'Any phone or tablet with Android. The app scans the QR and connects on its own.',
      'dl.eyebrow': 'Download', 'dl.title': 'Take your PC <em>anywhere.</em>', 'dl.lede': 'Install on the PC, get the app on the phone, scan once. Empowering anyone to stream anywhere.',
      'dl.linux': 'PC · Linux', 'dl.android': 'Phone · Android', 'dl.windows': 'Windows · coming soon',
      'foot.by': 'Made by', 'foot.project': 'Project', 'foot.source': 'Source code', 'foot.releases': 'Releases', 'foot.built': 'Built on',
    },
    pt: {
      'meta.title': 'OpenAlt — Qualquer pessoa transmitindo de qualquer lugar',
      'meta.desc': 'Livre e de código aberto: transforme o celular ou o tablet em um segundo monitor, em espelho do PC ou em tela de jogo. Um QR code.',
      skip: 'Pular para o conteúdo', 'lang.label': 'Idioma',
      'nav.modes': '01 Modos', 'nav.how': '02 Como funciona', 'nav.sides': '03 Qualquer lado', 'nav.open': '04 Código aberto', 'nav.download': 'Baixar',
      'hero.title': 'Qualquer pessoa transmitindo <em>de qualquer lugar.</em>',
      'hero.lede': 'O seu celular ou tablet vira um segundo monitor, um espelho do PC ou uma tela de jogo. Um QR code. É só isso.',
      'hero.cta': 'Baixar para Linux', 'hero.cta2': 'Ver a planta',
      'stat.modes': 'modos', 'stat.qr': 'QR para parear', 'stat.places': 'lugares para usar',
      'hero.dim1': '+ 1 tela · 1080×2400', 'hero.dim2': '← lado: direita · alinhar: topo',
      stamp: 'Um QR<br>Sem PIN<br>Sem conta<br>GPL-3.0',
      'modes.eyebrow': '01 · Modos', 'modes.title': 'Um celular. <em>Quatro</em> funções.',
      'modes.lede': 'Continue rolando: a página anda para o lado, como arrastar uma janela para uma tela nova.', 'modes.hint': 'Role',
      'p1.title': 'Uma tela <em>nova</em>', 'p1.text': 'Mais um monitor, em qualquer lado de qualquer monitor. Arraste uma janela até ele — ela abre maximizada no tablet.', 'p1.tag': 'lado: direita · alinhar: centro',
      'p2.title': '<em>Espelhe</em> qualquer monitor', 'p2.text': 'Mostre a tela principal — ou qualquer outra — exatamente como ela está, no celular ou tablet na sua mão.', 'p2.tag': 'espelhar: LG 27″',
      'p3.title': 'Uma tela de <em>jogo</em>', 'p3.text': 'Os jogos do PC no sofá ou na cama, transmitidos pelo Sunshine. Ligue um controle, se quiser.', 'p3.tag': 'até os Hz da sua tela',
      'p4.title': '<em>Fora</em> de casa', 'p4.text': 'Deixe o PC em casa e leve a tela dele com você — no 4G, no 5G ou em qualquer Wi-Fi, com o Tailscale e a sua própria conta. Sem abrir porta.', 'p4.tag': 'criptografado · a sua conta',
      'p4.home': 'PC de casa', 'p4.bus': 'No ônibus', 'p4.cafe': 'Café',
      'how.eyebrow': '02 · Como funciona', 'how.title': 'Três passos. <em>Uma vez.</em>',
      's1.title': 'Instale no PC', 's1.text': 'O OpenAlt prepara o Sunshine com uma configuração só dele — a sua fica intacta. Linux hoje, Windows em seguida.',
      's2.title': 'Ligue', 's2.text': 'Nada roda até você apertar o botão. Aperte de novo e tudo volta a ser como era.',
      's3.title': 'Escaneie o QR', 's3.text': 'Abra o app OpenAlt no celular e aponte para o código. Ele vale uma vez e vence em dois minutos. Sem PIN.',
      'sides.eyebrow': '03 · Qualquer lado', 'sides.title': 'Qualquer celular. Qualquer lado. <em>Qualquer</em> monitor.',
      'sides.lede': 'À direita, à esquerda, acima ou abaixo — de qualquer monitor seu. Celular ou tablet, em pé ou deitado. O OpenAlt não supõe nada do seu PC.',
      'plan.side': 'lado', 'plan.of': 'de', chip1: '1 · 2 · 3 · 4+ monitores', chip2: 'celular · tablet', chip3: 'em pé · deitado', chip4: 'direita · esquerda · acima · abaixo',
      'open.eyebrow': '04 · Código aberto', 'open.title': 'Seu. <em>Aberto.</em> Privado.',
      'c1.b': 'Livre, para sempre', 'c1.p': 'GPL-3.0. Sem anúncio, sem conta, sem rastreio. Leia cada linha do código.', 'c1.a': 'Código-fonte ↗',
      'c2.p': 'Código de pareamento de uso único, que vence em dois minutos.',
      'c3.p': 'portas para abrir no roteador. Fora de casa, passa pelo Tailscale, com a sua própria conta.',
      'c4.b': 'Em ombros de gigantes', 'c4.p': 'Transmissão pelo Sunshine (LizardByte) e pelo protocolo do Moonlight. O app Android é um fork do Moonlight Android.',
      'c5.p': 'Disponível agora. Depois vem o Windows; e então o Wayland.', 'c6.p': 'Qualquer celular ou tablet com Android. O app lê o QR e conecta sozinho.',
      'dl.eyebrow': 'Baixar', 'dl.title': 'Leve o seu PC <em>para qualquer lugar.</em>', 'dl.lede': 'Instale no PC, baixe o app no celular, escaneie uma vez. Qualquer pessoa transmitindo de qualquer lugar.',
      'dl.linux': 'PC · Linux', 'dl.android': 'Celular · Android', 'dl.windows': 'Windows · em breve',
      'foot.by': 'Feito por', 'foot.project': 'Projeto', 'foot.source': 'Código-fonte', 'foot.releases': 'Versões', 'foot.built': 'Feito sobre',
    },
    es: {
      'meta.title': 'OpenAlt — Cualquier persona transmitiendo desde cualquier lugar',
      'meta.desc': 'Libre y de código abierto: convierte tu celular o tableta en un segundo monitor, en espejo de tu PC o en pantalla de juego. Un código QR.',
      skip: 'Saltar al contenido', 'lang.label': 'Idioma',
      'nav.modes': '01 Modos', 'nav.how': '02 Cómo funciona', 'nav.sides': '03 Cualquier lado', 'nav.open': '04 Código abierto', 'nav.download': 'Descargar',
      'hero.title': 'Cualquier persona transmitiendo <em>desde cualquier lugar.</em>',
      'hero.lede': 'Tu celular o tableta se convierte en un segundo monitor, en un espejo de tu PC o en una pantalla de juego. Un código QR. Eso es todo.',
      'hero.cta': 'Descargar para Linux', 'hero.cta2': 'Ver el plano',
      'stat.modes': 'modos', 'stat.qr': 'QR para vincular', 'stat.places': 'lugares para usarlo',
      'hero.dim1': '+ 1 pantalla · 1080×2400', 'hero.dim2': '← lado: derecha · alinear: arriba',
      stamp: 'Un QR<br>Sin PIN<br>Sin cuenta<br>GPL-3.0',
      'modes.eyebrow': '01 · Modos', 'modes.title': 'Un celular. <em>Cuatro</em> funciones.',
      'modes.lede': 'Sigue bajando: la página se mueve de lado, como arrastrar una ventana a una pantalla nueva.', 'modes.hint': 'Desliza',
      'p1.title': 'Una pantalla <em>nueva</em>', 'p1.text': 'Un monitor más, en cualquier lado de cualquier monitor. Arrastra una ventana hasta él — se abre maximizada en la tableta.', 'p1.tag': 'lado: derecha · alinear: centro',
      'p2.title': '<em>Duplica</em> cualquier monitor', 'p2.text': 'Muestra tu pantalla principal — o cualquier otra — tal cual, en el celular o la tableta que tienes en la mano.', 'p2.tag': 'duplicar: LG 27″',
      'p3.title': 'Una pantalla de <em>juego</em>', 'p3.text': 'Los juegos de tu PC en el sofá o en la cama, transmitidos por Sunshine. Conecta un control si quieres.', 'p3.tag': 'hasta los Hz de tu pantalla',
      'p4.title': '<em>Fuera</em> de casa', 'p4.text': 'Deja el PC en casa y llévate su pantalla — por 4G, 5G o cualquier Wi-Fi, con Tailscale y tu propia cuenta. Sin abrir puertos.', 'p4.tag': 'cifrado · tu cuenta',
      'p4.home': 'PC de casa', 'p4.bus': 'En el bus', 'p4.cafe': 'Café',
      'how.eyebrow': '02 · Cómo funciona', 'how.title': 'Tres pasos. <em>Una vez.</em>',
      's1.title': 'Instala en tu PC', 's1.text': 'OpenAlt prepara Sunshine con una configuración propia — la tuya queda intacta. Linux hoy, Windows después.',
      's2.title': 'Enciéndelo', 's2.text': 'Nada se ejecuta hasta que presionas el botón. Presiónalo otra vez y todo vuelve a estar como antes.',
      's3.title': 'Escanea el QR', 's3.text': 'Abre la app OpenAlt en el celular y apunta al código. Sirve una sola vez y vence en dos minutos. Sin PIN.',
      'sides.eyebrow': '03 · Cualquier lado', 'sides.title': 'Cualquier celular. Cualquier lado. <em>Cualquier</em> monitor.',
      'sides.lede': 'A la derecha, a la izquierda, arriba o abajo — de cualquier monitor que tengas. Celular o tableta, en vertical u horizontal. OpenAlt no da nada por supuesto.',
      'plan.side': 'lado', 'plan.of': 'de', chip1: '1 · 2 · 3 · 4+ monitores', chip2: 'celular · tableta', chip3: 'vertical · horizontal', chip4: 'derecha · izquierda · arriba · abajo',
      'open.eyebrow': '04 · Código abierto', 'open.title': 'Tuyo. <em>Abierto.</em> Privado.',
      'c1.b': 'Libre, para siempre', 'c1.p': 'GPL-3.0. Sin anuncios, sin cuenta, sin rastreo. Lee cada línea del código.', 'c1.a': 'Código fuente ↗',
      'c2.p': 'Código para vincular de un solo uso, que vence en dos minutos.',
      'c3.p': 'puertos que abrir en tu router. Fuera de casa pasa por Tailscale, con tu propia cuenta.',
      'c4.b': 'A hombros de gigantes', 'c4.p': 'Transmisión con Sunshine (LizardByte) y el protocolo de Moonlight. La app Android es un fork de Moonlight Android.',
      'c5.p': 'Disponible ahora. Después viene Windows; y luego Wayland.', 'c6.p': 'Cualquier celular o tableta con Android. La app lee el QR y se conecta sola.',
      'dl.eyebrow': 'Descargar', 'dl.title': 'Lleva tu PC <em>a cualquier lugar.</em>', 'dl.lede': 'Instala en el PC, descarga la app en el celular, escanea una vez. Cualquier persona transmitiendo desde cualquier lugar.',
      'dl.linux': 'PC · Linux', 'dl.android': 'Celular · Android', 'dl.windows': 'Windows · muy pronto',
      'foot.by': 'Hecho por', 'foot.project': 'Proyecto', 'foot.source': 'Código fuente', 'foot.releases': 'Versiones', 'foot.built': 'Hecho sobre',
    },
  };
  const LANGS = ['en', 'pt', 'es'];
  const HTML_LANG = { en: 'en', pt: 'pt-BR', es: 'es' };

  function pick() {
    try { const s = localStorage.getItem('openalt-site-lang'); if (LANGS.includes(s)) return s; } catch (e) { /* sem armazenamento */ }
    for (const l of navigator.languages || [navigator.language || 'en']) {
      const b = String(l).slice(0, 2).toLowerCase();
      if (LANGS.includes(b)) return b;
    }
    return 'en';
  }

  function apply(lang) {
    const d = T[lang] || T.en;
    document.documentElement.lang = HTML_LANG[lang];
    document.title = d['meta.title'];
    document.querySelector('meta[name="description"]')?.setAttribute('content', d['meta.desc']);
    document.querySelectorAll('[data-i18n]').forEach((el) => { const v = d[el.dataset.i18n]; if (v != null) el.innerHTML = v; });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { const v = d[el.dataset.i18nAria]; if (v != null) el.setAttribute('aria-label', v); });
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.dispatchEvent(new CustomEvent('openalt:lang', { detail: lang }));
  }

  window.OpenAltI18n = {
    lang: pick(),
    set(lang) {
      if (!LANGS.includes(lang)) return;
      this.lang = lang;
      try { localStorage.setItem('openalt-site-lang', lang); } catch (e) { /* vale só agora */ }
      apply(lang);
    },
    init() {
      apply(this.lang);
      document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => this.set(b.dataset.lang)));
    },
    keys: T,
  };
})();

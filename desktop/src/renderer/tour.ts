// Tour guiado: escurece a tela, recorta o item da vez e mostra um cartão ao lado dele, com
// Voltar / Próximo / Pular. Só olhar e avançar: o tour não clica em nada do app, e a camada por
// cima não deixa clicar no que está atrás. Teclado: → ou Enter avançam, ← volta, Esc sai.
// Os textos vêm prontos de app.ts (já no idioma da pessoa).

interface TourStep {
  /** o que destacar; vazio = cartão no meio, sem recorte */
  targets: () => Element[];
  title: string;
  text: string;
  /** prepara a tela (trocar de aba, por exemplo) antes de procurar o alvo */
  before?: () => void;
}

interface TourLabels {
  step: (n: number, total: number) => string;
  back: string;
  next: string;
  done: string;
  skip: string;
}

interface TourHandle {
  /** recalcula o recorte (depois que o app redesenha a tela) */
  relayout(): void;
  end(): void;
}

function runTour(steps: TourStep[], labels: TourLabels, onEnd: () => void): TourHandle {
  const root = document.createElement('div');
  root.className = 'tour';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'tourTitle');
  root.setAttribute('aria-describedby', 'tourText');
  root.innerHTML = `
    <div class="tour-shade"></div>
    <div class="tour-hole" aria-hidden="true"></div>
    <section class="tour-card">
      <p class="tour-count" id="tourCount"></p>
      <h2 class="tour-title" id="tourTitle"></h2>
      <p class="tour-text" id="tourText"></p>
      <div class="tour-actions">
        <button class="btn ghost small" data-tour="skip">${labels.skip}</button>
        <span class="tour-gap"></span>
        <button class="btn outline small" data-tour="back">${labels.back}</button>
        <button class="btn primary small" data-tour="next">${labels.next}</button>
      </div>
    </section>`;
  document.body.appendChild(root);
  const hole = root.querySelector<HTMLElement>('.tour-hole')!;
  const card = root.querySelector<HTMLElement>('.tour-card')!;
  const back = root.querySelector<HTMLButtonElement>('[data-tour=back]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-tour=next]')!;
  const before = document.activeElement as HTMLElement | null;
  let index = 0;
  let ended = false;

  function targetsNow(): Element[] {
    return steps[index].targets().filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  function layout() {
    if (ended) return;
    const els = targetsNow();
    const vw = innerWidth;
    const vh = innerHeight;
    const M = 16;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    if (!els.length) {
      hole.hidden = true;
      root.classList.add('no-hole');
      card.style.left = `${Math.round((vw - cw) / 2)}px`;
      card.style.top = `${Math.round((vh - ch) / 2)}px`;
      return;
    }
    hole.hidden = false;
    root.classList.remove('no-hole');
    const rs = els.map((el) => el.getBoundingClientRect());
    const pad = 8;
    const r = {
      left: Math.max(4, Math.min(...rs.map((x) => x.left)) - pad),
      top: Math.max(4, Math.min(...rs.map((x) => x.top)) - pad),
      right: Math.min(vw - 4, Math.max(...rs.map((x) => x.right)) + pad),
      bottom: Math.min(vh - 4, Math.max(...rs.map((x) => x.bottom)) + pad),
    };
    hole.style.left = `${r.left}px`;
    hole.style.top = `${r.top}px`;
    hole.style.width = `${r.right - r.left}px`;
    hole.style.height = `${r.bottom - r.top}px`;
    // o cartão ao lado do recorte: direita, esquerda, embaixo, em cima; senão, por cima, no canto
    const gap = 18;
    const clampX = (x: number) => Math.min(Math.max(M, x), vw - cw - M);
    const clampY = (y: number) => Math.min(Math.max(M, y), vh - ch - M);
    let x: number;
    let y: number;
    if (vw - r.right - gap >= cw + M) { x = r.right + gap; y = clampY(r.top); }
    else if (r.left - gap >= cw + M) { x = r.left - gap - cw; y = clampY(r.top); }
    else if (vh - r.bottom - gap >= ch + M) { x = clampX(r.left); y = r.bottom + gap; }
    else if (r.top - gap >= ch + M) { x = clampX(r.left); y = r.top - gap - ch; }
    else { x = vw - cw - M; y = vh - ch - M; }
    card.style.left = `${Math.round(x)}px`;
    card.style.top = `${Math.round(y)}px`;
  }

  /** Rola até o alvo se ele estiver fora da vista (ele pode crescer depois, quando o app redesenha). */
  function reveal() {
    const first = targetsNow()[0];
    if (!first) return;
    const r = first.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) first.scrollIntoView({ block: r.height < innerHeight * 0.8 ? 'center' : 'start' });
  }

  function show(i: number) {
    index = i;
    const s = steps[i];
    s.before?.();
    root.querySelector('#tourCount')!.textContent = labels.step(i + 1, steps.length);
    root.querySelector('#tourTitle')!.innerHTML = s.title;
    root.querySelector('#tourText')!.innerHTML = s.text;
    back.hidden = i === 0;
    next.textContent = i === steps.length - 1 ? labels.done : labels.next;
    // o alvo pode estar fora da vista (a tela rola); depois de rolar, recorta
    reveal();
    layout();
    requestAnimationFrame(layout);
    next.focus({ preventScroll: true });
  }

  function end() {
    if (ended) return;
    ended = true;
    root.remove();
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', layout);
    document.removeEventListener('scroll', layout, true);
    before?.focus?.({ preventScroll: true });
    onEnd();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (index < steps.length - 1) show(index + 1); else end(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (index > 0) show(index - 1); }
    else if (e.key === 'Tab') {
      // o foco fica nos botões do cartão
      const bs = [...root.querySelectorAll<HTMLButtonElement>('button:not([hidden])')];
      const at = bs.indexOf(document.activeElement as HTMLButtonElement);
      bs[(at + (e.shiftKey ? bs.length - 1 : 1) + bs.length) % bs.length]?.focus();
    } else return; // Enter e espaço: o botão com foco cuida
    e.preventDefault();
    e.stopPropagation();
  }

  root.querySelector('[data-tour=skip]')!.addEventListener('click', end);
  back.addEventListener('click', () => { if (index > 0) show(index - 1); });
  next.addEventListener('click', () => { if (index < steps.length - 1) show(index + 1); else end(); });
  addEventListener('keydown', onKey, true);
  addEventListener('resize', layout);
  document.addEventListener('scroll', layout, true);
  show(0);
  return { relayout: () => { reveal(); layout(); }, end };
}

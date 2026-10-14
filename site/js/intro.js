"use strict";
// Abertura do OpenAlt — toca toda vez que o app abre (como o Big Picture do Steam).
//
// Os traços se REDESENHAM, como uma caneta: todas as formas (controle → monitor → celular →
// logo) viram UM caminho contínuo, ligado por curvas de passagem. O traço visível é um pedaço
// desse caminho que anda por ele: a ponta desenha a próxima forma enquanto a cauda apaga a
// anterior. As linhas se movem; nada se deforma. O traço curto faz o mesmo no caminho dele.
//
// Depois, a cortina vermelha sobe como gelatina: borda ondulada, o meio na frente, um balanço.
// Clique ou tecla pula (no site não). Com "reduzir movimento" do sistema, só a logo por um instante.
//
// A música é feita aqui mesmo (Web Audio, sem arquivo): C → Lá menor → Fá → Sol, uma nota a cada
// forma que fica pronta e o acorde final quando a cortina sobe. Pular corta a música e toca o final.
/** Formas no espaço 512×512. "a" é o traço principal; "b", o traço curto. Comandos absolutos no começo. */
const INTRO_SHAPES = [
    {
        name: 'controle',
        a: 'M256 196C300 196 330 190 356 190C404 190 430 226 440 272C452 330 446 372 414 378C390 382 372 360 354 336C342 320 330 314 300 314H212C182 314 170 320 158 336C140 360 122 382 98 378C66 372 60 330 72 272C82 226 108 190 156 190C182 190 212 196 256 196',
        b: 'M124 258H186',
    },
    {
        name: 'monitor',
        a: 'M256 400V350H120C100 350 88 338 88 318V182C88 162 100 150 120 150H392C412 150 424 162 424 182V318C424 338 412 350 392 350H256',
        b: 'M200 404H312',
    },
    {
        name: 'celular',
        a: 'M256 424H206C192 424 184 416 184 402V122C184 108 192 100 206 100H306C320 100 328 108 328 122V402C328 416 320 424 306 424H256',
        b: 'M240 124H272',
    },
    {
        name: 'logo',
        a: 'M86 156c62-2 108-6 136 16 30 24 26 80 40 124 18 56 78 92 126 64 40-24 30-90-14-96-50-8-72 52-40 92 22 28 62 34 92 24',
        b: 'M270 152c50-8 96-10 144-6',
    },
];
const SVG_NS = 'http://www.w3.org/2000/svg';
function introMeasure(svg, d) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
    return p;
}
/** Junta as formas num caminho só; cada passagem é uma curva que segue a direção da caneta. */
function introTrack(svg, parts) {
    let d = parts[0];
    const starts = [0];
    const ends = [];
    const len = (path) => { const p = introMeasure(svg, path); const l = p.getTotalLength(); p.remove(); return l; };
    ends.push(len(d));
    for (let i = 1; i < parts.length; i++) {
        const prev = introMeasure(svg, d);
        const L = prev.getTotalLength();
        const e = prev.getPointAtLength(L);
        const e0 = prev.getPointAtLength(Math.max(0, L - 8));
        prev.remove();
        const next = introMeasure(svg, parts[i]);
        const s = next.getPointAtLength(0);
        const s1 = next.getPointAtLength(Math.min(8, next.getTotalLength()));
        next.remove();
        const dist = Math.hypot(s.x - e.x, s.y - e.y);
        const k = Math.min(170, 0.5 * dist + 40);
        const norm = (x, y) => { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };
        const [tx, ty] = norm(e.x - e0.x, e.y - e0.y);
        const [ux, uy] = norm(s1.x - s.x, s1.y - s.y);
        d += `C${(e.x + tx * k).toFixed(1)} ${(e.y + ty * k).toFixed(1)} ${(s.x - ux * k).toFixed(1)} ${(s.y - uy * k).toFixed(1)} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        starts.push(len(d));
        d += parts[i].replace(/^M\s*-?[\d.]+[\s,]+-?[\d.]+/, ''); // a passagem já termina no começo da forma
        ends.push(len(d));
    }
    return { d, starts, ends, total: ends[ends.length - 1] };
}
/** Mostra só o pedaço [cauda, ponta] do caminho. */
function introWindow(path, total, tail, head) {
    const t = Math.max(0, Math.min(tail, total));
    const h = Math.max(t + 0.01, Math.min(head, total));
    // um traço só, deslocado até a cauda (um traço de tamanho zero no começo, com ponta
    // redonda, deixaria um pontinho solto no início do caminho)
    path.style.strokeDasharray = `${(h - t).toFixed(2)} ${(total + 50).toFixed(2)}`;
    path.style.strokeDashoffset = `${(-t).toFixed(2)}`;
}
const introHz = (midi) => 440 * 2 ** ((midi - 69) / 12);
/** A partitura, presa à linha do tempo da abertura (ms). */
function introScore(sectionStarts, arrivals, curtainStart) {
    const chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]]; // C, Am, F, G
    const melody = [[76, 72], [81, 76], [84, 81], [86, 83]]; // nota de chegada e a de passagem antes dela
    const notes = [];
    chords.forEach((c, i) => {
        const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : curtainStart;
        notes.push({ t: sectionStarts[i], kind: 'pad', f: c.slice(1).map((n) => introHz(n + 12)), d: end - sectionStarts[i] + 250 });
        notes.push({ t: sectionStarts[i], kind: 'bass', f: [introHz(c[0] - 12)], d: 900 });
    });
    arrivals.forEach((t, i) => {
        notes.push({ t: t - 140, kind: 'pluck', f: [introHz(melody[i][1])], d: 400 });
        notes.push({ t, kind: 'pluck', f: [introHz(melody[i][0])], d: 900 });
    });
    notes.push({ t: curtainStart - 250, kind: 'whoosh', f: [], d: 1100 });
    notes.push({ t: curtainStart, kind: 'bell', f: [72, 76, 79, 84, 88].map(introHz), d: 1900 });
    notes.push({ t: curtainStart, kind: 'bass', f: [introHz(36)], d: 1700 });
    return notes;
}
/** `clock` diz em que ponto (ms) a abertura está: o som pode ser liberado no meio dela. */
function introMusic(score, clock) {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC)
        return null;
    let ctx;
    try {
        ctx = new AC();
    }
    catch {
        return null;
    }
    let bus = null;
    let wanted = false; // play() chamado com o som ainda preso
    ctx.onstatechange = () => {
        if (ctx.state === 'running' && wanted) {
            wanted = false;
            start(clock());
        }
    };
    void ctx.resume().catch(() => { });
    let noise = null;
    const env = (g, when, peak, attack, dur) => {
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(peak, when + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    };
    const osc = (type, f, when, dur, out, detune = 0) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(out);
        o.start(when);
        o.stop(when + dur + 0.05);
    };
    function voice(n, when, dur, out) {
        const g = ctx.createGain();
        g.connect(out);
        if (n.kind === 'pluck') {
            env(g, when, 0.5, 0.005, dur);
            osc('triangle', n.f[0], when, dur, g);
            const h = ctx.createGain();
            h.gain.value = 0.25;
            h.connect(g);
            osc('sine', n.f[0] * 2, when, dur, h);
        }
        else if (n.kind === 'bass') {
            env(g, when, 0.55, 0.01, dur);
            osc('sine', n.f[0], when, dur, g);
            osc('triangle', n.f[0], when, dur, g);
        }
        else if (n.kind === 'pad') {
            // dois dentes de serra levemente desafinados por nota, abafados: um colchão macio
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 900;
            lp.connect(g);
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(0.05, when + Math.min(0.35, dur / 3));
            g.gain.setValueAtTime(0.05, when + Math.max(0, dur - 0.3));
            g.gain.linearRampToValueAtTime(0, when + dur);
            for (const f of n.f) {
                osc('sawtooth', f, when, dur, lp, -7);
                osc('sawtooth', f, when, dur, lp, 7);
            }
        }
        else if (n.kind === 'bell') {
            env(g, when, 0.35, 0.004, dur);
            n.f.forEach((f, i) => {
                const v = ctx.createGain();
                v.gain.value = i === n.f.length - 1 ? 0.5 : 1;
                v.connect(g);
                osc('sine', f, when + i * 0.035, dur, v); // um arpejo rapidinho
                const p = ctx.createGain();
                p.gain.value = 0.12;
                p.connect(v);
                osc('sine', f * 2.76, when + i * 0.035, dur * 0.4, p); // o brilho de sino
            });
        }
        else {
            // o vento da cortina: ruído num filtro que sobe
            if (!noise) {
                noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
                const ch = noise.getChannelData(0);
                for (let i = 0; i < ch.length; i++)
                    ch[i] = Math.random() * 2 - 1;
            }
            const src = ctx.createBufferSource();
            src.buffer = noise;
            src.loop = true;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.Q.value = 1.2;
            bp.frequency.setValueAtTime(350, when);
            bp.frequency.exponentialRampToValueAtTime(4200, when + dur);
            src.connect(bp);
            bp.connect(g);
            g.gain.setValueAtTime(0.0001, when);
            g.gain.exponentialRampToValueAtTime(0.16, when + dur * 0.55);
            g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
            src.start(when);
            src.stop(when + dur + 0.05);
        }
    }
    function start(at) {
        if (ctx.state !== 'running') {
            wanted = true;
            return;
        }
        const b = ctx.createGain();
        b.gain.value = 0.22;
        b.connect(ctx.destination);
        bus = b;
        const t0 = ctx.currentTime + 0.03;
        for (const n of score) {
            if (n.t + n.d <= at || (n.t < at && n.kind !== 'pad'))
                continue;
            const from = Math.max(n.t, at);
            voice(n, t0 + (from - at) / 1000, (n.t + n.d - from) / 1000, b);
        }
    }
    return {
        play: start,
        cut() {
            wanted = false;
            bus?.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
            bus = null;
        },
        resume() { void ctx.resume().catch(() => { }); },
        close(afterMs) {
            wanted = false;
            setTimeout(() => { void ctx.close().catch(() => { }); }, afterMs);
        },
    };
}
const introEase = {
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    out: (t) => 1 - (1 - t) ** 3,
};
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
/**
 * Toca a abertura dentro de `root` e resolve quando a cortina terminou de subir.
 * `onReveal` é chamado quando a cortina começa a subir (o painel entra junto).
 */
function playIntro(root, onReveal = () => { }, options = {}) {
    const skippable = options.skippable !== false;
    let revealed = false;
    const reveal = () => { if (!revealed) {
        revealed = true;
        onReveal();
    } };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.hidden = false;
    root.innerHTML = `
    <svg class="intro-curtain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path id="introCurtain"/></svg>
    <svg class="intro-mark" viewBox="0 0 512 512" role="img" aria-label="OpenAlt">
      <path id="introA"/><path id="introB"/>
    </svg>
    <p class="intro-credit">Made by Catta Studios</p>`;
    const mark = root.querySelector('.intro-mark');
    const pa = root.querySelector('#introA');
    const pb = root.querySelector('#introB');
    const curtain = root.querySelector('#introCurtain');
    const credit = root.querySelector('.intro-credit');
    const A = introTrack(mark, INTRO_SHAPES.map((s) => s.a));
    const B = introTrack(mark, INTRO_SHAPES.map((s) => s.b));
    pa.setAttribute('d', A.d);
    pb.setAttribute('d', B.d);
    const last = INTRO_SHAPES.length - 1;
    // Linha do tempo (ms): desenha o controle; depois a linha corre até cada forma seguinte.
    const DRAW = 850;
    const HOLD = 320;
    const RUN = 760;
    const LOGO_HOLD = 480;
    const CURTAIN = 1000;
    const runStart = (i) => DRAW + HOLD + i * (RUN + HOLD); // início da corrida da forma i para i+1
    const curtainStart = runStart(last - 1) + RUN + LOGO_HOLD;
    // o relógio começa no PRIMEIRO QUADRO desenhado (ver abaixo); -1 = ainda não começou
    let start = -1;
    const music = options.music === false ? null : introMusic(introScore([0, ...INTRO_SHAPES.slice(1).map((_, i) => runStart(i))], [DRAW, ...INTRO_SHAPES.slice(1).map((_, i) => runStart(i) + RUN)], curtainStart), () => (start < 0 ? 0 : performance.now() - start));
    // imperfeições da borda da cortina, diferentes a cada abertura
    const ph = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
    function drawCurtain(p) {
        // p: 0 = cortina cobrindo tudo, 1 = já saiu por cima
        const e = introEase.inOut(p);
        const base = 100 + 5 * Math.sin(Math.PI * Math.min(p / 0.18, 1)) - 135 * e; // afunda um pouco e sobe
        const swing = Math.sin(Math.PI * p);
        const pts = [];
        for (let i = 0; i <= 40; i++) {
            const x = i * 2.5;
            const u = (x - 50) / 50;
            const bulge = 16 * swing * (1 - u * u); // o meio sobe na frente das pontas
            const wobble = swing * (3.2 * Math.sin(x * 0.12 + ph[0] + p * 7) + 1.8 * Math.sin(x * 0.29 + ph[1] - p * 11) + 0.9 * Math.sin(x * 0.55 + ph[2] + p * 17));
            pts.push(`${x.toFixed(2)} ${(base - bulge + wobble).toFixed(2)}`);
        }
        curtain.setAttribute('d', `M0 -40H100V${pts[pts.length - 1].split(' ')[1]}L${pts.reverse().join('L')}Z`);
        // a logo sobe junto com a cortina e some
        mark.style.transform = `translateY(${Math.min(0, base - 100)}vh)`;
        mark.style.opacity = String(Math.max(0, 1 - p * 1.6));
        if (p > 0) {
            // o painel entra enquanto a cortina sobe; a assinatura some
            credit.style.animation = 'none';
            credit.style.opacity = '0';
            reveal();
        }
    }
    /** Posição da linha no tempo t: cauda e ponta ao longo do caminho. */
    function lineAt(T, t, drawDelay = 0) {
        if (t < runStart(0)) {
            return [0, T.ends[0] * introEase.out(clamp01((t - drawDelay) / (DRAW - drawDelay)))];
        }
        for (let i = 0; i < last; i++) {
            const s0 = runStart(i);
            if (t < s0 + RUN + HOLD || i === last - 1) {
                const k = introEase.inOut(clamp01((t - s0) / RUN));
                return [T.starts[i] + (T.starts[i + 1] - T.starts[i]) * k, T.ends[i] + (T.ends[i + 1] - T.ends[i]) * k];
            }
        }
        return [T.starts[last], T.ends[last]];
    }
    drawCurtain(0);
    root.classList.remove('boot'); // a partir daqui a cortina desenhada cobre a tela
    return new Promise((resolve) => {
        // o relógio começa no PRIMEIRO QUADRO desenhado: com a janela ainda escondida o navegador
        // não desenha, e contar desde o carregamento fazia a abertura "já ter acabado" ao aparecer
        let raf = 0;
        let done = false;
        const finish = () => {
            if (done)
                return;
            done = true;
            cancelAnimationFrame(raf);
            removeEventListener('keydown', skip, true);
            root.removeEventListener('pointerdown', skip);
            removeEventListener('pointerdown', unblockMusic, true);
            removeEventListener('keydown', unblockMusic, true);
            music?.close(2500); // deixa o acorde final soar
            root.hidden = true;
            root.innerHTML = '';
            reveal();
            resolve();
        };
        /** Pular: a linha vai para a logo e a cortina sobe. */
        function skip(e) {
            e.preventDefault();
            e.stopPropagation();
            const now = performance.now();
            if (start < 0)
                start = now;
            if (now - start < curtainStart) {
                start = now - curtainStart;
                music?.cut();
                music?.play(curtainStart);
            }
        }
        if (skippable) {
            addEventListener('keydown', skip, true);
            root.addEventListener('pointerdown', skip);
        }
        // sem gesto, o navegador (no site) segura o som: ele entra no primeiro toque, de onde a abertura estiver
        function unblockMusic() {
            if (!done)
                music?.resume();
        }
        addEventListener('pointerdown', unblockMusic, true);
        addEventListener('keydown', unblockMusic, true);
        if (reduce) {
            music?.play(curtainStart); // só o acorde final
            introWindow(pa, A.total, A.starts[last], A.ends[last]);
            introWindow(pb, B.total, B.starts[last], B.ends[last]);
            root.classList.add('fade-out');
            setTimeout(reveal, 300);
            setTimeout(finish, 900);
            return;
        }
        const frame = (now) => {
            if (start < 0) {
                start = now;
                music?.play(0);
            }
            const t = now - start;
            const [ta, ha] = lineAt(A, t);
            const [tb, hb] = lineAt(B, t, DRAW * 0.55); // o traço curto entra depois, como um segundo gesto
            introWindow(pa, A.total, ta, ha);
            introWindow(pb, B.total, tb, hb);
            drawCurtain(clamp01((t - curtainStart) / CURTAIN));
            if (t >= curtainStart + CURTAIN)
                finish();
            else
                raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
    });
}

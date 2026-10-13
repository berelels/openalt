// Interface do OpenAlt (renderer). Sem Node: fala com o processo principal só pela API
// `window.openalt` (contextBridge, ADR-0011). Sem ela (abrindo o HTML direto), usa uma
// simulação — é o protótipo de design, com ?demo para trocar de estado.

type Side = 'right' | 'left' | 'above' | 'below';
type Align = 'start' | 'center' | 'end';
type Mode = 'extend' | 'mirror';
type Phase = 'setup' | 'off' | 'starting' | 'waiting' | 'connected';
type Support = 'ok' | 'untested' | 'needs-setup' | 'unsupported';
/** Celular ou tablet: o OpenAlt serve para os dois. */
type Kind = 'phone' | 'tablet';
/** Como o aparelho é segurado. "auto" = como estiver na mão (o app Android decide, M2). */
type Orientation = 'auto' | 'portrait' | 'landscape';
type View = 'home' | 'devices' | 'pc' | 'about';

interface Rect { x: number; y: number; width: number; height: number }
interface Monitor extends Rect { id: string; name: string; primary: boolean }
interface Placement { anchor: string; side: Side; align: Align; offset: number }
interface Device { name: string; kind: Kind; width: number; height: number; fps: number; network: 'local' | 'tailscale' }
interface PairedDevice { id: string; name: string; kind: Kind; width: number; height: number; network: 'local' | 'tailscale'; lastSeen: string; live: boolean }
interface Check { id: string; status: Support; message: string }

interface State {
  phase: Phase;
  pcName: string;
  monitors: Monitor[];
  placement: Placement;
  mode: Mode;
  mirrorOf: string;
  audioOnHost: boolean;
  rememberLayout: boolean;
  orientation: Orientation;
  /** Tipo usado na prévia enquanto nenhum aparelho está conectado. */
  previewKind: Kind;
  /** tamanho da interface no aparelho, em % */
  uiScale: number;
  maximizeOnDevice?: boolean;
  device: Device | null;
  paired: PairedDevice[];
  pairing: { qrSvg: string; expiresAt: number } | null;
  /** endereços deste PC, para adicionar à mão no Moonlight */
  addresses?: string[];
  setup: { sunshine: 'ok' | 'missing'; helper: 'ok' | 'missing' };
  checks: Check[];
  /** última falha a mostrar (ex.: portas do Sunshine em uso) */
  error: string | null;
}

type Plan = { layout: Record<string, Rect>; error?: undefined } | { layout?: undefined; error: string };

interface OpenAltApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): void;
  ligar(): Promise<void>;
  desligar(): Promise<void>;
  novoQr(): Promise<void>;
  parearPin(pin: string, name?: string): Promise<{ ok: boolean; message: string }>;
  setPlacement(p: Placement): Promise<void>;
  setMode(m: Mode): Promise<void>;
  setMirrorOf(id: string): Promise<void>;
  setOrientation(o: Orientation): Promise<void>;
  setUiScale(v: number): Promise<void>;
  setPreviewKind(k: Kind): Promise<void>;
  setPref(key: 'audioOnHost' | 'rememberLayout' | 'maximizeOnDevice', value: boolean): Promise<void>;
  esquecer(id: string): Promise<void>;
  instalarSunshine(): Promise<void>;
  instalarPermissao(): Promise<void>;
  plan(p: Placement, size: { width: number; height: number }): Promise<Plan>;
}

// ── utilidades ──────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

/** Todo texto de fora (nome de monitor, de aparelho, de PC) passa por aqui. */
function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const SIDE_LABEL: Record<Side, string> = { right: 'à direita', left: 'à esquerda', above: 'acima', below: 'abaixo' };
const SIDE_ICON: Record<Side, string> = { right: 'east', left: 'west', above: 'north', below: 'south' };
const ALIGN_LABEL: Record<Side, Record<Align, string>> = {
  right: { start: 'Topo', center: 'Centro', end: 'Base' },
  left: { start: 'Topo', center: 'Centro', end: 'Base' },
  above: { start: 'Esquerda', center: 'Centro', end: 'Direita' },
  below: { start: 'Esquerda', center: 'Centro', end: 'Direita' },
};
const KIND_LABEL: Record<Kind, string> = { phone: 'Celular', tablet: 'Tablet' };
const KIND_ICON: Record<Kind, string> = { phone: 'smartphone', tablet: 'tablet' };
const ORIENT_LABEL: Record<Orientation, string> = { auto: 'Automática', portrait: 'Em pé', landscape: 'Deitado' };
const ORIENT_ICON: Record<Orientation, string> = { auto: 'screen_rotation', portrait: 'stay_current_portrait', landscape: 'stay_current_landscape' };

/** Tamanho típico, só para a prévia antes de conectar (o certo vem do aparelho). */
function estimatedSize(kind: Kind, o: Orientation): { width: number; height: number } {
  const base = kind === 'phone' ? { width: 1080, height: 2400 } : { width: 1600, height: 2560 };
  // "automática": celular costuma ficar em pé, tablet deitado
  const landscape = o === 'landscape' || (o === 'auto' && kind === 'tablet');
  return landscape ? { width: base.height, height: base.width } : base;
}

function deviceSize(s: State) {
  return s.device ? { width: s.device.width, height: s.device.height } : estimatedSize(s.previewKind, s.orientation);
}

function monitorName(s: State, id: string): string {
  return s.monitors.find((m) => m.id === id)?.name ?? id;
}

function noun(s: State): string {
  return s.device ? (s.device.kind === 'tablet' ? 'o tablet' : 'o celular') : 'o aparelho';
}

// ── simulação (protótipo de design) ─────────────────────────────────────────
function placeBesideMock(mons: Monitor[], size: { width: number; height: number }, p: Placement): Plan {
  // Mesma regra do núcleo (core/src/layout.ts), só para a demonstração.
  const a = mons.find((m) => m.id === p.anchor);
  if (!a) return { error: 'Monitor de referência não encontrado' };
  const out: Record<string, Rect> = {};
  for (const m of mons) out[m.id] = { x: m.x, y: m.y, width: m.width, height: m.height };
  const cross = (len: number, l: number) => (p.align === 'start' ? 0 : p.align === 'end' ? len - l : Math.floor((len - l) / 2));
  const { width: w, height: h } = size;
  const ay = a.y + cross(a.height, h) + p.offset;
  const ax = a.x + cross(a.width, w) + p.offset;
  out.cel = { right: { x: a.x + a.width, y: ay, width: w, height: h }, left: { x: a.x - w, y: ay, width: w, height: h },
    below: { x: ax, y: a.y + a.height, width: w, height: h }, above: { x: ax, y: a.y - h, width: w, height: h } }[p.side];
  const hz = p.side === 'right' || p.side === 'left';
  const fw = p.side === 'right' || p.side === 'below';
  const edge = hz ? (fw ? a.x + a.width : a.x) : fw ? a.y + a.height : a.y;
  const over = (r: Rect, q: Rect) => Math.min(r.x + r.width, q.x + q.width) > Math.max(r.x, q.x) && Math.min(r.y + r.height, q.y + q.height) > Math.max(r.y, q.y);
  const queue = ['cel'];
  while (queue.length) {
    const k = queue.shift()!;
    const m = out[k];
    for (const [n, r] of Object.entries(out)) {
      if (n === k || !over(m, r)) continue;
      const pos = hz ? r.x : r.y;
      const len = hz ? r.width : r.height;
      if (!(fw ? pos >= edge : pos + len <= edge)) {
        return { error: `Não cabe aí: ficaria por cima de ${mons.find((x) => x.id === n)?.name ?? n}` };
      }
      if (hz) r.x = fw ? m.x + m.width : m.x - r.width;
      else r.y = fw ? m.y + m.height : m.y - r.height;
      queue.push(n);
    }
  }
  const minX = Math.min(...Object.values(out).map((r) => r.x));
  const minY = Math.min(...Object.values(out).map((r) => r.y));
  for (const r of Object.values(out)) { r.x -= minX; r.y -= minY; }
  return { layout: out };
}

const DEMO_MONITORS: Record<string, Monitor[]> = {
  um: [{ id: 'eDP-1', name: 'Tela do notebook', x: 0, y: 0, width: 1366, height: 768, primary: true }],
  dois: [
    { id: 'HDMI-A-0', name: 'LG 19″', x: 0, y: 0, width: 1440, height: 900, primary: false },
    { id: 'DisplayPort-2', name: 'LG 27″', x: 1440, y: 0, width: 1920, height: 1080, primary: true },
  ],
  tres: [
    { id: 'DP-1', name: 'Dell 24″', x: 0, y: 0, width: 1920, height: 1080, primary: false },
    { id: 'DP-2', name: 'Samsung 32″', x: 1920, y: 0, width: 2560, height: 1440, primary: true },
    { id: 'HDMI-1', name: 'AOC girado', x: 4480, y: 0, width: 1080, height: 1920, primary: false },
  ],
};

const DEMO_DEVICES: Record<string, Device> = {
  celular: { name: 'Moto g84', kind: 'phone', width: 1080, height: 2400, fps: 60, network: 'local' },
  'celular-deitado': { name: 'Moto g84', kind: 'phone', width: 2400, height: 1080, fps: 120, network: 'tailscale' },
  tablet: { name: 'Galaxy Tab S9', kind: 'tablet', width: 2560, height: 1600, fps: 60, network: 'local' },
};

function fakeQr(seed: number): string {
  // Desenho com cara de QR só para o protótipo (o real vem do núcleo).
  const n = 29;
  let x = seed || 7;
  const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) % 100) / 100;
  const cells: string[] = [];
  const finder = (cx: number, cy: number) =>
    `<rect x="${cx}" y="${cy}" width="7" height="7" fill="#26211b"/><rect x="${cx + 1}" y="${cy + 1}" width="5" height="5" fill="#fffdf8"/><rect x="${cx + 2}" y="${cy + 2}" width="3" height="3" fill="#26211b"/>`;
  const inFinder = (i: number, j: number) => (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!inFinder(i, j) && rnd() > 0.52) cells.push(`<rect x="${i}" y="${j}" width="1" height="1"/>`);
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="Código QR de pareamento (exemplo)" shape-rendering="crispEdges"><g fill="#26211b">${cells.join('')}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

type DemoPatch = Partial<State> & { monitorsKey?: string; deviceKey?: string | null };

function mockApi(): OpenAltApi & { demo(patch: DemoPatch): void } {
  const listeners: ((s: State) => void)[] = [];
  const s: State = {
    phase: 'off',
    pcName: 'meu-pc',
    monitors: DEMO_MONITORS.dois,
    placement: { anchor: 'DisplayPort-2', side: 'right', align: 'start', offset: 0 },
    mode: 'extend',
    mirrorOf: 'DisplayPort-2',
    audioOnHost: true,
    rememberLayout: false,
    orientation: 'auto',
    previewKind: 'phone',
    uiScale: 125,
    device: null,
    paired: [
      { id: 'a1', name: 'Moto g84', kind: 'phone', width: 1080, height: 2400, network: 'local', lastSeen: 'hoje, 17:57', live: false },
      { id: 'b2', name: 'Galaxy Tab S9', kind: 'tablet', width: 2560, height: 1600, network: 'tailscale', lastSeen: 'ontem', live: false },
    ],
    pairing: null,
    setup: { sunshine: 'ok', helper: 'missing' },
    checks: [
      { id: 'session', status: 'ok', message: 'Sessão X11.' },
      { id: 'desktop', status: 'ok', message: 'Área de trabalho GNOME.' },
      { id: 'gpu', status: 'ok', message: 'Placa de vídeo testada (amdgpu).' },
      { id: 'free-output', status: 'ok', message: 'Saída de vídeo livre: DisplayPort-0.' },
      { id: 'connector', status: 'ok', message: 'Saída livre identificada no sistema.' },
      { id: 'helper', status: 'needs-setup', message: 'Falta instalar a permissão do sistema (pedida uma vez, na instalação).' },
    ],
    error: null,
  };
  const emit = () => listeners.forEach((cb) => cb(structuredClone(s)));
  const qr = () => { s.pairing = { qrSvg: fakeQr(Date.now() & 0xffff), expiresAt: Date.now() + 120_000 }; };
  return {
    async getState() { return structuredClone(s); },
    onState(cb) { listeners.push(cb); },
    async ligar() {
      s.phase = 'starting'; emit();
      await new Promise((r) => setTimeout(r, 900));
      s.phase = 'waiting'; qr(); emit();
    },
    async desligar() { s.phase = 'off'; s.device = null; s.pairing = null; s.paired.forEach((d) => (d.live = false)); emit(); },
    async novoQr() { qr(); emit(); },
    async parearPin(pin: string) { return /^\d{4}$/.test(pin) ? { ok: true, message: 'Pareado! (exemplo)' } : { ok: false, message: 'O PIN tem 4 números.' }; },
    async setPlacement(p) { s.placement = p; emit(); },
    async setMode(m) { s.mode = m; emit(); },
    async setMirrorOf(id) { s.mirrorOf = id; emit(); },
    async setOrientation(o) { s.orientation = o; emit(); },
    async setUiScale(v) { s.uiScale = v; emit(); },
    async setPreviewKind(k) { s.previewKind = k; emit(); },
    async setPref(k, v) { s[k] = v; emit(); },
    async esquecer(id) { s.paired = s.paired.filter((d) => d.id !== id); emit(); },
    async instalarSunshine() { s.setup.sunshine = 'ok'; emit(); },
    async instalarPermissao() {
      s.setup.helper = 'ok';
      s.checks = s.checks.map((c) => (c.id === 'helper' ? { ...c, status: 'ok', message: 'Permissão do sistema instalada.' } : c));
      emit();
    },
    async plan(p, size) { return placeBesideMock(s.monitors, size, p); },
    demo(patch) {
      if (patch.monitorsKey) {
        s.monitors = DEMO_MONITORS[patch.monitorsKey];
        const primary = (s.monitors.find((m) => m.primary) ?? s.monitors[0]).id;
        s.placement = { ...s.placement, anchor: primary };
        s.mirrorOf = primary;
      }
      if (patch.deviceKey !== undefined) {
        s.device = patch.deviceKey ? DEMO_DEVICES[patch.deviceKey] : null;
        s.paired.forEach((d) => (d.live = !!s.device && d.name === s.device.name));
      }
      const { monitorsKey: _m, deviceKey: _d, ...rest } = patch;
      Object.assign(s, rest);
      if (s.phase === 'waiting' && !s.pairing) qr();
      emit();
    },
  };
}

// ── janela (tela cheia) ─────────────────────────────────────────────────────
interface WindowApi {
  toggleFullscreen(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  onFullscreen(cb: (on: boolean) => void): void;
}
const winApi = (window as unknown as { openaltWindow?: WindowApi }).openaltWindow;
let fullscreen = false;

async function toggleFullscreen() {
  if (winApi) fullscreen = await winApi.toggleFullscreen();
  else if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen().catch(() => {});
}

function initWindow() {
  const update = (on: boolean) => { fullscreen = on; const b = document.getElementById('btnFullscreen'); if (b) render(); };
  if (winApi) { winApi.onFullscreen(update); void winApi.isFullscreen().then((on) => (fullscreen = on)); }
  else document.addEventListener('fullscreenchange', () => update(!!document.fullscreenElement));
  // Esc sai da tela cheia (F11 alterna; tratado no processo principal)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && fullscreen) void toggleFullscreen(); });
}

// ── estado da tela ──────────────────────────────────────────────────────────
const w = window as unknown as { openalt?: OpenAltApi };
const isDemo = !w.openalt;
const api: OpenAltApi = w.openalt ?? mockApi();
let state: State;
let view: View = 'home';
let countdownTimer = 0;

// ── tema ────────────────────────────────────────────────────────────────────
function themePref(): string {
  try { return localStorage.getItem('openalt-theme') ?? 'system'; } catch { return 'system'; }
}
function applyTheme(opt: string) {
  const dark = opt === 'dark' || (opt === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll<HTMLButtonElement>('[data-theme-opt]').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.themeOpt === opt)));
}
function initTheme() {
  applyTheme(themePref());
  document.querySelectorAll<HTMLButtonElement>('[data-theme-opt]').forEach((b) =>
    b.addEventListener('click', () => {
      try { localStorage.setItem('openalt-theme', b.dataset.themeOpt!); } catch { /* sem armazenamento */ }
      applyTheme(b.dataset.themeOpt!);
    }));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (themePref() === 'system') applyTheme('system'); });
}

// ── pedaços ─────────────────────────────────────────────────────────────────
function topbar(title: string, sub: string, live = false): string {
  const s = state;
  const net = s.device?.network === 'tailscale' ? 'Fora de casa' : 'Rede local';
  return `
    <header class="topbar">
      <div>
        <h1 class="page-title fade-up">${title}</h1>
        <p class="page-sub fade-up d1">${live ? '<span class="status-dot live-dot" aria-hidden="true"></span>' : ''}${sub}</p>
      </div>
      <div class="top-actions fade-up d2">
        <span class="pill-btn"><span class="ms" aria-hidden="true">computer</span><strong>${esc(s.pcName)}</strong></span>
        <span class="pill-btn"><span class="ms" aria-hidden="true">${s.device?.network === 'tailscale' ? 'public' : 'wifi'}</span>${net}</span>
        <button class="icon-btn" data-goto="pc" aria-label="O que funciona neste PC"><span class="ms" aria-hidden="true">tune</span></button>
        <button class="icon-btn" id="btnFullscreen" aria-label="${fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (F11)'}" title="${fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (F11)'}"><span class="ms" aria-hidden="true">${fullscreen ? 'fullscreen_exit' : 'fullscreen'}</span></button>
      </div>
    </header>
    ${s.error ? `<p class="error-banner fade-up" role="alert"><span class="ms" aria-hidden="true">error</span>${esc(s.error)}</p>` : ''}`;
}

function seg(name: string, label: string, items: [string, string, string?][], current: string, attr: string): string {
  return `<div class="seg" role="radiogroup" aria-label="${label}" data-group="${name}">${items.map(([v, text, icon]) =>
    `<button role="radio" ${attr}="${esc(v)}" aria-checked="${v === current}">${icon ? `<span class="ms" aria-hidden="true">${icon}</span>` : ''}${text}</button>`).join('')}</div>`;
}

function connectionCard(): string {
  const s = state;
  const d = s.device;
  const [word, sub] = {
    setup: ['Preparar', 'Primeira vez neste PC'],
    off: ['Desligado', 'Nada ligado sem você pedir'],
    starting: ['Ligando…', 'Iniciando o Sunshine'],
    waiting: ['Esperando', `Escaneie o código com ${noun(s)}`],
    connected: ['Conectado', s.mode === 'mirror' ? `Espelhando ${esc(monitorName(s, s.mirrorOf))}` : 'Mais uma tela'],
  }[s.phase];
  const stats = d
    ? [[`${d.width}×${d.height}`, 'resolução'], [`${d.fps} Hz`, 'taxa'], [d.network === 'tailscale' ? 'Remota' : 'Local', 'conexão']]
    : [[String(s.monitors.length), s.monitors.length === 1 ? 'monitor' : 'monitores'], [s.mode === 'mirror' ? 'Espelho' : 'Nova', 'modo'], [s.audioOnHost ? 'Os dois' : 'Aparelho', 'som']];
  const on = s.phase === 'waiting' || s.phase === 'connected';
  return `
    <section class="card accent c4 fade-up d1" aria-labelledby="connTitle">
      <div class="card-top"><h2 class="card-name" id="connTitle">Conexão</h2>
        <span class="corner-btn" aria-hidden="true"><span class="ms">${on ? 'cast_connected' : 'cast'}</span></span></div>
      <p class="big" aria-live="polite">${word}</p>
      <p class="big-sub">${sub}</p>
      <div class="stats">${stats.map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join('')}</div>
      <button class="power-round" id="btnPower" ${s.phase === 'starting' ? 'disabled' : ''}>
        <span class="ms" aria-hidden="true">power_settings_new</span>${on ? 'Desligar' : 'Ligar'}</button>
    </section>`;
}

function modeCard(): string {
  const s = state;
  const opt = (m: Mode, title: string, hint: string) =>
    `<li><button class="mode-opt" role="radio" data-mode="${m}" aria-checked="${s.mode === m}"><span class="dot" aria-hidden="true"></span><span>${title}<small>${hint}</small></span></button></li>`;
  return `
    <section class="card sage c3 fade-up d2" aria-labelledby="modeTitle">
      <div class="card-top"><h2 class="card-name" id="modeTitle">Modo</h2>
        <span class="corner-btn" aria-hidden="true"><span class="ms">${s.mode === 'mirror' ? 'screen_share' : 'add_to_queue'}</span></span></div>
      <ul class="mode-list" role="radiogroup" aria-labelledby="modeTitle">
        ${opt('extend', 'Nova tela', 'Um monitor a mais')}
        ${opt('mirror', 'Espelhar', 'Mostra um monitor')}
      </ul>
    </section>`;
}

function deviceIllu(kind: Kind, size: { width: number; height: number }, max = 190): string {
  const k = Math.min(max / size.width, max / size.height);
  return `<div class="device-illu ${kind}" data-size="${Math.round(size.width * k)},${Math.round(size.height * k)}" role="img"
    aria-label="${KIND_LABEL[kind]} ${size.width > size.height ? 'deitado' : 'em pé'}"></div>`;
}

function showcaseCard(): string {
  const s = state;
  if (s.phase === 'waiting') {
    const expired = !s.pairing || s.pairing.expiresAt <= Date.now();
    return `
      <section class="card c5 r2 fade-up d3" aria-labelledby="pairTitle">
        <div class="card-top"><div><h2 class="card-name" id="pairTitle">Parear</h2>
          <p class="card-hint">App OpenAlt → “Parear” → aponte para o código</p></div></div>
        <div class="qr-wrap">
          <div class="qr-box ${expired ? 'expired' : ''}">${s.pairing?.qrSvg ?? ''}${expired ? '<div class="qr-expired">Código vencido</div>' : ''}</div>
          <p class="qr-meta" aria-live="polite"><span>Vale por <span class="countdown" id="countdown">—</span> · uma vez só</span>
            <button class="btn outline small" id="btnNewQr"><span class="ms" aria-hidden="true">refresh</span>Gerar outro</button></p>
          <p class="card-hint">Mesmo Wi-Fi deste PC, ou Tailscale para fora de casa.</p>
          <form class="pin-form" id="pinForm" autocomplete="off">
            <label class="card-hint" for="pinInput">Usando o Moonlight? Digite o PIN que ele mostra:</label>
            <div class="pin-row"><input id="pinInput" class="pin-input" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" aria-describedby="pinMsg">
              <input id="pinName" class="pin-name" maxlength="32" placeholder="Nome (ex.: Tablet)" aria-label="Nome do aparelho (opcional)">
              <button class="btn outline small" type="submit">Parear</button></div>
            <p class="card-hint" id="pinMsg" aria-live="polite">${s.addresses?.length ? `Endereço deste PC: ${s.addresses.map(esc).join(' · ')}` : ''}</p>
          </form>
        </div>
      </section>`;
  }
  const d = s.device;
  const kind = d?.kind ?? s.previewKind;
  const size = deviceSize(s);
  const orientText = size.width > size.height ? 'deitado' : 'em pé';
  return `
    <section class="card c5 r2 fade-up d3" aria-labelledby="devTitle">
      <div class="showcase">
        <div class="card-top">
          <span class="tag ${d ? 'live' : ''}"><span class="ms" aria-hidden="true">${d ? 'bolt' : 'visibility'}</span>${d ? 'Conectado' : 'Prévia'}</span>
          <button class="corner-btn" data-goto="devices" aria-label="Ver aparelhos pareados"><span class="ms" aria-hidden="true">devices</span></button>
        </div>
        <div class="device-stage">${deviceIllu(kind, size)}</div>
        <h2 class="device-title" id="devTitle">${d ? esc(d.name) : 'Nenhum aparelho'}</h2>
        <p class="device-sub">${KIND_LABEL[kind]} · ${orientText} · ${size.width} × ${size.height}${d ? ` · ${d.fps} Hz` : ' (estimado)'}</p>
        ${d ? '' : `<div class="device-actions">${seg('kind', 'Tipo de aparelho na prévia', [['phone', 'Celular', 'smartphone'], ['tablet', 'Tablet', 'tablet']], s.previewKind, 'data-kind')}</div>`}
      </div>
    </section>`;
}

function prefsCard(): string {
  const s = state;
  return `
    <section class="card c7 fade-up d4" aria-labelledby="prefTitle">
      <div class="card-top"><div><h2 class="card-name" id="prefTitle">Como ${noun(s)} fica</h2>
        <p class="card-hint">A orientação vale a partir da próxima conexão.</p></div></div>
      <div class="pref-grid">
        <div>
          <p class="mini-label">Orientação</p>
          ${seg('orient', 'Orientação', (['auto', 'portrait', 'landscape'] as Orientation[]).map((o) => [o, ORIENT_LABEL[o], ORIENT_ICON[o]] as [string, string, string]), s.orientation, 'data-orient')}
          <p class="mini-label">Tamanho das coisas na Nova tela</p>
          ${seg('uiscale', 'Tamanho das coisas na Nova tela', ([100, 125, 150, 200]).map((v) => [String(v), `${v}%`] as [string, string]), String(s.uiScale ?? 125), 'data-uiscale')}
        </div>
        <label class="switch-row"><span><span class="switch-title">Som também no PC</span><span class="switch-hint">Toca no aparelho e aqui</span></span>
          <input type="checkbox" class="switch" id="optAudio" ${s.audioOnHost ? 'checked' : ''}></label>
        <label class="switch-row"><span><span class="switch-title">Maximizar janelas ${s.previewKind === 'tablet' ? 'no tablet' : 'no aparelho'}</span><span class="switch-hint">Ao levar uma janela para a Nova tela</span></span>
          <input type="checkbox" class="switch" id="optMaximize" ${s.maximizeOnDevice !== false ? 'checked' : ''}></label>
        <label class="switch-row"><span><span class="switch-title">Lembrar o arranjo</span><span class="switch-hint">Menos piscadas; grava no GNOME</span></span>
          <input type="checkbox" class="switch" id="optRemember" ${s.rememberLayout ? 'checked' : ''} ${s.mode === 'mirror' ? 'disabled' : ''}></label>
      </div>
    </section>`;
}

function placementCard(): string {
  const s = state;
  const mirror = s.mode === 'mirror';
  const p = s.placement;
  return `
    <section class="card c12 fade-up d4" aria-labelledby="placeTitle">
      <div class="place-head">
        <div><h2 class="card-name" id="placeTitle">${mirror ? `O que ${noun(s)} espelha` : `Onde ${noun(s)} fica`}</h2>
          <p class="card-hint">${mirror ? 'Escolha o monitor; ele aparece igualzinho no aparelho.'
            : s.phase === 'connected' ? 'Muda na hora, sem senha. Clique num monitor e escolha o lado.'
            : 'Clique num monitor e escolha o lado. Vale para a próxima conexão.'}</p></div>
        <div class="place-filters">
          ${seg('anchor', mirror ? 'Monitor espelhado' : 'Ao lado de qual monitor',
            s.monitors.map((m) => [m.id, `${esc(m.name)}${m.primary ? ' ★' : ''}`] as [string, string]), mirror ? s.mirrorOf : p.anchor, 'data-anchor')}
        </div>
      </div>
      <div class="stage" id="stage" role="group" aria-label="Prévia da área de trabalho"></div>
      ${mirror ? '' : `<div class="place-controls inline">
        <div><span class="mini-label">Lado</span>${seg('side', 'Lado', (['left', 'right', 'above', 'below'] as Side[]).map((sd) => [sd, SIDE_LABEL[sd][0].toUpperCase() + SIDE_LABEL[sd].slice(1), SIDE_ICON[sd]] as [string, string, string]), p.side, 'data-side')}</div>
        <div><span class="mini-label">Alinhar</span>${seg('align', 'Alinhar', (['start', 'center', 'end'] as Align[]).map((al) => [al, ALIGN_LABEL[p.side][al]] as [string, string]), p.align, 'data-align')}</div>
      </div>`}
      <p class="place-msg" id="placeMsg" aria-live="polite"></p>
    </section>`;
}

function devicesTable(compact = false): string {
  const s = state;
  const rows = s.paired.map((d) => `
    <tr>
      <td><div class="dev-cell"><span class="dev-ico" aria-hidden="true"><span class="ms">${KIND_ICON[d.kind]}</span></span>
        <div><p class="dev-name">${esc(d.name)}</p><p class="dev-kind">${KIND_LABEL[d.kind]}</p></div></div></td>
      <td>${d.width ? `${d.width} × ${d.height}` : '—'}</td>
      <td>${d.width ? (d.width > d.height ? 'Deitado' : 'Em pé') : '—'}</td>
      <td><span class="tag ${d.network === 'local' ? 'ok' : ''}"><span class="ms" aria-hidden="true">${d.network === 'local' ? 'wifi' : 'public'}</span>${d.network === 'local' ? 'Rede local' : 'Fora de casa'}</span></td>
      <td>${d.live ? '<span class="tag live"><span class="ms" aria-hidden="true">bolt</span>Agora</span>' : esc(d.lastSeen || '—')}</td>
      <td><button class="btn ghost small danger" data-forget="${esc(d.id)}" aria-label="Esquecer ${esc(d.name)}"><span class="ms" aria-hidden="true">link_off</span>${compact ? '' : 'Esquecer'}</button></td>
    </tr>`).join('');
  return `
    <section class="card c12 fade-up d4" aria-labelledby="pairedTitle">
      <div class="card-top"><div><h2 class="card-name" id="pairedTitle">Aparelhos pareados</h2>
        <p class="card-hint">Celulares e tablets que já escanearam o código deste PC.</p></div></div>
      ${s.paired.length ? `<table class="table"><thead><tr><th scope="col">Aparelho</th><th scope="col">Resolução</th><th scope="col">Orientação</th><th scope="col">Rede</th><th scope="col">Última vez</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>${rows}</tbody></table>`
        : '<p class="table-empty">Nenhum ainda. Ligue e escaneie o código com o app OpenAlt.</p>'}
    </section>`;
}

function checkRow(status: 'ok' | 'todo' | 'warn' | 'bad', icon: string, title: string, text: string, action = '') {
  return `<li class="check ${status}">
    <span class="check-icon" aria-hidden="true"><span class="ms">${icon}</span></span>
    <div><p class="check-title">${title}</p><p class="check-text">${text}</p></div>
    <div>${action}</div></li>`;
}

// ── telas ───────────────────────────────────────────────────────────────────
function renderHome(): string {
  const s = state;
  if (s.phase === 'setup') return renderSetup();
  const sub = {
    off: 'Celular ou tablet como mais uma tela — ou espelho deste PC.',
    starting: 'Ligando…',
    waiting: `Ligado · esperando ${noun(s)}`,
    connected: s.device ? `${esc(s.device.name)} conectado · ${s.mode === 'mirror' ? 'Espelhar' : 'Nova tela'}` : '',
    setup: '',
  }[s.phase];
  return topbar('Open<em>Alt</em>', sub, s.phase === 'waiting' || s.phase === 'connected')
    + `<div class="bento">${connectionCard()}${modeCard()}${showcaseCard()}${prefsCard()}${placementCard()}${devicesTable(true)}</div>`;
}

function renderSetup(): string {
  const s = state;
  const sun = s.setup.sunshine === 'ok';
  const helper = s.setup.helper === 'ok';
  const step = (n: number, done: boolean, cls: string, title: string, text: string, action: string) => `
    <section class="card ${done ? '' : cls} c4 fade-up d${n}">
      <div class="card-top"><span class="big">${done ? '✓' : n}</span>
        <span class="corner-btn" aria-hidden="true"><span class="ms">${done ? 'check' : n === 1 ? 'download' : n === 2 ? 'shield' : 'public'}</span></span></div>
      <h2 class="card-name">${title}</h2><p class="card-hint">${text}</p>
      <div class="device-actions">${action}</div>
    </section>`;
  return topbar('Vamos preparar <em>este PC</em>', 'Dois passos, uma vez só. Nada muda sem você apertar o botão.')
    + `<div class="bento">
        ${step(1, sun, 'accent', 'Sunshine', sun ? 'Instalado. O OpenAlt usa uma configuração só dele; a sua fica intacta.' : 'O programa que transmite a tela. Pelo Flathub, sem senha.',
          sun ? '' : '<button class="power-round" id="btnSunshine"><span class="ms" aria-hidden="true">download</span>Instalar</button>')}
        ${step(2, helper, sun ? 'accent' : 'sage', 'Permissão do sistema', helper ? 'Instalada. Ligar e desligar não pede mais senha.' : 'Para criar o monitor do aparelho. Pede sua senha uma vez. “Espelhar” funciona sem ela.',
          helper ? '' : '<button class="btn outline" id="btnHelper"><span class="ms" aria-hidden="true">shield</span>Instalar</button>')}
        ${step(3, false, 'plain', 'Fora de casa', 'Opcional: Tailscale no PC e no aparelho. Dá para fazer depois.', '<button class="btn ghost" data-goto="pc">Ver este PC</button>')}
      </div>
      <div class="actions fade-up d4"><button class="btn primary" id="btnSetupDone" ${sun ? '' : 'disabled'}>Continuar<span class="ms" aria-hidden="true">arrow_forward</span></button></div>`;
}

function renderDevices(): string {
  return topbar('<em>Aparelhos</em>', 'Celulares e tablets pareados com este PC.') + `<div class="bento">${devicesTable()}</div>`;
}

function renderPc(): string {
  const map: Record<Support, ['ok' | 'todo' | 'warn' | 'bad', string]> = {
    ok: ['ok', 'check'], untested: ['warn', 'help'], 'needs-setup': ['todo', 'shield'], unsupported: ['bad', 'close'],
  };
  const TITLES: Record<string, string> = {
    session: 'Sessão', desktop: 'Área de trabalho', gpu: 'Placa de vídeo', 'multi-gpu': 'Várias placas',
    'free-output': 'Saída de vídeo livre', connector: 'Identificação da saída', helper: 'Permissão do sistema',
  };
  return topbar('Este <em>PC</em>', 'O OpenAlt é para qualquer PC, mas cada um é de um jeito. Isto vale para este.')
    + `<div class="bento"><section class="card c8 fade-up d2"><ul class="checks">
        ${state.checks.map((c) => { const [cls, icon] = map[c.status]; return checkRow(cls, icon, TITLES[c.id] ?? c.id, esc(c.message)); }).join('')}
      </ul></section>
      <section class="card sage c4 fade-up d3"><div class="card-top"><h2 class="card-name">Resumo</h2></div>
        <p class="big">2/2</p><p class="big-sub">“Nova tela” e “Espelhar” funcionam aqui</p></section></div>`;
}

function renderAbout(): string {
  return topbar('Sobre o <em>OpenAlt</em>', 'Celular ou tablet como monitor extra, espelho ou tela de jogo. Código aberto (GPL-3.0).')
    + `<div class="bento">
      <section class="card accent c4 fade-up d1"><div class="card-top"><h2 class="card-name">Catta Studios</h2></div>
        <p class="big">\\</p><p class="big-sub">Feito com carinho, para qualquer pessoa.</p></section>
      <section class="card c8 fade-up d2"><ul class="checks">
        ${checkRow('ok', 'cast', 'Sunshine', 'Transmissão da tela, por LizardByte (GPL-3.0). Usado sem modificações.')}
        ${checkRow('ok', 'smartphone', 'Moonlight', 'O app do celular e do tablet é baseado no Moonlight (GPL-3.0).')}
        ${checkRow('ok', 'lan', 'Tailscale', 'Acesso fora de casa, com a sua conta.')}
      </ul></section></div>`;
}

// ── desenho e eventos ───────────────────────────────────────────────────────
async function renderStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const s = state;
  const mirror = s.mode === 'mirror';
  const size = deviceSize(s);
  const msg = $('#placeMsg');

  let layout: Record<string, Rect>;
  if (mirror) {
    layout = Object.fromEntries(s.monitors.map((m) => [m.id, m]));
    msg.className = 'place-msg';
    msg.innerHTML = `<span class="ms" aria-hidden="true">screen_share</span>${noun(s)[0].toUpperCase()}${noun(s).slice(1)} vai mostrar ${esc(monitorName(s, s.mirrorOf))}.`;
  } else {
    const plan = await api.plan(s.placement, size);
    if (plan.error !== undefined) {
      msg.className = 'place-msg error';
      msg.innerHTML = `<span class="ms" aria-hidden="true">error</span>${esc(plan.error)}. Tente outro lado ou alinhamento.`;
      stage.innerHTML = '';
      return;
    }
    layout = plan.layout;
    msg.className = 'place-msg';
    msg.innerHTML = `<span class="ms" aria-hidden="true">${s.device ? 'check_circle' : 'info'}</span>`
      + `${esc(SIDE_LABEL[s.placement.side])} de ${esc(monitorName(s, s.placement.anchor))}`
      + (s.device ? '' : ' · tamanho estimado; o certo vem do aparelho ao conectar');
  }

  const rects = Object.values(layout);
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  const pad = 22;
  const W = stage.clientWidth - pad * 2;
  const H = stage.clientHeight - pad * 2;
  const k = Math.min(W / maxX, H / maxY);
  const ox = pad + (W - maxX * k) / 2;
  const oy = pad + (H - maxY * k) / 2;
  const box = (r: Rect) => `data-box="${ox + r.x * k},${oy + r.y * k},${r.width * k},${r.height * k}"`;
  const kind = s.device?.kind ?? s.previewKind;

  const html: string[] = [];
  for (const m of s.monitors) {
    const r = layout[m.id];
    const chosen = (mirror ? s.mirrorOf : s.placement.anchor) === m.id;
    html.push(`<button class="tile" data-anchor="${esc(m.id)}" aria-pressed="${chosen}" ${box(r)}
      aria-label="${esc(m.name)}${m.primary ? ', principal' : ''}, ${m.width} por ${m.height}">
      <span>${esc(m.name)}${m.primary ? ' <span class="star" aria-hidden="true">★</span>' : ''}</span><small>${m.width}×${m.height}</small></button>`);
  }
  if (mirror) {
    const r = layout[s.mirrorOf];
    if (r) html.push(`<div class="tile mirror" aria-hidden="true" ${box({ x: r.x + r.width * 0.06, y: r.y + r.height * 0.1, width: r.width * 0.88, height: r.height * 0.8 })}><span class="ms">${KIND_ICON[kind]}</span></div>`);
  } else {
    html.push(`<div class="tile phone" role="img" aria-label="${KIND_LABEL[kind]}, ${size.width} por ${size.height}" ${box(layout.cel)}>
      <span class="ms" aria-hidden="true">${KIND_ICON[kind]}</span><small>${size.width}×${size.height}</small></div>`);
  }
  stage.innerHTML = html.join('');
  stage.querySelectorAll<HTMLElement>('[data-box]').forEach((el) => {
    const [l, t, wd, ht] = el.dataset.box!.split(',').map(Number);
    Object.assign(el.style, { left: `${l}px`, top: `${t}px`, width: `${wd}px`, height: `${ht}px` });
    // monitores pequenos na prévia: só o essencial (o nome completo fica no aria-label)
    el.classList.toggle('compact', wd < 110 || ht < 64);
    el.classList.toggle('tiny', wd < 54 || ht < 34);
  });
  stage.querySelectorAll<HTMLButtonElement>('[data-anchor]').forEach((b) => b.addEventListener('click', () => chooseAnchor(b.dataset.anchor!)));
}

function sizeIllustrations() {
  document.querySelectorAll<HTMLElement>('.device-illu[data-size]').forEach((el) => {
    const [wd, ht] = el.dataset.size!.split(',').map(Number);
    Object.assign(el.style, { width: `${wd}px`, height: `${ht}px` });
  });
}

function chooseAnchor(id: string) {
  if (state.mode === 'mirror') void api.setMirrorOf(id);
  else void api.setPlacement({ ...state.placement, anchor: id });
}

let renderedView: View | null = null;

/** Seletor estável do elemento focado, para devolver o foco depois de redesenhar. */
function focusKey(el: Element | null): string | null {
  if (!(el instanceof HTMLElement) || !$('#view').contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  for (const a of Array.from(el.attributes)) if (a.name.startsWith('data-')) return `[${a.name}="${CSS.escape(a.value)}"]`;
  return null;
}

function render() {
  const v = $('#view');
  // Mesma tela: só atualiza o conteúdo — sem animação de entrada, mantendo rolagem, foco e o
  // que a pessoa estava digitando. A animação fica para quando muda de tela.
  const same = renderedView === view;
  const key = same ? focusKey(document.activeElement) : null;
  const scroll = [v.scrollTop, document.scrollingElement?.scrollTop ?? 0];
  const typed = new Map(Array.from(v.querySelectorAll<HTMLInputElement>('input[type=text][id], input:not([type])[id]')).map((i) => [i.id, i.value]));
  v.classList.toggle('settled', same);
  v.innerHTML = view === 'pc' ? renderPc() : view === 'about' ? renderAbout() : view === 'devices' ? renderDevices() : renderHome();
  if (same) {
    v.scrollTop = scroll[0];
    if (document.scrollingElement) document.scrollingElement.scrollTop = scroll[1];
    for (const [id, val] of typed) { const i = v.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`); if (i) i.value = val; }
    if (key) v.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
  }
  renderedView = view;
  document.querySelectorAll<HTMLButtonElement>('.rail-btn[data-view]').forEach((b) => {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  bindView();
  sizeIllustrations();
  void renderStage();
  tickCountdown();
}

function bindView() {
  const on = (sel: string, fn: (b: HTMLButtonElement) => void) =>
    document.querySelectorAll<HTMLButtonElement>(sel).forEach((b) => b.addEventListener('click', () => fn(b)));
  $('#btnPower')?.addEventListener('click', () => void (state.phase === 'waiting' || state.phase === 'connected' ? api.desligar() : api.ligar()));
  $('#btnNewQr')?.addEventListener('click', () => void api.novoQr());
  $('#pinForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#pinInput') as HTMLInputElement | null;
    const msg = $('#pinMsg');
    if (!input || !msg) return;
    const nameInput = $('#pinName') as HTMLInputElement | null;
    void api.parearPin(input.value.trim(), nameInput?.value.trim() ?? '').then((r) => { msg.textContent = r.message; if (r.ok) { input.value = ''; if (nameInput) nameInput.value = ''; } }, (err) => { msg.textContent = String(err?.message ?? err); });
  });
  $('#btnFullscreen')?.addEventListener('click', () => void toggleFullscreen());
  $('#btnSunshine')?.addEventListener('click', () => void api.instalarSunshine());
  $('#btnHelper')?.addEventListener('click', () => void api.instalarPermissao());
  $('#btnSetupDone')?.addEventListener('click', () => { if (isDemo) (api as ReturnType<typeof mockApi>).demo({ phase: 'off' }); });
  on('#view [data-goto]', (b) => { view = b.dataset.goto as View; render(); });
  on('#view [data-mode]', (b) => void api.setMode(b.dataset.mode as Mode));
  on('#view .seg [data-anchor]', (b) => chooseAnchor(b.dataset.anchor!));
  on('#view [data-side]', (b) => void api.setPlacement({ ...state.placement, side: b.dataset.side as Side }));
  on('#view [data-align]', (b) => void api.setPlacement({ ...state.placement, align: b.dataset.align as Align }));
  on('#view [data-orient]', (b) => void api.setOrientation(b.dataset.orient as Orientation));
  on('#view [data-uiscale]', (b) => void api.setUiScale(Number(b.dataset.uiscale)));
  on('#view [data-kind]', (b) => void api.setPreviewKind(b.dataset.kind as Kind));
  on('#view [data-forget]', (b) => void api.esquecer(b.dataset.forget!));
  $<HTMLInputElement>('#optAudio')?.addEventListener('change', (e) => void api.setPref('audioOnHost', (e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('#optRemember')?.addEventListener('change', (e) => void api.setPref('rememberLayout', (e.target as HTMLInputElement).checked));
  $<HTMLInputElement>('#optMaximize')?.addEventListener('change', (e) => void api.setPref('maximizeOnDevice', (e.target as HTMLInputElement).checked));
  // setas do teclado movem a seleção dentro de cada grupo de opções
  document.querySelectorAll<HTMLElement>('#view [role="radiogroup"]').forEach((g) => g.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = [...g.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    next.focus();
    next.click();
  }));
}

function tickCountdown() {
  window.clearInterval(countdownTimer);
  const el = document.getElementById('countdown');
  if (!el || !state.pairing) return;
  const update = (first: boolean) => {
    const left = Math.max(0, Math.round((state.pairing!.expiresAt - Date.now()) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left === 0) {
      window.clearInterval(countdownTimer);
      // redesenha UMA vez, ao vencer agora; se já estava vencido ao desenhar, não redesenha
      // (o render chama tickCountdown de novo — antes isso virava um laço infinito e travava o app)
      if (!first) render();
    }
  };
  update(true);
  countdownTimer = window.setInterval(() => update(false), 1000);
}

function bindRail() {
  document.querySelectorAll<HTMLButtonElement>('.rail-btn[data-view]').forEach((b) =>
    b.addEventListener('click', () => { view = b.dataset.view as View; render(); $('#view').focus(); }));
}

// ── barra de demonstração (?demo) ───────────────────────────────────────────
function initDemoBar() {
  if (!isDemo || !new URLSearchParams(location.search).has('demo')) return;
  const bar = $('#demoBar');
  bar.hidden = false;
  const demo = (api as ReturnType<typeof mockApi>).demo;
  bar.innerHTML = `<span>demo</span>
    <div class="seg"><button data-p="setup">1ª vez</button><button data-p="off">Pronto</button><button data-p="waiting">QR</button></div>
    <div class="seg"><button data-dev="celular">Celular</button><button data-dev="celular-deitado">Deitado</button><button data-dev="tablet">Tablet</button></div>
    <div class="seg"><button data-m="um">1 mon.</button><button data-m="dois">2</button><button data-m="tres">3</button></div>`;
  bar.querySelectorAll<HTMLButtonElement>('[data-p]').forEach((b) => b.addEventListener('click', () => {
    view = 'home';
    const p = b.dataset.p as Phase;
    demo({ phase: p, deviceKey: null, pairing: null, setup: p === 'setup' ? { sunshine: 'missing', helper: 'missing' } : { sunshine: 'ok', helper: 'ok' } });
  }));
  bar.querySelectorAll<HTMLButtonElement>('[data-dev]').forEach((b) => b.addEventListener('click', () => {
    view = 'home';
    demo({ phase: 'connected', deviceKey: b.dataset.dev!, setup: { sunshine: 'ok', helper: 'ok' } });
  }));
  bar.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => demo({ monitorsKey: b.dataset.m })));
}

// ── início ──────────────────────────────────────────────────────────────────
async function main() {
  initTheme();
  bindRail();
  state = await api.getState();
  api.onState((s) => { state = s; render(); });
  initDemoBar();
  initWindow();
  render();
  new ResizeObserver(() => void renderStage()).observe($('#view'));
  // abertura toda vez que o app abre (?nointro pula, para capturas de tela)
  const intro = $('#intro');
  if (new URLSearchParams(location.search).has('nointro')) intro.remove();
  else await playIntro(intro, () => document.body.classList.add('ready'));
  document.body.classList.add('ready');
}

void main();

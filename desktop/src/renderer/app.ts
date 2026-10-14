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
interface Check { id: string; status: Support; message: string; key?: string; vars?: Record<string, string> }
/** Texto vindo do processo principal: chave do i18n (com valores) ou texto cru. */
type UiText = { key: string; vars?: Record<string, string | number> } | { text: string };

interface State {
  phase: Phase;
  pcName: string;
  monitors: Monitor[];
  placement: Placement;
  mode: Mode;
  mirrorOf: string;
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
  error: UiText | string | null;
}

/** "Fora de casa": o Tailscale oficial, como o processo principal o leu. */
interface Remote {
  state: 'missing' | 'stopped' | 'needs-login' | 'running' | 'unknown';
  ip: string | null;
  devices: { name: string; os: string; online: boolean; path: 'direct' | 'relay' | null }[];
  /** o "Entrar" está rodando (senha do sistema ou login no navegador) */
  signingIn?: boolean;
}

type Plan = { layout: Record<string, Rect>; error?: undefined } | { layout?: undefined; error: UiText | string };

interface OpenAltApi {
  getState(): Promise<State>;
  onState(cb: (s: State) => void): void;
  ligar(): Promise<void>;
  desligar(): Promise<void>;
  novoQr(): Promise<void>;
  parearPin(pin: string, name?: string): Promise<{ ok: boolean; message: UiText | string }>;
  setPlacement(p: Placement): Promise<void>;
  setMode(m: Mode): Promise<void>;
  setMirrorOf(id: string): Promise<void>;
  setOrientation(o: Orientation): Promise<void>;
  setPreviewKind(k: Kind): Promise<void>;
  setPref(key: 'rememberLayout' | 'maximizeOnDevice', value: boolean): Promise<void>;
  esquecer(id: string): Promise<void>;
  instalarSunshine(): Promise<void>;
  instalarPermissao(): Promise<void>;
  plan(p: Placement, size: { width: number; height: number }): Promise<Plan>;
  openLink?(name: string): Promise<void>;
  remote?(): Promise<Remote>;
  tailscaleSignIn?(): Promise<{ ok: boolean; message: UiText }>;
}

// ── utilidades ──────────────────────────────────────────────────────────────
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

/** Todo texto de fora (nome de monitor, de aparelho, de PC) passa por aqui. */
function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Texto do processo principal no idioma da interface (texto cru vem escapado). */
function uiText(m: UiText | string | null | undefined): string {
  if (!m) return '';
  if (typeof m === 'string') return esc(m);
  if ('key' in m) return t(m.key, Object.fromEntries(Object.entries(m.vars ?? {}).map(([k, v]) => [k, esc(v)])));
  return esc(m.text);
}

const cap = (x: string) => (x ? x[0].toUpperCase() + x.slice(1) : x);
const SIDE_ICON: Record<Side, string> = { right: 'east', left: 'west', above: 'north', below: 'south' };
/** Alinhar ao longo do lado: em cima/embaixo para os lados, esquerda/direita para acima/abaixo. */
function alignLabel(side: Side, a: Align): string {
  const vertical = side === 'right' || side === 'left';
  return t(a === 'center' ? 'align.middle' : vertical ? (a === 'start' ? 'align.top' : 'align.bottom') : a === 'start' ? 'align.left' : 'align.right');
}
const kindLabel = (k: Kind) => t(`kind.${k}`);
const orientWord = (size: { width: number; height: number }) => t(size.width > size.height ? 'orient.landscape.lc' : 'orient.portrait.lc');
const KIND_ICON: Record<Kind, string> = { phone: 'smartphone', tablet: 'tablet' };
/** Só "Em pé" e "Deitado" na tela; o antigo "automático" aparece como o que ele dava (tablet deitado, celular em pé). */
function effectiveOrientation(s: State): 'portrait' | 'landscape' {
  if (s.orientation === 'portrait' || s.orientation === 'landscape') return s.orientation;
  return (s.device?.kind ?? s.previewKind) === 'tablet' ? 'landscape' : 'portrait';
}

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

/** "o tablet" / "o celular" / "o aparelho" no idioma atual, para entrar nas frases. */
function noun(s: State): string {
  return t(s.device ? (s.device.kind === 'tablet' ? 'dev.tablet' : 'dev.phone') : 'dev.generic');
}

// ── simulação (protótipo de design) ─────────────────────────────────────────
function placeBesideMock(mons: Monitor[], size: { width: number; height: number }, p: Placement): Plan {
  // Mesma regra do núcleo (core/src/layout.ts), só para a demonstração.
  const a = mons.find((m) => m.id === p.anchor);
  if (!a) return { error: { key: 'layout.no-anchor', vars: { monitor: p.anchor } } };
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
        return { error: { key: 'layout.overlap', vars: { monitor: mons.find((x) => x.id === n)?.name ?? n } } };
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
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="${t('pair.qrAria')}" shape-rendering="crispEdges"><g fill="#26211b">${cells.join('')}</g>${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}

/** Só para o protótipo no navegador; no app, quem abre é o processo principal (lista fixa em main.ts). */
const DEMO_LINKS: Record<string, string> = {
  openalt: 'https://github.com/berelels/openalt', catta: 'https://berelels.github.io',
  'moonlight-android': 'https://github.com/moonlight-stream/moonlight-android',
  'moonlight-common-c': 'https://github.com/moonlight-stream/moonlight-common-c',
  sunshine: 'https://github.com/LizardByte/Sunshine', tailscale: 'https://github.com/tailscale/tailscale',
  'tailscale-pc': 'https://tailscale.com/download/linux', 'tailscale-device': 'https://tailscale.com/download',
};

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
    rememberLayout: false,
    orientation: 'auto',
    previewKind: 'phone',
    uiScale: 125,
    device: null,
    paired: [
      { id: 'a1', name: 'Moto g84', kind: 'phone', width: 1080, height: 2400, network: 'local', lastSeen: '17:57', live: false },
      { id: 'b2', name: 'Galaxy Tab S9', kind: 'tablet', width: 2560, height: 1600, network: 'tailscale', lastSeen: '12/10', live: false },
    ],
    pairing: null,
    setup: { sunshine: 'ok', helper: 'missing' },
    checks: [
      { id: 'session', status: 'ok', message: '', key: 'env.session.ok' },
      { id: 'desktop', status: 'ok', message: '', key: 'env.desktop.ok' },
      { id: 'gpu', status: 'ok', message: '', key: 'env.gpu.ok', vars: { drivers: 'amdgpu' } },
      { id: 'free-output', status: 'ok', message: '', key: 'env.free-output.ok', vars: { output: 'DisplayPort-0' } },
      { id: 'connector', status: 'ok', message: '', key: 'env.connector.ok' },
      { id: 'helper', status: 'needs-setup', message: '', key: 'env.helper.missing' },
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
    async parearPin(pin: string) { return { ok: /^\d{4}$/.test(pin), message: { key: /^\d{4}$/.test(pin) ? 'pin.ok' : 'pin.format' } }; },
    async setPlacement(p) { s.placement = p; emit(); },
    async setMode(m) { s.mode = m; emit(); },
    async setMirrorOf(id) { s.mirrorOf = id; emit(); },
    async setOrientation(o) { s.orientation = o; emit(); },
    async setPreviewKind(k) { s.previewKind = k; emit(); },
    async setPref(k, v) { s[k] = v; emit(); },
    async esquecer(id) { s.paired = s.paired.filter((d) => d.id !== id); emit(); },
    async instalarSunshine() { s.setup.sunshine = 'ok'; emit(); },
    async instalarPermissao() {
      s.setup.helper = 'ok';
      s.checks = s.checks.map((c) => (c.id === 'helper' ? { ...c, status: 'ok', key: 'env.helper.ok' } : c));
      emit();
    },
    async plan(p, size) { return placeBesideMock(s.monitors, size, p); },
    async tailscaleSignIn() {
      await new Promise((r) => setTimeout(r, 1500));
      history.replaceState(null, '', location.search.replace(/remote=[\w-]+/, 'remote=running'));
      return { ok: true, message: { key: 'remote.signin.ok' } };
    },
    async remote() {
      const k = new URLSearchParams(location.search).get('remote') ?? 'needs-login';
      const devices = [{ name: 'galaxy-tab-s9', os: 'android', online: true, path: k === 'relay' ? 'relay' as const : 'direct' as const }, { name: 'moto-g84', os: 'android', online: false, path: null }];
      return k === 'running' || k === 'relay' ? { state: 'running', ip: '100.101.102.103', devices } : { state: k as Remote['state'], ip: null, devices: [] };
    },
    async openLink(name) { const url = DEMO_LINKS[name]; if (url) window.open(url, '_blank', 'noopener'); },
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
  toTray(labels: { show: string; quit: string }): Promise<'tray' | 'minimized'>;
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
  const net = t(s.device?.network === 'tailscale' ? 'net.away' : 'net.local');
  const fsLabel = t(fullscreen ? 'top.exitFullscreen' : 'top.fullscreen');
  return `
    <header class="topbar">
      <div>
        <h1 class="page-title fade-up">${title}</h1>
        <p class="page-sub fade-up d1">${live ? '<span class="status-dot live-dot" aria-hidden="true"></span>' : ''}${sub}</p>
      </div>
      <div class="top-actions fade-up d2">
        <span class="pill-btn"><span class="ms" aria-hidden="true">computer</span><strong>${esc(s.pcName)}</strong></span>
        <span class="pill-btn"><span class="ms" aria-hidden="true">${s.device?.network === 'tailscale' ? 'public' : 'wifi'}</span>${net}</span>
        <button class="icon-btn" data-goto="pc" aria-label="${t('top.pcChecks')}"><span class="ms" aria-hidden="true">tune</span></button>
        <button class="icon-btn" id="btnTray" aria-label="${t('top.toTray')}" title="${t('top.toTray')}"><span class="ms" aria-hidden="true">minimize</span></button>
        <button class="icon-btn" id="btnFullscreen" aria-label="${fsLabel}" title="${fsLabel}"><span class="ms" aria-hidden="true">${fullscreen ? 'fullscreen_exit' : 'fullscreen'}</span></button>
      </div>
    </header>
    ${s.error ? `<p class="error-banner fade-up" role="alert"><span class="ms" aria-hidden="true">error</span>${uiText(s.error)}</p>` : ''}`;
}


function seg(name: string, label: string, items: [string, string, string?][], current: string, attr: string): string {
  return `<div class="seg" role="radiogroup" aria-label="${label}" data-group="${name}">${items.map(([v, text, icon]) =>
    `<button role="radio" ${attr}="${esc(v)}" aria-checked="${v === current}">${icon ? `<span class="ms" aria-hidden="true">${icon}</span>` : ''}${text}</button>`).join('')}</div>`;
}

function connectionCard(): string {
  const s = state;
  const d = s.device;
  const [word, sub] = {
    setup: [t('conn.setup'), t('conn.setup.sub')],
    off: [t('conn.off'), t('conn.off.sub')],
    starting: [t('conn.starting'), t('conn.starting.sub')],
    waiting: [t('conn.waiting'), t('conn.waiting.sub', { dev: noun(s) })],
    connected: [t('conn.connected'), s.mode === 'mirror' ? t('conn.mirroring', { m: esc(monitorName(s, s.mirrorOf)) }) : t('conn.extra')],
  }[s.phase];
  const stats = d
    ? [[`${d.width}×${d.height}`, t('stat.resolution')], [`${d.fps} Hz`, t('stat.rate')], [t(d.network === 'tailscale' ? 'stat.remote' : 'stat.local'), t('stat.connection')]]
    : [[String(s.monitors.length), t(s.monitors.length === 1 ? 'stat.monitor' : 'stat.monitors')], [t(s.mode === 'mirror' ? 'stat.mirror' : 'stat.new'), t('stat.mode')]];
  const on = s.phase === 'waiting' || s.phase === 'connected';
  return `
    <section class="card accent c4 fade-up d1" aria-labelledby="connTitle">
      <div class="card-top"><h2 class="card-name" id="connTitle">${t('conn.title')}</h2>
        <span class="corner-btn" aria-hidden="true"><span class="ms">${on ? 'cast_connected' : 'cast'}</span></span></div>
      <p class="big" aria-live="polite">${word}</p>
      <p class="big-sub">${sub}</p>
      <div class="stats">${stats.map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join('')}</div>
      <button class="power-round" id="btnPower" ${s.phase === 'starting' ? 'disabled' : ''}>
        <span class="ms" aria-hidden="true">power_settings_new</span>${t(on ? 'power.off' : 'power.on')}</button>
    </section>`;
}

function modeCard(): string {
  const s = state;
  const opt = (m: Mode, title: string, hint: string) =>
    `<li><button class="mode-opt" role="radio" data-mode="${m}" aria-checked="${s.mode === m}"><span class="dot" aria-hidden="true"></span><span>${title}<small>${hint}</small></span></button></li>`;
  return `
    <section class="card sage c3 fade-up d2" aria-labelledby="modeTitle">
      <div class="card-top"><h2 class="card-name" id="modeTitle">${t('mode.title')}</h2>
        <span class="corner-btn" aria-hidden="true"><span class="ms">${s.mode === 'mirror' ? 'screen_share' : 'add_to_queue'}</span></span></div>
      <ul class="mode-list" role="radiogroup" aria-labelledby="modeTitle">
        ${opt('extend', t('mode.extend'), t('mode.extend.hint'))}
        ${opt('mirror', t('mode.mirror'), t('mode.mirror.hint'))}
      </ul>
    </section>`;
}

function deviceIllu(kind: Kind, size: { width: number; height: number }, max = 190): string {
  const k = Math.min(max / size.width, max / size.height);
  return `<div class="device-illu ${kind}" data-size="${Math.round(size.width * k)},${Math.round(size.height * k)}" role="img"
    aria-label="${kindLabel(kind)}, ${orientWord(size)}"></div>`;
}

function showcaseCard(): string {
  const s = state;
  if (s.phase === 'waiting') {
    const expired = !s.pairing || s.pairing.expiresAt <= Date.now();
    return `
      <section class="card c5 r2 fade-up d3" aria-labelledby="pairTitle">
        <div class="card-top"><div><h2 class="card-name" id="pairTitle">${t('pair.title')}</h2>
          <p class="card-hint">${t('pair.hint')}</p></div></div>
        <div class="qr-wrap">
          <div class="qr-box ${expired ? 'expired' : ''}" role="img" aria-label="${t('pair.qrAria')}">${s.pairing?.qrSvg ?? ''}${expired ? `<div class="qr-expired">${t('pair.expired')}</div>` : ''}</div>
          <p class="qr-meta" aria-live="polite"><span>${t('pair.validFor', { t: '<span class="countdown" id="countdown">—</span>' })}</span>
            <button class="btn outline small" id="btnNewQr"><span class="ms" aria-hidden="true">refresh</span>${t('pair.newCode')}</button></p>
          <p class="card-hint">${t('pair.network')}</p>
          <form class="pin-form" id="pinForm" autocomplete="off">
            <label class="card-hint" for="pinInput">${t('pair.pinLabel')}</label>
            <div class="pin-row"><input id="pinInput" class="pin-input" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" aria-describedby="pinMsg">
              <input id="pinName" class="pin-name" maxlength="32" placeholder="${t('pair.namePlaceholder')}" aria-label="${t('pair.nameAria')}">
              <button class="btn outline small" type="submit">${t('pair.submit')}</button></div>
            <p class="card-hint" id="pinMsg" aria-live="polite">${s.addresses?.length ? t('pair.address', { a: s.addresses.map(esc).join(' · ') }) : ''}</p>
          </form>
        </div>
      </section>`;
  }
  const d = s.device;
  const kind = d?.kind ?? s.previewKind;
  const size = deviceSize(s);
  const orientText = orientWord(size);
  return `
    <section class="card c5 r2 fade-up d3" aria-labelledby="devTitle">
      <div class="showcase">
        <div class="card-top">
          <span class="tag ${d ? 'live' : ''}"><span class="ms" aria-hidden="true">${d ? 'bolt' : 'visibility'}</span>${t(d ? 'show.connected' : 'show.preview')}</span>
          <button class="corner-btn" data-goto="devices" aria-label="${t('show.pairedAria')}"><span class="ms" aria-hidden="true">devices</span></button>
        </div>
        <div class="device-stage">${deviceIllu(kind, size)}</div>
        <h2 class="device-title" id="devTitle">${d ? esc(d.name) : t('show.none')}</h2>
        <p class="device-sub">${kindLabel(kind)} · ${orientText} · ${size.width} × ${size.height}${d ? ` · ${d.fps} Hz` : ` ${t('show.estimated')}`}</p>
        ${d ? '' : `<div class="device-actions">${seg('kind', t('show.kindAria'), [['phone', kindLabel('phone'), 'smartphone'], ['tablet', kindLabel('tablet'), 'tablet']], s.previewKind, 'data-kind')}</div>`}
      </div>
    </section>`;
}

function prefsCard(): string {
  const s = state;
  return `
    <section class="card c7 fade-up d4" aria-labelledby="prefTitle">
      <div class="card-top"><div><h2 class="card-name" id="prefTitle">${t('prefs.title', { dev: noun(s) })}</h2>
        <p class="card-hint">${t('prefs.hint')}</p></div></div>
      <div class="pref-grid">
        <div>
          <p class="mini-label">${t('prefs.orientation')}</p>
          ${seg('orient', t('prefs.orientation'), (['portrait', 'landscape'] as Orientation[]).map((o) => [o, t(`orient.${o}`), ORIENT_ICON[o]] as [string, string, string]), effectiveOrientation(s), 'data-orient')}
        </div>
        <label class="switch-row"><span><span class="switch-title">${t('prefs.maximize', { dev: noun(s) })}</span><span class="switch-hint">${t('prefs.maximize.hint')}</span></span>
          <input type="checkbox" class="switch" id="optMaximize" ${s.maximizeOnDevice !== false ? 'checked' : ''}></label>
        <label class="switch-row"><span><span class="switch-title">${t('prefs.remember')}</span><span class="switch-hint">${t('prefs.remember.hint')}</span></span>
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
        <div><h2 class="card-name" id="placeTitle">${cap(t(mirror ? 'place.mirrorTitle' : 'place.title', { dev: noun(s) }))}</h2>
          <p class="card-hint">${t(mirror ? 'place.mirrorHint' : s.phase === 'connected' ? 'place.liveHint' : 'place.hint')}</p></div>
        <div class="place-filters">
          ${seg('anchor', t(mirror ? 'place.mirrorOf' : 'place.anchor'),
            s.monitors.map((m) => [m.id, `${esc(m.name)}${m.primary ? ' ★' : ''}`] as [string, string]), mirror ? s.mirrorOf : p.anchor, 'data-anchor')}
        </div>
      </div>
      <div class="stage" id="stage" role="group" aria-label="${t('place.stageAria')}"></div>
      ${mirror ? '' : `<div class="place-controls inline">
        <div><span class="mini-label">${t('place.side')}</span>${seg('side', t('place.side'), (['left', 'right', 'above', 'below'] as Side[]).map((sd) => [sd, t(`side.${sd}`), SIDE_ICON[sd]] as [string, string, string]), p.side, 'data-side')}</div>
        <div><span class="mini-label">${t('place.align')}</span>${seg('align', t('place.align'), (['start', 'center', 'end'] as Align[]).map((al) => [al, alignLabel(p.side, al)] as [string, string]), p.align, 'data-align')}</div>
      </div>`}
      <p class="place-msg" id="placeMsg" aria-live="polite"></p>
    </section>`;
}

function devicesTable(compact = false): string {
  const s = state;
  const rows = s.paired.map((d) => `
    <tr>
      <td><div class="dev-cell"><span class="dev-ico" aria-hidden="true"><span class="ms">${KIND_ICON[d.kind]}</span></span>
        <div><p class="dev-name">${esc(d.name)}</p><p class="dev-kind">${kindLabel(d.kind)}</p></div></div></td>
      <td>${d.width ? `${d.width} × ${d.height}` : '—'}</td>
      <td>${d.width ? t(d.width > d.height ? 'orient.landscape' : 'orient.portrait') : '—'}</td>
      <td><span class="tag ${d.network === 'local' ? 'ok' : ''}"><span class="ms" aria-hidden="true">${d.network === 'local' ? 'wifi' : 'public'}</span>${t(d.network === 'local' ? 'net.local' : 'net.away')}</span></td>
      <td>${d.live ? '<span class="tag live"><span class="ms" aria-hidden="true">bolt</span>' + t('devs.now') + '</span>' : esc(d.lastSeen || '—')}</td>
      <td><button class="btn ghost small danger" data-forget="${esc(d.id)}" aria-label="${t('devs.forgetAria', { name: esc(d.name) })}"><span class="ms" aria-hidden="true">link_off</span>${compact ? '' : t('devs.forget')}</button></td>
    </tr>`).join('');
  return `
    <section class="card c12 fade-up d4" aria-labelledby="pairedTitle">
      <div class="card-top"><div><h2 class="card-name" id="pairedTitle">${t('devs.title')}</h2>
        <p class="card-hint">${t('devs.hint')}</p></div></div>
      ${s.paired.length ? `<table class="table"><thead><tr><th scope="col">${t('devs.device')}</th><th scope="col">${t('devs.resolution')}</th><th scope="col">${t('devs.orientation')}</th><th scope="col">${t('devs.network')}</th><th scope="col">${t('devs.lastSeen')}</th><th scope="col"><span class="sr-only">${t('devs.actions')}</span></th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="table-empty">${t('devs.empty')}</p>`}
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
    off: t('home.off'),
    starting: t('home.starting'),
    waiting: t('home.waiting', { dev: noun(s) }),
    connected: s.device ? t('home.connected', { name: esc(s.device.name), mode: t(s.mode === 'mirror' ? 'mode.mirror' : 'mode.extend') }) : '',
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
  return topbar(t('setup.title'), t('setup.sub'))
    + `<div class="bento">
        ${step(1, sun, 'accent', 'Sunshine', t(sun ? 'setup.sunshine.ok' : 'setup.sunshine.todo'),
          sun ? '' : `<button class="power-round" id="btnSunshine"><span class="ms" aria-hidden="true">download</span>${t('setup.install')}</button>`)}
        ${step(2, helper, sun ? 'accent' : 'sage', t('setup.helper'), t(helper ? 'setup.helper.ok' : 'setup.helper.todo'),
          helper ? '' : `<button class="btn outline" id="btnHelper"><span class="ms" aria-hidden="true">shield</span>${t('setup.install')}</button>`)}
        ${step(3, false, 'plain', t('setup.away'), t('setup.away.text'), `<button class="btn ghost" data-goto="pc">${t('setup.seePc')}</button>`)}
      </div>
      <div class="actions fade-up d4"><button class="btn primary" id="btnSetupDone" ${sun ? '' : 'disabled'}>${t('setup.continue')}<span class="ms" aria-hidden="true">arrow_forward</span></button></div>`;
}

function renderDevices(): string {
  return topbar(t('devices.title'), t('devices.sub')) + `<div class="bento">${devicesTable()}</div>`;
}

function renderPc(): string {
  const map: Record<Support, ['ok' | 'todo' | 'warn' | 'bad', string]> = {
    ok: ['ok', 'check'], untested: ['warn', 'help'], 'needs-setup': ['todo', 'shield'], unsupported: ['bad', 'close'],
  };
  return topbar(t('pc.title'), t('pc.sub'))
    + `<div class="bento"><section class="card c8 fade-up d2"><ul class="checks">
        ${state.checks.map((c) => { const [cls, icon] = map[c.status]; return checkRow(cls, icon, t(`check.${c.id}`), c.key ? uiText({ key: c.key, vars: c.vars }) : esc(c.message)); }).join('')}
      </ul></section>
      <section class="card sage c4 fade-up d3"><div class="card-top"><h2 class="card-name">${t('pc.summary')}</h2></div>
        <p class="big">2/2</p><p class="big-sub">${t('pc.summary.text')}</p></section>
      ${remoteCard()}</div>`;
}

/** O mesmo que o botão "Entrar" faz, para quem prefere o terminal (ou se o pkexec faltar). */
function remoteCommand(r: Remote): string {
  return r.state === 'stopped' ? 'sudo systemctl enable --now tailscaled' : 'sudo tailscale up';
}

/**
 * "Fora de casa". Confere sozinho a cada poucos segundos (sem botão "conferir"): a pessoa só faz
 * o passo que falta, e o cartão avança. Pronto = cartão sálvia com o endereço e os aparelhos.
 */
function remoteCard(): string {
  const r = remote;
  const head = (pill: string) => `<div class="card-top"><div><h2 class="card-name" id="remoteTitle">${t('remote.title')}</h2></div>${pill}</div>`;
  if (!r) return `<section class="card c12 fade-up d4" aria-labelledby="remoteTitle">${head('')}<p class="card-hint">${t('remote.checking')}</p></section>`;
  const deviceLink = `<button class="btn outline small" data-link="tailscale-device"><span class="ms" aria-hidden="true">open_in_new</span>${t('remote.getDevice')}</button>`;
  if (r.state === 'running') {
    const relay = state.phase === 'connected' && r.devices.some((d) => d.online && d.path === 'relay');
    const devs = r.devices.length
      ? `<ul class="remote-devices">${r.devices.map((d) => `<li><span class="ms" aria-hidden="true">${/ios/i.test(d.os) ? 'smartphone' : 'tablet_android'}</span><span class="remote-dev-name">${esc(d.name)}</span><span class="remote-dev-state">${t(d.online ? (d.path === 'relay' ? 'remote.dev.relay' : 'remote.dev.online') : 'remote.dev.offline')}</span></li>`).join('')}</ul>`
      : `<p class="card-hint">${t('remote.noDevice')}</p><div class="device-actions">${deviceLink}</div>`;
    return `<section class="card ${relay ? '' : 'sage'} c12 fade-up d4" aria-labelledby="remoteTitle">
      ${head(`<span class="pill ${relay ? 'wait' : 'ok remote-ok'}">${t(relay ? 'remote.pill.relay' : 'remote.pill.ready')}</span>`)}
      <p class="card-hint">${t(relay ? 'remote.relay' : 'remote.ready')}</p>
      <div class="remote-grid">
        <div class="remote-box"><span class="remote-label">${t('remote.pcAddress')}</span><span class="remote-ip">${esc(r.ip ?? '—')}</span></div>
        <div class="remote-box"><span class="remote-label">${t('remote.devices')}</span>${devs}</div>
      </div></section>`;
  }
  const installed = r.state !== 'missing';
  const cmd = remoteCommand(r);
  const busy = r.signingIn || signInPending;
  const signIn = installed
    ? `<button class="btn primary small" id="btnSignIn" ${busy ? 'disabled' : ''}><span class="ms" aria-hidden="true">${busy ? 'hourglass_top' : 'login'}</span>${t(busy ? 'remote.signin.waiting' : r.state === 'stopped' ? 'remote.signin.start' : 'remote.signin')}</button>`
    : '';
  const step2 = installed
    ? `<div class="remote-cmd"><span class="card-hint">${t('remote.orTerminal')}</span><code>${esc(cmd)}</code><button class="btn outline small" id="btnCopyCmd" data-cmd="${esc(cmd)}"><span class="ms" aria-hidden="true">content_copy</span>${t('remote.copy')}</button></div>`
    : '';
  return `<section class="card c12 fade-up d4" aria-labelledby="remoteTitle">
    ${head(`<span class="pill wait">${t(installed ? (r.state === 'stopped' ? 'remote.pill.stopped' : 'remote.pill.login') : 'remote.pill.install')}</span>`)}
    <p class="card-hint">${t('remote.hint')}</p>
    <ul class="checks">
      ${checkRow(installed ? 'ok' : 'todo', installed ? 'check' : 'download', t('remote.step.install'), t(installed ? 'remote.step.install.ok' : 'remote.step.install.todo'),
        installed ? '' : `<button class="btn primary small" data-link="tailscale-pc"><span class="ms" aria-hidden="true">open_in_new</span>${t('remote.howInstall')}</button>`)}
      ${checkRow(installed ? 'todo' : 'warn', installed ? 'login' : 'more_horiz', t(r.state === 'stopped' ? 'remote.step.start' : 'remote.step.login'), t(r.state === 'stopped' ? 'remote.step.start.text' : 'remote.step.login.text'), signIn)}
      ${step2 ? `<li class="remote-cmd-row">${step2}</li>` : ''}
      ${checkRow('warn', 'more_horiz', t('remote.step.device'), t('remote.step.device.text'), deviceLink)}
    </ul>
    <p class="card-hint remote-auto" aria-live="polite">${signInMsg ? uiText(signInMsg) : t('remote.auto')}</p></section>`;
}

let signInPending = false;
let signInMsg: UiText | null = null;
async function signInTailscale() {
  if (!api.tailscaleSignIn || signInPending) return;
  signInPending = true;
  signInMsg = { key: 'remote.signin.browser' };
  render();
  const r = await api.tailscaleSignIn().catch((e) => ({ ok: false, message: { text: String(e?.message ?? e) } as UiText }));
  signInPending = false;
  signInMsg = r.ok ? null : r.message;
  await refreshRemote();
  render();
}

// O cartão "Fora de casa" confere o Tailscale sozinho enquanto a tela "Este PC" está aberta
let remote: Remote | null = null;
let remoteTimer: number | undefined;
async function refreshRemote() {
  if (!api.remote) return;
  const r = await api.remote().catch(() => null);
  if (!r || JSON.stringify(r) === JSON.stringify(remote)) return;
  remote = r;
  if (view === 'pc') render();
}
function watchRemote() {
  if (view === 'pc' && remoteTimer === undefined) {
    void refreshRemote();
    remoteTimer = window.setInterval(() => void refreshRemote(), 4000);
  } else if (view !== 'pc' && remoteTimer !== undefined) {
    window.clearInterval(remoteTimer);
    remoteTimer = undefined;
  }
}

function renderAbout(): string {
  const link = (name: string, label: string, who: string, icon = 'open_in_new') =>
    `<button class="btn outline small" data-link="${name}" aria-label="${t('about.openAria', { name: who })}"><span class="ms" aria-hidden="true">${icon}</span>${label}</button>`;
  const project = (icon: string, title: string, text: string, name: string) =>
    checkRow('ok', icon, title, text, link(name, t('about.repo'), title));
  const pref = langPref();
  return topbar(t('about.title'), t('about.sub'))
    + `<div class="bento">
      <section class="card accent c4 fade-up d1"><div class="card-top"><h2 class="card-name">Catta Studios</h2></div>
        <p class="big">\\</p><p class="big-sub">${t('about.catta')}</p>
        <div class="device-actions">${link('catta', t('about.cattaSite'), 'Catta Studios', 'language')}</div></section>
      <section class="card c8 fade-up d2"><ul class="checks">
        ${project('code', t('about.ours'), t('about.ours.text'), 'openalt')}
        ${project('smartphone', 'Moonlight Android', t('about.moonlight'), 'moonlight-android')}
        ${project('settings_ethernet', 'moonlight-common-c', t('about.common'), 'moonlight-common-c')}
        ${project('cast', 'Sunshine', t('about.sunshine'), 'sunshine')}
        ${project('lan', 'Tailscale', t('about.tailscale'), 'tailscale')}
      </ul></section>
      <section class="card c12 fade-up d3" aria-labelledby="langTitle">
        <div class="card-top"><div><h2 class="card-name" id="langTitle">${t('about.language')}</h2>
          <p class="card-hint">${t('about.language.hint')}</p></div></div>
        ${seg('lang', t('about.language'), [['system', `${t('lang.system')} · ${LANG_NAME[systemLang()]}`, 'translate'], ...LANGS.map((l) => [l, LANG_NAME[l]] as [string, string])], pref, 'data-lang')}
      </section></div>`;
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
    msg.innerHTML = `<span class="ms" aria-hidden="true">screen_share</span>${t('place.mirrorMsg', { Dev: cap(noun(s)), m: esc(monitorName(s, s.mirrorOf)) })}`;
  } else {
    const plan = await api.plan(s.placement, size);
    if (plan.error !== undefined) {
      msg.className = 'place-msg error';
      msg.innerHTML = `<span class="ms" aria-hidden="true">error</span>${t('place.tryOther', { err: uiText(plan.error) })}`;
      stage.innerHTML = '';
      return;
    }
    layout = plan.layout;
    msg.className = 'place-msg';
    msg.innerHTML = `<span class="ms" aria-hidden="true">${s.device ? 'check_circle' : 'info'}</span>`
      + t(`place.at.${s.placement.side}`, { m: esc(monitorName(s, s.placement.anchor)) })
      + (s.device ? '' : t('place.estimated'));
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
      aria-label="${t(m.primary ? 'place.tilePrimaryAria' : 'place.tileAria', { name: esc(m.name), w: m.width, h: m.height })}">
      <span>${esc(m.name)}${m.primary ? ' <span class="star" aria-hidden="true">★</span>' : ''}</span><small>${m.width}×${m.height}</small></button>`);
  }
  if (mirror) {
    const r = layout[s.mirrorOf];
    if (r) html.push(`<div class="tile mirror" aria-hidden="true" ${box({ x: r.x + r.width * 0.06, y: r.y + r.height * 0.1, width: r.width * 0.88, height: r.height * 0.8 })}><span class="ms">${KIND_ICON[kind]}</span></div>`);
  } else {
    html.push(`<div class="tile phone" role="img" aria-label="${t('place.deviceAria', { kind: kindLabel(kind), w: size.width, h: size.height })}" ${box(layout.cel)}>
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
  watchRemote();
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
    void api.parearPin(input.value.trim(), nameInput?.value.trim() ?? '').then((r) => { msg.innerHTML = uiText(r.message); if (r.ok) { input.value = ''; if (nameInput) nameInput.value = ''; } }, (err) => { msg.textContent = String(err?.message ?? err); });
  });
  on('#view [data-link]', (b) => void api.openLink?.(b.dataset.link!));
  on('#view [data-lang]', (b) => { setLangPref(b.dataset.lang as LangPref); render(); });
  $('#btnSignIn')?.addEventListener('click', () => void signInTailscale());
  $('#btnCopyCmd')?.addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    void navigator.clipboard.writeText(b.dataset.cmd ?? '').then(() => { b.lastChild!.textContent = t('remote.copied'); });
  });
  $('#btnFullscreen')?.addEventListener('click', () => void toggleFullscreen());
  $('#btnTray')?.addEventListener('click', () => void winApi?.toTray({ show: t('tray.show'), quit: t('tray.quit') }));
  $('#btnSunshine')?.addEventListener('click', () => void api.instalarSunshine());
  $('#btnHelper')?.addEventListener('click', () => void api.instalarPermissao());
  $('#btnSetupDone')?.addEventListener('click', () => { if (isDemo) (api as ReturnType<typeof mockApi>).demo({ phase: 'off' }); });
  on('#view [data-goto]', (b) => { view = b.dataset.goto as View; render(); });
  on('#view [data-mode]', (b) => void api.setMode(b.dataset.mode as Mode));
  on('#view .seg [data-anchor]', (b) => chooseAnchor(b.dataset.anchor!));
  on('#view [data-side]', (b) => void api.setPlacement({ ...state.placement, side: b.dataset.side as Side }));
  on('#view [data-align]', (b) => void api.setPlacement({ ...state.placement, align: b.dataset.align as Align }));
  on('#view [data-orient]', (b) => void api.setOrientation(b.dataset.orient as Orientation));
  on('#view [data-kind]', (b) => void api.setPreviewKind(b.dataset.kind as Kind));
  on('#view [data-forget]', (b) => void api.esquecer(b.dataset.forget!));
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
  applyStaticTexts();
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

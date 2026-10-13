// O cérebro do app: junta o núcleo (@openalt/core) e devolve à interface um estado simples.
// A interface só pede ações de alto nível; tudo aqui é validado (não confiamos no renderer).
import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import {
  assessEnvironment,
  certFingerprint,
  clearConnection,
  friendlyName,
  gatherFacts,
  getMutterState,
  httpsTransport,
  isAlign,
  isSide,
  layoutFromMutter,
  layoutSize,
  isOpenAltMonitor,
  drmConnectorFor,
  findSunshine,
  isUiScale,
  reloadMonitorSensitiveExtensions,
  installShellHelper,
  restoreExtensions,
  chooseOutput,
  windowMaximizer,
  forgetPairedDevice,
  deviceKey,
  settingsFor,
  type DeviceSettings,
  listDrmConnectors,
  parseConnectorIds,
  type SunshineKind,
  localAddresses,
  prefersH264,
  mobilePeers,
  runSignIn,
  signInCommands,
  tailscaleStatus,
  matchPending,
  moveDesktop,
  newPairing,
  openaltPaths,
  parseXrandrQuery,
  pickOutput,
  placeBeside,
  qrSvg,
  readConnection,
  readCredentials,
  readPairedDevices,
  readSettings,
  resolvePlacement,
  retractDesktop,
  fileForcedStore,
  run,
  startSunshine,
  stopLeftoverSunshine,
  sunshineApi,
  sunshineDir,
  LayoutError,
  writeSettings,
  writeSunshineSetup,
  type Assessment,
  type Connection,
  type MutterState,
  type Pairing,
  type Paths,
  type RunningSunshine,
  type Settings,
  type SunshineApi,
} from '@openalt/core';

/** Texto para a interface: uma chave do i18n (com valores) ou um texto cru (erro técnico de fora). */
export type UiText = { key: string; vars?: Record<string, string | number> } | { text: string };

type Phase = 'setup' | 'off' | 'starting' | 'waiting' | 'connected';
type Kind = 'phone' | 'tablet';
interface Rect { x: number; y: number; width: number; height: number }

export interface UiState {
  phase: Phase;
  pcName: string;
  monitors: (Rect & { id: string; name: string; primary: boolean })[];
  uiScale: number;
  maximizeOnDevice: boolean;
  sunshineKind: SunshineKind | null;
  placement: { anchor: string; side: Settings['placement']['side']; align: Settings['placement']['align']; offset: number };
  mode: Settings['mode'];
  mirrorOf: string;
  rememberLayout: boolean;
  orientation: Settings['orientation'];
  previewKind: Kind;
  device: { name: string; kind: Kind; width: number; height: number; fps: number; network: 'local' | 'tailscale' } | null;
  paired: { id: string; name: string; kind: Kind; width: number; height: number; network: 'local' | 'tailscale'; lastSeen: string; live: boolean }[];
  pairing: { qrSvg: string; expiresAt: number } | null;
  addresses: string[];
  setup: { sunshine: 'ok' | 'missing'; helper: 'ok' | 'missing' };
  checks: Assessment['checks'];
  error: UiText | null;
}

export interface RemoteState {
  state: 'missing' | 'stopped' | 'needs-login' | 'running' | 'unknown';
  ip: string | null;
  devices: { name: string; os: string; online: boolean; path: 'direct' | 'relay' | null }[];
  /** o "Entrar" está rodando (esperando a senha do sistema ou o login no navegador) */
  signingIn: boolean;
}

/** A tela do aparelho é mais "quadrada" num tablet (~1,6) do que num celular (~2,2). */
function kindOf(w: number, h: number): Kind {
  return Math.max(w, h) / Math.min(w, h) < 1.85 ? 'tablet' : 'phone';
}

export interface ControllerOptions {
  /** Como a ponte do Sunshine roda a CLI do núcleo (no dev e no pacote: o próprio Electron). */
  cli: { runner: string; args: string[] };
  /** Variáveis extras repassadas à CLI (ex.: OPENALT_HELPER no desenvolvimento). */
  cliEnv?: Record<string, string>;
}

export class Controller extends EventEmitter {
  private paths: Paths = openaltPaths();
  private settings!: Settings;
  private phase: Phase = 'off';
  private sunshine: RunningSunshine | null = null;
  private api: SunshineApi | null = null;
  private pairing: Pairing | null = null;
  private pairingSvg = '';
  private pollTimer: NodeJS.Timeout | null = null;
  private watcher: FSWatcher | null = null;
  private connection: Connection | null = null;
  private mutter: MutterState | null = null;
  private assessment: Assessment | null = null;
  private sunshineInstalled = false;
  private sunshineKind: SunshineKind | null = null;
  private error: UiText | null = null;
  private gpuDrivers: string[] = [];

  constructor(private readonly opts: ControllerOptions) {
    super();
  }

  async init(): Promise<void> {
    this.settings = await readSettings(this.paths.config);
    await mkdir(this.paths.runtime, { recursive: true, mode: 0o700 });
    // sobras de uma execução que caiu: nosso Sunshine e a "Nova tela"
    await stopLeftoverSunshine(join(sunshineDir(this.paths), 'sunshine.conf')).catch(() => {});
    await clearConnection(this.paths.runtime).catch(() => {});
    await restoreExtensions({ run, runtimeDir: this.paths.runtime }).catch(() => {});
    await this.refreshSystem();
    this.phase = this.sunshineInstalled ? 'off' : 'setup';
    this.emitState();
  }

  private async refreshSystem() {
    this.sunshineKind = await findSunshine(run);
    this.sunshineInstalled = this.sunshineKind !== null;
    this.mutter = await getMutterState(run).catch(() => null);
    const facts = await gatherFacts(run);
    this.gpuDrivers = facts.gpuDrivers;
    this.assessment = assessEnvironment(facts);
  }

  // ── estado para a interface ─────────────────────────────────────────────
  async state(): Promise<UiState> {
    // conectado: mostra o lugar e o tamanho DESTE aparelho
    const s = settingsFor(this.settings, this.connection?.name);
    const monitors = (this.mutter?.logical ?? [])
      .map((l) => {
        const id = l.connectors[0];
        const r = layoutFromMutter({ ...this.mutter!, logical: [l] })[id];
        const mon = this.mutter!.monitors.find((m) => m.connector === id);
        return { id, name: mon?.displayName ?? id, primary: l.primary, ours: !!mon && isOpenAltMonitor(mon), ...r };
      })
      .filter((m) => !m.ours) // o monitor do aparelho não entra na lista
      .map(({ ours: _ours, ...m }) => m);
    const primary = monitors.find((m) => m.primary)?.id ?? monitors[0]?.id ?? '';
    const anchor = s.placement.anchor === 'primary' || !monitors.some((m) => m.id === s.placement.anchor) ? primary : s.placement.anchor;
    const mirrorOf = s.mirrorOf === 'primary' || !monitors.some((m) => m.id === s.mirrorOf) ? primary : s.mirrorOf;

    const paired = (await readPairedDevices(this.paths)).map((d) => {
      const live = !!this.connection && this.connection.name === d.name;
      const w = live ? this.connection!.width : 0;
      const h = live ? this.connection!.height : 0;
      return { id: d.uuid, name: d.name, kind: w ? kindOf(w, h) : 'phone' as Kind, width: w, height: h, network: 'local' as const, lastSeen: '', live };
    });
    const c = this.connection;
    return {
      phase: this.phase,
      pcName: hostname(),
      monitors,
      placement: { anchor, side: s.placement.side, align: s.placement.align, offset: s.placement.offset ?? 0 },
      mode: s.mode,
      mirrorOf,
      rememberLayout: s.rememberLayout,
      orientation: s.orientation,
      previewKind: s.previewKind,
      uiScale: s.uiScale,
      maximizeOnDevice: s.maximizeOnDevice,
      sunshineKind: this.sunshineKind,
      device: c ? { name: c.name, kind: kindOf(c.width, c.height), width: c.width, height: c.height, fps: c.fps, network: 'local' } : null,
      paired,
      pairing: this.pairing && this.phase === 'waiting' ? { qrSvg: this.pairingSvg, expiresAt: this.pairing.expiresAt } : null,
      addresses: this.phase === 'waiting' || this.phase === 'connected' ? localAddresses() : [],
      setup: {
        sunshine: this.sunshineInstalled ? 'ok' : 'missing',
        helper: this.assessment?.checks.find((x) => x.id === 'helper')?.status === 'ok' ? 'ok' : 'missing',
      },
      checks: this.assessment?.checks ?? [],
      error: this.error,
    };
  }

  /** "Fora de casa": estado do Tailscale, só leitura. A tela "Este PC" pede a cada poucos segundos. */
  async remote(): Promise<RemoteState> {
    const s = await tailscaleStatus(run);
    return {
      state: s.state,
      ip: s.ip,
      devices: mobilePeers(s).slice(0, 8).map((p) => ({ name: p.name, os: p.os, online: p.online, path: p.path })),
      signingIn: this.signingIn,
    };
  }

  private signingIn = false;

  /**
   * "Entrar" no Tailscale, só quando a pessoa toca no botão: pkexec pede a senha do sistema, e o
   * endereço de login abre no navegador dela (evento 'open-url'). O OpenAlt nunca vê a senha da conta.
   */
  async tailscaleSignIn(): Promise<{ ok: boolean; message: UiText }> {
    if (this.signingIn) return { ok: false, message: { key: 'remote.signin.busy' } };
    const user = userInfo().username;
    let cmds = signInCommands((await tailscaleStatus(run)).state, user);
    if (!cmds.length) return { ok: true, message: { key: 'remote.signin.nothing' } };
    this.signingIn = true;
    try {
      while (cmds.length) {
        const r = await runSignIn(cmds[0], (url) => this.emit('open-url', url));
        if (!r.ok) {
          // 126/127 do pkexec = a pessoa cancelou a senha; o resto vira o texto do Tailscale
          return { ok: false, message: /dismissed|not authorized|126|127/i.test(r.output) ? { key: 'remote.signin.cancelled' } : { key: 'remote.signin.failed' } };
        }
        // depois de ligar o serviço, ele pode já entrar sozinho (a pessoa já tinha entrado antes)
        const state = (await tailscaleStatus(run)).state;
        cmds = state === 'running' ? [] : cmds.slice(1);
      }
      return { ok: true, message: { key: 'remote.signin.ok' } };
    } finally {
      this.signingIn = false;
    }
  }

  private emitState() {
    void this.state().then((s) => this.emit('state', s));
  }

  private fail(e: unknown) {
    this.error = this.uiText(e);
    this.emitState();
  }

  /** Erro de arranjo vira chave do i18n, com os nomes dos monitores (não os conectores). */
  private uiText(e: unknown): UiText {
    if (e instanceof LayoutError) {
      const name = (id: string) => (id === 'cel' ? '' : this.mutter?.monitors.find((m) => m.connector === id)?.displayName ?? id);
      return { key: `layout.${e.code}`, vars: Object.fromEntries(Object.entries(e.vars).map(([k, v]) => [k, name(v)])) };
    }
    if (e && typeof e === 'object' && 'key' in e && typeof (e as { key: unknown }).key === 'string') return e as UiText;
    return { text: e instanceof Error ? e.message : String(e) };
  }

  // ── Ligar / Desligar ────────────────────────────────────────────────────
  async ligar(): Promise<void> {
    if (this.phase !== 'off') return;
    this.error = null;
    this.phase = 'starting';
    this.emitState();
    try {
      const xs = parseXrandrQuery((await run('xrandr', ['--query'])).stdout);
      // o Sunshine numera as telas do X na ordem do xrandr (provado no S3)
      this.sunshineKind = (await findSunshine(run)) ?? this.sunshineKind; // instalado o .deb com o app aberto
      const output = await chooseOutput(run);
      const outputIndex = xs.outputs.findIndex((o) => o.name === output);
      // Sunshine nativo: captura KMS pelo nome do conector ("card1-DP-1" → "DP-1")
      // A KMS não mostra o cursor no aparelho com o Xorg+amdgpu (ver m1-resultados); fica atrás de OPENALT_KMS=1.
      const kmsConnector = this.sunshineKind === 'native' && process.env.OPENALT_KMS === '1'
        ? drmConnectorFor(output, parseConnectorIds((await run('xrandr', ['--prop'])).stdout), await listDrmConnectors()).replace(/^card\d+-/, '')
        : undefined;
      const setup = await writeSunshineSetup(this.paths, {
        outputIndex: Math.max(0, outputIndex),
        kmsConnector,
        outputName: output,
        // o Sunshine sempre transmite o som; onde ele toca é a opção "Tocar áudio no PC" do app do aparelho
        // placa AMD: só H.264 (o HEVC pela VAAPI deixa faixas verdes, Sunshine#4314)
        h264Only: prefersH264(this.gpuDrivers),
        name: hostname(),
        prep: {
          runner: this.opts.cli.runner,
          runnerArgs: this.opts.cli.args,
          env: {
            ELECTRON_RUN_AS_NODE: '1',
            OPENALT_CONFIG_DIR: this.paths.config,
            OPENALT_DATA_DIR: this.paths.data,
            OPENALT_RUNTIME_DIR: this.paths.runtime,
            ...(this.opts.cliEnv ?? {}),
          },
        },
      });
      // a extensão do OpenAlt reinicia o GNOME sem a caixa do Alt+F2 (GNOME no X11; carrega no 1º reinício)
      if (process.env.XDG_SESSION_TYPE === 'x11' && /gnome/i.test(process.env.XDG_CURRENT_DESKTOP ?? '')) {
        await installShellHelper({ run }).catch(() => 'unavailable');
      }
      this.sunshine = await startSunshine(setup.confPath, { kind: this.sunshineKind ?? 'flatpak' });
      const mine = this.sunshine;
      // só é "fechou sozinho" se não fomos nós que mandamos parar
      mine.onExit(() => { if (this.sunshine === mine && !this.stopping) { this.sunshine = null; void this.desligar({ key: 'err.sunshineExited' }); } });
      const pem = await readFile(join(setup.dir, 'credentials', 'cacert.pem'), 'utf8');
      this.api = sunshineApi(httpsTransport({ credentials: await readCredentials(this.paths), fingerprint: certFingerprint(pem) }));
      this.watchConnection();
      this.phase = 'waiting';
      await this.novoQr();
    } catch (e) {
      await this.desligar();
      this.fail(e);
    }
  }

  /** Sem reiniciar o GNOME (Wayland, sem xdotool, janela fechada): recarrega as extensões. */
  async reloadExtensions(): Promise<void> {
    await reloadMonitorSensitiveExtensions({ run, runtimeDir: this.paths.runtime }).catch(() => {});
  }

  private stopping = false;
  private maximizeTimer: NodeJS.Timeout | null = null;

  /** Com um aparelho em "Nova tela", maximiza as janelas que entram nele (settings.maximizeOnDevice). */
  private updateMaximizer() {
    const on = this.connection?.mode === 'extend' && this.settings.maximizeOnDevice;
    if (!on) { if (this.maximizeTimer) clearInterval(this.maximizeTimer); this.maximizeTimer = null; return; }
    if (this.maximizeTimer) return;
    const rect = () => {
      const m = this.mutter?.monitors.find((x) => isOpenAltMonitor(x));
      return m && this.mutter ? layoutFromMutter(this.mutter)[m.connector] ?? null : null;
    };
    const tick = windowMaximizer(run, rect);
    this.maximizeTimer = setInterval(() => void tick().catch(() => {}), 1000);
  }

  async desligar(reason?: UiText): Promise<void> {
    this.stopping = true;
    try { await this.desligarAgora(reason); } finally { this.stopping = false; }
  }

  private async desligarAgora(reason?: UiText): Promise<void> {
    this.stopPairing();
    if (this.maximizeTimer) clearInterval(this.maximizeTimer);
    this.maximizeTimer = null;
    this.watcher?.close();
    this.watcher = null;
    // também devolve uma saída que ficou forçada num desconectar sem senha (a pessoa está no PC agora)
    const pending = (await fileForcedStore(this.paths.runtime).read().catch(() => [] as string[])).length > 0;
    if (this.connection || pending) {
      const wasExtend = this.connection?.mode === 'extend' || pending;
      await retractDesktop().catch(() => {});
      await clearConnection(this.paths.runtime).catch(() => {});
      this.connection = null;
      if (wasExtend) this.emit('monitors-changed');
    }
    this.mutter = await getMutterState(run).catch(() => this.mutter); // a lista de monitores sem o do aparelho
    await this.sunshine?.stop().catch(() => {});
    this.sunshine = null;
    this.api = null;
    this.phase = this.sunshineInstalled ? 'off' : 'setup';
    if (reason) this.error = reason;
    this.emitState();
  }

  // ── pareamento por QR ───────────────────────────────────────────────────
  async novoQr(): Promise<void> {
    if (!this.api || (this.phase !== 'waiting' && this.phase !== 'connected')) return;
    const pem = await readFile(join(sunshineDir(this.paths), 'credentials', 'cacert.pem'), 'utf8');
    this.pairing = newPairing({ pcName: hostname(), hosts: localAddresses(), port: 47989, fingerprint: certFingerprint(pem) });
    this.pairingSvg = await qrSvg(this.pairing.uri);
    this.startPolling();
    this.emitState();
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => void this.pollOnce(), 1000);
  }
  private stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
  private stopPairing() {
    this.stopPolling();
    this.pairing = null;
  }

  private async pollOnce() {
    const p = this.pairing;
    if (!p || !this.api) return;
    if (Date.now() >= p.expiresAt) { this.stopPolling(); this.emitState(); return; }
    try {
      const pending = await this.api.pendingPairings();
      const mine = matchPending(p, pending);
      if (!mine) return;
      p.used = true; // uso único, mesmo que algo dê errado daqui para frente
      this.stopPolling();
      const ok = await this.api.submitPin(mine.id, p.pin, friendlyName(mine.name));
      if (!ok) this.error = { key: 'err.pairRejected' };
      this.emitState();
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * Pareamento pelo Moonlight oficial (enquanto o app Android do OpenAlt não existe): o
   * Moonlight mostra um PIN de 4 dígitos e a pessoa digita aqui. Só vale com o OpenAlt ligado.
   */
  async parearPin(pin: unknown, name?: unknown): Promise<{ ok: boolean; message: UiText }> {
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return { ok: false, message: { key: 'pin.format' } };
    if (!this.api) return { ok: false, message: { key: 'pin.turnOn' } };
    const pending = (await this.api.pendingPairings()).filter((x) => !/^OpenAlt-/.test(x.name));
    if (pending.length === 0) return { ok: false, message: { key: 'pin.noRequest' } };
    const req = pending[pending.length - 1];
    // o nome que a pessoa deu; senão o que o Moonlight mandou (o nome interno do aparelho)
    const given = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} ._()+\-]/gu, '').trim().slice(0, 32) : '';
    const ok = await this.api.submitPin(req.id, pin, (given || req.name || 'Aparelho').slice(0, 48));
    this.emitState();
    return { ok, message: { key: ok ? 'pin.ok' : 'pin.rejected' } };
  }

  // ── conexão do aparelho (a ponte grava connection.json) ────────────────
  private watchConnection() {
    this.watcher?.close();
    const update = async () => {
      const c = await readConnection(this.paths.runtime);
      const changed = JSON.stringify(c) !== JSON.stringify(this.connection);
      if (!changed) return;
      const wasExtend = this.connection?.mode === 'extend';
      this.connection = c;
      if (this.phase === 'waiting' || this.phase === 'connected') this.phase = c ? 'connected' : 'waiting';
      this.mutter = await getMutterState(run).catch(() => this.mutter);
      // monitor do aparelho entrou ou saiu: extensões que guardam o monitor pelo número se perdem
      // (ArcMenu abria o Super no tablet); recarregar só elas
      // O monitor do aparelho entrou ou saiu: o processo principal reinicia o GNOME (Alt+F2 → r). Só
      // recarregar as extensões resolvia o Super, mas não o papel de parede, que só volta reiniciando.
      // Desconectou sem a permissão do sistema: a saída do aparelho ficou forçada (só fora da área de
      // trabalho). Reiniciar o GNOME agora poderia religá-la; o "Desligar" a devolve e aí reinicia.
      const pending = !c && wasExtend && (await fileForcedStore(this.paths.runtime).read().catch(() => [] as string[])).length > 0;
      if ((c && c.mode !== 'mirror') || (!c && wasExtend && !pending)) this.emit('monitors-changed');
      this.updateMaximizer();
      this.emitState();
    };
    this.watcher = watch(this.paths.runtime, () => void update());
    void update();
  }

  // ── preferências ────────────────────────────────────────────────────────
  private async save(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await writeSettings(this.paths.config, this.settings);
    this.emitState();
  }

  async setPlacement(p: unknown): Promise<void> {
    const v = p as Record<string, unknown>;
    if (!v || typeof v.anchor !== 'string' || typeof v.side !== 'string' || !isSide(v.side)
      || typeof v.align !== 'string' || !isAlign(v.align) || !Number.isInteger(v.offset)) throw new Error('posição inválida');
    const name = this.mutter?.monitors.find((m) => m.connector === v.anchor)?.displayName;
    const placement = { anchor: v.anchor, anchorName: name, side: v.side, align: v.align, offset: v.offset as number };
    // vale para o aparelho conectado (e vira o padrão dos aparelhos novos)
    await this.save({ placement, ...this.forDevice({ placement }) });
    // conectado em "Nova tela": muda na hora, sem senha (S13)
    if (this.connection?.mode === 'extend') {
      await moveDesktop({ anchor: v.anchor, side: v.side, align: v.align, offset: v.offset as number }, { remember: this.settings.rememberLayout })
        .catch((e) => this.fail(e));
      this.mutter = await getMutterState(run).catch(() => this.mutter);
      this.emitState();
    }
  }

  async setMode(m: unknown) { if (m === 'extend' || m === 'mirror') await this.save({ mode: m }); }
  async setMirrorOf(id: unknown) { if (typeof id === 'string' && /^[\w.\-]{1,64}$/.test(id)) await this.save({ mirrorOf: id }); }
  async setUiScale(v: unknown) { if (isUiScale(v)) await this.save({ uiScale: v, ...this.forDevice({ uiScale: v }) }); }

  /** Grava também nas preferências do aparelho conectado agora. */
  private forDevice(patch: Partial<DeviceSettings>): Partial<Settings> {
    const name = this.connection?.name;
    if (!name) return {};
    const key = deviceKey(name);
    const cur = settingsFor(this.settings, name);
    return { perDevice: { ...this.settings.perDevice, [key]: { placement: cur.placement, uiScale: cur.uiScale, ...patch } } };
  }
  async setOrientation(o: unknown) { if (o === 'auto' || o === 'portrait' || o === 'landscape') await this.save({ orientation: o }); }
  async setPreviewKind(k: unknown) { if (k === 'phone' || k === 'tablet') await this.save({ previewKind: k }); }
  async setPref(key: unknown, value: unknown) {
    if ((key === 'rememberLayout' || key === 'maximizeOnDevice') && typeof value === 'boolean') {
      await this.save({ [key]: value });
      this.updateMaximizer();
    }
  }

  async esquecer(id: unknown): Promise<void> {
    if (typeof id !== 'string' || !/^[\w-]{1,64}$/.test(id)) return;
    try {
      // ligado: pelo Sunshine; desligado: direto no arquivo de estado (é nosso, e o Sunshine não está rodando)
      if (this.api) await this.api.unpair(id);
      else if (!(await forgetPairedDevice(this.paths, id))) throw new Error('not found');
      this.error = null;
    } catch (e) {
      this.fail({ key: 'err.forget', vars: { detail: e instanceof Error ? e.message : String(e) } });
      return;
    }
    this.emitState();
  }

  async instalarSunshine(): Promise<void> {
    this.error = null;
    try {
      await run('flatpak', ['install', '--user', '-y', '--noninteractive', 'flathub', 'dev.lizardbyte.app.Sunshine'], { timeoutMs: 600_000 });
      await this.refreshSystem();
      if (this.phase === 'setup' && this.sunshineInstalled) this.phase = 'off';
      this.emitState();
    } catch (e) {
      this.fail(e);
    }
  }

  async instalarPermissao(): Promise<void> {
    this.fail({ key: 'err.helperLater' });
  }

  /** Prévia de posição: mesma conta do núcleo (layout.ts), com o arranjo atual do GNOME. */
  async plan(p: unknown, size: unknown): Promise<{ layout?: Record<string, Rect>; error?: UiText }> {
    const v = p as Record<string, unknown>;
    const z = size as Record<string, unknown>;
    if (!this.mutter) return { error: { key: 'layout.noMonitors' } };
    if (!v || typeof v.side !== 'string' || !isSide(v.side) || typeof v.align !== 'string' || !isAlign(v.align)
      || !z || !Number.isInteger(z.width) || !Number.isInteger(z.height)) return { error: { key: 'layout.badRequest' } };
    try {
      const base = layoutFromMutter(this.mutter);
      for (const k of Object.keys(base)) { const mon = this.mutter.monitors.find((m) => m.connector === k); if (mon && isOpenAltMonitor(mon)) delete base[k]; }
      const placement = resolvePlacement(this.mutter, { anchor: typeof v.anchor === 'string' ? v.anchor : undefined, side: v.side, align: v.align, offset: Number.isInteger(v.offset) ? (v.offset as number) : 0 });
      return { layout: placeBeside(base, 'cel', layoutSize(this.mutter, z.width as number, z.height as number), placement) };
    } catch (e) {
      return { error: this.uiText(e) };
    }
  }

  async shutdown(): Promise<void> {
    await this.desligar();
  }
}

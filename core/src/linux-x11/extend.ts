// "Nova tela" no GNOME X11: o celular vira um monitor de verdade para o GNOME.
//
// 1. guarda o layout atual (antes de qualquer mudança) e valida a posição pedida;
// 2. força uma saída livre como "conectada" (ajudante root, via polkit);
// 3. dá a ela a resolução do aparelho (modo OA_ pelo xrandr);
// 4. aplica pelo GNOME o layout final, com os monitores do usuário onde estavam
//    (o GNOME reorganiza tudo sozinho no hotplug; isso desfaz o rearranjo).
// Para desfazer: devolve a saída ao automático e apaga os modos OA_.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildEdid, serialForDevice, timingFromModeline } from '../edid.ts';
import { placeBeside, type Layout, type Placement } from '../layout.ts';
import { CommandError, run as defaultRun, type Runner } from '../proc.ts';
import { drmConnectorFor, isValidConnectorName, listDrmConnectors, parseConnectorIds, type DrmConnector } from './drm.ts';
import {
  applyMonitorsConfig,
  buildApplyArgs,
  buildRestoreArgs,
  findMode,
  getMutterState,
  isOpenAltMonitor,
  layoutFromMutter,
  layoutSize,
  matchesLayout,
  type MutterState,
} from './mutter.ts';
import {
  addModeToOutput,
  normalizeRequest,
  pickOutput,
  removeVirtualDisplays,
  MODE_PREFIX,
  type DisplayRequest,
} from './virtual-display.ts';
import { parseCvt, parseXrandrQuery } from './xrandr.ts';

export type ConnectorAction = 'on' | 'detect';
/**
 * Executa o ajudante com privilégio para um conector do kernel (ex.: "card1-DP-1").
 * Com `edid`, o ajudante o usa como "ficha" do monitor (só com 'on').
 */
export type ConnectorHelper = (connector: string, action: ConnectorAction, edid?: Uint8Array) => Promise<void>;

export const DEFAULT_HELPER = '/usr/libexec/openalt/openalt-helper';
/** Código de saída do ajudante quando este PC não permite EDID (sem debugfs). */
export const HELPER_NO_EDID = 5;

export function pkexecHelper(run: Runner, helperPath: string = process.env.OPENALT_HELPER ?? DEFAULT_HELPER): ConnectorHelper {
  return async (connector, action, edid) => {
    if (!isValidConnectorName(connector)) throw new Error(`Conector inválido: ${connector}`);
    const args = [helperPath, 'connector', connector, action, ...(edid ? ['--edid-stdin'] : [])];
    // o pkexec espera a pessoa digitar a senha (até a política polkit estar instalada)
    await run('pkexec', args, { timeoutMs: 120_000, input: edid });
  };
}

/** A ação do polkit que libera o ajudante sem senha (core/helper/dev.cattastudios.openalt.policy). */
export const HELPER_ACTION = 'dev.cattastudios.openalt.connector';

/**
 * O ajudante roda SEM pedir senha? Só o instalado (a política aponta para DEFAULT_HELPER), e só se o
 * polkit autorizar sem interação (`pkcheck` sem --allow-user-interaction nunca mostra a caixa).
 */
export async function helperAuthorized(
  run: Runner,
  helperPath: string = process.env.OPENALT_HELPER ?? DEFAULT_HELPER,
  pid: number = process.pid,
): Promise<boolean> {
  if (helperPath !== DEFAULT_HELPER) return false;
  return run('pkcheck', ['--action-id', HELPER_ACTION, '--process', String(pid)]).then(() => true, () => false);
}

/**
 * Lembra quais conectores foram forçados, para desfazer mesmo depois de uma queda.
 * Fica no diretório de execução da sessão (apagado ao sair da sessão).
 */
export interface ForcedStore {
  read(): Promise<string[]>;
  write(connectors: string[]): Promise<void>;
}

export function fileForcedStore(dir: string = defaultRuntimeDir()): ForcedStore {
  const file = join(dir, 'forced-connectors.json');
  return {
    async read() {
      try {
        const list: unknown = JSON.parse(await readFile(file, 'utf8'));
        return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && isValidConnectorName(c)) : [];
      } catch {
        return [];
      }
    },
    async write(connectors) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(file, JSON.stringify(connectors), { mode: 0o600 });
    },
  };
}

/**
 * A "Nova tela" ligada agora: guarda o estado do GNOME de ANTES de ligar, para mudar o
 * celular de lugar sempre a partir do arranjo original da pessoa (sem senha: só o GNOME).
 */
export interface ExtendSession {
  output: string;
  connector: string;
  before: MutterState;
}

export interface SessionStore {
  read(): Promise<ExtendSession | null>;
  write(session: ExtendSession | null): Promise<void>;
}

export function fileSessionStore(dir: string = defaultRuntimeDir()): SessionStore {
  const file = join(dir, 'session.json');
  return {
    async read() {
      try {
        const s = JSON.parse(await readFile(file, 'utf8')) as ExtendSession | null;
        return s && typeof s.output === 'string' && isValidConnectorName(s.connector) && s.before ? s : null;
      } catch {
        return null;
      }
    },
    async write(session) {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(file, JSON.stringify(session), { mode: 0o600 });
    },
  };
}

function defaultRuntimeDir(): string {
  if (process.env.OPENALT_RUNTIME_DIR) return process.env.OPENALT_RUNTIME_DIR;
  if (!process.env.XDG_RUNTIME_DIR) throw new Error('XDG_RUNTIME_DIR não definido');
  return join(process.env.XDG_RUNTIME_DIR, 'openalt');
}

export interface ExtendOptions {
  run?: Runner;
  helper?: ConnectorHelper;
  store?: ForcedStore;
  session?: SessionStore;
  /** Onde o celular fica. Padrão: à direita do monitor principal, alinhado no topo. */
  placement?: Partial<Placement> & { anchorName?: string };
  /** Força uma saída livre específica (ex.: "DisplayPort-0"). */
  output?: string;
  /** Nome do aparelho: vira a série do EDID, para o GNOME lembrar o arranjo de cada aparelho. */
  deviceName?: string;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  drmConnectors?: () => Promise<DrmConnector[]>;
  /**
   * Salva o arranjo "com o celular" no GNOME (monitors.xml). Das próximas vezes o próprio
   * GNOME o aplica ao ver o celular, e a tela pisca uma vez só. Grava na configuração do
   * usuário: só com o consentimento dele.
   */
  remember?: boolean;
}

export interface ExtendResult extends DisplayRequest {
  output: string;
  connector: string;
  /** Modo OA_ criado pelo xrandr; null quando a resolução veio do EDID. */
  mode: string | null;
  /** O monitor ganhou o EDID do OpenAlt (sem travadas de ~4 s nas sondagens). */
  edid: boolean;
  layout: Layout;
  /** false quando o GNOME já tinha aplicado o arranjo certo sozinho. */
  applied: boolean;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor<T>(
  check: () => Promise<T | undefined>,
  what: string,
  timeoutMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  const step = 200;
  for (let waited = 0; ; waited += step) {
    const value = await check();
    if (value !== undefined) return value;
    if (waited >= timeoutMs) throw new Error(`Tempo esgotado esperando ${what}`);
    await sleep(step);
  }
}

export function resolvePlacement(state: MutterState, partial: Partial<Placement> & { anchorName?: string } = {}): Placement {
  const primary = (state.logical.find((l) => l.primary) ?? state.logical[0])?.connectors[0];
  const present = (c?: string) => !!c && state.logical.some((l) => l.connectors[0] === c);
  // o monitor pode ter mudado de porta: procura pelo nome; senão, o principal
  const byName = partial.anchorName
    ? state.monitors.find((m) => m.displayName === partial.anchorName && present(m.connector))?.connector
    : undefined;
  const anchor = present(partial.anchor) ? partial.anchor : partial.anchor && !partial.anchorName ? partial.anchor : (byName ?? primary);
  if (!anchor) throw new Error('Nenhum monitor ligado para servir de referência');
  return { anchor, side: partial.side ?? 'right', align: partial.align ?? 'start', offset: partial.offset };
}

/** Só calcula (não muda nada): onde cada monitor ficaria. Serve para a prévia na interface. */
export async function planExtend(
  request: DisplayRequest,
  { run = defaultRun, placement, output }: Pick<ExtendOptions, 'run' | 'placement' | 'output'> = {},
): Promise<{ output: string; layout: Layout }> {
  const req = normalizeRequest(request);
  const state = await getMutterState(run);
  const target = output ?? pickOutput(parseXrandrQuery((await run('xrandr', ['--query'])).stdout));
  const size = layoutSize(state, req.width, req.height);
  return { output: target, layout: placeBeside(layoutFromMutter(state), target, size, resolvePlacement(state, placement)) };
}

export async function extendDesktop(request: DisplayRequest, opts: ExtendOptions = {}): Promise<ExtendResult> {
  const {
    run = defaultRun,
    helper = pkexecHelper(run),
    store = fileForcedStore(),
    session = fileSessionStore(),
    timeoutMs = 15_000,
    sleep = realSleep,
    drmConnectors = listDrmConnectors,
  } = opts;
  const req = normalizeRequest(request);
  await retractDesktop({ run, helper, store, session, timeoutMs, sleep });

  // 1. tudo o que pode falhar sem mexer no sistema vem antes
  const before = await getMutterState(run);
  const output = pickOutput(parseXrandrQuery((await run('xrandr', ['--query'])).stdout), opts.output);
  const connector = drmConnectorFor(
    output,
    parseConnectorIds((await run('xrandr', ['--prop'])).stdout),
    await drmConnectors(),
  );
  const size = layoutSize(before, req.width, req.height);
  const layout = placeBeside(layoutFromMutter(before), output, size, resolvePlacement(before, opts.placement));

  // 2. a partir daqui, qualquer falha desfaz tudo
  await store.write([connector]);
  try {
    // Com o EDID do OpenAlt, o kernel não tenta ler um monitor que não existe (sem ele, cada
    // sondagem trava a tela ~4 s — S11) e o GNOME já vê a resolução do celular como a
    // preferida. Se este PC não permitir EDID, volta ao modo criado pelo xrandr.
    const { params } = parseCvt((await run('cvt', [String(req.width), String(req.height), String(req.fps)])).stdout);
    let mode: string | null = null;
    try {
      const serial = opts.deviceName ? serialForDevice(opts.deviceName) : 1;
      await helper(connector, 'on', buildEdid(timingFromModeline(params), { serial }));
    } catch (e) {
      if (!(e instanceof CommandError && e.exitCode === HELPER_NO_EDID)) throw e;
      // Criar o modo ANTES de ligar a saída encurta o tempo entre as reconfigurações do GNOME.
      mode = await addModeToOutput(run, output, req);
      await helper(connector, 'on');
    }

    // Forçar o conector não avisa o X sozinho: `xrandr --query` (RRGetScreenResources) faz o
    // X sondar as saídas, e aí o GNOME fica sabendo (S9/S10). Sondar trava o X enquanto dura,
    // então no máximo uma vez a cada 2 s.
    let tick = 0;
    await waitFor(
      async () => {
        if (tick++ % 10 === 0) await run('xrandr', ['--query']);
        return (await getMutterState(run)).monitors.some((m) => m.connector === output) ? true : undefined;
      },
      `o GNOME reconhecer ${output}`,
      timeoutMs,
      sleep,
    );
    let readded = false;
    const modeId = await waitFor(
      async () => {
        const found = findMode(await getMutterState(run), output, req.width, req.height, req.fps)?.id;
        if (found || readded || !mode) return found;
        // Sem EDID: se o X descartou o modo ao sondar a saída, associa de novo (uma vez).
        readded = true;
        await run('xrandr', ['--addmode', output, mode]).catch(() => {});
        return undefined;
      },
      `o GNOME aceitar o modo ${req.width}x${req.height} em ${output}`,
      timeoutMs,
      sleep,
    );
    const now = await getMutterState(run);
    const applied = !matchesLayout(now, layout, output, modeId);
    if (applied) {
      const method = opts.remember ? 'persistent' : 'temporary';
      await applyMonitorsConfig(run, buildApplyArgs(now, before, layout, { connector: output, modeId }, method));
    }
    await session.write({ output, connector, before });
    return { ...req, output, connector, mode, edid: mode === null, layout, applied };
  } catch (e) {
    await retractDesktop({ run, helper, store, session, timeoutMs, sleep }).catch(() => {});
    throw e;
  }
}

/**
 * Desfaz "Nova tela" e "Espelhar": devolve os conectores forçados ao automático (o GNOME
 * restaura o layout anterior sozinho) e apaga os modos OA_.
 */
export async function retractDesktop(
  opts: Pick<ExtendOptions, 'run' | 'helper' | 'store' | 'session' | 'timeoutMs' | 'sleep'> = {},
): Promise<{ released: string[]; removed: string[] }> {
  const {
    run = defaultRun,
    helper = pkexecHelper(run),
    store = fileForcedStore(),
    session = fileSessionStore(),
    timeoutMs = 8000,
    sleep = realSleep,
  } = opts;
  const forced = await store.read();
  const errors: Error[] = [];
  for (const c of forced) {
    try {
      await helper(c, 'detect');
    } catch (e) {
      errors.push(e as Error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Falha ao devolver a saída de vídeo ao automático');
  await store.write([]);
  await session.write(null);

  if (forced.length) {
    // espera o GNOME largar o monitor do OpenAlt (com EDID não há modo OA_ para esperar)
    await waitFor(
      async () => ((await getMutterState(run)).monitors.some((m) => isOpenAltMonitor(m)) ? undefined : true),
      'o GNOME largar o monitor do aparelho',
      timeoutMs,
      sleep,
    );
    // espera a saída voltar a "disconnected" antes de apagar o modo que ela usava
    await waitFor(
      async () => {
        const { outputs } = parseXrandrQuery((await run('xrandr', ['--query'])).stdout);
        const busy = outputs.some((o) => o.connected && o.modes.some((m) => m.name.startsWith(MODE_PREFIX)));
        return busy ? undefined : true;
      },
      'a saída de vídeo voltar ao normal',
      timeoutMs,
      sleep,
    );
  }
  return { released: forced, removed: await removeVirtualDisplays(run) };
}

/**
 * Desfaz a "Nova tela" SEM pedir senha (o aparelho desconectou e a pessoa pode estar longe do PC):
 * devolve os monitores ao arranjo de antes pelo GNOME, sem root. A saída forçada continua anotada e
 * é devolvida ao automático pelo retractDesktop no "Desligar" do app (com a pessoa no PC).
 */
export async function releaseWithoutPassword(
  opts: Pick<ExtendOptions, 'run' | 'session'> = {},
): Promise<{ restored: boolean }> {
  const { run = defaultRun, session = fileSessionStore() } = opts;
  const current = await session.read();
  if (!current) return { restored: false };
  const now = await getMutterState(run);
  await applyMonitorsConfig(run, buildRestoreArgs(now, current.before));
  await session.write(null);
  return { restored: true };
}

/**
 * Ao desconectar (ponte do Sunshine): desfaz tudo se o ajudante roda sem senha; senão, só tira a
 * tela do aparelho da área de trabalho (releaseWithoutPassword). Nunca mostra a caixa de senha.
 */
export async function retractOnDisconnect(
  opts: Pick<ExtendOptions, 'run' | 'helper' | 'store' | 'session' | 'timeoutMs' | 'sleep'> & { authorized?: boolean } = {},
): Promise<{ released: string[]; removed: string[]; pending: boolean }> {
  const { run = defaultRun, store = fileForcedStore() } = opts;
  const forced = await store.read();
  const authorized = opts.authorized ?? await helperAuthorized(run);
  if (!forced.length || authorized) return { ...(await retractDesktop(opts)), pending: false };
  await releaseWithoutPassword(opts);
  return { released: [], removed: [], pending: true };
}

export interface MoveResult {
  output: string;
  layout: Layout;
  /** false quando o celular já estava nessa posição. */
  applied: boolean;
}

/**
 * Muda o celular de lugar com a "Nova tela" já ligada. Não precisa de root: só pede ao GNOME.
 * A posição é calculada a partir do arranjo original (de antes de ligar), então trocar de
 * "entre os monitores" para "abaixo do secundário" devolve o principal ao lugar dele.
 */
export async function moveDesktop(
  placement: Partial<Placement> & { anchorName?: string },
  opts: Pick<ExtendOptions, 'run' | 'session' | 'remember'> = {},
): Promise<MoveResult> {
  const { run = defaultRun, session = fileSessionStore() } = opts;
  const current = await session.read();
  if (!current) throw new Error('A "Nova tela" não está ligada');
  const { output, before } = current;

  const now = await getMutterState(run);
  const phone = now.monitors.find((m) => m.connector === output)?.modes.find((m) => m.isCurrent);
  if (!phone) throw new Error(`O GNOME não está mostrando ${output}; ligue a "Nova tela" de novo`);

  const size = layoutSize(before, phone.width, phone.height);
  const layout = placeBeside(layoutFromMutter(before), output, size, resolvePlacement(before, placement));
  const applied = !matchesLayout(now, layout, output, phone.id);
  if (applied) {
    const method = opts.remember ? 'persistent' : 'temporary';
    await applyMonitorsConfig(run, buildApplyArgs(now, before, layout, { connector: output, modeId: phone.id }, method));
  }
  return { output, layout, applied };
}

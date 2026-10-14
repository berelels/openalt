// Monitor virtual no X11: transforma uma saída "disconnected" (ex.: DisplayPort-0)
// em monitor com a resolução do aparelho, sem plug e sem reiniciar.
import { run as defaultRun, type Runner } from '../proc.ts';
import { parseCvt, parseXrandrQuery, rightEdge, type XState } from './xrandr.ts';

/** Todo modo criado pelo OpenAlt começa com isto; a remoção só toca nesses. */
export const MODE_PREFIX = 'OA_';

export interface DisplayRequest {
  width: number;
  height: number;
  fps: number;
}

export interface VirtualDisplay extends DisplayRequest {
  output: string;
  mode: string;
  x: number;
  y: number;
}

export const DEFAULT_REQUEST: DisplayRequest = { width: 1280, height: 720, fps: 60 };

const LIMITS = { width: [320, 7680], height: [200, 4320], fps: [24, 240] } as const;

function inRange(n: number, [min, max]: readonly [number, number]): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

/**
 * Valida o pedido. A largura desce para múltiplo de 8 (o cvt faz isso de qualquer jeito,
 * e assim o nome do modo bate com a resolução real).
 */
export function normalizeRequest(req: DisplayRequest): DisplayRequest {
  if (!inRange(req.width, LIMITS.width) || !inRange(req.height, LIMITS.height)) {
    throw new RangeError(`Resolução fora do suportado: ${req.width}x${req.height}`);
  }
  if (!inRange(req.fps, LIMITS.fps)) throw new RangeError(`Taxa fora do suportado: ${req.fps}`);
  return { width: req.width - (req.width % 8), height: req.height, fps: req.fps };
}

function toInt(v: string | undefined): number {
  return v !== undefined && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
}

/**
 * Lê SUNSHINE_CLIENT_WIDTH/HEIGHT/FPS. Se faltarem ou forem inválidas, usa 1280x720@60
 * (resolução) e 60 (taxa) — o monitor sempre sobe.
 */
export function requestFromEnv(env: NodeJS.ProcessEnv): DisplayRequest {
  const width = toInt(env.SUNSHINE_CLIENT_WIDTH);
  const height = toInt(env.SUNSHINE_CLIENT_HEIGHT);
  const fps = toInt(env.SUNSHINE_CLIENT_FPS);
  const size =
    inRange(width, LIMITS.width) && inRange(height, LIMITS.height)
      ? { width, height }
      : { width: DEFAULT_REQUEST.width, height: DEFAULT_REQUEST.height };
  return normalizeRequest({ ...size, fps: inRange(fps, LIMITS.fps) ? fps : DEFAULT_REQUEST.fps });
}

export function modeName(req: DisplayRequest): string {
  return `${MODE_PREFIX}${req.width}x${req.height}_${req.fps}`;
}

/** Saída livre: desconectada e desligada. Se `preferred` vier, tem de ser uma dessas. */
/**
 * `avoid`: saídas livres que outros programas tratam como "o monitor de alguém" — ex.: a dock do
 * Ubuntu/Zorin (dash-to-dock) guarda o nome do conector do monitor preferido; se o monitor virtual
 * usar esse nome, a dock (e o menu do Super junto) pula para o aparelho. Evita se houver outra livre.
 */
export function pickOutput(state: XState, preferred?: string, avoid: readonly string[] = []): string {
  const all = state.outputs.filter((o) => !o.connected && o.geometry === null);
  const free = all.some((o) => !avoid.includes(o.name)) ? all.filter((o) => !avoid.includes(o.name)) : all;
  if (preferred) {
    if (!free.some((o) => o.name === preferred)) {
      throw new Error(`A saída ${preferred} não existe ou não está livre`);
    }
    return preferred;
  }
  const first = free[0];
  if (!first) throw new Error('Nenhuma saída de vídeo livre para criar o monitor virtual');
  return first.name;
}

const DOCK_SCHEMA = 'org.gnome.shell.extensions.dash-to-dock';

/** Conectores que a dock (dash-to-dock / Ubuntu Dock) usa como monitor preferido. */
export async function dockPreferredConnectors(run: Runner = defaultRun, home = process.env.HOME ?? ''): Promise<string[]> {
  const dirs = [undefined, `${home}/.local/share/gnome-shell/extensions/dash-to-dock@micxgx.gmail.com/schemas`];
  const out = new Set<string>();
  for (const dir of dirs) {
    const args = [...(dir ? ['--schemadir', dir] : []), 'get', DOCK_SCHEMA, 'preferred-monitor-by-connector'];
    const v = (await run('gsettings', args).catch(() => ({ stdout: '' }))).stdout.trim().replace(/^'|'$/g, '');
    if (/^[\w.\-]{1,40}$/.test(v)) out.add(v);
  }
  return [...out];
}

/** A saída livre para o monitor virtual — a mesma escolha no app (Ligar) e na ponte (ao conectar). */
export async function chooseOutput(run: Runner = defaultRun): Promise<string> {
  return pickOutput(parseXrandrQuery((await run('xrandr', ['--query'])).stdout), undefined, await dockPreferredConnectors(run));
}

export function listVirtualDisplays(state: XState): { output: string; mode: string }[] {
  const found: { output: string; mode: string }[] = [];
  for (const o of state.outputs) {
    const mode = o.modes.find((m) => m.current && m.name.startsWith(MODE_PREFIX));
    if (o.geometry && mode) found.push({ output: o.name, mode: mode.name });
  }
  return found;
}

async function query(run: Runner): Promise<XState> {
  return parseXrandrQuery((await run('xrandr', ['--query'])).stdout);
}

/**
 * Desliga e apaga tudo o que o OpenAlt criou (modos com prefixo OA_), inclusive sobras
 * de uma sessão que caiu. Continua mesmo se um passo falhar e informa no fim.
 */
export async function removeVirtualDisplays(run: Runner = defaultRun): Promise<string[]> {
  const state = await query(run);
  const errors: Error[] = [];
  const attempt = async (args: string[]) => {
    try {
      await run('xrandr', args);
    } catch (e) {
      errors.push(e as Error);
    }
  };

  for (const { output } of listVirtualDisplays(state)) await attempt(['--output', output, '--off']);

  const names = new Set(state.detachedModes.filter((n) => n.startsWith(MODE_PREFIX)));
  for (const o of state.outputs) {
    for (const m of o.modes) {
      if (!m.name.startsWith(MODE_PREFIX)) continue;
      names.add(m.name);
      await attempt(['--delmode', o.name, m.name]);
    }
  }
  for (const name of names) await attempt(['--rmmode', name]);

  if (errors.length) throw new AggregateError(errors, 'Falha ao remover o monitor virtual');
  return [...names];
}

export interface CreateOptions {
  run?: Runner;
  /** Força uma saída específica (ex.: "DisplayPort-0"). */
  output?: string;
  /** Posição na área de trabalho; sem ela, à direita dos monitores ligados. */
  position?: { x: number; y: number };
}

export interface MirrorOptions extends Omit<CreateOptions, 'position'> {
  /** Monitor a espelhar (ex.: "HDMI-A-0"); sem ele, o principal. */
  of?: string;
}

/**
 * "Espelhar": monitor virtual com o tamanho e a posição de um monitor (o principal, se nada
 * for pedido). O Sunshine captura a mesma saída do modo "Nova tela", mas ela mostra esse monitor.
 */
export async function createMirrorDisplay(
  fps: number,
  { run = defaultRun, output, of }: MirrorOptions = {},
): Promise<VirtualDisplay> {
  const { outputs } = await query(run);
  // monitores físicos ligados (o virtual é sempre uma saída "disconnected")
  const lit = outputs.filter((o) => o.connected && o.geometry);
  const target = of ? lit.find((o) => o.name === of) : (lit.find((o) => o.primary) ?? lit[0]);
  if (!target?.geometry) throw new Error(of ? `Monitor ${of} não encontrado ou desligado` : 'Nenhum monitor ligado para espelhar');
  const { width, height, x, y } = target.geometry;
  return createVirtualDisplay({ width, height, fps }, { run, output, position: { x, y } });
}

/** Cria o modo OA_ (via cvt) e o associa à saída. Devolve o nome do modo. */
export async function addModeToOutput(run: Runner, output: string, req: DisplayRequest): Promise<string> {
  const { params } = parseCvt(
    (await run('cvt', [String(req.width), String(req.height), String(req.fps)])).stdout,
  );
  const mode = modeName(req);
  await run('xrandr', ['--newmode', mode, ...params]);
  await run('xrandr', ['--addmode', output, mode]);
  return mode;
}

/** Cria o monitor virtual (por padrão à direita dos monitores ligados). Idempotente: limpa antes. */
export async function createVirtualDisplay(
  request: DisplayRequest,
  { run = defaultRun, output, position }: CreateOptions = {},
): Promise<VirtualDisplay> {
  if (position && ![position.x, position.y].every((n) => Number.isInteger(n) && n >= 0 && n <= 32767)) {
    throw new RangeError(`Posição inválida: ${position.x},${position.y}`);
  }
  const req = normalizeRequest(request);
  await removeVirtualDisplays(run);

  const state = await query(run);
  const target = pickOutput(state, output);
  const { x, y } = position ?? { x: rightEdge(state), y: 0 };
  let mode = modeName(req);

  try {
    mode = await addModeToOutput(run, target, req);
    await run('xrandr', ['--output', target, '--mode', mode, '--pos', `${x}x${y}`]);
  } catch (e) {
    await removeVirtualDisplays(run).catch(() => {});
    throw e;
  }
  return { ...req, output: target, mode, x, y };
}

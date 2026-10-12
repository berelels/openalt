// Configuração PRÓPRIA do Sunshine para o OpenAlt (ADR-0010): nunca toca na do usuário.
// Gera sunshine.conf, apps.json ("Nova tela" e "Espelhar"), as credenciais e a ponte
// `openalt-prep` que o Sunshine (Flatpak) chama ao conectar/desconectar.
import { createHash, randomBytes } from 'node:crypto';
import { access, chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sunshineDir, type Paths } from '../paths.ts';

export const SUNSHINE_FLATPAK = 'dev.lizardbyte.app.Sunshine';
export const SUNSHINE_USER = 'openalt';

/**
 * Hash que o Sunshine grava para a senha da interface web: SHA-256(senha + salt) com os
 * bytes INVERTIDOS, em hexadecimal maiúsculo (descoberto e conferido no PC de testes).
 */
export function sunshinePasswordHash(password: string, salt: string): string {
  return Buffer.from(createHash('sha256').update(password + salt).digest()).reverse().toString('hex').toUpperCase();
}

const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomAlnum(n: number): string {
  const bytes = randomBytes(n * 2);
  let out = '';
  for (const b of bytes) {
    if (b < 248) out += ALNUM[b % 62]; // descarta o excesso para não enviesar
    if (out.length === n) break;
  }
  return out.length === n ? out : randomAlnum(n);
}

export interface WebCredentials {
  username: string;
  password: string;
}

export function newCredentials(): WebCredentials {
  return { username: SUNSHINE_USER, password: randomBytes(24).toString('base64url') };
}

/** Conteúdo inicial do arquivo de estado do Sunshine (só as credenciais; o resto ele cria). */
export function credentialsState(c: WebCredentials, salt = randomAlnum(16)): string {
  return `${JSON.stringify({ username: c.username, salt, password: sunshinePasswordHash(c.password, salt) }, null, 4)}\n`;
}

export interface SunshineConfOptions {
  dir: string;
  /** índice da saída do monitor virtual na lista de telas do Sunshine (ordem do X) */
  outputIndex: number;
  name: string;
  /**
   * Sunshine nativo (.deb, com CAP_SYS_ADMIN): captura KMS do conector do monitor virtual, pelo
   * nome que o Sunshine usa ("DP-1", "HDMI-A-1"). Na KMS o cursor só aparece no monitor onde está
   * (na X11 o Sunshine o desenha na borda quando ele está em outro monitor).
   */
  kmsConnector?: string;
  /**
   * Nome da saída do X (ex.: "DisplayPort-1"). O Sunshine atual procura a tela pelo NOME na lista
   * dele; um número que não bate com nenhum nome cai na primeira tela (por isso funcionava por
   * acaso quando o monitor virtual era a primeira saída). Sem nome, usa o índice (versões antigas).
   */
  outputName?: string;
}

/** Nome de conector no formato do Sunshine (tipo DRM + índice), ex.: "DP-1". */
export const isKmsConnectorName = (n: string): boolean => /^[A-Za-z]+(-[A-Za-z]+)?-\d{1,2}$/.test(n);

export function sunshineConf(o: SunshineConfOptions): string {
  if (!Number.isInteger(o.outputIndex) || o.outputIndex < 0) throw new RangeError('outputIndex inválido');
  if (o.kmsConnector !== undefined && !isKmsConnectorName(o.kmsConnector)) throw new RangeError('kmsConnector inválido');
  if (o.outputName !== undefined && !/^[A-Za-z][\w.\-]{0,31}$/.test(o.outputName)) throw new RangeError('outputName inválido');
  const safeName = o.name.replace(/[^\w .\-]/g, '').slice(0, 40) || 'OpenAlt';
  return [
    '# Gerado pelo OpenAlt. Configuração só do OpenAlt: a do seu Sunshine não é usada nem alterada.',
    `sunshine_name = ${safeName}`,
    'origin_web_ui_allowed = pc',
    ...(o.kmsConnector ? ['capture = kms', `output_name = ${o.kmsConnector}`] : ['capture = x11', `output_name = ${o.outputName ?? o.outputIndex}`]),
    `file_apps = ${join(o.dir, 'apps.json')}`,
    `file_state = ${join(o.dir, 'sunshine_state.json')}`,
    `credentials_file = ${join(o.dir, 'sunshine_state.json')}`,
    `cert = ${join(o.dir, 'credentials', 'cacert.pem')}`,
    `pkey = ${join(o.dir, 'credentials', 'cakey.pem')}`,
    `log_path = ${join(o.dir, 'sunshine.log')}`,
    ...(process.env.OPENALT_SUNSHINE_DEBUG ? ['min_log_level = debug'] : []),
    '',
  ].join('\n');
}

/** Os dois "apps" do OpenAlt no Sunshine; o celular/tablet escolhe ao conectar. */
export function appsJson(prepPath: string): string {
  const app = (name: string, action: string) => ({
    name,
    'image-path': 'desktop.png',
    'prep-cmd': [{ do: `${prepPath} ${action}`, undo: `${prepPath} down` }],
  });
  // Um item só no Moonlight: ele segue o modo escolhido no app do PC (Nova tela ou Espelhar).
  // Dois itens parecidos ("qual é qual?") confundiam no teste com o tablet.
  return `${JSON.stringify({ env: {}, apps: [app('OpenAlt', 'auto')] }, null, 2)}\n`;
}

export interface PrepScriptOptions {
  /** executável que roda a CLI do núcleo (node no desenvolvimento; o app com ELECTRON_RUN_AS_NODE no pacote) */
  runner: string;
  /** argumentos antes do comando (ex.: o caminho de cli.ts) */
  runnerArgs: string[];
  /** variáveis fixas repassadas à CLI (ex.: ELECTRON_RUN_AS_NODE=1, pastas do OpenAlt) */
  env: Record<string, string>;
}

function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * A ponte que o Sunshine executa. Roda DENTRO do Flatpak (provado no S2/S14): lê as
 * SUNSHINE_CLIENT_* do próprio ambiente (o Sunshine não usa shell) e chama a CLI no sistema.
 */
export function prepScript(o: PrepScriptOptions): string {
  for (const k of Object.keys(o.env)) if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) throw new Error(`variável inválida: ${k}`);
  const fixed = Object.entries(o.env).map(([k, v]) => `--env=${k}=${shQuote(v)}`).join(' ');
  const cmd = [o.runner, ...o.runnerArgs].map(shQuote).join(' ');
  return `#!/bin/sh
# Gerado pelo OpenAlt: ponte prep-cmd do Sunshine -> núcleo do OpenAlt.
# uso: openalt-prep auto|extend|mirror|down  (auto = o modo escolhido no app)
set -eu
case "\${1:-}" in auto|extend|mirror|down) ;; *) echo "uso: $0 auto|extend|mirror|down" >&2; exit 2 ;; esac
if [ -f /.flatpak-info ]; then
  # Cada valor entre aspas: o nome do aparelho vem de fora e pode ter espaços ou símbolos.
  exec flatpak-spawn --host \\
    --env=SUNSHINE_CLIENT_WIDTH="\${SUNSHINE_CLIENT_WIDTH:-}" \\
    --env=SUNSHINE_CLIENT_HEIGHT="\${SUNSHINE_CLIENT_HEIGHT:-}" \\
    --env=SUNSHINE_CLIENT_FPS="\${SUNSHINE_CLIENT_FPS:-}" \\
    --env=SUNSHINE_CLIENT_NAME="\${SUNSHINE_CLIENT_NAME:-}" \\
    ${fixed} ${cmd} display "$1" --from-sunshine
else
  exec env ${Object.entries(o.env).map(([k, v]) => `${k}=${shQuote(v)}`).join(' ')} ${cmd} display "$1" --from-sunshine
fi
`;
}

async function exists(p: string): Promise<boolean> {
  return access(p).then(() => true, () => false);
}

export interface SetupResult {
  dir: string;
  confPath: string;
  prepPath: string;
  createdCredentials: boolean;
}

/**
 * Escreve (ou atualiza) a configuração própria. As credenciais só são criadas uma vez;
 * a senha vai para `credentials.json` (0600) — nunca para a linha de comando ou o log.
 */
export async function writeSunshineSetup(
  paths: Paths,
  o: { outputIndex: number; name: string; kmsConnector?: string; outputName?: string; prep: PrepScriptOptions },
): Promise<SetupResult> {
  const dir = sunshineDir(paths);
  await mkdir(join(dir, 'credentials'), { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700);
  await mkdir(paths.data, { recursive: true, mode: 0o700 });

  const prepPath = join(paths.data, 'openalt-prep');
  await writeFile(prepPath, prepScript(o.prep), { mode: 0o700 });
  await chmod(prepPath, 0o700);

  const confPath = join(dir, 'sunshine.conf');
  await writeFile(confPath, sunshineConf({ dir, outputIndex: o.outputIndex, name: o.name, kmsConnector: o.kmsConnector, outputName: o.outputName }), { mode: 0o600 });
  await writeFile(join(dir, 'apps.json'), appsJson(prepPath), { mode: 0o600 });

  let createdCredentials = false;
  const credFile = join(paths.config, 'credentials.json');
  if (!(await exists(credFile)) || !(await exists(join(dir, 'sunshine_state.json')))) {
    const c = newCredentials();
    await writeFile(join(dir, 'sunshine_state.json'), credentialsState(c), { mode: 0o600 });
    await writeFile(credFile, `${JSON.stringify(c)}\n`, { mode: 0o600 });
    createdCredentials = true;
  }
  return { dir, confPath, prepPath, createdCredentials };
}

export async function readCredentials(paths: Paths): Promise<WebCredentials> {
  const c = JSON.parse(await readFile(join(paths.config, 'credentials.json'), 'utf8')) as WebCredentials;
  if (typeof c.username !== 'string' || typeof c.password !== 'string') throw new Error('credenciais inválidas');
  return c;
}

export interface PairedDevice {
  uuid: string;
  name: string;
  enabled: boolean;
}

/** Aparelhos pareados, lidos do estado do Sunshine (funciona com ele desligado). */
/** Tira um aparelho do arquivo de estado (só com o Sunshine parado). true = achou e tirou. */
export async function forgetPairedDevice(paths: Paths, uuid: string): Promise<boolean> {
  const file = join(sunshineDir(paths), 'sunshine_state.json');
  const st = JSON.parse(await readFile(file, 'utf8'));
  const list: unknown = st?.root?.named_devices;
  if (!Array.isArray(list)) return false;
  const kept = list.filter((d) => !(d && typeof d === 'object' && (d as Record<string, unknown>).uuid === uuid));
  if (kept.length === list.length) return false;
  st.root.named_devices = kept;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(st, null, 4)}\n`, { mode: 0o600 });
  await rename(tmp, file);
  return true;
}

export async function readPairedDevices(paths: Paths): Promise<PairedDevice[]> {
  try {
    const st = JSON.parse(await readFile(join(sunshineDir(paths), 'sunshine_state.json'), 'utf8'));
    const list: unknown = st?.root?.named_devices;
    if (!Array.isArray(list)) return [];
    return list
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
      .map((d) => ({ uuid: String(d.uuid ?? ''), name: String(d.name ?? ''), enabled: d.enabled !== 'false' && d.enabled !== false }))
      .filter((d) => d.uuid);
  } catch {
    return [];
  }
}

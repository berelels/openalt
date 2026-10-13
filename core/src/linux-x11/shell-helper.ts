// A extensão do GNOME do OpenAlt (core/gnome-shell/openalt@cattastudios.dev): reinicia o GNOME no
// X11 por dentro, sem a caixa do Alt+F2. O app a instala na pasta de extensões da pessoa e a liga.
// O GNOME só carrega extensões novas ao (re)iniciar: na 1ª vez, o reinício ainda é pelo Alt+F2,
// e esse reinício já carrega a extensão para as próximas.
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as defaultRun, type Runner } from '../proc.ts';

export const SHELL_HELPER_UUID = 'openalt@cattastudios.dev';
const OBJECT_PATH = '/dev/cattastudios/OpenAlt';
const IFACE = 'dev.cattastudios.OpenAlt.Shell';
const VALID_UUID = /^[\w.@\-]{1,128}$/;

/** A pasta da extensão no projeto/pacote (a mesma de src/ e de dist/: as duas ficam em core/). */
export function shellHelperSource(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'gnome-shell', SHELL_HELPER_UUID);
}

export function shellExtensionsDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const data = env.XDG_DATA_HOME && env.XDG_DATA_HOME.startsWith('/') ? env.XDG_DATA_HOME : join(home, '.local', 'share');
  return join(data, 'gnome-shell', 'extensions');
}

/** Lê uma lista de texto do GSettings (`['a', 'b']` ou `@as []`). null se vier algo inesperado. */
export function parseStringList(v: string): string[] | null {
  const t = v.trim().replace(/^@as\s+/, '');
  if (t === '[]') return [];
  if (!t.startsWith('[') || !t.endsWith(']')) return null;
  const items = t.slice(1, -1).split(',').map((x) => x.trim());
  const out: string[] = [];
  for (const it of items) {
    const m = /^'([^'\\]*)'$/.exec(it);
    if (!m) return null;
    out.push(m[1]!);
  }
  return out;
}

export type HelperInstall = 'active' | 'pending-restart' | 'disabled-by-user' | 'unavailable';

export interface InstallOptions {
  run?: Runner;
  source?: string;
  extensionsDir?: string;
}

/**
 * Copia a extensão (se faltar ou mudou) e a põe nas extensões ligadas. Não liga se a pessoa a
 * desligou no app Extensões, nem se as extensões estão todas desligadas.
 */
export async function installShellHelper({ run = defaultRun, source = shellHelperSource(), extensionsDir = shellExtensionsDir() }: InstallOptions = {}): Promise<HelperInstall> {
  if (await shellHelperVersion(run)) return 'active';
  const get = async (key: string) => (await run('gsettings', ['get', 'org.gnome.shell', key]).catch(() => ({ stdout: '' }))).stdout.trim();
  const enabledRaw = await get('enabled-extensions');
  const enabled = parseStringList(enabledRaw);
  if (!enabled) return 'unavailable'; // sem GNOME, ou uma lista que não sabemos regravar sem estragar
  if ((await get('disable-user-extensions')) === 'true') return 'disabled-by-user';
  if ((parseStringList(await get('disabled-extensions')) ?? []).includes(SHELL_HELPER_UUID)) return 'disabled-by-user';

  const dest = join(extensionsDir, SHELL_HELPER_UUID);
  await mkdir(dest, { recursive: true, mode: 0o755 });
  for (const f of await readdir(source)) {
    const [a, b] = await Promise.all([readFile(join(source, f)), readFile(join(dest, f)).catch(() => null)]);
    if (!b || !a.equals(b)) await copyFile(join(source, f), join(dest, f));
  }
  if (!enabled.includes(SHELL_HELPER_UUID)) {
    // regrava só com nomes que sabemos escrever (sem aspas): nada da lista da pessoa se perde
    if (!enabled.every((u) => VALID_UUID.test(u))) return 'unavailable';
    const list = [...enabled, SHELL_HELPER_UUID].map((u) => `'${u}'`).join(', ');
    await run('gsettings', ['set', 'org.gnome.shell', 'enabled-extensions', `[${list}]`]);
  }
  return 'pending-restart';
}

/** A versão da extensão rodando no GNOME, ou 0 se ela não está carregada. */
export async function shellHelperVersion(run: Runner = defaultRun): Promise<number> {
  const r = await run('gdbus', ['call', '--session', '--dest', 'org.gnome.Shell', '--object-path', OBJECT_PATH,
    '--method', 'org.freedesktop.DBus.Properties.Get', IFACE, 'Version'], { timeoutMs: 3000 }).catch(() => ({ stdout: '' }));
  const m = /uint32 (\d+)/.exec(r.stdout);
  return m ? Number(m[1]) : 0;
}

/** Pede à extensão para reiniciar o GNOME. true = aceito (o GNOME reinicia em seguida). */
export async function restartShellViaHelper(run: Runner = defaultRun): Promise<boolean> {
  const r = await run('gdbus', ['call', '--session', '--dest', 'org.gnome.Shell', '--object-path', OBJECT_PATH,
    '--method', `${IFACE}.Restart`], { timeoutMs: 3000 }).catch(() => ({ stdout: '' }));
  return r.stdout.trim() === '(true,)';
}

/**
 * Pede à extensão para refazer os fundos (o papel de parede some quando a tela do aparelho sai) SEM
 * reiniciar o GNOME. true = a extensão respondeu. Usado ao desconectar sem a permissão do sistema.
 */
export async function refreshBackgroundsViaHelper(run: Runner = defaultRun): Promise<boolean> {
  const r = await run('gdbus', ['call', '--session', '--dest', 'org.gnome.Shell', '--object-path', OBJECT_PATH,
    '--method', `${IFACE}.RefreshBackgrounds`], { timeoutMs: 3000 }).catch(() => null);
  return r !== null;
}

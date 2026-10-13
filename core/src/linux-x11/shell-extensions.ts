// Extensões do GNOME que guardam o monitor pelo NÚMERO (ou desenham por monitor) só quando são
// carregadas. Ao entrar ou sair o monitor do aparelho, os números mudam (o GNOME no X11 ordena pelo
// nome da saída, e a saída livre costuma vir antes) e elas se perdem — no 1º teste: o ArcMenu abria
// o Super no tablet e o papel de parede (Picture Desktop Remake) não aparecia nele. Reiniciar o
// GNOME (Alt+F2 → r) resolvia; recarregar as extensões ligadas faz o mesmo sem reiniciar, e vale
// para as extensões de cada pessoa (não dá para saber de antemão quais se perdem).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run as defaultRun, type Runner } from '../proc.ts';

const VALID_UUID = /^[\w.@\-]{1,128}$/;
const MARKER = 'extensions-reloading.json';

export interface ReloadOptions {
  run?: Runner;
  runtimeDir: string;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Recarrega (desliga e liga, na mesma ordem) as extensões ligadas. Devolve as recarregadas. */
export async function reloadMonitorSensitiveExtensions({ run = defaultRun, runtimeDir, sleep = realSleep }: ReloadOptions): Promise<string[]> {
  const enabled = (await run('gnome-extensions', ['list', '--enabled']).catch(() => ({ stdout: '' }))).stdout.split('\n').map((l) => l.trim());
  const targets = enabled.filter((e) => VALID_UUID.test(e));
  if (!targets.length) return [];
  // marca antes de desligar: se o app cair no meio, a próxima abertura religa (restoreExtensions)
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  await writeFile(join(runtimeDir, MARKER), `${JSON.stringify(targets)}\n`, { mode: 0o600 });
  for (const e of [...targets].reverse()) await run('gnome-extensions', ['disable', e]).catch(() => {});
  await sleep(400);
  for (const e of targets) await run('gnome-extensions', ['enable', e]).catch(() => {});
  await rm(join(runtimeDir, MARKER), { force: true });
  return [...targets];
}

/** Religa extensões que ficaram desligadas por uma recarga interrompida. */
export async function restoreExtensions({ run = defaultRun, runtimeDir }: ReloadOptions): Promise<string[]> {
  let list: unknown;
  try { list = JSON.parse(await readFile(join(runtimeDir, MARKER), 'utf8')); } catch { return []; }
  const targets = Array.isArray(list) ? list.filter((e): e is string => typeof e === 'string' && VALID_UUID.test(e)) : [];
  for (const e of targets) await run('gnome-extensions', ['enable', e]).catch(() => {});
  await rm(join(runtimeDir, MARKER), { force: true });
  return targets;
}

const SHELL_UNIT = 'org.gnome.Shell@x11.service';

/**
 * Reinicia o GNOME Shell (só no X11, onde as janelas sobrevivem): o mesmo que Alt+F2 → r, que a
 * pessoa descobriu que deixa tudo certo depois que o monitor do aparelho sai. No GNOME 46 o Shell
 * é um serviço do systemd (Restart=always); reiniciar o serviço é o caminho limpo. No Wayland não
 * existe reiniciar o Shell sem encerrar a sessão — aí não faz nada.
 */
export async function restartGnomeShell(run: Runner = defaultRun, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (env.XDG_SESSION_TYPE !== 'x11') return false;
  const active = await run('systemctl', ['--user', 'is-active', SHELL_UNIT]).then((r) => r.stdout.trim() === 'active', () => false);
  if (!active) return false;
  await run('systemctl', ['--user', 'restart', SHELL_UNIT], { timeoutMs: 30_000 });
  return true;
}

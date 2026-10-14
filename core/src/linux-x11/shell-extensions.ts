// Extensões do GNOME que guardam o monitor pelo NÚMERO (ou desenham por monitor) só quando são
// carregadas. Ao entrar ou sair o monitor do aparelho, os números mudam (o GNOME no X11 ordena pelo
// nome da saída, e a saída livre costuma vir antes) e elas se perdem — no 1º teste: o ArcMenu abria
// o Super no tablet e o papel de parede (Picture Desktop Remake) não aparecia nele. Reiniciar o
// GNOME (Alt+F2 → r) resolvia; recarregar as extensões ligadas faz o mesmo sem reiniciar, e vale
// para as extensões de cada pessoa (não dá para saber de antemão quais se perdem).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realSleep, run as defaultRun, type Runner } from '../proc.ts';

/** nome de extensão do GNOME que dá para regravar no gsettings sem escapar nada */
export const VALID_UUID = /^[\w.@\-]{1,128}$/;
const MARKER = 'extensions-reloading.json';

export interface ReloadOptions {
  run?: Runner;
  runtimeDir: string;
  sleep?: (ms: number) => Promise<void>;
}


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


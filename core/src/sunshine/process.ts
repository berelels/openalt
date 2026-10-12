// Iniciar e parar o Sunshine (Flatpak) com a configuração do OpenAlt. Só quando a pessoa
// aperta "Ligar" (briefing: nada de serviço de rede sem pedir). Para parar, mata só o NOSSO
// Sunshine (achado pelo caminho da nossa configuração) — nunca o Sunshine da pessoa.
import { spawn, type ChildProcess } from 'node:child_process';
import { access, constants, readdir, readFile } from 'node:fs/promises';
import { run, type Runner } from '../proc.ts';
import { connect } from 'node:net';
import { SUNSHINE_FLATPAK } from './setup.ts';

export const SUNSHINE_PORTS = [47984, 47989, 47990, 48010];

export function portInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ port, host });
    s.setTimeout(800);
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('timeout', () => { s.destroy(); resolve(false); });
    s.once('error', () => resolve(false));
  });
}

export async function busyPorts(ports = SUNSHINE_PORTS): Promise<number[]> {
  const r = await Promise.all(ports.map(async (p) => ((await portInUse(p)) ? p : 0)));
  return r.filter(Boolean);
}

/** PIDs (do usuário) cuja linha de comando contém `arg` — ex.: o caminho do nosso sunshine.conf. */
export async function pidsWithArg(arg: string, procDir = '/proc'): Promise<number[]> {
  const pids: number[] = [];
  for (const entry of await readdir(procDir)) {
    if (!/^\d+$/.test(entry) || Number(entry) === process.pid) continue;
    try {
      const cmd = (await readFile(`${procDir}/${entry}/cmdline`, 'utf8')).split('\0');
      if (cmd.includes(arg)) pids.push(Number(entry));
    } catch {
      // processo terminou ou não é nosso
    }
  }
  return pids;
}

export interface RunningSunshine {
  child: ChildProcess;
  stop(): Promise<void>;
  onExit(cb: (code: number | null) => void): void;
  /** linhas do log de saída que interessam ao app (cliente conectou/saiu) */
  onLine(cb: (line: string) => void): void;
}

/** Qual Sunshine usar: o nativo (.deb) tem captura KMS; o Flatpak só X11. */
export type SunshineKind = 'native' | 'flatpak';
export const SUNSHINE_NATIVE = '/usr/bin/sunshine';

export async function findSunshine(r: Runner = run, nativePath = SUNSHINE_NATIVE): Promise<SunshineKind | null> {
  if (await access(nativePath, constants.X_OK).then(() => true, () => false)) return 'native';
  return r('flatpak', ['info', SUNSHINE_FLATPAK]).then(() => 'flatpak' as const, () => null);
}

export async function startSunshine(confPath: string, { timeoutMs = 30_000, kind = 'flatpak' as SunshineKind } = {}): Promise<RunningSunshine> {
  const busy = await busyPorts();
  if (busy.length) {
    throw new Error(`As portas do Sunshine (${busy.join(', ')}) já estão em uso. Se você usa o Sunshine por conta própria, feche-o antes de ligar o OpenAlt.`);
  }
  const child = kind === 'native'
    ? spawn(SUNSHINE_NATIVE, [confPath], { stdio: ['ignore', 'pipe', 'pipe'] })
    : spawn('flatpak', ['run', SUNSHINE_FLATPAK, confPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  const lineListeners: ((l: string) => void)[] = [];
  let buffer = '';
  const feed = (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i);
      buffer = buffer.slice(i + 1);
      for (const cb of lineListeners) cb(line);
    }
  };
  child.stdout!.on('data', feed);
  child.stderr!.on('data', feed);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O Sunshine não terminou de iniciar a tempo')), timeoutMs);
    const onLine = (l: string) => {
      if (/Starting main loop/.test(l)) { clearTimeout(timer); resolve(); }
      if (/Fatal:/.test(l)) { clearTimeout(timer); reject(new Error(`Sunshine: ${l.replace(/^.*Fatal:\s*/, '')}`)); }
    };
    lineListeners.push(onLine);
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`O Sunshine fechou ao iniciar (código ${code})`)); });
  }).catch(async (e) => {
    await stopByConf(confPath, child);
    throw e;
  });

  return {
    child,
    stop: () => stopByConf(confPath, child),
    onExit: (cb) => child.once('exit', cb),
    onLine: (cb) => lineListeners.push(cb),
  };
}

async function stopByConf(confPath: string, child?: ChildProcess): Promise<void> {
  child?.kill('SIGTERM');
  // o `flatpak run` pode sair antes do Sunshine dentro do sandbox: encerra o nosso pelo caminho da config
  for (let i = 0; i < 25; i++) {
    const pids = await pidsWithArg(confPath);
    if (!pids.length) return;
    for (const pid of pids) {
      try { process.kill(pid, i < 15 ? 'SIGTERM' : 'SIGKILL'); } catch { /* já saiu */ }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Para um Sunshine do OpenAlt que tenha sobrado de uma execução anterior (o app caiu). */
export async function stopLeftoverSunshine(confPath: string): Promise<boolean> {
  const had = (await pidsWithArg(confPath)).length > 0;
  if (had) await stopByConf(confPath);
  return had;
}

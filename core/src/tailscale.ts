// Estado do Tailscale oficial no PC (`tailscale status --json`), para o "Fora de casa" (M3,
// docs/m3-arquitetura.md). O OpenAlt só roda `tailscale up` quando a pessoa toca em "Entrar" (com a
// senha do sistema pelo pkexec); o login é no navegador, e o OpenAlt nunca lê chaves nem o estado do
// tailscaled (ADR-0003, ADR-0006). Do JSON só sai o que a tela usa: nada de AuthURL ou chaves.
import { execFile } from 'node:child_process';
import { run as defaultRun, type Runner } from './proc.ts';

export type TailscaleState = 'missing' | 'stopped' | 'needs-login' | 'running' | 'unknown';

export interface TailscalePeer {
  name: string;
  /** "android", "iOS", "linux"… como o Tailscale informa */
  os: string;
  online: boolean;
  /** IPv4 100.x do aparelho, quando há */
  ip: string | null;
  /** 'direct' = conexão direta; 'relay' = pelo DERP; null = sem tráfego recente para saber */
  path: 'direct' | 'relay' | null;
}

export interface TailscaleStatus {
  state: TailscaleState;
  /** IPv4 100.x deste PC (só em "running") */
  ip: string | null;
  peers: TailscalePeer[];
}

const CGNAT_V4 = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/;
export const isTailscaleIPv4 = (a: string): boolean => CGNAT_V4.test(a);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const firstV4 = (ips: unknown): string | null =>
  Array.isArray(ips) ? (ips.find((a): a is string => typeof a === 'string' && isTailscaleIPv4(a)) ?? null) : null;

/** Interpreta a saída de `tailscale status --json`. Entrada malformada vira "unknown". */
export function parseStatus(json: string): TailscaleStatus {
  let d: Record<string, unknown>;
  try {
    const v: unknown = JSON.parse(json);
    if (!v || typeof v !== 'object') throw new Error();
    d = v as Record<string, unknown>;
  } catch {
    return { state: 'unknown', ip: null, peers: [] };
  }
  const backend = str(d.BackendState);
  const state: TailscaleState = backend === 'Running' ? 'running'
    : backend === 'NeedsLogin' || backend === 'NeedsMachineAuth' ? 'needs-login'
    : backend === 'Stopped' ? 'stopped'
    : 'unknown';
  const peers: TailscalePeer[] = [];
  if (state === 'running' && d.Peer && typeof d.Peer === 'object') {
    for (const raw of Object.values(d.Peer as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const p = raw as Record<string, unknown>;
      const curAddr = str(p.CurAddr);
      peers.push({
        name: (str(p.HostName) || str(p.DNSName).split('.')[0] || '?').slice(0, 64),
        os: str(p.OS).slice(0, 32),
        online: p.Online === true,
        ip: firstV4(p.TailscaleIPs),
        path: curAddr ? 'direct' : str(p.Relay) && p.Online === true && p.Active === true ? 'relay' : null,
      });
    }
  }
  const self = d.Self && typeof d.Self === 'object' ? (d.Self as Record<string, unknown>) : {};
  return { state, ip: state === 'running' ? firstV4(self.TailscaleIPs ?? d.TailscaleIPs) : null, peers };
}

/** Aparelhos que podem ser o celular/tablet: Android e iOS, os online primeiro. */
export const mobilePeers = (s: TailscaleStatus): TailscalePeer[] =>
  s.peers.filter((p) => /^(android|ios)$/i.test(p.os)).sort((a, b) => Number(b.online) - Number(a.online));

export async function tailscaleStatus(run: Runner = defaultRun): Promise<TailscaleStatus> {
  try {
    const { stdout } = await run('tailscale', ['status', '--json'], { timeoutMs: 5000 });
    return parseStatus(stdout);
  } catch (e) {
    const err = e as { code?: unknown; stderr?: unknown; message?: unknown };
    const text = `${str(err.stderr)} ${str(err.message)}`;
    if (err.code === 'ENOENT' || /ENOENT|not found/i.test(text)) return { state: 'missing', ip: null, peers: [] };
    // Com o tailscaled parado o CLI sai com erro; com "tailscale down" o JSON vem com Stopped
    if (/tailscaled|connect|socket/i.test(text)) return { state: 'stopped', ip: null, peers: [] };
    // Alguns estados (ex.: NeedsLogin) saem com código ≠ 0 mas ainda imprimem o JSON
    const out = str((e as { stdout?: unknown }).stdout);
    return out ? parseStatus(out) : { state: 'unknown', ip: null, peers: [] };
  }
}

/**
 * O endereço de login que o `tailscale up` imprime, só se for do próprio Tailscale (https). Só conta
 * o endereço já terminado (seguido de espaço ou quebra de linha): a saída chega em pedaços.
 */
export function authUrlFrom(text: string): string | null {
  for (const m of text.matchAll(/https:\/\/[^\s"'<>]+(?=\s)/g)) {
    try {
      const u = new URL(m[0]);
      if (u.hostname === 'tailscale.com' || u.hostname.endsWith('.tailscale.com')) return u.href;
    } catch { /* não é endereço */ }
  }
  return null;
}

export const isUnixUser = (u: string): boolean => /^[a-z_][a-z0-9_.-]{0,31}$/i.test(u);

export interface Command { cmd: string; args: string[] }

/**
 * Os comandos (cada um via pkexec, pedindo a senha do sistema) para sair do estado atual e entrar:
 * - serviço parado: liga o tailscaled (e o deixa ligado ao reiniciar o PC), depois `up`;
 * - falta entrar: `up --operator=<pessoa>`, para o OpenAlt e a pessoa usarem o tailscale sem sudo.
 * Nada para "missing" (instalar é com a pessoa) nem para "running".
 */
export function signInCommands(state: TailscaleState, user: string): Command[] {
  if (!isUnixUser(user)) return [];
  const up: Command = { cmd: 'pkexec', args: ['tailscale', 'up', `--operator=${user}`] };
  if (state === 'stopped') return [{ cmd: 'pkexec', args: ['systemctl', 'enable', '--now', 'tailscaled'] }, up];
  if (state === 'needs-login' || state === 'unknown') return [up];
  return [];
}

/**
 * Roda um comando de `signInCommands` e chama `onUrl` quando o Tailscale mostra o endereço de login.
 * Termina quando a pessoa entra, desiste ou após 10 min. A saída não vai para log.
 */
export function runSignIn(c: Command, onUrl: (url: string) => void): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let seen = false;
    let output = '';
    const child = execFile(c.cmd, c.args, { timeout: 600_000, env: { ...process.env, LC_ALL: 'C' } },
      (e) => resolve({ ok: !e, output: output.slice(-2000) }));
    const watch = (chunk: Buffer | string) => {
      const s = String(chunk);
      output += s;
      const url = seen ? null : authUrlFrom(output);
      if (url) { seen = true; onUrl(url); }
    };
    child.stdout?.on('data', watch);
    child.stderr?.on('data', watch);
    child.stdin?.end();
  });
}

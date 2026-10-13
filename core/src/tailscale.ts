// Estado do Tailscale oficial no PC, só por leitura (`tailscale status --json`), para o "Fora de casa"
// (M3, docs/m3-arquitetura.md). O OpenAlt nunca roda `tailscale up/login` nem lê chaves ou o estado
// do tailscaled (ADR-0003, ADR-0006). Do JSON só sai o que a tela usa: nada de AuthURL ou chaves.
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

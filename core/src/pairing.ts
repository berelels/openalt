// Pareamento por QR de uso único e validade curta (docs/m1-arquitetura.md, F3; ADR-0006).
// O QR leva: nome do PC, endereços, porta, impressão digital do certificado do Sunshine
// (o aparelho só confia num PC com esse certificado), PIN e um id de pedido.
// O PC só entrega o PIN ao Sunshine para o pedido com o nome "OpenAlt-<id>" e dentro da validade.
import { randomBytes, randomInt, X509Certificate } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { normalizeFingerprint, type PendingPairing } from './sunshine/api.ts';

export const PAIRING_TTL_MS = 120_000;

export interface Pairing {
  id: string;
  pin: string;
  expiresAt: number;
  uri: string;
  /** já usado (uso único) */
  used: boolean;
}

export interface PairingOptions {
  pcName: string;
  hosts: string[];
  port: number;
  fingerprint: string;
  now?: number;
  ttlMs?: number;
}

export function deviceNameFor(id: string): string {
  return `OpenAlt-${id}`;
}

export function newPairing(o: PairingOptions): Pairing {
  if (!o.hosts.length) throw new Error('Nenhum endereço de rede para o aparelho alcançar este PC');
  const id = randomBytes(6).toString('hex');
  const pin = String(randomInt(0, 10000)).padStart(4, '0');
  const expiresAt = (o.now ?? Date.now()) + (o.ttlMs ?? PAIRING_TTL_MS);
  const q = new URLSearchParams({
    v: '1',
    n: o.pcName.slice(0, 64),
    h: o.hosts.join(','),
    p: String(o.port),
    fp: normalizeFingerprint(o.fingerprint),
    pin,
    d: id,
    exp: String(Math.floor(expiresAt / 1000)),
  });
  return { id, pin, expiresAt, uri: `openalt://pair?${q.toString()}`, used: false };
}

/**
 * O pedido pendente que pertence a este QR (nome certo, ainda válido, não usado).
 * O app Android manda "OpenAlt-<id>" ou "OpenAlt-<id> <modelo>" (ex.: "OpenAlt-a1b2c3 Moto g84").
 */
export function matchPending(p: Pairing, pending: PendingPairing[], now = Date.now()): PendingPairing | undefined {
  if (p.used || now >= p.expiresAt) return undefined;
  const base = deviceNameFor(p.id);
  return pending.find((x) => {
    const n = decodeName(x.name);
    return n === base || n.startsWith(`${base} `);
  });
}

/**
 * O Sunshine guarda o `devicename` do pedido como veio na URL, sem decodificar: o espaço chega
 * como "%20" ("OpenAlt-3bf6e2b6d6a0%20SM-P619" no 1º teste com o tablet). Decodifica aqui.
 */
export function decodeName(name: string): string {
  try {
    return decodeURIComponent(name); // "+" fica como está ("Galaxy Tab S9+")
  } catch {
    return name;
  }
}

/** Nome amigável para guardar no Sunshine (o modelo que o aparelho mandou), sem caracteres estranhos. */
export function friendlyName(pendingName: string): string {
  const rest = decodeName(pendingName).replace(/^OpenAlt-[0-9a-f]+\s*/, '').replace(/[^\p{L}\p{N} ._()+\-]/gu, '').trim().slice(0, 48);
  return rest || 'Aparelho';
}

export function qrSvg(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#26211bff', light: '#fffdf8ff' } });
}

export function certFingerprint(pem: string): string {
  return normalizeFingerprint(new X509Certificate(pem).fingerprint256);
}

/** IPv4 das interfaces de rede reais (sem loopback, Docker, pontes de VM). */
export function localAddresses(ifaces = networkInterfaces()): string[] {
  const skip = /^(lo|docker|br-|veth|virbr|vmnet|vboxnet|zt)/;
  const out: string[] = [];
  for (const [name, list] of Object.entries(ifaces)) {
    if (skip.test(name)) continue;
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  // Tailscale (100.64.0.0/10) por último: o aparelho tenta a rede local primeiro
  return out.sort((a, b) => Number(a.startsWith('100.')) - Number(b.startsWith('100.')));
}

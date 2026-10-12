// API local do Sunshine (https://127.0.0.1:47990), restrita ao próprio PC (origin_web_ui_allowed=pc).
// O certificado do Sunshine é autoassinado: em vez de confiar em qualquer um, conferimos a
// impressão digital do NOSSO certificado (fixação) — outro programa na mesma porta é recusado.
import { request } from 'node:https';
import type { TLSSocket } from 'node:tls';
import type { WebCredentials } from './setup.ts';

export interface HttpResponse { status: number; body: string }
/** Transporte injetável (os testes não abrem rede). */
export type Transport = (method: 'GET' | 'POST', path: string, body?: string) => Promise<HttpResponse>;

export function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, '').toLowerCase();
}

export function httpsTransport(o: { port?: number; credentials: WebCredentials; fingerprint: string }): Transport {
  const auth = `Basic ${Buffer.from(`${o.credentials.username}:${o.credentials.password}`).toString('base64')}`;
  const pinned = normalizeFingerprint(o.fingerprint);
  return (method, path, body) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port: o.port ?? 47990,
          path,
          method,
          headers: { Authorization: auth, ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) },
          rejectUnauthorized: false, // autoassinado; a confiança vem da fixação abaixo
          timeout: 5000,
        },
        (res) => {
          const peer = (res.socket as TLSSocket).getPeerCertificate?.();
          if (!peer?.fingerprint256 || normalizeFingerprint(peer.fingerprint256) !== pinned) {
            res.destroy();
            reject(new Error('Certificado do Sunshine não confere (outro programa na porta?)'));
            return;
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on('timeout', () => req.destroy(new Error('Sunshine não respondeu')));
      req.on('error', reject);
      req.end(body);
    });
}

export interface PendingPairing { id: string; name: string; address: string }
export interface SunshineClient { uuid: string; name: string }

async function json<T>(t: Transport, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const r = await t(method, path, body === undefined ? undefined : JSON.stringify(body));
  if (r.status === 401) throw new Error('Sunshine recusou as credenciais do OpenAlt');
  if (r.status === 403) throw new Error('Sunshine recusou o acesso (só pelo próprio PC)');
  if (r.status < 200 || r.status >= 300) throw new Error(`Sunshine respondeu ${r.status}`);
  return JSON.parse(r.body) as T;
}

export function sunshineApi(t: Transport) {
  return {
    /** Pedidos de pareamento esperando PIN (Sunshine 2026: o PIN vai junto com o id do pedido). */
    async pendingPairings(): Promise<PendingPairing[]> {
      const r = await json<{ pairings?: { id?: unknown; name?: unknown; address?: unknown }[] }>(t, 'GET', '/api/pin');
      return (r.pairings ?? [])
        .filter((p) => typeof p.id === 'string' && /^[0-9a-f]{32}$/i.test(p.id))
        .map((p) => ({ id: String(p.id), name: String(p.name ?? ''), address: String(p.address ?? '') }));
    },
    async submitPin(pairingId: string, pin: string, name: string): Promise<boolean> {
      if (!/^[0-9a-f]{32}$/i.test(pairingId) || !/^\d{4}$/.test(pin)) throw new Error('pedido ou PIN inválido');
      const r = await json<{ status?: boolean }>(t, 'POST', '/api/pin', { pairing_id: pairingId, pin, name });
      return r.status === true;
    },
    async clients(): Promise<SunshineClient[]> {
      const r = await json<{ named_certs?: { uuid?: unknown; name?: unknown }[] }>(t, 'GET', '/api/clients/list');
      return (r.named_certs ?? []).map((c) => ({ uuid: String(c.uuid ?? ''), name: String(c.name ?? '') })).filter((c) => c.uuid);
    },
    async unpair(uuid: string): Promise<boolean> {
      const r = await json<{ status?: boolean }>(t, 'POST', '/api/clients/unpair', { uuid });
      return r.status === true;
    },
  };
}

export type SunshineApi = ReturnType<typeof sunshineApi>;

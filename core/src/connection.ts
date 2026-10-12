// Quem está conectado agora. A ponte do Sunshine grava ao conectar e apaga ao desconectar;
// o app acompanha o arquivo (sem servidor local — ADR-0011).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Mode } from './settings.ts';

export interface Connection {
  name: string;
  width: number;
  height: number;
  fps: number;
  mode: Mode;
  since: number;
}

export const CONNECTION_FILE = 'connection.json';

export async function writeConnection(runtimeDir: string, c: Connection): Promise<void> {
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  const safe: Connection = {
    name: String(c.name).replace(/[^\p{L}\p{N} ._()+\-]/gu, '').slice(0, 48) || 'Aparelho',
    width: c.width, height: c.height, fps: c.fps, mode: c.mode, since: c.since,
  };
  await writeFile(join(runtimeDir, CONNECTION_FILE), `${JSON.stringify(safe)}\n`, { mode: 0o600 });
}

export async function readConnection(runtimeDir: string): Promise<Connection | null> {
  try {
    const c = JSON.parse(await readFile(join(runtimeDir, CONNECTION_FILE), 'utf8')) as Connection;
    const ok = typeof c.name === 'string' && [c.width, c.height, c.fps, c.since].every(Number.isFinite) && (c.mode === 'extend' || c.mode === 'mirror');
    return ok ? c : null;
  } catch {
    return null;
  }
}

export async function clearConnection(runtimeDir: string): Promise<void> {
  await rm(join(runtimeDir, CONNECTION_FILE), { force: true });
}

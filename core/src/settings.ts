// Preferências do OpenAlt (settings.json, 0600). Lidas também pela ponte que o Sunshine chama,
// então ficam num arquivo e não só na memória do app (ADR-0011).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isAlign, isSide, type Placement } from './layout.ts';

export type Mode = 'extend' | 'mirror';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Kind = 'phone' | 'tablet';

export interface Settings {
  version: 1;
  /** `anchor` = conector (ex.: DisplayPort-2) ou "primary"; `anchorName` ajuda a achar o monitor se ele mudar de porta. */
  placement: Placement & { anchorName?: string };
  mode: Mode;
  /** monitor espelhado no modo "Espelhar" ("primary" = o principal) */
  mirrorOf: string;
  rememberLayout: boolean;
  orientation: Orientation;
  previewKind: Kind;
  /** Maximizar as janelas levadas para a "Nova tela" (o monitor do aparelho costuma ser pequeno). */
  maximizeOnDevice: boolean;
  /**
   * Cada aparelho guarda o próprio lugar (o celular pode ficar à esquerda e o tablet
   * embaixo). A chave é o nome do aparelho; quem ainda não tem entrada usa o padrão acima.
   */
  perDevice: Record<string, DeviceSettings>;
}

export interface DeviceSettings {
  placement: Placement & { anchorName?: string };
}

const MAX_DEVICES = 32;
export const deviceKey = (name: string): string => name.replace(/[^\p{L}\p{N} ._()+\-]/gu, '').trim().slice(0, 48);

/** As preferências que valem para este aparelho (as dele, se já tiver; senão o padrão). */
export function settingsFor(s: Settings, deviceName: string | undefined): Settings {
  const d = deviceName ? s.perDevice[deviceKey(deviceName)] : undefined;
  return d ? { ...s, placement: d.placement } : s;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  placement: { anchor: 'primary', side: 'right', align: 'start', offset: 0 },
  mode: 'extend',
  mirrorOf: 'primary',
  rememberLayout: false,
  orientation: 'auto',
  previewKind: 'phone',
  maximizeOnDevice: true,
  perDevice: {},
};

const SAFE_NAME = /^[\w.\-]{1,64}$/;

/** Aceita só o que conhece; o resto volta ao padrão (arquivo pode ter sido editado à mão). */
export function sanitizeSettings(raw: unknown): Settings {
  const s = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  const p = (r.placement ?? {}) as Record<string, unknown>;
  if (typeof p.anchor === 'string' && SAFE_NAME.test(p.anchor)) s.placement.anchor = p.anchor;
  if (typeof p.anchorName === 'string' && p.anchorName.length <= 120) s.placement.anchorName = p.anchorName;
  if (typeof p.side === 'string' && isSide(p.side)) s.placement.side = p.side;
  if (typeof p.align === 'string' && isAlign(p.align)) s.placement.align = p.align;
  if (Number.isInteger(p.offset) && Math.abs(p.offset as number) <= 20000) s.placement.offset = p.offset as number;
  if (r.mode === 'extend' || r.mode === 'mirror') s.mode = r.mode;
  if (typeof r.mirrorOf === 'string' && SAFE_NAME.test(r.mirrorOf)) s.mirrorOf = r.mirrorOf;
  if (typeof r.rememberLayout === 'boolean') s.rememberLayout = r.rememberLayout;
  if (r.orientation === 'auto' || r.orientation === 'portrait' || r.orientation === 'landscape') s.orientation = r.orientation;
  if (r.previewKind === 'phone' || r.previewKind === 'tablet') s.previewKind = r.previewKind;
  if (typeof r.maximizeOnDevice === 'boolean') s.maximizeOnDevice = r.maximizeOnDevice;
  s.perDevice = {};
  const per = r.perDevice && typeof r.perDevice === 'object' ? Object.entries(r.perDevice as Record<string, unknown>) : [];
  for (const [k, v] of per.slice(0, MAX_DEVICES)) {
    const key = deviceKey(k);
    if (!key || !v || typeof v !== 'object') continue;
    s.perDevice[key] = { placement: sanitizeSettings({ placement: (v as Record<string, unknown>).placement }).placement };
  }
  return s;
}

export async function readSettings(configDir: string): Promise<Settings> {
  try {
    return sanitizeSettings(JSON.parse(await readFile(join(configDir, 'settings.json'), 'utf8')));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** Escrita atômica (arquivo temporário + rename), 0600. */
export async function writeSettings(configDir: string, s: Settings): Promise<void> {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const file = join(configDir, 'settings.json');
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sanitizeSettings(s), null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}

// Liga o nome da saída no xrandr (ex.: "DisplayPort-0") ao conector do kernel
// (ex.: "card1-DP-1") pelo CONNECTOR_ID, que os dois expõem. Os nomes não batem entre si
// (o driver amdgpu numera de 0, o kernel de 1), então nada de adivinhar pelo nome.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DRM_DIR = '/sys/class/drm';
const CONNECTOR_RE = /^card\d+-[A-Za-z]+(?:-[A-Za-z])?-\d+$/;

/** Lê `xrandr --prop`: saída → CONNECTOR_ID. */
export function parseConnectorIds(xrandrProp: string): Map<string, number> {
  const ids = new Map<string, number>();
  let current: string | null = null;
  for (const line of xrandrProp.split('\n')) {
    const out = /^(\S+) (?:connected|disconnected)/.exec(line);
    if (out) {
      current = out[1];
      continue;
    }
    const id = /^\s+CONNECTOR_ID:\s+(\d+)/.exec(line);
    if (id && current) ids.set(current, Number(id[1]));
  }
  return ids;
}

export interface DrmConnector {
  name: string;
  id: number;
}

export async function listDrmConnectors(dir = DRM_DIR): Promise<DrmConnector[]> {
  const found: DrmConnector[] = [];
  for (const name of await readdir(dir)) {
    if (!CONNECTOR_RE.test(name)) continue;
    try {
      found.push({ name, id: Number((await readFile(join(dir, name, 'connector_id'), 'utf8')).trim()) });
    } catch {
      // kernels antigos não têm connector_id; sem ele não há mapeamento seguro
    }
  }
  return found;
}

export function drmConnectorFor(output: string, ids: Map<string, number>, connectors: DrmConnector[]): string {
  const id = ids.get(output);
  if (id === undefined) throw new Error(`O xrandr não informou o CONNECTOR_ID de ${output}`);
  // Com duas placas de vídeo (comum em notebooks) o mesmo id pode existir nas duas;
  // nesse caso é melhor recusar do que forçar a saída errada.
  const matches = connectors.filter((c) => c.id === id);
  if (matches.length === 0) throw new Error(`Nenhum conector do kernel com id ${id} (${output})`);
  if (matches.length > 1) {
    throw new Error(`Conector ambíguo para ${output}: ${matches.map((c) => c.name).join(', ')} (mais de uma placa de vídeo)`);
  }
  return matches[0].name;
}

export function isValidConnectorName(name: string): boolean {
  return CONNECTOR_RE.test(name);
}

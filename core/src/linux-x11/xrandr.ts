// Leitura da saída de `xrandr --query` e de `cvt`.

export interface Geometry {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface XMode {
  name: string;
  current: boolean;
}

export interface XOutput {
  name: string;
  connected: boolean;
  primary: boolean;
  /** Presente quando a saída está ligada (inclusive "disconnected" usada como monitor virtual). */
  geometry: Geometry | null;
  modes: XMode[];
}

export interface XState {
  outputs: XOutput[];
  /** Modos criados com --newmode e não associados a nenhuma saída. */
  detachedModes: string[];
}

export interface Modeline {
  /** Clock e temporizações, na ordem que o `xrandr --newmode` espera. */
  params: string[];
}

const OUTPUT_RE = /^(\S+) (connected|disconnected)( primary)?(?: (\d+)x(\d+)\+(-?\d+)\+(-?\d+))?/;
// Modo solto: "  OA_1280x800_60 (0x542) 83.500MHz -HSync +VSync"
const DETACHED_RE = /^\s+(\S+) \(0x[0-9a-f]+\) /;
// Linhas "h: width ..." / "v: height ..." que seguem um modo solto.
const TIMING_RE = /^\s+[hv]: /;
const MODE_RE = /^\s+(\S+)\s*(.*)$/;

export function parseXrandrQuery(text: string): XState {
  const outputs: XOutput[] = [];
  const detachedModes: string[] = [];
  let current: XOutput | null = null;

  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.startsWith('Screen ')) continue;

    const o = OUTPUT_RE.exec(line);
    if (o) {
      current = {
        name: o[1],
        connected: o[2] === 'connected',
        primary: o[3] !== undefined,
        geometry:
          o[4] === undefined
            ? null
            : { width: Number(o[4]), height: Number(o[5]), x: Number(o[6]), y: Number(o[7]) },
        modes: [],
      };
      outputs.push(current);
      continue;
    }

    const d = DETACHED_RE.exec(line);
    if (d) {
      detachedModes.push(d[1]);
      current = null;
      continue;
    }
    if (TIMING_RE.test(line)) continue;

    const m = MODE_RE.exec(line);
    if (m && current) current.modes.push({ name: m[1], current: m[2].includes('*') });
  }

  return { outputs, detachedModes };
}

export function parseCvt(text: string): Modeline {
  const line = text.split('\n').find((l) => l.startsWith('Modeline '));
  if (!line) throw new Error('cvt não gerou uma Modeline');
  const params = line.replace(/^Modeline\s+"[^"]*"\s+/, '').trim().split(/\s+/);
  // clock + 4 horizontais + 4 verticais, no mínimo
  if (params.length < 9 || !params.slice(0, 9).every((p) => /^\d+(\.\d+)?$/.test(p))) {
    throw new Error(`Modeline inesperada: ${line}`);
  }
  return { params };
}

/** Borda direita da área ocupada pelos monitores ligados (onde o novo monitor entra). */
export function rightEdge(state: XState, ignore: readonly string[] = []): number {
  let edge = 0;
  for (const o of state.outputs) {
    if (o.geometry && !ignore.includes(o.name)) edge = Math.max(edge, o.geometry.x + o.geometry.width);
  }
  return edge;
}

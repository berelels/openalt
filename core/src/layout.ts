// Onde o celular entra na área de trabalho. Independente de plataforma: recebe retângulos
// e devolve retângulos. O celular pode ficar à direita, à esquerda, acima ou abaixo de
// QUALQUER monitor, alinhado no início, no centro ou no fim desse lado.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Erro de arranjo com um código e os nomes envolvidos, para a interface traduzir
 * (a mensagem em pt-BR continua para a CLI e os registros).
 */
export class LayoutError extends Error {
  readonly code: 'no-anchor' | 'overlap' | 'overlap-pair' | 'loose' | 'impossible' | 'duplicate';
  readonly vars: Record<string, string>;
  constructor(code: LayoutError['code'], message: string, vars: Record<string, string> = {}) {
    super(message);
    this.name = 'LayoutError';
    this.code = code;
    this.vars = vars;
  }
}

/** Monitores pelo nome (ex.: "DisplayPort-2"). */
export type Layout = Record<string, Rect>;

export const SIDES = ['right', 'left', 'above', 'below'] as const;
export const ALIGNS = ['start', 'center', 'end'] as const;
export type Side = (typeof SIDES)[number];
/** start = topo (lados) ou esquerda (acima/abaixo); end = base ou direita. */
export type Align = (typeof ALIGNS)[number];

export interface Placement {
  anchor: string;
  side: Side;
  align: Align;
  /** Ajuste fino em pixels ao longo da borda, somado ao alinhamento (pode ser negativo). */
  offset?: number;
}

export function isSide(v: string): v is Side {
  return (SIDES as readonly string[]).includes(v);
}

export function isAlign(v: string): v is Align {
  return (ALIGNS as readonly string[]).includes(v);
}

function crossOffset(anchorLen: number, len: number, align: Align): number {
  if (align === 'start') return 0;
  if (align === 'end') return anchorLen - len;
  return Math.floor((anchorLen - len) / 2);
}

/**
 * Põe `name` (do tamanho `size`) encostado no monitor `placement.anchor`. Só se movem os
 * monitores que ficariam por baixo do celular (e, em cadeia, os que esses empurrarem), o
 * mínimo necessário e sempre para longe da referência. Assim o celular entra entre dois
 * monitores sem bagunçar o resto. O resultado começa em (0,0) e é validado.
 */
export function placeBeside(
  layout: Layout,
  name: string,
  size: { width: number; height: number },
  placement: Placement,
): Layout {
  const a = layout[placement.anchor];
  if (!a) throw new LayoutError('no-anchor', `Monitor de referência não encontrado: ${placement.anchor}`, { monitor: placement.anchor });
  if (name in layout) throw new LayoutError('duplicate', `Já existe um monitor chamado ${name}`, { monitor: name });
  const offset = placement.offset ?? 0;
  if (!Number.isInteger(offset)) throw new RangeError(`Deslocamento inválido: ${offset}`);

  const { width: w, height: h } = size;
  const out: Layout = {};
  for (const [k, r] of Object.entries(layout)) out[k] = { ...r };

  const alongY = a.y + crossOffset(a.height, h, placement.align) + offset;
  const alongX = a.x + crossOffset(a.width, w, placement.align) + offset;
  out[name] = {
    right: { x: a.x + a.width, y: alongY, width: w, height: h },
    left: { x: a.x - w, y: alongY, width: w, height: h },
    below: { x: alongX, y: a.y + a.height, width: w, height: h },
    above: { x: alongX, y: a.y - h, width: w, height: h },
  }[placement.side];

  pushAway(out, name, placement.anchor, placement.side);
  const result = normalize(out);
  validateLayout(result);
  return result;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    sharedLength(a.x, a.x + a.width, b.x, b.x + b.width) > 0 &&
    sharedLength(a.y, a.y + a.height, b.y, b.y + b.height) > 0
  );
}

/** Empurra, em cadeia, quem ficou por baixo de `start`, na direção `side`. */
function pushAway(layout: Layout, start: string, anchor: string, side: Side): void {
  const horizontal = side === 'right' || side === 'left';
  const forward = side === 'right' || side === 'below';
  const a = layout[anchor];
  const edge = horizontal ? (forward ? a.x + a.width : a.x) : forward ? a.y + a.height : a.y;
  // só pode ser empurrado quem está inteiro do lado de lá da borda da referência
  const pushable = (r: Rect) => {
    const [pos, len] = horizontal ? [r.x, r.width] : [r.y, r.height];
    return forward ? pos >= edge : pos + len <= edge;
  };

  const queue = [start];
  for (let moves = 0; queue.length; ) {
    const moverName = queue.shift()!;
    const m = layout[moverName];
    for (const [k, r] of Object.entries(layout)) {
      if (k === moverName || !overlaps(m, r)) continue;
      if (!pushable(r)) throw new LayoutError('overlap', `Não cabe aí: ${moverName} ficaria por cima de ${k}`, { mover: moverName, monitor: k });
      if (horizontal) r.x = forward ? m.x + m.width : m.x - r.width;
      else r.y = forward ? m.y + m.height : m.y - r.height;
      queue.push(k);
      if (++moves > 10_000) throw new LayoutError('impossible', 'Layout impossível de resolver');
    }
  }
}

/** Desloca tudo para o canto superior esquerdo ficar em (0,0) (exigência do GNOME e do X). */
export function normalize(layout: Layout): Layout {
  const rects = Object.values(layout);
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const out: Layout = {};
  for (const [k, r] of Object.entries(layout)) out[k] = { ...r, x: r.x - minX, y: r.y - minY };
  return out;
}

function sharedLength(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

function touches(a: Rect, b: Rect): boolean {
  const side = a.x + a.width === b.x || b.x + b.width === a.x;
  const top = a.y + a.height === b.y || b.y + b.height === a.y;
  return (
    (side && sharedLength(a.y, a.y + a.height, b.y, b.y + b.height) > 0) ||
    (top && sharedLength(a.x, a.x + a.width, b.x, b.x + b.width) > 0)
  );
}

/** Sem sobreposição e todos encostados (o GNOME recusa monitores soltos). */
export function validateLayout(layout: Layout): void {
  const entries = Object.entries(layout);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [na, a] = entries[i];
      const [nb, b] = entries[j];
      if (overlaps(a, b)) {
        throw new LayoutError('overlap-pair', `Os monitores ${na} e ${nb} ficariam sobrepostos`, { a: na, b: nb });
      }
    }
  }

  if (entries.length < 2) return;
  const reached = new Set([entries[0][0]]);
  const queue = [entries[0]];
  while (queue.length) {
    const [, cur] = queue.shift()!;
    for (const entry of entries) {
      if (!reached.has(entry[0]) && touches(cur, entry[1])) {
        reached.add(entry[0]);
        queue.push(entry);
      }
    }
  }
  const loose = entries.find(([n]) => !reached.has(n));
  if (loose) throw new LayoutError('loose', `O monitor ${loose[0]} ficaria solto, sem encostar em nenhum outro`, { monitor: loose[0] });
}

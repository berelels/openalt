// Janelas que entram na "Nova tela" são maximizadas: o monitor do aparelho costuma ser menor
// (e com a interface ampliada fica ainda menor), e o GNOME no X11 não ajusta a janela ao trocar
// de monitor. Só maximiza uma vez por entrada — se a pessoa desfizer, a janela fica como ela quer.
// Usa o wmctrl (lista de janelas do gerenciador): não sonda monitores.
import type { Runner } from '../proc.ts';

export interface Rect { x: number; y: number; width: number; height: number }
export interface WinInfo { id: string; desktop: number; x: number; y: number; w: number; h: number }

/** Lê `wmctrl -lG`: id, área de trabalho, x, y, largura, altura, máquina, título. */
export function parseWmctrl(out: string): WinInfo[] {
  const wins: WinInfo[] = [];
  for (const line of out.split('\n')) {
    const m = /^(0x[0-9a-f]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\d+)\s/i.exec(line);
    if (m) wins.push({ id: m[1], desktop: Number(m[2]), x: Number(m[3]), y: Number(m[4]), w: Number(m[5]), h: Number(m[6]) });
  }
  return wins;
}

/** Janelas normais (não fixas em todas as áreas, como painéis) com o centro dentro do retângulo. */
export function windowsInside(wins: WinInfo[], r: Rect): WinInfo[] {
  return wins.filter((w) => {
    if (w.desktop < 0 || w.w < 120 || w.h < 80) return false;
    const cx = w.x + w.w / 2;
    const cy = w.y + w.h / 2;
    return cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height;
  });
}

export function windowMaximizer(run: Runner, rect: () => Rect | null) {
  let inside = new Set<string>();
  let first = true;
  return async function tick(): Promise<string[]> {
    const r = rect();
    if (!r) return [];
    const now = windowsInside(parseWmctrl((await run('wmctrl', ['-lG'])).stdout), r);
    const done: string[] = [];
    for (const w of now) {
      // o que já estava lá quando o aparelho conectou fica como está; só o que ENTRA é maximizado
      if (first || inside.has(w.id)) continue;
      const type = (await run('xprop', ['-id', w.id, '_NET_WM_WINDOW_TYPE']).catch(() => ({ stdout: '' }))).stdout;
      if (type && !/_NET_WM_WINDOW_TYPE_NORMAL/.test(type)) continue; // diálogos, menus etc.
      await run('wmctrl', ['-i', '-r', w.id, '-b', 'add,maximized_vert,maximized_horz']).catch(() => {});
      done.push(w.id);
    }
    inside = new Set(now.map((w) => w.id));
    first = false;
    return done;
  };
}

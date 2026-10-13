// Monitores pelo GNOME (mutter), via D-Bus org.gnome.Mutter.DisplayConfig.
// O mutter só aceita como monitor uma saída "connected", e reorganiza a área de trabalho
// sozinho quando um monitor aparece; por isso o layout final é aplicado por aqui.
// Usamos `busctl --json` (já vem com o systemd) em vez de uma biblioteca de D-Bus.
import type { Runner } from '../proc.ts';
import type { Layout } from '../layout.ts';

const DEST = ['org.gnome.Mutter.DisplayConfig', '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig'];

export interface MutterMode {
  id: string;
  width: number;
  height: number;
  refresh: number;
  isCurrent: boolean;
}

export interface MutterMonitor {
  connector: string;
  /** fabricante e produto do EDID (o monitor do aparelho é OAL / OpenAlt) */
  vendor: string;
  product: string;
  displayName: string;
  modes: MutterMode[];
}

export interface MutterLogicalMonitor {
  x: number;
  y: number;
  scale: number;
  transform: number;
  primary: boolean;
  connectors: string[];
}

export interface MutterState {
  serial: number;
  /** 1 = lógico (tamanhos divididos pela escala), 2 = físico (X11). */
  layoutMode: number;
  monitors: MutterMonitor[];
  logical: MutterLogicalMonitor[];
}

/** Métodos do ApplyMonitorsConfig. "temporary" não grava no monitors.xml. */
export const APPLY_METHOD = { verify: 0, temporary: 1, persistent: 2 } as const;

type Variant = { type: string; data: unknown };
type RawMode = [string, number, number, number, number, number[], Record<string, Variant>];
type RawSpec = [string, string, string, string];
type RawMonitor = [RawSpec, RawMode[], Record<string, Variant>];
type RawLogical = [number, number, number, number, boolean, RawSpec[], Record<string, Variant>];

/** Lê a saída de `busctl --json=short call … GetCurrentState`. */
export function parseMutterState(json: string): MutterState {
  const { data } = JSON.parse(json) as { data: [number, RawMonitor[], RawLogical[], Record<string, Variant>] };
  const [serial, monitors, logical, props] = data;
  return {
    serial,
    layoutMode: Number(props['layout-mode']?.data ?? 2),
    monitors: monitors.map(([spec, modes, mprops]) => ({
      connector: spec[0],
      vendor: String(spec[1] ?? ''),
      product: String(spec[2] ?? ''),
      displayName: String(mprops['display-name']?.data ?? spec[0]),
      modes: modes.map(([id, width, height, refresh, , , p]) => ({
        id,
        width,
        height,
        refresh,
        isCurrent: p['is-current']?.data === true,
      })),
    })),
    logical: logical.map(([x, y, scale, transform, primary, specs]) => ({
      x,
      y,
      scale,
      transform,
      primary,
      connectors: specs.map((s) => s[0]),
    })),
  };
}

export async function getMutterState(run: Runner): Promise<MutterState> {
  const { stdout } = await run('busctl', ['--user', '--json=short', 'call', ...DEST, 'GetCurrentState']);
  return parseMutterState(stdout);
}

function currentMode(state: MutterState, connector: string): MutterMode {
  const mode = state.monitors.find((m) => m.connector === connector)?.modes.find((m) => m.isCurrent);
  if (!mode) throw new Error(`O GNOME não informou o modo atual de ${connector}`);
  return mode;
}

/** Rotações de 90°/270° (com ou sem espelhamento) trocam largura e altura. */
function swapsAxes(transform: number): boolean {
  return transform % 2 === 1;
}

/**
 * Layout atual em retângulos, um por monitor lógico (nomeado pelo primeiro conector).
 * Monitores espelhados pelo GNOME (vários conectores num lógico) contam como um só.
 */
export function layoutFromMutter(state: MutterState): Layout {
  const layout: Layout = {};
  for (const lm of state.logical) {
    const mode = currentMode(state, lm.connectors[0]);
    const div = state.layoutMode === 1 ? lm.scale : 1;
    const [w, h] = swapsAxes(lm.transform) ? [mode.height, mode.width] : [mode.width, mode.height];
    layout[lm.connectors[0]] = { x: lm.x, y: lm.y, width: Math.round(w / div), height: Math.round(h / div) };
  }
  return layout;
}

/** Escala do monitor principal (o X11 exige a mesma em todos: global-scale-required). */
export function primaryScale(state: MutterState): number {
  return (state.logical.find((l) => l.primary) ?? state.logical[0])?.scale ?? 1;
}

/**
 * Tamanho que o celular ocupa no layout. No modo físico (X11) é a resolução; no modo lógico
 * (Wayland com escala, ex.: 200%) é a resolução dividida pela escala.
 */
export function layoutSize(state: MutterState, width: number, height: number): { width: number; height: number } {
  const s = state.layoutMode === 1 ? primaryScale(state) : 1;
  return { width: Math.round(width / s), height: Math.round(height / s) };
}

/**
 * O GNOME já está exatamente como `layout`, com `modeId` em uso no monitor novo? (Acontece
 * quando ele aplica sozinho um arranjo salvo antes com `remember`: aí não reaplicamos,
 * e a tela pisca uma vez só.)
 */
export function matchesLayout(state: MutterState, layout: Layout, connector: string, modeId: string): boolean {
  const current = layoutFromMutter(state);
  const mode = state.monitors.find((m) => m.connector === connector)?.modes.find((x) => x.isCurrent);
  if (mode?.id !== modeId) return false;
  const names = Object.keys(layout);
  if (Object.keys(current).length !== names.length) return false;
  return names.every((n) => {
    const a = current[n];
    const b = layout[n];
    return a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
  });
}

/** Modo do monitor com exatamente essa resolução e a taxa mais próxima de `fps`. */
export function findMode(state: MutterState, connector: string, width: number, height: number, fps: number): MutterMode | undefined {
  const modes = state.monitors.find((m) => m.connector === connector)?.modes ?? [];
  return modes
    .filter((m) => m.width === width && m.height === height)
    .sort((a, b) => Math.abs(a.refresh - fps) - Math.abs(b.refresh - fps))[0];
}

export interface NewMonitor {
  connector: string;
  modeId: string;
}

/**
 * Argumentos do `busctl call … ApplyMonitorsConfig`. Escala, rotação, principal e modo dos
 * monitores do usuário vêm de `before` (o estado ANTES de o monitor novo aparecer, porque o
 * GNOME rearranja tudo no hotplug); as posições vêm de `layout`; o serial vem de `now`.
 */
export function buildApplyArgs(
  now: MutterState,
  before: MutterState,
  layout: Layout,
  added: NewMonitor,
  method: keyof typeof APPLY_METHOD,
): string[] {
  const groups: { rect: Layout[string]; scale: number; transform: number; primary: boolean; monitors: [string, string][] }[] = [];

  for (const lm of before.logical) {
    const name = lm.connectors[0];
    const rect = layout[name];
    if (!rect) throw new Error(`O layout não inclui o monitor ${name}`);
    groups.push({
      rect,
      scale: lm.scale,
      transform: lm.transform,
      primary: lm.primary,
      monitors: lm.connectors.map((c) => [c, currentMode(before, c).id]),
    });
  }

  const rect = layout[added.connector];
  if (!rect) throw new Error(`O layout não inclui o monitor novo ${added.connector}`);
  groups.push({ rect, scale: primaryScale(before), transform: 0, primary: false, monitors: [[added.connector, added.modeId]] });

  const args = [
    '--user', 'call', ...DEST, 'ApplyMonitorsConfig', 'uua(iiduba(ssa{sv}))a{sv}',
    String(now.serial), String(APPLY_METHOD[method]), String(groups.length),
  ];
  for (const g of groups) {
    args.push(String(g.rect.x), String(g.rect.y), String(g.scale), String(g.transform), String(g.primary), String(g.monitors.length));
    for (const [connector, modeId] of g.monitors) args.push(connector, modeId, '0');
  }
  args.push('0'); // propriedades globais: nenhuma
  return args;
}

/**
 * Argumentos para voltar ao arranjo de `before` (o de antes do monitor do aparelho): só os monitores
 * da pessoa, nas posições, modos e escalas de antes. O monitor do aparelho fica de fora (desligado).
 */
export function buildRestoreArgs(now: MutterState, before: MutterState): string[] {
  const layout = layoutFromMutter(before);
  const args = [
    '--user', 'call', ...DEST, 'ApplyMonitorsConfig', 'uua(iiduba(ssa{sv}))a{sv}',
    String(now.serial), String(APPLY_METHOD.temporary), String(before.logical.length),
  ];
  for (const lm of before.logical) {
    const rect = layout[lm.connectors[0]];
    if (!rect) throw new Error(`O layout não inclui o monitor ${lm.connectors[0]}`);
    args.push(String(rect.x), String(rect.y), String(lm.scale), String(lm.transform), String(lm.primary), String(lm.connectors.length));
    for (const c of lm.connectors) args.push(c, currentMode(before, c).id, '0');
  }
  args.push('0');
  return args;
}

export async function applyMonitorsConfig(run: Runner, args: string[]): Promise<void> {
  await run('busctl', args);
}

/** O monitor virtual que o OpenAlt criou (EDID "OAL"/"OpenAlt"): não é um monitor da pessoa. */
export function isOpenAltMonitor(m: Pick<MutterMonitor, 'vendor' | 'product' | 'displayName'>): boolean {
  return m.vendor === 'OAL' || /OpenAlt/.test(m.product) || /OpenAlt|^OAL\b/.test(m.displayName);
}

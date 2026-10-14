// O que funciona no PC de QUEM ESTÁ USANDO. O OpenAlt é para qualquer pessoa: cada uma tem
// outra placa de vídeo, outro número de monitores, outra distribuição. Em vez de falhar no
// meio, a interface mostra isto antes ("funciona", "nunca testado aqui", "não funciona: por quê").
import { access, readdir, readlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Runner } from '../proc.ts';
import { drmConnectorFor, listDrmConnectors, parseConnectorIds } from './drm.ts';
import { DEFAULT_HELPER, helperAuthorized } from './extend.ts';
import { getMutterState } from './mutter.ts';
import { pickOutput } from './virtual-display.ts';
import { parseXrandrQuery } from './xrandr.ts';

export interface EnvFacts {
  /** XDG_SESSION_TYPE: x11, wayland, tty… */
  sessionType: string;
  /** XDG_CURRENT_DESKTOP, ex.: "zorin:GNOME", "ubuntu:GNOME", "KDE". */
  desktop: string;
  /** O GNOME respondeu em org.gnome.Mutter.DisplayConfig. */
  mutter: boolean;
  /** Drivers das placas de vídeo (amdgpu, i915, xe, nouveau, nvidia…). */
  gpuDrivers: string[];
  /** Saídas desconectadas e desligadas (onde o monitor virtual pode entrar). */
  freeOutputs: string[];
  /** A primeira saída livre tem conector do kernel identificado sem ambiguidade. */
  connectorMapped: boolean;
  helperInstalled: boolean;
}

export type Support = 'ok' | 'untested' | 'needs-setup' | 'unsupported';

export interface Check {
  id: string;
  status: Support;
  /** em pt-BR (CLI e registros) */
  message: string;
  /** para a interface traduzir: chave do texto e os valores que entram nele */
  key: string;
  vars?: Record<string, string>;
}

export interface Assessment {
  /** "Nova tela" */
  extend: Support;
  /** "Espelhar" */
  mirror: Support;
  checks: Check[];
}

/** Drivers em que o monitor virtual já foi provado de verdade. */
const TESTED_DRIVERS = ['amdgpu'];

const worst = (...s: Support[]): Support =>
  (['unsupported', 'needs-setup', 'untested', 'ok'] as const).find((level) => s.includes(level)) ?? 'ok';

export function assessEnvironment(f: EnvFacts): Assessment {
  const checks: Check[] = [];
  const add = (id: string, status: Support, message: string, key: string, vars?: Record<string, string>) =>
    checks.push({ id, status, message, key: `env.${id}.${key}`, ...(vars ? { vars } : {}) });

  const x11 = f.sessionType === 'x11';
  add('session', x11 ? 'ok' : 'unsupported',
    x11 ? 'Sessão X11.' : `Sessão "${f.sessionType || 'desconhecida'}": por enquanto o OpenAlt funciona só em X11 (Wayland está nos planos).`,
    x11 ? 'ok' : 'bad', { session: f.sessionType });

  const gnome = /gnome/i.test(f.desktop);
  const mutterOk = gnome && f.mutter;
  add('desktop', mutterOk ? 'ok' : 'unsupported',
    mutterOk ? 'Área de trabalho GNOME.'
      : gnome ? 'GNOME detectado, mas ele não respondeu sobre os monitores.'
      : `Área de trabalho "${f.desktop || 'desconhecida'}": a "Nova tela" por enquanto só funciona no GNOME.`,
    mutterOk ? 'ok' : gnome ? 'mute' : 'bad', { desktop: f.desktop });

  const untestedGpus = f.gpuDrivers.filter((d) => !TESTED_DRIVERS.includes(d));
  add('gpu', f.gpuDrivers.length === 0 ? 'untested' : untestedGpus.length ? 'untested' : 'ok',
    f.gpuDrivers.length === 0 ? 'Placa de vídeo não identificada.'
      : untestedGpus.length ? `Placa de vídeo (${untestedGpus.join(', ')}) ainda não testada com o OpenAlt; pode funcionar.`
      : `Placa de vídeo testada (${f.gpuDrivers.join(', ')}).`,
    f.gpuDrivers.length === 0 ? 'unknown' : untestedGpus.length ? 'untested' : 'ok',
    { drivers: (untestedGpus.length ? untestedGpus : f.gpuDrivers).join(', ') });
  if (f.gpuDrivers.length > 1) add('multi-gpu', 'untested', 'Mais de uma placa de vídeo: combinação ainda não testada.', 'untested');

  const hasFree = f.freeOutputs.length > 0;
  add('free-output', hasFree ? 'ok' : 'unsupported',
    hasFree ? `Saída de vídeo livre: ${f.freeOutputs[0]}.`
      : 'Nenhuma saída de vídeo livre (todas em uso). Um adaptador "dummy" HDMI/DisplayPort resolve.',
    hasFree ? 'ok' : 'bad', { output: f.freeOutputs[0] ?? '' });

  if (hasFree) {
    add('connector', f.connectorMapped ? 'ok' : 'unsupported',
      f.connectorMapped ? 'Saída livre identificada no sistema.' : 'Não foi possível identificar com segurança a saída livre no sistema.',
      f.connectorMapped ? 'ok' : 'bad');
  }

  add('helper', f.helperInstalled ? 'ok' : 'needs-setup',
    f.helperInstalled ? 'Permissão do sistema instalada.' : 'Falta instalar a permissão do sistema (pedida uma vez, na instalação).',
    f.helperInstalled ? 'ok' : 'missing');

  const status = (id: string) => checks.find((c) => c.id === id)?.status ?? 'ok';
  const base = worst(status('session'), status('gpu'), status('multi-gpu'), status('free-output'));
  return {
    extend: worst(base, status('desktop'), status('connector'), status('helper')),
    mirror: base,
    checks,
  };
}

/** Coleta os fatos do PC atual (só leitura). */
export async function gatherFacts(run: Runner, env: NodeJS.ProcessEnv = process.env): Promise<EnvFacts> {
  const facts: EnvFacts = {
    sessionType: env.XDG_SESSION_TYPE ?? '',
    desktop: env.XDG_CURRENT_DESKTOP ?? '',
    mutter: false,
    gpuDrivers: [],
    freeOutputs: [],
    connectorMapped: false,
    helperInstalled: false,
  };

  try {
    await getMutterState(run);
    facts.mutter = true;
  } catch {
    // sem GNOME ou sem sessão gráfica
  }

  try {
    const cards = (await readdir('/sys/class/drm')).filter((n) => /^card\d+$/.test(n));
    const drivers = await Promise.all(
      cards.map((c) => readlink(join('/sys/class/drm', c, 'device', 'driver')).then(basename, () => '')),
    );
    facts.gpuDrivers = [...new Set(drivers.filter(Boolean))];
  } catch {
    // /sys indisponível
  }

  if (facts.sessionType === 'x11') {
    try {
      const state = parseXrandrQuery((await run('xrandr', ['--query'])).stdout);
      facts.freeOutputs = state.outputs.filter((o) => !o.connected && o.geometry === null).map((o) => o.name);
      if (facts.freeOutputs.length) {
        const ids = parseConnectorIds((await run('xrandr', ['--prop'])).stdout);
        drmConnectorFor(pickOutput(state), ids, await listDrmConnectors());
        facts.connectorMapped = true;
      }
    } catch {
      // mantém o que deu para descobrir
    }
  }

  // Instalada = o ajudante roda sem senha (a política do polkit libera), não só o arquivo existir
  facts.helperInstalled = await access(process.env.OPENALT_HELPER ?? DEFAULT_HELPER).then(() => true, () => false)
    && await helperAuthorized(run);
  return facts;
}

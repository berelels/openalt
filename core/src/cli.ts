#!/usr/bin/env node
// openalt-core: núcleo do OpenAlt em linha de comando. A interface (Electron) e o
// Sunshine (prep-cmd do/undo) chamam isto; a saída é JSON numa linha.
import { parseArgs } from 'node:util';
import { isAlign, isSide, type Placement } from './layout.ts';
import { assessEnvironment, gatherFacts } from './linux-x11/environment.ts';
import { extendDesktop, moveDesktop, planExtend, retractDesktop, retractOnDisconnect } from './linux-x11/extend.ts';
import {
  createMirrorDisplay,
  createVirtualDisplay,
  listVirtualDisplays,
  requestFromEnv,
  chooseOutput,
} from './linux-x11/virtual-display.ts';
import { parseXrandrQuery } from './linux-x11/xrandr.ts';
import { run } from './proc.ts';
import { clearConnection, writeConnection } from './connection.ts';
import { openaltPaths } from './paths.ts';
import { readSettings, settingsFor } from './settings.ts';
import { sunshineClientViaTailscale } from './tailscale.ts';

const USAGE = `uso:
  openalt-core display extend [tamanho] [posição] [--output SAIDA] [--remember]
      "Nova tela": o celular vira um monitor do GNOME (precisa do openalt-helper)
      --remember: salva o arranjo no GNOME (monitors.xml); das próximas vezes pisca uma vez só
  openalt-core display move [posição] [--remember]
      muda o celular de lugar com a "Nova tela" ligada (sem senha)
  openalt-core display layout [tamanho] [posição]
      só mostra onde cada monitor ficaria (não muda nada)
  openalt-core display mirror [--of MONITOR] [--output SAIDA]
      "Espelhar": a tela capturada passa a mostrar MONITOR (padrão: o principal)
  openalt-core display down
      desfaz "Nova tela" e "Espelhar"
  openalt-core display status
  openalt-core display check
      o que funciona neste PC ("Nova tela", "Espelhar") e por quê
  openalt-core display up [tamanho] [--x X --y Y] [--output SAIDA]
      só xrandr, sem o GNOME (o GNOME ignora esta tela; útil para outros ambientes)

  tamanho:  --width W --height H --fps F   (padrão: SUNSHINE_CLIENT_WIDTH/HEIGHT/FPS, ou 1280x720@60)
  posição:  --anchor MONITOR --side right|left|above|below --align start|center|end [--offset PIXELS]
            (padrão: à direita do principal, alinhado no início)`;

class UsageError extends Error {}

async function main(argv: string[]): Promise<unknown> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      width: { type: 'string' },
      height: { type: 'string' },
      fps: { type: 'string' },
      output: { type: 'string' },
      x: { type: 'string' },
      y: { type: 'string' },
      anchor: { type: 'string' },
      side: { type: 'string' },
      align: { type: 'string' },
      offset: { type: 'string' },
      of: { type: 'string' },
      remember: { type: 'boolean' },
      'from-sunshine': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [group, asked] = positionals;
  // "auto" (chamado pela ponte do Sunshine): o modo escolhido no app do PC; pelo Tailscale
  // (fora de casa) sempre "Espelhar", a "Nova tela" é só na mesma rede
  const action = asked === 'auto'
    ? (await sunshineClientViaTailscale(run) ? 'mirror' : (await readSettings(openaltPaths().config)).mode)
    : asked;
  if (values.help || group !== 'display') throw new UsageError();

  const env = { ...process.env };
  if (values.width !== undefined) env.SUNSHINE_CLIENT_WIDTH = values.width;
  if (values.height !== undefined) env.SUNSHINE_CLIENT_HEIGHT = values.height;
  if (values.fps !== undefined) env.SUNSHINE_CLIENT_FPS = values.fps;
  const request = requestFromEnv(env);

  const placement: Partial<Placement> & { anchorName?: string } = {};
  if (values.anchor !== undefined) placement.anchor = values.anchor;
  if (values.side !== undefined) {
    if (!isSide(values.side)) throw new UsageError(`--side inválido: ${values.side}`);
    placement.side = values.side;
  }
  if (values.align !== undefined) {
    if (!isAlign(values.align)) throw new UsageError(`--align inválido: ${values.align}`);
    placement.align = values.align;
  }
  if (values.offset !== undefined) {
    if (!/^-?\d+$/.test(values.offset)) throw new UsageError(`--offset inválido: ${values.offset}`);
    placement.offset = Number(values.offset);
  }

  // Chamado pelo Sunshine (ponte openalt-prep): preferências vêm do settings.json, e quem
  // conectou fica registrado para o app mostrar.
  const fromSunshine = values['from-sunshine'] === true;
  const paths = openaltPaths();
  let remember = values.remember;
  let mirrorOf = values.of;
  if (fromSunshine) {
    // as preferências deste aparelho (cada um tem seu lugar e tamanho)
    const s = settingsFor(await readSettings(paths.config), process.env.SUNSHINE_CLIENT_NAME);
    const p = s.placement;
    if (values.anchor === undefined && p.anchor !== 'primary') placement.anchor = p.anchor;
    if (values.anchor === undefined && p.anchorName) placement.anchorName = p.anchorName;
    placement.side ??= p.side;
    placement.align ??= p.align;
    placement.offset ??= p.offset;
    remember ??= s.rememberLayout;
    if (mirrorOf === undefined && s.mirrorOf !== 'primary') mirrorOf = s.mirrorOf;
  }
  // Uma saída que ficou forçada num desconectar sem senha ainda parece "conectada": devolvê-la ANTES de
  // escolher, senão a escolha pula para outra saída, que o Sunshine (configurado no Ligar) não captura.
  if (fromSunshine && (action === 'extend' || action === 'mirror')) await retractDesktop();
  // a mesma saída que o app escolheu ao ligar (evita a do monitor preferido da dock)
  const output = values.output ?? (fromSunshine ? await chooseOutput() : undefined);
  const connected = async (mode: 'extend' | 'mirror') => {
    if (!fromSunshine) return;
    await writeConnection(paths.runtime, {
      name: process.env.SUNSHINE_CLIENT_NAME ?? '', width: request.width, height: request.height,
      fps: request.fps, mode, since: Date.now(),
    });
  };

  switch (action) {
    case 'extend': {
      // a tela do aparelho na resolução dele (a opção de aumentar as coisas saiu do app)
      const r = await extendDesktop(request, { placement, output: output, remember, deviceName: fromSunshine ? process.env.SUNSHINE_CLIENT_NAME : undefined });
      await connected('extend');
      return r;
    }
    case 'move':
      return moveDesktop(placement, { remember: values.remember });
    case 'layout':
      return planExtend(request, { placement, output: output });
    case 'mirror': {
      let r;
      try {
        r = await createMirrorDisplay(request.fps, { output: output, of: mirrorOf });
      } catch (e) {
        // monitor escolhido sumiu (desligado/trocado de porta): espelha o principal
        if (!fromSunshine || mirrorOf === undefined) throw e;
        r = await createMirrorDisplay(request.fps, { output: output });
      }
      await connected('mirror');
      return r;
    }
    case 'down': {
      // Pela ponte do Sunshine o aparelho desconectou: nunca pedir senha (a pessoa pode estar longe)
      // o aparelho saiu mesmo que desfazer a tela falhe (ex.: um monitor foi tirado no meio): o app não
      // pode continuar mostrando "conectado"
      try {
        return fromSunshine ? await retractOnDisconnect() : await retractDesktop();
      } finally {
        if (fromSunshine) await clearConnection(paths.runtime);
      }
    }
    case 'check':
      return assessEnvironment(await gatherFacts(run));
    case 'status':
      return { displays: listVirtualDisplays(parseXrandrQuery((await run('xrandr', ['--query'])).stdout)) };
    case 'up': {
      const position =
        values.x !== undefined || values.y !== undefined
          ? { x: Number(values.x ?? 0), y: Number(values.y ?? 0) }
          : undefined;
      return createVirtualDisplay(request, { output: output, position });
    }
    default:
      throw new UsageError();
  }
}

main(process.argv.slice(2)).then(
  (result) => console.log(JSON.stringify({ ok: true, ...(result as object) })),
  (err: Error) => {
    if (err instanceof UsageError) {
      if (err.message) console.error(err.message);
      console.error(USAGE);
      process.exitCode = 2;
      return;
    }
    const details = err instanceof AggregateError ? err.errors.map((e: Error) => e.message) : undefined;
    console.error(JSON.stringify({ ok: false, error: err.message, details }));
    process.exitCode = 1;
  },
);

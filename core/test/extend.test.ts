import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isValidEdid } from '../src/edid.ts';
import { CommandError, type Runner } from '../src/proc.ts';
import {
  extendDesktop,
  HELPER_NO_EDID,
  moveDesktop,
  pkexecHelper,
  retractDesktop,
  type ConnectorAction,
  type ExtendSession,
  type ForcedStore,
  type SessionStore,
} from '../src/linux-x11/extend.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const CVT_1080x2400 = 'Modeline "1080x2400_60.00"  220.75  1080 1176 1288 1496  2400 2403 2413 2488 -hsync +vsync\n';
const KERNEL = async () => [
  { name: 'card1-DP-1', id: 435 },
  { name: 'card1-DP-3', id: 450 },
  { name: 'card1-HDMI-A-1', id: 457 },
];
const PHONE = { width: 1080, height: 2400, fps: 60 };

type RawMode = [string, number, number, number, number, number[], Record<string, unknown>];
type Phase = 'idle' | 'forced' | 'moded';

interface WorldOptions {
  /** O PC permite EDID (debugfs). */
  edidSupported?: boolean;
  /** O modo do celular chega a aparecer no GNOME. */
  phoneModeAppears?: boolean;
  /** O GNOME já põe o celular no lugar certo sozinho (arranjo salvo ou padrão coincidente). */
  gnomeGetsItRight?: boolean;
}

/**
 * Estado do GNOME em cada fase, imitando os testes reais: no hotplug ele liga a saída e
 * REARRANJA os monitores (e troca o principal) — o núcleo precisa desfazer isso.
 */
function mutterJson(phase: Phase, serial: number, o: Required<WorldOptions>): string {
  const d = JSON.parse(fixture('mutter-2monitores.json'));
  d.data[0] = serial;
  if (phase === 'idle') return JSON.stringify(d);
  const cur = { 'is-current': { type: 'b', data: true } };
  const modes: RawMode[] = [['640x480@59.940', 640, 480, 59.94, 1, [1], cur]];
  if (phase === 'moded' && o.phoneModeAppears) modes.push(['1080x2400@59.970', 1080, 2400, 59.97, 1, [1], {}]);
  const spec = ['DisplayPort-0', 'OAL', 'OpenAlt', '0x00000001'];
  d.data[1].push([spec, modes, {}]);
  if (phase === 'moded' && o.gnomeGetsItRight && modes[1]) {
    modes[0][6] = {};
    modes[1][6] = cur;
    d.data[2].push([3360, 0, 1, 0, false, [spec], {}]);
    return JSON.stringify(d);
  }
  d.data[2] = [
    [0, 0, 1, 0, false, [['DisplayPort-2', 'GSM', 'LG ULTRAGEAR', 'SERIAL-0']], {}],
    [1920, 0, 1, 0, true, [spec], {}],
    [2560, 0, 1, 0, false, [['HDMI-A-0', 'GSM', '0x4b6f', 'SERIAL-1']], {}],
  ];
  return JSON.stringify(d);
}

function world(options: WorldOptions = {}) {
  const o: Required<WorldOptions> = { edidSupported: true, phoneModeAppears: true, gnomeGetsItRight: false, ...options };
  let phase: Phase = 'idle';
  let serial = 113;
  const calls: string[] = [];
  const helperCalls: [string, ConnectorAction, boolean][] = [];
  const edids: Uint8Array[] = [];
  let forced: string[] = [];

  const run: Runner = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    const ok = (stdout = '') => ({ stdout, stderr: '' });
    if (cmd === 'busctl' && args.includes('GetCurrentState')) return ok(mutterJson(phase, serial, o));
    if (cmd === 'busctl') return ok();
    if (cmd === 'xrandr' && args[0] === '--prop') return ok(fixture('xrandr-prop.txt'));
    if (cmd === 'xrandr' && args[0] === '--query') return ok(fixture('xrandr-zorin-2monitores.txt'));
    if (cmd === 'xrandr' && args[0] === '--addmode' && phase === 'forced') phase = 'moded';
    if (cmd === 'cvt') return ok(CVT_1080x2400);
    return ok();
  };
  const helper = async (connector: string, action: ConnectorAction, edid?: Uint8Array) => {
    helperCalls.push([connector, action, edid !== undefined]);
    if (edid) {
      if (!o.edidSupported) throw new CommandError('pkexec', [], 'EDID indisponível', HELPER_NO_EDID);
      edids.push(edid);
    }
    // com EDID a resolução já vem pronta; sem ele, o X perde o modo pré-criado ao ligar a saída
    phase = action === 'detect' ? 'idle' : edid ? 'moded' : 'forced';
    serial++;
  };
  const store: ForcedStore = { read: async () => forced, write: async (c) => void (forced = c) };
  let saved: ExtendSession | null = null;
  const session: SessionStore = { read: async () => saved, write: async (x) => void (saved = x) };
  const opts = { run, helper, store, session, drmConnectors: KERNEL, sleep: async () => {}, timeoutMs: 1000 };
  return {
    opts, calls, helperCalls, edids,
    forced: () => forced,
    setForced: (c: string[]) => void (forced = c),
    session: () => saved,
  };
}

const applyCall = (calls: string[]) => calls.find((c) => c.includes('ApplyMonitorsConfig'));

// ── caminho normal: com EDID ────────────────────────────────────────────────
test('com EDID: um pedido de senha, sem xrandr --newmode, e desfaz o rearranjo do GNOME', async () => {
  const w = world();
  const r = await extendDesktop(PHONE, w.opts);

  assert.equal(r.edid, true);
  assert.equal(r.mode, null);
  assert.equal(r.applied, true);
  assert.deepEqual(w.helperCalls, [['card1-DP-1', 'on', true]]);
  assert.ok(isValidEdid(w.edids[0]));
  assert.ok(!w.calls.some((c) => c.startsWith('xrandr --newmode') || c.startsWith('xrandr --addmode')));
  assert.deepEqual(w.forced(), ['card1-DP-1']);
  // posições e principal de ANTES (não as do rearranjo), serial atual, temporário
  assert.match(applyCall(w.calls)!, / 114 1 3 1440 0 1 0 true 1 DisplayPort-2 1920x1080@179\.998 0 0 0 1 0 false 1 HDMI-A-0 1440x900@59\.887 0 3360 0 1 0 false 1 DisplayPort-0 1080x2400@59\.970 0 0$/);
  assert.equal(applyCall(w.calls)!.match(/ true /g)?.length, 1);
});

test('sonda o X uma vez depois de ligar a saída (e não em loop)', async () => {
  const w = world();
  await extendDesktop(PHONE, w.opts);
  const afterCvt = w.calls.slice(w.calls.findIndex((c) => c.startsWith('cvt')) + 1);
  assert.equal(afterCvt.find((c) => c.startsWith('xrandr')), 'xrandr --query');
  assert.equal(afterCvt.filter((c) => c === 'xrandr --query').length, 1);
});

test('se o GNOME já pôs o celular no lugar certo, não reconfigura (uma piscada só)', async () => {
  const w = world({ gnomeGetsItRight: true });
  const r = await extendDesktop(PHONE, w.opts);
  assert.equal(r.applied, false);
  assert.equal(applyCall(w.calls), undefined);
});

test('--remember aplica como permanente; sem ele, temporário', async () => {
  const w = world();
  await extendDesktop(PHONE, { ...w.opts, remember: true });
  assert.match(applyCall(w.calls)!, /a\{sv\} \d+ 2 3 /);
  const t = world();
  await extendDesktop(PHONE, t.opts);
  assert.match(applyCall(t.calls)!, /a\{sv\} \d+ 1 3 /);
});

test('celular entre os monitores: o principal se afasta', async () => {
  const w = world();
  const r = await extendDesktop(PHONE, { ...w.opts, placement: { anchor: 'HDMI-A-0', side: 'right', align: 'start' } });
  assert.deepEqual(r.layout['DisplayPort-2'], { x: 2520, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(r.layout['DisplayPort-0'], { x: 1440, y: 0, width: 1080, height: 2400 });
});

// ── reserva: PC sem EDID (sem debugfs) ──────────────────────────────────────
test('sem EDID: cria o modo pelo xrandr ANTES de ligar e associa de novo se o X o perder', async () => {
  const w = world({ edidSupported: false });
  const r = await extendDesktop(PHONE, w.opts);
  assert.equal(r.edid, false);
  assert.equal(r.mode, 'OA_1080x2400_60');
  assert.deepEqual(w.helperCalls, [['card1-DP-1', 'on', true], ['card1-DP-1', 'on', false]]);
  assert.equal(w.calls.filter((c) => c === 'xrandr --addmode DisplayPort-0 OA_1080x2400_60').length, 2);
  assert.ok(applyCall(w.calls));
});

// ── falhas ──────────────────────────────────────────────────────────────────
test('posição impossível falha ANTES de mexer no sistema', async () => {
  const w = world();
  await assert.rejects(extendDesktop(PHONE, { ...w.opts, placement: { anchor: 'DP-9' } }), /não encontrado/);
  assert.deepEqual(w.helperCalls, []);
});

test('se o GNOME não aceitar o modo, devolve a saída ao automático', async () => {
  const w = world({ phoneModeAppears: false });
  await assert.rejects(extendDesktop(PHONE, w.opts), /aceitar o modo 1080x2400/);
  assert.deepEqual(w.helperCalls.map(([c, a]) => [c, a]), [['card1-DP-1', 'on'], ['card1-DP-1', 'detect']]);
  assert.deepEqual(w.forced(), []);
  assert.equal(applyCall(w.calls), undefined);
});

test('desfaz o que ficou forçado por uma sessão que caiu', async () => {
  const w = world();
  w.setForced(['card1-DP-1']);
  const r = await retractDesktop(w.opts);
  assert.deepEqual(r.released, ['card1-DP-1']);
  assert.deepEqual(w.helperCalls, [['card1-DP-1', 'detect', false]]);
  assert.deepEqual(w.forced(), []);
});

test('pkexec: tempo para digitar a senha, EDID pela entrada padrão, nome validado', async () => {
  const seen: { args: readonly string[]; timeoutMs?: number; input?: Uint8Array }[] = [];
  const run: Runner = async (_cmd, args, options) => {
    seen.push({ args, timeoutMs: options?.timeoutMs, input: options?.input });
    return { stdout: '', stderr: '' };
  };
  const edid = new Uint8Array(128);
  await pkexecHelper(run, '/x/openalt-helper')('card1-DP-1', 'on', edid);
  assert.deepEqual(seen[0].args, ['/x/openalt-helper', 'connector', 'card1-DP-1', 'on', '--edid-stdin']);
  assert.equal(seen[0].input, edid);
  assert.ok((seen[0].timeoutMs ?? 0) >= 60_000);
  await pkexecHelper(run, '/x/openalt-helper')('card1-DP-1', 'detect');
  assert.deepEqual(seen[1].args, ['/x/openalt-helper', 'connector', 'card1-DP-1', 'detect']);
  await assert.rejects(pkexecHelper(run, '/x/openalt-helper')('../etc', 'on'), /inválido/);
});

// ── mudar de lugar com a "Nova tela" ligada (sem senha) ─────────────────────
test('move: troca de posição só pelo GNOME, sempre a partir do arranjo original', async () => {
  const w = world({ gnomeGetsItRight: true });
  await extendDesktop(PHONE, w.opts);
  assert.equal(w.session()?.connector, 'card1-DP-1');
  const helperBefore = w.helperCalls.length;

  // entre os monitores: o principal se afasta
  const entre = await moveDesktop({ anchor: 'HDMI-A-0', side: 'right' }, w.opts);
  assert.equal(entre.applied, true);
  assert.deepEqual(entre.layout['DisplayPort-2'], { x: 2520, y: 0, width: 1920, height: 1080 });
  assert.match(applyCall(w.calls)!, / 1 3 2520 0 1 0 true 1 DisplayPort-2 1920x1080@179\.998 0 /);

  // abaixo do secundário: calculado do original (o principal volta para x=1440)
  const abaixo = await moveDesktop({ anchor: 'HDMI-A-0', side: 'below', align: 'end' }, w.opts);
  assert.deepEqual(abaixo.layout['DisplayPort-2'], { x: 1440, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(abaixo.layout['DisplayPort-0'], { x: 360, y: 900, width: 1080, height: 2400 });

  // nenhuma senha a mais
  assert.equal(w.helperCalls.length, helperBefore);
});

test('move: na posição em que já está, não reconfigura', async () => {
  const w = world({ gnomeGetsItRight: true });
  await extendDesktop(PHONE, w.opts);
  const r = await moveDesktop({}, w.opts); // padrão: à direita do principal
  assert.equal(r.applied, false);
  assert.equal(applyCall(w.calls), undefined);
});

test('move: sem "Nova tela" ligada, ou posição impossível, falha sem mexer em nada', async () => {
  const w = world({ gnomeGetsItRight: true });
  await assert.rejects(moveDesktop({ side: 'left' }, w.opts), /não está ligada/);
  await extendDesktop(PHONE, w.opts);
  await assert.rejects(moveDesktop({ anchor: 'DP-9' }, w.opts), /não encontrado/);
  assert.equal(applyCall(w.calls), undefined);
});

test('desligar apaga a sessão', async () => {
  const w = world({ gnomeGetsItRight: true });
  await extendDesktop(PHONE, w.opts);
  await retractDesktop(w.opts);
  assert.equal(w.session(), null);
});

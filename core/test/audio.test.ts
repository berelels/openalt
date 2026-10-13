import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioRouter, realSink, streamsAudio, sunshineSink } from '../src/audio.ts';
import type { Runner } from '../src/proc.ts';

const FONE = 'bluez_output.08_91_A3_4A_31_D8.1';
const CAIXA = 'alsa_output.pci-0000_0a_00.6.analog-stereo';
const SUN = 'sink-sunshine-stereo';

/** Um PipeWire/Pulse de mentira: saídas, saída padrão e módulos carregados. */
function fakePulse(def = FONE, sinks = [FONE, CAIXA]) {
  const p = { def, sinks: [...sinks], modules: new Map<string, string>(), next: 536870913, calls: [] as string[] };
  const run: Runner = async (cmd, args) => {
    p.calls.push([cmd, ...args].join(' '));
    const out = (stdout: string) => ({ stdout, stderr: '' });
    switch (args[0]) {
      case 'get-default-sink': return out(`${p.def}\n`);
      case 'set-default-sink': p.def = args[1]!; return out('');
      case 'list': return args[2] === 'sinks'
        ? out(p.sinks.map((s, i) => `${50 + i}\t${s}\tPipeWire\ts16le 2ch 48000Hz\tRUNNING`).join('\n'))
        : out([...p.modules].map(([id, a]) => `${id}\tmodule-loopback\t${a}`).join('\n'));
      case 'load-module': { const id = String(p.next++); p.modules.set(id, args.slice(2).join(' ')); return out(`${id}\n`); }
      case 'unload-module': p.modules.delete(args[1]!); return out('');
    }
    return out('');
  };
  /** o que o Sunshine faz ~0,5 s depois de o aparelho conectar */
  const sunshineConnects = () => { if (!p.sinks.includes(SUN)) p.sinks.push(SUN); p.def = SUN; };
  return { p, run, sunshineConnects };
}

test('"pc": mesmo se o Sunshine trocar a saída DEPOIS (a corrida de 13/10), o som volta para o PC', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(await realSink(run), run);
  await r.tick('pc', true); // conectou; o Sunshine ainda não trocou
  assert.equal(p.def, FONE);
  sunshineConnects();
  await r.tick('pc', true);
  assert.equal(p.def, FONE);
  assert.equal(p.modules.size, 0);
});

test('"pc": se a pessoa troca o fone pela caixa no GNOME, a caixa passa a ser a do PC', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(FONE, run);
  p.def = CAIXA;
  await r.tick('pc', true);
  sunshineConnects();
  await r.tick('pc', true);
  assert.equal(p.def, CAIXA);
});

test('"os dois": espera a saída do Sunshine e liga UMA cópia dela para a saída real', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(FONE, run);
  await r.tick('both', true); // a do Sunshine ainda não existe: nada a fazer
  assert.equal(p.modules.size, 0);
  sunshineConnects();
  await r.tick('both', true);
  await r.tick('both', true);
  assert.equal(p.def, SUN);
  assert.deepEqual([...p.modules.values()], [`source=${SUN}.monitor sink=${FONE} latency_msec=40`]);
  // alguém descarregou o módulo: o próximo tick religa
  p.modules.clear();
  await r.tick('both', true);
  assert.equal(p.modules.size, 1);
  // desconectou: a cópia some
  await r.tick('both', false);
  assert.equal(p.modules.size, 0);
});

test('trocar com o aparelho conectado vale na hora: pc → aparelho → os dois → pc', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(FONE, run);
  sunshineConnects();
  await r.tick('pc', true);
  assert.equal(p.def, FONE);
  await r.tick('device', true);
  assert.equal(p.def, SUN);
  assert.equal(p.modules.size, 0);
  await r.tick('both', true);
  assert.equal(p.modules.size, 1);
  await r.tick('pc', true);
  assert.equal(p.def, FONE);
  assert.equal(p.modules.size, 0);
});

test('"aparelho": não briga com a pessoa se ela escolher outra saída no GNOME depois', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(FONE, run);
  sunshineConnects();
  await r.tick('device', true);
  p.def = CAIXA;
  await r.tick('device', true);
  assert.equal(p.def, CAIXA);
});

test('ao desligar: a cópia some e a saída padrão volta para a do PC', async () => {
  const { p, run, sunshineConnects } = fakePulse();
  const r = new AudioRouter(FONE, run);
  sunshineConnects();
  await r.tick('both', true);
  await r.stop();
  assert.equal(p.def, FONE);
  assert.equal(p.modules.size, 0);
});

test('app aberto com a saída do Sunshine como padrão (sobra de uma queda): usa a 1ª saída real', async () => {
  const { p, run } = fakePulse(SUN, [SUN, CAIXA]);
  const r = new AudioRouter(await realSink(run), run);
  assert.equal(r.pcSink, null);
  await r.tick('pc', true);
  assert.equal(p.def, CAIXA);
});

test('nomes estranhos de saída são ignorados; estéreo é a preferida; só o "pc" não transmite', async () => {
  const { run } = fakePulse(FONE, [FONE, 'sink-sunshine-surround51', SUN, 'x; rm -rf /']);
  assert.equal(await sunshineSink(run), SUN);
  assert.equal(new AudioRouter('x; rm -rf /', run).pcSink, null);
  assert.equal(new AudioRouter(SUN, run).pcSink, null);
  assert.equal(streamsAudio('pc'), false);
  assert.equal(streamsAudio('device'), true);
  assert.equal(streamsAudio('both'), true);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { realSink, startHostEcho, stopHostEcho } from '../src/audio.ts';
import type { Runner } from '../src/proc.ts';

test('"nos dois": espera a saída do Sunshine e liga a cópia para a saída real do PC', async () => {
  let def = 'bluez_output.08_91_A3_4A_31_D8.1';
  let polls = 0;
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (args[0] === 'get-default-sink') { if (++polls === 3) def = 'sink-sunshine-stereo'; return { stdout: `${def}\n`, stderr: '' }; }
    if (args[0] === 'load-module') return { stdout: '536870913\n', stderr: '' };
    return { stdout: '', stderr: '' };
  };
  assert.equal(await realSink(run), 'bluez_output.08_91_A3_4A_31_D8.1');
  const id = await startHostEcho('bluez_output.08_91_A3_4A_31_D8.1', { run, sleep: async () => {} });
  assert.equal(id, '536870913');
  assert.ok(calls.includes('pactl load-module module-loopback source=sink-sunshine-stereo.monitor sink=bluez_output.08_91_A3_4A_31_D8.1 latency_msec=40'));
  await stopHostEcho(id, run);
  assert.equal(calls.at(-1), 'pactl unload-module 536870913');
});

test('sem a troca do Sunshine (ou saída estranha), não liga nada', async () => {
  const run: Runner = async () => ({ stdout: 'alsa_output.pci\n', stderr: '' });
  assert.equal(await startHostEcho('alsa_output.pci', { run, timeoutMs: 5, sleep: async () => {} }), null);
  assert.equal(await startHostEcho('x; rm -rf /', { run }), null);
  assert.equal(await realSink(async () => ({ stdout: 'sink-sunshine-stereo\n', stderr: '' })), null);
});

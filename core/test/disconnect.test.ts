// Desconectar sem pedir senha (o aparelho saiu; a pessoa pode estar longe do PC).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { helperAuthorized, retractOnDisconnect, DEFAULT_HELPER, HELPER_ACTION, type ForcedStore, type SessionStore } from '../src/linux-x11/extend.ts';
import { buildRestoreArgs, parseMutterState } from '../src/linux-x11/mutter.ts';
import { CommandError, type Runner } from '../src/proc.ts';

const before = parseMutterState(readFileSync(new URL('fixtures/mutter-2monitores.json', import.meta.url), 'utf8'));

test('helperAuthorized: só o ajudante instalado, e só se o polkit liberar sem senha', async () => {
  const calls: string[] = [];
  const ok: Runner = async (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { stdout: '', stderr: '' }; };
  const no: Runner = async (cmd, args) => { throw new CommandError(cmd, args, 'not authorized', 1); };
  assert.equal(await helperAuthorized(ok, '/home/x/projeto/core/helper/openalt-helper'), false);
  assert.deepEqual(calls, [], 'ajudante fora do lugar instalado: nem consulta o polkit');
  assert.equal(await helperAuthorized(ok, DEFAULT_HELPER, 42), true);
  assert.deepEqual(calls, [`pkcheck --action-id ${HELPER_ACTION} --process 42`]);
  assert.equal(await helperAuthorized(no, DEFAULT_HELPER, 42), false);
});

test('buildRestoreArgs: volta só os monitores de antes, temporário', () => {
  const args = buildRestoreArgs({ ...before, serial: 200 }, before);
  assert.equal(args[5], 'ApplyMonitorsConfig');
  assert.equal(args[7], '200');
  assert.equal(args[8], '1', 'temporário');
  assert.equal(args[9], String(before.logical.length));
  assert.ok(!args.includes('OAL'));
});

test('retractOnDisconnect sem permissão: nenhum pkexec, tira a tela pelo GNOME e deixa a saída anotada', async () => {
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => {
    calls.push(cmd);
    if (cmd === 'gdbus' || cmd === 'busctl') {
      if (args.includes('GetCurrentState')) return { stdout: '', stderr: '' };
    }
    return { stdout: '', stderr: '' };
  };
  let forced = ['card1-DP-2'];
  let sess: unknown = { output: 'DisplayPort-1', connector: 'card1-DP-2', before };
  const store: ForcedStore = { read: async () => forced, write: async (v) => { forced = v; } };
  const session = { read: async () => sess, write: async (v: unknown) => { sess = v; } } as unknown as SessionStore;
  let helperCalls = 0;
  const helper = async () => { helperCalls++; };
  // getMutterState lê pelo run; aqui basta que o caminho sem senha não chame o ajudante
  const r = await retractOnDisconnect({ run, store, session, helper, authorized: false }).catch((e) => e);
  assert.equal(helperCalls, 0, 'nunca chama o ajudante (pkexec) sem permissão');
  assert.deepEqual(forced, ['card1-DP-2'], 'a saída continua anotada para o Desligar');
  assert.ok(!calls.includes('pkexec'));
  void r;
});

test('retractOnDisconnect com permissão: desfaz tudo pelo ajudante', async () => {
  let forced = ['card1-DP-2'];
  const store: ForcedStore = { read: async () => forced, write: async (v) => { forced = v; } };
  const session = { read: async () => null, write: async () => {} } as unknown as SessionStore;
  const helperCalls: string[] = [];
  // o GNOME sem o monitor do OpenAlt (o mesmo arranjo de 2 monitores dos outros testes)
  const json = readFileSync(new URL('fixtures/mutter-2monitores.json', import.meta.url), 'utf8');
  const run: Runner = async (_cmd, args) => ({ stdout: args.some((a) => /GetCurrentState/.test(a)) ? json : '', stderr: '' });
  const r = await retractOnDisconnect({ run, store, session, helper: async (c, a) => { helperCalls.push(`${c} ${a}`); }, authorized: true, timeoutMs: 10, sleep: async () => {} });
  assert.deepEqual(helperCalls, ['card1-DP-2 detect']);
  assert.deepEqual(forced, []);
  assert.equal(r.pending, false);
});

import assert from 'node:assert/strict';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { certFingerprint, deviceNameFor, friendlyName, localAddresses, matchPending, newPairing, qrSvg } from '../src/pairing.ts';
import { DEFAULT_SETTINGS, readSettings, sanitizeSettings, writeSettings } from '../src/settings.ts';
import { sunshineApi, type Transport } from '../src/sunshine/api.ts';
import { pidsWithArg, portInUse } from '../src/sunshine/process.ts';
import {
  appsJson,
  credentialsState,
  prepScript,
  readPairedDevices,
  sunshineConf,
  sunshinePasswordHash,
  writeSunshineSetup,
} from '../src/sunshine/setup.ts';

const fixture = (name: string) => readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
// pasta temporária DENTRO do projeto (regra: nada fora da pasta do projeto)
const TMP = new URL('.tmp/', import.meta.url).pathname;
after(() => rm(TMP, { recursive: true, force: true }));

// ── credenciais do Sunshine ─────────────────────────────────────────────────
test('hash da senha igual ao do Sunshine (vetor calculado à parte, em Python)', () => {
  assert.equal(sunshinePasswordHash('senha-de-teste', 'SALTsalt12345678'), '116B067E15CB532DC5FBC4DF1CB64094C505E7FCF4F5131A9AF6F8809AE15E37');
});

test('estado inicial do Sunshine leva só usuário, salt e hash (nunca a senha)', () => {
  const st = JSON.parse(credentialsState({ username: 'openalt', password: 'segredo123' }, 'abcdefghABCDEFGH'));
  assert.deepEqual(Object.keys(st), ['username', 'salt', 'password']);
  assert.equal(st.password, sunshinePasswordHash('segredo123', 'abcdefghABCDEFGH'));
  assert.ok(!JSON.stringify(st).includes('segredo123'));
});

// ── configuração própria ────────────────────────────────────────────────────
test('sunshine.conf aponta tudo para a pasta do OpenAlt e fecha a interface web no PC', () => {
  const conf = sunshineConf({ dir: '/c/openalt/sunshine', outputIndex: 0, name: 'meu-pc; rm -rf /' });
  for (const line of ['origin_web_ui_allowed = pc', 'capture = x11', 'output_name = 0',
    'file_apps = /c/openalt/sunshine/apps.json', 'credentials_file = /c/openalt/sunshine/sunshine_state.json',
    'cert = /c/openalt/sunshine/credentials/cacert.pem']) assert.ok(conf.includes(line), line);
  assert.ok(conf.includes('sunshine_name = meu-pc rm -rf ')); // sem ; nem /
  assert.throws(() => sunshineConf({ dir: '/c', outputIndex: -1, name: 'x' }), RangeError);
});

test('apps.json: um item só ("OpenAlt"), que segue o modo do app e desliga no fim', () => {
  const apps = JSON.parse(appsJson('/d/openalt-prep')).apps;
  assert.deepEqual(apps.map((a: { name: string }) => a.name), ['OpenAlt']);
  assert.deepEqual(apps[0]['prep-cmd'], [{ do: '/d/openalt-prep auto', undo: '/d/openalt-prep down' }]);
});

test('ponte prep: valores do aparelho sempre entre aspas e caminhos citados', () => {
  const sh = prepScript({ runner: '/usr/bin/node', runnerArgs: ["/x/cli's.ts"], env: { OPENALT_CONFIG_DIR: '/c/o a' } });
  assert.match(sh, /--env=SUNSHINE_CLIENT_NAME="\$\{SUNSHINE_CLIENT_NAME:-\}"/);
  assert.match(sh, /--env=OPENALT_CONFIG_DIR='\/c\/o a'/);
  assert.ok(sh.includes(`'/x/cli'\\''s.ts'`));
  assert.throws(() => prepScript({ runner: 'n', runnerArgs: [], env: { 'X;rm': '1' } }), /variável inválida/);
});

test('escreve a configuração própria com permissões fechadas e não recria credenciais', async () => {
  const paths = { config: join(TMP, 'cfg'), data: join(TMP, 'data'), runtime: join(TMP, 'run') };
  const prep = { runner: '/usr/bin/node', runnerArgs: ['/x/cli.ts'], env: {} };
  const r1 = await writeSunshineSetup(paths, { outputIndex: 0, name: 'pc', prep });
  assert.equal(r1.createdCredentials, true);
  assert.equal((await stat(join(paths.config, 'credentials.json'))).mode & 0o777, 0o600);
  assert.equal((await stat(r1.dir)).mode & 0o777, 0o700);
  assert.equal((await stat(r1.prepPath)).mode & 0o777, 0o700);
  const c1 = await readFile(join(paths.config, 'credentials.json'), 'utf8');
  const r2 = await writeSunshineSetup(paths, { outputIndex: 1, name: 'pc', prep });
  assert.equal(r2.createdCredentials, false);
  assert.equal(await readFile(join(paths.config, 'credentials.json'), 'utf8'), c1);
  assert.match(await readFile(r2.confPath, 'utf8'), /output_name = 1/);
});

test('lista os aparelhos pareados pelo estado do Sunshine', async () => {
  const paths = { config: join(TMP, 'cfg2'), data: join(TMP, 'd2'), runtime: join(TMP, 'r2') };
  await mkdir(join(paths.config, 'sunshine'), { recursive: true });
  await writeFile(join(paths.config, 'sunshine', 'sunshine_state.json'), JSON.stringify({
    username: 'openalt', salt: 's', password: 'h',
    root: { uniqueid: 'u', named_devices: [{ name: 'OpenAlt-abc', cert: '…', uuid: 'U1', enabled: 'true' }, { name: 'velho', uuid: 'U2', enabled: 'false' }] },
  }));
  assert.deepEqual(await readPairedDevices(paths), [
    { uuid: 'U1', name: 'OpenAlt-abc', enabled: true },
    { uuid: 'U2', name: 'velho', enabled: false },
  ]);
  assert.deepEqual(await readPairedDevices({ ...paths, config: join(TMP, 'nada') }), []);
});

// ── configurações do app ────────────────────────────────────────────────────
test('configurações: o que é estranho volta ao padrão; grava 0600 e lê de volta', async () => {
  const s = sanitizeSettings({ mode: 'mirror', placement: { anchor: '../../etc', side: 'diagonal', align: 'center', offset: 1e9 }, orientation: 'landscape', previewKind: 'tablet', extra: 1 });
  assert.equal(s.mode, 'mirror');
  assert.deepEqual(s.placement, { anchor: 'primary', side: 'right', align: 'center', offset: 0 });
  assert.equal(s.orientation, 'landscape');
  const dir = join(TMP, 'set');
  await writeSettings(dir, s);
  assert.equal((await stat(join(dir, 'settings.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await readSettings(dir), s);
  assert.deepEqual(await readSettings(join(TMP, 'nenhum')), DEFAULT_SETTINGS);
});

// ── pareamento ──────────────────────────────────────────────────────────────
test('QR de pareamento: endereços, porta, impressão digital, PIN de 4 dígitos, validade', () => {
  const p = newPairing({ pcName: 'meu-pc', hosts: ['192.168.1.100', '100.64.1.2'], port: 47989, fingerprint: 'AB:CD', now: 1_000_000 });
  const u = new URL(p.uri);
  assert.equal(u.protocol, 'openalt:');
  assert.equal(u.searchParams.get('h'), '192.168.1.100,100.64.1.2');
  assert.equal(u.searchParams.get('fp'), 'abcd');
  assert.match(p.pin, /^\d{4}$/);
  assert.equal(u.searchParams.get('pin'), p.pin);
  assert.equal(u.searchParams.get('d'), p.id);
  assert.equal(p.expiresAt, 1_120_000);
  assert.throws(() => newPairing({ pcName: 'x', hosts: [], port: 1, fingerprint: 'a' }), /Nenhum endereço/);
});

test('só o pedido com o nome certo, dentro da validade e uma vez', () => {
  const p = newPairing({ pcName: 'pc', hosts: ['10.0.0.2'], port: 47989, fingerprint: 'aa', now: 0 });
  const pend = [
    { id: 'a'.repeat(32), name: 'intruso', address: '10.0.0.9' },
    { id: 'b'.repeat(32), name: deviceNameFor(p.id), address: '10.0.0.5' },
  ];
  assert.equal(matchPending(p, pend, 1000)?.id, 'b'.repeat(32));
  assert.equal(matchPending(p, pend, p.expiresAt), undefined); // venceu
  assert.equal(matchPending({ ...p, used: true }, pend, 1000), undefined); // já usado
  assert.equal(matchPending(p, [pend[0]], 1000), undefined); // só o intruso
  // com o modelo do aparelho no nome
  const comModelo = [{ id: 'c'.repeat(32), name: `${deviceNameFor(p.id)} Moto g84`, address: '10.0.0.5' }];
  assert.equal(matchPending(p, comModelo, 1000)?.id, 'c'.repeat(32));
  assert.equal(matchPending(p, [{ id: 'd'.repeat(32), name: `${deviceNameFor(p.id)}x`, address: '' }], 1000), undefined);
});

test('nome amigável: o modelo, sem símbolos estranhos', () => {
  assert.equal(friendlyName('OpenAlt-a1b2c3 Moto g84'), 'Moto g84');
  assert.equal(friendlyName('OpenAlt-a1b2c3 Galaxy Tab S9+ <script>'), 'Galaxy Tab S9+ script');
  assert.equal(friendlyName('OpenAlt-a1b2c3'), 'Aparelho');
});

test('QR em SVG e impressão digital de um certificado', async () => {
  const svg = await qrSvg('openalt://pair?v=1');
  assert.match(svg, /^<svg[^>]*viewBox/);
  assert.equal(certFingerprint(await fixture('cert-teste.pem')), '12c6aa73219da210519598acd82e3409b6e7294450a82260211e593575ee90fd');
});

test('endereços: ignora loopback, Docker e pontes; Tailscale por último', () => {
  const f = (address: string, internal = false) => ({ address, family: 'IPv4' as const, internal, netmask: '', mac: '', cidr: null });
  assert.deepEqual(localAddresses({
    lo: [f('127.0.0.1', true)], docker0: [f('172.17.0.1')], tailscale0: [f('100.101.2.3')], enp3s0: [f('192.168.1.100')],
  }), ['192.168.1.100', '100.101.2.3']);
});

// ── API do Sunshine ─────────────────────────────────────────────────────────
function fakeTransport(routes: Record<string, { status: number; body: unknown }>) {
  const seen: string[] = [];
  const t: Transport = async (method, path, body) => {
    seen.push(`${method} ${path} ${body ?? ''}`.trim());
    const r = routes[`${method} ${path}`] ?? { status: 404, body: {} };
    return { status: r.status, body: JSON.stringify(r.body) };
  };
  return { t, seen };
}

test('API: lista pedidos válidos, envia PIN amarrado ao pedido, entende 401/403', async () => {
  const id = 'd67b495a151e9af26c317e4f8e963ef4';
  const { t, seen } = fakeTransport({
    'GET /api/pin': { status: 200, body: { pairings: [{ id, name: 'OpenAlt-1', address: '10.0.0.5' }, { id: 'curto', name: 'x' }] } },
    'POST /api/pin': { status: 200, body: { status: true } },
  });
  const api = sunshineApi(t);
  assert.deepEqual(await api.pendingPairings(), [{ id, name: 'OpenAlt-1', address: '10.0.0.5' }]);
  assert.equal(await api.submitPin(id, '0420', 'OpenAlt-1'), true);
  assert.equal(seen.at(-1), `POST /api/pin {"pairing_id":"${id}","pin":"0420","name":"OpenAlt-1"}`);
  await assert.rejects(api.submitPin('x', '0420', 'n'), /inválido/);
  await assert.rejects(sunshineApi(fakeTransport({ 'GET /api/pin': { status: 401, body: {} } }).t).pendingPairings(), /credenciais/);
  await assert.rejects(sunshineApi(fakeTransport({ 'GET /api/pin': { status: 403, body: {} } }).t).pendingPairings(), /só pelo próprio PC/);
});

// ── processo ────────────────────────────────────────────────────────────────
test('acha só os processos com o caminho exato da nossa configuração', async () => {
  const proc = join(TMP, 'proc');
  const mk = async (pid: string, args: string[]) => { await mkdir(join(proc, pid), { recursive: true }); await writeFile(join(proc, pid, 'cmdline'), args.join('\0')); };
  await mk('101', ['sunshine', '/c/openalt/sunshine/sunshine.conf']);
  await mk('102', ['sunshine']); // o Sunshine da pessoa
  await mk('103', ['sunshine', '/c/openalt/sunshine/sunshine.conf.bak']);
  await mkdir(join(proc, 'self'), { recursive: true });
  assert.deepEqual(await pidsWithArg('/c/openalt/sunshine/sunshine.conf', proc), [101]);
});

test('detecta porta ocupada', async () => {
  const srv = createServer().listen(0, '127.0.0.1');
  await new Promise((r) => srv.once('listening', r));
  const port = (srv.address() as { port: number }).port;
  assert.equal(await portInUse(port), true);
  srv.close();
  await new Promise((r) => srv.once('close', r));
  assert.equal(await portInUse(port), false);
});

test('conexão atual: grava 0600, limpa nome vindo de fora, lê e apaga', async () => {
  const { writeConnection, readConnection, clearConnection } = await import('../src/connection.ts');
  const dir = join(TMP, 'conn');
  await writeConnection(dir, { name: 'Moto g84 <b>"', width: 1080, height: 2400, fps: 60, mode: 'extend', since: 1 });
  assert.equal((await stat(join(dir, 'connection.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await readConnection(dir), { name: 'Moto g84 b', width: 1080, height: 2400, fps: 60, mode: 'extend', since: 1 });
  await clearConnection(dir);
  assert.equal(await readConnection(dir), null);
});

test('Sunshine nativo: captura KMS pelo nome do conector; nomes estranhos são recusados', () => {
  const conf = sunshineConf({ dir: '/c', outputIndex: 0, name: 'pc', kmsConnector: 'DP-1' });
  assert.match(conf, /^capture = kms$/m);
  assert.match(conf, /^output_name = DP-1$/m);
  assert.match(sunshineConf({ dir: '/c', outputIndex: 2, name: 'pc', kmsConnector: 'HDMI-A-1' }), /^output_name = HDMI-A-1$/m);
  assert.match(sunshineConf({ dir: '/c', outputIndex: 2, name: 'pc' }), /^capture = x11\noutput_name = 2$/m);
  assert.throws(() => sunshineConf({ dir: '/c', outputIndex: 0, name: 'pc', kmsConnector: 'DP-1\nfile_apps = /x' }), RangeError);
});

test('captura X11: output_name pelo nome da saída (o Sunshine atual procura pelo nome)', () => {
  assert.match(sunshineConf({ dir: '/c', outputIndex: 1, name: 'pc', outputName: 'DisplayPort-1' }), /^output_name = DisplayPort-1$/m);
  assert.throws(() => sunshineConf({ dir: '/c', outputIndex: 1, name: 'pc', outputName: 'DP-1\nfile_apps = /x' }), RangeError);
});

test('o Sunshine não decodifica o nome do pedido: "%20" também casa, e o nome amigável sai limpo', async () => {
  const { newPairing, matchPending, friendlyName } = await import('../src/pairing.ts');
  const p = newPairing({ pcName: 'pc', hosts: ['192.168.1.100'], port: 47989, fingerprint: 'aa'.repeat(32), now: 0 });
  const pending = [{ id: 'x', name: `OpenAlt-${p.id}%20SM-P619`, address: '192.168.1.12' }];
  assert.equal(matchPending(p, pending, 1)?.id, 'x');
  assert.equal(friendlyName(pending[0].name), 'SM-P619');
  assert.equal(matchPending(p, [{ id: 'y', name: `OpenAlt-${p.id}x%20SM`, address: '' }], 1), undefined);
});

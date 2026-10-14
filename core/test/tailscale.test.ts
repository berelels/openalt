import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authUrlFrom, isTailscaleIPv4, mobilePeers, parseStatus, signInCommands, tailscaleStatus } from '../src/tailscale.ts';
import { CommandError, type Runner } from '../src/proc.ts';

const running = JSON.stringify({
  BackendState: 'Running',
  AuthURL: 'https://login.tailscale.com/a/segredo',
  Self: { HostName: 'pc', OS: 'linux', TailscaleIPs: ['100.101.102.103', 'fd7a:115c:a1e0::1'] },
  Peer: {
    k1: { HostName: 'tablet', OS: 'android', Online: true, Active: true, TailscaleIPs: ['fd7a::2', '100.64.0.2'], CurAddr: '192.168.0.20:41641', Relay: 'gru' },
    k2: { HostName: 'iphone', OS: 'iOS', Online: false, TailscaleIPs: ['100.64.0.3'], CurAddr: '', Relay: 'gru' },
    k3: { HostName: 'celular-4g', OS: 'android', Online: true, Active: true, TailscaleIPs: ['100.64.0.4'], CurAddr: '', Relay: 'gru' },
    k4: { DNSName: 'servidor.tail1234.ts.net.', OS: 'linux', Online: true, TailscaleIPs: [] },
  },
});

test('Running: IP do PC, aparelhos, direta × relay', () => {
  const s = parseStatus(running);
  assert.equal(s.state, 'running');
  assert.equal(s.ip, '100.101.102.103');
  assert.equal(s.peers.length, 4);
  const by = Object.fromEntries(s.peers.map((p) => [p.name, p]));
  assert.deepEqual(by.tablet, { name: 'tablet', os: 'android', online: true, ip: '100.64.0.2', path: 'direct' });
  assert.equal(by['celular-4g']!.path, 'relay');
  assert.equal(by.iphone!.path, null);
  assert.equal(by.servidor!.ip, null);
  assert.deepEqual(mobilePeers(s).map((p) => p.name), ['tablet', 'celular-4g', 'iphone']);
  assert.doesNotMatch(JSON.stringify(s), /segredo|login\.tailscale/);
});

test('NeedsLogin, Stopped e JSON inválido', () => {
  assert.deepEqual(parseStatus(JSON.stringify({ BackendState: 'NeedsLogin', Self: { TailscaleIPs: null }, Peer: null })),
    { state: 'needs-login', ip: null, peers: [] });
  assert.equal(parseStatus(JSON.stringify({ BackendState: 'Stopped' })).state, 'stopped');
  assert.equal(parseStatus('não é json').state, 'unknown');
  assert.equal(parseStatus('null').state, 'unknown');
});

test('tailscaleStatus: sem o programa, serviço parado, sucesso', async () => {
  const fail = (stderr: string): Runner => async (cmd, args) => { throw new CommandError(cmd, args, stderr); };
  assert.equal((await tailscaleStatus(fail('spawn tailscale ENOENT'))).state, 'missing');
  assert.equal((await tailscaleStatus(fail("failed to connect to local tailscaled; it doesn't appear to be running"))).state, 'stopped');
  const calls: string[] = [];
  const ok: Runner = async (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { stdout: running, stderr: '' }; };
  assert.equal((await tailscaleStatus(ok)).state, 'running');
  assert.deepEqual(calls, ['tailscale status --json']);
});

test('isTailscaleIPv4: só 100.64.0.0/10', () => {
  for (const a of ['100.64.0.1', '100.100.100.100', '100.127.255.254']) assert.ok(isTailscaleIPv4(a), a);
  for (const a of ['100.63.0.1', '100.128.0.1', '10.0.0.1', '192.168.0.2']) assert.ok(!isTailscaleIPv4(a), a);
});

test('authUrlFrom: só endereços https do Tailscale, já completos', () => {
  assert.equal(authUrlFrom('\nTo authenticate, visit:\n\n\thttps://login.tailscale.com/a/1a2b3c\n\n'), 'https://login.tailscale.com/a/1a2b3c');
  assert.equal(authUrlFrom('\thttps://login.tailscale.com/a/1a2'), null, 'pedaço ainda incompleto');
  assert.equal(authUrlFrom('visit http://login.tailscale.com/a/x\n'), null);
  assert.equal(authUrlFrom('visit https://login.tailscale.com.evil.example/a/x\n'), null);
  assert.equal(authUrlFrom('visit https://eviltailscale.com/a/x\n'), null);
  assert.equal(authUrlFrom('nada aqui\n'), null);
});

test('signInCommands: pkexec com argumentos em lista; usuário validado', () => {
  const up = (u: string) => ({ cmd: 'pkexec', args: ['tailscale', 'up', `--operator=${u}`] });
  assert.deepEqual(signInCommands('needs-login', 'berelels'), [up('berelels')]);
  assert.deepEqual(signInCommands('stopped', 'ana'), [{ cmd: 'pkexec', args: ['systemctl', 'enable', '--now', 'tailscaled'] }, up('ana')]);
  assert.deepEqual(signInCommands('running', 'ana'), []);
  assert.deepEqual(signInCommands('missing', 'ana'), []);
  assert.deepEqual(signInCommands('needs-login', 'x --reset'), []);
  assert.deepEqual(signInCommands('needs-login', '-rf'), []);
});

test('clientViaTailscale: conexão no Sunshine vinda de 100.64.0.0/10', async () => {
  const { clientViaTailscale } = await import('../src/tailscale.ts');
  const casa = '0 0 192.168.1.100:47984 192.168.1.50:51234\n0 0 192.168.1.100:40522 206.247.34.141:443';
  const fora = '0 0 100.101.102.103:47984 100.64.0.2:40001';
  const v6 = '0 0 [::ffff:100.101.102.103]:47984 [::ffff:100.64.0.2]:40001';
  const outraPorta = '0 0 100.101.102.103:22 100.64.0.2:40001';
  assert.equal(clientViaTailscale(casa), false);
  assert.equal(clientViaTailscale(fora), true);
  assert.equal(clientViaTailscale(v6), true);
  assert.equal(clientViaTailscale(outraPorta), false);
  assert.equal(clientViaTailscale(''), false);
});

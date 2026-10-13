import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isTailscaleIPv4, mobilePeers, parseStatus, tailscaleStatus } from '../src/tailscale.ts';
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

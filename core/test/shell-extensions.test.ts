import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { reloadMonitorSensitiveExtensions, restoreExtensions } from '../src/linux-x11/shell-extensions.ts';
import type { Runner } from '../src/proc.ts';

const fake = (enabled: string[], calls: string[]): Runner => async (cmd, args) => {
  calls.push([cmd, ...args].join(' '));
  return { stdout: args[0] === 'list' ? `${enabled.join('\n')}\n` : '', stderr: '' };
};

test('recarrega as extensões ligadas: desliga na ordem inversa e religa na ordem original', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oa-ext-'));
  const calls: string[] = [];
  const r = await reloadMonitorSensitiveExtensions({ run: fake(['dash-to-dock@micxgx.gmail.com', 'arcmenu@arcmenu.com', 'nome ruim;rm'], calls), runtimeDir: dir, sleep: async () => {} });
  assert.deepEqual(r, ['dash-to-dock@micxgx.gmail.com', 'arcmenu@arcmenu.com']);
  assert.deepEqual(calls.slice(1), [
    'gnome-extensions disable arcmenu@arcmenu.com', 'gnome-extensions disable dash-to-dock@micxgx.gmail.com',
    'gnome-extensions enable dash-to-dock@micxgx.gmail.com', 'gnome-extensions enable arcmenu@arcmenu.com',
  ]);
  const none: string[] = [];
  assert.deepEqual(await reloadMonitorSensitiveExtensions({ run: fake([], none), runtimeDir: dir, sleep: async () => {} }), []);
  assert.equal(none.length, 1);
});

test('se a recarga foi interrompida, religa ao abrir (e ignora nomes inválidos)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'oa-ext-'));
  await writeFile(join(dir, 'extensions-reloading.json'), '["arcmenu@arcmenu.com","x; rm -rf /"]');
  const calls: string[] = [];
  assert.deepEqual(await restoreExtensions({ run: fake([], calls), runtimeDir: dir }), ['arcmenu@arcmenu.com']);
  assert.deepEqual(calls, ['gnome-extensions enable arcmenu@arcmenu.com']);
  assert.deepEqual(await restoreExtensions({ run: fake([], []), runtimeDir: dir }), []);
});

test('reinicia o GNOME Shell só no X11 e só se o serviço existir', async () => {
  const { restartGnomeShell } = await import('../src/linux-x11/shell-extensions.ts');
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { stdout: 'active\n', stderr: '' }; };
  assert.equal(await restartGnomeShell(run, { XDG_SESSION_TYPE: 'wayland' }), false);
  assert.equal(calls.length, 0);
  assert.equal(await restartGnomeShell(run, { XDG_SESSION_TYPE: 'x11' }), true);
  assert.deepEqual(calls, ['systemctl --user is-active org.gnome.Shell@x11.service', 'systemctl --user restart org.gnome.Shell@x11.service']);
  const inactive: Runner = async () => ({ stdout: 'inactive\n', stderr: '' });
  assert.equal(await restartGnomeShell(inactive, { XDG_SESSION_TYPE: 'x11' }), false);
});

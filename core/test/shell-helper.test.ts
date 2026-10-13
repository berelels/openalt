import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { installShellHelper, parseStringList, restartShellViaHelper, SHELL_HELPER_UUID, shellExtensionsDir, shellHelperSource, shellHelperVersion } from '../src/linux-x11/shell-helper.ts';
import type { Runner } from '../src/proc.ts';

const TMP = new URL('.tmp/', import.meta.url).pathname;

/** GSettings + D-Bus de mentira. `loaded` = a extensão já está rodando no GNOME. */
function fakeGnome(g: Record<string, string>, loaded = false) {
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'gsettings' && args[0] === 'get') return { stdout: `${g[args[2]!] ?? ''}\n`, stderr: '' };
    if (cmd === 'gsettings' && args[0] === 'set') { g[args[2]!] = args[3]!; return { stdout: '', stderr: '' }; }
    if (cmd === 'gdbus' && !loaded) throw new Error('No such interface');
    if (cmd === 'gdbus' && args.includes('org.freedesktop.DBus.Properties.Get')) return { stdout: '(<uint32 1>,)\n', stderr: '' };
    if (cmd === 'gdbus') return { stdout: '(true,)\n', stderr: '' };
    return { stdout: '', stderr: '' };
  };
  return { g, run, calls };
}

const base = () => ({ 'enabled-extensions': "['arcmenu@arcmenu.com', 'dash-to-dock@micxgx.gmail.com']", 'disabled-extensions': '@as []', 'disable-user-extensions': 'false' });

test('lê a lista do GSettings e recusa o que não sabe regravar', () => {
  assert.deepEqual(parseStringList("['a@b', 'c.d@e']"), ['a@b', 'c.d@e']);
  assert.deepEqual(parseStringList('@as []'), []);
  assert.equal(parseStringList("['a', b]"), null);
  assert.equal(parseStringList(''), null);
  assert.equal(parseStringList("['it\\'s']"), null);
});

test('instala: copia a extensão, liga sem perder as da pessoa, e na 2ª vez não regrava nada', async () => {
  await mkdir(TMP, { recursive: true });
  const dir = await mkdtemp(join(TMP, 'ext-'));
  const { g, run, calls } = fakeGnome(base());
  assert.equal(await installShellHelper({ run, extensionsDir: dir }), 'pending-restart');
  assert.deepEqual((await readdir(join(dir, SHELL_HELPER_UUID))).sort(), ['extension.js', 'metadata.json']);
  assert.equal(g['enabled-extensions'], `['arcmenu@arcmenu.com', 'dash-to-dock@micxgx.gmail.com', '${SHELL_HELPER_UUID}']`);
  const sets = calls.filter((c) => c.startsWith('gsettings set')).length;
  assert.equal(await installShellHelper({ run, extensionsDir: dir }), 'pending-restart');
  assert.equal(calls.filter((c) => c.startsWith('gsettings set')).length, sets);
  // a versão nova do app substitui os arquivos
  await writeFile(join(dir, SHELL_HELPER_UUID, 'extension.js'), '// velha\n');
  await installShellHelper({ run, extensionsDir: dir });
  assert.equal(await readFile(join(dir, SHELL_HELPER_UUID, 'extension.js'), 'utf8'), await readFile(join(shellHelperSource(), 'extension.js'), 'utf8'));
});

test('respeita a pessoa: não liga se ela desligou a extensão ou todas as extensões', async () => {
  await mkdir(TMP, { recursive: true });
  const dir = await mkdtemp(join(TMP, 'ext-'));
  const off = fakeGnome({ ...base(), 'disabled-extensions': `['${SHELL_HELPER_UUID}']` });
  assert.equal(await installShellHelper({ run: off.run, extensionsDir: dir }), 'disabled-by-user');
  const all = fakeGnome({ ...base(), 'disable-user-extensions': 'true' });
  assert.equal(await installShellHelper({ run: all.run, extensionsDir: dir }), 'disabled-by-user');
  assert.ok(!off.calls.some((c) => c.startsWith('gsettings set')) && !all.calls.some((c) => c.startsWith('gsettings set')));
  const weird = fakeGnome({ ...base(), 'enabled-extensions': '' }); // sem GNOME
  assert.equal(await installShellHelper({ run: weird.run, extensionsDir: dir }), 'unavailable');
});

test('já carregada: não mexe em nada; reinício e versão pelo D-Bus', async () => {
  const { run, calls } = fakeGnome(base(), true);
  assert.equal(await installShellHelper({ run, extensionsDir: '/nao/existe' }), 'active');
  assert.ok(!calls.some((c) => c.startsWith('gsettings')));
  assert.equal(await shellHelperVersion(run), 1);
  assert.equal(await restartShellViaHelper(run), true);
  assert.equal(await restartShellViaHelper(fakeGnome(base()).run), false);
  assert.equal(await shellHelperVersion(fakeGnome(base()).run), 0);
});

test('pasta de extensões: XDG_DATA_HOME (absoluto) ou ~/.local/share; a fonte existe no projeto', async () => {
  assert.equal(shellExtensionsDir({ XDG_DATA_HOME: '/x/data' }, '/home/a'), '/x/data/gnome-shell/extensions');
  assert.equal(shellExtensionsDir({ XDG_DATA_HOME: 'relativo' }, '/home/a'), '/home/a/.local/share/gnome-shell/extensions');
  assert.equal(shellExtensionsDir({}, '/home/a'), '/home/a/.local/share/gnome-shell/extensions');
  const meta = JSON.parse(await readFile(join(shellHelperSource(), 'metadata.json'), 'utf8'));
  assert.equal(meta.uuid, SHELL_HELPER_UUID);
});

test('refreshBackgroundsViaHelper: chama só o método da extensão, sem reiniciar', async () => {
  const { refreshBackgroundsViaHelper } = await import('../src/linux-x11/shell-helper.ts');
  const calls: string[] = [];
  const ok = await refreshBackgroundsViaHelper(async (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { stdout: '()', stderr: '' }; });
  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /RefreshBackgrounds$/);
  assert.doesNotMatch(calls[0]!, /Restart/);
  assert.equal(await refreshBackgroundsViaHelper(async () => { throw new Error('sem extensão'); }), false);
});

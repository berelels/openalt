import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWmctrl, windowMaximizer, windowsInside } from '../src/linux-x11/windows.ts';
import type { Runner } from '../src/proc.ts';

const tablet = { x: 1736, y: 1080, width: 1600, height: 960 };

test('lê o wmctrl e acha só janelas normais dentro do aparelho', () => {
  const wins = parseWmctrl([
    '0x02a00003  0 1440 27   1920 1053 pc WhatsApp',
    '0x03000007 -1 0    0    3360 2040 pc Área de trabalho',
    '0x04000001  0 1900 1200 1200 700  pc Brave',
  ].join('\n'));
  assert.equal(wins.length, 3);
  assert.deepEqual(windowsInside(wins, tablet).map((w) => w.id), ['0x04000001']);
});

test('maximiza só a janela que ENTRA no aparelho, uma vez, e nunca diálogos', async () => {
  let list = '0x1  0 1900 1200 800 600 pc Já estava\n';
  const calls: string[] = [];
  const run: Runner = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '));
    if (cmd === 'wmctrl' && args[0] === '-lG') return { stdout: list, stderr: '' };
    if (cmd === 'xprop') return { stdout: args[1] === '0x3' ? '_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_DIALOG' : '_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_NORMAL', stderr: '' };
    return { stdout: '', stderr: '' };
  };
  const tick = windowMaximizer(run, () => tablet);
  assert.deepEqual(await tick(), []); // o que já estava lá fica como está
  list += '0x2  0 100 100 800 600 pc Fora\n0x3  0 2000 1300 400 300 pc Diálogo\n';
  assert.deepEqual(await tick(), []);
  list = list.replace('0x2  0 100 100', '0x2  0 2000 1300'); // a pessoa arrastou para o tablet
  assert.deepEqual(await tick(), ['0x2']);
  assert.deepEqual(await tick(), []); // não insiste se a pessoa desmaximizar
  assert.ok(!calls.some((c) => c.includes('-r 0x3')));
});

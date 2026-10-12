import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseCvt, parseXrandrQuery, rightEdge } from '../src/linux-x11/xrandr.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');

test('lê as saídas do PC do usuário (2 monitores + 2 saídas livres)', () => {
  const state = parseXrandrQuery(fixture('xrandr-zorin-2monitores.txt'));
  const byName = Object.fromEntries(state.outputs.map((o) => [o.name, o]));

  assert.deepEqual(Object.keys(byName), [
    'DisplayPort-0',
    'DisplayPort-1',
    'DisplayPort-2',
    'HDMI-A-0',
  ]);
  assert.equal(byName['DisplayPort-0'].connected, false);
  assert.equal(byName['DisplayPort-0'].geometry, null);
  assert.equal(byName['DisplayPort-2'].primary, true);
  assert.deepEqual(byName['DisplayPort-2'].geometry, { width: 1920, height: 1080, x: 1440, y: 0 });
  assert.deepEqual(byName['HDMI-A-0'].geometry, { width: 1440, height: 900, x: 0, y: 0 });
  assert.ok(byName['DisplayPort-2'].modes.some((m) => m.name === '1920x1080' && m.current));
  assert.deepEqual(state.detachedModes, []);
  assert.equal(rightEdge(state), 3360);
});

test('reconhece modo solto, modo associado e saída desconectada em uso', () => {
  const state = parseXrandrQuery(fixture('xrandr-com-monitor-virtual.txt'));
  const dp0 = state.outputs.find((o) => o.name === 'DisplayPort-0')!;
  const dp1 = state.outputs.find((o) => o.name === 'DisplayPort-1')!;

  assert.equal(dp0.connected, false);
  assert.deepEqual(dp0.geometry, { width: 1280, height: 800, x: 3360, y: 0 });
  assert.deepEqual(dp0.modes, [{ name: 'OA_1280x800_60', current: true }]);
  assert.deepEqual(dp1.modes, [{ name: 'OA_1600x900_60', current: false }]);
  assert.deepEqual(state.detachedModes, ['OA_2000x1200_90']);
  assert.equal(rightEdge(state), 4640);
  assert.equal(rightEdge(state, ['DisplayPort-0']), 3360);
});

test('extrai os parâmetros da Modeline do cvt', () => {
  const out = `# 1280x800 59.81 Hz (CVT 1.02MA) hsync: 49.70 kHz; pclk: 83.50 MHz
Modeline "1280x800_60.00"   83.50  1280 1352 1480 1680  800 803 809 831 -hsync +vsync
`;
  assert.deepEqual(parseCvt(out).params, [
    '83.50', '1280', '1352', '1480', '1680', '800', '803', '809', '831', '-hsync', '+vsync',
  ]);
  assert.throws(() => parseCvt('nada aqui'), /Modeline/);
  assert.throws(() => parseCvt('Modeline "x" 1 2 3; rm -rf /'), /inesperada/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Runner } from '../src/proc.ts';
import {
  createMirrorDisplay,
  createVirtualDisplay,
  normalizeRequest,
  pickOutput,
  removeVirtualDisplays,
  requestFromEnv,
} from '../src/linux-x11/virtual-display.ts';
import { parseXrandrQuery } from '../src/linux-x11/xrandr.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const CVT_1080x2400 = `# 1080x2400 59.97 Hz (CVT) hsync: 149.21 kHz; pclk: 220.75 MHz
Modeline "1080x2400_60.00"  220.75  1080 1176 1288 1496  2400 2403 2413 2488 -hsync +vsync
`;

/** Executor falso: devolve as respostas por comando e registra as chamadas. */
function fakeRunner(xrandrQuery: string, failOn?: string) {
  const calls: string[] = [];
  const runner: Runner = async (cmd, args) => {
    const line = [cmd, ...args].join(' ');
    calls.push(line);
    if (failOn && line.includes(failOn)) throw new Error(`falhou: ${line}`);
    if (cmd === 'xrandr' && args[0] === '--query') return { stdout: xrandrQuery, stderr: '' };
    if (cmd === 'cvt') return { stdout: CVT_1080x2400, stderr: '' };
    return { stdout: '', stderr: '' };
  };
  return { runner, calls };
}

test('usa as variáveis do Sunshine e cai para 1280x720@60 sem elas', () => {
  assert.deepEqual(
    requestFromEnv({ SUNSHINE_CLIENT_WIDTH: '2400', SUNSHINE_CLIENT_HEIGHT: '1080', SUNSHINE_CLIENT_FPS: '90' }),
    { width: 2400, height: 1080, fps: 90 },
  );
  assert.deepEqual(requestFromEnv({}), { width: 1280, height: 720, fps: 60 });
  // variável sem expandir (caso o Sunshine passe o texto literal)
  assert.deepEqual(requestFromEnv({ SUNSHINE_CLIENT_WIDTH: '$SUNSHINE_CLIENT_WIDTH', SUNSHINE_CLIENT_HEIGHT: '800' }), {
    width: 1280, height: 720, fps: 60,
  });
  assert.deepEqual(requestFromEnv({ SUNSHINE_CLIENT_WIDTH: '1600', SUNSHINE_CLIENT_HEIGHT: '900', SUNSHINE_CLIENT_FPS: 'x' }), {
    width: 1600, height: 900, fps: 60,
  });
});

test('arredonda a largura para múltiplo de 8 e recusa valores absurdos', () => {
  assert.deepEqual(normalizeRequest({ width: 2340, height: 1080, fps: 60 }), { width: 2336, height: 1080, fps: 60 });
  assert.throws(() => normalizeRequest({ width: 99999, height: 1080, fps: 60 }), RangeError);
  assert.throws(() => normalizeRequest({ width: 1280, height: 720, fps: 1000 }), RangeError);
  assert.throws(() => normalizeRequest({ width: 1280.5, height: 720, fps: 60 }), RangeError);
});

test('escolhe a primeira saída livre, ou a pedida se estiver livre', () => {
  const state = parseXrandrQuery(fixture('xrandr-zorin-2monitores.txt'));
  assert.equal(pickOutput(state), 'DisplayPort-0');
  assert.equal(pickOutput(state, 'DisplayPort-1'), 'DisplayPort-1');
  assert.throws(() => pickOutput(state, 'DisplayPort-2'), /não está livre/);
});

test('cria o monitor à direita dos monitores ligados', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-zorin-2monitores.txt'));
  const vd = await createVirtualDisplay({ width: 1080, height: 2400, fps: 60 }, { run: runner });

  assert.deepEqual(vd, { width: 1080, height: 2400, fps: 60, output: 'DisplayPort-0', mode: 'OA_1080x2400_60', x: 3360, y: 0 });
  assert.deepEqual(calls.filter((c) => !c.endsWith('--query')), [
    'cvt 1080 2400 60',
    'xrandr --newmode OA_1080x2400_60 220.75 1080 1176 1288 1496 2400 2403 2413 2488 -hsync +vsync',
    'xrandr --addmode DisplayPort-0 OA_1080x2400_60',
    'xrandr --output DisplayPort-0 --mode OA_1080x2400_60 --pos 3360x0',
  ]);
});

test('aceita posição explícita (monitor sobreposto ao principal, para espelhar)', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-zorin-2monitores.txt'));
  const vd = await createVirtualDisplay({ width: 1080, height: 2400, fps: 60 }, { run: runner, position: { x: 1440, y: 0 } });
  assert.equal(vd.x, 1440);
  assert.equal(calls.at(-1), 'xrandr --output DisplayPort-0 --mode OA_1080x2400_60 --pos 1440x0');
  await assert.rejects(
    createVirtualDisplay({ width: 1080, height: 2400, fps: 60 }, { run: runner, position: { x: -5, y: Number.NaN } }),
    RangeError,
  );
});

test('espelhar cria o virtual sobre o monitor principal, com o tamanho dele', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-zorin-2monitores.txt'));
  const vd = await createMirrorDisplay(60, { run: runner });
  assert.deepEqual(vd, { width: 1920, height: 1080, fps: 60, output: 'DisplayPort-0', mode: 'OA_1920x1080_60', x: 1440, y: 0 });
  assert.ok(calls.includes('cvt 1920 1080 60'));
  assert.equal(calls.at(-1), 'xrandr --output DisplayPort-0 --mode OA_1920x1080_60 --pos 1440x0');
});

test('se um passo falhar, desfaz o que criou', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-zorin-2monitores.txt'), '--output DisplayPort-0 --mode');
  await assert.rejects(createVirtualDisplay({ width: 1080, height: 2400, fps: 60 }, { run: runner }));
  // a limpeza consulta o xrandr de novo depois da falha
  assert.equal(calls.at(-1), 'xrandr --query');
});

test('remove só o que é do OpenAlt, inclusive sobras', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-com-monitor-virtual.txt'));
  const removed = await removeVirtualDisplays(runner);

  assert.deepEqual(removed.sort(), ['OA_1280x800_60', 'OA_1600x900_60', 'OA_2000x1200_90']);
  assert.deepEqual(calls.slice(1), [
    'xrandr --output DisplayPort-0 --off',
    'xrandr --delmode DisplayPort-0 OA_1280x800_60',
    'xrandr --delmode DisplayPort-1 OA_1600x900_60',
    'xrandr --rmmode OA_2000x1200_90',
    'xrandr --rmmode OA_1280x800_60',
    'xrandr --rmmode OA_1600x900_60',
  ]);
});

test('sem nada do OpenAlt, a remoção não executa nada', async () => {
  const { runner, calls } = fakeRunner(fixture('xrandr-zorin-2monitores.txt'));
  assert.deepEqual(await removeVirtualDisplays(runner), []);
  assert.deepEqual(calls, ['xrandr --query']);
});


test('evita a saída que a dock usa como monitor preferido (senão a dock e o Super pulam para o aparelho)', async () => {
  const { pickOutput, dockPreferredConnectors } = await import('../src/linux-x11/virtual-display.ts');
  const state = { screen: { width: 3360, height: 1080 }, outputs: [
    { name: 'DisplayPort-0', connected: false, primary: false, geometry: null, modes: [] },
    { name: 'DisplayPort-1', connected: false, primary: false, geometry: null, modes: [] },
    { name: 'DisplayPort-2', connected: true, primary: true, geometry: { width: 1920, height: 1080, x: 1440, y: 0 }, modes: [] },
  ] } as never;
  assert.equal(pickOutput(state), 'DisplayPort-0');
  assert.equal(pickOutput(state, undefined, ['DisplayPort-0']), 'DisplayPort-1');
  // se só sobrar a evitada, usa ela mesmo
  assert.equal(pickOutput(state, undefined, ['DisplayPort-0', 'DisplayPort-1']), 'DisplayPort-0');
  const run = async (_c: string, args: readonly string[]) => ({ stdout: args.includes('--schemadir') ? "'DisplayPort-0'\n" : '', stderr: '' });
  assert.deepEqual(await dockPreferredConnectors(run as never, '/home/x'), ['DisplayPort-0']);
});

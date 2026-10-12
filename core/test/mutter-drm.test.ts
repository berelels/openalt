import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { drmConnectorFor, parseConnectorIds } from '../src/linux-x11/drm.ts';
import { buildApplyArgs, findMode, isOpenAltMonitor, layoutFromMutter, layoutSize, parseMutterState } from '../src/linux-x11/mutter.ts';

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');

test('lê o estado real do GNOME (2 monitores, modo físico do X11)', () => {
  const s = parseMutterState(fixture('mutter-2monitores.json'));
  assert.equal(s.serial, 113);
  assert.equal(s.layoutMode, 2);
  assert.deepEqual(s.monitors.map((m) => [m.connector, m.displayName]), [
    ['DisplayPort-2', 'LG Electronics 27"'],
    ['HDMI-A-0', 'LG Electronics 19"'],
  ]);
  assert.deepEqual(s.logical, [
    { x: 1440, y: 0, scale: 1, transform: 0, primary: true, connectors: ['DisplayPort-2'] },
    { x: 0, y: 0, scale: 1, transform: 0, primary: false, connectors: ['HDMI-A-0'] },
  ]);
  assert.deepEqual(layoutFromMutter(s), {
    'DisplayPort-2': { x: 1440, y: 0, width: 1920, height: 1080 },
    'HDMI-A-0': { x: 0, y: 0, width: 1440, height: 900 },
  });
  assert.equal(findMode(s, 'DisplayPort-2', 1920, 1080, 60)?.refresh.toFixed(0), '60');
  assert.equal(findMode(s, 'DisplayPort-2', 1080, 2400, 60), undefined);
});

test('monitor girado 90° troca largura e altura no layout', () => {
  const s = parseMutterState(fixture('mutter-2monitores.json'));
  s.logical[1].transform = 1;
  assert.deepEqual(layoutFromMutter(s)['HDMI-A-0'], { x: 0, y: 0, width: 900, height: 1440 });
});

test('monta o ApplyMonitorsConfig: usuário onde estava, celular novo, serial atual', () => {
  const before = parseMutterState(fixture('mutter-2monitores.json'));
  const now = { ...before, serial: 120 };
  const layout = {
    'HDMI-A-0': { x: 0, y: 0, width: 1440, height: 900 },
    'DisplayPort-2': { x: 1440, y: 0, width: 1920, height: 1080 },
    'DisplayPort-0': { x: 3360, y: 0, width: 1080, height: 2400 },
  };
  const args = buildApplyArgs(now, before, layout, { connector: 'DisplayPort-0', modeId: '1080x2400@59.970' }, 'temporary');
  assert.deepEqual(args.slice(5), [
    'ApplyMonitorsConfig', 'uua(iiduba(ssa{sv}))a{sv}', '120', '1', '3',
    '1440', '0', '1', '0', 'true', '1', 'DisplayPort-2', '1920x1080@179.998', '0',
    '0', '0', '1', '0', 'false', '1', 'HDMI-A-0', '1440x900@59.887', '0',
    '3360', '0', '1', '0', 'false', '1', 'DisplayPort-0', '1080x2400@59.970', '0',
    '0',
  ]);
  assert.throws(
    () => buildApplyArgs(now, before, { 'HDMI-A-0': layout['HDMI-A-0'] }, { connector: 'DisplayPort-0', modeId: 'x' }, 'verify'),
    /não inclui/,
  );
});

test('liga a saída do xrandr ao conector do kernel pelo CONNECTOR_ID', () => {
  const ids = parseConnectorIds(fixture('xrandr-prop.txt'));
  assert.deepEqual([...ids], [['DisplayPort-0', 435], ['DisplayPort-1', 444], ['DisplayPort-2', 450], ['HDMI-A-0', 457]]);
  const kernel = [
    { name: 'card1-DP-1', id: 435 },
    { name: 'card1-DP-2', id: 444 },
    { name: 'card1-DP-3', id: 450 },
    { name: 'card1-HDMI-A-1', id: 457 },
  ];
  assert.equal(drmConnectorFor('DisplayPort-0', ids, kernel), 'card1-DP-1');
  assert.equal(drmConnectorFor('HDMI-A-0', ids, kernel), 'card1-HDMI-A-1');
  assert.throws(() => drmConnectorFor('DP-9', ids, kernel), /CONNECTOR_ID/);
  assert.throws(() => drmConnectorFor('DisplayPort-0', ids, []), /Nenhum conector/);
});

test('com escala (modo lógico, ex.: Wayland a 200%), o celular ocupa metade no layout', () => {
  const s = parseMutterState(fixture('mutter-2monitores.json'));
  assert.deepEqual(layoutSize(s, 1080, 2400), { width: 1080, height: 2400 }); // X11: físico
  s.layoutMode = 1;
  s.logical[0].scale = 2;
  assert.deepEqual(layoutSize(s, 1080, 2400), { width: 540, height: 1200 });
  assert.deepEqual(layoutFromMutter(s)['DisplayPort-2'], { x: 1440, y: 0, width: 960, height: 540 });
});

test('duas placas de vídeo com o mesmo id de conector: recusa em vez de adivinhar', () => {
  const ids = parseConnectorIds(fixture('xrandr-prop.txt'));
  const duasPlacas = [
    { name: 'card0-DP-1', id: 435 },
    { name: 'card1-DP-1', id: 435 },
  ];
  assert.throws(() => drmConnectorFor('DisplayPort-0', ids, duasPlacas), /ambíguo.*card0-DP-1, card1-DP-1/);
});

test('posição salva: monitor que mudou de porta é achado pelo nome; sumiu, usa o principal', async () => {
  const { resolvePlacement } = await import('../src/linux-x11/extend.ts');
  const s = parseMutterState(fixture('mutter-2monitores.json'));
  // conector antigo não existe mais, mas o nome do monitor está lá (agora no HDMI-A-0)
  assert.equal(resolvePlacement(s, { anchor: 'DP-9', anchorName: 'LG Electronics 19"' }).anchor, 'HDMI-A-0');
  // nem conector nem nome: o principal
  assert.equal(resolvePlacement(s, { anchor: 'DP-9', anchorName: 'Monitor que foi embora' }).anchor, 'DisplayPort-2');
  // pedido explícito (linha de comando) continua explícito, para dar erro claro depois
  assert.equal(resolvePlacement(s, { anchor: 'DP-9' }).anchor, 'DP-9');
  assert.equal(resolvePlacement(s, {}).anchor, 'DisplayPort-2');
});

test('o monitor virtual do OpenAlt (EDID OAL) não conta como monitor da pessoa', () => {
  assert.equal(isOpenAltMonitor({ vendor: 'OAL', product: 'OpenAlt', displayName: 'OAL' }), true);
  assert.equal(isOpenAltMonitor({ vendor: 'GSM', product: 'LG ULTRAGEAR', displayName: 'LG Electronics 27"' }), false);
  const s = parseMutterState(fixture('mutter-2monitores.json'));
  assert.ok(s.monitors.every((m) => typeof m.vendor === 'string' && !isOpenAltMonitor(m)));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEdid, isValidEdid, serialForDevice } from '../src/edid.ts';
import { DEFAULT_SETTINGS, sanitizeSettings, settingsFor } from '../src/settings.ts';

test('cada aparelho tem o seu lugar; aparelho novo usa o padrão', () => {
  const s = sanitizeSettings({
    ...DEFAULT_SETTINGS,
    perDevice: {
      'Celular do Gabriel': { placement: { anchor: 'HDMI-A-0', side: 'left', align: 'center', offset: 0 } },
      'bad\n<x>': { placement: { anchor: '../x', side: 'nowhere' } },
    },
  });
  assert.equal(settingsFor(s, 'Celular do Gabriel').placement.side, 'left');
  assert.equal(settingsFor(s, 'Tablet novo').placement.side, DEFAULT_SETTINGS.placement.side);
  // entrada estranha vira o padrão, com a chave limpa
  assert.deepEqual(s.perDevice['badx'].placement.anchor, 'primary');
});

test('EDID: série estável e diferente por aparelho, e continua válido', () => {
  const t = { clockMHz: 148.5, hdisplay: 1920, hsyncStart: 2008, hsyncEnd: 2052, htotal: 2200, vdisplay: 1080, vsyncStart: 1084, vsyncEnd: 1089, vtotal: 1125, hsyncPositive: true, vsyncPositive: true };
  const a = serialForDevice('roth');
  assert.equal(a, serialForDevice('roth'));
  assert.notEqual(a, serialForDevice('Celular do Gabriel'));
  const e = buildEdid(t, { serial: a });
  assert.ok(isValidEdid(e));
  assert.equal(e[90 + 3], 0xff); // descritor de série em texto
});

test('EDID: tamanho físico de 96 DPI (nunca "desconhecido")', () => {
  const t = { clockMHz: 148.5, hdisplay: 1328, hsyncStart: 1400, hsyncEnd: 1440, htotal: 1500, vdisplay: 800, vsyncStart: 803, vsyncEnd: 808, vtotal: 830, hsyncPositive: true, vsyncPositive: true };
  const e = buildEdid(t);
  assert.ok(isValidEdid(e));
  assert.equal(e[21], 35); // 1328 px a 96 DPI ≈ 351 mm
  assert.equal(e[22], 21);
  const hmm = e[54 + 12] | ((e[54 + 14] >> 4) << 8);
  assert.equal(hmm, 351);
});

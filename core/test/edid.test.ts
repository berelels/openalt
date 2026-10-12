import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { buildEdid, isValidEdid, timingFromModeline } from '../src/edid.ts';
import { parseCvt } from '../src/linux-x11/xrandr.ts';

const CVT_1080x2400 = 'Modeline "1080x2400_60.00"  220.75  1080 1176 1288 1496  2400 2403 2413 2488 -hsync +vsync\n';

/** Lê de volta o detailed timing (bytes 54–71), como o kernel faz. */
function decodeDtd(e: Uint8Array) {
  const d = e.subarray(54, 72);
  return {
    clockMHz: (d[0] | (d[1] << 8)) / 100,
    hdisplay: d[2] | ((d[4] >> 4) << 8),
    hblank: d[3] | ((d[4] & 0x0f) << 8),
    vdisplay: d[5] | ((d[7] >> 4) << 8),
    vblank: d[6] | ((d[7] & 0x0f) << 8),
    hso: d[8] | ((d[11] >> 6) << 8),
    hsw: d[9] | (((d[11] >> 4) & 3) << 8),
    vso: (d[10] >> 4) | (((d[11] >> 2) & 3) << 4),
    vsw: (d[10] & 0x0f) | ((d[11] & 3) << 4),
    flags: d[17],
  };
}

test('EDID do celular 1080x2400@60: válido e com a resolução certa', () => {
  const t = timingFromModeline(parseCvt(CVT_1080x2400).params);
  const e = buildEdid(t);
  assert.equal(e.length, 128);
  assert.ok(isValidEdid(e));
  assert.deepEqual(decodeDtd(e), {
    clockMHz: 220.75, hdisplay: 1080, hblank: 416, vdisplay: 2400, vblank: 88,
    hso: 96, hsw: 112, vso: 3, vsw: 10, flags: 0x18 | 0x04, // -hsync +vsync
  });
  // fabricante "OAL" e nome "OpenAlt"
  const v = (e[8] << 8) | e[9];
  assert.equal(String.fromCharCode(((v >> 10) & 31) + 64, ((v >> 5) & 31) + 64, (v & 31) + 64), 'OAL');
  assert.equal(Buffer.from(e.subarray(77, 90)).toString('latin1').split('\n')[0], 'OpenAlt');
});

test('resoluções de tablet e de 120 Hz cabem no EDID', () => {
  for (const [w, h, f] of [[2560, 1600, 60], [2400, 1080, 120], [1280, 720, 60]]) {
    const out = execFileSync('cvt', [String(w), String(h), String(f)], { encoding: 'utf8' });
    const e = buildEdid(timingFromModeline(parseCvt(out).params));
    assert.ok(isValidEdid(e));
    assert.equal(decodeDtd(e).hdisplay, w - (w % 8));
    assert.equal(decodeDtd(e).vdisplay, h);
  }
});

test('recusa o que não cabe no formato (ex.: largura > 4095)', () => {
  const t = timingFromModeline(parseCvt(CVT_1080x2400).params);
  assert.throws(() => buildEdid({ ...t, hdisplay: 5000, hsyncStart: 5096, hsyncEnd: 5208, htotal: 5416 }), /largura/);
});

test('isValidEdid recusa lixo, cabeçalho errado e soma errada', () => {
  const ok = buildEdid(timingFromModeline(parseCvt(CVT_1080x2400).params));
  assert.equal(isValidEdid(new Uint8Array(100)), false);
  const header = ok.slice(); header[0] = 1;
  assert.equal(isValidEdid(header), false);
  const sum = ok.slice(); sum[60] ^= 0xff;
  assert.equal(isValidEdid(sum), false);
});

test('o edid-decode (se instalado) aceita o EDID sem erros', { skip: !hasEdidDecode() }, () => {
  const e = buildEdid(timingFromModeline(parseCvt(CVT_1080x2400).params));
  const out = execFileSync('edid-decode', ['--check'], { input: e, encoding: 'utf8' });
  assert.doesNotMatch(out, /Failures:\s*[1-9]/);
});

function hasEdidDecode(): boolean {
  try {
    execFileSync('edid-decode', ['--help'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessEnvironment, type EnvFacts } from '../src/linux-x11/environment.ts';

// PCs de pessoas diferentes. Só o primeiro foi testado de verdade.
const PC_DE_TESTES: EnvFacts = {
  sessionType: 'x11',
  desktop: 'zorin:GNOME',
  mutter: true,
  gpuDrivers: ['amdgpu'],
  freeOutputs: ['DisplayPort-0', 'DisplayPort-1'],
  connectorMapped: true,
  helperInstalled: true,
};

const statusOf = (f: EnvFacts) => {
  const a = assessEnvironment(f);
  return { extend: a.extend, mirror: a.mirror };
};

test('PC de testes (AMD, GNOME X11, ajudante instalado): tudo ok', () => {
  assert.deepEqual(statusOf(PC_DE_TESTES), { extend: 'ok', mirror: 'ok' });
});

test('antes da instalação da permissão: "Nova tela" pede configuração, "Espelhar" já funciona', () => {
  assert.deepEqual(statusOf({ ...PC_DE_TESTES, helperInstalled: false }), { extend: 'needs-setup', mirror: 'ok' });
});

test('Ubuntu padrão (GNOME em Wayland): ainda não suportado, com explicação', () => {
  const a = assessEnvironment({ ...PC_DE_TESTES, sessionType: 'wayland', desktop: 'ubuntu:GNOME', freeOutputs: [] });
  assert.equal(a.extend, 'unsupported');
  assert.equal(a.mirror, 'unsupported');
  assert.match(a.checks.find((c) => c.id === 'session')!.message, /Wayland está nos planos/);
});

test('notebook Intel com um monitor só: funciona em tese, mas avisa que a placa não foi testada', () => {
  const a = assessEnvironment({ ...PC_DE_TESTES, gpuDrivers: ['i915'], freeOutputs: ['HDMI-1'] });
  assert.deepEqual({ extend: a.extend, mirror: a.mirror }, { extend: 'untested', mirror: 'untested' });
  assert.match(a.checks.find((c) => c.id === 'gpu')!.message, /i915.*não testada/);
});

test('notebook híbrido (Intel + NVIDIA): aviso de combinação não testada', () => {
  const a = assessEnvironment({ ...PC_DE_TESTES, gpuDrivers: ['i915', 'nvidia'] });
  assert.equal(a.extend, 'untested');
  assert.ok(a.checks.some((c) => c.id === 'multi-gpu'));
});

test('KDE em X11: "Espelhar" pode funcionar, "Nova tela" não (por enquanto só GNOME)', () => {
  assert.deepEqual(statusOf({ ...PC_DE_TESTES, desktop: 'KDE', mutter: false }), { extend: 'unsupported', mirror: 'ok' });
});

test('todas as saídas em uso: nada funciona e sugere o adaptador dummy', () => {
  const a = assessEnvironment({ ...PC_DE_TESTES, freeOutputs: [], connectorMapped: false });
  assert.deepEqual({ extend: a.extend, mirror: a.mirror }, { extend: 'unsupported', mirror: 'unsupported' });
  assert.match(a.checks.find((c) => c.id === 'free-output')!.message, /dummy/);
});

test('saída livre sem conector identificável (ex.: duas placas): "Nova tela" recusada, "Espelhar" ok', () => {
  assert.deepEqual(statusOf({ ...PC_DE_TESTES, connectorMapped: false }), { extend: 'unsupported', mirror: 'ok' });
});

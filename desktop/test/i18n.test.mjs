// Os três idiomas da interface têm as mesmas chaves, e toda chave usada existe.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assessEnvironment } from '@openalt/core';

const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const i18n = src('../src/renderer/i18n.ts');

/** Chaves de um dicionário (const PT: Dict = { ... };). */
function dict(name) {
  const body = i18n.slice(i18n.indexOf(`const ${name}: Dict = {`), i18n.indexOf('};', i18n.indexOf(`const ${name}: Dict = {`)));
  return new Map([...body.matchAll(/'([\w.-]+)':\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => [m[1], m[2]]));
}
const PT = dict('PT');
const ES = dict('ES');
const EN = dict('EN');

test('espanhol e inglês têm exatamente as chaves do português, com os mesmos {valores}', () => {
  assert.ok(PT.size > 150);
  for (const [name, d] of [['ES', ES], ['EN', EN]]) {
    assert.deepEqual([...d.keys()].filter((k) => !PT.has(k)), [], `${name}: chaves a mais`);
    assert.deepEqual([...PT.keys()].filter((k) => !d.has(k)), [], `${name}: chaves faltando`);
    for (const [k, v] of PT) {
      const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(vars(d.get(k)), vars(v), `${name} ${k}: valores diferentes`);
    }
  }
});

test('toda chave fixa usada na interface e no processo principal existe', () => {
  const used = new Set();
  for (const f of ['../src/renderer/app.ts', '../src/main/controller.ts']) {
    for (const m of src(f).matchAll(/\bt\('([\w.-]+)'/g)) used.add(m[1]);
    for (const m of src(f).matchAll(/key: '([\w-]+\.[\w.-]+)'/g)) used.add(m[1]);
    // t(cond ? 'a' : 'b') e t(`prefixo.${x}`) não entram aqui; as duas formas são conferidas abaixo
    for (const m of src(f).matchAll(/t\(([^)]*\?[^)]*)\)/g)) for (const q of m[1].matchAll(/'([\w-]+\.[\w.-]+)'/g)) used.add(q[1]);
  }
  for (const s of ['right', 'left', 'above', 'below']) used.add(`side.${s}`).add(`place.at.${s}`);
  for (const o of ['auto', 'portrait', 'landscape']) used.add(`orient.${o}`);
  for (const k of ['phone', 'tablet']) used.add(`kind.${k}`);
  for (const id of ['session', 'desktop', 'gpu', 'multi-gpu', 'free-output', 'connector', 'helper']) used.add(`check.${id}`);
  for (const m of src('../../core/src/layout.ts').matchAll(/new LayoutError\('([\w-]+)'/g)) used.add(`layout.${m[1]}`);
  for (const m of src('../src/renderer/index.html').matchAll(/data-i18n-(?:aria|tip)="([\w.-]+)"/g)) used.add(m[1]);
  const missing = [...used].filter((k) => !PT.has(k));
  assert.deepEqual(missing, []);
});

test('os textos de "Este PC" que vêm do núcleo têm tradução, em todos os casos', () => {
  const base = { sessionType: 'x11', desktop: 'GNOME', mutter: true, gpuDrivers: ['amdgpu'], freeOutputs: ['DP-1'], connectorMapped: true, helperInstalled: true };
  const cases = [base,
    { ...base, sessionType: 'wayland', desktop: 'KDE', mutter: false, gpuDrivers: [], freeOutputs: [], helperInstalled: false },
    { ...base, mutter: false, gpuDrivers: ['amdgpu', 'nvidia'], connectorMapped: false }];
  for (const f of cases) for (const c of assessEnvironment(f).checks) assert.ok(PT.has(c.key), c.key);
});

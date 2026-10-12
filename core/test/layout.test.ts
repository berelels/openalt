import assert from 'node:assert/strict';
import { test } from 'node:test';
import { placeBeside, validateLayout, type Layout, type Placement } from '../src/layout.ts';

// O OpenAlt é para qualquer pessoa: estes arranjos NÃO são só o PC de testes.
const RETRATO = { width: 1080, height: 2400 };
const PAISAGEM = { width: 2400, height: 1080 };
const TABLET = { width: 2560, height: 1600 };
const at = (anchor: string, side: Placement['side'], align: Placement['align'] = 'start', offset?: number): Placement => ({
  anchor, side, align, offset,
});

// PC de testes: 19" à esquerda, 27" principal à direita dele.
const PC: Layout = {
  'HDMI-A-0': { x: 0, y: 0, width: 1440, height: 900 },
  'DisplayPort-2': { x: 1440, y: 0, width: 1920, height: 1080 },
};

// ── um monitor só ────────────────────────────────────────────────────────────
const NOTEBOOK: Layout = { 'eDP-1': { x: 0, y: 0, width: 1366, height: 768 } };

test('um monitor só (notebook pequeno): os quatro lados', () => {
  assert.deepEqual(placeBeside(NOTEBOOK, 'cel', RETRATO, at('eDP-1', 'right')).cel, { x: 1366, y: 0, width: 1080, height: 2400 });
  assert.deepEqual(placeBeside(NOTEBOOK, 'cel', RETRATO, at('eDP-1', 'left', 'center')), {
    'eDP-1': { x: 1080, y: 816, width: 1366, height: 768 },
    cel: { x: 0, y: 0, width: 1080, height: 2400 },
  });
  // celular mais largo que o monitor, centralizado embaixo
  assert.deepEqual(placeBeside(NOTEBOOK, 'cel', PAISAGEM, at('eDP-1', 'below', 'center')), {
    'eDP-1': { x: 517, y: 0, width: 1366, height: 768 },
    cel: { x: 0, y: 768, width: 2400, height: 1080 },
  });
  assert.deepEqual(placeBeside(NOTEBOOK, 'cel', TABLET, at('eDP-1', 'above', 'end')), {
    'eDP-1': { x: 1194, y: 1600, width: 1366, height: 768 },
    cel: { x: 0, y: 0, width: 2560, height: 1600 },
  });
});

// ── o PC de testes ───────────────────────────────────────────────────────────
test('PC de testes: à direita do principal, e entre os dois monitores', () => {
  assert.deepEqual(placeBeside(PC, 'cel', RETRATO, at('DisplayPort-2', 'right')).cel, { x: 3360, y: 0, width: 1080, height: 2400 });
  assert.deepEqual(placeBeside(PC, 'cel', RETRATO, at('HDMI-A-0', 'right')), {
    'HDMI-A-0': { x: 0, y: 0, width: 1440, height: 900 },
    'DisplayPort-2': { x: 2520, y: 0, width: 1920, height: 1080 },
    cel: { x: 1440, y: 0, width: 1080, height: 2400 },
  });
});

test('"bem no meio, embaixo do principal"', () => {
  assert.deepEqual(placeBeside(PC, 'cel', PAISAGEM, at('DisplayPort-2', 'below', 'center')).cel, {
    x: 1200, y: 1080, width: 2400, height: 1080,
  });
});

test('embaixo de um monitor pequeno ao lado de um mais alto: só cabe se não bater nele', () => {
  // retrato cabe embaixo do 19" (termina exatamente onde o 27" começa)
  assert.deepEqual(placeBeside(PC, 'cel', RETRATO, at('HDMI-A-0', 'below', 'end')).cel, { x: 360, y: 900, width: 1080, height: 2400 });
  // deitado e centralizado invadiria o 27" (que vai até y=1080): recusado com o nome dele
  assert.throws(() => placeBeside(PC, 'cel', PAISAGEM, at('HDMI-A-0', 'below', 'center')), /ficaria por cima de DisplayPort-2/);
});

// ── três monitores em fila, tamanhos diferentes, um em retrato ───────────────
const FILA: Layout = {
  esq: { x: 0, y: 0, width: 1920, height: 1080 },
  meio: { x: 1920, y: 0, width: 2560, height: 1440 },
  dir: { x: 4480, y: 0, width: 1080, height: 1920 }, // monitor girado
};

test('três em fila: celular entre o do meio e o girado; só o girado se move', () => {
  const r = placeBeside(FILA, 'cel', RETRATO, at('meio', 'right'));
  assert.deepEqual(r.esq, FILA.esq);
  assert.deepEqual(r.meio, FILA.meio);
  assert.deepEqual(r.cel, { x: 4480, y: 0, width: 1080, height: 2400 });
  assert.deepEqual(r.dir, { x: 5560, y: 0, width: 1080, height: 1920 });
});

test('três em fila: celular entre os dois primeiros empurra os dois da direita, em cadeia', () => {
  const r = placeBeside(FILA, 'cel', RETRATO, at('esq', 'right', 'end'));
  assert.deepEqual(r.cel, { x: 1920, y: 0, width: 1080, height: 2400 });
  // y do celular: 1080-2400 = -1320 → tudo desce 1320 na normalização
  assert.deepEqual(normalizedY(r), { esq: 1320, meio: 1320, dir: 1320, cel: 0 });
  assert.equal(r.meio.x, 3000);
  assert.equal(r.dir.x, 5560);
});

// ── quatro monitores em grade 2×2 ────────────────────────────────────────────
const GRADE: Layout = {
  a: { x: 0, y: 0, width: 1920, height: 1080 },
  b: { x: 1920, y: 0, width: 1920, height: 1080 },
  c: { x: 0, y: 1080, width: 1920, height: 1080 },
  d: { x: 1920, y: 1080, width: 1920, height: 1080 },
};

test('grade 2×2: celular deitado entre "a" e "b" só empurra "b" (a fileira de baixo fica igual)', () => {
  const r = placeBeside(GRADE, 'cel', { width: 1080, height: 600 }, at('a', 'right'));
  assert.deepEqual(r.b, { x: 3000, y: 0, width: 1920, height: 1080 });
  assert.deepEqual(r.c, GRADE.c);
  assert.deepEqual(r.d, GRADE.d);
});

test('grade 2×2: celular alto entre as colunas empurra a coluna da direita inteira', () => {
  const r = placeBeside(GRADE, 'cel', RETRATO, at('a', 'right'));
  assert.equal(r.b.x, 3000);
  assert.equal(r.d.x, 3000);
  assert.deepEqual(r.c, GRADE.c);
});

test('grade 2×2: no meio, embaixo de "c"', () => {
  const r = placeBeside(GRADE, 'cel', RETRATO, at('c', 'below', 'center'));
  assert.deepEqual(r.cel, { x: 420, y: 2160, width: 1080, height: 2400 });
});

test('grade 2×2: acima de "b" centralizado e com ajuste fino de 200 px', () => {
  const r = placeBeside(GRADE, 'cel', PAISAGEM, at('b', 'above', 'center', 200));
  assert.deepEqual(r.cel, { x: 1880, y: 0, width: 2400, height: 1080 }); // 1920 + (1920-2400)/2 + 200
  assert.equal(r.b.y, 1080);
});

// ── monitor pequeno ao lado de um grande, alinhamentos ───────────────────────
test('ao lado de um monitor pequeno, alinhado na base', () => {
  const l: Layout = { grande: { x: 0, y: 0, width: 3840, height: 2160 }, peq: { x: 3840, y: 1080, width: 1024, height: 768 } };
  const r = placeBeside(l, 'cel', RETRATO, at('peq', 'right', 'end'));
  assert.deepEqual(r.cel, { x: 4864, y: 0, width: 1080, height: 2400 });
  assert.equal(r.peq.y, 1632); // tudo desceu 552 para começar em 0
});

// ── erros ────────────────────────────────────────────────────────────────────
test('recusa referência desconhecida, nome repetido e deslocamento não inteiro', () => {
  assert.throws(() => placeBeside(PC, 'cel', RETRATO, at('DP-9', 'right')), /não encontrado/);
  assert.throws(() => placeBeside(PC, 'HDMI-A-0', RETRATO, at('DisplayPort-2', 'right')), /Já existe/);
  assert.throws(() => placeBeside(PC, 'cel', RETRATO, at('DisplayPort-2', 'right', 'start', 1.5)), RangeError);
});

test('monitor fora do caminho não se move', () => {
  const l: Layout = { a: { x: 0, y: 0, width: 100, height: 100 }, b: { x: 100, y: 50, width: 100, height: 100 } };
  const r = placeBeside(l, 'cel', { width: 50, height: 40 }, at('a', 'right'));
  assert.deepEqual(r.b, l.b);
  assert.deepEqual(r.cel, { x: 100, y: 0, width: 50, height: 40 });
});

test('recusa quando bateria num monitor que não pode ser empurrado', () => {
  const l: Layout = { a: { x: 0, y: 0, width: 100, height: 100 }, b: { x: 0, y: 100, width: 300, height: 100 } };
  assert.throws(() => placeBeside(l, 'cel', { width: 50, height: 150 }, at('a', 'right')), /cel ficaria por cima de b/);
});

test('validateLayout: aceita arranjos reais e recusa monitor encostado só pelo canto', () => {
  validateLayout(PC);
  validateLayout(FILA);
  validateLayout(GRADE);
  assert.throws(
    () => validateLayout({ a: { x: 0, y: 0, width: 10, height: 10 }, b: { x: 10, y: 10, width: 10, height: 10 } }),
    /solto/,
  );
});

function normalizedY(l: Layout): Record<string, number> {
  return Object.fromEntries(Object.entries(l).map(([k, r]) => [k, r.y]));
}

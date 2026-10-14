// Copia HTML, CSS e fontes para dist/renderer (as fontes ficam junto: funciona sem internet).
import { cpSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'renderer');
const require = createRequire(join(root, 'package.json'));
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

mkdirSync(join(out, 'fonts'), { recursive: true });
cpSync(join(root, 'src', 'renderer', 'index.html'), join(out, 'index.html'));
cpSync(join(root, 'src', 'renderer', 'styles'), join(out, 'styles'), { recursive: true });
const fonts = [
  ['@fontsource-variable/newsreader', 'files/newsreader-latin-opsz-normal.woff2'],
  ['@fontsource-variable/newsreader', 'files/newsreader-latin-opsz-italic.woff2'],
  ['@fontsource-variable/plus-jakarta-sans', 'files/plus-jakarta-sans-latin-wght-normal.woff2'],
  ['material-symbols', 'material-symbols-outlined.woff2'],
];
for (const [pkg, file] of fonts) cpSync(join(pkgDir(pkg), file), join(out, 'fonts', file.split('/').pop()));
// mono do visual do site (styles/site.css): a mesma fonte do site, já no repositório
cpSync(join(root, '..', 'site', 'fonts', 'jetbrains-mono-latin-wght-normal.woff2'), join(out, 'fonts', 'jetbrains-mono-latin-wght-normal.woff2'));
mkdirSync(join(root, 'dist', 'preload'), { recursive: true });
cpSync(join(root, 'src', 'preload', 'preload.cjs'), join(root, 'dist', 'preload', 'preload.cjs'));
console.log('estáticos copiados para', out);

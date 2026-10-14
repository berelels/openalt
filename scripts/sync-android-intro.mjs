// Copia a abertura do app do PC (intro.js e intro.css) para o app Android
// (android/app/src/main/assets/intro/) e para o site (site/js/, site/css/), para as três serem a mesma. Rodar depois de mudar desktop/src/renderer/intro.ts:
//   npm run build -w @openalt/desktop && node scripts/sync-android-intro.mjs
// O build do Android (GitHub Actions) não compila o desktop: a cópia fica no git.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'desktop', 'dist', 'renderer', 'intro.js');
const css = join(root, 'desktop', 'src', 'renderer', 'styles', 'intro.css');
const targets = [
  [from, join(root, 'android', 'app', 'src', 'main', 'assets', 'intro', 'intro.js')],
  [css, join(root, 'android', 'app', 'src', 'main', 'assets', 'intro', 'intro.css')],
  [from, join(root, 'site', 'js', 'intro.js')],
  [css, join(root, 'site', 'css', 'intro.css')],
];
if (!existsSync(from)) {
  console.error(`Falta ${from}: rode antes "npm run build -w @openalt/desktop".`);
  process.exit(1);
}
for (const [src, to] of targets) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(src, to);
  console.log(`abertura copiada para ${to}`);
}

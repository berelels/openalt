// Copia a abertura do app do PC para o app Android (android/app/src/main/assets/intro/), para as
// duas serem a mesma. Rodar depois de mudar desktop/src/renderer/intro.ts:
//   npm run build -w @openalt/desktop && node scripts/sync-android-intro.mjs
// O build do Android (GitHub Actions) não compila o desktop: a cópia fica no git.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'desktop', 'dist', 'renderer', 'intro.js');
const to = join(root, 'android', 'app', 'src', 'main', 'assets', 'intro', 'intro.js');
if (!existsSync(from)) {
  console.error(`Falta ${from}: rode antes "npm run build -w @openalt/desktop".`);
  process.exit(1);
}
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`abertura copiada para ${to}`);

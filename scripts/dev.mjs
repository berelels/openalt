// Abre o OpenAlt em modo de desenvolvimento.
// - Tudo o que o app grava fica em OpenAlt/.dev/ (regra: nada fora da pasta do projeto).
// - Abre no monitor SECUNDÁRIO (para não atrapalhar quem está usando o principal).
// - Usa o ajudante root do projeto via pkexec (pede senha; a política polkit é do instalador).
// uso: node scripts/dev.mjs
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = join(root, '.dev');
for (const d of ['config', 'data', 'run']) mkdirSync(join(dev, d), { recursive: true, mode: 0o700 });

execFileSync('npm', ['run', 'build', '-w', '@openalt/core'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['run', 'build', '-w', '@openalt/desktop'], { cwd: root, stdio: 'inherit' });

const env = {
  ...process.env,
  OPENALT_CONFIG_DIR: join(dev, 'config'),
  OPENALT_DATA_DIR: join(dev, 'data'),
  OPENALT_RUNTIME_DIR: join(dev, 'run'),
  OPENALT_HELPER: join(root, 'core', 'helper', 'openalt-helper'),
  OPENALT_DEV_DISPLAY: process.env.OPENALT_DEV_DISPLAY ?? 'secondary',
};
const electron = join(root, 'node_modules', 'electron', 'dist', 'electron');
spawn(electron, [join(root, 'desktop')], { env, stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));

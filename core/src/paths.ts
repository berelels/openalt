// Onde o OpenAlt guarda as coisas. No produto: pastas XDG do usuário. No desenvolvimento,
// OPENALT_*_DIR apontam para dentro do projeto (regra: nada fora da pasta do projeto).
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Paths {
  /** configurações e a configuração própria do Sunshine (ADR-0010) */
  config: string;
  /** scripts instalados (ex.: a ponte que o Sunshine chama) */
  data: string;
  /** estado da sessão (some ao sair da sessão) */
  runtime: string;
}

export function openaltPaths(env: NodeJS.ProcessEnv = process.env): Paths {
  const home = env.HOME ?? homedir();
  const config = env.OPENALT_CONFIG_DIR ?? join(env.XDG_CONFIG_HOME ?? join(home, '.config'), 'openalt');
  const data = env.OPENALT_DATA_DIR ?? join(env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'openalt');
  const runtime = env.OPENALT_RUNTIME_DIR ?? (env.XDG_RUNTIME_DIR ? join(env.XDG_RUNTIME_DIR, 'openalt') : join(config, 'run'));
  return { config, data, runtime };
}

export function sunshineDir(p: Paths): string {
  return join(p.config, 'sunshine');
}

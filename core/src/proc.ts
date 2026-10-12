// Execução de comandos externos sem shell (argumentos nunca passam por interpretação).
import { execFile } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  /** Padrão: 10 s. Comandos que esperam a pessoa (ex.: senha do pkexec) precisam de mais. */
  timeoutMs?: number;
  /** Enviado na entrada padrão do comando (ex.: o EDID para o ajudante). */
  input?: Uint8Array;
}

/** Executa `cmd` com `args`. Injetável para os testes não tocarem no sistema. */
export type Runner = (cmd: string, args: readonly string[], options?: RunOptions) => Promise<RunResult>;

export class CommandError extends Error {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly stderr: string;
  /** Código de saída do comando, quando ele chegou a rodar. */
  readonly exitCode: number | undefined;

  constructor(cmd: string, args: readonly string[], stderr: string, exitCode?: number) {
    super(`${cmd} ${args.join(' ')} falhou: ${stderr.trim()}`);
    this.name = 'CommandError';
    this.cmd = cmd;
    this.args = args;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export const run: Runner = (cmd, args, { timeoutMs = 10_000, input } = {}) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      // LC_ALL=C: a saída do xrandr/cvt precisa ser estável para o parser.
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } },
      (err, stdout, stderr) => {
        if (err) {
          const code = typeof err.code === 'number' ? err.code : undefined;
          reject(new CommandError(cmd, args, stderr || err.message, code));
        } else resolve({ stdout, stderr });
      },
    );
    if (input) child.stdin?.end(input);
    else child.stdin?.end();
  });

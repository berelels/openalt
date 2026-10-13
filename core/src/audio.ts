// Onde sai o som com o aparelho conectado: no aparelho, no PC ou nos dois (settings.audio).
// - "pc": o Sunshine nem transmite som (stream_audio = disabled) e o PC toca normal.
// - "device": o Sunshine troca a saída padrão do PC pela saída virtual dele (o PC fica mudo).
// - "both": como "device", e o OpenAlt devolve uma cópia (loopback do PipeWire/Pulse) da saída
//   virtual do Sunshine para a saída real do PC. A opção do cliente ("tocar no PC") não chega
//   pelo app do PC, então isso é feito aqui.
import { run as defaultRun, type Runner } from './proc.ts';

export type AudioOut = 'device' | 'pc' | 'both';
export const isAudioOut = (v: unknown): v is AudioOut => v === 'device' || v === 'pc' || v === 'both';

const SUNSHINE_SINK = /sunshine/i;
const SAFE_SINK = /^[\w.:\-]{1,200}$/;

export async function defaultSink(run: Runner = defaultRun): Promise<string | null> {
  const s = (await run('pactl', ['get-default-sink']).catch(() => ({ stdout: '' }))).stdout.trim();
  return SAFE_SINK.test(s) ? s : null;
}

/** A saída real do PC (não a do Sunshine), para devolver o som no modo "both". */
export async function realSink(run: Runner = defaultRun): Promise<string | null> {
  const s = await defaultSink(run);
  return s && !SUNSHINE_SINK.test(s) ? s : null;
}

/**
 * Espera o Sunshine trocar a saída padrão pela dele e liga a cópia para `toSink`.
 * Devolve o id do módulo (para desligar depois) ou null se o Sunshine não trocou a saída.
 */
export async function startHostEcho(
  toSink: string,
  { run = defaultRun, timeoutMs = 20_000, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<string | null> {
  if (!SAFE_SINK.test(toSink)) return null;
  const end = Date.now() + timeoutMs;
  let from: string | null = null;
  while (Date.now() < end) {
    const s = await defaultSink(run);
    if (s && SUNSHINE_SINK.test(s)) { from = s; break; }
    await sleep(500);
  }
  if (!from) return null;
  const id = (await run('pactl', ['load-module', 'module-loopback', `source=${from}.monitor`, `sink=${toSink}`, 'latency_msec=40'])).stdout.trim();
  return /^\d+$/.test(id) ? id : null;
}

export async function stopHostEcho(id: string | null, run: Runner = defaultRun): Promise<void> {
  if (id && /^\d+$/.test(id)) await run('pactl', ['unload-module', id]).catch(() => {});
}

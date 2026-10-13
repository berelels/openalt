// Onde sai o som com o aparelho conectado: no aparelho, no PC ou nos dois (settings.audio).
// - "device": a saída padrão é a virtual do Sunshine (ele a escolhe ao conectar; o PC fica mudo).
// - "pc": o Sunshine liga sem transmitir som (stream_audio = disabled, ver sunshine/setup.ts) e nem
//   mexe na saída. Se ele já estava transmitindo (a pessoa trocou com o aparelho conectado), a
//   saída padrão volta para a real do PC sempre que o Sunshine a trocar.
// - "both": a do Sunshine, mais uma cópia (loopback do PipeWire/Pulse) para a real do PC.
// O Sunshine troca a saída padrão ~0,5 s DEPOIS de o aparelho conectar (registro de 13/10): por isso
// o AudioRouter confere a cada tick, em vez de aplicar uma vez só (a 1ª versão perdia essa corrida).
import { run as defaultRun, type Runner } from './proc.ts';

export type AudioOut = 'device' | 'pc' | 'both';
export const isAudioOut = (v: unknown): v is AudioOut => v === 'device' || v === 'pc' || v === 'both';

/** O Sunshine transmite som? Só não transmite no "pc". */
export const streamsAudio = (a: AudioOut): boolean => a !== 'pc';

const SUNSHINE_SINK = /sunshine/i;
const SAFE_SINK = /^[\w.:\-]{1,200}$/;
const isSunshine = (s: string | null): s is string => !!s && SUNSHINE_SINK.test(s);

export async function defaultSink(run: Runner = defaultRun): Promise<string | null> {
  const s = (await run('pactl', ['get-default-sink']).catch(() => ({ stdout: '' }))).stdout.trim();
  return SAFE_SINK.test(s) ? s : null;
}

/** A saída real do PC (não a do Sunshine), para devolver o som no modo "both". */
export async function realSink(run: Runner = defaultRun): Promise<string | null> {
  const s = await defaultSink(run);
  return s && !SUNSHINE_SINK.test(s) ? s : null;
}

async function listSinks(run: Runner): Promise<string[]> {
  const out = (await run('pactl', ['list', 'short', 'sinks']).catch(() => ({ stdout: '' }))).stdout;
  return out.split('\n').map((l) => l.split('\t')[1]).filter((n): n is string => !!n && SAFE_SINK.test(n));
}

/** O nome da saída virtual do Sunshine (a estéreo, se houver várias), quando ela existe. */
export async function sunshineSink(run: Runner = defaultRun): Promise<string | null> {
  const sun = (await listSinks(run)).filter((n) => SUNSHINE_SINK.test(n));
  return sun.find((n) => /stereo/i.test(n)) ?? sun[0] ?? null;
}

export async function setDefaultSink(name: string, run: Runner = defaultRun): Promise<void> {
  if (SAFE_SINK.test(name)) await run('pactl', ['set-default-sink', name]);
}

export async function stopHostEcho(id: string | null, run: Runner = defaultRun): Promise<void> {
  if (id && /^\d+$/.test(id)) await run('pactl', ['unload-module', id]).catch(() => {});
}

/**
 * Mantém o som onde a pessoa escolheu enquanto o aparelho está conectado. `tick()` é idempotente e
 * barato (2–3 chamadas ao pactl): o app o chama a cada segundo e a cada mudança.
 * Respeita a pessoa: se ela trocar a saída real (fone → caixa) no GNOME, essa passa a ser "a do PC".
 */
export class AudioRouter {
  /** a saída real do PC (fone, caixa…), a que recebe o som no "pc" e a cópia no "both" */
  pcSink: string | null;
  private echo: { id: string; from: string; to: string } | null = null;
  private applied: AudioOut | null = null;
  private readonly run: Runner;

  constructor(pcSink: string | null, run: Runner = defaultRun) {
    this.pcSink = pcSink && !SUNSHINE_SINK.test(pcSink) && SAFE_SINK.test(pcSink) ? pcSink : null;
    this.run = run;
  }

  async tick(choice: AudioOut, connected: boolean): Promise<void> {
    const cur = await defaultSink(this.run);
    if (cur && !isSunshine(cur)) this.pcSink = cur;
    if (!connected) { await this.stopEcho(); this.applied = null; return; }
    // sem saída real conhecida (o app abriu com a do Sunshine como padrão): a 1ª real da lista
    if (!this.pcSink) this.pcSink = (await listSinks(this.run)).find((n) => !SUNSHINE_SINK.test(n)) ?? null;

    if (choice === 'pc') {
      await this.stopEcho();
      if (isSunshine(cur) && this.pcSink) await setDefaultSink(this.pcSink, this.run).catch(() => {});
      this.applied = choice;
      return;
    }
    // a que o Sunshine escolheu (estéreo/5.1/7.1 conforme o aparelho), ou a estéreo
    const sun = isSunshine(cur) ? cur : await sunshineSink(this.run);
    if (!sun) return; // o Sunshine ainda não criou a dele: o próximo tick tenta de novo
    // ao escolher "aparelho"/"os dois" com o aparelho já conectado. Uma vez só: se depois a pessoa
    // escolher outra saída no GNOME, não brigamos com ela (o Sunshine também troca sozinho ao conectar).
    if (this.applied !== choice && cur !== sun) await setDefaultSink(sun, this.run).catch(() => {});
    this.applied = choice;
    if (choice === 'device' || !this.pcSink) { await this.stopEcho(); return; }
    await this.ensureEcho(sun, this.pcSink);
  }

  /** Desliga a cópia e devolve a saída padrão para a do PC, se ainda for a do Sunshine. */
  async stop(): Promise<void> {
    await this.stopEcho();
    this.applied = null;
    const cur = await defaultSink(this.run);
    if (isSunshine(cur) && this.pcSink) await setDefaultSink(this.pcSink, this.run).catch(() => {});
  }

  private async ensureEcho(from: string, to: string) {
    if (this.echo && (this.echo.from !== from || this.echo.to !== to || !(await this.moduleAlive(this.echo.id)))) await this.stopEcho();
    if (this.echo) return;
    const id = (await this.run('pactl', ['load-module', 'module-loopback', `source=${from}.monitor`, `sink=${to}`, 'latency_msec=40']).catch(() => ({ stdout: '' }))).stdout.trim();
    if (/^\d+$/.test(id)) this.echo = { id, from, to };
  }

  private async moduleAlive(id: string): Promise<boolean> {
    const out = (await this.run('pactl', ['list', 'short', 'modules']).catch(() => ({ stdout: '' }))).stdout;
    return out.split('\n').some((l) => l.split('\t')[0] === id);
  }

  private async stopEcho() {
    if (!this.echo) return;
    await stopHostEcho(this.echo.id, this.run);
    this.echo = null;
  }
}

// EDID (a "ficha técnica" que um monitor manda ao PC) gerado pelo OpenAlt para o monitor do
// celular. Sem EDID, o kernel tenta ler um monitor que não existe a cada sondagem e espera o
// tempo esgotar (~4 s com a tela travada, S11). Com este EDID, a sondagem é instantânea, a
// resolução do celular vira a preferida e o GNOME mostra o nome "OpenAlt".
//
// EDID 1.4, um bloco de 128 bytes, monitor digital, com um "detailed timing" na resolução do
// aparelho (tirado do `cvt`) e o nome do monitor.

export interface Timing {
  /** pixel clock em MHz (ex.: 220.75) */
  clockMHz: number;
  hdisplay: number;
  hsyncStart: number;
  hsyncEnd: number;
  htotal: number;
  vdisplay: number;
  vsyncStart: number;
  vsyncEnd: number;
  vtotal: number;
  hsyncPositive: boolean;
  vsyncPositive: boolean;
}

/** Converte os parâmetros de uma Modeline do `cvt` (ver xrandr.ts/parseCvt). */
export function timingFromModeline(params: string[]): Timing {
  const n = params.slice(0, 9).map(Number);
  if (n.some((v) => !Number.isFinite(v))) throw new Error('Modeline inválida');
  const flags = params.slice(9).map((f) => f.toLowerCase());
  return {
    clockMHz: n[0],
    hdisplay: n[1], hsyncStart: n[2], hsyncEnd: n[3], htotal: n[4],
    vdisplay: n[5], vsyncStart: n[6], vsyncEnd: n[7], vtotal: n[8],
    hsyncPositive: flags.includes('+hsync'),
    vsyncPositive: flags.includes('+vsync'),
  };
}

/** "OAL": identificador de fabricante (3 letras) usado pelo OpenAlt. */
const VENDOR = 'OAL';

function vendorBytes(id: string): [number, number] {
  const [a, b, c] = [...id].map((ch) => ch.charCodeAt(0) - 64); // 'A' = 1
  const v = (a << 10) | (b << 5) | c;
  return [v >> 8, v & 0xff];
}

function detailedTiming(t: Timing): number[] {
  const clock = Math.round(t.clockMHz * 100); // em 10 kHz
  const hblank = t.htotal - t.hdisplay;
  const vblank = t.vtotal - t.vdisplay;
  const hso = t.hsyncStart - t.hdisplay;
  const hsw = t.hsyncEnd - t.hsyncStart;
  const vso = t.vsyncStart - t.vdisplay;
  const vsw = t.vsyncEnd - t.vsyncStart;
  const limits: [string, number, number][] = [
    ['pixel clock', clock, 0xffff], ['largura', t.hdisplay, 4095], ['altura', t.vdisplay, 4095],
    ['hblank', hblank, 4095], ['vblank', vblank, 4095], ['hsync offset', hso, 1023], ['hsync width', hsw, 1023],
    ['vsync offset', vso, 63], ['vsync width', vsw, 63],
  ];
  for (const [name, v, max] of limits) {
    if (!Number.isInteger(v) || v < 0 || v > max) throw new RangeError(`EDID: ${name} fora do limite (${v})`);
  }
  // sinais digitais separados, polaridades conforme o cvt
  const flags = 0x18 | (t.vsyncPositive ? 0x04 : 0) | (t.hsyncPositive ? 0x02 : 0);
  return [
    clock & 0xff, clock >> 8,
    t.hdisplay & 0xff, hblank & 0xff, ((t.hdisplay >> 8) << 4) | (hblank >> 8),
    t.vdisplay & 0xff, vblank & 0xff, ((t.vdisplay >> 8) << 4) | (vblank >> 8),
    hso & 0xff, hsw & 0xff, ((vso & 0x0f) << 4) | (vsw & 0x0f),
    ((hso >> 8) << 6) | ((hsw >> 8) << 4) | ((vso >> 4) << 2) | (vsw >> 4),
    // tamanho físico em mm como se fosse um monitor de 96 DPI: com "desconhecido" (0), o X e
    // alguns apps calculam a escala pelo tamanho e a interface de TODOS os monitores mudava
    mm(t.hdisplay) & 0xff, mm(t.vdisplay) & 0xff, ((mm(t.hdisplay) >> 8) << 4) | (mm(t.vdisplay) >> 8),
    0, 0, // bordas
    flags,
  ];
}

function textDescriptor(tag: number, text: string): number[] {
  const bytes = [...text.slice(0, 13)].map((c) => c.charCodeAt(0) & 0x7f);
  if (bytes.length < 13) bytes.push(0x0a);
  while (bytes.length < 13) bytes.push(0x20);
  return [0, 0, 0, tag, 0, ...bytes];
}

const dummyDescriptor = (): number[] => [0, 0, 0, 0x10, 0, ...new Array(13).fill(0)];

/** pixels → milímetros a 96 DPI (o padrão do X e do GNOME em escala 100%) */
const mm = (px: number): number => Math.min(4095, Math.round((px * 25.4) / 96));

export interface EdidOptions {
  name?: string;
  /** número de série (distingue arranjos salvos no GNOME por aparelho, se for preciso) */
  serial?: number;
}

/** Série estável por aparelho: o GNOME guarda o arranjo de cada aparelho separado. */
export function serialForDevice(deviceName: string): number {
  let h = 0x811c9dc5; // FNV-1a 32 bits
  for (const b of new TextEncoder().encode(deviceName)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h || 1;
}

export function buildEdid(t: Timing, { name = 'OpenAlt', serial = 1 }: EdidOptions = {}): Uint8Array {
  const e = new Uint8Array(128);
  e.set([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00], 0); // cabeçalho
  e.set(vendorBytes(VENDOR), 8);
  e.set([0x01, 0x00], 10); // código do produto
  e.set([serial & 0xff, (serial >> 8) & 0xff, (serial >> 16) & 0xff, (serial >>> 24) & 0xff], 12);
  e.set([0x01, 0x24], 16); // semana 1 de 2026 (1990 + 36)
  e.set([0x01, 0x04], 18); // EDID 1.4
  e[20] = 0xa5; // digital, 8 bits por cor, DisplayPort
  e[21] = Math.max(1, Math.round(mm(t.hdisplay) / 10)); // tamanho físico em cm (96 DPI)
  e[22] = Math.max(1, Math.round(mm(t.vdisplay) / 10));
  e[23] = 0x78; // gama 2.2
  e[24] = 0x06; // RGB 4:4:4; o 1º timing é o preferido; contínuo
  // cromaticidade sRGB (bytes 25–34)
  e.set([0xee, 0x91, 0xa3, 0x54, 0x4c, 0x99, 0x26, 0x0f, 0x50, 0x54], 25);
  // 35–37: sem timings fixos; 38–53: sem timings padrão (0x01 0x01 = vazio)
  for (let i = 38; i < 54; i += 2) e.set([0x01, 0x01], i);
  e.set(detailedTiming(t), 54);
  e.set(textDescriptor(0xfc, name), 72); // nome do monitor
  e.set(textDescriptor(0xff, serial.toString(16).padStart(8, '0')), 90); // série em texto (o GNOME usa esta)
  e.set(dummyDescriptor(), 108);
  e[126] = 0; // sem blocos de extensão
  e[127] = (256 - (e.subarray(0, 127).reduce((s, b) => s + b, 0) % 256)) % 256;
  return e;
}

/** O mesmo que o ajudante root confere antes de usar: tamanho, cabeçalho e soma de cada bloco. */
export function isValidEdid(e: Uint8Array): boolean {
  if (e.length === 0 || e.length % 128 !== 0 || e.length > 512) return false;
  if (![0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00].every((b, i) => e[i] === b)) return false;
  for (let off = 0; off < e.length; off += 128) {
    if (e.subarray(off, off + 128).reduce((s, b) => s + b, 0) % 256 !== 0) return false;
  }
  return true;
}

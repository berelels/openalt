// Processo principal do OpenAlt (Electron). ADR-0011: nenhuma porta aberta; a interface fala
// com este processo só por IPC, e só por canais conhecidos vindos da nossa própria página.
import { app, BrowserWindow, ipcMain, screen, shell, type IpcMainInvokeEvent } from 'electron';
import { Controller } from './controller.js';
import { restartShellViaHelper, run } from '@openalt/core';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const RENDERER = join(here, '..', 'renderer', 'index.html');
const PRELOAD = join(here, '..', 'preload', 'preload.cjs');
const RENDERER_URL = pathToFileURL(RENDERER).href;

/** Cor da abertura: a janela já nasce vermelha, sem piscar branco antes da animação. */
const BRAND = '#ff746c';

/** Só a nossa página pode chamar os canais (não um iframe, nem uma página navegada). */
function fromOurPage(e: IpcMainInvokeEvent): BrowserWindow {
  const url = e.senderFrame?.url ?? '';
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || e.senderFrame !== e.sender.mainFrame || url.split('?')[0] !== RENDERER_URL) {
    throw new Error('Chamada recusada');
  }
  return win;
}

/**
 * Monitor onde a janela abre. No desenvolvimento, OPENALT_DEV_DISPLAY=secondary abre no
 * monitor que NÃO é o principal (para não atrapalhar quem está usando o principal).
 */
function targetBounds() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const d = process.env.OPENALT_DEV_DISPLAY === 'secondary' ? (displays.find((x) => x.id !== primary.id) ?? primary) : primary;
  return d.bounds;
}

const controller = new Controller({
  // a ponte do Sunshine roda a CLI do núcleo com o próprio Electron (sem precisar de Node instalado)
  cli: { runner: process.execPath, args: [process.env.OPENALT_CORE_CLI ?? join(here, '..', '..', '..', 'core', 'dist', 'cli.js')] },
  cliEnv: process.env.OPENALT_HELPER ? { OPENALT_HELPER: process.env.OPENALT_HELPER } : {},
});

function createWindow(): void {
  const area = targetBounds();
  const win = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: Math.min(1366, area.width),
    height: Math.min(900, area.height),
    minWidth: 960,
    minHeight: 640,
    // nasce do tamanho do monitor; a tela cheia é pedida logo depois de aparecer (no X11/GNOME,
    // pedir já no construtor junto com show:true não funciona)
    backgroundColor: BRAND,
    // já visível, em tela cheia e vermelha desde o primeiro instante: a abertura começa
    // nessa cor, então não aparece janela preta/decorada antes dela
    show: true,
    title: 'OpenAlt',
    autoHideMenuBar: true,
    icon: join(here, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });


  // Nada de abrir janelas novas ou navegar para fora da nossa página.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // F11 alterna a tela cheia (Esc é tratado na página: primeiro pula a abertura, depois sai).
  win.webContents.on('before-input-event', (e, input) => {
    // enquanto o OpenAlt digita Alt+F2 → r, nenhuma tecla chega à página (ver restartShell)
    if (Date.now() < keyGuardUntil) { e.preventDefault(); return; }
    if (input.type === 'keyDown' && input.key === 'F11') {
      e.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });
  win.once('ready-to-show', () => win.setFullScreen(true)); // abre em tela cheia, como o Big Picture; Esc/F11/botão saem
  const notify = () => {
    if (process.env.OPENALT_DEBUG) console.log(`[janela] ${Date.now()} tela cheia = ${win.isFullScreen()}`);
    win.webContents.send('window:fullscreen', win.isFullScreen());
  };
  if (process.env.OPENALT_DEBUG) {
    for (const ev of ['show', 'ready-to-show', 'maximize', 'unmaximize', 'resize', 'focus', 'blur'] as const) {
      win.on(ev as 'show', () => console.log(`[janela] ${Date.now()} ${ev} ${JSON.stringify(win.getBounds())} cheia=${win.isFullScreen()}`));
    }
  }
  win.on('enter-full-screen', notify);
  win.on('leave-full-screen', notify);

  const onMonitors = () => void restartShell(win).then((ok) => (ok ? undefined : controller.reloadExtensions()));
  controller.on('monitors-changed', onMonitors);
  win.on('closed', () => controller.off('monitors-changed', onMonitors));

  const push = (s: unknown) => { if (!win.isDestroyed()) win.webContents.send('openalt:state', s); };
  controller.on('state', push);
  win.on('closed', () => controller.off('state', push));

  void win.loadFile(RENDERER);
}

/**
 * Reinicia o GNOME Shell (X11). Depois que o monitor do aparelho entra ou sai, é o único jeito de o
 * papel de parede voltar; o serviço do Shell recusa reiniciar por comando.
 * 1º: pela extensão do OpenAlt (core/gnome-shell), sem caixa nenhuma e sem simular teclado.
 * Reserva (a extensão ainda não carregou, ex.: 1ª vez, logo depois de instalada): como a pessoa faz
 * à mão, Alt+F2 → r → Enter. Esse reinício já carrega a extensão para as próximas vezes.
 */
let keyGuardUntil = 0;
let restarting = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function shellOwner(): Promise<string> {
  // o GNOME Shell ganha um nome novo no D-Bus quando reinicia: é assim que sabemos que deu certo
  const r = await run('busctl', ['--user', 'call', 'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'GetNameOwner', 's', 'org.gnome.Shell']).catch(() => ({ stdout: '' }));
  return r.stdout.trim();
}
async function ownerChanged(before: string, ms: number): Promise<boolean> {
  for (let t = 0; t < ms; t += 300) {
    await sleep(300);
    const now = await shellOwner();
    if (now && now !== before) return true;
  }
  return false;
}
async function restartShell(win: BrowserWindow): Promise<boolean> {
  if (process.env.XDG_SESSION_TYPE !== 'x11' || win.isDestroyed() || restarting) return false;
  restarting = true;
  try {
    const before = await shellOwner();
    if (!before) return false;
    await sleep(1500); // o GNOME ainda está arrumando os monitores logo depois da troca
    if (await restartShellViaHelper(run)) {
      if (await ownerChanged(before, 10_000)) return true;
      // aceitou e não reiniciou em 10 s: o Shell travou? A caixa do Alt+F2 também não ajudaria.
      return false;
    }
    return await restartWithAltF2(win, before);
  } catch {
    return false;
  } finally {
    restarting = false;
  }
}

/**
 * Alt+F2 → r → Enter. Segurança: antes, a janela do OpenAlt recebe o foco (sem vir para a frente) e
 * ignora teclas por alguns segundos — se a caixa do Alt+F2 não abrir, o "r" e o Enter caem no
 * próprio OpenAlt e não fazem nada, em vez de irem para outro app da pessoa.
 */
async function restartWithAltF2(win: BrowserWindow, before: string): Promise<boolean> {
  if (win.isDestroyed()) return false;
  const id = String(win.getNativeWindowHandle().readUInt32LE(0));
  try {
    await run('xdotool', ['version']);
    // Até 3 tentativas, cada uma esperando mais pela caixa do Alt+F2 (ao conectar ela demora).
    for (let attempt = 1; attempt <= 3; attempt++) {
      keyGuardUntil = Date.now() + 8000;
      // foco no OpenAlt SEM trazer a janela para a frente (windowfocus, não windowactivate)
      await run('xdotool', ['windowfocus', '--sync', id]).catch(() => {});
      await sleep(200);
      await run('xdotool', ['key', '--clearmodifiers', 'alt+F2']);
      await sleep(800 * attempt + 400);
      // "key r", não "type r": o type remapeia o teclado e o GNOME perdia a tecla
      await run('xdotool', ['key', '--clearmodifiers', 'r']);
      // com menos de ~0,4 s a caixa ainda não processou o "r" e o Enter não reinicia (teste ao vivo)
      await sleep(450);
      await run('xdotool', ['key', '--clearmodifiers', 'Return']);
      if (await ownerChanged(before, 6000)) return true;
      // não reiniciou: fecha a caixa, se ficou aberta, e tenta de novo
      await run('xdotool', ['key', '--clearmodifiers', 'Escape']).catch(() => {});
      await sleep(400);
    }
    return false;
  } catch {
    return false;
  } finally {
    setTimeout(() => { keyGuardUntil = 0; }, 1500);
  }
}

/**
 * Links da aba Sobre. A página pede pelo NOME; só estes endereços abrem (no navegador da pessoa,
 * fora do app). Assim uma página comprometida não consegue abrir um endereço qualquer.
 */
export const LINKS: Record<string, string> = {
  openalt: 'https://github.com/berelels/openalt',
  catta: 'https://berelels.github.io',
  'moonlight-android': 'https://github.com/moonlight-stream/moonlight-android',
  'moonlight-common-c': 'https://github.com/moonlight-stream/moonlight-common-c',
  sunshine: 'https://github.com/LizardByte/Sunshine',
  tailscale: 'https://github.com/tailscale/tailscale',
};

// ── canais da interface → controlador (todos conferem a origem; argumentos validados lá) ──
const actions: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  getState: () => controller.state(),
  ligar: () => controller.ligar(),
  desligar: () => controller.desligar(),
  novoQr: () => controller.novoQr(),
  parearPin: (pin, name) => controller.parearPin(pin, name),
  setPlacement: (p) => controller.setPlacement(p),
  setMode: (m) => controller.setMode(m),
  setMirrorOf: (id) => controller.setMirrorOf(id),
  setOrientation: (o) => controller.setOrientation(o),
  setAudio: (v) => controller.setAudio(v),
  setUiScale: (v) => controller.setUiScale(v),
  setPreviewKind: (k) => controller.setPreviewKind(k),
  setPref: (k, v) => controller.setPref(k, v),
  esquecer: (id) => controller.esquecer(id),
  instalarSunshine: () => controller.instalarSunshine(),
  instalarPermissao: () => controller.instalarPermissao(),
  plan: (p, size) => controller.plan(p, size),
  openLink: async (name) => {
    const url = typeof name === 'string' && Object.hasOwn(LINKS, name) ? LINKS[name] : null;
    if (url) await shell.openExternal(url);
  },
};
for (const [name, fn] of Object.entries(actions)) {
  ipcMain.handle(`openalt:${name}`, (e, ...args) => {
    fromOurPage(e);
    return fn(...args.slice(0, 2));
  });
}

ipcMain.handle('window:toggle-fullscreen', (e) => {
  const win = fromOurPage(e);
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle('window:is-fullscreen', (e) => fromOurPage(e).isFullScreen());

app.whenReady().then(async () => {
  await controller.init();
  createWindow();
});
// Fechar o app = Desligar (nada fica ligado escondido)
let quitting = false;
app.on('before-quit', (e) => {
  if (quitting) return;
  e.preventDefault();
  quitting = true;
  void controller.shutdown().finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());

// Processo principal do OpenAlt (Electron). ADR-0011: nenhuma porta aberta; a interface fala
// com este processo só por IPC, e só por canais conhecidos vindos da nossa própria página.
import { app, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron';
import { Controller } from './controller.js';
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

  const push = (s: unknown) => { if (!win.isDestroyed()) win.webContents.send('openalt:state', s); };
  controller.on('state', push);
  win.on('closed', () => controller.off('state', push));

  void win.loadFile(RENDERER);
}

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
  setUiScale: (v) => controller.setUiScale(v),
  setPreviewKind: (k) => controller.setPreviewKind(k),
  setPref: (k, v) => controller.setPref(k, v),
  esquecer: (id) => controller.esquecer(id),
  instalarSunshine: () => controller.instalarSunshine(),
  instalarPermissao: () => controller.instalarPermissao(),
  plan: (p, size) => controller.plan(p, size),
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

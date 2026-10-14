// Grava os quadros do GIF do README e as capturas da imagem de telas, a partir do app de verdade
// (desktop/dist, modo ?demo, em inglês), numa janela invisível. Não mexe na tela de ninguém.
// uso (a partir da raiz, depois de "npm run build -w @openalt/desktop"):
//   npx electron art/readme/record.mjs <pasta de saída>
// Gera <saída>/frames/f0001.png… (10 quadros/s) e <saída>/shots/*.png. art/readme/build.sh faz o resto.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = process.argv.at(-1);
const page = pathToFileURL(join(root, 'desktop', 'dist', 'renderer', 'index.html'));
const FPS = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  mkdirSync(join(out, 'frames'), { recursive: true });
  mkdirSync(join(out, 'shots'), { recursive: true });
  const win = new BrowserWindow({ width: 1366, height: 860, show: false, backgroundColor: '#ff746c', webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(60);
  const js = (code) => win.webContents.executeJavaScript(code);
  const prepare = async (search) => {
    page.search = search;
    await win.loadURL(page.href);
    // inglês, tema claro, e o tour já visto (ele é mostrado à parte, no fim)
    await js(`localStorage.setItem('openalt-lang', 'en'); localStorage.setItem('openalt-theme', 'light'); localStorage.setItem('openalt-tour-done', '1')`);
    await win.loadURL(page.href);
    await win.webContents.insertCSS('#demoBar { display: none !important; }');
  };

  let n = 0;
  /** grava `ms` de vídeo, no tempo real (as animações do app correm de verdade) */
  const record = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const t = Date.now();
      const img = await win.webContents.capturePage();
      writeFileSync(join(out, 'frames', `f${String(++n).padStart(4, '0')}.png`), img.toPNG());
      await sleep(Math.max(0, 1000 / FPS - (Date.now() - t)));
    }
  };
  const click = (sel) => js(`document.querySelector('${sel}')?.click()`);
  const shot = async (name) => writeFileSync(join(out, 'shots', `${name}.png`), (await win.webContents.capturePage()).toPNG());

  // ── o GIF ──
  await prepare('?demo&remote=running');
  await record(6800); // a abertura e o painel entrando
  await record(800);
  await click('[data-p="waiting"]'); // pareamento por QR
  await record(2200);
  await click('[data-dev="tablet"]'); // o tablet conectou: Nova tela
  await record(2000);
  await js(`document.getElementById('placeTitle')?.scrollIntoView({ block: 'center' })`);
  await record(800);
  for (const side of ['below', 'left', 'right']) { // onde o tablet fica
    await click(`[data-side="${side}"]`);
    await record(1100);
  }
  await js(`document.getElementById('view').scrollTop = 0`);
  await click('[data-mode="mirror"]');
  await record(1500);
  await click('[data-mode="extend"]');
  await click('[data-theme-opt="dark"]');
  await record(1600);
  await click('.rail-btn[data-view="pc"]'); // Fora de casa (Tailscale)
  await record(1800);
  await js('startTour()');
  await record(1800);
  await js(`dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`);
  await record(1800);
  await js(`dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`);
  await record(1800);

  // ── as capturas da imagem de telas ──
  await prepare('?demo&nointro&remote=running');
  await click('[data-p="off"]');
  await sleep(1500);
  await shot('dashboard-light');
  await click('[data-theme-opt="dark"]');
  await click('[data-dev="tablet"]');
  await sleep(1500);
  await shot('connected-dark');
  await click('.rail-btn[data-view="pc"]');
  await sleep(1500);
  await shot('away-dark');
  await click('[data-theme-opt="light"]');
  await click('.rail-btn[data-view="home"]');
  await sleep(800);
  await js('startTour()');
  await sleep(1200);
  await shot('tour-light');
  app.quit();
});

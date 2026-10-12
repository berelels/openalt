// Captura quadros da abertura (janela invisível) para revisão.
// uso: electron desktop/scripts/capture-intro.mjs <pasta de saída>
import { app, BrowserWindow } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = process.argv.at(-1);
const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'renderer', 'index.html'));
page.search = '?demo';
// momentos (ms desde o início): desenho, controle, →monitor, monitor, →celular, celular, →logo, logo, cortina…
const marks = [400, 1000, 1400, 1700, 2100, 2500, 2800, 3150, 3500, 3750, 4100, 4400];

app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width: 1280, height: 800, show: false, backgroundColor: '#ff746c', webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(60);
  await win.loadURL(page.href);
  const t0 = Date.now();
  for (const [i, ms] of marks.entries()) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const img = await win.webContents.capturePage();
    writeFileSync(join(out, `${String(i + 1).padStart(2, '0')}-${ms}ms.png`), img.resize({ width: 640 }).toPNG());
  }
  app.quit();
});

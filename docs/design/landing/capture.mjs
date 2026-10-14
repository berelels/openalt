// Gera os PNGs das propostas (1440×900), sem abrir janela na tela.
// uso (de desktop/): npx electron ../docs/design/landing/capture.mjs [arquivo.html ...]
import { app, BrowserWindow } from 'electron';
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const asked = process.argv.slice(2).filter((a) => a.endsWith('.html'));
const pages = asked.length ? asked : readdirSync(here).filter((f) => /^\d\d-.*\.html$/.test(f)).sort();
mkdirSync(join(here, 'png'), { recursive: true });

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1440, height: 900, show: false, useContentSize: true, webPreferences: { offscreen: true } });
  for (const p of pages) {
    await win.loadURL(pathToFileURL(join(here, p)).href);
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await new Promise((r) => setTimeout(r, 600));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1440, height: 900 });
    writeFileSync(join(here, 'png', p.split('/').pop().replace('.html', '.png')), img.toPNG());
    console.log('ok', p);
  }
  app.quit();
});

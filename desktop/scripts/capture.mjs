// Captura as telas do protótipo (modo ?demo) em PNG, para revisão de design.
// uso: electron desktop/scripts/capture.mjs <pasta de saída>
import { app, BrowserWindow } from 'electron';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const out = process.argv.at(-1);
const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'renderer', 'index.html'));
page.search = '?demo&nointro';

const shots = [
  { name: '01-primeira-vez', theme: 'light', clicks: ['[data-p="setup"]'] },
  { name: '02-pronto', theme: 'light', clicks: ['[data-p="off"]'] },
  { name: '03-pronto-escuro-tablet', theme: 'dark', clicks: ['[data-p="off"]', '[data-kind="tablet"]'] },
  { name: '04-qr', theme: 'light', clicks: ['[data-p="waiting"]'] },
  { name: '05-celular-em-pe', theme: 'light', clicks: ['[data-dev="celular"]'] },
  { name: '06-celular-deitado-escuro', theme: 'dark', clicks: ['[data-dev="celular-deitado"]'] },
  { name: '07-tablet-abaixo-do-notebook', theme: 'light', clicks: ['[data-m="um"]', '[data-dev="tablet"]', '[data-side="below"]', '[data-align="center"]'] },
  { name: '08-tres-monitores', theme: 'dark', clicks: ['[data-m="tres"]', '[data-dev="celular"]', '.seg [data-anchor="DP-1"]'] },
  { name: '09-espelhar', theme: 'light', clicks: ['[data-dev="tablet"]', '[data-mode="mirror"]'] },
  { name: '10-aparelhos', theme: 'light', clicks: ['[data-p="off"]', '.rail-btn[data-view="devices"]'] },
  { name: '11-sobre', theme: 'light', clicks: ['[data-p="off"]', '.rail-btn[data-view="about"]'] },
  { name: '12-sobre-es-escuro', theme: 'dark', lang: 'es', clicks: ['[data-p="off"]', '.rail-btn[data-view="about"]'] },
  { name: '13-pronto-en', theme: 'light', lang: 'en', clicks: ['[data-p="off"]'] },
  { name: '14-qr-es', theme: 'light', lang: 'es', clicks: ['[data-p="waiting"]'] },
  { name: '15-tablet-en', theme: 'dark', lang: 'en', clicks: ['[data-dev="tablet"]'] },
];

app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ width: 1366, height: 900, show: false, webPreferences: { offscreen: true } });
  for (const shot of shots) {
    await win.loadURL(page.href);
    // idioma: o do sistema, ou o escolhido (como na aba Sobre); recarrega para valer desde o início
    await win.webContents.executeJavaScript(shot.lang ? `localStorage.setItem('openalt-lang', '${shot.lang}')` : `localStorage.removeItem('openalt-lang')`);
    await win.loadURL(page.href);
    await win.webContents.executeJavaScript(`document.querySelector('[data-theme-opt="${shot.theme}"]').click()`);
    for (const sel of shot.clicks) {
      await win.webContents.executeJavaScript(`document.querySelector('${sel}')?.click()`);
      await new Promise((r) => setTimeout(r, 250));
    }
    await new Promise((r) => setTimeout(r, 1200)); // animações de entrada
    const img = await win.webContents.capturePage();
    writeFileSync(join(out, `${shot.name}.png`), img.toPNG());
  }
  app.quit();
});

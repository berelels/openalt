// Revisão visual do site sem abrir janela: rola a página e tira fotos em várias posições.
// uso (de desktop/): npx electron ../scripts/capture-site.mjs <pasta> [desktop|mobile|reduced] [lang]
import { app, BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [out, kind = 'desktop', lang = 'en'] = process.argv.slice(2).filter((a) => !a.endsWith('.mjs'));
const page = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'index.html')).href;
// 'reduced' = computador com "reduzir movimento" ligado no sistema
if (kind === 'reduced') app.commandLine.appendSwitch('force-prefers-reduced-motion');
const size = kind === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ ...size, useContentSize: true, show: false, webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(30);
  await win.loadURL(page);
  await win.webContents.executeJavaScript(`localStorage.setItem('openalt-site-lang', '${lang}')`);
  await win.loadURL(page);
  await sleep(3500); // a abertura do herói
  const H = await win.webContents.executeJavaScript('document.documentElement.scrollHeight');
  const steps = kind === 'mobile' ? 16 : 14;
  for (let i = 0; i <= steps; i++) {
    const y = Math.round((H - size.height) * i / steps);
    // rola em passos pequenos, como uma pessoa (o scrub do GSAP acompanha)
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${y})`);
    await sleep(1600);
    const img = await win.webContents.capturePage();
    writeFileSync(join(out, `${kind}-${lang}-${String(i).padStart(2, '0')}.png`), img.toPNG());
  }
  console.log('ok', H);
  app.quit();
});

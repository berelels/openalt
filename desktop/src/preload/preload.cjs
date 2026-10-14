// Ponte mínima entre a página e o processo principal (contextBridge, ADR-0011).
// Expõe só funções de alto nível; nada de ipcRenderer cru, comandos ou caminhos.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('openaltWindow', {
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  // labels: os textos do menu da bandeja, já no idioma do app (o processo principal não traduz)
  toTray: (labels) => ipcRenderer.invoke('window:to-tray', labels),
  onFullscreen: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('window:fullscreen', (_e, on) => cb(Boolean(on)));
  },
});

// A API do OpenAlt para a interface: só ações de alto nível (ADR-0011).
const call = (name) => (...args) => ipcRenderer.invoke(`openalt:${name}`, ...args);
contextBridge.exposeInMainWorld('openalt', {
  getState: call('getState'),
  onState: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('openalt:state', (_e, s) => cb(s));
  },
  ligar: call('ligar'),
  desligar: call('desligar'),
  novoQr: call('novoQr'),
  parearPin: call('parearPin'),
  setPlacement: call('setPlacement'),
  setMode: call('setMode'),
  setMirrorOf: call('setMirrorOf'),
  setOrientation: call('setOrientation'),
  setPreviewKind: call('setPreviewKind'),
  setPref: call('setPref'),
  esquecer: call('esquecer'),
  instalarSunshine: call('instalarSunshine'),
  instalarPermissao: call('instalarPermissao'),
  plan: call('plan'),
  remote: call('remote'),
  tailscaleSignIn: call('tailscaleSignIn'),
  openLink: call('openLink'),
});

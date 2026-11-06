const { contextBridge, ipcRenderer } = require('electron');
let listener = null;
ipcRenderer.on('spoty:toggle-play', () => listener?.({ data: JSON.stringify({ event: 'toggle-play' }) }));
ipcRenderer.on('spoty:visibility', (_event, hidden) => listener?.({ data: JSON.stringify({ event: 'visibility', hidden }) }));
contextBridge.exposeInMainWorld('SpotyDesktop', {
  listen(callback) {
    listener = callback;
    ipcRenderer.invoke('spoty:visibility-state').then(hidden => listener?.({ data: JSON.stringify({ event: 'visibility', hidden }) })).catch(() => {});
  },
  postMessage(raw) {
    ipcRenderer.invoke('spoty:command', raw).then(result => listener?.({ data: JSON.stringify(result) })).catch(() => {
      let id; try { id = JSON.parse(raw).id; } catch { return; }
      listener?.({ data: JSON.stringify({ id, error: true }) });
    });
  },
});

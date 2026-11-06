const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('SpotyWindow', {
    action(action) { ipcRenderer.send('spoty:window', { action }); },
    resize(phase, edge) { ipcRenderer.send('spoty:window', { action: 'resize', phase, edge }); },
    listen(callback) { ipcRenderer.on('spoty:window-state', (_event, state) => callback(state)); ipcRenderer.send('spoty:window', { action: 'ready' }); },
});

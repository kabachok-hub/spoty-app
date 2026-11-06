const { app, BaseWindow, WebContentsView, ipcMain, protocol, net, shell, safeStorage, Tray, Menu, nativeImage, nativeTheme, screen } = require('electron');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { assetPath, externalUrl, request, account } = require('./security.cjs');
const { contentBounds, resizeBounds, EDGES } = require('./windowFrame.cjs');
const root = path.join(__dirname, 'renderer'), server = require('./server-config.json').apiOrigin;
let window, page, chrome, tray, quitting = false, drag = null;
protocol.registerSchemesAsPrivileged([{ scheme: 'spoty', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
if (!app.requestSingleInstanceLock())
    app.quit();
else {
    app.on('second-instance', () => { window?.show(); window?.focus(); });
    app.whenReady().then(() => {
        nativeTheme.themeSource = 'dark';
        protocol.handle('spoty', req => {
            const url = new URL(req.url);
            if (url.host !== 'app' || !['GET', 'HEAD'].includes(req.method))
                return new Response('', { status: 403 });
            if (/^\/(uploads|videos)\//.test(url.pathname)) {
                const headers = {};
                for (const key of ['range', 'if-none-match', 'if-modified-since']) {
                    const value = req.headers.get(key);
                    if (value)
                        headers[key] = value;
                }
                return net.fetch(server + url.pathname + url.search, { method: req.method, headers, redirect: 'error' });
            }
            if (['/chrome.html', '/chrome.css', '/chrome.js'].includes(url.pathname))
                return net.fetch(pathToFileURL(path.join(__dirname, url.pathname.slice(1))).href);
            try {
                return net.fetch(pathToFileURL(assetPath(root, req.url)).href);
            }
            catch {
                return new Response('', { status: 404 });
            }
        });
        window = new BaseWindow({ width: 1400, height: 900, minWidth: 360, minHeight: 640, show: false, title: 'Spoty', frame: false, transparent: true, thickFrame: false, hasShadow: true, backgroundColor: '#00000000', icon: path.join(__dirname, 'icon.png') });
        chrome = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'chrome-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
        page = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
        window.contentView.addChildView(chrome);
        window.contentView.addChildView(page);
        chrome.setBackgroundColor('#00000000');
        page.setBackgroundColor('#121212');
        const layout = () => { const [width, height] = window.getContentSize(), expanded = window.isMaximized() || window.isFullScreen(); chrome.setBounds({ x: 0, y: 0, width, height }); page.setBounds(contentBounds(width, height, expanded)); page.setBorderRadius(expanded ? 0 : 10); chrome.webContents.send('spoty:window-state', { maximized: expanded, version: app.getVersion() }); };
        for (const name of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'])
            window.on(name, layout);
        layout();
        ipcMain.on('spoty:window', (event, message) => {
            if (event.sender !== chrome.webContents || event.senderFrame !== chrome.webContents.mainFrame || event.senderFrame.url !== 'spoty://app/chrome.html' || !message)
                return;
            switch (message.action) {
                case 'ready':
                    layout();
                    break;
                case 'minimize':
                    window.minimize();
                    break;
                case 'maximize':
                    drag = null;
                    window.isMaximized() ? window.unmaximize() : window.maximize();
                    break;
                case 'close':
                    window.close();
                    break;
                case 'resize':
                    if (!EDGES.has(message.edge) || window.isMaximized())
                        return;
                    if (message.phase === 'start')
                        drag = { bounds: window.getBounds(), cursor: screen.getCursorScreenPoint(), edge: message.edge, at: Date.now() };
                    else if (message.phase === 'end')
                        drag = null;
                    else if (message.phase === 'move' && drag && drag.edge === message.edge && Date.now() - drag.at < 30000) {
                        const p = screen.getCursorScreenPoint();
                        window.setBounds(resizeBounds(drag.bounds, drag.edge, p.x - drag.cursor.x, p.y - drag.cursor.y), false);
                    }
                    break;
            }
        });
        const contents = page.webContents;
        const hidden = () => window.isMinimized() || !window.isVisible();
        const publishVisibility = () => contents.send('spoty:visibility', hidden());
        for (const name of ['hide', 'show', 'minimize', 'restore']) window.on(name, publishVisibility);
        contents.on('did-finish-load', publishVisibility);
        ipcMain.handle('spoty:visibility-state', event => {
            if (event.sender !== contents || event.senderFrame !== contents.mainFrame)
                throw Error('Untrusted frame');
            return hidden();
        });
        contents.setWindowOpenHandler(({ url }) => { try {
            void shell.openExternal(externalUrl(url));
        }
        catch { } return { action: 'deny' }; });
        contents.on('will-navigate', (event, url) => { if (url === 'spoty://app/index.html')
            return; event.preventDefault(); try {
            void shell.openExternal(externalUrl(url));
        }
        catch { } });
        contents.on('will-redirect', (event, url) => { if (url !== 'spoty://app/index.html')
            event.preventDefault(); });
        contents.on('will-attach-webview', event => event.preventDefault());
        chrome.webContents.on('will-navigate', event => event.preventDefault());
        chrome.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
        ipcMain.handle('spoty:command', (event, raw) => {
            if (event.sender !== contents || event.senderFrame !== contents.mainFrame || event.senderFrame.url !== 'spoty://app/index.html')
                throw Error('Untrusted frame');
            const message = request(raw), filename = path.join(app.getPath('userData'), 'session.bin');
            const read = () => { try {
                return safeStorage.decryptString(fs.readFileSync(filename));
            }
            catch {
                return null;
            } };
            let result = {};
            switch (message.command) {
                case 'vaultGet':
                    result = { token: read() };
                    break;
                case 'vaultSet': {
                    const token = message.data?.token;
                    if (typeof token !== 'string' || !/^[A-Za-z0-9_.-]{20,2048}$/.test(token) || !safeStorage.isEncryptionAvailable())
                        throw Error('Secure storage unavailable');
                    const previous = read();
                    fs.mkdirSync(path.dirname(filename), { recursive: true });
                    fs.writeFileSync(filename + '.tmp', safeStorage.encryptString(token));
                    fs.renameSync(filename + '.tmp', filename);
                    result = { accountChanged: !!previous && account(previous) !== account(token) };
                    break;
                }
                case 'vaultClear':
                    fs.rmSync(filename, { force: true });
                    break;
                case 'openExternal':
                    void shell.openExternal(externalUrl(message.data?.url));
                    break;
            }
            return { id: message.id, result };
        });
        tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 24, height: 24 }));
        tray.setToolTip('Spoty');
        tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Открыть Spoty', click: () => { window.show(); window.focus(); } }, { label: 'Пауза / продолжить', click: () => contents.send('spoty:toggle-play') }, { type: 'separator' }, { label: 'Выйти', click: () => { quitting = true; app.quit(); } }]));
        tray.on('double-click', () => { window.show(); window.focus(); });
        window.on('close', event => { if (!quitting) {
            event.preventDefault();
            window.hide();
        } });
        window.on('closed', () => { contents.close(); chrome.webContents.close(); });
        Promise.all([chrome.webContents.loadURL('spoty://app/chrome.html'), contents.loadURL('spoty://app/index.html')]).then(() => { layout(); window.show(); }).catch(() => window.show());
    });
    app.on('before-quit', () => { quitting = true; });
    app.on('activate', () => window?.show());
}

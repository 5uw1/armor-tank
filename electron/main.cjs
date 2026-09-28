// Windows desktop shell: loads the built game (dist/) in a frameless-feeling window.
const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#15171a',
    autoHideMenuBar: true,
    title: 'Armor Tank',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: { contextIsolation: true, backgroundThrottling: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  // F11 toggles full screen, F12 opens devtools for debugging
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.key === 'F12') win.webContents.toggleDevTools();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

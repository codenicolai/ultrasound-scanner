// main.js
// -------------------------------------------------------------
// Processo principal do Electron.
// Apenas abre uma BrowserWindow carregando o index.html local.
// Mantém a app 100% offline-friendly (só faz fetch direto pra
// API do provider quando você processa uma imagem).
// -------------------------------------------------------------

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'Ultrasson Reader',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Permite que <script type="module"> funcione carregando arquivos locais.
      // Como tudo é local (sem credenciais sensíveis no DOM), está ok.
      sandbox: false,
    },
  });

  // Menu mínimo (mantém atalhos básicos: copiar, colar, recarregar, devtools).
  const template = [
    {
      label: 'Arquivo',
      submenu: [{ role: 'quit', label: 'Sair' }],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'forceReload', label: 'Forçar recarregar' },
        { role: 'toggleDevTools', label: 'Abrir DevTools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom padrão' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Diminuir zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Carrega o index.html que mora ao lado do main.js.
  win.loadFile(path.join(__dirname, 'index.html'));

  // Links externos abrem no navegador padrão, não dentro da janela.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

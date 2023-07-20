const { app, BrowserWindow, ipcMain, Menu, autoUpdater } = require('electron')
const path = require('path')
const log = require('electron-log');
const fs = require('fs-extra');
const { bootMarkEdge } = require("./src/backend/edgeRunner");

log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-logger.log"

let mainWindow;
// autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

async function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
global.window = mainWindow
  try {
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send(`app-version`, app.getVersion());
    });
  } catch (err) {
    console.log(err)
  }
 
  mainWindow.loadFile('./src/ui/index.html')
  bootMarkEdge()

}

app.whenReady().then(() => {
  log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-logger.log"
  const requestHeaders = { 'User-Agent': 'update-electron-app/2.0.1 (win32: x64)' }
  const feedUrl = `https://update.electronjs.org/original4sure/markapp/win32-x64/${app.getVersion()}`
  log.info(`feedUrl ${feedUrl}`)
  autoUpdater.setFeedURL(feedUrl, requestHeaders)
  
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
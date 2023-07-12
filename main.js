const { app, BrowserWindow, ipcMain, Menu, autoUpdater } = require('electron')
// app.commandLine.appendSwitch('remote-allow-origins','http://127.0.0.1:8315')
// app.commandLine.appendSwitch('remote-debugging-port', '8315')
// app.commandLine.appendSwitch('host-rules', 'MAP * 127.0.0.1')
const path = require('path')
const log = require('electron-log');
const fs = require('fs-extra');
const { bootMarkEdge } = require("./edgeRunner");

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
  try {
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send(`app-version`, app.getVersion());
    });
  } catch (err) {
    console.log(err)
  }
  ipcMain.on('set-title', (event, title) => {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    win.setTitle(title)
  })


  // mainWindow.webContents.openDevTools()

  // await mainWindow.loadFile('index.html')
  mainWindow.loadFile('index.html')
  bootMarkEdge(mainWindow, log)

}

app.whenReady().then(() => {
  log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-logger.log"
  const requestHeaders = { 'User-Agent': 'update-electron-app/2.0.1 (win32: x64)' }
  let feedUrl = `https://update.electronjs.org/sachinnagpal/electron-auto-updater/win32-x64/${app.getVersion()}`
  log.info(`feedUrl ${feedUrl}`)
  autoUpdater.setFeedURL(feedUrl, requestHeaders)
  setInterval(() => { autoUpdater.checkForUpdates() }, 6 * 60 * 60 * 1000)
  createWindow()
  // setInterval(alertOnUpdate, 60000);
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
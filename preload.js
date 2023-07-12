const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  setTitle: (title) => ipcRenderer.send('set-title', title)
})

contextBridge.exposeInMainWorld('windowSwitch', {
  openChildWindow: () => ipcRenderer.send('openChildWindow')
})

contextBridge.exposeInMainWorld('updateWindow', {
  open: () => ipcRenderer.send('openUpdateWindow')
})

contextBridge.exposeInMainWorld('windowChange', {
  closeChildWindow: () => ipcRenderer.send('closeChildWindow')
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
});

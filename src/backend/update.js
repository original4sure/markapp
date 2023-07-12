const fs = require('fs-extra');
const constants = require('./constants')
const { app, autoUpdater, dialog } = require('electron');
let log = require('electron-log');
log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-log-edge-runner.log"
const utils = require("./utils")
const installer = require("./installer")
const serviceUtils = require("./serviceUtils")
const path = require('path')


let updatedMarkServicesDownloaded = false
let updatedInstallerDownloaded = false

const updateMark = async function () {
  log.info(`Sending alert for update`)
  utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
    updating: true
  })
  try {
    stopServicesAndAlert()
    let dependecies = await getDependenciesToUpdate()
    await downloadDependenciesAndAlert(dependecies.toUpdate)
    moveDependencies()
    await installDependenciesAndAlert(dependecies.toUpdate)
    installer.updateAppJson(dependecies.toUpdateAppJson)

    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      updating: false,
      "updated-successfully": true
    })
  } catch (err) {
    log.info(err)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      updating: false,
      "updated-successfully": false
    })

    throw err
  }
}

const stopServicesAndAlert = function () {
  try {
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      stoppingServices: true
    })
    log.info(`stopping services`)
    serviceUtils.stopServices()
    log.info(`All the services are stopped`)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      stoppingServices: false,
      "stopped-successfully": true
    })
  } catch (err) {
    log.info(err)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      stoppingServices: false,
      "stopped-successfully": false
    })
    throw err
  }
}

const getDependenciesToUpdate = async function () {
  try {
    let appsToUpdate = []
    let newAppJsonData = []
    let appJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP, "app.json"))
    let updatedManifestPath = path.join(constants.DIRECTORIES.UPDATE, "manifest.json")
    await utils.downloadFile(constants.URLS.MANIFEST_JSON, updatedManifestPath)
    let updatedManifest = fs.readJSONSync(updatedManifestPath)
    let apps = Object.keys(updatedManifest.apps)
    log.info(`Apps ${apps}`)
    let dependenciesInManifest = []
    for (let app of apps) {
      let depenedncies = updatedManifest.apps[app]
      for (let dependency of depenedncies) {
        dependenciesInManifest.push(dependency)
      }
    }

    for (let dependency of appJson) {
      let dependencyFromManifest = dependenciesInManifest.find(dependencyManifest => dependencyManifest.name === dependency.name)
      if (dependencyFromManifest.version != dependency.version) {
        appsToUpdate.push(dependencyFromManifest)
      }
      newAppJsonData.push(dependencyFromManifest)
    }
    log.info(`Services to updated ${JSON.stringify(appsToUpdate), null, 2}`)
    return {
      toUpdate: appsToUpdate,
      toUpdateAppJson: newAppJsonData
    }
  } catch (err) {
    log.info(err)
    throw err
  }
}


const downloadDependenciesAndAlert = async function (dependeciesToUpdate) {
  try {
    log.info(`Sending alert for downloading `)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      downloading: true
    })
    log.info(`Downloading the dependencies`)
    await serviceUtils.downloadDependenciesIfNotDone(dependeciesToUpdate)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      downloading: false,
      "downloaded-sucessfully": true
    })
  } catch (err) {
    log.info(err)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      downloading: false,
      "downloaded-sucessfully": false
    })
    throw err
  }
}



const installDependenciesAndAlert = async function (dependecies) {
  try {
    log.info(`Installing dependencies`)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      installing: true
    })
    log.info(`dependencies to install after update`)
    log.info(JSON.stringify(dependecies))
    for (let dependency of dependecies) {
      await installer.installDependency(dependency)
    }
    log.info(`Installed dependencies`)
    log.info(`Sending alert for installation-successful`)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      installing: false,
      'installation-successful': true
    })
  } catch (err) {
    log.info(`Installed failed `)
    log.info(err)
    utils.sendAlert(constants.UI_ALERT_KEYS.UPDATE, {
      installing: false,
      'installation-successful': false
    })
    throw err
  }
}

const moveDependencies = function () {
  try {
    log.info(`Moving files from update directory to parent directory`)
    fs.readdirSync(constants.DIRECTORIES.UPDATE).forEach(file => {
      utils.moveFile(path.join(constants.DIRECTORIES.UPDATE, file), path.join(constants.DIRECTORIES.APP, file))
    });
  } catch (err) {
    log.info(`Failed to move depenedency ${err.message}`)
    throw err
  }
}
autoUpdater.on("error", (info) => {
  log.info(`autouptater error infor ${info}`)

})

autoUpdater.on("update-available", (info) => {
  log.info("update-available in boot mark edge ")
  log.info(JSON.stringify(info))
  downloadUpdates()
})

const downloadUpdates = async function () {
  try {
    log.info(`Called for downloadUpdates `)
    let res = await getDependenciesToUpdate()
    let dependeciesDownloaded = 0
    if (res.toUpdate.length === 0) {
      updatedMarkServicesDownloaded = true
      sendNotificationToRestart()
      return
    }
    log.info(`res.toUpdate ${res.toUpdate}`)
    for (let dependency of res.toUpdate) {
      log.info(`Traversing dependencies now`)
      let filePath = path.join(constants.DIRECTORIES.UPDATE, utils.extractFileNameFromUrl(dependency))
      log.info(`filePath: ${filePath}`)
      let fileDownloaded = false
      if (fs.existsSync(filePath) && utils.matchChecksum(filePath, dependency.checksum)) {
        fileDownloaded = true
      }
      if (!fileDownloaded) {
        await utils.downloadFile(dependency.url, filePath)
      }
      log.info(`file downloaded ${filePath}`)
      dependeciesDownloaded = dependeciesDownloaded + 1
      if (dependeciesDownloaded === res.toUpdate.length) {
        updatedMarkServicesDownloaded = true
        sendNotificationToRestart()
      }
    }
  } catch(err) {
    log.info(`Failed to download the update`)
    throw err
  }
}

autoUpdater.on("update-not-available", (info) => {
  log.info("update--not-available in boot mark edge ")
  log.info(JSON.stringify(info))
})

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
  log.info('update-downloaded', [event, releaseNotes, releaseName, releaseDate, updateURL])
  updatedInstallerDownloaded = true
  sendNotificationToRestart()
})
const sendNotificationToRestart = function () {
  log.info(`sendNotificationToRestart`)
  log.info(`updatedInstallerDownloaded ${updatedInstallerDownloaded}`)
  log.info(`updatedMarkServicesDownloaded ${updatedMarkServicesDownloaded}`)
  if (updatedInstallerDownloaded && updatedMarkServicesDownloaded) {
    const dialogOpts = {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: 'Application Update',
      message: process.platform === 'win32' ? `Update Available` : `releaseName`,
      detail: 'A new version has been downloaded. Restart the application to apply the updates.'
    }

    dialog.showMessageBox(dialogOpts).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  }
}

module.exports = {
  updateMark
}

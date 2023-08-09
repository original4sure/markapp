const fs = require('fs-extra');
const { app, autoUpdater, dialog } = require('electron');
const path = require('path')
let log = require('electron-log');
log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-log-edge-runner.log"
const utils = require("./utils")
const installer = require("./installer.js")
const constants = require("./constants")
const update = require("./update.js")
const serviceUtils = require("./serviceUtils")

const bootMarkEdge = async function () {
  try {
    let servicesDowloaded = checkIfServicesAllreadyInstalled()
    log.info(`servicesDowloaded ${servicesDowloaded}`)
    await setupMarkCli()
    setupDirectories()
    if (servicesDowloaded) {
      let isUpdateAvailable = await isDirNotEmpty(constants.DIRECTORIES.UPDATE)
      log.info(`isUpdateAvailable ${isUpdateAvailable}`)
      if (isUpdateAvailable) {
        await update.updateMark()
      }
      await startMark()
    } else {
      await installer.installMark()
    }
    await setupAutoStartForMarkApp()
    log.info(`sleeping for 30 seconds and checking update`)
    await utils.sleep(30000)
    autoUpdater.checkForUpdates()
    setInterval(() => { autoUpdater.checkForUpdates() }, 6 * 60 * 60 * 1000)

  } catch (err) {
    log.info(err)
    throw err
  }
}

const setupMarkCli = async function () {
  log.info(`Setting up mark cli`)
  let markCliUrl = "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/mark.ps1"
  let filePath = `C:\\Windows\\System32\\mark.ps1`
  if (!fs.existsSync(filePath)) {
    log.info(`Mark CLI not downloaded!! So donwloading`)
    await utils.downloadFile(markCliUrl, filePath)
  }
}

const startMark = async function () {
  let stoppedDependencies = serviceUtils.getStoppedDependencies()
  if (stoppedDependencies.length > 0) {
    utils.sendAlert(constants.UI_ALERT_KEYS.INSTALLATION, {
      servicesDownloaded: true,
      listedServicesRunning: false,
      startingServices: true
    })

    log.info(`Starting up stopped dependencies`)
    for (let dependency of stoppedDependencies) {
      serviceUtils.startService(dependency)
    }
    log.info(`Sleeping for 6 seconds`)
    await utils.sleep(6000)
    stoppedDependencies = serviceUtils.getStoppedDependencies()
    let dependenciesNotStarted = stoppedDependencies.map(dependency => dependency.name)
    let res = {
      servicesDownloaded: true,
      listedServicesRunning: false,
      servicesNotRunning: dependenciesNotStarted,
      startingServices: false
    }
    if (dependenciesNotStarted.length == 0) {
      res.listedServicesRunning = true
    }

    utils.sendAlert(constants.UI_ALERT_KEYS.INSTALLATION, res)
    log.info(JSON.stringify(res, null, 2))

  } else {
    let res = {
      servicesDownloaded: true,
      listedServicesRunning: true
    }
    utils.sendAlert(constants.UI_ALERT_KEYS.INSTALLATION, res)
    log.info(`All the services are up and running`)
  }
}

async function isDirNotEmpty(dirname) {
  const files = await fs.promises.readdir(dirname);
  return files.length > 0;
}
const setupDirectories = function () {
  if (!fs.existsSync(constants.DIRECTORIES.APP)) {
    log.info(`${constants.DIRECTORIES.APP} doesn't exist so creating one`)
    fs.mkdirSync(constants.DIRECTORIES.APP)
  }
  if (!fs.existsSync(constants.DIRECTORIES.UPDATE)) {
    log.info(`${constants.DIRECTORIES.UPDATE} doesn't exist so creating one`)
    fs.mkdirSync(constants.DIRECTORIES.UPDATE)
  }
}

const checkIfServicesAllreadyInstalled = function () {
  try {
    if (fs.existsSync(path.join(constants.DIRECTORIES.APP, "config.json")) &&
     fs.existsSync(path.join(constants.DIRECTORIES.APP, "app.json"))  && 
     fs.existsSync(`C:\\Windows\\System32\\mark.ps1`)) {
      return true
    }
  } catch (err) {
    log.info(err)
    return false
  }
  return false
}

const setupAutoStartForMarkApp = async function () {
  try {
    await utils.downloadFile(constants.URLS.MARK_APP_START_TASK_XML, path.join(constants.DIRECTORIES.APP, "markAppStartTask.xml"))
    await utils.downloadFile(constants.URLS.MARK_APP_START_FINALIZATION_SCRIPT, path.join(constants.DIRECTORIES.APP, "markAppSetupFinalization.ps1"))
    let result = utils.runSpawnCommand(path.join(constants.DIRECTORIES.APP, "markAppSetupFinalization.ps1"))
    if (!result.success) {
      throw Error('Failed to run the auto setup for mark app')
    }
  } catch (err) {
    log.info(err);
    throw err
  }
}

module.exports = {
  bootMarkEdge
}

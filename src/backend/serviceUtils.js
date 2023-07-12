

const fs = require('fs-extra');
let log = require('electron-log');
const utils = require("./utils")
const constants = require("./constants")
const path = require('path')
const ASCII_MATCH_REGEX = /[^a-zA-Z0-9]/g


const downloadDependency = async function (dependency, type="installing") {
  let fileName = dependency.url.split("/")[dependency.url.split("/").length - 1]
  let filePath
  if(type === "installing") {
    filePath = path.join(constants.DIRECTORIES.APP, fileName)
  } else if(type === "updating") {
    filePath = path.join(constants.DIRECTORIES.UPDATE, fileName)
  }
  let fileDownloaded = false
  if (fs.existsSync(filePath) && utils.matchChecksum(filePath, dependency.checksum)) {
    fileDownloaded = true
  }
  if (!fileDownloaded) {
    log.info(`File not downloaded so donwloading ${dependency.name}`)
    if (dependency.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE && type === "installing") {
      log.info(`Stoping ${dependency.name} `)
      utils.runSpawnCommand(`nssm stop ${dependency.name}`)
    }
    await utils.downloadFile(dependency.url, filePath)
  }
}

const startServices = async function () {
  let appJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP, "app.json"))
  log.info(JSON.stringify(appJson, null, 2))
  for (let dependency of appJson) {
    if (dependency.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE || dependency.type === constants.DEPENDENCY_TYPES.APP_ARCHIVE) {
      log.info(`Running the service now ${dependency.name}`)
      let serviceStarted = startService(dependency)
      if (serviceStarted) {
        utils.sendAlert(constants.UI_ALERT_KEYS.SERVICE, { name: dependency.name, isRunning: true });
      } else {
        utils.sendAlert(constants.UI_ALERT_KEYS.SERVICE, { name: dependency.name, isRunning: false });
      }
    }
  }
}

const startService = function (dependency) {
  if (dependency.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE) {
    let port = getApplicationRunningPort(dependency.name)
    log.info(`port for ${dependency.name} is ${port}`)
    let commandToAssignPort = `netsh advfirewall firewall add rule name=${dependency.name} dir=in action=allow protocol=TCP localport=${port} >$null 2>&1`
    utils.runSpawnCommand(commandToAssignPort)
    let commandToRunService = `nssm start ${dependency.name}`
    let res = utils.runSpawnCommand(commandToRunService)
    if (res.success || (res.data && sanatizeOutput(res.data).includes('alreadyrunning'))) {
      return true
    } else {
      log.info(`Service ${dependency.name} is not running`)
      return false
    }
  } else if (dependency.type === constants.DEPENDENCY_TYPES.APP_ARCHIVE) {
    let port = getApplicationRunningPort(dependency.name)
    let commandToAssignPort = `netsh advfirewall firewall add rule name=${dependency.name} dir=in action=allow protocol=TCP localport=${port} >$null 2>&1`
    utils.runSpawnCommand(commandToAssignPort)
    let dependencyFileName = utils.extractFileNameFromUrl(dependency)
    let dependencyWithExecutableExtension = dependencyFileName.replace("zip", "exe")
    let isAppRunning = appRuning(dependencyWithExecutableExtension)
    if (isAppRunning) {
      log.info(`${dependency.name} is already running`)
      return true
    } else {
      let dependencyFileName = utils.extractFileNameFromUrl(dependency)
      let dependencyWithExecutableExtension = dependencyFileName.replace("zip", "exe")
      let commandToRunService = `Start-Process  ${ path.join(constants.DIRECTORIES.APP, dependencyWithExecutableExtension)} -WindowStyle Hidden`
      log.info(`commandToRunService ${commandToRunService}`)
      let res = utils.runSpawnCommand(commandToRunService)
      log.info(`Res for running app command ${JSON.stringify(res, null, 2)}`)
      return res.success
    }
  }
}

const sanatizeOutput = function(data) {
  return data.replace(ASCII_MATCH_REGEX, '')
}
const stopServices = function () {
  let appJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP , "app.json"))
  for (let dependency of appJson) {
    stopService(dependency)
  }
}
const stopService = function (dependency) {
  log.info(`Stopping service ${dependency.name}`)
  if (dependency.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE) {
    let command = `nssm stop ${dependency.name}`
    utils.runSpawnCommand(command)
  } else if (dependency.type === constants.DEPENDENCY_TYPES.APP_ARCHIVE) {
    let dependencyFileName = utils.extractFileNameFromUrl(dependency)
    let dependencyWithExecutableExtension = dependencyFileName.replace("zip", "exe")
    stopApp(dependencyWithExecutableExtension)
  }
}

const stopApp = function (dependencyFileName) {
  let res = utils.runSpawnCommand(`taskkill /IM ${dependencyFileName} /F`)
  log.info('stopped running app')
  log.info(JSON.stringify(res))
}

const getStoppedDependencies = function () {
  let stoppedDependenies = []
  let appJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP, "app.json"))
  for (let dependency of appJson) {
    if (dependency.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE) {
      let command = `nssm status ${dependency.name}`
      let res = utils.runSpawnCommand(command)
      if (res && res.data && sanatizeOutput(res.data).includes('SERVICERUNNING')) {
        log.info(`Service ${dependency.name} is already running`)
      } else {
        log.info(`Service  ${dependency.name}  not running`)
        stoppedDependenies.push(dependency)
        log.info(JSON.stringify(res))
      }
    } else if (dependency.type === constants.DEPENDENCY_TYPES.APP_ARCHIVE) {
      let dependencyFileName = utils.extractFileNameFromUrl(dependency)
      let dependencyWithExecutableExtension = dependencyFileName.replace("zip", "exe")
      let isAppRunRunning = appRuning(dependencyWithExecutableExtension)
      if (!isAppRunRunning) {
        stoppedDependenies.push(dependency)
      }
      log.info(`isAppRunRunning ${JSON.stringify(isAppRunRunning)}`)
    }
  }
  return stoppedDependenies
}

const downloadDependenciesIfNotDone = async function (dependencies) {
  try {
    for(let dependency of dependencies) {
      await downloadDependency(dependency, "updating")
    }
    log.info(`All files are downloaded`)
  } catch (err) {
    log.info(`Failed to download the dependencies ${err.message}`)
    throw err
  }
}

const appRuning = function (dependencyFileName) {
  let isAppRunRunning = true

  let res = utils.runSpawnCommand(`tasklist /v | findstr /I ${dependencyFileName}`)
  if (res.success && res.data === null) {
    isAppRunRunning = false
  }
  return isAppRunRunning
}

const getApplicationRunningPort = function (dependencyName) {
  try {
    let configJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP, "config.json"))
    let dependencyNameInApp = dependencyName.replaceAll('-', '_')
    dependencyNameInApp = dependencyNameInApp.replaceAll("_UI", "_CLIENT")
    log.info(dependencyNameInApp)
    let port = configJson[dependencyNameInApp].PORT
    return port
  } catch (err) {
    log.info(err)
  }
}

module.exports = {
  downloadDependency,
  startServices,
  startService,
  stopServices,
  stopService,
  appRuning,
  getStoppedDependencies,
  downloadDependenciesIfNotDone
}
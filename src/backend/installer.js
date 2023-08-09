const serviceUtils = require("./serviceUtils")
const constants = require("./constants")
const utils = require("./utils")
const path = require('path')
const { spawnSync } = require("child_process");
const fs = require('fs-extra');
let log = require('electron-log');

let manifestJson
let componentsStatuses = []
let installedDependencies = []


const installMark = async function () {
  // try {}
  setupNssm()
  setExecutionPolicy()
  await utils.downloadFile(constants.URLS.CONFIG_JSON, path.join(constants.DIRECTORIES.APP, "config.json"))
  await utils.downloadFile(constants.URLS.REGISTER_SERVICE, path.join(constants.DIRECTORIES.APP, "register-service.ps1"))
  manifestJson = await downloadManifestJson()
  log.info("Installing components...")
  await downloadAndInstallAllDependencies()
  setEnvironmentVariables()
  await serviceUtils.startServices()
}

const setupNssm = async function () {
  if (fs.existsSync(path.join(constants.DIRECTORIES.SYSTEM, "nssm.exe"))) {
    log.info('nssm already registered')
  } else {
    try {
      await utils.downloadFile(constants.URLS.NSSM_SERVICE, path.join(constants.DIRECTORIES.SYSTEM, "nssm.exe"))
    } catch (err) {
      log.info(`Failed to download the nssm`)
      throw err
    }
  }
}

const setExecutionPolicy = function () {
  let commandToSetExecution = `Set-ExecutionPolicy RemoteSigned -Force`
  let commandToSetExecutionProcess = `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
  utils.runSpawnCommand(commandToSetExecution)
  utils.runSpawnCommand(commandToSetExecutionProcess)
}

const downloadManifestJson = async function () {
  let filePath = path.join(constants.DIRECTORIES.APP, "manifest.json")
  await utils.downloadFile(constants.URLS.MANIFEST_JSON, filePath)
  return fs.readJSONSync(filePath)
}

const downloadAndInstallAllDependencies = async function () {
  let componentsToInstall = getComponentsToInstall()
  try {

    for (let componentName of componentsToInstall) {
      let component = {
        name: componentName,
        installing: false,
        installed: false,
        componentsToInstall: manifestJson.apps[componentName].length,
        componentInstalled: [],
        componentInstallationFailed: []
      }
      componentsStatuses.push(component)
      log.info(`Starting the installation for ${component.name}`)
      component.installing = true
      log.info(`sending data ${JSON.stringify(componentsStatuses)}`)
      sendInstallationAlert(component)
      utils.sendAlert(constants.UI_ALERT_KEYS.DEPENDENCY_RUNNING, componentsStatuses)

      for (let dependency of manifestJson.apps[component.name]) {
        log.info(dependency.name)
        await serviceUtils.downloadDependency(dependency)
        try {
          log.info('installing now')
          await installDependency(dependency)
          component.componentInstalled.push(dependency.name)
          installedDependencies.push(dependency)
          sendInstallationAlert(component)
        } catch (err) {
          component.componentInstallationFailed.push(dependency.name)
          sendInstallationAlert(component)
          throw err
        }
      }
    }
    log.info(installedDependencies)
    updateAppJson(installedDependencies)

  } catch (err) {
    throw err
  }
}

const installDependency = async function (dependency) {
  let dependencyFileName = utils.extractFileNameFromUrl(dependency)
  let dependencyPath = path.join(constants.DIRECTORIES.APP, dependencyFileName)
  log.info(`Installing ${dependency.name}`)
  log.info(`dependency.type ${dependency.type}`)
  try {
    switch (dependency.type) {
      case constants.DEPENDENCY_TYPES.NSSM_SERVICE:
        registerService(dependency)
        break
      case constants.DEPENDENCY_TYPES.MONGO_INSTALLER:
        await installMongSyncWithoutPopup(dependency)
        break
      case constants.DEPENDENCY_TYPES.ARCHIVE:
        await unzipArchive(dependency)
        break
      case constants.DEPENDENCY_TYPES.EXECUTABLE:
        startProcess(dependency)
        break
      case constants.DEPENDENCY_TYPES.APP_ARCHIVE:
        await unzipApp(dependency)
        break
      case constants.DEPENDENCY_TYPES.PS_SCRIPT:
        let res = utils.runSpawnCommand(dependencyPath)
        if (!res.success) {
          throw Error(res.data)
        }
        break
      case constants.DEPENDENCY_TYPES.FILE:
        log.info('No need for installation')
        break
    }
  } catch (err) {
    throw err
  }
}

const registerService = function (dependency) {
  let dependencyFileName = utils.extractFileNameFromUrl(dependency)
  let dependencyPath = path.join(constants.DIRECTORIES.APP, dependencyFileName)
  log.info(`Registering service ${dependency.name}`)
  try {
    let command = `-serviceDisplayName ${dependency.name} -executable ${dependencyPath} -APP_INSTALL_DIR ${constants.DIRECTORIES.APP} -SELECTED_ENV prod -O4S_CONFIG_PATH ${constants.DIRECTORIES.APP}\\config.json`
    let res = utils.runSpawnCommand(`${constants.DIRECTORIES.APP}\\register-service.ps1 ${command}`)
    log.info(`status for command ${constants.DIRECTORIES.APP}\\register-service.ps1 ${command} is ${JSON.stringify(res)}`)
    if (res.success) {
      return true
    } else {
      throw Error(`Registeration for service ${dependency.name} failed `)
    }

  } catch (err) {
    log.info(`Registeration for service ${dependency.name} failed due to ${JSON.stringify(err)}`)
    throw err
  }
}

const uninstallMongo = function () {
  const mongoInstalledCommand = `Get-Service -Name "mongodb"`
  const mongoInstalled = utils.runSpawnCommand(mongoInstalledCommand)
  log.info(`mongoInstalled ${JSON.stringify(mongoInstalled)}`)
  if (!mongoInstalled.success) {
    return
  }
  const uninstallCommand = `& "${constants.DIRECTORIES.MONGO}\\bin\\mongod.exe" --remove`
  utils.runSpawnCommand(uninstallCommand)
  const binDirectory = path.join(constants.DIRECTORIES.MONGO, "bin");
  fs.rmSync(binDirectory, { recursive: true, force: true });
  log.info(`Uninstalled mongo successfully`)
}
const installMongSyncWithoutPopup = async function () {
  uninstallMongo()
  const mongoDbPath = constants.DIRECTORIES.MONGO
  const unzippedFolderContent = path.join(mongoDbPath, "mongodb-win32-x86_64-2012plus-4.2.8")
  const mongoDbConfigPath = path.join(mongoDbPath, "mongod.cfg")
  await createMongoPaths()
  const mongoZipPath = path.join(constants.DIRECTORIES.APP, "mongodb-win32-x86_64-2012plus-4.2.8.zip")
  await utils.extractFiles(mongoZipPath, mongoDbPath)
  log.info(`files are exctracted successfully `)
  try {
    fs.copySync(unzippedFolderContent, mongoDbPath, { overwrite: true })
    log.info("Files are copied")
  } catch (err) {
    log.info(`Failed to copy content`)
    log.info(err)
    throw err
  }
  fs.rmSync(unzippedFolderContent, { recursive: true, force: true });
  let installCommand = `& "${mongoDbPath}\\bin\\mongod.exe" --config "${mongoDbConfigPath}" --install`
  let installCommandRes = utils.runSpawnCommand(installCommand)
  log.info(JSON.stringify(installCommandRes))
  if (!installCommandRes.success) {
    throw new Error(`Mongo Installation failed`)
  }
  log.info(`Mongo installed successfully`)
}

const createMongoPaths = async function () {
  try {
    const mongoDbPath = "C:\\Program Files\\MongoDB\\Server\\4.2"
    const mongoLogPath = path.join(mongoDbPath, 'log')
    const mongoDataPath = path.join(mongoDbPath, 'data')
    fs.ensureDirSync(mongoDbPath)
    fs.ensureDirSync(mongoLogPath)
    fs.ensureDirSync(mongoDataPath)
    const mongoDbConfigPath = path.join(mongoDbPath, "mongod.cfg")
    if (fs.existsSync(mongoDbConfigPath)) {
      log.info(`Mongo config already downloaded`)
    } else {
      await utils.downloadFile("https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/installerV3/mongod.cfg", mongoDbConfigPath)
    }
  } catch (err) {
    log.info(`Failed to setup Mongo directories`)
    throw err
  }
}


const installMongSync = function () {
  try {
    let command = `"${constants.DIRECTORIES.MSI_EXECUTOR}" /l*v mdbinstall.log  /qb /i "${constants.DIRECTORIES.APP}\\mongodb-win32-x86_64-2012plus-4.2.8-signed.msi" SHOULD_INSTALL_COMPASS="0" ADDLOCAL="ServerService,ServerNoService,Client,ImportExportTools"`,
      child = spawnSync(command, {
        shell: true,
        encoding: 'utf-8'
      });
    log.info(`child ${JSON.stringify(child)}`)
    if (child.error || child.stderr) {
      throw Error(`Installation for Mongo failed ${child.error || child.stderr}`)
    } else {
      return true
    }
  } catch (err) {
    throw err
  }
}

const unzipArchive = async function (dependency) {
  try {
    let dependencyFileName = utils.extractFileNameFromUrl(dependency)
    let dependencyPath = path.join(constants.DIRECTORIES.APP, dependencyFileName)

    if (dependency.type === constants.DEPENDENCY_TYPES.APP_ARCHIVE) {
      log.info(`coming for decompress app archive ${dependency.name}`)
      let command = `Expand-Archive -Path ${dependencyPath} -DestinationPath ${constants.DIRECTORIES.APP} -Force -ErrorAction Stop`
      log.info(command)
      let res = utils.runSpawnCommand(command)
      log.info(JSON.stringify(res, null, 2))
      if (res.success) {
        return true
      } else {
        throw Error(`Unzipping of archive ${dependency.name} failed ${res.data}`)
      }
    } else {
      let dependencyPathWithName = path.join(constants.DIRECTORIES.APP, dependency.name)
      if (fs.existsSync(dependencyPathWithName)) {
        log.info(`Deleting ${dependencyPathWithName}`)
        let command = `Remove-Item -Path "${dependencyPathWithName}" -Force -Recurse -ErrorAction Stop`
        let res = utils.runSpawnCommand(command)
        log.info(`res delete stuff ${res}`)
      }
      let command = `Expand-Archive -Path "${dependencyPath}" -DestinationPath "${dependencyPathWithName}" -Force`
      let res = utils.runSpawnCommand(command)
      log.info(`ARCHIVE ` + JSON.stringify(res))
      if (!res.success) {
        throw Error(res.data)
      }
      return true
    }
  } catch (err) {
    log.info(`Could not extract file for ${dependency.name}`)
    log.info(err.message)
    throw Error(err)
  }
}

const startProcess = function (dependency) {
  let dependencyFileName = utils.extractFileNameFromUrl(dependency)
  let dependencyPath = path.join(constants.DIRECTORIES.APP, dependencyFileName)
  log.info(`Starting up the process ${dependencyPath}`)
  let res
  const silentCommand = `Start-Process -Wait -FilePath ${dependencyPath} -ArgumentList /S -PassThru`
  if (dependency.name === "glabels") {
    res = utils.runSpawnCommand(silentCommand)
    command = `[System.Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\\Program Files\\glabels 3.99.0\\bin', [System.EnvironmentVariableTarget]::Machine)`
    let ans = utils.runSpawnCommand(command)
    log.info(JSON.stringify(ans))
  } else if (dependency.name === "NOSQLBOOSTER") {
    res = utils.runSpawnCommand(silentCommand)
  } else {
    res = utils.runSpawnCommand(`Start-Process ${dependencyPath} -Wait`)
  }
  if (!res.success) {
    throw Error(`Start process failed for ${dependency.name}`)
  } else {
    return true
  }
}

const unzipApp = async function (dependency) {
  try {
    let dependencyFileName = utils.extractFileNameFromUrl(dependency)
    let dependencyWithExecutableExtension = dependencyFileName.replace("zip", "exe")
    let isAppRunRunning = serviceUtils.appRuning(dependencyWithExecutableExtension)
    log.info(`isAppRunRunning ${JSON.stringify(isAppRunRunning)}`)
    if (isAppRunRunning) {
      serviceUtils.stopApp(dependencyWithExecutableExtension)
    }
    log.info(`unarchiving label`)
    await unzipArchive(dependency)
  } catch (err) {
    log.info(err)
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


const setEnvironmentVariables = function () {
  try {
    let env = "prod"
    let logLevel = `info`
    let appJson = fs.readJSONSync(path.join(constants.DIRECTORIES.APP, "app.json"))
    let nssmServices = appJson.filter(app => app.type === constants.DEPENDENCY_TYPES.NSSM_SERVICE)
    log.info(JSON.stringify(nssmServices), null, 2)
    utils.sendAlert(constants.UI_ALERT_KEYS.ENVIRONMENT_SETUP, { configuring: true })
    for (let service of nssmServices) {
      let command = `nssm set ${service.name} AppEnvironmentExtra NODE_ENV=${env} O4S_CONFIG_PATH=${path.join(constants.DIRECTORIES.APP, "config.json")} LOG_LEVEL=${logLevel} >$null 2>&1`
      utils.runSpawnCommand(command)
    }
    setWindowsEnvironmentVariables('NODE_ENV', env)
    setWindowsEnvironmentVariables('O4S_CONFIG_PATH', path.join(constants.DIRECTORIES.APP, "config.json"))
    setWindowsEnvironmentVariables('LOG_LEVEL', logLevel)
    utils.sendAlert(constants.UI_ALERT_KEYS.ENVIRONMENT_SETUP, {
      configuring: false,
      configuredSuccessfully: true
    })
  } catch (err) {
    log.error(`Failed to setup the env variables`)
    utils.sendAlert(constants.UI_ALERT_KEYS.ENVIRONMENT_SETUP, {
      configuring: false,
      configuredSuccessfully: false
    })
    throw err
  }
}

const setWindowsEnvironmentVariables = function (key, value) {
  let command = `[System.Environment]::SetEnvironmentVariable('${key}', '${value}', [System.EnvironmentVariableTarget]::User)`
  utils.runSpawnCommand(command)
}


const sendInstallationAlert = function (component) {
  log.info(component)
  if (component.componentsToInstall === component.componentInstalled.length + component.componentInstallationFailed.length) {
    log.info(`Sending Alert`)
    component.installing = false
    utils.sendAlert(constants.UI_ALERT_KEYS.DEPENDENCY_RUNNING, componentsStatuses)
  } else if (component.componentInstallationFailed.length > 0) {
    log.info(`Sending Alert`)
    component.installing = false
    utils.sendAlert(constants.UI_ALERT_KEYS.DEPENDENCY_RUNNING, componentsStatuses)
  }
}

const getComponentsToInstall = function () {
  return Object.keys(manifestJson.apps)
}

const updateAppJson = function (dependencies) {
  fs.writeFileSync(path.join(constants.DIRECTORIES.APP, "app.json"), JSON.stringify(dependencies, null, 2), {
    encoding: 'utf-8'
  })
}
module.exports = {
  installMark,
  appRuning,
  installDependency,
  updateAppJson
}
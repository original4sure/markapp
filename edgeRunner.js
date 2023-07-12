const https = require('https');
const fs = require('fs-extra');
const util = require("util")
const { spawn, execFileSync, execFile, spawnSync, execSync } = require("child_process");
const exec = util.promisify(require('child_process').exec)
const { createHash } = require("crypto");
const { app, autoUpdater, dialog } = require('electron');
let log = require('electron-log');
log.transports.file.resolvePath = () => "C:\\ProgramData\\O4S\\logs\\bootapp-log-edge-runner.log"
const { constants, runSpawnCommand } = require("./utils");

let manifestJson
let mainWindow
let serviceTriggered = false
let statusSent = false
let componentsStatuses = []
let updatedMarkServicesDownloaded = false
let updatedInstallerDownloaded = false
let installedDependencies = []

const bootMarkEdge = async function (window, log) {
  mainWindow = window
  log = log

  try {
    let servicesDowloaded = checkIfServicesAllreadyInstalled()
    log.info(`servicesDowloaded ${servicesDowloaded}`)
    await setupMarkCli()
    setupDirectories()
    if (servicesDowloaded) {
      setEnvironmentVariables()
      await runMarkIfAlreadyInstalled()
    } else {
      setupNssm()
      setExecutionPolicy()

      await downloadConfigJson()
      await downloadRegisterServiceScript()
      manifestJson = await downloadManifestJson()
      log.info("Installing components...")
      await downloadAndInstallAllDependencies()
      setEnvironmentVariables()
      await startServices()
    }
    log.info(`sleeping for 30 seconds anc checking update`)
    await sleep(30000)
    autoUpdater.checkForUpdates()

  } catch (err) {
    log.info(err)
  }
}

const setupMarkCli = async function () {
  log.info(`Setting up mark cli`)
  let markCliUrl = "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/mark.ps1"
  let filePath = `C:\\Windows\\System32\\mark.ps1`
  if (!fs.existsSync(filePath)) {
    log.info(`Mark CLI not downloaded!! So donwloading`)
    await downloadFile(markCliUrl, filePath)
  }
}
const runMarkIfAlreadyInstalled = async function () {
  let dependenciesNotStarted = []
  let isUpdateAvailable = await isDirEmpty(constants.updateDirectory)
  log.info(isUpdateAvailable)
  if (isUpdateAvailable) {
    log.info(`Sending alert for update`)
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send('update:status', {
        updating: true
      });
    });

    try {
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          stoppingServices: true
        });
      });
      log.info(`stopping services`)
      stopServices()
      log.info(`All the services are stopped`)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          stoppingServices: false,
          "stopped-successfully": true
        });
      });
    } catch (err) {
      log.info(err)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          stoppingServices: false,
          "stopped-successfully": false
        });
      });
      throw err
    }

    let dependecies = await getDependenciesToUpdate()
    log.info(`dependencies to update`)
    log.info(JSON.stringify(dependecies.toUpdate, null, 2))
    try {
      log.info(`Sending alert for downloading `)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          downloading: true
        });
      });
      log.info(`Downloading the dependencies`)
      await downloadDependencies(dependecies.toUpdate)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          downloading: false,
          "downloaded-sucessfully": true
        });
      });
    } catch (err) {
      log.info(err)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          downloading: false,
          "downloaded-sucessfully": false
        });
      });
      throw err
    }
    log.info(`Moving dependenices`)
    moveDependencies()
    try {
      log.info(`Installing dependencies`)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          installing: true
        });
      });

      mainWindow.webContents.send('update:status', {
        installing: true
      });
      for (let dependency of dependecies.toUpdate) {
        await installDependency(dependency)
      }
      log.info(`Installed dependencies`)
      log.info(`Sending alert for installation-successful`)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          installing: false,
          'installation-successful': true
        });
      });

      mainWindow.webContents.send('update:status', {
        installing: false,
        'installation-successful': true
      });
    } catch (err) {
      log.info(`Installed failed `)
      log.info(err)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          installing: false,
          'installation-successful': false
        });
      });
      throw err
    }
    log.info(`Sending alert for update sucessful`)
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send('update:status', {
        updating: false,
        "updated-successfully": true
      });
    });
    fs.writeFileSync(constants.appDirectory + "app.json", JSON.stringify(dependecies.toUpdateAppJson, null, 2), {
      encoding: 'utf-8'
    })
  }
  let stoppedDependenies = getStoppedDependencies()
  log.info(`stoppedDependenies lenth ${stoppedDependenies.length}`)
  if (stoppedDependenies.length > 0) {
    if (isUpdateAvailable) {
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', {
          'restarting-services': true,
        });
      });
      mainWindow.webContents.send('update:status', {
        'restarting-services': true,
      });
    } else {
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('installation:status', {
          servicesDownloaded: true,
          listedServicesRunning: false,
          startingServices: true
        });
      });
    }


    log.info(`Starting up stopped dependencies`)
    for (let dependency of stoppedDependenies) {
      startService(dependency)
      await sleep(4000)
      let serviceRunning = isServiceRunning(dependency)
      if (!serviceRunning) {
        dependenciesNotStarted.push(dependency.name)
      }
    }
    if (dependenciesNotStarted.length > 0) {
      res = {
        servicesDownloaded: true,
        listedServicesRunning: false,
        servicesNotRunning: dependenciesNotStarted,
        startingServices: false
      }
    } else {
      res = {
        servicesDownloaded: true,
        listedServicesRunning: true,
        servicesNotRunning: dependenciesNotStarted,
        startingServices: false
      }
    }

    if (isUpdateAvailable) {
      // update-installation-successful
      // restarting-service
      let result = {
        "restarting-services": false,
        "update-installation-successful": res.listedServicesRunning
      }
      log.info(`result ${JSON.stringify(result, null, 2)} `)
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('update:status', result);
      });
      mainWindow.webContents.send('update:status', result)
    } else {
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send('installation:status', res);
      });
      mainWindow.webContents.send('installation:status', res)
    }

    log.info(`These services are not yet started`)
    log.info(JSON.stringify(res, null, 2))

  } else {
    let res = {
      servicesDownloaded: true,
      listedServicesRunning: true
    }
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send('installation:status', res);
    });
    mainWindow.webContents.send('installation:status', res)
    log.info(`All the services are up and running`)
  }
}

async function isDirEmpty(dirname) {
  const files = await fs.promises.readdir(dirname);
  return files.length > 0;
}
const setupDirectories = function () {
  if (!fs.existsSync(constants.appDirectory)) {
    log.info(`${constants.appDirectory} doesn't exist so creating one`)
    fs.mkdirSync(constants.appDirectory)
  }
  if (!fs.existsSync(constants.updateDirectory)) {
    log.info(`${constants.updateDirectory} doesn't exist so creating one`)
    fs.mkdirSync(constants.updateDirectory)
  }
}

const setupNssm = async function () {
  if (fs.existsSync(`${constants.systemDirectory}nssm.exe`)) {
    log.info('nssm already registered')
  } else {
    let nssmURL = "https://mark-assets.s3.ap-south-1.amazonaws.com/nssm.exe"
    try {
      await downloadFile(nssmURL, `${constants.systemDirectory}nssm.exe`)
    } catch (err) {
      log.info(`Failed to download the nssm`)
      throw err
    }
  }
}

const setExecutionPolicy = function () {
  let commandToSetExecution = `Set-ExecutionPolicy RemoteSigned -Force`
  let commandToSetExecutionProcess = `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
  runSpawnCommand(commandToSetExecution)
  runSpawnCommand(commandToSetExecutionProcess)
}

const checkIfServicesAllreadyInstalled = function () {
  if (fs.existsSync(`${constants.appDirectory}config.json`) && fs.existsSync(`${constants.appDirectory}app.json`)) {
    return true
  }
  return false
}
const downloadConfigJson = async function () {
  let filePath = `${constants.appDirectory}config.json`
  await downloadFile(constants.configJsonUrl, filePath)
}

const downloadRegisterServiceScript = async function () {
  let filePath = `${constants.appDirectory}register-service.ps1`
  await downloadFile(constants.registerServiceUrl, filePath)
}
const downloadManifestJson = async function () {
  let filePath = `${constants.appDirectory}manifest.json`
  await downloadFile(constants.manifestUrl, filePath)
  return fs.readJSONSync(filePath)
}

const getComponentsToInstall = function () {
  return Object.keys(manifestJson.apps)
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
      mainWindow.webContents.on('did-finish-load', function () {
        mainWindow.webContents.send(`dependency-running:status`, componentsStatuses);
      });
      log.info(`sending data ${JSON.stringify(componentsStatuses)}`)
      mainWindow.webContents.send(`dependency-running:status`, componentsStatuses);
      for (let dependency of manifestJson.apps[component.name]) {
        await downloadDependency(dependency)
        try {
          await installDependency(dependency)
          component.componentInstalled.push(dependency.name)
          installedDependencies.push(dependency)
          sendAlert(component)
        } catch (err) {
          component.componentInstallationFailed.push(dependency.name)
          sendAlert(component)
          throw err
        }
      }
    }
    log.info(installedDependencies)
    fs.writeFileSync(constants.appDirectory + "app.json", JSON.stringify(installedDependencies, null, 2), {
      encoding: 'utf-8'
    })

  } catch (err) {
    log.info("coming here")
    // log.info(err)
    throw err
  }
}

const downloadDependency = async function (depedency) {
  let fileName = dependency.url.split("/")[dependency.url.split("/").length - 1]
  let filePath = constants.appDirectory + fileName
  let fileDownloaded = false
  if (fs.existsSync(filePath)) {
    let md5HashofFile = createHash("md5").update(fs.readFileSync(filePath)).digest("hex")
    if (md5HashofFile.toUpperCase() === dependency.checksum) {
      log.info(`${fileName} already downloaded`)
      fileDownloaded = true
    }
  }
  if (!fileDownloaded) {
    log.info(`File not downloaded so donwloading ${dependency.name}`)
    if (dependency.type === constants.dependencyTypes.NSSM_SERVICE) {
      log.info(`Stoping ${dependency.name} `)
      runSpawnCommand(`nssm stop ${dependency.name}`)
    }
    await downloadFile(dependency.url, filePath)
  }
}

const installDependency = async function (dependency) {
  let dependencyWithExtension = dependency.url.split("/")[dependency.url.split("/").length - 1]
  let dependencyPath = `${constants.appDirectory}${dependencyWithExtension}`
  log.info(`Installing ${dependency.name}`)
  log.info(`dependency.type ${dependency.type}`)
  try {
    switch (dependency.type) {
      case constants.dependencyTypes.NSSM_SERVICE:
        registerService(dependency)
        break
      case constants.dependencyTypes.MSI_INSTALLER:
        installMSIFiles(dependency)
        break
      case constants.dependencyTypes.ARCHIVE:
        await unzipArchive(dependency)
        break
      case constants.dependencyTypes.EXECUTABLE:
        startProcess(dependency)
        break
      case constants.dependencyTypes.APP_ARCHIVE:
        await unzipApp(dependency)
        break
      case constants.dependencyTypes.PS_SCRIPT:
        let res = runSpawnCommand(dependencyPath)
        if (!res.success) {
          throw Error(res.data)
        }
        break
      case constants.dependencyTypes.FILE:
        log.info('No need for installation')
        break
    }
  } catch (err) {
    throw err
  }
}
const registerService = function (dependency) {
  let dependencyWithExtension = dependency.url.split("/")[dependency.url.split("/").length - 1]
  let dependencyPath = `${constants.appDirectory}\\${dependencyWithExtension}`
  log.info(`Registering service ${dependency.name}`)
  try {
    let command = `-serviceDisplayName ${dependency.name} -executable ${dependencyPath} -APP_INSTALL_DIR ${constants.appDirectory} -SELECTED_ENV DEV -O4S_CONFIG_PATH ${constants.appDirectory}config.json`
    // -serviceDisplayName SERIALIZER-BACKEND -executable C:\ProgramData\O4S\serializer-backend.exe -APP_INSTALL_DIR C:\ProgramData\O4S -SELECTED_ENV DEV -O4S_CONFIG_PATH C:\ProgramData\O4S\config.json
    // log.info(`Running the command ${command}`)
    // runSpawnCommand(command)
    let res = runSpawnCommand(`${constants.appDirectory}register-service.ps1 ${command}`)
    log.info(`status for command ${constants.appDirectory}register-service.ps1 ${command} is ${JSON.stringify(res)}`)
    if (res.success) {
      return true
      // component.componentInstalled.push(dependency.name)
      // installedDependencies.push(dependency)
      // sendAlert(component)
    } else {
      // component.componentInstallationFailed.push(dependency.name)
      // log.info("Coming to else part of registering service")
      // sendAlert(component)
      throw Error(`Registeration for service ${dependency.name} failed `)
    }

  } catch (err) {
    log.info(`Registeration for service ${dependency.name} failed due to ${JSON.stringify(err)}`)
    throw err
  }

}

const installMSIFiles = function (dependency) {
  if (dependency.name === 'MONGO') {
    installMongSync(dependency)
  } else {
    log.info(`Ignoring Unknown dependency ${dependency.name}`)
  }
}

const installMongSync = function () {
  try {
    let command = `"${constants.msiExecuter}" /l*v mdbinstall.log  /qb /i "${constants.appDirectory}\\mongodb-win32-x86_64-2012plus-4.2.8-signed.msi" SHOULD_INSTALL_COMPASS="0" ADDLOCAL="ServerService,ServerNoService,Client,ImportExportTools"`,
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

const unzipArchive = async function (dependency, component) {
  try {
    let dependencyWithExtension = getDepedencyWithExtension(dependency)
    let dependencyPath = `${constants.appDirectory}\\${dependencyWithExtension}`
    if (fs.existsSync(constants.appDirectory + dependencyPath)) {
      log.info(`File exist ${constants.appDirectory + dependencyPath}`)
      fs.unlinkSync(constants.appDirectory + dependencyPath)
    }
    if (dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
      log.info(`coming for decompress app archive ${dependency.name}`)
      let command = `Expand-Archive -Path ${constants.appDirectory}${dependencyWithExtension} -DestinationPath ${constants.appDirectory} -Force -ErrorAction Stop`
      log.info(command)
      let res = runSpawnCommand(command)
      log.info(JSON.stringify(res, null, 2))
      if (res.success) {
        return true
        // component.componentInstalled.push(dependency.name)
        // installedDependencies.push(dependency)
      } else {
        throw Error(`Unzipping of archive ${dependency.name} failed ${res.data}`)
        // component.componentInstallationFailed.push(dependency.name)
        // install.push(dependency)
      }
      // await decompress(constants.appDirectory + dependencyWithExtension, constants.appDirectory)

    } else {
      if (fs.existsSync(constants.appDirectory + dependency.name)) {
        log.info(`Deleting ${constants.appDirectory + dependency.name}`)
        let command = `Remove-Item -Path "${constants.appDirectory + dependency.name}" -Force -Recurse -ErrorAction Stop`
        let res = runSpawnCommand(command)
        log.info(`res delete stuff ${res}`)
        // fs.unlinkSync(constants.appDirectory + dependencyName)
      }
      let command = `Expand-Archive -Path "${constants.appDirectory + dependencyWithExtension}" -DestinationPath "${constants.appDirectory + dependency.name}" -Force`
      let res = runSpawnCommand(command)
      log.info(`ARCHIVE ` + JSON.stringify(res))
      if (res && res.success) {
        // component.componentInstalled.push(dependency.name)
        // installedDependencies.push(dependency)
        // sendAlert(component)
      } else {
        component.componentInstallationFailed.push(dependency.name)
        sendAlert(component)
        throw Error(res.data)
        // sendAlert(component)
      }
      fs.unlinkSync(constants.appDirectory + dependencyWithExtension)
      // sendAlert(component)
      return true
      // await decompress(constants.appDirectory + dependencyWithExtension, constants.appDirectory + dependencyName)
    }
  } catch (err) {
    log.info(`Could not extract file for ${dependency.name}`)
    log.info(err.message)
    // component.componentInstallationFailed.push(dependency.name)
    // sendAlert(component)
    throw Error(err)
  }
}

const startProcess = function (dependency) {
  let dependencyWithExtension = getDepedencyWithExtension(dependency)
  let dependencyPath = `${constants.appDirectory}${dependencyWithExtension}`
  log.info(`Starting up the process ${dependencyPath}`)
  let res = runSpawnCommand(`Start-Process ${dependencyPath} -Wait`)
  if (res && !res.success) {
    // component.componentInstallationFailed.push(dependency.name)
    // sendAlert(component)
    throw Error(`Start process failed for ${dependency.name}`)
  } else {
    return true
    // installedDependencies.push(dependency)
    // component.componentInstalled.push(dependency.name)
  }
  sendAlert(component)
  log.info(`Status for dependency ${dependencyPath} ${JSON.stringify(res)}`)
}

const unzipApp = async function (dependency) {
  try {
    let dependencyWithExtension = getDepedencyWithExtension(dependency)
    let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")

    let isAppRunRunning = appRuning(dependencyWithExecutableExtension)
    log.info(`isAppRunRunning ${JSON.stringify(isAppRunRunning)}`)
    if (isAppRunRunning) {
      stopApp(dependencyWithExecutableExtension)
    }
    log.info(`unarchiving label`)
    await unzipArchive(dependency)
  } catch (err) {
    log.info(err)
  }
}


const appRuning = function (dependencyWithExtension) {
  let isAppRunRunning = true

  let res = runSpawnCommand(`tasklist /v | findstr /I ${dependencyWithExtension}`)
  if (res.success && res.data === null) {
    isAppRunRunning = false
  }
  return isAppRunRunning
}

const stopApp = function (dependencyWithExtension) {
  let res = runSpawnCommand(`taskkill /IM ${dependencyWithExtension} /F`)
  log.info('stopped running app')
  log.info(JSON.stringify(res))
}

const sendAlert = function (component) {
  log.info(`called send alrt`)
  log.info(JSON.stringify(componentsStatuses))
  log.info(JSON.stringify(component))
  if (component.componentsToInstall === component.componentInstalled.length + component.componentInstallationFailed.length) {
    log.info(`Sending Alert`)
    component.installing = false
    mainWindow.webContents.send(`dependency-running:status`, componentsStatuses);
  } else if (component.componentInstallationFailed.length > 0) {
    log.info(`Sending Alert`)
    component.installing = false
    mainWindow.webContents.send(`dependency-running:status`, componentsStatuses);
  }
}

const setEnvironmentVariables = function () {
  let env = "DEV"
  let logLevel = `info`
  let appJson = fs.readJSONSync(`${constants.appDirectory}app.json`)
  let nssmServices = appJson.filter(app => app.type === constants.dependencyTypes.NSSM_SERVICE)
  log.info(JSON.stringify(nssmServices), null, 2)
  for (let service of nssmServices) {
    let command = `nssm set ${service.name} AppEnvironmentExtra NODE_ENV=${env} O4S_CONFIG_PATH=${constants.appDirectory}config.json LOG_LEVEL=${logLevel} >$null 2>&1`
    runSpawnCommand(command)
  }
  setWindowsEnvironmentVariables('NODE_ENV', env)
  setWindowsEnvironmentVariables('O4S_CONFIG_PATH', `${constants.appDirectory}config.json`)
  setWindowsEnvironmentVariables('LOG_LEVEL', logLevel)
}

const setWindowsEnvironmentVariables = function (key, value) {
  let command = `[System.Environment]::SetEnvironmentVariable('${key}', '${value}', [System.EnvironmentVariableTarget]::User)`
  runSpawnCommand(command)
}
const startServices = async function () {
  let appJson = fs.readJSONSync(`${constants.appDirectory}app.json`)
  // let appJson = fs.readJSONSync(`./app.json`)
  log.info(JSON.stringify(appJson, null, 2))
  for (let dependency of appJson) {
    if (dependency.type === constants.dependencyTypes.NSSM_SERVICE || dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
      log.info(`Running the service now ${dependency.name}`)
      let serviceStarted = startService(dependency)
      if (serviceStarted) {
        mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: true });
      } else {
        mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: false });
      }
    }
  }
}

const startService = function (dependency) {
  if (dependency.type === constants.dependencyTypes.NSSM_SERVICE) {
    let port = getApplicationRunningPort(dependency.name)
    log.info(`port for ${dependency.name} is ${port}`)
    let commandToAssignPort = `netsh advfirewall firewall add rule name=${dependency.name} dir=in action=allow protocol=TCP localport=${port} >$null 2>&1`
    runSpawnCommand(commandToAssignPort)
    let commandToRunService = `nssm start ${dependency.name}`
    let res = runSpawnCommand(commandToRunService)
    // log.info(`Res for running nssm service ${JSON.stringify(res, null, 2)}`)
    const ASCII_MATCH_REGEX = /[^a-zA-Z0-9]/g
    if (res.success || (res.data && res.data.replace(ASCII_MATCH_REGEX, '').includes('alreadyrunning'))) {
      return true
      // mainWindow.webContents.on('did-finish-load', function () {
      //   mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:true});

      // });
      mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: true });
      // mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:true})
      // mainWindow.webContents.send(`${serviceName}:status', 'Downloading ${serviceName} asd`);
      // mainWindow.
    } else {
      log.info(`Service ${dependency.name} is not running`)
      return false
      // mainWindow.webContents.on('did-finish-load', function () {
      //   mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:false});
      // });
      mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: false });
    }
  } else if (dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
    // log.info(`coming for label backed`)
    let port = getApplicationRunningPort(dependency.name)
    // log.info(`port for ${dependency.name} is ${port}`)
    let commandToAssignPort = `netsh advfirewall firewall add rule name=${dependency.name} dir=in action=allow protocol=TCP localport=${port} >$null 2>&1`
    runSpawnCommand(commandToAssignPort)
    let dependencyWithExtension = dependency.url.split("/")[dependency.url.split("/").length - 1]
    let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")
    let isAppRunning = appRuning(dependencyWithExecutableExtension)
    if (isAppRunning) {
      log.info(`${dependency.name} is already running`)
      return true
      // mainWindow.webContents.on('did-finish-load', function () {
      //   mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:true});
      // });
      mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: true });
    } else {
      let dependencyWithExtension = getDepedencyWithExtension(dependency)
      let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")
      let commandToRunService = `Start-Process ${constants.appDirectory}${dependencyWithExecutableExtension} -WindowStyle Hidden`
      log.info(`commandToRunService ${commandToRunService}`)
      let res = runSpawnCommand(commandToRunService)
      log.info(`Res for running app command ${JSON.stringify(res, null, 2)}`)
      if (res.success) {
        log.info(`App ${dependency.name} running`)
        return true
        // mainWindow.webContents.on('did-finish-load', function () {
        //   mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:true});
        // });
        mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: true });
      } else {
        // mainWindow.webContents.on('did-finish-load', function () {
        //   mainWindow.webContents.send(`service:status`, {name: dependency.name, isRunning:false});
        // });
        return false
        mainWindow.webContents.send(`service:status`, { name: dependency.name, isRunning: false });
        log.info(`App ${dependency.name} is not running`)
      }
    }
    // 

  }
}
const stopServices = function () {
  let appJson = fs.readJSONSync(`${constants.appDirectory}app.json`)
  for (let dependency of appJson) {
    stopService(dependency)
  }
}
const stopService = function (dependency) {
  log.info(`Stopping service ${dependency.name}`)
  if (dependency.type === constants.dependencyTypes.NSSM_SERVICE) {
    let command = `nssm stop ${dependency.name}`
    runSpawnCommand(command)
  } else if (dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
    let dependencyWithExtension = getDepedencyWithExtension(dependency)
    let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")
    stopApp(dependencyWithExecutableExtension)
  }
}

const getDependenciesToUpdate = async function () {
  // let componentstoInstall = getComponentsToInstall()
  log.info(`getDependenciesToUpdate`)
  try {
    let appsToUpdate = []
    let newAppJsonData = []
    let appJson = fs.readJSONSync(`${constants.appDirectory}app.json`)
    let updatedManifestPath = `${constants.updateDirectory}manifest.json`
    // let latestManifestDownloaded = false
    await downloadFile(manifestUrl, updatedManifestPath)
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
      let dependencyFromManifest = dependenciesInManifest.filter(dependencyManifest => dependencyManifest.name === dependency.name)
      if (dependencyFromManifest[0].version != dependency.version) {
        appsToUpdate.push(dependencyFromManifest[0])
      }
      newAppJsonData.push(dependencyFromManifest[0])
    }
    return {
      toUpdate: appsToUpdate,
      toUpdateAppJson: newAppJsonData
    }
  } catch (err) {
    log.info('coming to err')
    log.info(err)
    throw err
  }
}
const downloadDependencies = async function (dependeciesToUpdate) {
  try {
    let filesDownloded = []
    fs.readdirSync(constants.updateDirectory).forEach(file => {
      console.log(file);
      filesDownloded.push(file)
    });
    if (dependeciesToUpdate.length + 1 === filesDownloded.length) {
      for (let dependency of dependeciesToUpdate) {
        let fileName = getDepedencyWithExtension(dependency)
        let filePath = constants.updateDirectory + fileName
        let fileDownloaded = false
        if (fs.existsSync(filePath)) {
          let md5HashofFile = createHash("md5").update(fs.readFileSync(filePath)).digest("hex")
          if (md5HashofFile.toUpperCase() === dependency.checksum) {
            log.info(`${fileName} already downloaded`)
            fileDownloaded = true
          }
        }
        if (!fileDownloaded) {
          await downloadFile(dependency.url, filePath)
        }
      }
      return true
    }
  } catch (err) {
    log.info(`Failed to check if  depenedency is downloaded ${err.message}`)
    throw err
  }
}
const moveDependencies = function () {
  try {
    log.info(`Moving files from update directory to parent directory`)
    fs.readdirSync(`${constants.updateDirectory}`).forEach(file => {
      console.log(file);
      fs.renameSync(`${constants.updateDirectory}${file}`, `${constants.appDirectory}${file}`)
    });
  } catch (err) {
    log.info(`Failed to move depenedency ${err.message}`)
  }
}
const getApplicationRunningPort = function (dependencyName) {
  try {
    let configJson = fs.readJSONSync(`${constants.appDirectory}config.json`)
    // let configJson = fs.readJSONSync(`./config.json`)
    let dependencyNameInApp = dependencyName.replaceAll('-', '_')
    dependencyNameInApp = dependencyNameInApp.replaceAll("_UI", "_CLIENT")
    log.info(dependencyNameInApp)
    let port = configJson[dependencyNameInApp].PORT
    return port
  } catch (err) {
    log.info(err)
  }
}

const getDepedencyWithExtension = function (dependency) {
  return dependency.url.split("/")[dependency.url.split("/").length - 1]
}

const getStoppedDependencies = function () {
  let stoppedDependenies = []
  let appJson = fs.readJSONSync(`${constants.appDirectory}app.json`)
  const ASCII_MATCH_REGEX = /[^a-zA-Z0-9]/g
  for (let dependency of appJson) {
    if (dependency.type === constants.dependencyTypes.NSSM_SERVICE) {
      let command = `nssm status ${dependency.name}`
      let res = runSpawnCommand(command)
      // const readableOutput = res.data.replace(ASCII_MATCH_REGEX, '')
      if (res && res.data && (res.data.replace(ASCII_MATCH_REGEX, '')).includes('SERVICERUNNING')) {
        log.info(`Service ${dependency.name} is already running`)
      } else {
        log.info(`Service  ${dependency.name}  not running`)
        stoppedDependenies.push(dependency)
        log.info(JSON.stringify(res))
      }
    } else if (dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
      let dependencyWithExtension = getDepedencyWithExtension(dependency)
      let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")
      let isAppRunRunning = appRuning(dependencyWithExecutableExtension)
      if (!isAppRunRunning) {
        stoppedDependenies.push(dependency)
      }
      log.info(`isAppRunRunning ${JSON.stringify(isAppRunRunning)}`)
    }
  }
  return stoppedDependenies
}
const isServiceRunning = function (dependency) {
  if (dependency.type === constants.dependencyTypes.NSSM_SERVICE) {
    let command = `nssm status ${dependency.name}`
    let res = runSpawnCommand(command)
    // const readableOutput = res.data.replace(ASCII_MATCH_REGEX, '')
    const ASCII_MATCH_REGEX = /[^a-zA-Z0-9 ]/g
    if (res && res.data && (res.data.replace(ASCII_MATCH_REGEX, '')).includes('SERVICERUNNING')) {
      return true
    } else {
      return false
    }
  } else if (dependency.type === constants.dependencyTypes.APP_ARCHIVE) {
    let dependencyWithExtension = getDepedencyWithExtension(dependency)
    let dependencyWithExecutableExtension = dependencyWithExtension.replace("zip", "exe")
    let isAppRunRunning = appRuning(dependencyWithExecutableExtension)
    return isAppRunRunning
  }
}

const isMongoRunning = function () {
  let isAppRunRunning = true
  try {
    const res = execSync(`tasklist /v | findstr /I mongod.exe`);
    log.info(`res for mongo after exec Sync : ${res}`)
  } catch (err) {
    log.error(`Mongo Check failed with error ${JSON.stringify(err.message)}`)
    isAppRunRunning = false
  }
  return isAppRunRunning
}
const runServices = async function () {
  log.info("Running up the services")
  mainWindow.webContents.send(`services-running:status`, 'Running Services');
  let errorMessage = ''
  for (let service of servicesData) {
    try {
      service.triggered = true
      let command = spawn(service.commandToRun, {
        shell: true,

      })
      command.stdout.on('data', (data) => {
        log.info(`Status for service ${service.name} ${JSON.stringify(data)}`);
        service.initilalisationCompleted = true
        collectServiceStatus()
      });
      command.stderr.on('data', (data) => {
        log.info(`Error for service ${service.name} ${data}`);
        service.initilalisationCompleted = true
        if (data.includes('uid-manager') && data.includes('already running')) {
          service.isRunning = true
        }
        collectServiceStatus()
      });
      command.on('exit', function (code, signal) {
        service.initilalisationCompleted = true
        log.info(`child process for service ${service.name} exited with ` +
          `code ${code} and signal ${signal}`);
        if (service.name === "mongo") {
          log.info("Checking if mongo is running now ")
          let mongoRunning = isMongoRunning()
          if (mongoRunning) {
            service.isRunning = true
          }
        }
        collectServiceStatus()
      });
    } catch (err) {
      errorMessage = `Failed to start ${service.name} <br>`
      log.error(err)

    }
  }
}

function collectServiceStatus() {
  let allServiceTriggered = servicesData.filter(service => service.triggered).length === servicesData.length
  let allServicesInitialisationDone = servicesData.filter(service => service.initilalisationCompleted).length === servicesData.length
  log.info(`allServiceTriggered ${allServiceTriggered}`)
  log.info(`allServicesInitialisationDone ${allServicesInitialisationDone}`)
  if (allServiceTriggered && !statusSent && allServicesInitialisationDone) {
    statusSent = true
    mainWindow.webContents.on('did-finish-load', function () {
      mainWindow.webContents.send(`services-running:status`, servicesData);
    });
    mainWindow.webContents.send(`services-running:status`, servicesData);
  }
}
async function downloadFile(url, path) {
  log.info(`filePath : ${path}`)
  // let fileFullPath = localPath + url.split("/").pop()  
  log.info('downloading file from url: ' + url)

  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {

      // let fileName = url.split("/").pop()
      const filePath = fs.createWriteStream(path);
      resp.pipe(filePath);
      filePath.on('finish', () => {
        filePath.close();
        log.info('Download Completed');
        resolve('File downloaded')
        // childWindow.webContents.send('file:downloaded', fileName);
      })
    }).on("error", (err) => {
      reject(new Error(err.message))
    });
  })
}

autoUpdater.on("error", (info) => {
  log.info("coming to error autoupdater in boot mark edge ")
  log.info(`autouptater error infor ${info}`)

})
autoUpdater.on("update-available", (info) => {
  log.info("update-available in boot mark edge ")
  log.info(JSON.stringify(info))
  downloadUpdates()
  // mainWindow.webContents.send('update_available');
})
const downloadUpdates = async function () {
  log.info(`Called for downloadUpdates `)
  let res = await getDependenciesToUpdate()
  log.info(`res.toUpdate ${JSON.stringify(res.toUpdate)}`)
  let dependeciesDownloaded = 0
  if (res.toUpdate.length === 0) {
    updatedMarkServicesDownloaded = true
    sendNotificationToRestart()
    return
  }
  for (let dependency of res.toUpdate) {
    log.info(`Traversing dependencies now`)
    let filePath = `${constants.updateDirectory}${getDepedencyWithExtension(dependency)}`
    // downloadFile()
    let fileName = dependency.url.split("/")[dependency.url.split("/").length - 1]
    // let filePath = constants.appDirectory + fileName
    let fileDownloaded = false
    if (fs.existsSync(filePath)) {
      let md5HashofFile = createHash("md5").update(fs.readFileSync(filePath)).digest("hex")
      if (md5HashofFile.toUpperCase() === dependency.checksum) {
        log.info(`${fileName} already downloaded`)
        fileDownloaded = true
      }
    }
    if (!fileDownloaded) {
      await downloadFile(dependency.url, filePath)
    }
    log.info(`file downloaded ${filePath}`)
    dependeciesDownloaded = dependeciesDownloaded + 1
    if (dependeciesDownloaded === res.toUpdate.length) {
      updatedMarkServicesDownloaded = true
      sendNotificationToRestart()
    }
  }
}
autoUpdater.on("update-not-available", (info) => {
  log.info("update--not-available in boot mark edge ")
  log.info(JSON.stringify(info))
  // mainWindow.webContents.send('update_not_available');
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = {
  bootMarkEdge
}
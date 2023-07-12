

const { spawnSync } = require("child_process");
let log = require('electron-log');
const constants = {
  manifestUrl: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/manifest.json",
  configJsonUrl: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/config.json",
  registerServiceUrl: "https://mark-assets.s3.ap-south-1.amazonaws.com/markV3/register-service.ps1",
  dependencyTypes: {
    NSSM_SERVICE: "nssm",
    MSI_INSTALLER: "msi",
    EXECUTABLE: "process",
    ARCHIVE: "archive",
    APP_ARCHIVE: "appArchive",
    PS_SCRIPT: "psScript",
    FILE: "file"
  },
  appDirectory: "C:\\ProgramData\\O4S\\",
  updateDirectory: "C:\\ProgramData\\O4S\\updates\\",
  msiExecuter: "C:\\Windows\\System32\\msiexec.exe"
}

const runSpawnCommand = function (command) {
  try {
    log.info('asdasdasd')
    log.info(command)
    child = spawnSync("powershell.exe", [command], { encoding: 'utf-8' })
    if (child.error) {
      return {
        data: child.stderr,
        success: false
      }
    }
    let stderr = child.stderr
    let stdout = child.stdout
    if (stderr) {
      log.info(`stderr for process ${stderr}`)
      return {
        data: stderr,
        success: false
      }
    }
    else if (stdout) {
      log.info(`stdout for process ${stdout}`)
      return {
        data: stdout,
        success: true
      }
    } else {
      log.info(`No output for the command`)
      return {
        data: null,
        success: true
      }
    }
  } catch (err) {
    log.info(`Failed to run the spawn command ${command} with error ${err.message}`)
    return {
      data: err.message,
      success: false
    }
  }
}

module.exports = {
  constants,
  runSpawnCommand
}
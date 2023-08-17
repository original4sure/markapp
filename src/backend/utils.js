

let log = require('electron-log');
const decompress = require("decompress");
const { createHash } = require("crypto");
const https = require('https');
const fs = require('fs-extra');
const { spawnSync } = require("child_process");
const path = require('path')

const runSpawnCommand = function (command) {
  try {
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

async function downloadFile(url, path) {
  log.info(`filePath : ${path}`)
  log.info('downloading file from url: ' + url)

  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      const filePath = fs.createWriteStream(path);
      resp.pipe(filePath);
      filePath.on('finish', () => {
        filePath.close();
        log.info('Download Completed');
        resolve('File downloaded')
      })
    }).on("error", (err) => {
      reject(new Error(err.message))
    });
  })
}

function sendAlert(key, value) {
  global.window.webContents.on('did-finish-load', function () {
    global.window.webContents.send(key, value);
  });
  global.window.webContents.send(key, value)
}

const moveFile = function(currentPath, newPath) {
  fs.renameSync(currentPath, newPath)
}

const extractFileNameFromUrl = function (dependency) {
  return dependency.url.split("/").pop()
}

const matchChecksum = function (filePath, checksum) {
  let md5HashofFile = createHash("md5").update(fs.readFileSync(filePath)).digest("hex")
      if (md5HashofFile.toUpperCase() === checksum) {
        return true
      }
      return false
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractFiles(sourceFolderPath, destinationFolderPath) {
  try {
    await decompress(sourceFolderPath, destinationFolderPath)
  } catch (err) {
    log.error('Error while extracting files:', err);
    throw err
  }
}

const buildSilentExecutionCommand = function(path) {
  const silentCommand = `Start-Process -Wait -FilePath ${path} -ArgumentList /S -PassThru`
  return silentCommand
}

const runMongoInstallationCommand = function() {
  let installCommand = `& "${mongoDbPath}\\bin\\mongod.exe" --config "${mongoDbConfigPath}" --install`
  return utils.runSpawnCommand(installCommand)
}

module.exports = {
  runSpawnCommand,
  downloadFile,
  sendAlert,
  sleep,
  moveFile,
  extractFileNameFromUrl,
  matchChecksum,
  extractFiles,
  buildSilentExecutionCommand,
  runMongoInstallationCommand
}